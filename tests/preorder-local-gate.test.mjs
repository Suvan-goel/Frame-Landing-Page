import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PREORDER_LEGAL_PACK_VERSION,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_TERMS_VERSION,
  PREORDER_WARRANTY_DETAILS_COMPLETE,
} from "../lib/preorder.ts";
import {
  createPreorderLiveSmokeAccessToken,
  createPreorderLiveSmokeCookieValue,
  isPreorderLiveSmokeConfigured,
  isPreorderPublicLaunchConfigured,
  preorderLiveSmokeCookieHeader,
  verifyPreorderLiveSmokeAccessToken,
  verifyPreorderLiveSmokeCookieValue,
} from "../lib/preorder-live-smoke-access.ts";
import { evaluatePreorderLiveSmokeEvidence } from "../lib/preorder-live-opening-readiness.ts";

const LIVE_SMOKE_TEST_SECRET =
  "live-smoke-test-secret-that-is-distinct-and-long-enough";

test("keeps live verification private, expiring, and separate from public launch", async () => {
  assert.equal(
    isPreorderLiveSmokeConfigured({
      mode: "test",
      publicLaunchEnabled: "false",
      verifiedOrderId: "",
      secret: LIVE_SMOKE_TEST_SECRET,
    }),
    false,
  );
  assert.equal(
    isPreorderLiveSmokeConfigured({
      mode: "live",
      secret: LIVE_SMOKE_TEST_SECRET,
    }),
    false,
  );
  assert.equal(
    isPreorderLiveSmokeConfigured({
      mode: "live",
      publicLaunchEnabled: "true",
      verifiedOrderId: "",
      secret: LIVE_SMOKE_TEST_SECRET,
    }),
    false,
  );
  assert.equal(
    isPreorderLiveSmokeConfigured({
      mode: "live",
      publicLaunchEnabled: "false",
      verifiedOrderId: "",
      secret: LIVE_SMOKE_TEST_SECRET,
    }),
    true,
  );
  assert.equal(
    isPreorderLiveSmokeConfigured({
      mode: "live",
      publicLaunchEnabled: "false",
      verifiedOrderId: "123e4567-e89b-42d3-a456-426614174000",
      secret: LIVE_SMOKE_TEST_SECRET,
    }),
    false,
  );

  const token = await createPreorderLiveSmokeAccessToken(
    LIVE_SMOKE_TEST_SECRET,
  );
  assert.equal(
    await verifyPreorderLiveSmokeAccessToken(token, LIVE_SMOKE_TEST_SECRET),
    true,
  );
  assert.equal(
    await verifyPreorderLiveSmokeAccessToken(
      `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`,
      LIVE_SMOKE_TEST_SECRET,
    ),
    false,
  );

  const cookie = await createPreorderLiveSmokeCookieValue(
    LIVE_SMOKE_TEST_SECRET,
  );
  assert.equal(
    await verifyPreorderLiveSmokeCookieValue(cookie, LIVE_SMOKE_TEST_SECRET),
    true,
  );
  assert.match(
    preorderLiveSmokeCookieHeader(cookie),
    /HttpOnly; Secure; SameSite=Strict/,
  );

  assert.equal(
    isPreorderPublicLaunchConfigured({
      enabled: "true",
      verifiedOrderId: "",
    }),
    false,
  );
  assert.equal(
    isPreorderPublicLaunchConfigured({
      enabled: "true",
      verifiedOrderId: "123e4567-e89b-42d3-a456-426614174000",
    }),
    true,
  );
});

