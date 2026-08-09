import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  preorderStripeProductDescription,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_STRIPE_PRODUCT_TAX_CODE,
  PREORDER_TERMS_VERSION,
  PREORDER_WARRANTY_DETAILS_COMPLETE,
} from "../lib/preorder.ts";
import { COMPANY_DETAILS_CHECK, SUPPORT_EMAIL } from "../lib/company.ts";

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

function isReservedTestRecipient(recipient) {
  const domain = String(recipient ?? "").trim().toLowerCase().split("@").pop();
  return domain === "example.com" || domain === "example.net" || domain === "example.org";
}

const mode = process.env.PREORDER_MODE ?? "off";
const targetEnvironment = target === "launch" ? "live" : "test";
const secretKey = targetEnvironment === "live"
  ? process.env.STRIPE_LIVE_SECRET_KEY ?? ""
  : process.env.STRIPE_TEST_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? "";
const priceId = targetEnvironment === "live"
  ? process.env.STRIPE_LIVE_PREORDER_PRICE_ID ?? ""
  : process.env.STRIPE_TEST_PREORDER_PRICE_ID ?? process.env.STRIPE_PREORDER_PRICE_ID ?? "";
const webhookSecret = targetEnvironment === "live"
  ? process.env.STRIPE_LIVE_WEBHOOK_SECRET ?? ""
  : process.env.STRIPE_TEST_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
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
const estimatedShipping =
  process.env.PREORDER_ESTIMATED_SHIPPING ??
  process.env.PREORDER_ESTIMATED_DELIVERY ??
  "Q1 2027";
const shippingRateValue = process.env.PREORDER_SHIPPING_RATE_CENTS?.trim();
const shippingRateCents = shippingRateValue === undefined
  ? Number.NaN
  : Number(shippingRateValue);

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
  fail(
    "Webhook signing",
    target === "launch"
      ? "STRIPE_LIVE_WEBHOOK_SECRET is required."
      : "Add STRIPE_WEBHOOK_SECRET before testing signed events.",
  );
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
  ["PREORDER_MAINTENANCE_SECRET", "Delivery-deadline processing"],
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
if (
  configured("PREORDER_MAINTENANCE_SECRET", 32) &&
  ["PREORDER_ORDER_ACCESS_SECRET", "PREORDER_RATE_LIMIT_SECRET"].some(
    (name) => process.env[name] === process.env.PREORDER_MAINTENANCE_SECRET,
  )
) {
  fail("Maintenance-secret isolation", "Delivery-deadline processing must use its own unique secret.");
} else {
  pass("Maintenance-secret isolation", "Delivery-deadline processing uses independent signing material.");
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
if (
  operationsRecipient &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operationsRecipient) &&
  operationsRecipient.toLowerCase() === SUPPORT_EMAIL.toLowerCase()
) {
  pass("Operations email", `Owner notifications are routed to ${SUPPORT_EMAIL}.`);
} else if (target === "launch") {
  fail("Operations email", `Route PREORDER_OPERATIONS_EMAIL to the monitored inbox (${SUPPORT_EMAIL}) before launch.`);
} else {
  warn("Operations email", `Owner action notifications are not routed to the monitored inbox (${SUPPORT_EMAIL}).`);
}

if (
  expectedPrice === 29_900 &&
  expectedCurrency === "usd" &&
  allowedCountries.length === 1 &&
  allowedCountries[0] === "US" &&
  estimatedShipping === "Q1 2027"
) {
  pass("Reviewed offer", "$299 USD, one device, US-only and Q1 2027 estimated shipping are configured.");
} else {
  fail("Reviewed offer", "The runtime offer differs from the reviewed pre-order configuration.");
}
if (shippingRateValue === "0" && shippingRateCents === 0) {
  pass("Free standard shipping", "Standard US shipping is included at no additional charge.");
} else {
  fail("Free standard shipping", "Set PREORDER_SHIPPING_RATE_CENTS to the reviewed free rate (0 cents).");
}

const termsVersion = PREORDER_TERMS_VERSION;
const approvedTermsVersion = process.env.PREORDER_LEGAL_APPROVED_VERSION ?? "";
const productStatusVersion = PREORDER_PRODUCT_STATUS_VERSION;
const approvedProductStatusVersion =
  process.env.PREORDER_PRODUCT_STATUS_APPROVED_VERSION ?? "";
