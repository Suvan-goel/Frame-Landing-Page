import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREORDER_TERMS_VERSION } from "../lib/preorder.ts";

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

test("keeps every remote pre-order surface unavailable while legal versions are draft", async () => {
  assert.match(PREORDER_TERMS_VERSION, /^draft-/);

  const paths = [
    "/preorder",
    "/preorder/review",
    "/preorder/success",
    "/preorder/manage",
    "/preorder/terms",
    "/preorder/refunds",
    "/preorders",
    "/admin/preorders",
    "/api/preorders/checkout",
    "/api/preorders/status",
    "/api/preorders/manage",
    "/api/admin/preorders/order-id/refund",
    "/api/admin/preorders.csv",
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

test("keeps the funnel usable only on loopback during development", async () => {
  const response = await render(
    "/preorder/review",
    undefined,
    "http://localhost",
    { PREORDER_MODE: "test" },
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Review your Frame pre-order/);
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
  assert.match(worker, /isPreorderRequest && !preorderRequestAllowed/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.match(robots, /"\/preorder"/);
  assert.match(robots, /"\/preorders"/);
  assert.match(metaPixel, /PRIVATE_ADDITIONAL_PREFIXES = \["\/preorder", "\/preorders"\]/);
  assert.match(environmentExample, /^PREORDER_MODE=off$/m);
  assert.match(environmentExample, /^PREORDER_LEGAL_APPROVED_VERSION=$/m);
});