test("requires real fully refunded private live-smoke evidence before public opening", () => {
  const order = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    checkoutIntentId: "223e4567-e89b-42d3-a456-426614174000",
    environment: "live",
    paymentStatus: "refunded",
    amountTotal: 29_900,
    amountRefunded: 29_900,
    confirmationEmailSentAt: "2026-08-10T12:00:00.000Z",
  };
  const intent = {
    id: order.checkoutIntentId,
    environment: "live",
    status: "paid",
    source: "private_live_smoke",
  };

  assert.equal(evaluatePreorderLiveSmokeEvidence({ order, intent }).ready, true);
  assert.equal(
    evaluatePreorderLiveSmokeEvidence({
      order: { ...order, paymentStatus: "paid" },
      intent,
    }).ready,
    false,
  );
  assert.equal(
    evaluatePreorderLiveSmokeEvidence({
      order: { ...order, amountRefunded: 1 },
      intent,
    }).ready,
    false,
  );
  assert.equal(
    evaluatePreorderLiveSmokeEvidence({
      order,
      intent: { ...intent, source: "preorder_review" },
    }).ready,
    false,
  );
  assert.equal(
    evaluatePreorderLiveSmokeEvidence({ order: null, intent: null }).ready,
    false,
  );
});

async function render(path = "/", init, origin = "https://framewearable.com", env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("preorder-gate-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`${origin}${path}`, init ?? { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      ...env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("keeps every remote public pre-order surface unavailable until the public launch switch opens", async () => {
  assert.equal(PREORDER_TERMS_VERSION, "2026-08-12-v1");
  assert.equal(PREORDER_TERMS_VERSION, PREORDER_LEGAL_PACK_VERSION);
  assert.equal(PREORDER_PRODUCT_STATUS_VERSION, "2026-08-12-v1");
  assert.equal(PREORDER_SELLER_DETAILS_COMPLETE, true);
  assert.equal(PREORDER_WARRANTY_DETAILS_COMPLETE, true);

  const paths = [
    "/preorder",
    "/preorder/review",
    "/preorder/success",
    "/preorder/terms",
    "/preorder/refunds",
    "/preorder/product-status",
    "/preorders",
    "/api/preorders/checkout",
    "/api/preorders/status",
    "/preorder%2Freview",
    "/api%2Fpreorders%2Fstatus",
  ];

  const responses = await Promise.all(
    paths.map((path) =>
      render(path, undefined, "https://framewearable.com", {
        PREORDER_MODE: "live",
        PREORDER_LEGAL_APPROVED_VERSION: PREORDER_TERMS_VERSION,
        PREORDER_PRODUCT_STATUS_APPROVED_VERSION: PREORDER_PRODUCT_STATUS_VERSION,
        PREORDER_PUBLIC_LAUNCH_ENABLED: "false",
      }),
    ),
  );
  for (let index = 0; index < paths.length; index += 1) {
    assert.equal(responses[index].status, 404, paths[index]);
    assert.equal(responses[index].headers.get("x-robots-tag"), "noindex, nofollow");
  }
});

