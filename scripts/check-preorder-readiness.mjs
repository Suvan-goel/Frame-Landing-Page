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
import { COMPANY_DETAILS_CHECK } from "../lib/company.ts";
import {
  comparePreorderUsTaxRegistrationStates,
  isPreorderTaxReviewApproved,
  PREORDER_TAX_HEAD_OFFICE_COUNTRY,
  PREORDER_TAX_POLICY_VERSION,
} from "../lib/preorder-tax-policy.ts";
import { evaluateStripeAccountReadiness } from "../lib/preorder-stripe-account-readiness.ts";
import {
  evaluatePreorderEmailReadiness,
  getPreorderEmailDnsSnapshot,
  PREORDER_EMAIL_REPLY_TO,
} from "../lib/preorder-email-readiness.ts";
import { runPreorderPaymentReconciliation } from "../lib/preorder-payment-reconciliation.server.ts";
import { runPreorderOperationsHealth } from "../lib/preorder-operations-health.server.ts";

const target = process.argv.includes("--launch")
  ? "launch"
  : process.argv.includes("--live-smoke")
    ? "live-smoke"
    : process.argv.includes("--staging")
    ? "staging"
    : "local";
const isLiveTarget = target === "launch" || target === "live-smoke";

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

const mode = process.env.PREORDER_MODE ?? "off";
const targetEnvironment = isLiveTarget ? "live" : "test";
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

