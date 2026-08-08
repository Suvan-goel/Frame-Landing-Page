import {
  formatPreorderMoney,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_SHIPPING_RATE_CENTS,
} from "./preorder";

export const PREORDER_MANAGE_PREVIEW_STATES = [
  "active",
  "processing",
  "short-delay",
  "delay",
  "material",
  "address-pending",
  "cancellation-pending",
  "refund-pending",
  "refund-failed",
  "cancelled",
  "shipped",
  "delivered",
] as const;

export type PreorderManagePreviewState =
  (typeof PREORDER_MANAGE_PREVIEW_STATES)[number];

const TOTAL_CENTS = PREORDER_DEFAULT_PRICE_CENTS + PREORDER_SHIPPING_RATE_CENTS;

function previewState(value: unknown): PreorderManagePreviewState {
  return PREORDER_MANAGE_PREVIEW_STATES.includes(value as PreorderManagePreviewState)
    ? (value as PreorderManagePreviewState)
    : "active";
}

export function preorderManagePreviewOrder(value: unknown) {
  const state = previewState(value);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString();
  const base = {
    orderNumber: "FR-TEST-0001",
    fullName: "Test customer",
    email: "test@example.com",
    shippingAddress: {
      line1: "1450 Market Street",
      city: "San Francisco",
      state: "CA",
      postal_code: "94102",
      country: "US",
    },
    orderStatus: "placed",
    paymentStatus: "paid",
    fulfillmentStatus: "on_hold",
    cancellationStatus: "none",
    cancellationRequestedAt: null as string | null,
    cancellationResolutionNote: null as string | null,
    canRequestCancellation: true,
    amountPaid: formatPreorderMoney(TOTAL_CENTS, PREORDER_DEFAULT_CURRENCY),
    amountRefunded: formatPreorderMoney(0, PREORDER_DEFAULT_CURRENCY),
    amountRemaining: formatPreorderMoney(TOTAL_CENTS, PREORDER_DEFAULT_CURRENCY),
    refundStatus: "none",
    originalEstimatedShipping: PREORDER_ESTIMATED_SHIPPING,
    estimatedShipping: PREORDER_ESTIMATED_SHIPPING,
    addressChangeStatus: "none",
    addressChangeRequestedAt: null as string | null,
    requestedShippingAddress: null as Record<string, unknown> | null,
    addressChangeReason: null as string | null,
    addressChangeResolutionNote: null as string | null,
    canRequestAddressChange: true,
    deliveryUpdateVersion: 0,
    deliveryUpdateStatus: "none",
    deliveryUpdateNoticeType: "none",
    deliveryUpdateResponseMode: "none",
    deliveryUpdateResponseDeadline: null as string | null,
    deliveryUpdateMessage: null as string | null,
    deliveryUpdateSentAt: null as string | null,
    deliveryUpdateAcknowledgedAt: null as string | null,
    deliveryUpdateExpiredAt: null as string | null,
    requiresDeliveryResponse: false,
    requiresAffirmativeDeliveryConsent: false,
    carrier: null as string | null,
    trackingNumber: null as string | null,
    trackingUrl: null as string | null,
    shippedAt: null as string | null,
    deliveredAt: null as string | null,
    placedAt: "2026-08-08T12:00:00.000Z",
  };

  if (state === "processing") {
    return {
      ...base,
      fulfillmentStatus: "processing",
      canRequestCancellation: false,
    };
  }
  if (state === "short-delay" || state === "delay" || state === "material") {
    const affirmative = state !== "short-delay";
    return {
      ...base,
      estimatedShipping: state === "material" ? base.estimatedShipping : "April 2027",
      deliveryUpdateVersion: 1,
      deliveryUpdateStatus: "pending",
      deliveryUpdateNoticeType:
        state === "material"
          ? "material_product_change"
          : state === "short-delay"
            ? "first_short_delay"
            : "consent_required_delay",
      deliveryUpdateResponseMode: affirmative
        ? "affirmative_consent_required"
        : "silence_is_consent",
      deliveryUpdateResponseDeadline: affirmative ? tomorrow : null,
      deliveryUpdateMessage:
        state === "material"
          ? "We are proposing a revised enclosure material. Core functionality and the price stay the same."
          : "Component qualification is taking longer than planned, so the current estimate has moved to April 2027.",
      deliveryUpdateSentAt: now.toISOString(),
      requiresDeliveryResponse: true,
      requiresAffirmativeDeliveryConsent: affirmative,
      canRequestAddressChange: true,
    };
  }
  if (state === "address-pending") {
    return {
      ...base,
      addressChangeStatus: "requested",
      addressChangeRequestedAt: now.toISOString(),
      requestedShippingAddress: {
        line1: "88 King Street",
        city: "New York",
        state: "NY",
        postal_code: "10014",
        country: "US",
      },
      canRequestAddressChange: false,
    };
  }
  if (state === "cancellation-pending") {
    return {
      ...base,
      cancellationStatus: "processing",
      cancellationRequestedAt: now.toISOString(),
      canRequestCancellation: false,
      canRequestAddressChange: false,
    };
  }
  if (["refund-pending", "refund-failed", "cancelled"].includes(state)) {
    const completed = state === "cancelled";
    return {
      ...base,
      orderStatus: "cancelled",
      paymentStatus: completed
        ? "refunded"
        : state === "refund-failed"
          ? "refund_failed"
          : "refund_pending",
      fulfillmentStatus: "on_hold",
      cancellationStatus: "completed",
      cancellationRequestedAt: now.toISOString(),
      canRequestCancellation: false,
      canRequestAddressChange: false,
      amountRefunded: formatPreorderMoney(
        completed ? TOTAL_CENTS : 0,
        PREORDER_DEFAULT_CURRENCY,
      ),
      amountRemaining: formatPreorderMoney(
        completed ? 0 : TOTAL_CENTS,
        PREORDER_DEFAULT_CURRENCY,
      ),
      refundStatus: completed
        ? "completed"
        : state === "refund-failed"
          ? "failed"
          : "processing",
    };
  }
  if (state === "shipped" || state === "delivered") {
    return {
      ...base,
      fulfillmentStatus: state,
      canRequestCancellation: false,
      canRequestAddressChange: false,
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      trackingUrl: "https://www.ups.com/track",
      shippedAt: "2027-02-08T12:00:00.000Z",
      deliveredAt: state === "delivered" ? "2027-02-12T16:30:00.000Z" : null,
    };
  }

  return base;
}