test("keeps signed customer order management available while new sales are closed", async () => {
  const env = {
    PREORDER_MODE: "live",
    PREORDER_LEGAL_APPROVED_VERSION: PREORDER_TERMS_VERSION,
    PREORDER_PRODUCT_STATUS_APPROVED_VERSION: PREORDER_PRODUCT_STATUS_VERSION,
    PREORDER_PUBLIC_LAUNCH_ENABLED: "false",
    PREORDER_ORDER_ACCESS_SECRET: "customer-management-test-secret-that-is-long-enough",
  };
  const page = await render("/preorder/manage", undefined, "https://framewearable.com", env);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");

  const [manageRoute, emailChangeRoute] = await Promise.all([
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/preorders/manage/email-change/route.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(manageRoute, /isPreorderSalesRequestEnabled/);
  assert.doesNotMatch(emailChangeRoute, /isPreorderSalesRequestEnabled/);
});

test("publishes pre-order administration behind owner authentication only", async () => {
  const [pageResponse, exportResponse, operationResponse] = await Promise.all([
    render("/admin/preorders"),
    render("/api/admin/preorders.csv"),
    render("/api/admin/preorders/00000000-0000-4000-8000-000000000000/refund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestKey: "00000000-0000-4000-8000-000000000000" }),
    }),
  ]);

  assert.equal(pageResponse.status, 307);
  assert.match(
    pageResponse.headers.get("location") ?? "",
    /\/signin-with-chatgpt\?return_to=%2Fadmin%2Fpreorders$/,
  );
  assert.equal(exportResponse.status, 401);
  assert.equal(operationResponse.status, 401);
});

test("keeps the funnel usable only on loopback during development", async () => {
  const environment = {
    PREORDER_MODE: "test",
    PREORDER_SHIPPING_RATE_CENTS: "0",
  };
  const [homeResponse, response, productStatusResponse, termsResponse, refundsResponse, privacyResponse] = await Promise.all([
    render("/", undefined, "http://localhost", environment),
    render("/preorder/review", undefined, "http://localhost", environment),
    render("/preorder/product-status", undefined, "http://localhost", environment),
    render("/preorder/terms", undefined, "http://localhost", environment),
    render("/preorder/refunds", undefined, "http://localhost", environment),
    render("/privacy", undefined, "http://localhost", environment),
  ]);

  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.match(home, /Pre-order now/);
  assert.match(home, /You save/);
  assert.match(home, /40(?:<!-- -->)?% off/);
  assert.match(home, /Pre-order now -\s*(?:<!-- -->)?\$299/);
  assert.match(home, /href="\/preorder\/review\?source=homepage_header"/);
  assert.match(home, /href="\/preorder\/review\?source=homepage_hero"/);
  assert.match(home, /href="\/preorder\/review\?source=homepage"/);
  assert.doesNotMatch(home, /Pre-orders are now open\./);
  assert.match(home, /See details/);
  assert.match(home, /home-preorder-hero__offer-line/);
  assert.match(home, /Pre order offer/);
  assert.match(
    home,
    /Pre-order today and save\s*(?:<!-- -->)?40\s*(?:<!-- -->)?%/,
  );
  assert.doesNotMatch(home, /home-preorder-hero__saving-note/);
  assert.match(home, /home-preorder-hero__actions/);
  assert.match(home, /hero-email-first__shipping-pill/);
  assert.match(home, /Shipping est\.\s*(?:<!-- -->)?Q1 2027/);
  assert.doesNotMatch(home, /home-preorder-hero__shipping/);
  assert.match(home, /home-preorder-price-comparison/);
  assert.match(home, /id="homepage-hero-preorder-waitlist-email"/);
  assert.match(
    home,
    /<label[^>]*class="sr-only"[^>]*>[\s\n]*Get updates[\s\n]*<\/label>/,
  );
  assert.match(home, />[\s\n]*Get updates[\s\n]*<\/button>/);
  assert.match(home, /placeholder="Enter your email"/);
  assert.ok(
    home.indexOf('id="homepage-hero-preorder-waitlist-email"') >
      home.indexOf('href="/preorder/review?source=homepage_hero"'),
  );
  assert.doesNotMatch(home, /home-preorder-saving--hero/);
  assert.match(home, /Product progress and shipping plan/);
  assert.match(home, /\$299/);
  assert.match(home, /\$499/);
  assert.match(home, /Q1 2027/);
  assert.match(home, /Cancellation &amp; Refund Policy/);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Review your Frame pre-order/);
  assert.match(html, /Product subtotal/);
  assert.match(html, /Release price/);
  assert.match(html, /Pre-order saving/);
  assert.match(html, /Total before tax/);
  assert.match(html, /Total before tax[\s\S]*?\$299/);
  assert.match(html, /\$499/);
  assert.match(html, /\$200/);
  assert.doesNotMatch(html, /\$19/);
  assert.match(html, /Standard US shipping[\s\S]*?Free/i);
  assert.match(html, /Applicable sales tax is calculated at Stripe Checkout/i);
  assert.match(html, /Preparing for launch\./);
  assert.match(html, /View product and shipping details/);
  assert.doesNotMatch(html, /Two quick confirmations/);
  assert.match(html, /Secure Stripe checkout/);
  assert.match(html, /Tax shown before payment/);
  assert.match(html, /Estimated shipping/);
  assert.match(html, /Q1 2027/);
  assert.match(html, /is not for medical decisions/);
  assert.match(html, /Continue to secure checkout/);
  assert.match(html, /Cancellation and Refund Policy/);
  assert.doesNotMatch(html, /FCC equipment authorization/i);
  assert.match(html, /rel="canonical" href="https:\/\/framewearable\.com\/preorder\/review"/);
  assert.doesNotMatch(html, /name="email"/);
  assert.doesNotMatch(html, /name="postalCode"/);
  assert.match(html, /frame-product-concept-realistic-v3-transparent/);

  assert.equal(productStatusResponse.status, 200);
  const productStatus = await productStatusResponse.text();
  assert.match(productStatus, /sensing technology has completed measurement validation/);
  assert.match(productStatus, /Complete system integration/);
  assert.match(productStatus, /Q1 2027 dispatch/);
  assert.match(productStatus, /not an FDA-authorized medical/);
  assert.match(productStatus, /production preparation are focused on(?:<!-- -->)?\s*Q1 2027/);
  assert.match(productStatus, /Product status version 2026-08-12-v1/);
  assert.match(productStatus, /August 12, 2026/);
  assert.match(productStatus, /FCC equipment authorization and delivery/);
  assert.match(productStatus, /conditional upon successful completion of the applicable FCC equipment/);
  assert.equal(termsResponse.status, 200);
  const terms = await termsResponse.text();
  assert.match(terms, /Key terms/);
  assert.match(terms, /Delivery and risk of loss/);
  assert.match(terms, /Warranty and product problems/);
  assert.match(terms, /completing final engineering and production preparation for Q1 2027 dispatch/);
  assert.match(terms, /has not received FDA marketing authorization/);
  assert.match(terms, /Legal pack version 2026-08-12-v1/);
  assert.match(terms, /FCC equipment authorization and conditional delivery/);
  assert.match(terms, /FCC rules governing conditional sales do not determine/);
  assert.match(terms, /Standard US shipping is included at no additional charge/i);
  assert.doesNotMatch(terms, /release price/i);
  assert.doesNotMatch(terms, /saving\s*(?:<!-- -->)?\$200/i);
  assert.match(terms, /Frame One-Year Limited Warranty/);
  assert.match(terms, /within 30 calendar days after receiving the device/);
  assert.match(terms, /specific legal rights/);

  assert.equal(refundsResponse.status, 200);
  const refunds = await refundsResponse.text();
  assert.match(refunds, /Legal pack version 2026-08-12-v1/);
  assert.match(refunds, /If FCC equipment authorization is not completed/);
  assert.match(refunds, /automatically cancel the unshipped pre-order/);
  assert.match(refunds, /Standard US shipping is free/i);
  assert.match(refunds, /Key rights/);
  assert.match(refunds, /Shipping or product changes/);
  assert.match(refunds, /Material product changes/);
  assert.match(refunds, /Frame One-Year Limited/);
  assert.match(refunds, /rel="canonical" href="https:\/\/framewearable\.com\/preorder\/refunds"/);

  assert.equal(privacyResponse.status, 200);
  const privacy = await privacyResponse.text();
  assert.match(privacy, /Device pre-orders/);
  assert.match(privacy, /aria-label="Back"/);
  assert.match(privacy, /preorder-terms-return/);
  assert.match(privacy, />Exit<\/a>/);
});

