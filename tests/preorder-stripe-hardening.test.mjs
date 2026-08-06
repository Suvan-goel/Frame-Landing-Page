import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isStripeWebhookRecoveryEligible,
  STRIPE_WEBHOOK_STALE_AFTER_SECONDS,
} from "../lib/stripe-webhook-recovery.ts";

test("keeps webhook verification and paid fulfilment independent from the sales switch", async () => {
  const [stripeServer, payments, worker] = await Promise.all([
    readFile(new URL("../lib/stripe.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-payments.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(stripeServer, /\["live", "test", null\]/);
  assert.doesNotMatch(payments, /getPreorderMode|Pre-order fulfilment is disabled/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.doesNotMatch(
    worker,
    /isSharedStripeWebhook && !preorderRequestAllowed/,
  );
});

test("queues signed events after a durable claim and tracks modern refund events", async () => {
  const [webhook, processing, readiness] = await Promise.all([
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/stripe-webhook-processing.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(webhook, /beginStripeWebhookEvent/);
  assert.match(webhook, /executionContext\.waitUntil\(processingTask\)/);
  assert.match(webhook, /status: 202/);
  assert.match(processing, /case "refund\.created"/);
  assert.match(processing, /case "refund\.updated"/);
  assert.match(processing, /stripe\.charges\.retrieve/);
  assert.match(readiness, /"refund\.created"/);
  assert.match(readiness, /"refund\.updated"/);
});

test("makes failed and stale background events recoverable", () => {
  const now = Date.parse("2026-08-06T12:00:00.000Z");
  const staleAt = new Date(
    now - STRIPE_WEBHOOK_STALE_AFTER_SECONDS * 1_000 - 1,
  ).toISOString();
  const freshAt = new Date(now - 1_000).toISOString();

  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "failed", lastAttemptedAt: freshAt, now }),
    true,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processing", lastAttemptedAt: staleAt, now }),
    true,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processing", lastAttemptedAt: freshAt, now }),
    false,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processed", lastAttemptedAt: staleAt, now }),
    false,
  );
});