export function preorderManagePreviewMutation(input: {
  action: unknown;
  state: unknown;
  email?: unknown;
  shippingAddress?: unknown;
  response?: unknown;
}) {
  const current = preorderManagePreviewOrder(input.state);
  if (input.action === "request_email_change") {
    return { status: "email_verification_sent", order: current };
  }
  if (input.action === "request_address_change") {
    return {
      status: "address_change_requested",
      order: {
        ...current,
        addressChangeStatus: "requested",
        addressChangeRequestedAt: new Date().toISOString(),
        requestedShippingAddress:
          input.shippingAddress && typeof input.shippingAddress === "object"
            ? input.shippingAddress as Record<string, unknown>
            : current.shippingAddress,
        canRequestAddressChange: false,
      },
    };
  }
  if (
    input.action === "request_cancellation" ||
    (input.action === "respond_delivery_update" &&
      input.response === "request_cancellation")
  ) {
    return {
      status: "requested",
      order: preorderManagePreviewOrder("cancellation-pending"),
    };
  }
  if (input.action === "respond_delivery_update" && input.response === "accept") {
    return {
      status: "accepted",
      order: {
        ...current,
        deliveryUpdateStatus: "accepted",
        deliveryUpdateAcknowledgedAt: new Date().toISOString(),
        requiresDeliveryResponse: false,
        requiresAffirmativeDeliveryConsent: false,
      },
    };
  }
  return null;
}
