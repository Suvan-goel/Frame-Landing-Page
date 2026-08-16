import {
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_REMAINING_BALANCE_CENTS,
} from "./preorder.ts";

export type PreorderLiveSmokeOrderEvidence = {
  id: string;
  checkoutIntentId: string;
  environment: string;
  paymentStatus: string;
  amountTotal: number;
  amountRefunded: number;
  offerType: string;
  reservationAmount: number;
  lockedTotalPrice: number;
  remainingBalance: number;
  reservationStatus: string | null;
  confirmationEmailSentAt: string | null;
};

export type PreorderLiveSmokeIntentEvidence = {
  id: string;
  environment: string;
  status: string;
  source: string | null;
  offerType: string;
  reservationAmount: number;
  lockedTotalPrice: number;
  remainingBalance: number;
  unitAmount: number;
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
      order.offerType === "reservation" &&
      order.amountTotal === PREORDER_DEFAULT_PRICE_CENTS &&
      order.amountRefunded === order.amountTotal &&
      order.reservationAmount === PREORDER_DEFAULT_PRICE_CENTS &&
      order.lockedTotalPrice === PREORDER_FOUNDING_PRICE_CENTS &&
      order.remainingBalance === PREORDER_REMAINING_BALANCE_CENTS &&
      order.reservationStatus === "refunded" &&
      intent.offerType === "reservation" &&
      intent.reservationAmount === PREORDER_DEFAULT_PRICE_CENTS &&
      intent.lockedTotalPrice === PREORDER_FOUNDING_PRICE_CENTS &&
      intent.remainingBalance === PREORDER_REMAINING_BALANCE_CENTS &&
      intent.unitAmount === PREORDER_DEFAULT_PRICE_CENTS &&
      order.confirmationEmailSentAt,
  );

  return {
    ready,
    blocker: ready
      ? null
      : "The configured verification order is not a completed, confirmation-sent, fully refunded $99 Frame reservation with the reviewed $299 locked price and $200 remaining balance.",
  };
}
