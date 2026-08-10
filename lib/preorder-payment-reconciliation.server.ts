import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  evaluatePreorderPaymentReconciliation,
  type PreorderPaymentReconciliationResult,
  type StoredPreorderReconciliationIntent,
  type StoredPreorderReconciliationOrder,
  type StoredPreorderReconciliationPayment,
  type StripePreorderPaymentSnapshot,
} from "./preorder-payment-reconciliation";

const DATABASE_PAGE_SIZE = 500;
const MAX_DATABASE_ROWS = 10_000;
const MAX_STRIPE_SESSIONS = 10_000;
const MAX_STRIPE_OBJECTS_PER_PAYMENT = 1_000;
const PREORDER_RECONCILIATION_START = Math.floor(
  Date.parse("2026-08-01T00:00:00.000Z") / 1_000,
);

function stripeId(value: { id: string } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function loadAllEnvironmentRows(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  environment: "live" | "test",
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < MAX_DATABASE_ROWS; offset += DATABASE_PAGE_SIZE) {
    const result = await supabase
      .from(table)
      .select(columns)
      .eq("environment", environment)
      .order("id", { ascending: true })
      .range(offset, offset + DATABASE_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) return rows;
  }
  throw new Error(`${table} exceeds the ${MAX_DATABASE_ROWS}-row reconciliation limit.`);
}

async function loadReferencedIntents(
  supabase: SupabaseClient,
  ids: string[],
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await supabase
      .from("preorder_checkout_intents")
      .select(
        "id,environment,status,stripe_checkout_session_id,stripe_customer_id,quantity,unit_amount,currency",
      )
      .in("id", ids.slice(offset, offset + 100));
    if (result.error) throw result.error;
    rows.push(...((result.data ?? []) as Record<string, unknown>[]));
  }
  return rows;
}

async function listPaidPreorderSessions(stripe: Stripe) {
  const sessions: Stripe.Checkout.Session[] = [];
  let startingAfter: string | undefined;
  let scanned = 0;
  while (true) {
    const page = await stripe.checkout.sessions.list({
      created: { gte: PREORDER_RECONCILIATION_START },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    scanned += page.data.length;
    for (const session of page.data) {
      if (
        session.metadata?.flow === "frame_preorder" &&
        session.payment_status === "paid"
      ) {
        sessions.push(session);
      }
    }
    if (!page.has_more) return sessions;
    if (scanned >= MAX_STRIPE_SESSIONS) {
      throw new Error(
        `Stripe Checkout history exceeds the ${MAX_STRIPE_SESSIONS}-session reconciliation limit.`,
      );
    }
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) throw new Error("Stripe Checkout pagination did not advance.");
  }
}

async function listPaymentRefunds(stripe: Stripe, paymentIntentId: string) {
  const refunds: Stripe.Refund[] = [];
  let startingAfter: string | undefined;
  while (true) {
    const page = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    refunds.push(...page.data);
    if (!page.has_more) return refunds;
    if (refunds.length >= MAX_STRIPE_OBJECTS_PER_PAYMENT) {
      throw new Error("A payment exceeds the refund reconciliation limit.");
    }
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) throw new Error("Stripe Refund pagination did not advance.");
  }
}

async function listPaymentDisputes(stripe: Stripe, paymentIntentId: string) {
  const disputes: Stripe.Dispute[] = [];
  let startingAfter: string | undefined;
  while (true) {
    const page = await stripe.disputes.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    disputes.push(...page.data);
    if (!page.has_more) return disputes;
    if (disputes.length >= MAX_STRIPE_OBJECTS_PER_PAYMENT) {
      throw new Error("A payment exceeds the dispute reconciliation limit.");
    }
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) throw new Error("Stripe Dispute pagination did not advance.");
  }
}

