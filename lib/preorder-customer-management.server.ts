import {
  sendPreorderEmailChangeNotice,
  sendPreorderEmailChangeVerificationEmail,
  sendPreorderOwnerActionEmail,
} from "./preorder-email.server";
import { formatPreorderMoney, formatPreorderNumber } from "./preorder";
import { preorderDeliveryResponseExpired } from "./preorder-delivery-policy";
import {
  createPreorderEmailChangeToken,
  createPreorderManagePath,
  verifyPreorderEmailChangeToken,
  verifyPreorderManageToken,
} from "./preorder-order-access.server";
import type { PreorderEnvironment } from "./preorder-operations.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

export type CustomerManagedPreorder = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  manage_token_version: number;
  full_name: string;
  email: string;
  shipping_address: Record<string, unknown>;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  cancellation_status: string;
  cancellation_requested_at: string | null;
  cancellation_resolution_note: string | null;
  amount_total: number;
  amount_refunded: number;
  offer_type: "full_preorder" | "reservation";
  reservation_amount: number | null;
  locked_total_price: number | null;
  remaining_balance: number | null;
  reservation_status: string | null;
  currency: string;
  estimated_delivery: string;
  current_estimated_delivery: string;
  address_change_status: string;
  address_change_requested_at: string | null;
  requested_shipping_address: Record<string, unknown> | null;
  address_change_reason: string | null;
  address_change_resolution_note: string | null;
  delivery_update_version: number;
  delivery_update_status: string;
  delivery_update_notice_type: string;
  delivery_update_response_mode: string;
  delivery_update_response_deadline: string | null;
  delivery_update_message: string | null;
  delivery_update_sent_at: string | null;
  delivery_update_acknowledged_at: string | null;
  delivery_update_expired_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  placed_at: string;
};

const managedOrderColumns =
  "id,order_number,environment,manage_token_version,full_name,email,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,cancellation_requested_at,cancellation_resolution_note,amount_total,amount_refunded,currency,offer_type,reservation_amount,locked_total_price,remaining_balance,reservation_status,estimated_delivery,current_estimated_delivery,address_change_status,address_change_requested_at,requested_shipping_address,address_change_reason,address_change_resolution_note,delivery_update_version,delivery_update_status,delivery_update_notice_type,delivery_update_response_mode,delivery_update_response_deadline,delivery_update_message,delivery_update_sent_at,delivery_update_acknowledged_at,delivery_update_expired_at,carrier,tracking_number,tracking_url,shipped_at,delivered_at,placed_at";

function customerRefundStatus(order: CustomerManagedPreorder) {
  if (order.payment_status === "refund_pending") return "processing";
  if (order.payment_status === "refund_failed") return "failed";
  if (order.payment_status === "refunded") return "completed";
  if (order.payment_status === "partially_refunded" || order.amount_refunded > 0) {
    return "partial";
  }
  return "none";
}

function activeUnshippedOrder(order: CustomerManagedPreorder) {
  return (
    order.order_status === "placed" &&
    ["paid", "partially_refunded"].includes(order.payment_status) &&
    ["on_hold", "ready", "processing"].includes(order.fulfillment_status)
  );
}

export function canRequestPreorderCancellation(order: CustomerManagedPreorder) {
  return (
    activeUnshippedOrder(order) &&
    ["on_hold", "ready"].includes(order.fulfillment_status) &&
    order.cancellation_status === "none"
  );
}

export function canRequestPreorderAddressChange(order: CustomerManagedPreorder) {
  return (
    activeUnshippedOrder(order) &&
    order.cancellation_status === "none" &&
    !["requested", "processing"].includes(order.address_change_status)
  );
}

export async function getCustomerManagedPreorder(token: string) {
  const payload = await verifyPreorderManageToken(token);
  if (!payload) return null;

  const supabase = await getSupabaseAdmin();
  const result = await supabase
    .from("preorders")
    .select(managedOrderColumns)
    .eq("id", payload.orderId)
    .eq("manage_token_version", payload.tokenVersion)
    .maybeSingle<CustomerManagedPreorder>();
  if (result.error) throw result.error;
  return result.data ?? null;
}

