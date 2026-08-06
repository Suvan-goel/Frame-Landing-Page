import type Stripe from "stripe";
import { getSupabaseAdmin } from "./supabase-admin.server";
import {
  addMembershipYear,
  CONTRIBUTOR_CURRENCY,
  CONTRIBUTOR_PRICE_CENTS,
  CONTRIBUTOR_TERMS_VERSION,
} from "./contributor-membership";
import { sendContributorWelcomeEmail } from "./contributor-email.server";
import { getStripe, getStripePriceId } from "./stripe.server";

async function initiateDuplicateRefund(input: {
  stripe: Stripe;
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>;
  sessionId: string;
  paymentIntentId: string | null;
}) {
  if (!input.paymentIntentId) {
    throw new Error("The duplicate payment is missing its PaymentIntent.");
  }
  await input.stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      reason: "duplicate",
      metadata: {
        membership: "frame_founding_contributor",
        duplicate_checkout_session_id: input.sessionId,
      },
    },
    { idempotencyKey: `founding-contributor-duplicate-${input.sessionId}` },
  );
  const updated = await input.supabase
    .from("contributor_payments")
    .update({
      payment_status: "duplicate_refund_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", input.sessionId);
  if (updated.error) throw updated.error;
}

async function ensureAuthUser(email: string) {
  const supabase = await getSupabaseAdmin();
  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.data.user) return created.data.user.id;
  const duplicateUser =
    created.error?.code === "email_exists" ||
    created.error?.code === "user_already_exists" ||
    created.error?.message.toLowerCase().includes("already registered");
  if (duplicateUser) {
    // The first passwordless sign-in links the paid contributor by normalized email.
    return null;
  }
  throw created.error ?? new Error("Could not provision contributor access.");
}