async function mapWithConcurrency<T, Result>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<Result>,
) {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

async function stripePaymentSnapshot(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<StripePreorderPaymentSnapshot> {
  const paymentIntentId = stripeId(session.payment_intent);
  let paymentIntent: Stripe.PaymentIntent | null = null;
  let charge: Stripe.Charge | null = null;
  let refunds: Stripe.Refund[] = [];
  let disputes: Stripe.Dispute[] = [];
  if (paymentIntentId) {
    [paymentIntent, refunds, disputes] = await Promise.all([
      stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      }),
      listPaymentRefunds(stripe, paymentIntentId),
      listPaymentDisputes(stripe, paymentIntentId),
    ]);
    const latestCharge = paymentIntent.latest_charge;
    if (typeof latestCharge === "string") {
      charge = await stripe.charges.retrieve(latestCharge);
    } else if (latestCharge) {
      charge = latestCharge;
    }
  }
  const totalDetails = session.total_details;
  return {
    checkoutSessionId: session.id,
    livemode: session.livemode,
    sessionStatus: session.status,
    paymentStatus: session.payment_status,
    mode: session.mode,
    checkoutIntentId: session.metadata?.checkout_intent_id ?? null,
    customerId: stripeId(session.customer),
    paymentIntentId,
    metadataFlow: session.metadata?.flow ?? null,
    metadataEnvironment: session.metadata?.environment ?? null,
    currency: session.currency,
    amountSubtotal: session.amount_subtotal,
    amountShipping: totalDetails?.amount_shipping ?? 0,
    amountTax: totalDetails?.amount_tax ?? 0,
    amountDiscount: totalDetails?.amount_discount ?? 0,
    amountTotal: session.amount_total,
    paymentIntent: paymentIntent
      ? {
          id: paymentIntent.id,
          livemode: paymentIntent.livemode,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          amountReceived: paymentIntent.amount_received,
          currency: paymentIntent.currency,
          customerId: stripeId(paymentIntent.customer),
          metadataFlow: paymentIntent.metadata.flow ?? null,
          metadataCheckoutIntentId:
            paymentIntent.metadata.checkout_intent_id ?? null,
          metadataEnvironment: paymentIntent.metadata.environment ?? null,
        }
      : null,
    charge: charge
      ? {
          id: charge.id,
          livemode: charge.livemode,
          status: charge.status,
          paid: charge.paid,
          amount: charge.amount,
          amountCaptured: charge.amount_captured,
          amountRefunded: charge.amount_refunded,
          currency: charge.currency,
          customerId: stripeId(charge.customer),
          paymentIntentId: stripeId(charge.payment_intent),
        }
      : null,
    refunds: refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      livemode: refund.livemode,
      paymentIntentId: stripeId(refund.payment_intent),
      status: refund.status,
      created: refund.created,
    })),
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      amount: dispute.amount,
      currency: dispute.currency,
      livemode: dispute.livemode,
      paymentIntentId: stripeId(dispute.payment_intent),
      status: dispute.status,
    })),
  };
}

function storedOrder(row: Record<string, unknown>): StoredPreorderReconciliationOrder {
  return {
    id: String(row.id),
    orderNumber: Number(row.order_number),
    environment: row.environment as "live" | "test",
    checkoutIntentId: String(row.checkout_intent_id),
    checkoutSessionId: String(row.stripe_checkout_session_id),
    customerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    orderStatus: String(row.order_status),
    paymentStatus: String(row.payment_status),
    cancellationStatus: String(row.cancellation_status),
    amountSubtotal: Number(row.amount_subtotal),
    amountShipping: Number(row.amount_shipping),
    amountTax: Number(row.amount_tax),
    amountTotal: Number(row.amount_total),
    amountRefunded: Number(row.amount_refunded),
    currency: String(row.currency),
  };
}

function storedPayment(
  row: Record<string, unknown>,
): StoredPreorderReconciliationPayment {
  return {
    id: String(row.id),
    preorderId: String(row.preorder_id),
    checkoutIntentId: String(row.checkout_intent_id),
    checkoutSessionId: String(row.stripe_checkout_session_id),
    paymentIntentId:
      typeof row.stripe_payment_intent_id === "string"
        ? row.stripe_payment_intent_id
        : null,
    customerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    environment: row.environment as "live" | "test",
    paymentKind: String(row.payment_kind),
    paymentStatus: String(row.payment_status),
    amountTotal: Number(row.amount_total),
    amountRefunded: Number(row.amount_refunded),
    currency: String(row.currency),
  };
}

function storedIntent(
  row: Record<string, unknown>,
): StoredPreorderReconciliationIntent {
  return {
    id: String(row.id),
    environment: row.environment as "live" | "test",
    status: String(row.status),
    checkoutSessionId:
      typeof row.stripe_checkout_session_id === "string"
        ? row.stripe_checkout_session_id
        : null,
    customerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    quantity: Number(row.quantity),
    unitAmount: Number(row.unit_amount),
    currency: String(row.currency),
  };
}

export async function runPreorderPaymentReconciliation(input: {
  supabase: SupabaseClient;
  stripe: Stripe;
  environment: "live" | "test";
}): Promise<PreorderPaymentReconciliationResult> {
  const [orderRows, paymentRows, stripeSessions] = await Promise.all([
    loadAllEnvironmentRows(
      input.supabase,
      "preorders",
      "id,order_number,environment,checkout_intent_id,stripe_checkout_session_id,stripe_customer_id,order_status,payment_status,cancellation_status,amount_subtotal,amount_shipping,amount_tax,amount_total,amount_refunded,currency",
      input.environment,
    ),
    loadAllEnvironmentRows(
      input.supabase,
      "preorder_payments",
      "id,preorder_id,checkout_intent_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_customer_id,environment,payment_kind,payment_status,amount_total,amount_refunded,currency",
      input.environment,
    ),
    listPaidPreorderSessions(input.stripe),
  ]);
  const orders = orderRows.map(storedOrder);
  const intentRows = await loadReferencedIntents(
    input.supabase,
    [...new Set(orders.map((order) => order.checkoutIntentId))],
  );
  const stripePayments = await mapWithConcurrency(
    stripeSessions,
    4,
    (session) => stripePaymentSnapshot(input.stripe, session),
  );
  return evaluatePreorderPaymentReconciliation({
    environment: input.environment,
    orders,
    payments: paymentRows.map(storedPayment),
    intents: intentRows.map(storedIntent),
    stripePayments,
  });
}