export function customerPreorderResponse(order: CustomerManagedPreorder) {
  return {
    orderNumber: formatPreorderNumber(order.order_number),
    fullName: order.full_name,
    email: order.email,
    shippingAddress: order.shipping_address,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    cancellationStatus: order.cancellation_status,
    cancellationRequestedAt: order.cancellation_requested_at,
    cancellationResolutionNote: order.cancellation_resolution_note,
    canRequestCancellation: canRequestPreorderCancellation(order),
    amountPaid: formatPreorderMoney(order.amount_total, order.currency),
    amountRefunded: formatPreorderMoney(order.amount_refunded, order.currency),
    amountRemaining: formatPreorderMoney(
      Math.max(order.amount_total - order.amount_refunded, 0),
      order.currency,
    ),
    offerType: order.offer_type,
    reservationAmount: order.reservation_amount == null
      ? null
      : formatPreorderMoney(order.reservation_amount, order.currency),
    lockedTotalPrice: order.locked_total_price == null
      ? null
      : formatPreorderMoney(order.locked_total_price, order.currency),
    remainingBalance: order.remaining_balance == null
      ? null
      : formatPreorderMoney(order.remaining_balance, order.currency),
    reservationStatus: order.reservation_status,
    refundStatus: customerRefundStatus(order),
    originalEstimatedShipping: order.estimated_delivery,
    estimatedShipping: order.current_estimated_delivery,
    addressChangeStatus: order.address_change_status,
    addressChangeRequestedAt: order.address_change_requested_at,
    requestedShippingAddress: order.requested_shipping_address,
    addressChangeReason: order.address_change_reason,
    addressChangeResolutionNote: order.address_change_resolution_note,
    canRequestAddressChange: canRequestPreorderAddressChange(order),
    deliveryUpdateVersion: order.delivery_update_version,
    deliveryUpdateStatus: order.delivery_update_status,
    deliveryUpdateNoticeType: order.delivery_update_notice_type,
    deliveryUpdateResponseMode: order.delivery_update_response_mode,
    deliveryUpdateResponseDeadline: order.delivery_update_response_deadline,
    deliveryUpdateMessage: order.delivery_update_message,
    deliveryUpdateSentAt: order.delivery_update_sent_at,
    deliveryUpdateAcknowledgedAt: order.delivery_update_acknowledged_at,
    deliveryUpdateExpiredAt: order.delivery_update_expired_at,
    requiresDeliveryResponse: order.delivery_update_status === "pending",
    requiresAffirmativeDeliveryConsent:
      order.delivery_update_status === "pending" &&
      order.delivery_update_response_mode !== "silence_is_consent",
    carrier: order.carrier,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    placedAt: order.placed_at,
  };
}

