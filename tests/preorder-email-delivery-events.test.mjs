import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizedResendEventTimestamp,
  preorderEmailStatusForResendEvent,
} from "../lib/preorder-email-delivery-events.ts";
import { verifyResendWebhook } from "../lib/resend-webhook-signature.ts";

test("maps every subscribed adverse and successful Resend outcome", () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        "email.sent",
        "email.delivered",
        "email.delivery_delayed",
        "email.failed",
        "email.bounced",
        "email.complained",
        "email.suppressed",
      ].map((event) => [event, preorderEmailStatusForResendEvent(event)]),
    ),
    {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "delayed",
      "email.failed": "failed",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.suppressed": "suppressed",
    },
  );
  assert.equal(preorderEmailStatusForResendEvent("email.opened"), null);
});

test("normalizes provider event time and safely falls back for invalid payload time", () => {
  assert.equal(
    normalizedResendEventTimestamp(
      "2026-08-10T10:11:12.123+00:00",
      "2026-08-10T12:00:00.000Z",
    ),
    "2026-08-10T10:11:12.123Z",
  );
  assert.equal(
    normalizedResendEventTimestamp(
      "not-a-date",
      "2026-08-10T12:00:00.000Z",
    ),
    "2026-08-10T12:00:00.000Z",
  );
});

test("accepts a signed delivered payload before mapping its provider outcome", async () => {
  const key = Buffer.from("frame-preorder-webhook-test-key");
  const secret = `whsec_${key.toString("base64")}`;
  const svixId = "msg_preorder_delivered";
  const svixTimestamp = String(Math.floor(Date.now() / 1_000));
  const event = {
    type: "email.delivered",
    created_at: "2026-08-10T11:00:00.000Z",
    data: { email_id: "mail_preorder_123", to: ["customer@example.test"] },
  };
  const payload = JSON.stringify(event);
  const signature = createHmac("sha256", key)
    .update(`${svixId}.${svixTimestamp}.${payload}`)
    .digest("base64");

  assert.equal(
    await verifyResendWebhook({
      payload,
      secret,
      svixId,
      svixTimestamp,
      svixSignature: `v1,${signature}`,
    }),
    true,
  );
  assert.equal(preorderEmailStatusForResendEvent(event.type), "delivered");
});

test("migration applies provider events atomically and resists out-of-order downgrades", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260810120000_track_preorder_email_delivery_outcomes.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /provider_tracking_expected boolean not null default false/);
  assert.match(migration, /apply_preorder_email_provider_event/);
  assert.match(migration, /last_event_at is null or last_event_at <= p_event_at/);
  assert.match(
    migration,
    /status in \('failed', 'bounced', 'complained', 'suppressed'\)/,
  );
  assert.match(migration, /v_status in \('sent', 'delayed', 'delivered'\)/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
  assert.match(migration, /preorder_email_deliveries_provider_message_idx/);
});

test("verified webhook processing updates pre-orders and send races are replayed", async () => {
  const [processor, adminWebhook, sender, route] = await Promise.all([
    readFile(
      new URL("../lib/preorder-email-delivery-events.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/admin-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resend/webhook/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /verifyResendWebhook/);
  assert.match(route, /processResendWebhookEvent/);
  assert.match(adminWebhook, /applyPreorderEmailProviderEvent/);
  assert.match(processor, /apply_preorder_email_provider_event/);
  assert.match(processor, /email_webhook_events/);
  assert.match(sender, /provider_tracking_expected: true/);
  assert.match(sender, /last_event: "email.sent"/);
  assert.match(sender, /replayStoredPreorderEmailProviderEvents/);
});
