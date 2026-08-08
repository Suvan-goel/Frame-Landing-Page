import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  renderFrameCampaignEmail,
  validateEmailCampaignContent,
} from "../lib/admin-email.ts";
import { verifyResendWebhook } from "../lib/resend-webhook-signature.ts";

const validContent = {
  subject: "An update for {{first_name}}",
  previewText: "What’s new at Frame",
  body: "Hi {{first_name}},\n\nHere is our latest update.",
  ctaLabel: "Read more",
  ctaUrl: "https://framewearable.com/updates",
};

test("validates mailing-list content before delivery", () => {
  assert.equal(validateEmailCampaignContent(validContent).ok, true);
  assert.deepEqual(validateEmailCampaignContent({ ...validContent, subject: "" }), {
    ok: false,
    error: "Add a subject line.",
  });
  assert.deepEqual(
    validateEmailCampaignContent({ ...validContent, ctaUrl: "javascript:alert(1)" }),
    { ok: false, error: "Enter a valid http or https button link." },
  );
  assert.deepEqual(
    validateEmailCampaignContent({ ...validContent, ctaLabel: "", ctaUrl: validContent.ctaUrl }),
    {
      ok: false,
      error: "Add both a button label and destination, or leave both blank.",
    },
  );
});

test("renders the exact personalised preview safely with unsubscribe controls", () => {
  const rendered = renderFrameCampaignEmail({
    content: {
      ...validContent,
      body: "Hi {{first_name}},\n\n<script>alert('no')</script>",
    },
    firstName: "Ada",
    unsubscribeUrl: "https://framewearable.com/unsubscribe?token=example",
    siteUrl: "https://framewearable.com",
    postalAddress: "Frame, 123 Example Street, London, EC1A 1AA, United Kingdom",
  });

  assert.equal(rendered.subject, "An update for Ada");
  assert.match(rendered.html, /Hi Ada/);
  assert.match(rendered.html, /&lt;script&gt;alert\(&#039;no&#039;\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, />Unsubscribe</);
  assert.match(rendered.text, /Unsubscribe: https:\/\/framewearable\.com/);
  assert.match(rendered.html, /123 Example Street/);
});

test("renders administrator tests without a subscriber unsubscribe action", () => {
  const rendered = renderFrameCampaignEmail({
    content: validContent,
    firstName: "there",
    unsubscribeUrl: "",
    siteUrl: "https://framewearable.com",
    postalAddress: "Postal address not configured — test email only",
    testMode: true,
  });
  assert.match(rendered.html, /test email sent only to the Frame administrator/i);
  assert.doesNotMatch(rendered.html, />Unsubscribe</);
});

test("requires a server review and typed confirmation before any subscriber send", async () => {
  const [api, review, auth, sender, composer, styles, provider, webhookSetup, unsubscribe, migration, hardening] = await Promise.all([
    readFile(new URL("../app/api/admin/email/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/email/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-email-api.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/admin-email-composer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/resend-mailing.server.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/admin/email/webhook-protection/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/unsubscribe/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260808000000_add_waitlist_email_campaigns.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260808130000_harden_waitlist_email_operations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(auth, /getChatGPTUser\(\)/);
  assert.match(auth, /isWaitlistAdmin\(user\.email\)/);
  assert.match(auth, /origin === new URL\(request\.url\)\.origin/);
  assert.match(api, /confirmationId/);
  assert.match(api, /confirmationText/);
  assert.match(review, /createEmailSendConfirmation/);
  assert.match(sender, /email_send_confirmations/);
  assert.match(sender, /used_at/);
  assert.match(sender, /`SEND \$\{input\.recipientIds\.length\}`/);
  assert.doesNotMatch(composer, /window\.confirm/);
  assert.match(composer, /Send test to me/);
  assert.match(styles, /\.admin-email-send-panel \.button--light[^{]*\{[^}]*color: var\(--ink\) !important;[^}]*-webkit-text-fill-color: var\(--ink\);/s);
  assert.match(styles, /\.email-send-actions__test[^{]*\{[^}]*color: var\(--ink\) !important;[^}]*-webkit-text-fill-color: var\(--ink\);/s);
  assert.match(composer, /Type <strong>\{review\.confirmationText\}/);
  assert.match(composer, /renderFrameCampaignEmail/);
  assert.match(sender, /!row\.email_unsubscribed_at/);
  assert.match(sender, /!row\.email_delivery_suppressed_at/);
  assert.match(sender, /categorizeVisibleSignups\(eligibleRows\)/);
  assert.match(sender, /to: \[input\.recipient\.email\]/);
  assert.match(provider, /RESEND_BATCH_SIZE = 100/);
  assert.match(provider, /"Idempotency-Key": idempotencyKey/);
  assert.doesNotMatch(provider, /api\.resend\.com\/webhooks/);
  assert.match(webhookSetup, /RESEND_SIGNING_SECRET_PATTERN/);
  assert.match(webhookSetup, /configureResendWebhookProtection/);
  assert.doesNotMatch(webhookSetup, /error instanceof Error \? error\.message/);
  assert.match(composer, /Save signing secret/);
  assert.match(composer, /Use <strong>Send test to me<\/strong> below/);
  assert.match(composer, /Check connection/);
  assert.match(sender, /webhookVerified: Boolean/);
  assert.match(sender, /verifiedAt/);
  assert.match(sender, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(unsubscribe, /email_unsubscribed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /unique \(campaign_id, recipient_email\)/);
  assert.match(hardening, /email_campaign_drafts/);
  assert.match(hardening, /email_send_confirmations/);
  assert.match(hardening, /email_webhook_events/);
  assert.match(hardening, /email_delivery_suppressed_at/);
});

test("makes campaign failures inspectable and retries only failed recipients", async () => {
  const [composer, detail, retry, webhook] = await Promise.all([
    readFile(new URL("../app/components/admin-email-composer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/email/campaigns/[campaignId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/email/campaigns/[campaignId]/retry/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resend/webhook/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(composer, /View details/);
  assert.match(composer, /RETRY/);
  assert.match(detail, /getEmailCampaignDetail/);
  assert.match(retry, /retryFailedEmailCampaign/);
  assert.match(webhook, /verifyResendWebhook/);
  assert.match(webhook, /processResendWebhookEvent/);
});

test("rejects forged delivery webhooks and accepts the signed raw payload", async () => {
  const key = Buffer.from("frame-test-webhook-secret-32-bytes");
  const secret = `whsec_${key.toString("base64")}`;
  const svixId = "msg_test_event";
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({ type: "email.bounced", data: { email_id: "mail_123" } });
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
  assert.equal(
    await verifyResendWebhook({
      payload: `${payload} `,
      secret,
      svixId,
      svixTimestamp,
      svixSignature: `v1,${signature}`,
    }),
    false,
  );
});
