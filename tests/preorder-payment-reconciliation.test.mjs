import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluatePreorderPaymentReconciliation } from "../lib/preorder-payment-reconciliation.ts";

function readyInput() {
  return {
    environment: "test",
    orders: [
      {
        id: "order-1",
        orderNumber: 1,
        environment: "test",
        checkoutIntentId: "intent-1",
        checkoutSessionId: "cs_test_1",
        customerId: "cus_test_1",
        orderStatus: "placed",
        paymentStatus: "paid",
        cancellationStatus: "none",
        amountSubtotal: 29_900,
        amountShipping: 0,
        amountTax: 2_500,
        amountTotal: 32_400,
        amountRefunded: 0,
        currency: "usd",
      },
    ],
    payments: [
      {
        id: "payment-1",
        preorderId: "order-1",
        checkoutIntentId: "intent-1",
        checkoutSessionId: "cs_test_1",
        paymentIntentId: "pi_test_1",
        customerId: "cus_test_1",
        environment: "test",
        paymentKind: "full_payment",
        paymentStatus: "paid",
        amountTotal: 32_400,
        amountRefunded: 0,
        currency: "usd",
      },
    ],
    intents: [
      {
        id: "intent-1",
        environment: "test",
        status: "paid",
        checkoutSessionId: "cs_test_1",
        customerId: "cus_test_1",
        quantity: 1,
        unitAmount: 29_900,
        currency: "usd",
      },
    ],
    stripePayments: [
      {
        checkoutSessionId: "cs_test_1",
        livemode: false,
        sessionStatus: "complete",
        paymentStatus: "paid",
        mode: "payment",
        checkoutIntentId: "intent-1",
        customerId: "cus_test_1",
        paymentIntentId: "pi_test_1",
        metadataFlow: "frame_preorder",
        metadataEnvironment: "test",
        currency: "usd",
        amountSubtotal: 29_900,
        amountShipping: 0,
        amountTax: 2_500,
        amountDiscount: 0,
        amountTotal: 32_400,
        paymentIntent: {
          id: "pi_test_1",
          livemode: false,
          status: "succeeded",
          amount: 32_400,
          amountReceived: 32_400,
          currency: "usd",
          customerId: "cus_test_1",
          metadataFlow: "frame_preorder",
          metadataCheckoutIntentId: "intent-1",
          metadataEnvironment: "test",
        },
        charge: {
          id: "ch_test_1",
          livemode: false,
          status: "succeeded",
          paid: true,
          amount: 32_400,
          amountCaptured: 32_400,
          amountRefunded: 0,
          currency: "usd",
          customerId: "cus_test_1",
          paymentIntentId: "pi_test_1",
        },
        refunds: [],
        disputes: [],
      },
    ],
  };
}

function issueCodes(result) {
  return new Set(result.issues.map((issue) => issue.code));
}

test("reconciles a complete paid pre-order across Stripe and stored ledgers", () => {
  const result = evaluatePreorderPaymentReconciliation(readyInput());

  assert.equal(result.ready, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.summary, {
    storedOrders: 1,
    stripePaidSessions: 1,
    grossStored: 32_400,
    grossStripe: 32_400,
    refundedStored: 0,
    refundedStripe: 0,
    activeDisputes: 0,
    currency: "usd",
  });
});

test("uses Stripe live/test flags when legacy metadata has no environment key", () => {
  const input = readyInput();
  input.stripePayments[0].metadataEnvironment = null;
  input.stripePayments[0].paymentIntent.metadataEnvironment = null;

  assert.equal(evaluatePreorderPaymentReconciliation(input).ready, true);

  input.stripePayments[0].livemode = true;
  assert.equal(
    issueCodes(evaluatePreorderPaymentReconciliation(input)).has(
      "stripe_session_state_mismatch",
    ),
    true,
  );
});

test("flags paid Stripe sessions and stored payments that have no order", () => {
  const input = readyInput();
  input.stripePayments.push({
    ...structuredClone(input.stripePayments[0]),
    checkoutSessionId: "cs_test_orphan",
  });
  input.payments.push({
    ...structuredClone(input.payments[0]),
    id: "payment-orphan",
    preorderId: "order-missing",
    checkoutSessionId: "cs_test_stored_orphan",
  });

  const codes = issueCodes(evaluatePreorderPaymentReconciliation(input));
  assert.equal(codes.has("orphan_stripe_payment"), true);
  assert.equal(codes.has("orphan_stored_payment"), true);
});

