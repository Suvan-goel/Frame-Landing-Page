import type Stripe from "stripe";
import {
  sendPreorderAddressChangeResolutionEmail,
  sendPreorderConfirmationEmail,
  sendPreorderDeliveryUpdateEmail,
  sendPreorderRefundUpdateEmail,
  sendPreorderShippingEmail,
} from "./preorder-email.server";
import { createPreorderManagePath } from "./preorder-order-access.server";
import { reconcilePreorderRefund } from "./preorder-payments.server";
import type { PreorderEnvironment } from "./preorder-operations.server";
import { getRuntimeValue } from "./runtime-env.server";
import { getStripe } from "./stripe.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

type OperationalOrder = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  manage_token_version: number;
  email: string;
  full_name: string;
  shipping_address: Record<string, unknown>;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  cancellation_status: string;
  confirmation_email_sent_at: string | null;
  amount_subtotal: number;
  amount_shipping: number;
  amount_tax: number;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  current_estimated_delivery: string;
  placed_at: string;
  address_change_status: string;
  address_change_requested_at: string | null;
  requested_shipping_address: Record<string, unknown> | null;
  address_change_reason: string | null;
  address_change_resolved_at: string | null;
  address_change_resolution_note: string | null;
  delivery_update_version: number;
  delivery_update_status: string;
  delivery_update_message: string | null;
  delivery_update_sent_at: string | null;
  delivery_update_acknowledged_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
};

const operationalOrderColumns =
  "id,order_number,environment,manage_token_version,email,full_name,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,confirmation_email_sent_at,amount_subtotal,amount_shipping,amount_tax,amount_total,amount_refunded,currency,estimated_delivery,current_estimated_delivery,placed_at,address_change_status,address_change_requested_at,requested_shipping_address,address_change_reason,address_change_resolved_at,address_change_resolution_note,delivery_update_version,delivery_update_status,delivery_update_message,delivery_update_sent_at,delivery_update_acknowledged_at,carrier,tracking_number,tracking_url,shipped_at";

async function getOperationalOrder(orderId: string) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase
    .from("preorders")
    .select(operationalOrderColumns)
    .eq("id", orderId)
    .maybeSingle<OperationalOrder>();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Pre-order not found.");
  return result.data;
}