test("keeps the public homepage free of pre-order discovery and blocks webhook browsing", async () => {
  const [
    homeResponse,
    interestResponse,
    privacyResponse,
    unsubscribeResponse,
    webhookResponse,
    webhookPostResponse,
    worker,
    robots,
    metaPixel,
    environmentExample,
    preorderAccess,
    liveSmokeAccess,
    checkoutRoute,
    salesControlsRoute,
    liveOpeningReadiness,
    liveSmokeLinkScript,
  ] = await Promise.all([
      render("/"),
      render("/interest"),
      render("/privacy"),
      render("/unsubscribe"),
      render("/api/stripe/webhook"),
      render("/api/stripe/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/components/meta-pixel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../lib/preorder-access.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/preorder-live-smoke-access.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/preorders/checkout/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/preorders/controls/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/preorder-live-opening-readiness.server.ts", import.meta.url), "utf8"),
      readFile(new URL("../scripts/create-preorder-live-smoke-link.mjs", import.meta.url), "utf8"),
    ]);

  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.doesNotMatch(home, /href=["']\/preorder/i);
  assert.doesNotMatch(home, /Product concept\. Final design in development\./);
  assert.doesNotMatch(home, /Product concept · final design in development/);
  assert.match(home, /Wearable ultrasound, supported by clinical research\./);
  assert.match(home, /Frame is under development and is not currently available for sale\./);
  assert.match(home, /Frame is developing a non-invasive upper-arm ultrasound wearable/);
  assert.doesNotMatch(home, /Evidence-driven by design\./);
  assert.doesNotMatch(home, /Frame is a general-wellness wearable in development\./);

  assert.equal(interestResponse.status, 404);

  assert.equal(privacyResponse.status, 200);
  assert.match(
    await privacyResponse.text(),
    /Frame is under development and is not intended to diagnose or treat/,
  );

  assert.equal(unsubscribeResponse.status, 200);
  const unsubscribe = await unsubscribeResponse.text();
  assert.match(unsubscribe, /Stop Frame development updates\?/);
  assert.match(unsubscribe, /future development and product-update emails/);
  assert.doesNotMatch(unsubscribe, /Stop Frame updates\?/);
  assert.equal(webhookResponse.status, 404);
  assert.equal(webhookPostResponse.status, 400);
  assert.match(await webhookPostResponse.text(), /Stripe signature is required/i);
  assert.match(
    worker,
    /isPublicPreorderRequest &&[\s\S]*?!isPreorderCustomerServiceRequest &&[\s\S]*?!preorderRequestAllowed/,
  );
  assert.match(worker, /x-frame-preorder-admin-request/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.match(robots, /"\/preorder"/);
  assert.match(robots, /"\/preorders"/);
  assert.match(metaPixel, /PRIVATE_ADDITIONAL_PREFIXES = \["\/preorder", "\/preorders"\]/);
  assert.match(environmentExample, /^PREORDER_MODE=off$/m);
  assert.match(environmentExample, /^PREORDER_LEGAL_APPROVED_VERSION=$/m);
  assert.match(environmentExample, /^PREORDER_PRODUCT_STATUS_APPROVED_VERSION=$/m);
  assert.match(environmentExample, /^PREORDER_MAINTENANCE_SECRET=/m);
  assert.match(environmentExample, /^PREORDER_PUBLIC_LAUNCH_ENABLED=false$/m);
  assert.match(environmentExample, /^PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID=$/m);
  assert.match(environmentExample, /^PREORDER_ALLOW_BANK_PENDING_LAUNCH=false$/m);
  assert.match(environmentExample, /^PREORDER_LIVE_SMOKE_ACCESS_SECRET=/m);
  assert.match(preorderAccess, /PREORDER_PRODUCT_STATUS_VERSION/);
  assert.match(preorderAccess, /approvedProductStatusVersion === PREORDER_PRODUCT_STATUS_VERSION/);
  assert.match(preorderAccess, /PREORDER_WARRANTY_DETAILS_COMPLETE/);
  assert.match(preorderAccess, /isPreorderPublicLaunchConfigured/);
  assert.match(worker, /x-frame-preorder-live-smoke-request/);
  assert.match(worker, /verifyPreorderLiveSmokeAccessToken/);
  assert.match(liveSmokeAccess, /SameSite=Strict/);
  assert.match(liveSmokeAccess, /ACCESS_TOKEN_TTL_SECONDS = 15 \* 60/);
  assert.match(checkoutRoute, /source: liveSmokeRequest[\s\S]+private_live_smoke/);
  assert.match(checkoutRoute, /verification_mode: "live_smoke"/);
  assert.match(salesControlsRoute, /unitLimit !== 1/);
  assert.match(salesControlsRoute, /Public launch remains locked/);
  assert.match(salesControlsRoute, /evaluatePreorderLiveOpeningReadiness/);
  assert.match(liveOpeningReadiness, /verifyPreorderLiveSmokeOrder/);
  assert.match(liveOpeningReadiness, /runPreorderOperationsHealth/);
  assert.match(liveOpeningReadiness, /runPreorderPaymentReconciliation/);
  assert.match(liveSmokeLinkScript, /origin\.origin !== SITE_URL/);
});
