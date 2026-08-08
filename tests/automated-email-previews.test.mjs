import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the live automated email renderers for previews and delivery", async () => {
  const [preorderSource, contributorSource, catalogSource] = await Promise.all([
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/contributor-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automated-email-previews.server.ts", import.meta.url), "utf8"),
  ]);

  for (const renderer of [
    "renderPreorderConfirmationEmail",
    "renderPreorderShippingEmail",
    "renderPreorderOwnerActionEmail",
    "renderPreorderAddressChangeResolutionEmail",
    "renderPreorderDeliveryUpdateEmail",
    "renderPreorderRefundUpdateEmail",
  ]) {
    assert.match(preorderSource, new RegExp(`export function ${renderer}`));
    assert.match(preorderSource, new RegExp(`\\.\\.\\.${renderer}\\(input\\)`));
    assert.match(catalogSource, new RegExp(`${renderer}\\(`));
  }

  assert.match(contributorSource, /export function renderContributorWelcomeEmail/);
  assert.match(contributorSource, /const email = renderContributorWelcomeEmail\(input\)/);
  assert.match(catalogSource, /renderContributorWelcomeEmail\(/);
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
