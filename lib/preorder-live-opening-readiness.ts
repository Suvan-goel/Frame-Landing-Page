export type PreorderLiveSmokeOrderEvidence = {
  id: string;
  checkoutIntentId: string;
  environment: string;
  paymentStatus: string;
  amountTotal: number;
  amountRefunded: number;
  confirmationEmailSentAt: string | null;
};

export type PreorderLiveSmokeIntentEvidence = {
  id: string;
  environment: string;
  status: string;
  source: string | null;
};

export function evaluatePreorderLiveSmokeEvidence(input: {
  order: PreorderLiveSmokeOrderEvidence | null;
  intent: PreorderLiveSmokeIntentEvidence | null;
}) {
  const { order, intent } = input;
  const ready = Boolean(
    order &&
      intent &&
      intent.id === order.checkoutIntentId &&
      intent.environment === "live" &&
      intent.status === "paid" &&
      intent.source === "private_live_smoke" &&
      order.environment === "live" &&
      order.paymentStatus === "refunded" &&
      order.amountTotal > 0 &&
      order.amountRefunded === order.amountTotal &&
      order.confirmationEmailSentAt,
  );

  return {
    ready,
    blocker: ready
      ? null
      : "The configured verification order is not a completed, confirmation-sent, fully refunded private live-verification order.",
  };
}