if (isLiveTarget) {
  if (mode === "live") {
    pass("Runtime mode", "Live mode is configured; the allocation must remain paused until the controlled opening step.");
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
    isLiveTarget
      ? "STRIPE_LIVE_WEBHOOK_SECRET is required."
      : "Add STRIPE_WEBHOOK_SECRET before testing signed events.",
  );
}
if (isLiveTarget) {
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
  } else if (isLiveTarget) {
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

const liveSmokeSecret = process.env.PREORDER_LIVE_SMOKE_ACCESS_SECRET ?? "";
const publicLaunchEnabled = process.env.PREORDER_PUBLIC_LAUNCH_ENABLED ?? "false";
const verifiedLiveSmokeOrderId =
  process.env.PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID ?? "";
const allowBankPendingLaunch =
  process.env.PREORDER_ALLOW_BANK_PENDING_LAUNCH === "true";
if (configured("PREORDER_LIVE_SMOKE_ACCESS_SECRET", 32)) {
  pass("Private live-verification gate", "A revocable live-verification secret is configured.");
  const conflictingSecretNames = [
    "PREORDER_ORDER_ACCESS_SECRET",
    "PREORDER_RATE_LIMIT_SECRET",
    "PREORDER_MAINTENANCE_SECRET",
    "PREORDER_STAGING_ACCESS_SECRET",
  ].filter(
    (name) =>
      process.env[name] && process.env[name] === liveSmokeSecret,
  );
  if (conflictingSecretNames.length) {
    fail(
      "Live-verification secret isolation",
      "The live-verification gate must use its own unique signing secret.",
    );
  } else {
    pass(
      "Live-verification secret isolation",
      "The live-verification gate uses independent signing material.",
    );
  }
} else if (isLiveTarget) {
  fail(
    "Private live-verification gate",
    "Add PREORDER_LIVE_SMOKE_ACCESS_SECRET before live verification.",
  );
} else {
  warn(
    "Private live-verification gate",
    "Not configured locally; no real payment path can be invited.",
  );
}

if (target === "live-smoke") {
  if (publicLaunchEnabled === "false" && !verifiedLiveSmokeOrderId) {
    pass(
      "Public launch lock",
      "Public discovery remains disabled and no verification order has been approved yet.",
    );
  } else {
    fail(
      "Public launch lock",
      "Keep PREORDER_PUBLIC_LAUNCH_ENABLED=false and PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID empty during the live verification purchase.",
    );
  }
} else if (target === "launch") {
  if (publicLaunchEnabled === "true" && isUuid(verifiedLiveSmokeOrderId)) {
    pass(
      "Public launch approval",
      "Public launch references a specific verified live-smoke order.",
    );
  } else {
    fail(
      "Public launch approval",
      "Set PREORDER_PUBLIC_LAUNCH_ENABLED=true and add the verified, fully refunded live-smoke order ID before final cutover.",
    );
  }
}

const operationsRecipient =
  process.env.PREORDER_OPERATIONS_EMAIL?.trim() ||
  process.env.WAITLIST_ADMIN_EMAILS?.split(",").map((email) => email.trim()).find(Boolean);
let emailDns = null;
try {
  emailDns = await getPreorderEmailDnsSnapshot();
} catch {
  emailDns = null;
}
for (const check of evaluatePreorderEmailReadiness({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.PREORDER_FROM_EMAIL,
  operationsRecipient,
  replyTo: PREORDER_EMAIL_REPLY_TO,
  dns: emailDns,
})) {
  if (check.ready) {
    pass(check.name, check.readyDetail);
  } else if (isLiveTarget) {
    fail(check.name, check.blocker);
  } else {
    warn(check.name, check.blocker);
  }
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
const approvedTaxReviewVersion =
  process.env.PREORDER_TAX_REVIEW_APPROVED_VERSION ?? "";
if (isLiveTarget) {
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

if (isPreorderTaxReviewApproved(approvedTaxReviewVersion)) {
  pass(
    "Tax review gate",
    `The approved tax policy matches ${PREORDER_TAX_POLICY_VERSION}.`,
  );
} else if (isLiveTarget) {
  fail(
    "Tax review gate",
    `Set PREORDER_TAX_REVIEW_APPROVED_VERSION to ${PREORDER_TAX_POLICY_VERSION} only after the tax position is reviewed.`,
  );
} else {
  pass("Tax review gate", "The live tax-policy approval remains deliberately unset during testing.");
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
    if (target === "live-smoke") {
      if (live?.unit_limit === 1) {
        pass("Live verification allocation", "Exactly one live unit is released while checkout remains paused.");
      } else {
        fail("Live verification allocation", "Set the paused live release ceiling to exactly one unit before creating the invitation.");
      }
    } else if (target === "launch") {
      if (live?.unit_limit === 100) {
        pass("Live release allocation", "The approved 100-unit initial batch is staged while checkout remains paused.");
      } else {
        fail("Live release allocation", "Restore the paused live release ceiling to the approved 100-unit initial batch before public cutover.");
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

  if (target === "launch" && isUuid(verifiedLiveSmokeOrderId)) {
    const verificationOrder = await supabase
      .from("preorders")
      .select("id,checkout_intent_id,environment,payment_status,amount_total,amount_refunded,confirmation_email_sent_at")
      .eq("id", verifiedLiveSmokeOrderId)
      .maybeSingle();
    if (verificationOrder.error || !verificationOrder.data) {
      fail(
        "Live verification evidence",
        verificationOrder.error?.message ?? "The configured verification order was not found.",
      );
    } else {
      const verificationIntent = await supabase
        .from("preorder_checkout_intents")
        .select("id,environment,status,source")
        .eq("id", verificationOrder.data.checkout_intent_id)
        .maybeSingle();
      const order = verificationOrder.data;
      const intent = verificationIntent.data;
      if (
        !verificationIntent.error &&
        intent?.environment === "live" &&
        intent.status === "paid" &&
        intent.source === "private_live_smoke" &&
        order.environment === "live" &&
        order.payment_status === "refunded" &&
        order.amount_total > 0 &&
        order.amount_refunded === order.amount_total &&
        Boolean(order.confirmation_email_sent_at)
      ) {
        pass(
          "Live verification evidence",
          "The referenced private live order completed through the webhook, sent its confirmation, and was fully refunded.",
        );
      } else {
        fail(
          "Live verification evidence",
          verificationIntent.error?.message ??
            "The referenced order is not a completed, confirmation-sent, fully refunded private live-verification order.",
        );
      }
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

  try {
    const operations = await runPreorderOperationsHealth({
      supabase,
      environment: targetEnvironment,
    });
    if (operations.healthy) {
      pass(
        "Operations health",
        `${operations.summary.orders} order${operations.summary.orders === 1 ? "" : "s"}; no failed or stalled work; ${operations.summary.paidUnits} paid and ${operations.summary.reservedUnits} reserved units reconcile.`,
      );
    } else {
      const examples = operations.issues
        .slice(0, 3)
        .map((issue) => issue.code)
        .join(", ");
      fail(
        "Operations health",
        `${operations.issues.length} operational issue${operations.issues.length === 1 ? "" : "s"} found${examples ? ` (${examples})` : ""}; pause sales and run npm run preorder:check:operations for the read-only detail.`,
      );
    }
  } catch (error) {
    fail(
      "Operations health",
      error instanceof Error
        ? `The read-only operations check could not complete: ${error.message}`
        : "The read-only operations check could not complete.",
    );
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
      price.livemode === isLiveTarget &&
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
    } else if (isLiveTarget) {
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
      taxSettings.head_office?.address?.country === PREORDER_TAX_HEAD_OFFICE_COUNTRY &&
      taxSettings.defaults?.tax_behavior === "exclusive" &&
      taxSettings.defaults?.tax_code === PREORDER_STRIPE_PRODUCT_TAX_CODE
    ) {
      pass(
        "Stripe Tax settings",
        `${PREORDER_TAX_HEAD_OFFICE_COUNTRY} head-office tax settings are active with exclusive physical-goods tax treatment.`,
      );
    } else {
      fail(
        "Stripe Tax settings",
        `Review the ${PREORDER_TAX_HEAD_OFFICE_COUNTRY} head office, exclusive tax behavior, and tangible-goods default in Stripe Tax.`,
      );
    }
    const activeUsRegistrations = taxRegistrations.data.filter(
      (registration) => registration.country === "US",
    );
    const usRegistrationComparison = comparePreorderUsTaxRegistrationStates(
      activeUsRegistrations.map(
        (registration) => registration.country_options.us?.state ?? "UNKNOWN",
      ),
    );
    if (isLiveTarget && usRegistrationComparison.matches) {
      pass(
        "Stripe Tax registrations",
        usRegistrationComparison.required.length
          ? `The active US registrations match the approved states: ${usRegistrationComparison.required.join(", ")}.`
          : "No active US registrations are configured, matching the approved remote-seller tax policy.",
      );
    } else if (isLiveTarget) {
      fail(
        "Stripe Tax registrations",
        `Active US states do not match the approved policy (missing: ${usRegistrationComparison.missing.join(", ") || "none"}; unexpected: ${usRegistrationComparison.unexpected.join(", ") || "none"}).`,
      );
    } else if (activeUsRegistrations.length) {
      pass(
        "Stripe Tax registrations",
        `${activeUsRegistrations.length} sandbox US registration${activeUsRegistrations.length === 1 ? "" : "s"} configured for tax testing.`,
      );
    } else {
      warn("Stripe Tax registrations", "Add a sandbox US registration before testing tax calculations.");
    }
  } catch (error) {
    fail("Stripe price", error instanceof Error ? error.message : "The Stripe price could not be loaded.");
  }
} else {
  fail(
    "Stripe price",
    isLiveTarget
      ? "STRIPE_LIVE_PREORDER_PRICE_ID and STRIPE_LIVE_SECRET_KEY are required."
      : "STRIPE_PREORDER_PRICE_ID and STRIPE_SECRET_KEY are required.",
  );
}

if (isLiveTarget && /^(?:sk|rk)_live_/.test(secretKey)) {
  try {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const account = await stripe.accounts.retrieveCurrent();
    for (const check of evaluateStripeAccountReadiness(account, undefined, {
      allowBankPendingLaunch,
    })) {
      if (check.ready) {
        if (check.warning) {
          warn(check.name, check.warning);
        } else {
          pass(check.name, check.readyDetail);
        }
      } else {
        fail(check.name, check.blocker);
      }
    }
  } catch (error) {
    fail(
      "Stripe account readiness",
      error instanceof Error
        ? `The configured key could not verify the live Account object: ${error.message}`
        : "The configured key could not verify the live Account object.",
    );
  }
}

if (isLiveTarget && supabase && /^(?:sk|rk)_live_/.test(secretKey)) {
  try {
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const reconciliation = await runPreorderPaymentReconciliation({
      supabase,
      stripe,
      environment: "live",
    });
    if (reconciliation.ready) {
      pass(
        "Payment reconciliation",
        `${reconciliation.summary.storedOrders} stored live order${reconciliation.summary.storedOrders === 1 ? "" : "s"} match ${reconciliation.summary.stripePaidSessions} paid Stripe pre-order session${reconciliation.summary.stripePaidSessions === 1 ? "" : "s"}.`,
      );
    } else {
      const examples = reconciliation.issues
        .slice(0, 3)
        .map((issue) => issue.code)
        .join(", ");
      fail(
        "Payment reconciliation",
        `${reconciliation.issues.length} mismatch${reconciliation.issues.length === 1 ? "" : "es"} found${examples ? ` (${examples})` : ""}; run npm run preorder:check:payments for the read-only detail.`,
      );
    }
  } catch (error) {
    fail(
      "Payment reconciliation",
      error instanceof Error
        ? `The read-only Stripe/order comparison could not complete: ${error.message}`
        : "The read-only Stripe/order comparison could not complete.",
    );
  }
}

if (isLiveTarget && /^(?:sk|rk)_live_/.test(secretKey) && webhookEndpointId) {
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
