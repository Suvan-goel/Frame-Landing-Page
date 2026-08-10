import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluatePreorderOperationsHealth } from "../lib/preorder-operations-health.ts";

function readyInput() {
  return {
    environment: "test",
    now: "2026-08-10T12:00:00.000Z",
    orders: [
      {
        id: "order-1",
        orderNumber: 1,
        environment: "test",
        orderStatus: "placed",
        paymentStatus: "paid",
        fulfillmentStatus: "on_hold",
        cancellationStatus: "none",
        cancellationRequestedAt: null,
        addressChangeStatus: "none",
        addressChangeRequestedAt: null,
        deliveryUpdateStatus: "none",
        deliveryUpdateResponseMode: "none",
        deliveryUpdateResponseDeadline: null,
        confirmationEmailSentAt: "2026-08-10T10:01:00.000Z",
        recipientIsReservedTestAddress: false,
        amountTotal: 32_400,
        amountRefunded: 0,
        placedAt: "2026-08-10T10:00:00.000Z",
        shippedAt: null,
        deliveredAt: null,
      },
    ],
    emails: [
      {
        id: "email-1",
        preorderId: "order-1",
        streamKey: "order-1:order_confirmation:customer",
        emailType: "order_confirmation",
        status: "sent",
        recipientIsReservedTestAddress: false,
        providerTrackingExpected: false,
        lastEvent: "email.sent",
        lastEventAt: "2026-08-10T10:01:00.000Z",
        sentAt: "2026-08-10T10:01:00.000Z",
        deliveredAt: null,
        createdAt: "2026-08-10T10:00:30.000Z",
        updatedAt: "2026-08-10T10:01:00.000Z",
      },
    ],
    webhooks: [],
    items: [{ id: "item-1", preorderId: "order-1", quantity: 1 }],
    intents: [
      {
        id: "intent-1",
        environment: "test",
        status: "paid",
        quantity: 1,
        expiresAt: "2026-08-11T10:00:00.000Z",
      },
    ],
    sales: {
      environment: "test",
      salesStatus: "open",
      inventoryLimit: 1_000,
      unitLimit: 100,
      paidUnits: 1,
      reservedUnits: 0,
      remainingUnits: 99,
      inventoryRemainingUnits: 999,
    },
  };
}

function issueCodes(result) {
  return new Set(result.issues.map((issue) => issue.code));
}

test("accepts healthy operations with reconciled inventory", () => {
  const result = evaluatePreorderOperationsHealth(readyInput());

  assert.equal(result.healthy, true);
  assert.equal(result.recommendation, "safe_to_accept_orders");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.summary, {
    orders: 1,
    activePaidOrders: 1,
    unresolvedWebhooks: 0,
    unresolvedEmailStreams: 0,
    unresolvedCancellations: 0,
    overdueDeliveryActions: 0,
    paidUnits: 1,
    reservedUnits: 0,
    unitLimit: 100,
    inventoryLimit: 1_000,
  });
});

test("requires sales to pause for failed and stalled Stripe webhooks", () => {
  const input = readyInput();
  input.webhooks = [
    {
      eventId: "evt_failed",
      eventType: "checkout.session.completed",
      livemode: false,
      status: "failed",
      receivedAt: "2026-08-10T11:59:00.000Z",
      lastAttemptedAt: "2026-08-10T11:59:00.000Z",
    },
    {
      eventId: "evt_stalled",
      eventType: "refund.updated",
      livemode: false,
      status: "processing",
      receivedAt: "2026-08-10T11:00:00.000Z",
      lastAttemptedAt: "2026-08-10T11:50:00.000Z",
    },
  ];

  const result = evaluatePreorderOperationsHealth(input);
  const codes = issueCodes(result);
  assert.equal(result.recommendation, "pause_sales");
  assert.equal(result.summary.unresolvedWebhooks, 2);
  assert.equal(codes.has("webhook_failed"), true);
  assert.equal(codes.has("webhook_stalled"), true);
});

test("uses the latest email stream state and detects failed or stalled delivery", () => {
  const input = readyInput();
  input.emails.unshift({
    ...structuredClone(input.emails[0]),
    id: "email-old-failure",
    status: "failed",
    sentAt: null,
    createdAt: "2026-08-10T09:59:00.000Z",
    updatedAt: "2026-08-10T09:59:30.000Z",
  });
  assert.equal(evaluatePreorderOperationsHealth(input).healthy, true);

  input.emails[1].status = "failed";
  input.emails[1].sentAt = null;
  let result = evaluatePreorderOperationsHealth(input);
  assert.equal(issueCodes(result).has("email_delivery_failed"), true);
  assert.equal(result.summary.unresolvedEmailStreams, 1);

  input.emails[1].status = "pending";
  input.emails[1].updatedAt = "2026-08-10T11:40:00.000Z";
  result = evaluatePreorderOperationsHealth(input);
  assert.equal(issueCodes(result).has("email_delivery_stalled"), true);
});

test("requires tracked sends to reach a delivered provider outcome", () => {
  const input = readyInput();
  const email = input.emails[0];
  email.providerTrackingExpected = true;

  let result = evaluatePreorderOperationsHealth(input);
  assert.equal(issueCodes(result).has("email_delivery_unconfirmed"), true);

  email.status = "delivered";
  email.lastEvent = "email.delivered";
  email.lastEventAt = "2026-08-10T10:02:00.000Z";
  email.deliveredAt = "2026-08-10T10:02:00.000Z";
  assert.equal(evaluatePreorderOperationsHealth(input).healthy, true);
});

