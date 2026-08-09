import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses isolated preview renderers without changing live email delivery", async () => {
  const [preorderSource, previewRendererSource, contributorSource, catalogSource] = await Promise.all([
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-email-preview-renderers.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/contributor-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automated-email-previews.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(preorderSource, /export function renderPreorderConfirmationEmail/);
  assert.match(preorderSource, /const email = renderPreorderConfirmationEmail\(input\)/);
  assert.match(catalogSource, /renderPreorderConfirmationEmail\(/);

  for (const renderer of [
    "renderPreorderShippingEmail",
    "renderPreorderOwnerActionEmail",
    "renderPreorderAddressChangeResolutionEmail",
    "renderPreorderDeliveryUpdateEmail",
    "renderPreorderRefundUpdateEmail",
  ]) {
    assert.match(previewRendererSource, new RegExp(`export function ${renderer}`));
    assert.match(catalogSource, new RegExp(`${renderer}\\(`));
  }

  assert.match(contributorSource, /export function renderContributorWelcomeEmail/);
  assert.match(contributorSource, /const email = renderContributorWelcomeEmail\(input\)/);
  assert.match(catalogSource, /renderContributorWelcomeEmail\(/);
});

test("routes automated customer replies to the monitored support inbox", async () => {
  const [preorderSource, contributorSource, catalogSource, environmentExample] = await Promise.all([
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/contributor-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automated-email-previews.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(preorderSource, /reply_to: SUPPORT_EMAIL/);
  assert.match(contributorSource, /reply_to: SUPPORT_EMAIL/);
  assert.match(catalogSource, /replyTo: SUPPORT_EMAIL/);
  assert.match(catalogSource, /reply_to: SUPPORT_EMAIL/);
  assert.match(environmentExample, /^PREORDER_OPERATIONS_EMAIL=support@framewearable\.com$/m);
});

test("keeps automated email previews and test sending owner-only", async () => {
  const [pageSource, routeSource, componentSource, navigationSource] = await Promise.all([
    readFile(new URL("../app/admin/automated-emails/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/automated-emails/test/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/admin-automated-email-previews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/admin-dashboard-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /requireChatGPTUser\("\/admin\/automated-emails"\)/);
  assert.match(pageSource, /isWaitlistAdmin\(user\.email\)/);
  assert.match(routeSource, /requireEmailAdmin\(request\)/);
  assert.match(routeSource, /recipient: authorization\.user\.email/);
  assert.doesNotMatch(routeSource, /recipient: payload\./);
  assert.match(componentSource, /No customer event or delivery record is created/);
  assert.match(navigationSource, /label: "Campaigns"/);
  assert.match(navigationSource, /label: "Automated emails"/);
});

test("catalogues every current customer lifecycle email state", async () => {
  const catalog = await readFile(
    new URL("../lib/automated-email-previews.ts", import.meta.url),
    "utf8",
  );
  for (const id of [
    "preorder-confirmation",
    "preorder-shipped",
    "owner-action-required",
    "address-change-approved",
    "address-change-declined",
    "delivery-estimate-updated",
    "refund-started",
    "refund-completed",
    "contributor-welcome",
  ]) {
    assert.match(catalog, new RegExp(`"${id}"`));
  }
});

test("keeps customer email links on the public Frame domain", async () => {
  const [previewRendererSource, catalogSource] = await Promise.all([
    readFile(new URL("../lib/preorder-email-preview-renderers.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automated-email-previews.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(previewRendererSource, /import \{ SITE_URL \} from "\.\/site"/);
  assert.match(previewRendererSource, /`\$\{SITE_URL\}\$\{input\.managePath\}`/);
  assert.match(catalogSource, /origin = "https:\/\/framewearable\.com"/);
});
