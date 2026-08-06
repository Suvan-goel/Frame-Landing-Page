import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { PREORDER_TERMS_VERSION } from "../lib/preorder.ts";

const target = process.argv.includes("--launch")
  ? "launch"
  : process.argv.includes("--staging")
    ? "staging"
    : "local";

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

const checks = [];
function record(status, name, detail) {
  checks.push({ status, name, detail });
}
function pass(name, detail) {
  record("pass", name, detail);
}
function warn(name, detail) {
  record("warn", name, detail);
}
function fail(name, detail) {
  record("fail", name, detail);
}

function configured(name, minimumLength = 1) {
  return Boolean(process.env[name] && process.env[name].length >= minimumLength);
}

const mode = process.env.PREORDER_MODE ?? "off";
const targetEnvironment = target === "launch" ? "live" : "test";
const secretKey =
  process.env[
    targetEnvironment === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_TEST_SECRET_KEY"
  ] ?? process.env.STRIPE_SECRET_KEY ?? "";
const priceId =
  process.env[
    targetEnvironment === "live"
      ? "STRIPE_LIVE_PREORDER_PRICE_ID"
      : "STRIPE_TEST_PREORDER_PRICE_ID"
  ] ?? process.env.STRIPE_PREORDER_PRICE_ID ?? "";
const webhookSecret =
  process.env[
    targetEnvironment === "live"
      ? "STRIPE_LIVE_WEBHOOK_SECRET"
      : "STRIPE_TEST_WEBHOOK_SECRET"
  ] ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
const webhookEndpointId =
  process.env[
    targetEnvironment === "live"
      ? "STRIPE_LIVE_WEBHOOK_ENDPOINT_ID"
      : "STRIPE_TEST_WEBHOOK_ENDPOINT_ID"
  ] ?? "";
const expectedPrice = Number(process.env.PREORDER_PRICE_CENTS ?? "29900");
const expectedCurrency = (process.env.PREORDER_CURRENCY ?? "usd").toLowerCase();
const allowedCountries = (process.env.PREORDER_ALLOWED_COUNTRIES ?? "US")
  .split(",")
  .map((country) => country.trim().toUpperCase())
  .filter(Boolean);
const estimatedDelivery =
  process.env.PREORDER_ESTIMATED_DELIVERY ?? "January 1, 2027";

if (target === "launch") {
  if (mode === "live") {
    pass("Runtime mode", "Live mode is configured; the allocation must remain paused until cutover.");
  } else {
    fail("Runtime mode", `Expected live mode, found ${mode}.`);
  }
  if (/^(?:sk|rk)_live_/.test(secretKey)) {
    pass("Stripe environment", "A live Stripe secret key is configured.");
  } else {
    fail("Stripe environment", "A live Stripe secret key is required.");
  }
} else {
  if (mode === "test") {
    pass("Runtime mode", "Stripe test mode is active.");
  } else {
    fail("Runtime mode", `Expected test mode, found ${mode}.`);
  }
  if (/^(?:sk|rk)_test_/.test(secretKey)) {
    pass("Stripe environment", "A Stripe test key is configured.");
  } else {
    fail("Stripe environment", "A Stripe test key is required.");
  }
}

if (webhookSecret.startsWith("whsec_") && webhookSecret.length >= 24) {
  pass("Webhook signing", "A Stripe webhook signing secret is configured.");
} else {
  fail("Webhook signing", "Add STRIPE_WEBHOOK_SECRET before testing signed events.");
}
if (target === "launch") {
  if (webhookEndpointId.startsWith("we_")) {
    pass("Webhook endpoint reference", "The live Stripe endpoint reference is configured.");
  } else {
    fail("Webhook endpoint reference", "STRIPE_LIVE_WEBHOOK_ENDPOINT_ID is required.");
  }
}

for (const [name, label] of [
  ["PREORDER_ORDER_ACCESS_SECRET", "Order-management signing"],
  ["PREORDER_RATE_LIMIT_SECRET", "Endpoint-protection signing"],
]) {
  if (configured(name, 32)) {
    pass(label, "A dedicated secret is configured.");
  } else if (target === "launch") {
    fail(label, `Add a dedicated ${name} value of at least 32 characters.`);
  } else {
    warn(label, `Add a dedicated ${name} value before deployment; local fallbacks remain active.`);
  }
}
if (
  configured("PREORDER_ORDER_ACCESS_SECRET", 32) &&
  configured("PREORDER_RATE_LIMIT_SECRET", 32) &&
  process.env.PREORDER_ORDER_ACCESS_SECRET === process.env.PREORDER_RATE_LIMIT_SECRET
) {
  fail("Signing-secret isolation", "Order-link and endpoint-protection secrets must be different.");
} else {
  pass("Signing-secret isolation", "Dedicated signing secrets are isolated.");
}

