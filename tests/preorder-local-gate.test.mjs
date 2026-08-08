import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_TERMS_VERSION,
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
  assert.equal(PREORDER_SELLER_DETAILS_COMPLETE, false);

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
    PREORDER_SHIPPING_RATE_CENTS: "1900",
  };
  const [response, productStatusResponse, privacyResponse] = await Promise.all([
    render("/preorder/review", undefined, "http://localhost", environment),
    render("/preorder/product-status", undefined, "http://localhost", environment),
    render("/privacy", undefined, "http://localhost", environment),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Review your Frame pre-order/);
  assert.match(html, /Product subtotal/);
  assert.match(html, /Estimated total/);
  assert.match(html, /\$318/);
  assert.match(html, /\$19/);
  assert.match(html, /standard US shipping/i);
  assert.match(html, /all 50 states and Washington, DC/);
  assert.match(html, /Estimated shipping/);
  assert.match(html, /March 2027/);
  assert.match(html, /not currently FDA cleared or approved/);
  assert.match(html, /Continue to Secure Checkout/);
  assert.match(html, /frame-product-concept-realistic-v3-transparent/);

  assert.equal(productStatusResponse.status, 200);
  const productStatus = await productStatusResponse.text();
  assert.match(productStatus, /Performance has not been established/);
  assert.match(productStatus, /not currently FDA cleared or approved/);

  assert.equal(privacyResponse.status, 200);
  assert.match(await privacyResponse.text(), /Device pre-orders/);
});

test("keeps the public homepage free of pre-order discovery and blocks webhook browsing", async () => {
  const [homeResponse, webhookResponse, worker, robots, metaPixel, environmentExample] =
    await Promise.all([
      render("/"),
      render("/api/stripe/webhook"),
      readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/components/meta-pixel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
    ]);

  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.doesNotMatch(home, /href=["']\/preorder/i);
  assert.equal(webhookResponse.status, 404);
  assert.match(worker, /isPublicPreorderRequest && !preorderRequestAllowed/);
  assert.match(worker, /x-frame-preorder-admin-request/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.match(robots, /"\/preorder"/);
  assert.match(robots, /"\/preorders"/);
  assert.match(metaPixel, /PRIVATE_ADDITIONAL_PREFIXES = \["\/preorder", "\/preorders"\]/);
  assert.match(environmentExample, /^PREORDER_MODE=off$/m);
  assert.match(environmentExample, /^PREORDER_LEGAL_APPROVED_VERSION=$/m);
});
