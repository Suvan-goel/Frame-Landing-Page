export type PreorderOperationsHealthEnvironment = "live" | "test";

export type PreorderOperationsHealthOrder = {
  id: string;
  orderNumber: number;
  environment: PreorderOperationsHealthEnvironment;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  cancellationStatus: string;
  cancellationRequestedAt: string | null;
  addressChangeStatus: string;
  addressChangeRequestedAt: string | null;
  deliveryUpdateStatus: string;
  deliveryUpdateResponseMode: string;
  deliveryUpdateResponseDeadline: string | null;
  confirmationEmailSentAt: string | null;
  recipientIsReservedTestAddress: boolean;
  amountTotal: number;
  amountRefunded: number;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type PreorderOperationsHealthEmail = {
  id: string;
  preorderId: string;
  streamKey: string;
  emailType: string;
  status: string;
  recipientIsReservedTestAddress: boolean;
  providerTrackingExpected: boolean;
  lastEvent: string | null;
  lastEventAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreorderOperationsHealthWebhook = {
  eventId: string;
  eventType: string;
  livemode: boolean;
  status: string;
  receivedAt: string;
  lastAttemptedAt: string | null;
};

export type PreorderOperationsHealthItem = {
  id: string;
  preorderId: string;
  quantity: number;
};

export type PreorderOperationsHealthIntent = {
  id: string;
  environment: PreorderOperationsHealthEnvironment;
  status: string;
  quantity: number;
  expiresAt: string | null;
};

export type PreorderOperationsHealthSalesSnapshot = {
  environment: PreorderOperationsHealthEnvironment;
  salesStatus: string;
  inventoryLimit: number;
  unitLimit: number;
  paidUnits: number;
  reservedUnits: number;
  remainingUnits: number;
  inventoryRemainingUnits: number;
};

export type PreorderOperationsHealthIssue = {
  code: string;
  message: string;
  orderNumber?: number;
  reference?: string;
};

export type PreorderOperationsHealthInput = {
  environment: PreorderOperationsHealthEnvironment;
  now: string;
  orders: PreorderOperationsHealthOrder[];
  emails: PreorderOperationsHealthEmail[];
  webhooks: PreorderOperationsHealthWebhook[];
  items: PreorderOperationsHealthItem[];
  intents: PreorderOperationsHealthIntent[];
  sales: PreorderOperationsHealthSalesSnapshot;
};

export type PreorderOperationsHealthResult = {
  healthy: boolean;
  recommendation: "safe_to_accept_orders" | "pause_sales";
  issues: PreorderOperationsHealthIssue[];
  summary: {
    orders: number;
    activePaidOrders: number;
    unresolvedWebhooks: number;
    unresolvedEmailStreams: number;
    unresolvedCancellations: number;
    overdueDeliveryActions: number;
    paidUnits: number;
    reservedUnits: number;
    unitLimit: number;
    inventoryLimit: number;
  };
};

export const PREORDER_WEBHOOK_STALL_MILLISECONDS = 5 * 60 * 1_000;
export const PREORDER_EMAIL_STALL_MILLISECONDS = 10 * 60 * 1_000;

function parsedTime(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function addIssue(
  issues: PreorderOperationsHealthIssue[],
  issue: PreorderOperationsHealthIssue,
) {
  if (
    !issues.some(
      (existing) =>
        existing.code === issue.code &&
        existing.orderNumber === issue.orderNumber &&
        existing.reference === issue.reference,
    )
  ) {
    issues.push(issue);
  }
}

function isNonNegativeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function evaluatePreorderOperationsHealth(
  input: PreorderOperationsHealthInput,
): PreorderOperationsHealthResult {
  const issues: PreorderOperationsHealthIssue[] = [];
  const now = parsedTime(input.now);
  if (now === null) {
    throw new Error("The operations-health reference time is invalid.");
  }

  const orderById = new Map(input.orders.map((order) => [order.id, order]));
  const itemsByOrder = new Map<string, PreorderOperationsHealthItem[]>();
  const unresolvedWebhooks = new Set<string>();
  const unresolvedEmailStreams = new Set<string>();
  const unresolvedCancellations = new Set<string>();
  const overdueDeliveryActions = new Set<string>();

  for (const webhook of input.webhooks) {
    const reference = webhook.eventType;
    if (webhook.livemode !== (input.environment === "live")) {
      unresolvedWebhooks.add(webhook.eventId);
      addIssue(issues, {
        code: "webhook_environment_mismatch",
        message: "A Stripe webhook is assigned to the wrong live/test environment.",
        reference,
      });
    }
    if (webhook.status === "failed") {
      unresolvedWebhooks.add(webhook.eventId);
      addIssue(issues, {
        code: "webhook_failed",
        message: "A Stripe webhook failed and still needs recovery.",
        reference,
      });
    } else if (webhook.status === "processing") {
      const attemptedAt =
        parsedTime(webhook.lastAttemptedAt) ?? parsedTime(webhook.receivedAt);
      if (attemptedAt === null || attemptedAt <= now - PREORDER_WEBHOOK_STALL_MILLISECONDS) {
        unresolvedWebhooks.add(webhook.eventId);
        addIssue(issues, {
          code: "webhook_stalled",
          message: "A Stripe webhook has remained in processing for more than five minutes.",
          reference,
        });
      }
    } else if (webhook.status !== "processed") {
      unresolvedWebhooks.add(webhook.eventId);
      addIssue(issues, {
        code: "webhook_state_invalid",
        message: "A Stripe webhook has an unrecognised processing state.",
        reference,
      });
    }
  }

  const latestEmailByStream = new Map<string, PreorderOperationsHealthEmail>();
  for (const email of input.emails) {
    const existing = latestEmailByStream.get(email.streamKey);
    const emailCreatedAt = parsedTime(email.createdAt) ?? Number.NEGATIVE_INFINITY;
    const existingCreatedAt = existing
      ? parsedTime(existing.createdAt) ?? Number.NEGATIVE_INFINITY
      : Number.NEGATIVE_INFINITY;
    if (!existing || emailCreatedAt >= existingCreatedAt) {
      latestEmailByStream.set(email.streamKey, email);
    }
    if (!orderById.has(email.preorderId)) {
      addIssue(issues, {
        code: "orphan_email_delivery",
        message: "An email-delivery record has no corresponding pre-order.",
        reference: email.emailType,
      });
    }
  }

  for (const email of latestEmailByStream.values()) {
    const order = orderById.get(email.preorderId);
    const ignoredSandboxAddress =
      input.environment === "test" && email.recipientIsReservedTestAddress;
    if (ignoredSandboxAddress) continue;
    const context = order ? { orderNumber: order.orderNumber } : {};
    if (email.status === "failed") {
      unresolvedEmailStreams.add(email.streamKey);
      addIssue(issues, {
        code: "email_delivery_failed",
        message: `The latest ${email.emailType.replaceAll("_", " ")} delivery failed.`,
        ...context,
      });
    } else if (email.status === "delayed") {
      unresolvedEmailStreams.add(email.streamKey);
      addIssue(issues, {
        code: "email_delivery_delayed",
        message: `The latest ${email.emailType.replaceAll("_", " ")} delivery is delayed at the recipient mail server.`,
        ...context,
      });
    } else if (
      ["bounced", "complained", "suppressed"].includes(email.status)
    ) {
      unresolvedEmailStreams.add(email.streamKey);
      addIssue(issues, {
        code: `email_delivery_${email.status}`,
        message: `The latest ${email.emailType.replaceAll("_", " ")} delivery was ${email.status}.`,
        ...context,
      });
    } else if (email.status === "pending") {
      const updatedAt = parsedTime(email.updatedAt) ?? parsedTime(email.createdAt);
      if (updatedAt === null || updatedAt <= now - PREORDER_EMAIL_STALL_MILLISECONDS) {
        unresolvedEmailStreams.add(email.streamKey);
        addIssue(issues, {
          code: "email_delivery_stalled",
          message: `The latest ${email.emailType.replaceAll("_", " ")} delivery has been pending for more than ten minutes.`,
          ...context,
        });
      }
    } else if (email.status === "sent") {
      const sentAt = parsedTime(email.sentAt);
      if (sentAt === null) {
        unresolvedEmailStreams.add(email.streamKey);
        addIssue(issues, {
          code: "email_sent_state_invalid",
          message: "An email is marked sent without a valid sent timestamp.",
          ...context,
        });
      } else if (
        email.providerTrackingExpected &&
        sentAt <= now - PREORDER_EMAIL_STALL_MILLISECONDS
      ) {
        unresolvedEmailStreams.add(email.streamKey);
        addIssue(issues, {
          code: "email_delivery_unconfirmed",
          message: `Resend accepted the latest ${email.emailType.replaceAll("_", " ")} but has not confirmed delivery within ten minutes.`,
          ...context,
        });
      }
    } else if (email.status === "delivered") {
      if (
        parsedTime(email.deliveredAt) === null ||
        email.lastEvent !== "email.delivered" ||
        parsedTime(email.lastEventAt) === null
      ) {
        unresolvedEmailStreams.add(email.streamKey);
        addIssue(issues, {
          code: "email_delivered_state_invalid",
          message: "An email is marked delivered without a complete provider outcome record.",
          ...context,
        });
      }
    } else {
      unresolvedEmailStreams.add(email.streamKey);
      addIssue(issues, {
        code: "email_delivery_state_invalid",
        message: "An email delivery has an unrecognised state.",
        ...context,
      });
    }
  }

  for (const item of input.items) {
    const rows = itemsByOrder.get(item.preorderId) ?? [];
    rows.push(item);
    itemsByOrder.set(item.preorderId, rows);
    if (!orderById.has(item.preorderId)) {
      addIssue(issues, {
        code: "orphan_order_item",
        message: "An inventory item has no corresponding pre-order.",
      });
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      addIssue(issues, {
        code: "order_item_quantity_invalid",
        message: "An inventory item has an invalid unit quantity.",
      });
    }
  }

  for (const order of input.orders) {
    const context = { orderNumber: order.orderNumber };
    if (order.environment !== input.environment) {
      addIssue(issues, {
        code: "order_environment_mismatch",
        message: "An order is assigned to the wrong live/test environment.",
        ...context,
      });
    }

    const placedAt = parsedTime(order.placedAt);
    if (placedAt === null) {
      addIssue(issues, {
        code: "order_timestamp_invalid",
        message: "An order has an invalid placed timestamp.",
        ...context,
      });
    } else if (
      !order.confirmationEmailSentAt &&
      placedAt <= now - PREORDER_EMAIL_STALL_MILLISECONDS &&
      !(input.environment === "test" && order.recipientIsReservedTestAddress)
    ) {
      unresolvedEmailStreams.add(`confirmation:${order.id}`);
      addIssue(issues, {
        code: "confirmation_email_missing",
        message: "The paid order has no recorded confirmation email after ten minutes.",
        ...context,
      });
    }

    if (["requested", "processing"].includes(order.cancellationStatus)) {
      unresolvedCancellations.add(order.id);
      addIssue(issues, {
        code: "cancellation_unresolved",
        message: `The order cancellation remains ${order.cancellationStatus}.`,
        ...context,
      });
    }
    if (order.paymentStatus === "refund_pending") {
      unresolvedCancellations.add(order.id);
      addIssue(issues, {
        code: "refund_unresolved",
        message: "The order refund is still pending.",
        ...context,
      });
    } else if (order.paymentStatus === "refund_failed") {
      unresolvedCancellations.add(order.id);
      addIssue(issues, {
        code: "refund_failed",
        message: "The order refund failed and needs owner action.",
        ...context,
      });
    } else if (order.paymentStatus === "disputed") {
      addIssue(issues, {
        code: "payment_disputed",
        message: "The order has an unresolved payment dispute.",
        ...context,
      });
    }

    const fullyRefunded =
      order.paymentStatus === "refunded" &&
      order.amountTotal > 0 &&
      order.amountRefunded === order.amountTotal;
    const cancellationComplete =
      order.orderStatus === "cancelled" && order.cancellationStatus === "completed";
    if (
      (order.cancellationStatus === "completed" &&
        (!fullyRefunded || order.orderStatus !== "cancelled")) ||
      (order.orderStatus === "cancelled" &&
        (!fullyRefunded || order.cancellationStatus !== "completed"))
    ) {
      unresolvedCancellations.add(order.id);
      addIssue(issues, {
        code: "cancellation_state_inconsistent",
        message: "The completed cancellation, full refund, and cancelled order states do not agree.",
        ...context,
      });
    }

    if (["requested", "processing"].includes(order.addressChangeStatus)) {
      addIssue(issues, {
        code: "address_change_unresolved",
        message: `The shipping-address change remains ${order.addressChangeStatus}.`,
        ...context,
      });
    }

    if (
      order.deliveryUpdateStatus === "pending" &&
      order.deliveryUpdateResponseMode === "affirmative_consent_required"
    ) {
      const deadline = parsedTime(order.deliveryUpdateResponseDeadline);
      if (deadline === null) {
        overdueDeliveryActions.add(order.id);
        addIssue(issues, {
          code: "delivery_deadline_invalid",
          message: "A delivery update requiring consent has no valid response deadline.",
          ...context,
        });
      } else if (deadline <= now) {
        overdueDeliveryActions.add(order.id);
        addIssue(issues, {
          code: "delivery_action_overdue",
          message: "A required delivery-response deadline has passed without resolution.",
          ...context,
        });
      }
    } else if (order.deliveryUpdateStatus === "expired" && !cancellationComplete) {
      overdueDeliveryActions.add(order.id);
      addIssue(issues, {
        code: "delivery_expiration_unresolved",
        message: "An expired delivery-response deadline has not completed cancellation and refund handling.",
        ...context,
      });
    }

    if (
      (order.fulfillmentStatus === "shipped" && !order.shippedAt) ||
      (order.fulfillmentStatus === "delivered" &&
        (!order.shippedAt || !order.deliveredAt)) ||
      (order.orderStatus === "cancelled" &&
        ["shipped", "delivered"].includes(order.fulfillmentStatus))
    ) {
      addIssue(issues, {
        code: "fulfillment_state_inconsistent",
        message: "The order's fulfilment state and shipment timestamps do not agree.",
        ...context,
      });
    }

    const orderItems = itemsByOrder.get(order.id) ?? [];
    const totalQuantity = orderItems.reduce((total, item) => total + item.quantity, 0);
    if (orderItems.length === 0 || totalQuantity <= 0) {
      addIssue(issues, {
        code: "order_inventory_missing",
        message: "The order has no positive inventory-unit record.",
        ...context,
      });
    }
  }

  let paidUnits = 0;
  for (const order of input.orders) {
    if (order.orderStatus === "cancelled" || order.paymentStatus === "refunded") continue;
    paidUnits += (itemsByOrder.get(order.id) ?? []).reduce(
      (total, item) => total + item.quantity,
      0,
    );
  }
  let reservedUnits = 0;
  for (const intent of input.intents) {
    if (intent.environment !== input.environment) {
      addIssue(issues, {
        code: "intent_environment_mismatch",
        message: "A checkout reservation is assigned to the wrong environment.",
      });
    }
    if (!Number.isSafeInteger(intent.quantity) || intent.quantity <= 0) {
      addIssue(issues, {
        code: "reservation_quantity_invalid",
        message: "A checkout reservation has an invalid unit quantity.",
      });
    }
    const expiresAt = parsedTime(intent.expiresAt);
    if (
      ["created", "checkout_open"].includes(intent.status) &&
      (intent.expiresAt === null || (expiresAt !== null && expiresAt > now))
    ) {
      reservedUnits += intent.quantity;
    }
  }

  const salesValues = [
    input.sales.inventoryLimit,
    input.sales.unitLimit,
    input.sales.paidUnits,
    input.sales.reservedUnits,
    input.sales.remainingUnits,
    input.sales.inventoryRemainingUnits,
  ];
  if (
    input.sales.environment !== input.environment ||
    !salesValues.every(isNonNegativeInteger)
  ) {
    addIssue(issues, {
      code: "sales_snapshot_invalid",
      message: "The sales-control snapshot contains an invalid environment or unit total.",
    });
  } else {
    const expectedRemaining = Math.max(
      input.sales.unitLimit - paidUnits - reservedUnits,
      0,
    );
    const expectedInventoryRemaining = Math.max(
      input.sales.inventoryLimit - paidUnits - reservedUnits,
      0,
    );
    if (
      input.sales.paidUnits !== paidUnits ||
      input.sales.reservedUnits !== reservedUnits ||
      input.sales.remainingUnits !== expectedRemaining ||
      input.sales.inventoryRemainingUnits !== expectedInventoryRemaining
    ) {
      addIssue(issues, {
        code: "inventory_snapshot_mismatch",
        message: "Sales-control totals do not match orders, items, and active checkout reservations.",
      });
    }
    if (
      input.sales.unitLimit > input.sales.inventoryLimit ||
      paidUnits + reservedUnits > input.sales.unitLimit ||
      paidUnits + reservedUnits > input.sales.inventoryLimit
    ) {
      addIssue(issues, {
        code: "inventory_limit_exceeded",
        message: "Paid and reserved units exceed a released or lifetime inventory ceiling.",
      });
    }
  }

  const healthy = issues.length === 0;
  return {
    healthy,
    recommendation: healthy ? "safe_to_accept_orders" : "pause_sales",
    issues,
    summary: {
      orders: input.orders.length,
      activePaidOrders: input.orders.filter(
        (order) =>
          order.orderStatus !== "cancelled" && order.paymentStatus !== "refunded",
      ).length,
      unresolvedWebhooks: unresolvedWebhooks.size,
      unresolvedEmailStreams: unresolvedEmailStreams.size,
      unresolvedCancellations: unresolvedCancellations.size,
      overdueDeliveryActions: overdueDeliveryActions.size,
      paidUnits,
      reservedUnits,
      unitLimit: input.sales.unitLimit,
      inventoryLimit: input.sales.inventoryLimit,
    },
  };
}