test("blocks delayed, bounced, complained, and suppressed provider outcomes", () => {
  for (const status of ["delayed", "bounced", "complained", "suppressed"]) {
    const input = readyInput();
    input.emails[0].status = status;
    input.emails[0].providerTrackingExpected = true;
    input.emails[0].lastEvent =
      status === "delayed" ? "email.delivery_delayed" : `email.${status}`;

    const result = evaluatePreorderOperationsHealth(input);
    assert.equal(result.healthy, false, status);
    assert.equal(
      issueCodes(result).has(`email_delivery_${status}`),
      true,
      status,
    );
  }
});

test("ignores reserved sandbox recipients but never ignores live delivery failures", () => {
  const input = readyInput();
  input.orders[0].confirmationEmailSentAt = null;
  input.orders[0].recipientIsReservedTestAddress = true;
  input.emails[0].status = "failed";
  input.emails[0].sentAt = null;
  input.emails[0].recipientIsReservedTestAddress = true;

  assert.equal(evaluatePreorderOperationsHealth(input).healthy, true);

  input.environment = "live";
  input.orders[0].environment = "live";
  input.intents[0].environment = "live";
  input.sales.environment = "live";
  assert.equal(
    issueCodes(evaluatePreorderOperationsHealth(input)).has(
      "email_delivery_failed",
    ),
    true,
  );
});

test("flags missing confirmations, unresolved cancellations, refunds, and disputes", () => {
  const input = readyInput();
  input.orders[0].confirmationEmailSentAt = null;
  input.orders[0].cancellationStatus = "processing";
  input.orders[0].paymentStatus = "refund_pending";

  let codes = issueCodes(evaluatePreorderOperationsHealth(input));
  assert.equal(codes.has("confirmation_email_missing"), true);
  assert.equal(codes.has("cancellation_unresolved"), true);
  assert.equal(codes.has("refund_unresolved"), true);

  input.orders[0].cancellationStatus = "none";
  input.orders[0].paymentStatus = "disputed";
  codes = issueCodes(evaluatePreorderOperationsHealth(input));
  assert.equal(codes.has("payment_disputed"), true);
});

test("accepts a coherent completed cancellation and full refund", () => {
  const input = readyInput();
  input.orders[0].orderStatus = "cancelled";
  input.orders[0].paymentStatus = "refunded";
  input.orders[0].cancellationStatus = "completed";
  input.orders[0].amountRefunded = 32_400;
  input.sales.paidUnits = 0;
  input.sales.remainingUnits = 100;
  input.sales.inventoryRemainingUnits = 1_000;

  const result = evaluatePreorderOperationsHealth(input);
  assert.equal(result.healthy, true);
  assert.equal(result.summary.paidUnits, 0);
});

test("flags overdue delivery consent, unresolved address changes, and shipment drift", () => {
  const input = readyInput();
  input.orders[0].deliveryUpdateStatus = "pending";
  input.orders[0].deliveryUpdateResponseMode = "affirmative_consent_required";
  input.orders[0].deliveryUpdateResponseDeadline = "2026-08-10T11:59:00.000Z";
  input.orders[0].addressChangeStatus = "requested";
  input.orders[0].fulfillmentStatus = "shipped";

  const result = evaluatePreorderOperationsHealth(input);
  const codes = issueCodes(result);
  assert.equal(result.summary.overdueDeliveryActions, 1);
  assert.equal(codes.has("delivery_action_overdue"), true);
  assert.equal(codes.has("address_change_unresolved"), true);
  assert.equal(codes.has("fulfillment_state_inconsistent"), true);
});

test("recomputes active reservations and blocks inventory snapshot or ceiling drift", () => {
  const input = readyInput();
  input.intents.push({
    id: "intent-reserved",
    environment: "test",
    status: "checkout_open",
    quantity: 2,
    expiresAt: "2026-08-10T12:30:00.000Z",
  });
  input.sales.reservedUnits = 1;
  input.sales.remainingUnits = 98;
  input.sales.inventoryRemainingUnits = 998;

  let result = evaluatePreorderOperationsHealth(input);
  assert.equal(result.summary.reservedUnits, 2);
  assert.equal(issueCodes(result).has("inventory_snapshot_mismatch"), true);

  input.sales.reservedUnits = 2;
  input.sales.remainingUnits = 0;
  input.sales.inventoryRemainingUnits = 997;
  input.sales.unitLimit = 2;
  result = evaluatePreorderOperationsHealth(input);
  assert.equal(issueCodes(result).has("inventory_limit_exceeded"), true);
});

test("detects missing or orphaned order inventory records", () => {
  const input = readyInput();
  input.items = [{ id: "item-orphan", preorderId: "missing-order", quantity: 1 }];

  const codes = issueCodes(evaluatePreorderOperationsHealth(input));
  assert.equal(codes.has("orphan_order_item"), true);
  assert.equal(codes.has("order_inventory_missing"), true);
  assert.equal(codes.has("inventory_snapshot_mismatch"), true);
});

test("the operations collector and dedicated command remain read-only", async () => {
  const [collector, command, readiness, packageFile] = await Promise.all([
    readFile(
      new URL("../lib/preorder-operations-health.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../scripts/check-preorder-operations-health.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../scripts/check-preorder-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(collector, /\.(?:insert|update|upsert|delete)\s*\(/);
  assert.match(command, /No webhook, email, order, refund, inventory or setting was changed/);
  assert.match(readiness, /runPreorderOperationsHealth/);
  assert.match(packageFile, /preorder:check:operations/);
});