async function recordCustomerEvent(input: {
  orderId: string;
  eventKey: string;
  eventType: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = await getSupabaseAdmin();
  const event = await supabase.from("preorder_events").upsert(
    {
      preorder_id: input.orderId,
      event_key: input.eventKey,
      event_type: input.eventType,
      source: "customer",
      detail: input.detail ?? {},
    },
    { onConflict: "event_key", ignoreDuplicates: true },
  );
  if (event.error) throw event.error;
}

async function notifyOwner(input: {
  origin: string;
  order: CustomerManagedPreorder;
  requestType: "cancellation" | "address_change";
  reason: string | null;
  requestedAddress?: Record<string, unknown> | null;
  deliveryKey: string;
}) {
  try {
    await sendPreorderOwnerActionEmail({
      origin: input.origin,
      preorderId: input.order.id,
      orderNumber: input.order.order_number,
      environment: input.order.environment,
      fullName: input.order.full_name,
      customerEmail: input.order.email,
      requestType: input.requestType,
      reason: input.reason,
      requestedAddress: input.requestedAddress,
      deliveryKey: input.deliveryKey,
    });
    return "sent" as const;
  } catch (error) {
    console.error("Pre-order owner notification failed", error);
    await recordCustomerEvent({
      orderId: input.order.id,
      eventKey: `${input.deliveryKey}-failed`,
      eventType: "owner_notification_failed",
      detail: {
        request_type: input.requestType,
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      },
    });
    return "failed" as const;
  }
}

export async function requestPreorderCancellation(input: {
  origin: string;
  token: string;
  reason: string | null;
}) {
  const order = await getCustomerManagedPreorder(input.token);
  if (!order) return { status: "invalid" as const };
  if (!canRequestPreorderCancellation(order)) {
    return { status: "unavailable" as const, order };
  }

  const now = new Date().toISOString();
  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorders")
    .update({
      cancellation_status: "requested",
      cancellation_requested_at: now,
      cancellation_reason: input.reason,
      cancellation_resolved_at: null,
      cancellation_resolution_note: null,
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("manage_token_version", order.manage_token_version)
    .eq("order_status", "placed")
    .eq("cancellation_status", "none")
    .in("payment_status", ["paid", "partially_refunded"])
    .in("fulfillment_status", ["on_hold", "ready"])
    .select(managedOrderColumns)
    .maybeSingle<CustomerManagedPreorder>();
  if (updated.error) throw updated.error;
  if (!updated.data) return { status: "unavailable" as const, order };

  const eventKey = `preorder-cancellation-requested-${order.id}-${order.manage_token_version}`;
  await recordCustomerEvent({
    orderId: order.id,
    eventKey,
    eventType: "cancellation_requested",
    detail: input.reason ? { reason: input.reason } : {},
  });
  const ownerNotification = await notifyOwner({
    origin: input.origin,
    order: updated.data,
    requestType: "cancellation",
    reason: input.reason,
    deliveryKey: `${eventKey}-owner-email`,
  });
  return { status: "requested" as const, order: updated.data, ownerNotification };
}

export async function requestPreorderContactEmailChange(input: {
  origin: string;
  token: string;
  email: string;
}) {
  const order = await getCustomerManagedPreorder(input.token);
  if (!order) return { status: "invalid" as const };
  if (order.email === input.email) {
    return { status: "unchanged" as const, order };
  }

  const verificationToken = await createPreorderEmailChangeToken({
    orderId: order.id,
    tokenVersion: order.manage_token_version,
    currentEmail: order.email,
    newEmail: input.email,
  });
  const deliveryKey = `preorder-email-change-verification-${order.id}-${order.manage_token_version}-${crypto.randomUUID()}`;
  await sendPreorderEmailChangeVerificationEmail({
    origin: input.origin,
    preorderId: order.id,
    orderNumber: order.order_number,
    environment: order.environment,
    fullName: order.full_name,
    newEmail: input.email,
    verificationToken,
    deliveryKey,
  });
  await recordCustomerEvent({
    orderId: order.id,
    eventKey: `${deliveryKey}-requested`,
    eventType: "contact_email_change_requested",
    detail: { new_email: input.email },
  });

  return { status: "verification_sent" as const, order };
}

export async function confirmPreorderContactEmailChange(token: string) {
  const payload = await verifyPreorderEmailChangeToken(token);
  if (!payload) return { status: "invalid" as const };

  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const nextTokenVersion = payload.tokenVersion + 1;
  const updated = await supabase
    .from("preorders")
    .update({
      email: payload.newEmail,
      normalized_email: payload.newEmail,
      manage_token_version: nextTokenVersion,
      updated_at: now,
    })
    .eq("id", payload.orderId)
    .eq("manage_token_version", payload.tokenVersion)
    .eq("email", payload.currentEmail)
    .select(managedOrderColumns)
    .maybeSingle<CustomerManagedPreorder>();
  if (updated.error) throw updated.error;
  if (!updated.data) return { status: "invalid" as const };

  await recordCustomerEvent({
    orderId: payload.orderId,
    eventKey: `preorder-contact-email-updated-${payload.orderId}-${nextTokenVersion}`,
    eventType: "contact_email_updated",
    detail: {
      previous_email: payload.currentEmail,
      new_email: payload.newEmail,
    },
  });

  const managePath = await createPreorderManagePath({
    orderId: updated.data.id,
    tokenVersion: updated.data.manage_token_version,
  });
  const noticeInput = {
    origin: "",
    preorderId: updated.data.id,
    orderNumber: updated.data.order_number,
    environment: updated.data.environment,
    fullName: updated.data.full_name,
    previousEmail: payload.currentEmail,
    newEmail: payload.newEmail,
    managePath,
  };

  return {
    status: "updated" as const,
    order: updated.data,
    managePath,
    noticeInput,
  };
}

export async function sendConfirmedPreorderEmailChangeNotices(input: {
  origin: string;
  result: Extract<
    Awaited<ReturnType<typeof confirmPreorderContactEmailChange>>,
    { status: "updated" }
  >;
}) {
  const common = { ...input.result.noticeInput, origin: input.origin };
  const outcomes = await Promise.allSettled([
    sendPreorderEmailChangeNotice({
      ...common,
      recipient: common.previousEmail,
      audience: "previous",
      managePath: null,
      deliveryKey: `preorder-email-change-previous-${common.preorderId}-${input.result.order.manage_token_version}`,
    }),
    sendPreorderEmailChangeNotice({
      ...common,
      recipient: common.newEmail,
      audience: "new",
      deliveryKey: `preorder-email-change-new-${common.preorderId}-${input.result.order.manage_token_version}`,
    }),
  ]);
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error("Pre-order email-change notice failed", outcome.reason);
    }
  }
}

export async function requestPreorderAddressChange(input: {
  origin: string;
  token: string;
  reason: string | null;
  shippingAddress: Record<string, string>;
}) {
  const order = await getCustomerManagedPreorder(input.token);
  if (!order) return { status: "invalid" as const };
  if (!canRequestPreorderAddressChange(order)) {
    return { status: "unavailable" as const, order };
  }

  const now = new Date().toISOString();
  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorders")
    .update({
      address_change_status: "requested",
      address_change_requested_at: now,
      requested_shipping_address: input.shippingAddress,
      address_change_reason: input.reason,
      address_change_resolved_at: null,
      address_change_resolution_note: null,
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("manage_token_version", order.manage_token_version)
    .eq("order_status", "placed")
    .eq("cancellation_status", "none")
    .in("payment_status", ["paid", "partially_refunded"])
    .in("fulfillment_status", ["on_hold", "ready", "processing"])
    .in("address_change_status", ["none", "completed", "declined"])
    .select(managedOrderColumns)
    .maybeSingle<CustomerManagedPreorder>();
  if (updated.error) throw updated.error;
  if (!updated.data) return { status: "unavailable" as const, order };

  const eventKey = `preorder-address-change-requested-${order.id}-${Date.now()}`;
  await recordCustomerEvent({
    orderId: order.id,
    eventKey,
    eventType: "address_change_requested",
    detail: { reason: input.reason, requested_shipping_address: input.shippingAddress },
  });
  const ownerNotification = await notifyOwner({
    origin: input.origin,
    order: updated.data,
    requestType: "address_change",
    reason: input.reason,
    requestedAddress: input.shippingAddress,
    deliveryKey: `${eventKey}-owner-email`,
  });
  return { status: "requested" as const, order: updated.data, ownerNotification };
}

export async function respondToPreorderDeliveryUpdate(input: {
  origin: string;
  token: string;
  deliveryUpdateVersion: number;
  response: "accept" | "request_cancellation";
  reason: string | null;
}) {
  const order = await getCustomerManagedPreorder(input.token);
  if (!order) return { status: "invalid" as const };
  if (
    order.delivery_update_status !== "pending" ||
    order.delivery_update_version !== input.deliveryUpdateVersion ||
    !activeUnshippedOrder(order)
  ) {
    return { status: "unavailable" as const, order };
  }
  if (
    preorderDeliveryResponseExpired({
      responseMode: order.delivery_update_response_mode,
      responseDeadline: order.delivery_update_response_deadline,
    })
  ) {
    return { status: "deadline_expired" as const, order };
  }

  const now = new Date().toISOString();
  const cancellationRequested = input.response === "request_cancellation";
  if (cancellationRequested && order.cancellation_status !== "none") {
    return { status: "unavailable" as const, order };
  }
  const supabase = await getSupabaseAdmin();
  const update: Record<string, unknown> = {
    delivery_update_status: cancellationRequested ? "cancellation_requested" : "accepted",
    delivery_update_acknowledged_at: now,
    updated_at: now,
  };
  if (cancellationRequested) {
    update.cancellation_status = "requested";
    update.cancellation_requested_at = now;
    update.cancellation_reason =
      input.reason ??
      (order.delivery_update_notice_type === "material_product_change"
        ? "Cancellation requested after a material product change notice."
        : "Cancellation requested after a shipping estimate update.");
    update.cancellation_resolved_at = null;
    update.cancellation_resolution_note = null;
  }
  let query = supabase
    .from("preorders")
    .update(update)
    .eq("id", order.id)
    .eq("manage_token_version", order.manage_token_version)
    .eq("delivery_update_version", input.deliveryUpdateVersion)
    .eq("delivery_update_status", "pending");
  if (cancellationRequested) query = query.eq("cancellation_status", "none");
  const updated = await query
    .select(managedOrderColumns)
    .maybeSingle<CustomerManagedPreorder>();
  if (updated.error) throw updated.error;
  if (!updated.data) return { status: "unavailable" as const, order };

  const eventType = cancellationRequested
    ? "order_change_cancellation_requested"
    : "order_change_accepted";
  const eventKey = `preorder-${eventType}-${order.id}-${input.deliveryUpdateVersion}`;
  await recordCustomerEvent({
    orderId: order.id,
    eventKey,
    eventType,
    detail: { delivery_update_version: input.deliveryUpdateVersion, reason: input.reason },
  });
  const ownerNotification = cancellationRequested
    ? await notifyOwner({
        origin: input.origin,
        order: updated.data,
        requestType: "cancellation",
        reason:
          input.reason ??
          (order.delivery_update_notice_type === "material_product_change"
            ? "Requested after a material product change notice."
            : "Requested after a shipping estimate update."),
        deliveryKey: `${eventKey}-owner-email`,
      })
    : "not_needed";
  return {
    status: cancellationRequested ? ("cancellation_requested" as const) : ("accepted" as const),
    order: updated.data,
    ownerNotification,
  };
}
