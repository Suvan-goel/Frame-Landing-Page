export type StoredPreorderReconciliationOrder = {
  id: string;
  orderNumber: number;
  environment: "live" | "test";
  checkoutIntentId: string;
  checkoutSessionId: string;
  customerId: string | null;
  orderStatus: string;
  paymentStatus: string;
  cancellationStatus: string;
  amountSubtotal: number;
  amountShipping: number;
  amountTax: number;
  amountTotal: number;
  amountRefunded: number;
  currency: string;
  offerType?: "full_preorder" | "reservation";
};

export type StoredPreorderReconciliationPayment = {
  id: string;
  preorderId: string;
  checkoutIntentId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  environment: "live" | "test";
  paymentKind: string;
  paymentStatus: string;
  amountTotal: number;
  amountRefunded: number;
  currency: string;
};

export type StoredPreorderReconciliationIntent = {
  id: string;
  environment: "live" | "test";
  status: string;
  checkoutSessionId: string | null;
  customerId: string | null;
  quantity: number;
  unitAmount: number;
  currency: string;
};

export type StripePreorderRefundSnapshot = {
  id: string;
  amount: number;
  currency: string;
  paymentIntentId: string | null;
  status: string | null;
  created: number;
};

export type StripePreorderDisputeSnapshot = {
  id: string;
  amount: number;
  currency: string;
  livemode: boolean;
  paymentIntentId: string | null;
  status: string;
};

export type StripePreorderPaymentSnapshot = {
  checkoutSessionId: string;
  livemode: boolean;
  sessionStatus: string | null;
  paymentStatus: string;
  mode: string | null;
  checkoutIntentId: string | null;
  customerId: string | null;
  paymentIntentId: string | null;
  metadataFlow: string | null;
  metadataEnvironment: string | null;
  currency: string | null;
  amountSubtotal: number | null;
  amountShipping: number;
  amountTax: number;
  amountDiscount: number;
  amountTotal: number | null;
  paymentIntent: {
    id: string;
    livemode: boolean;
    status: string;
    amount: number;
    amountReceived: number;
    currency: string;
    customerId: string | null;
    metadataFlow: string | null;
    metadataCheckoutIntentId: string | null;
    metadataEnvironment: string | null;
  } | null;
  charge: {
    id: string;
    livemode: boolean;
    status: string;
    paid: boolean;
    amount: number;
    amountCaptured: number;
    amountRefunded: number;
    currency: string;
    customerId: string | null;
    paymentIntentId: string | null;
  } | null;
  refunds: StripePreorderRefundSnapshot[];
  disputes: StripePreorderDisputeSnapshot[];
};

export type PreorderPaymentReconciliationIssue = {
  code: string;
  message: string;
  orderNumber?: number;
  checkoutSessionId?: string;
};

export type PreorderPaymentReconciliationResult = {
  ready: boolean;
  issues: PreorderPaymentReconciliationIssue[];
  summary: {
    storedOrders: number;
    stripePaidSessions: number;
    grossStored: number;
    grossStripe: number;
    refundedStored: number;
    refundedStripe: number;
    activeDisputes: number;
    currency: string | null;
  };
};

export type PreorderPaymentReconciliationInput = {
  environment: "live" | "test";
  orders: StoredPreorderReconciliationOrder[];
  payments: StoredPreorderReconciliationPayment[];
  intents: StoredPreorderReconciliationIntent[];
  stripePayments: StripePreorderPaymentSnapshot[];
};

const CLOSED_FAVOURABLE_DISPUTES = new Set([
  "prevented",
  "warning_closed",
  "won",
]);
const PENDING_REFUNDS = new Set(["pending", "requires_action"]);
const FAILED_REFUNDS = new Set(["failed", "canceled"]);

function stripeRefundState(snapshot: StripePreorderPaymentSnapshot) {
  if (snapshot.refunds.some((refund) => PENDING_REFUNDS.has(refund.status ?? ""))) {
    return "refund_pending";
  }
  const refunded = snapshot.charge?.amountRefunded ?? 0;
  const total = snapshot.charge?.amount ?? snapshot.amountTotal ?? 0;
  if (total > 0 && refunded >= total) return "refunded";
  if (refunded > 0) return "partially_refunded";
  const latestRefund = [...snapshot.refunds].sort((a, b) => b.created - a.created)[0];
  if (latestRefund && FAILED_REFUNDS.has(latestRefund.status ?? "")) {
    return "refund_failed";
  }
  return "paid";
}