export async function fulfillContributorCheckout(session: Stripe.Checkout.Session, origin: string) {
  if (
    session.payment_status !== "paid" ||
    session.amount_total !== CONTRIBUTOR_PRICE_CENTS ||
    session.currency !== CONTRIBUTOR_CURRENCY
  ) {
    throw new Error("Checkout Session does not match the Founding Contributor payment.");
  }

  const stripe = await getStripe();
  const configuredPriceId = await getStripePriceId();
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  if (
    lineItems.data.length !== 1 ||
    lineItems.data[0]?.price?.id !== configuredPriceId ||
    lineItems.data[0]?.quantity !== 1
  ) {
    throw new Error("Checkout Session contains an unexpected line item.");
  }

  const email = session.customer_details?.email?.trim().toLowerCase();
  const fullName = session.customer_details?.name?.trim().replace(/\s+/g, " ");
  if (!email || !fullName) {
    throw new Error("Checkout Session is missing the contributor name or email.");
  }
  if (session.consent?.terms_of_service !== "accepted") {
    throw new Error("Checkout terms were not accepted.");
  }

  const supabase = await getSupabaseAdmin();
  const intentId = session.metadata?.checkout_intent_id;
  const { data: intent, error: intentError } = intentId
    ? await supabase
        .from("contributor_checkout_intents")
        .select("*")
        .eq("id", intentId)
        .single()
    : { data: null, error: new Error("Checkout intent metadata is missing.") };
  if (intentError || !intent) throw intentError ?? new Error("Checkout intent was not found.");

  const { data: existingContributor, error: existingError } = await supabase
    .from("contributors")
    .select("*")
    .eq("normalized_email", email)
    .maybeSingle();
  if (existingError) throw existingError;

  const { data: alreadyProcessed, error: alreadyProcessedError } = await supabase
    .from("contributor_payments")
    .select("contributor_id,payment_status,stripe_payment_intent_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (alreadyProcessedError) throw alreadyProcessedError;
  if (alreadyProcessed?.contributor_id) {
    const completed = await supabase
      .from("contributors")
      .select("*")
      .eq("id", alreadyProcessed.contributor_id)
      .single();
    if (completed.error || !completed.data) {
      throw completed.error ?? new Error("Completed contributor record was not found.");
    }
    if (alreadyProcessed.payment_status === "duplicate_paid") {
      await initiateDuplicateRefund({
        stripe,
        supabase,
        sessionId: session.id,
        paymentIntentId: alreadyProcessed.stripe_payment_intent_id,
      });
    }
    if (
      alreadyProcessed.payment_status === "paid" &&
      !completed.data.welcome_email_sent_at
    ) {
      await sendContributorWelcomeEmail({
        origin,
        email: completed.data.email,
        fullName: completed.data.full_name,
        contributorNumber: completed.data.contributor_number,
        paidAt: completed.data.paid_at,
        accessExpiresAt: completed.data.access_expires_at,
      });
      await supabase
        .from("contributors")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", completed.data.id);
    }
    return completed.data;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);

  if (existingContributor) {
    if (existingContributor.checkout_intent_id === intent.id) {
      const resumedPayment = await supabase.from("contributor_payments").upsert(
        {
          contributor_id: existingContributor.id,
          checkout_intent_id: intent.id,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: customerId,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_status: "paid",
          paid_at: paidAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_checkout_session_id" },
      );
      if (resumedPayment.error) throw resumedPayment.error;
      const resumedIntent = await supabase
        .from("contributor_checkout_intents")
        .update({
          status: "paid",
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);
      if (resumedIntent.error) throw resumedIntent.error;
      if (!existingContributor.welcome_email_sent_at) {
        await sendContributorWelcomeEmail({
          origin,
          email: existingContributor.email,
          fullName: existingContributor.full_name,
          contributorNumber: existingContributor.contributor_number,
          paidAt: existingContributor.paid_at,
          accessExpiresAt: existingContributor.access_expires_at,
        });
        await supabase
          .from("contributors")
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq("id", existingContributor.id);
      }
      return existingContributor;
    }
    const duplicatePayment = await supabase.from("contributor_payments").upsert(
      {
        contributor_id: existingContributor.id,
        checkout_intent_id: intent.id,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: "duplicate_paid",
        paid_at: paidAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_checkout_session_id" },
    );
    if (duplicatePayment.error) throw duplicatePayment.error;
    await supabase
      .from("contributor_checkout_intents")
      .update({ status: "duplicate_paid", updated_at: new Date().toISOString() })
      .eq("id", intent.id);
    await initiateDuplicateRefund({
      stripe,
      supabase,
      sessionId: session.id,
      paymentIntentId,
    });
    return existingContributor;
  }

  const authUserId = await ensureAuthUser(email);
  const accessStartsAt = paidAt;
  const accessExpiresAt = addMembershipYear(accessStartsAt);
  const acceptedAt = intent.product_status_acknowledged_at;
  const inserted = await supabase
    .from("contributors")
    .insert({
      checkout_intent_id: intent.id,
      auth_user_id: authUserId,
      email,
      normalized_email: email,
      full_name: fullName,
      membership_status: "active",
      founding_status: true,
      future_discount_eligible: true,
      paid_at: paidAt.toISOString(),
      access_starts_at: accessStartsAt.toISOString(),
      access_expires_at: accessExpiresAt.toISOString(),
      terms_version: intent.terms_version ?? CONTRIBUTOR_TERMS_VERSION,
      terms_accepted_at: acceptedAt,
      product_status_acknowledged_at: acceptedAt,
      marketing_opt_in: Boolean(intent.marketing_opt_in),
      marketing_consent_at: intent.marketing_consent_at,
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) {
    throw inserted.error ?? new Error("Could not create the contributor membership.");
  }

  const payment = await supabase.from("contributor_payments").upsert(
    {
      contributor_id: inserted.data.id,
      checkout_intent_id: intent.id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: "paid",
      paid_at: paidAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" },
  );
  if (payment.error) throw payment.error;

  const intentUpdate = await supabase
    .from("contributor_checkout_intents")
    .update({
      status: "paid",
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intent.id);
  if (intentUpdate.error) throw intentUpdate.error;

  if (!inserted.data.welcome_email_sent_at) {
    await sendContributorWelcomeEmail({
      origin,
      email,
      fullName,
      contributorNumber: inserted.data.contributor_number,
      paidAt: paidAt.toISOString(),
      accessExpiresAt: accessExpiresAt.toISOString(),
    });
    await supabase
      .from("contributors")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", inserted.data.id);
  }

  return inserted.data;
}

export async function reconcileRefund(paymentIntentId: string, status: string) {
  const supabase = await getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("contributor_payments")
    .select("contributor_id,payment_status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment?.contributor_id) return false;

  const duplicatePayment = payment.payment_status.startsWith("duplicate_");
  const recordedStatus = duplicatePayment
    ? status === "refunded"
      ? "duplicate_refunded"
      : "duplicate_refund_failed"
    : status;
  await supabase
    .from("contributor_payments")
    .update({
      payment_status: recordedStatus,
      refunded_at: status === "refunded" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (duplicatePayment) return true;

  if (status === "refunded") {
    const result = await supabase
      .from("contributors")
      .update({
        membership_status: "refunded",
        founding_status: false,
        future_discount_eligible: false,
        refund_status: "succeeded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.contributor_id);
    if (result.error) throw result.error;
  }
  return true;
}

export async function reconcileDispute(paymentIntentId: string, disputed: boolean) {
  const supabase = await getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("contributor_payments")
    .select("contributor_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment?.contributor_id) return false;

  const result = await supabase
    .from("contributors")
    .update({
      membership_status: disputed ? "disputed" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.contributor_id);
  if (result.error) throw result.error;
  return true;
}