if (configured("PREORDER_STAGING_ACCESS_SECRET", 32)) {
  pass("Private staging gate", "A revocable staging access secret is configured.");
  if (
    process.env.PREORDER_STAGING_ACCESS_SECRET === process.env.PREORDER_ORDER_ACCESS_SECRET ||
    process.env.PREORDER_STAGING_ACCESS_SECRET === process.env.PREORDER_RATE_LIMIT_SECRET
  ) {
    fail("Staging-secret isolation", "The staging gate must use its own unique secret.");
  } else {
    pass("Staging-secret isolation", "The staging gate uses independent signing material.");
  }
} else if (target === "staging") {
  fail("Private staging gate", "Add PREORDER_STAGING_ACCESS_SECRET before a private staging deployment.");
} else {
  warn("Private staging gate", "Not configured locally; loopback testing remains available.");
}

if (configured("RESEND_API_KEY") && configured("PREORDER_FROM_EMAIL")) {
  pass("Customer email", "Email delivery credentials and a sender are configured.");
} else if (target === "launch") {
  fail("Customer email", "Configure Resend and PREORDER_FROM_EMAIL before accepting live orders.");
} else {
  warn("Customer email", "Resend is not configured, so customer messages cannot be delivered yet.");
}
const operationsRecipient =
  process.env.PREORDER_OPERATIONS_EMAIL?.trim() ||
  process.env.WAITLIST_ADMIN_EMAILS?.split(",").map((email) => email.trim()).find(Boolean);
if (operationsRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operationsRecipient)) {
  pass("Operations email", "A valid owner notification recipient is configured.");
} else if (target === "launch") {
  fail("Operations email", "Configure PREORDER_OPERATIONS_EMAIL before launch.");
} else {
  warn("Operations email", "Owner action notifications do not have a valid recipient.");
}

if (
  expectedPrice === 29_900 &&
  expectedCurrency === "usd" &&
  allowedCountries.length === 1 &&
  allowedCountries[0] === "US" &&
  estimatedDelivery === "January 1, 2027"
) {
  pass("Reviewed offer", "$299 USD, one device, US-only and January 1, 2027 are configured.");
} else {
  fail("Reviewed offer", "The runtime offer differs from the reviewed pre-order configuration.");
}

const termsVersion = PREORDER_TERMS_VERSION;
const approvedTermsVersion = process.env.PREORDER_LEGAL_APPROVED_VERSION ?? "";
if (target === "launch") {
  if (!termsVersion.startsWith("draft") && approvedTermsVersion === termsVersion) {
    pass("Legal launch gate", "The active approved terms version matches the checkout version.");
  } else {
    fail("Legal launch gate", "Approved, non-draft terms are not active.");
  }
} else {
  if (termsVersion.startsWith("draft") && !approvedTermsVersion) {
    pass("Legal launch gate", "The live gate remains deliberately closed during testing.");
  } else {
    warn("Legal launch gate", "Review the configured legal version before continuing.");
  }
}