function hasActionableDispute(snapshot: StripePreorderPaymentSnapshot) {
  return snapshot.disputes.some(
    (dispute) => !CLOSED_FAVOURABLE_DISPUTES.has(dispute.status),
  );
}

function addIssue(
  issues: PreorderPaymentReconciliationIssue[],
  issue: PreorderPaymentReconciliationIssue,
) {
  if (
    !issues.some(
      (existing) =>
        existing.code === issue.code &&
        existing.orderNumber === issue.orderNumber &&
        existing.checkoutSessionId === issue.checkoutSessionId,
    )
  ) {
    issues.push(issue);
  }
}

export function evaluatePreorderPaymentReconciliation(
  input: PreorderPaymentReconciliationInput,
): PreorderPaymentReconciliationResult {
  const issues: PreorderPaymentReconciliationIssue[] = [];
  const paymentsByOrder = new Map<string, StoredPreorderReconciliationPayment[]>();
  const intentsById = new Map(input.intents.map((intent) => [intent.id, intent]));
  const ordersBySession = new Map(
    input.orders.map((order) => [order.checkoutSessionId, order]),
  );
  const stripeBySession = new Map(
    input.stripePayments.map((payment) => [payment.checkoutSessionId, payment]),
  );

  for (const payment of input.payments) {
    const existing = paymentsByOrder.get(payment.preorderId) ?? [];
    existing.push(payment);
    paymentsByOrder.set(payment.preorderId, existing);
    if (!input.orders.some((order) => order.id === payment.preorderId)) {
      addIssue(issues, {
        code: "orphan_stored_payment",
        checkoutSessionId: payment.checkoutSessionId,
        message: "A stored payment has no corresponding pre-order.",
      });
    }
  }

  for (const stripePayment of input.stripePayments) {
    if (!ordersBySession.has(stripePayment.checkoutSessionId)) {
      addIssue(issues, {
        code: "orphan_stripe_payment",
        checkoutSessionId: stripePayment.checkoutSessionId,
        message: "A paid Stripe pre-order Checkout Session has no stored order.",
      });
    }
  }

  for (const order of input.orders) {
    const reservation = order.offerType === "reservation";
    const expectedFlow = reservation ? "frame_reservation" : "frame_preorder";
    const expectedPaymentKind = reservation ? "reservation_fee" : "full_payment";
    const orderContext = {
      orderNumber: order.orderNumber,
      checkoutSessionId: order.checkoutSessionId,
    };
    const storedPayments = paymentsByOrder.get(order.id) ?? [];
    const payment = storedPayments.length === 1 ? storedPayments[0] : null;
    const intent = intentsById.get(order.checkoutIntentId) ?? null;
    const stripe = stripeBySession.get(order.checkoutSessionId) ?? null;

    if (order.environment !== input.environment) {
      addIssue(issues, {
        code: "stored_order_environment_mismatch",
        message: "The stored order is assigned to the wrong payment environment.",
        ...orderContext,
      });
    }
    if (storedPayments.length !== 1) {
      addIssue(issues, {
        code: "stored_payment_count_mismatch",
        message: `Expected one stored full payment, found ${storedPayments.length}.`,
        ...orderContext,
      });
    }
    if (!intent) {
      addIssue(issues, {
        code: "missing_checkout_intent",
        message: "The order's stored checkout intent is missing.",
        ...orderContext,
      });
    }
    if (!stripe) {
      addIssue(issues, {
        code: "missing_stripe_payment",
        message: "The stored order has no paid Stripe pre-order Checkout Session.",
        ...orderContext,
      });
    }

    if (payment) {
      const paymentLinksMatch =
        payment.environment === input.environment &&
        payment.preorderId === order.id &&
        payment.checkoutIntentId === order.checkoutIntentId &&
        payment.checkoutSessionId === order.checkoutSessionId &&
        payment.paymentKind === expectedPaymentKind &&
        payment.customerId === order.customerId;
      if (!paymentLinksMatch) {
        addIssue(issues, {
          code: "stored_payment_link_mismatch",
          message: "Stored order and payment identifiers or environment do not agree.",
          ...orderContext,
        });
      }
      if (
        payment.amountTotal !== order.amountTotal ||
        payment.amountRefunded !== order.amountRefunded ||
        payment.currency !== order.currency
      ) {
        addIssue(issues, {
          code: "stored_payment_amount_mismatch",
          message: "Stored order and payment totals, refunds, or currency do not agree.",
          ...orderContext,
        });
      }
    }

    if (intent) {
      if (
        intent.environment !== input.environment ||
        intent.status !== "paid" ||
        intent.checkoutSessionId !== order.checkoutSessionId ||
        intent.customerId !== order.customerId ||
        intent.currency !== order.currency ||
        intent.unitAmount * intent.quantity !== order.amountSubtotal
      ) {
        addIssue(issues, {
          code: "stored_checkout_intent_mismatch",
          message: "Stored checkout intent status, identifiers, or subtotal do not match the order.",
          ...orderContext,
        });
      }
    }

    if (!stripe || !payment) continue;

    if (
      stripe.livemode !== (input.environment === "live") ||
      stripe.sessionStatus !== "complete" ||
      stripe.paymentStatus !== "paid" ||
      stripe.mode !== "payment" ||
      stripe.metadataFlow !== expectedFlow
    ) {
      addIssue(issues, {
        code: "stripe_session_state_mismatch",
        message: "Stripe Checkout Session mode, live/test environment, Frame flow, or paid state is invalid.",
        ...orderContext,
      });
    }
    if (
      stripe.checkoutIntentId !== order.checkoutIntentId ||
      stripe.customerId !== order.customerId ||
      stripe.paymentIntentId !== payment.paymentIntentId
    ) {
      addIssue(issues, {
        code: "stripe_session_link_mismatch",
        message: "Stripe Checkout identifiers do not match the stored order and payment.",
        ...orderContext,
      });
    }
    if (
      stripe.currency !== order.currency ||
      stripe.amountSubtotal !== order.amountSubtotal ||
      stripe.amountShipping !== order.amountShipping ||
      stripe.amountTax !== order.amountTax ||
      stripe.amountDiscount !== 0 ||
      stripe.amountTotal !== order.amountTotal ||
      order.amountSubtotal + order.amountShipping + order.amountTax !==
        order.amountTotal
    ) {
      addIssue(issues, {
        code: "stripe_session_amount_mismatch",
        message: "Stripe Checkout subtotal, shipping, tax, discount, total, or currency does not match the order.",
        ...orderContext,
      });
    }

    const paymentIntent = stripe.paymentIntent;
    if (!paymentIntent) {
      addIssue(issues, {
        code: "missing_stripe_payment_intent",
        message: "The paid Checkout Session has no retrievable PaymentIntent.",
        ...orderContext,
      });
    } else {
      if (
        paymentIntent.id !== payment.paymentIntentId ||
        paymentIntent.livemode !== (input.environment === "live") ||
        paymentIntent.status !== "succeeded" ||
        paymentIntent.amount !== order.amountTotal ||
        paymentIntent.amountReceived !== order.amountTotal ||
        paymentIntent.currency !== order.currency ||
        paymentIntent.customerId !== order.customerId
      ) {
        addIssue(issues, {
          code: "stripe_payment_intent_mismatch",
          message: "Stripe PaymentIntent identity, state, captured amount, customer, or currency does not match.",
          ...orderContext,
        });
      }
      if (
        paymentIntent.metadataFlow !== expectedFlow ||
        paymentIntent.metadataCheckoutIntentId !== order.checkoutIntentId
      ) {
        addIssue(issues, {
          code: "stripe_payment_metadata_mismatch",
          message: "Stripe PaymentIntent metadata does not identify the stored pre-order flow and checkout intent.",
          ...orderContext,
        });
      }
    }

    const charge = stripe.charge;
    if (!charge) {
      addIssue(issues, {
        code: "missing_stripe_charge",
        message: "The succeeded PaymentIntent has no retrievable latest Charge.",
        ...orderContext,
      });
    } else {
      if (
        charge.livemode !== (input.environment === "live") ||
        charge.status !== "succeeded" ||
        !charge.paid ||
        charge.amount !== order.amountTotal ||
        charge.amountCaptured !== order.amountTotal ||
        charge.currency !== order.currency ||
        charge.customerId !== order.customerId ||
        charge.paymentIntentId !== payment.paymentIntentId
      ) {
        addIssue(issues, {
          code: "stripe_charge_mismatch",
          message: "Stripe Charge identity, state, captured amount, customer, or currency does not match.",
          ...orderContext,
        });
      }
      if (
        charge.amountRefunded !== order.amountRefunded ||
        charge.amountRefunded !== payment.amountRefunded ||
        charge.amountRefunded < 0 ||
        charge.amountRefunded > charge.amount
      ) {
        addIssue(issues, {
          code: "stripe_refund_total_mismatch",
          message: "Stripe and stored refunded totals do not agree.",
          ...orderContext,
        });
      }
    }

    if (
      stripe.refunds.some(
        (refund) =>
          refund.currency !== order.currency ||
          refund.paymentIntentId !== payment.paymentIntentId ||
          refund.amount <= 0,
      )
    ) {
      addIssue(issues, {
        code: "stripe_refund_object_mismatch",
        message: "At least one Stripe Refund has invalid currency, amount, or PaymentIntent linkage.",
        ...orderContext,
      });
    }
    const succeededRefundAmount = stripe.refunds
      .filter((refund) => refund.status === "succeeded")
      .reduce((total, refund) => total + refund.amount, 0);
    if (charge && succeededRefundAmount !== charge.amountRefunded) {
      addIssue(issues, {
        code: "stripe_refund_ledger_mismatch",
        message: "Succeeded Stripe Refund objects do not add up to the Charge refunded total.",
        ...orderContext,
      });
    }
    if (
      stripe.disputes.some(
        (dispute) =>
          dispute.livemode !== (input.environment === "live") ||
          dispute.currency !== order.currency ||
          dispute.paymentIntentId !== payment.paymentIntentId ||
          dispute.amount <= 0 ||
          dispute.amount > order.amountTotal,
      )
    ) {
      addIssue(issues, {
        code: "stripe_dispute_object_mismatch",
        message: "At least one Stripe Dispute has invalid environment, currency, amount, or PaymentIntent linkage.",
        ...orderContext,
      });
    }

    const refundState = stripeRefundState(stripe);
    const actionableDispute = hasActionableDispute(stripe);
    const expectedOrderPaymentStatus = actionableDispute ? "disputed" : refundState;
    if (
      payment.paymentStatus !== refundState ||
      order.paymentStatus !== expectedOrderPaymentStatus
    ) {
      addIssue(issues, {
        code: "payment_status_mismatch",
        message: `Stored payment state does not match Stripe (expected order ${expectedOrderPaymentStatus}, payment ${refundState}).`,
        ...orderContext,
      });
    }
    if (
      (refundState === "refunded" &&
        (order.orderStatus !== "cancelled" || order.cancellationStatus !== "completed")) ||
      (refundState !== "refunded" && order.orderStatus === "cancelled")
    ) {
      addIssue(issues, {
        code: "order_refund_state_mismatch",
        message: "Order and cancellation state does not match the full-refund state in Stripe.",
        ...orderContext,
      });
    }
  }

  const storedCurrencies = new Set(input.orders.map((order) => order.currency));
  const stripeCurrencies = new Set(
    input.stripePayments
      .map((payment) => payment.currency)
      .filter((currency): currency is string => Boolean(currency)),
  );
  const currencies = new Set([...storedCurrencies, ...stripeCurrencies]);
  if (currencies.size > 1) {
    addIssue(issues, {
      code: "multiple_reconciliation_currencies",
      message: "Payment reconciliation contains more than one currency.",
    });
  }

  return {
    ready: issues.length === 0,
    issues,
    summary: {
      storedOrders: input.orders.length,
      stripePaidSessions: input.stripePayments.length,
      grossStored: input.orders.reduce((total, order) => total + order.amountTotal, 0),
      grossStripe: input.stripePayments.reduce(
        (total, payment) => total + (payment.amountTotal ?? 0),
        0,
      ),
      refundedStored: input.orders.reduce(
        (total, order) => total + order.amountRefunded,
        0,
      ),
      refundedStripe: input.stripePayments.reduce(
        (total, payment) => total + (payment.charge?.amountRefunded ?? 0),
        0,
      ),
      activeDisputes: input.stripePayments.reduce(
        (total, payment) => total + (hasActionableDispute(payment) ? 1 : 0),
        0,
      ),
      currency: currencies.size === 1 ? [...currencies][0] : null,
    },
  };
}
