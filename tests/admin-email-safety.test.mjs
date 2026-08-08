import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  renderFrameCampaignEmail,
  validateEmailCampaignContent,
} from "../lib/admin-email.ts";

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
  });

  assert.equal(rendered.subject, "An update for Ada");
  assert.match(rendered.html, /Hi Ada/);
  assert.match(rendered.html, /&lt;script&gt;alert\(&#039;no&#039;\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, />Unsubscribe</);
  assert.match(rendered.text, /Unsubscribe: https:\/\/framewearable\.com/);
});

test("keeps bulk sends owner-only, individually addressed, suppressible, and idempotent", async () => {
  const [api, sender, composer, unsubscribe, migration] = await Promise.all([
    readFile(new URL("../app/api/admin/email/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/admin-email-composer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/unsubscribe/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260808000000_add_waitlist_email_campaigns.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(api, /getChatGPTUser\(\)/);
  assert.match(api, /isWaitlistAdmin\(user\.email\)/);
  assert.match(api, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(composer, /window\.confirm/);
  assert.match(composer, /renderFrameCampaignEmail/);
  assert.match(sender, /!row\.email_unsubscribed_at/);
  assert.match(sender, /categorizeVisibleSignups\(subscribedRows\)/);
  assert.match(sender, /qualificationStatus,/);
  assert.match(sender, /to: \[recipient\.email\]/);
  assert.match(sender, /RESEND_BATCH_SIZE = 100/);
  assert.match(sender, /"Idempotency-Key": `\$\{campaignId\}-\$\{batchIndex\}`/);
  assert.match(sender, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(unsubscribe, /email_unsubscribed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /unique \(campaign_id, recipient_email\)/);
});