let supabase;
if (configured("SUPABASE_URL") && configured("SUPABASE_SECRET_KEY")) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
} else {
  fail("Database connection", "SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

if (supabase) {
  const controls = await supabase
    .from("preorder_sales_controls")
    .select("environment,sales_status,unit_limit")
    .in("environment", ["test", "live"]);
  if (controls.error) {
    fail("Sales controls", controls.error.message);
  } else {
    const live = controls.data.find((row) => row.environment === "live");
    const test = controls.data.find((row) => row.environment === "test");
    if (live?.sales_status === "paused") {
      pass("Live allocation lock", "Live pre-orders are paused.");
    } else {
      fail("Live allocation lock", `Expected paused, found ${live?.sales_status ?? "missing"}.`);
    }
    if (test) {
      pass("Test allocation", `Test pre-orders are ${test.sales_status}.`);
    } else {
      fail("Test allocation", "The test sales control is missing.");
    }
  }

  const subject = randomBytes(32).toString("hex");
  const first = await supabase.rpc("consume_preorder_rate_limit", {
    p_scope: "readiness_check",
    p_subject_hash: subject,
    p_limit: 1,
    p_window_seconds: 60,
  });
  const second = await supabase.rpc("consume_preorder_rate_limit", {
    p_scope: "readiness_check",
    p_subject_hash: subject,
    p_limit: 1,
    p_window_seconds: 60,
  });
  await supabase
    .from("preorder_rate_limits")
    .delete()
    .eq("scope", "readiness_check")
    .eq("subject_hash", subject);
  if (
    !first.error &&
    !second.error &&
    first.data?.[0]?.allowed === true &&
    second.data?.[0]?.allowed === false
  ) {
    pass("Endpoint throttling", "The first request is allowed and the excess request is blocked.");
  } else {
    fail("Endpoint throttling", first.error?.message ?? second.error?.message ?? "Unexpected rate-limit result.");
  }

  const [failedWebhooks, pendingCancellations, emailDeliveries] = await Promise.all([
    supabase.from("stripe_webhook_events").select("event_id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("preorders").select("id", { count: "exact", head: true }).in("cancellation_status", ["requested", "processing"]),
    supabase
      .from("preorder_email_deliveries")
      .select("preorder_id,email_type,recipient,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1_000),
  ]);
  for (const [result, name] of [
    [failedWebhooks, "Failed webhooks"],
    [pendingCancellations, "Pending cancellations"],
  ]) {
    if (result.error) {
      fail(name, result.error.message);
    } else if ((result.count ?? 0) > 0) {
      warn(name, `${result.count} record${result.count === 1 ? " needs" : "s need"} owner review.`);
    } else {
      pass(name, "No outstanding records.");
    }
  }
  if (emailDeliveries.error) {
    fail("Failed email deliveries", emailDeliveries.error.message);
  } else {
    const latestByDeliveryStream = new Map();
    for (const delivery of emailDeliveries.data) {
      const key = `${delivery.preorder_id}:${delivery.email_type}:${delivery.recipient}`;
      if (!latestByDeliveryStream.has(key)) latestByDeliveryStream.set(key, delivery);
    }
    const unresolvedFailures = [...latestByDeliveryStream.values()].filter(
      (delivery) => delivery.status === "failed",
    ).length;
    if (unresolvedFailures) {
      warn(
        "Failed email deliveries",
        `${unresolvedFailures} latest delivery ${unresolvedFailures === 1 ? "state needs" : "states need"} owner review.`,
      );
    } else {
      pass("Failed email deliveries", "No unresolved delivery failures.");
    }
  }
}

if (secretKey && priceId) {
  try {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product =
      typeof price.product === "string" || !price.product || price.product.deleted
        ? null
        : price.product;
    if (
      price.active &&
      price.livemode === (target === "launch") &&
      price.type === "one_time" &&
      price.unit_amount === expectedPrice &&
      price.currency === expectedCurrency &&
      product?.active
    ) {
      pass("Stripe price", `${expectedPrice} ${expectedCurrency.toUpperCase()} one-time price is active.`);
    } else {
      fail("Stripe price", "The configured price does not match the reviewed pre-order offer.");
    }
  } catch (error) {
    fail("Stripe price", error instanceof Error ? error.message : "The Stripe price could not be loaded.");
  }
} else {
  fail("Stripe price", "STRIPE_PREORDER_PRICE_ID and STRIPE_SECRET_KEY are required.");
}

if (target === "launch" && /^(?:sk|rk)_live_/.test(secretKey) && webhookEndpointId) {
  try {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const endpoint = await stripe.webhookEndpoints.retrieve(webhookEndpointId);
    const requiredEvents = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
      "charge.refunded",
      "refund.failed",
      "charge.dispute.created",
      "charge.dispute.closed",
    ];
    const missingEvents = requiredEvents.filter(
      (eventType) =>
        !endpoint.enabled_events.includes("*") &&
        !endpoint.enabled_events.includes(eventType),
    );
    if (
      endpoint.status === "enabled" &&
      endpoint.livemode &&
      endpoint.url === "https://framewearable.com/api/stripe/webhook" &&
      missingEvents.length === 0
    ) {
      pass("Stripe webhook endpoint", "The live endpoint is enabled for every required event.");
    } else {
      fail("Stripe webhook endpoint", "The live endpoint URL or event subscriptions are incomplete.");
    }
  } catch (error) {
    fail(
      "Stripe webhook endpoint",
      error instanceof Error ? error.message : "The live endpoint could not be loaded.",
    );
  }
}

const symbols = { pass: "PASS", warn: "WARN", fail: "FAIL" };
console.log(`Frame pre-order ${target} readiness\n`);
for (const check of checks) {
  console.log(`${symbols[check.status]}  ${check.name}: ${check.detail}`);
}
const failures = checks.filter((check) => check.status === "fail").length;
const warnings = checks.filter((check) => check.status === "warn").length;
console.log(`\n${failures ? "NOT READY" : "READY"}: ${failures} failure${failures === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`);
process.exitCode = failures ? 1 : 0;