if (target === "launch") {
  if (
    PREORDER_SELLER_DETAILS_COMPLETE &&
    PREORDER_WARRANTY_DETAILS_COMPLETE &&
    !termsVersion.startsWith("draft") &&
    approvedTermsVersion === termsVersion &&
    !productStatusVersion.startsWith("draft") &&
    approvedProductStatusVersion === productStatusVersion
  ) {
    pass(
      "Legal launch gate",
      "The approved legal pack and Product Status Disclosure versions match checkout.",
    );
  } else {
    fail(
      "Legal launch gate",
      COMPANY_DETAILS_CHECK.complete
        ? "Warranty terms and approved non-draft legal disclosure versions are not all active."
        : `Seller details are incomplete (${COMPANY_DETAILS_CHECK.missingOrInvalid.join(", ")}); approved non-draft legal disclosure versions are not active.`,
    );
  }
} else {
  if (
    !PREORDER_SELLER_DETAILS_COMPLETE &&
    PREORDER_WARRANTY_DETAILS_COMPLETE &&
    termsVersion.startsWith("draft") &&
    !approvedTermsVersion &&
    productStatusVersion.startsWith("draft") &&
    !approvedProductStatusVersion
  ) {
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
    .select("environment,sales_status,inventory_limit,unit_limit")
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
    if (live?.inventory_limit === 1_000 && test?.inventory_limit === 1_000) {
      pass("Inventory ceiling", "Test and live environments have a 1,000-unit lifetime ceiling.");
    } else {
      fail("Inventory ceiling", "Apply the 1,000-unit inventory-ceiling migration.");
    }
    if (target === "launch") {
      if (Number.isSafeInteger(live?.unit_limit) && live.unit_limit >= 1 && live.unit_limit <= 1_000) {
        pass("Live release allocation", `${live.unit_limit} units are released within the lifetime ceiling.`);
      } else {
        fail("Live release allocation", "Set a controlled live release allocation between 1 and 1,000 units while sales remain paused.");
      }
    } else if (live?.unit_limit === 100) {
      pass("Initial live release", "The approved 100-unit initial allocation is recorded and remains paused.");
    } else {
      warn("Initial live release", "The live allocation differs from the approved initial 100-unit batch.");
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

  const [webhookRecovery, pendingCancellations, emailDeliveries] = await Promise.all([
    supabase
      .from("stripe_webhook_events")
      .select("event_id,status,last_attempted_at")
      .in("status", ["failed", "processing"])
      .limit(1_000),
    supabase.from("preorders").select("id", { count: "exact", head: true }).in("cancellation_status", ["requested", "processing"]),
    supabase
      .from("preorder_email_deliveries")
      .select("preorder_id,email_type,recipient,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1_000),
  ]);
  if (webhookRecovery.error) {
    fail("Webhook recovery", webhookRecovery.error.message);
  } else {
    const staleBefore = Date.now() - 5 * 60 * 1_000;
    const unresolvedWebhooks = webhookRecovery.data.filter(
      (event) =>
        event.status === "failed" ||
        (event.status === "processing" &&
          (!event.last_attempted_at || Date.parse(event.last_attempted_at) <= staleBefore)),
    ).length;
    if (unresolvedWebhooks) {
      warn(
        "Webhook recovery",
        `${unresolvedWebhooks} event${unresolvedWebhooks === 1 ? " needs" : "s need"} owner recovery.`,
      );
    } else {
      pass("Webhook recovery", "No failed or stalled events.");
    }
  }
  if (pendingCancellations.error) {
    fail("Pending cancellations", pendingCancellations.error.message);
  } else if ((pendingCancellations.count ?? 0) > 0) {
    warn(
      "Pending cancellations",
      `${pendingCancellations.count} record${pendingCancellations.count === 1 ? " needs" : "s need"} owner review.`,
    );
  } else {
    pass("Pending cancellations", "No outstanding records.");
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
      (delivery) => delivery.status === "failed" && !isReservedTestRecipient(delivery.recipient),
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
      price.tax_behavior === "exclusive" &&
      product?.active
    ) {
      pass("Stripe price", `${expectedPrice} ${expectedCurrency.toUpperCase()} tax-exclusive one-time price is active.`);
    } else {
      fail("Stripe price", "The configured price does not match the reviewed pre-order offer.");
    }
    if (product?.tax_code === PREORDER_STRIPE_PRODUCT_TAX_CODE) {
      pass("Stripe product tax code", "General - Tangible Goods is configured explicitly.");
    } else if (target === "launch") {
      fail("Stripe product tax code", "Assign the adviser-approved tax code to the live Stripe Product.");
    } else {
      warn("Stripe product tax code", "Assign the approved product tax code before launch; test Checkout can use the account preset.");
    }
    const expectedDescription = preorderStripeProductDescription({
      estimatedShipping,
      sandbox: targetEnvironment === "test",
    });
    if (product?.description === expectedDescription) {
      pass("Stripe product copy", `The Stripe product uses the reviewed ${estimatedShipping} shipping estimate.`);
    } else {
      fail("Stripe product copy", "The Stripe product description does not match the reviewed shipping copy.");
    }

    const [taxSettings, taxRegistrations] = await Promise.all([
      stripe.tax.settings.retrieve(),
      stripe.tax.registrations.list({ status: "active", limit: 100 }),
    ]);
    if (
      taxSettings.status === "active" &&
      taxSettings.head_office?.address?.country === "US" &&
      taxSettings.defaults?.tax_behavior === "exclusive" &&
      taxSettings.defaults?.tax_code === PREORDER_STRIPE_PRODUCT_TAX_CODE
    ) {
      pass("Stripe Tax settings", "US tax settings are active with exclusive physical-goods tax treatment.");
    } else {
      fail("Stripe Tax settings", "Review the US head office, exclusive tax behavior, and tangible-goods default in Stripe Tax.");
    }
    const activeUsRegistrations = taxRegistrations.data.filter(
      (registration) => registration.country === "US",
    );
    if (activeUsRegistrations.length) {
      pass("Stripe Tax registrations", `${activeUsRegistrations.length} active US registration${activeUsRegistrations.length === 1 ? "" : "s"} configured for ${targetEnvironment} mode.`);
    } else if (target === "launch") {
      fail("Stripe Tax registrations", "Add every legally required live US tax registration before launch.");
    } else {
      warn("Stripe Tax registrations", "Add a sandbox US registration before testing tax calculations.");
    }
  } catch (error) {
    fail("Stripe price", error instanceof Error ? error.message : "The Stripe price could not be loaded.");
  }
} else {
  fail(
    "Stripe price",
    target === "launch"
      ? "STRIPE_LIVE_PREORDER_PRICE_ID and STRIPE_LIVE_SECRET_KEY are required."
      : "STRIPE_PREORDER_PRICE_ID and STRIPE_SECRET_KEY are required.",
  );
}

if (target === "launch" && /^(?:sk|rk)_live_/.test(secretKey) && webhookEndpointId) {
  try {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const endpoint = await stripe.webhookEndpoints.retrieve(webhookEndpointId);
    const requiredEvents = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
      "refund.created",
      "refund.updated",
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