async function recordOwnerEvent(input: {
  orderId: string;
  eventType: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase.from("preorder_events").insert({
    preorder_id: input.orderId,
    event_key: `preorder-owner-${input.eventType}-${crypto.randomUUID()}`,
    event_type: input.eventType,
    source: "owner",
    detail: input.detail ?? {},
  });
  if (result.error) throw result.error;
}

export async function updatePreorderFulfillment(input: {
  origin: string;
  orderId: string;
  fulfillmentStatus: "on_hold" | "ready" | "processing" | "shipped" | "delivered" | "returned";
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  ownerNote: string | null;
}) {
  const order = await getOperationalOrder(input.orderId);
  if (order.order_status === "cancelled" || order.payment_status === "refunded") {
    throw new Error("Cancelled or refunded orders cannot be moved through fulfilment.");
  }
  if (
    ["requested", "processing"].includes(order.cancellation_status) &&
    ["shipped", "delivered"].includes(input.fulfillmentStatus)
  ) {
    throw new Error("Resolve the cancellation request before shipping this order.");
  }
  if (
    ["requested", "processing"].includes(order.address_change_status) &&
    ["shipped", "delivered"].includes(input.fulfillmentStatus)
  ) {
    throw new Error("Resolve the shipping-address request before shipping this order.");
  }
  if (
    ["shipped", "delivered"].includes(input.fulfillmentStatus) &&
    (!input.carrier || !input.trackingNumber || !input.trackingUrl)
  ) {
    throw new Error("Carrier, tracking number and tracking URL are required before shipping.");
  }

  const now = new Date().toISOString();
  const firstShipment =
    !order.shipped_at && ["shipped", "delivered"].includes(input.fulfillmentStatus);
  const update: Record<string, unknown> = {
    fulfillment_status: input.fulfillmentStatus,
    carrier: input.carrier,
    tracking_number: input.trackingNumber,
    tracking_url: input.trackingUrl,
    owner_note: input.ownerNote,
    updated_at: now,
  };
  if (firstShipment) update.shipped_at = now;
  if (input.fulfillmentStatus === "delivered") {
    update.delivered_at = now;
    update.order_status = "completed";
    update.completed_at = now;
  }

  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorders")
    .update(update)
    .eq("id", order.id)
    .select(operationalOrderColumns)
    .single<OperationalOrder>();
  if (updated.error || !updated.data) {
    throw updated.error ?? new Error("Pre-order fulfilment could not be updated.");
  }
  await recordOwnerEvent({
    orderId: order.id,
    eventType: "fulfillment_updated",
    detail: {
      from: order.fulfillment_status,
      to: input.fulfillmentStatus,
      carrier: input.carrier,
      tracking_number: input.trackingNumber,
    },
  });

  let shippingEmail: "not_needed" | "sent" | "failed" = "not_needed";
  if (firstShipment) {
    try {
      const managePath = await createPreorderManagePath({
        orderId: order.id,
        tokenVersion: order.manage_token_version,
      });
      await sendPreorderShippingEmail({
        origin: input.origin,
        preorderId: order.id,
        orderNumber: order.order_number,
        environment: order.environment,
        email: order.email,
        fullName: order.full_name,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl,
        managePath,
      });
      shippingEmail = "sent";
    } catch (error) {
      shippingEmail = "failed";
      console.error("Pre-order shipping email failed", error);
      await recordOwnerEvent({
        orderId: order.id,
        eventType: "shipping_email_failed",
        detail: {
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        },
      });
    }
  }
  return { order: updated.data, shippingEmail };
}

export async function resolvePreorderAddressChange(input: {
  origin: string;
  orderId: string;
  approved: boolean;
  resolutionNote: string | null;
}) {
  const order = await getOperationalOrder(input.orderId);
  if (!["requested", "processing"].includes(order.address_change_status)) {
    throw new Error("This order does not have an active shipping-address request.");
  }
  if (!order.requested_shipping_address) {
    throw new Error("The requested shipping address is missing.");
  }

  const now = new Date().toISOString();
  const supabase = await getSupabaseAdmin();
  const update: Record<string, unknown> = {
    address_change_status: input.approved ? "completed" : "declined",
    address_change_resolved_at: now,
    address_change_resolution_note: input.resolutionNote,
    updated_at: now,
  };
  if (input.approved) update.shipping_address = order.requested_shipping_address;

  const updated = await supabase
    .from("preorders")
    .update(update)
    .eq("id", order.id)
    .in("address_change_status", ["requested", "processing"])
    .select(operationalOrderColumns)
    .maybeSingle<OperationalOrder>();
  if (updated.error) throw updated.error;
  if (!updated.data) {
    throw new Error("The shipping-address request changed before it was resolved.");
  }

  await recordOwnerEvent({
    orderId: order.id,
    eventType: input.approved ? "address_change_approved" : "address_change_declined",
    detail: {
      resolution_note: input.resolutionNote,
      requested_shipping_address: order.requested_shipping_address,
    },
  });

  let customerEmail: "sent" | "failed" = "sent";
  try {
    const managePath = await createPreorderManagePath({
      orderId: order.id,
      tokenVersion: order.manage_token_version,
    });
    await sendPreorderAddressChangeResolutionEmail({
      origin: input.origin,
      preorderId: order.id,
      orderNumber: order.order_number,
      environment: order.environment,
      email: order.email,
      fullName: order.full_name,
      approved: input.approved,
      resolutionNote: input.resolutionNote,
      shippingAddress: updated.data.shipping_address,
      managePath,
      resolutionVersion: now,
    });
  } catch (error) {
    customerEmail = "failed";
    console.error("Pre-order address resolution email failed", error);
    await recordOwnerEvent({
      orderId: order.id,
      eventType: "address_resolution_email_failed",
      detail: {
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      },
    });
  }
  return { order: updated.data, customerEmail };
}

export async function sendPreorderDeliveryUpdate(input: {
  origin: string;
  orderId: string;
  currentEstimate: string;
  message: string;
}) {
  const order = await getOperationalOrder(input.orderId);
  if (
    order.order_status !== "placed" ||
    !["paid", "partially_refunded"].includes(order.payment_status) ||
    !["on_hold", "ready", "processing"].includes(order.fulfillment_status)
  ) {
    throw new Error("Delivery updates can only be sent for active, unshipped orders.");
  }
  if (["requested", "processing"].includes(order.cancellation_status)) {
    throw new Error("Resolve the cancellation request before sending a delivery update.");
  }

  const now = new Date().toISOString();
  const nextVersion = order.delivery_update_version + 1;
  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorders")
    .update({
      current_estimated_delivery: input.currentEstimate,
      delivery_update_version: nextVersion,
      delivery_update_status: "pending",
      delivery_update_message: input.message,
      delivery_update_sent_at: now,
      delivery_update_acknowledged_at: null,
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("delivery_update_version", order.delivery_update_version)
    .select(operationalOrderColumns)
    .maybeSingle<OperationalOrder>();
  if (updated.error) throw updated.error;
  if (!updated.data) throw new Error("The delivery estimate changed before it was sent.");

  await recordOwnerEvent({
    orderId: order.id,
    eventType: "delivery_update_sent",
    detail: {
      previous_estimate: order.current_estimated_delivery,
      current_estimate: input.currentEstimate,
      message: input.message,
      delivery_update_version: nextVersion,
    },
  });

  let customerEmail: "sent" | "failed" = "sent";
  try {
    const managePath = await createPreorderManagePath({
      orderId: order.id,
      tokenVersion: order.manage_token_version,
    });
    await sendPreorderDeliveryUpdateEmail({
      origin: input.origin,
      preorderId: order.id,
      orderNumber: order.order_number,
      environment: order.environment,
      email: order.email,
      fullName: order.full_name,
      previousEstimate: order.current_estimated_delivery,
      currentEstimate: input.currentEstimate,
      message: input.message,
      managePath,
      deliveryUpdateVersion: nextVersion,
    });
  } catch (error) {
    customerEmail = "failed";
    console.error("Pre-order delivery update email failed", error);
    await recordOwnerEvent({
      orderId: order.id,
      eventType: "delivery_update_email_failed",
      detail: {
        delivery_update_version: nextVersion,
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      },
    });
  }
  return { order: updated.data, customerEmail };
}

export async function retryPreorderConfirmationEmail(input: {
  origin: string;
  orderId: string;
}) {
  const order = await getOperationalOrder(input.orderId);
  const supabase = await getSupabaseAdmin();
  const item = await supabase
    .from("preorder_order_items")
    .select("quantity")
    .eq("preorder_id", order.id)
    .maybeSingle();
  if (item.error) throw item.error;
  const managePath = await createPreorderManagePath({
    orderId: order.id,
    tokenVersion: order.manage_token_version,
  });
  const sentAt = await sendPreorderConfirmationEmail({
    origin: input.origin,
    preorderId: order.id,
    orderNumber: order.order_number,
    environment: order.environment,
    email: order.email,
    fullName: order.full_name,
    amountSubtotal: order.amount_subtotal,
    amountShipping: order.amount_shipping,
    amountTax: order.amount_tax,
    amountTotal: order.amount_total,
    currency: order.currency,
    quantity: item.data?.quantity ?? 1,
    placedAt: order.placed_at,
    estimatedShipping: order.estimated_delivery,
    shippingAddress: order.shipping_address,
    managePath,
    deliveryKey: `preorder-confirmation-manual-${order.id}-${crypto.randomUUID()}`,
  });
  const updated = await supabase
    .from("preorders")
    .update({ confirmation_email_sent_at: sentAt, updated_at: sentAt })
    .eq("id", order.id);
  if (updated.error) throw updated.error;
  await recordOwnerEvent({
    orderId: order.id,
    eventType: "confirmation_email_resent",
  });
}

export async function initiatePreorderFullRefund(input: {
  origin: string;
  orderId: string;
  requestKey: string;
}) {
  const order = await getOperationalOrder(input.orderId);
  if (!["paid", "partially_refunded", "refund_failed"].includes(order.payment_status)) {
    throw new Error("This order is not eligible for another refund.");
  }

  const secretKey = await getRuntimeValue("STRIPE_SECRET_KEY");
  if (
    (order.environment === "test" && !secretKey?.startsWith("sk_test_")) ||
    (order.environment === "live" && !secretKey?.startsWith("sk_live_"))
  ) {
    throw new Error(`Stripe ${order.environment} mode is not configured for this refund.`);
  }

  const supabase = await getSupabaseAdmin();
  const payment = await supabase
    .from("preorder_payments")
    .select("id,stripe_payment_intent_id,amount_total,amount_refunded,payment_status")
    .eq("preorder_id", order.id)
    .maybeSingle();
  if (payment.error) throw payment.error;
  if (!payment.data?.stripe_payment_intent_id) {
    throw new Error("The Stripe payment reference is missing.");
  }
  const remaining = payment.data.amount_total - payment.data.amount_refunded;
  if (remaining <= 0) throw new Error("This payment has already been fully refunded.");

  const originalPaymentStatus = payment.data.payment_status;
  const locked = await supabase
    .from("preorder_payments")
    .update({ payment_status: "refund_pending", updated_at: new Date().toISOString() })
    .eq("id", payment.data.id)
    .eq("payment_status", originalPaymentStatus)
    .select("id")
    .maybeSingle();
  if (locked.error) throw locked.error;
  if (!locked.data) throw new Error("A refund is already being processed for this order.");

  const cancellationStatus = ["requested", "processing"].includes(
    order.cancellation_status,
  )
    ? "processing"
    : order.cancellation_status;
  const orderLocked = await supabase
    .from("preorders")
    .update({
      payment_status: "refund_pending",
      cancellation_status: cancellationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (orderLocked.error) {
    await supabase
      .from("preorder_payments")
      .update({
        payment_status: originalPaymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.data.id)
      .eq("payment_status", "refund_pending");
    throw orderLocked.error;
  }

  let refund: Stripe.Refund;
  try {
    const stripe = await getStripe(order.environment);
    refund = await stripe.refunds.create(
      {
        payment_intent: payment.data.stripe_payment_intent_id,
        amount: remaining,
        reason: "requested_by_customer",
        metadata: {
          flow: "frame_preorder",
          preorder_id: order.id,
          order_number: String(order.order_number),
          environment: order.environment,
        },
      },
      { idempotencyKey: `frame-preorder-refund-${order.id}-${input.requestKey}` },
    );
  } catch (error) {
    await supabase
      .from("preorder_payments")
      .update({ payment_status: originalPaymentStatus, updated_at: new Date().toISOString() })
      .eq("id", payment.data.id)
      .eq("payment_status", "refund_pending");
    await supabase
      .from("preorders")
      .update({
        payment_status: order.payment_status,
        cancellation_status: order.cancellation_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("payment_status", "refund_pending");
    try {
      await recordOwnerEvent({
        orderId: order.id,
        eventType: "refund_initiation_failed",
        detail: {
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
        },
      });
    } catch (eventError) {
      console.error("Pre-order refund failure event could not be recorded", eventError);
    }
    throw error;
  }

  let customerEmail: "sent" | "failed" | "not_needed" = "not_needed";
  try {
    await recordOwnerEvent({
      orderId: order.id,
      eventType: "refund_initiated",
      detail: { refund_id: refund.id, amount: remaining, status: refund.status },
    });
    if (refund.status === "succeeded") {
      await reconcilePreorderRefund({
        paymentIntentId: payment.data.stripe_payment_intent_id,
        amountRefunded: payment.data.amount_refunded + refund.amount,
        fullyRefunded:
          payment.data.amount_refunded + refund.amount >= payment.data.amount_total,
        origin: input.origin,
      });
    } else if (refund.status === "failed" || refund.status === "canceled") {
      await reconcilePreorderRefund({
        paymentIntentId: payment.data.stripe_payment_intent_id,
        amountRefunded: payment.data.amount_refunded,
        fullyRefunded: false,
        failed: true,
        origin: input.origin,
      });
    } else {
      try {
        const managePath = await createPreorderManagePath({
          orderId: order.id,
          tokenVersion: order.manage_token_version,
        });
        await sendPreorderRefundUpdateEmail({
          origin: input.origin,
          preorderId: order.id,
          orderNumber: order.order_number,
          environment: order.environment,
          email: order.email,
          fullName: order.full_name,
          amountRefunded: remaining,
          currency: order.currency,
          status: "processing",
          managePath,
        });
        customerEmail = "sent";
      } catch (error) {
        customerEmail = "failed";
        console.error("Pre-order refund processing email failed", error);
        await recordOwnerEvent({
          orderId: order.id,
          eventType: "refund_processing_email_failed",
          detail: {
            error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
          },
        });
      }
    }
  } catch (postRefundError) {
    console.error("Pre-order refund follow-up failed", postRefundError);
  }
  return { refund, customerEmail };
}
