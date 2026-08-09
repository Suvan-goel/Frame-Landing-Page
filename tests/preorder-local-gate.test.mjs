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

test("keeps every remote public pre-order surface unavailable while legal versions are draft", async () => {
  assert.match(PREORDER_TERMS_VERSION, /^draft-/);
  assert.equal(PREORDER_TERMS_VERSION, PREORDER_LEGAL_PACK_VERSION);
  assert.match(PREORDER_PRODUCT_STATUS_VERSION, /^draft-/);
  assert.equal(PREORDER_SELLER_DETAILS_COMPLETE, false);
  assert.equal(PREORDER_WARRANTY_DETAILS_COMPLETE, true);

  const paths = [
    "/preorder",
    "/preorder/review",
    "/preorder/success",
    "/preorder/manage",
    "/preorder/terms",
    "/preorder/refunds",
    "/preorder/product-status",
    "/preorders",
    "/api/preorders/checkout",
    "/api/preorders/status",
    "/api/preorders/manage",
    "/preorder%2Freview",
    "/api%2Fpreorders%2Fstatus",
  ];

  const responses = await Promise.all(
    paths.map((path) =>
      render(path, undefined, "https://framewearable.com", {
        PREORDER_MODE: "live",
        PREORDER_LEGAL_APPROVED_VERSION: PREORDER_TERMS_VERSION,
        PREORDER_PRODUCT_STATUS_APPROVED_VERSION: PREORDER_PRODUCT_STATUS_VERSION,
      }),
    ),
  );
  for (let index = 0; index < paths.length; index += 1) {
    assert.equal(responses[index].status, 404, paths[index]);
    assert.equal(responses[index].headers.get("x-robots-tag"), "noindex, nofollow");
  }
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
  assert.match(home, /\$299(?:<!-- -->)?\s*\+ applicable sales tax/);
  assert.match(home, /Free standard US shipping/i);
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
  assert.match(home, /Product development status/);
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
  assert.match(html, /all 50 states and Washington, DC/);
  assert.match(html, /Estimated shipping/);
  assert.match(html, /Q1 2027/);
  assert.match(html, /has not received FDA marketing authorization/);
  assert.match(html, /Continue to secure checkout/);
  assert.match(html, /Cancellation and Refund Policy/);
  assert.match(html, /rel="canonical" href="https:\/\/framewearable\.com\/preorder\/review"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="postalCode"/);
  assert.match(html, /frame-product-concept-realistic-v3-transparent/);

  assert.equal(productStatusResponse.status, 200);
  const productStatus = await productStatusResponse.text();
  assert.match(productStatus, /Performance has not been established/);
  assert.match(productStatus, /has not received FDA marketing/);
  assert.match(productStatus, /You pay in full at checkout/);
  assert.match(productStatus, /Last updated August 9, 2026/);
  assert.match(productStatus, /plus applicable sales tax, with free standard US shipping/i);

  assert.equal(termsResponse.status, 200);
  const terms = await termsResponse.text();
  assert.match(terms, /Your pre-order at a glance/);
  assert.match(terms, /Delivery and risk of loss/);
  assert.match(terms, /Warranty and product problems/);
  assert.match(terms, /has not received FDA marketing authorization/);
  assert.match(terms, /Legal pack version draft-2026-08-09-v7/);
  assert.match(terms, /Standard US shipping is included at no additional charge/i);
  assert.match(terms, /\$499\s*(?:<!-- -->)? release price/);
  assert.match(terms, /saving\s*(?:<!-- -->)?\$200/);
  assert.match(terms, /Frame One-Year Limited Warranty/);

  assert.equal(refundsResponse.status, 200);
  const refunds = await refundsResponse.text();
  assert.match(refunds, /Legal pack version draft-2026-08-09-v7/);
  assert.match(refunds, /Standard US shipping is free/i);
  assert.match(refunds, /Policy at a glance/);
  assert.match(refunds, /Material product changes/);
  assert.match(refunds, /Frame One-Year Limited/);
  assert.match(refunds, /rel="canonical" href="https:\/\/framewearable\.com\/preorder\/refunds"/);

  assert.equal(privacyResponse.status, 200);
  assert.match(await privacyResponse.text(), /Device pre-orders/);
});

test("keeps the public homepage free of pre-order discovery and blocks webhook browsing", async () => {
  const [
    homeResponse,
    webhookResponse,
    webhookPostResponse,
    worker,
    robots,
    metaPixel,
    environmentExample,
    preorderAccess,
  ] = await Promise.all([
      render("/"),
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
    ]);

  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.doesNotMatch(home, /href=["']\/preorder/i);
  assert.equal(webhookResponse.status, 404);
  assert.equal(webhookPostResponse.status, 400);
  assert.match(await webhookPostResponse.text(), /Stripe signature is required/i);
  assert.match(worker, /isPublicPreorderRequest && !preorderRequestAllowed/);
  assert.match(worker, /x-frame-preorder-admin-request/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.match(robots, /"\/preorder"/);
  assert.match(robots, /"\/preorders"/);
  assert.match(metaPixel, /PRIVATE_ADDITIONAL_PREFIXES = \["\/preorder", "\/preorders"\]/);
  assert.match(environmentExample, /^PREORDER_MODE=off$/m);
  assert.match(environmentExample, /^PREORDER_LEGAL_APPROVED_VERSION=$/m);
  assert.match(environmentExample, /^PREORDER_PRODUCT_STATUS_APPROVED_VERSION=$/m);
  assert.match(environmentExample, /^PREORDER_MAINTENANCE_SECRET=/m);
  assert.match(preorderAccess, /PREORDER_PRODUCT_STATUS_VERSION/);
  assert.match(preorderAccess, /approvedProductStatusVersion === PREORDER_PRODUCT_STATUS_VERSION/);
  assert.match(preorderAccess, /PREORDER_WARRANTY_DETAILS_COMPLETE/);
});
