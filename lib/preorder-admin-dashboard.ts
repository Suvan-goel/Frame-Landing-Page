export type PreorderAttentionOrder = {
  id: string;
  order_status: string;
  payment_status: string;
  cancellation_status: string;
  confirmation_email_sent_at: string | null;
};

export type PreorderEmailHealth = {
  preorder_id: string;
  email_type: string;
  status: string;
  created_at: string;
};

export type PreorderAttentionSummary = {
  affectedOrderCount: number;
  emailOrderCount: number;
  orderIssueCount: number;
  total: number;
  webhookCount: number;
};

const statusLabels: Record<string, string> = {
  none: "No request",
  on_hold: "On hold",
  partially_refunded: "Partially refunded",
  refund_failed: "Refund failed",
  refund_pending: "Refund pending",
  sold_out: "Sold out",
};

export function formatPreorderAdminStatus(value: string) {
  return (
    statusLabels[value] ??
    value
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

export function summarizePreorderAttention(
  orders: PreorderAttentionOrder[],
  emailDeliveries: PreorderEmailHealth[],
  webhookCount: number,
): PreorderAttentionSummary {
  const orderIssueIds = new Set<string>();
  for (const order of orders) {
    const isClosed =
      order.order_status === "cancelled" || order.payment_status === "refunded";
    if (
      (!isClosed && !order.confirmation_email_sent_at) ||
      ["requested", "processing"].includes(order.cancellation_status) ||
      ["refund_failed", "disputed"].includes(order.payment_status)
    ) {
      orderIssueIds.add(order.id);
    }
  }

  const latestDeliveryByType = new Map<string, PreorderEmailHealth>();
  for (const delivery of emailDeliveries) {
    const key = `${delivery.preorder_id}:${delivery.email_type}`;
    const current = latestDeliveryByType.get(key);
    if (
      !current ||
      Date.parse(delivery.created_at) > Date.parse(current.created_at)
    ) {
      latestDeliveryByType.set(key, delivery);
    }
  }

  const emailOrderIds = new Set(
    [...latestDeliveryByType.values()]
      .filter((delivery) => delivery.status === "failed")
      .map((delivery) => delivery.preorder_id),
  );
  const affectedOrderIds = new Set([...orderIssueIds, ...emailOrderIds]);

  return {
    affectedOrderCount: affectedOrderIds.size,
    emailOrderCount: emailOrderIds.size,
    orderIssueCount: orderIssueIds.size,
    total: affectedOrderIds.size + webhookCount,
    webhookCount,
  };
}
