import type Stripe from "stripe";
import { getPreorderConfiguration } from "./preorder-config.server";
import {
  sendPreorderConfirmationEmail,
  sendPreorderRefundUpdateEmail,
} from "./preorder-email.server";
import { createPreorderManagePath } from "./preorder-order-access.server";
import { PREORDER_PRODUCT_NAME } from "./preorder";
import { getStripe, getStripePreorderPriceId } from "./stripe.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

type PreorderRow = {
  id: string;
  order_number: number;
  environment: "test" | "live";
  email: string;
  full_name: string;
  amount_total: number;
  currency: string;
  estimated_delivery: string;
  placed_at: string;
  payment_status: string;
  fulfillment_status: string;
  confirmation_email_sent_at: string | null;
  shipping_address: Record<string, unknown>;
  manage_token_version: number;
};

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function insertOrderEvent(input: {
  preorderId: string;
  eventKey: string;
  eventType: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase.from("preorder_events").upsert(
    {
      preorder_id: input.preorderId,
      event_key: input.eventKey,
      event_type: input.eventType,
      source: "stripe",
      detail: input.detail ?? {},
    },
    { onConflict: "event_key", ignoreDuplicates: true },
  );
  if (result.error) throw result.error;
}

export async function fulfillPreorderCheckout(
  session: Stripe.Checkout.Session,
  origin: string,
) {
  if (session.metadata?.flow !== "frame_preorder") {
    throw new Error("Checkout Session is not a Frame pre-order.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Pre-order Checkout Session has not been paid.");
  }
  if (session.consent?.terms_of_service !== "accepted") {
    throw new Error("Pre-order terms were not accepted in Checkout.");
  }

  const environment = session.livemode ? "live" : "test";
  if (session.metadata.environment !== environment) {
    throw new Error("Stripe payment environment metadata is invalid.");
  }

  const intentId = session.metadata.checkout_intent_id;
  if (!intentId) throw new Error("Pre-order checkout intent metadata is missing.");

  const supabase = await getSupabaseAdmin();
  const intentResult = await supabase
    .from("preorder_checkout_intents")
    .select("*")
    .eq("id", intentId)
    .single();
  if (intentResult.error || !intentResult.data) {
    throw intentResult.error ?? new Error("Pre-order checkout intent was not found.");
  }
  const intent = intentResult.data;

  if (intent.environment !== environment) {
    throw new Error("Pre-order intent environment does not match the Stripe payment.");
  }

  if (
    !intent.terms_version ||
    !intent.product_status_version ||
    session.metadata.terms_version !== intent.terms_version ||
    session.metadata.product_status_version !== intent.product_status_version
  ) {
    throw new Error("Pre-order legal versions do not match the reviewed offer.");
  }

  const expectedSubtotal = intent.unit_amount * intent.quantity;
  if (
    session.amount_subtotal !== expectedSubtotal ||
    session.amount_total === null ||
    session.currency !== intent.currency
  ) {
    throw new Error("Checkout Session totals do not match the pre-order intent.");
  }

  const stripe = await getStripe(environment);
  const configuredPriceId = await getStripePreorderPriceId(environment);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  if (
    lineItems.data.length !== 1 ||
    lineItems.data[0]?.price?.id !== configuredPriceId ||
    lineItems.data[0]?.quantity !== intent.quantity
  ) {
    throw new Error("Checkout Session contains an unexpected pre-order line item.");
  }

  const email = session.customer_details?.email?.trim().toLowerCase();
  const shipping = session.collected_information?.shipping_details;
  const fullName =
    shipping?.name?.trim().replace(/\s+/g, " ") ||
    session.collected_information?.individual_name?.trim().replace(/\s+/g, " ") ||
    session.customer_details?.name?.trim().replace(/\s+/g, " ");
  if (!email || !fullName || !shipping?.address) {
    throw new Error("Checkout Session is missing the pre-order customer or shipping address.");
  }

  const config = await getPreorderConfiguration();
  const shippingCountry = shipping.address.country?.toUpperCase();
  if (!shippingCountry || !config.allowedCountries.includes(shippingCountry)) {
    throw new Error("Checkout Session contains an unsupported shipping country.");
  }

  const existing = await supabase
    .from("preorders")
    .select("*")
    .eq("checkout_intent_id", intent.id)
    .maybeSingle<PreorderRow>();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.environment !== environment) {
    throw new Error("Stored pre-order environment does not match the Stripe payment.");
  }

  const paymentIntentId = stripeId(session.payment_intent);
  const customerId = stripeId(session.customer);
  const placedAt = new Date(session.created * 1000).toISOString();
  const totalDetails = session.total_details;
  let order = existing.data;

  if (!order) {
    const inserted = await supabase
      .from("preorders")
      .insert({
        environment,
        checkout_intent_id: intent.id,
        stripe_checkout_session_id: session.id,
        stripe_customer_id: customerId,
        email,
        normalized_email: email,
        full_name: fullName,
        phone: session.customer_details?.phone ?? null,
        shipping_address: shipping.address,
        order_status: "placed",
        payment_status: "paid",
        fulfillment_status: "on_hold",
        amount_subtotal: session.amount_subtotal,
        amount_shipping: totalDetails?.amount_shipping ?? 0,
        amount_tax: totalDetails?.amount_tax ?? 0,
        amount_total: session.amount_total,
        currency: session.currency,
        estimated_delivery: intent.estimated_delivery,
        current_estimated_delivery: intent.estimated_delivery,
        terms_version: intent.terms_version,
        product_status_version: intent.product_status_version,
        terms_accepted_at: intent.terms_accepted_at,
        product_status_acknowledged_at: intent.product_status_acknowledged_at,
        marketing_opt_in: intent.marketing_opt_in,
        marketing_consent_at: intent.marketing_consent_at,
        placed_at: placedAt,
      })
      .select("*")
      .single<PreorderRow>();
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") {
        const raced = await supabase
          .from("preorders")
          .select("*")
          .eq("checkout_intent_id", intent.id)
          .single<PreorderRow>();
        if (raced.error || !raced.data) throw raced.error;
        order = raced.data;
      } else {
        throw inserted.error ?? new Error("Could not create the pre-order.");
      }
    } else {
      order = inserted.data;
    }
  }

  const item = await supabase.from("preorder_order_items").upsert(
    {
      preorder_id: order.id,
      sku: intent.sku,
      product_name: PREORDER_PRODUCT_NAME,
      quantity: intent.quantity,
      unit_amount: intent.unit_amount,
      currency: intent.currency,
    },
    { onConflict: "preorder_id,sku" },
  );
  if (item.error) throw item.error;

  const payment = await supabase.from("preorder_payments").upsert(
    {
      environment,
      preorder_id: order.id,
      checkout_intent_id: intent.id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      payment_kind: "full_payment",
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: "paid",
      paid_at: placedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" },
  );
  if (payment.error) throw payment.error;

  const intentUpdate = await supabase
    .from("preorder_checkout_intents")
    .update({
      status: "paid",
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intent.id);
  if (intentUpdate.error) throw intentUpdate.error;

  await insertOrderEvent({
    preorderId: order.id,
    eventKey: `preorder-paid-${session.id}`,
    eventType: "payment_confirmed",
    detail: { checkout_session_id: session.id, payment_intent_id: paymentIntentId },
  });

  if (!order.confirmation_email_sent_at) {
    try {
      const managePath = await createPreorderManagePath({
        orderId: order.id,
        tokenVersion: order.manage_token_version,
      });
      await sendPreorderConfirmationEmail({
        origin,
        preorderId: order.id,
        orderNumber: order.order_number,
        environment: order.environment,
        email: order.email,
        fullName: order.full_name,
        amountTotal: order.amount_total,
        currency: order.currency,
        quantity: intent.quantity,
        placedAt: order.placed_at,
        estimatedDelivery: order.estimated_delivery,
        shippingAddress: order.shipping_address,
        managePath,
      });
      const sentAt = new Date().toISOString();
      const updated = await supabase
        .from("preorders")
        .update({ confirmation_email_sent_at: sentAt, updated_at: sentAt })
        .eq("id", order.id);
      if (updated.error) throw updated.error;
      order = { ...order, confirmation_email_sent_at: sentAt };
    } catch (error) {
      console.error("Pre-order confirmation email failed", error);
      await insertOrderEvent({
        preorderId: order.id,
        eventKey: `preorder-confirmation-email-failed-${session.id}`,
        eventType: "confirmation_email_failed",
        detail: {
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        },
      });
    }
  }

  return order;
}

export async function reconcilePreorderRefund(input: {
  paymentIntentId: string;
  amountRefunded: number;
  fullyRefunded: boolean;
  failed?: boolean;
  origin?: string;
}) {
  const supabase = await getSupabaseAdmin();
  const payment = await supabase
    .from("preorder_payments")
    .select("preorder_id,amount_total,amount_refunded,currency")
    .eq("stripe_payment_intent_id", input.paymentIntentId)
    .maybeSingle();
  if (payment.error) throw payment.error;
  if (!payment.data?.preorder_id) return false;
  const order = await supabase
    .from("preorders")
    .select("id,order_number,environment,manage_token_version,email,full_name,cancellation_status")
    .eq("id", payment.data.preorder_id)
    .single();
  if (order.error) throw order.error;

  const paymentStatus = input.failed
    ? "refund_failed"
    : input.fullyRefunded
      ? "refunded"
      : "partially_refunded";
  const refundedAt = input.fullyRefunded ? new Date().toISOString() : null;
  const amountRefunded = input.failed
    ? payment.data.amount_refunded ?? 0
    : input.amountRefunded;

  const paymentUpdate = await supabase
    .from("preorder_payments")
    .update({
      payment_status: paymentStatus,
      amount_refunded: amountRefunded,
      refunded_at: refundedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", input.paymentIntentId);
  if (paymentUpdate.error) throw paymentUpdate.error;

  const orderUpdateValues: Record<string, unknown> = {
    order_status: input.fullyRefunded ? "cancelled" : "placed",
    payment_status: paymentStatus,
    amount_refunded: amountRefunded,
    cancelled_at: input.fullyRefunded ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (input.fullyRefunded) {
    orderUpdateValues.cancellation_status = "completed";
    orderUpdateValues.cancellation_resolved_at = new Date().toISOString();
  } else if (input.failed && order.data.cancellation_status === "processing") {
    orderUpdateValues.cancellation_status = "requested";
  }

  const orderUpdate = await supabase
    .from("preorders")
    .update(orderUpdateValues)
    .eq("id", payment.data.preorder_id);
  if (orderUpdate.error) throw orderUpdate.error;

  await insertOrderEvent({
    preorderId: payment.data.preorder_id,
    eventKey: `preorder-refund-${input.paymentIntentId}-${amountRefunded}-${paymentStatus}`,
    eventType: paymentStatus,
    detail: { amount_refunded: amountRefunded },
  });
  if (input.fullyRefunded && input.origin) {
    try {
      const managePath = await createPreorderManagePath({
        orderId: order.data.id,
        tokenVersion: order.data.manage_token_version,
      });
      await sendPreorderRefundUpdateEmail({
        origin: input.origin,
        preorderId: order.data.id,
        orderNumber: order.data.order_number,
        environment: order.data.environment,
        email: order.data.email,
        fullName: order.data.full_name,
        amountRefunded,
        currency: payment.data.currency,
        status: "completed",
        managePath,
      });
    } catch (error) {
      console.error("Pre-order refund completion email failed", error);
      await insertOrderEvent({
        preorderId: order.data.id,
        eventKey: `preorder-refund-email-failed-${input.paymentIntentId}-${amountRefunded}`,
        eventType: "refund_completion_email_failed",
        detail: {
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        },
      });
    }
  }
  return true;
}

export async function reconcilePreorderDispute(
  paymentIntentId: string,
  disputed: boolean,
) {
  const supabase = await getSupabaseAdmin();
  const payment = await supabase
    .from("preorder_payments")
    .select("preorder_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (payment.error) throw payment.error;
  if (!payment.data?.preorder_id) return false;

  const status = disputed ? "disputed" : "paid";
  const orderUpdate = await supabase
    .from("preorders")
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq("id", payment.data.preorder_id);
  if (orderUpdate.error) throw orderUpdate.error;

  await insertOrderEvent({
    preorderId: payment.data.preorder_id,
    eventKey: `preorder-dispute-${paymentIntentId}-${status}`,
    eventType: disputed ? "dispute_opened" : "dispute_won",
  });
  return true;
}