test("flags identifier, metadata, total, currency, and refund ledger mismatches", () => {
  const input = readyInput();
  input.stripePayments[0].checkoutIntentId = "intent-wrong";
  input.stripePayments[0].amountTax = 2_400;
  input.stripePayments[0].paymentIntent.metadataFlow = "different_flow";
  input.stripePayments[0].charge.amountRefunded = 500;

  const codes = issueCodes(evaluatePreorderPaymentReconciliation(input));
  assert.equal(codes.has("stripe_session_link_mismatch"), true);
  assert.equal(codes.has("stripe_session_amount_mismatch"), true);
  assert.equal(codes.has("stripe_payment_metadata_mismatch"), true);
  assert.equal(codes.has("stripe_refund_total_mismatch"), true);
  assert.equal(codes.has("stripe_refund_ledger_mismatch"), true);
});

test("reconciles partial and full succeeded refunds", () => {
  const partial = readyInput();
  partial.orders[0].paymentStatus = "partially_refunded";
  partial.orders[0].amountRefunded = 10_000;
  partial.payments[0].paymentStatus = "partially_refunded";
  partial.payments[0].amountRefunded = 10_000;
  partial.stripePayments[0].charge.amountRefunded = 10_000;
  partial.stripePayments[0].refunds = [
    {
      id: "re_test_partial",
      amount: 10_000,
      currency: "usd",
      paymentIntentId: "pi_test_1",
      status: "succeeded",
      created: 1,
    },
  ];
  assert.equal(evaluatePreorderPaymentReconciliation(partial).ready, true);

  const full = readyInput();
  full.orders[0].orderStatus = "cancelled";
  full.orders[0].paymentStatus = "refunded";
  full.orders[0].cancellationStatus = "completed";
  full.orders[0].amountRefunded = 32_400;
  full.payments[0].paymentStatus = "refunded";
  full.payments[0].amountRefunded = 32_400;
  full.stripePayments[0].charge.amountRefunded = 32_400;
  full.stripePayments[0].refunds = [
    {
      id: "re_test_full",
      amount: 32_400,
      currency: "usd",
      paymentIntentId: "pi_test_1",
      status: "succeeded",
      created: 2,
    },
  ];
  assert.equal(evaluatePreorderPaymentReconciliation(full).ready, true);
});

test("reconciles pending and failed refund attempts without treating them as refunded", () => {
  const pending = readyInput();
  pending.orders[0].paymentStatus = "refund_pending";
  pending.payments[0].paymentStatus = "refund_pending";
  pending.stripePayments[0].refunds = [
    {
      id: "re_test_pending",
      amount: 32_400,
      currency: "usd",
      paymentIntentId: "pi_test_1",
      status: "pending",
      created: 3,
    },
  ];
  assert.equal(evaluatePreorderPaymentReconciliation(pending).ready, true);

  const failed = readyInput();
  failed.orders[0].paymentStatus = "refund_failed";
  failed.payments[0].paymentStatus = "refund_failed";
  failed.stripePayments[0].refunds = [
    {
      id: "re_test_failed",
      amount: 32_400,
      currency: "usd",
      paymentIntentId: "pi_test_1",
      status: "failed",
      created: 4,
    },
  ];
  assert.equal(evaluatePreorderPaymentReconciliation(failed).ready, true);
});

test("requires the order ledger to record an actionable or lost dispute", () => {
  const input = readyInput();
  input.orders[0].paymentStatus = "disputed";
  input.stripePayments[0].disputes = [
    {
      id: "dp_test_1",
      amount: 32_400,
      currency: "usd",
      livemode: false,
      paymentIntentId: "pi_test_1",
      status: "needs_response",
    },
  ];

  const result = evaluatePreorderPaymentReconciliation(input);
  assert.equal(result.ready, true);
  assert.equal(result.summary.activeDisputes, 1);

  input.orders[0].paymentStatus = "paid";
  assert.equal(
    issueCodes(evaluatePreorderPaymentReconciliation(input)).has(
      "payment_status_mismatch",
    ),
    true,
  );
});

test("treats a won dispute as closed and returns to the Stripe refund state", () => {
  const input = readyInput();
  input.stripePayments[0].disputes = [
    {
      id: "dp_test_won",
      amount: 32_400,
      currency: "usd",
      livemode: false,
      paymentIntentId: "pi_test_1",
      status: "won",
    },
  ];

  assert.equal(evaluatePreorderPaymentReconciliation(input).ready, true);
});

test("the collector and commands remain read-only and are wired into launch readiness", async () => {
  const [collector, command, launchCheck, packageFile] = await Promise.all([
    readFile(
      new URL("../lib/preorder-payment-reconciliation.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../scripts/check-preorder-payment-reconciliation.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../scripts/check-preorder-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(collector, /\.(?:insert|update|upsert|delete)\s*\(/);
  assert.match(command, /No payment, refund, order or setting was changed/);
  assert.match(launchCheck, /runPreorderPaymentReconciliation/);
  assert.match(packageFile, /preorder:check:payments/);
});
