import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resultRow(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  const row = result.data?.[0];
  if (!row) throw new Error(`${label}: no row was returned.`);
  return row;
}

function checkoutArgs(requestKey, source) {
  const acceptedAt = new Date().toISOString();
  return {
    p_request_key: requestKey,
    p_environment: "test",
    p_sku: "frame-reliability-test",
    p_quantity: 1,
    p_unit_amount: 29_900,
    p_currency: "usd",
    p_estimated_delivery: "January 1, 2027",
    p_source: source,
    p_utm_source: "synthetic",
    p_utm_medium: "reliability-test",
    p_utm_campaign: null,
    p_terms_version: "reliability-test-only",
    p_product_status_version: "reliability-test-only",
    p_terms_accepted_at: acceptedAt,
    p_product_status_acknowledged_at: acceptedAt,
    p_marketing_opt_in: false,
    p_marketing_consent_at: null,
  };
}

function webhookClaimArgs(eventId) {
  return {
    p_event_id: eventId,
    p_event_type: "checkout.session.completed",
    p_livemode: false,
    p_stale_after_seconds: 300,
  };
}

await loadLocalEnvironment();

assert(process.env.PREORDER_MODE === "test", "PREORDER_MODE must be test.");
assert(
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
  "STRIPE_SECRET_KEY must be a Stripe test key.",
);
assert(process.env.SUPABASE_URL, "SUPABASE_URL is required.");
assert(process.env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY is required.");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const runId = randomBytes(12).toString("hex");
const source = `reliability-test-${runId}`;
const rateScope = `reliability_${runId}`;
const rateSubject = randomBytes(32).toString("hex");
const eventId = `evt_reliability_${runId}`;
let originalTestControl;
const cleanupFailures = [];

async function updateTestControl(values) {
  const result = await supabase
    .from("preorder_sales_controls")
    .update(values)
    .eq("environment", "test");
  if (result.error) throw new Error(`Test allocation update: ${result.error.message}`);
}

async function getSnapshot() {
  return resultRow(
    await supabase.rpc("get_preorder_sales_snapshot", { p_environment: "test" }),
    "Test allocation snapshot",
  );
}

async function cleanup(label, operation) {
  try {
    const result = await operation();
    if (result?.error) throw result.error;
  } catch (error) {
    cleanupFailures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Frame pre-order reliability test (${runId})\n`);

try {
  const controls = await supabase
    .from("preorder_sales_controls")
    .select("environment,sales_status,unit_limit,updated_by,updated_at")
    .in("environment", ["test", "live"]);
  if (controls.error) throw new Error(`Sales controls: ${controls.error.message}`);

  const liveControl = controls.data.find((row) => row.environment === "live");
  originalTestControl = controls.data.find((row) => row.environment === "test");
  assert(liveControl?.sales_status === "paused", "Live pre-orders must remain paused.");
  assert(originalTestControl, "The test sales control is missing.");
  console.log("PASS  Safety interlock: test mode is active and live pre-orders are paused.");

  const initialSnapshot = await getSnapshot();
  const initialCapacity = Number(initialSnapshot.paid_units) + Number(initialSnapshot.reserved_units) + 1;
  await updateTestControl({
    sales_status: "open",
    unit_limit: initialCapacity,
    updated_by: `reliability-test:${runId}`,
    updated_at: new Date().toISOString(),
  });

  const sharedRequestKey = randomUUID();
  const sharedReservations = await Promise.all(
    Array.from({ length: 8 }, () =>
      supabase.rpc("reserve_preorder_checkout", checkoutArgs(sharedRequestKey, source)),
    ),
  );
  const sharedIds = sharedReservations.map((result, index) => {
    if (result.error) throw new Error(`Concurrent reservation ${index + 1}: ${result.error.message}`);
    return result.data;
  });
  assert(new Set(sharedIds).size === 1, "The same request key created more than one checkout intent.");

  const syntheticIntents = await supabase
    .from("preorder_checkout_intents")
    .select("id,status,request_key")
    .eq("source", source);
  if (syntheticIntents.error) throw new Error(`Checkout verification: ${syntheticIntents.error.message}`);
  assert(syntheticIntents.data.length === 1, "Duplicate checkout intents were stored.");
  console.log("PASS  Checkout idempotency: 8 simultaneous requests produced one reservation.");

  const filledSnapshot = await getSnapshot();
  const filledCapacity = Number(filledSnapshot.paid_units) + Number(filledSnapshot.reserved_units);
  await updateTestControl({
    sales_status: "open",
    unit_limit: filledCapacity,
    updated_by: `reliability-test:${runId}`,
    updated_at: new Date().toISOString(),
  });

  const rejectedKeys = Array.from({ length: 6 }, () => randomUUID());
  const soldOutResults = await Promise.all(
    rejectedKeys.map((requestKey) =>
      supabase.rpc("reserve_preorder_checkout", checkoutArgs(requestKey, source)),
    ),
  );
  assert(
    soldOutResults.every((result) => result.error?.message.includes("PREORDER_SOLD_OUT")),
    "At least one request bypassed the filled unit limit.",
  );
  const rejectedRows = await supabase
    .from("preorder_checkout_intents")
    .select("id", { count: "exact", head: true })
    .in("request_key", rejectedKeys);
  if (rejectedRows.error) throw new Error(`Capacity verification: ${rejectedRows.error.message}`);
  assert(rejectedRows.count === 0, "A sold-out request created a checkout intent.");
  console.log("PASS  Capacity lock: 6 simultaneous excess buyers were rejected without new reservations.");

  await updateTestControl({
    sales_status: "paused",
    unit_limit: filledCapacity,
    updated_by: `reliability-test:${runId}`,
    updated_at: new Date().toISOString(),
  });
  const pausedResult = await supabase.rpc(
    "reserve_preorder_checkout",
    checkoutArgs(randomUUID(), source),
  );
  assert(pausedResult.error?.message.includes("PREORDER_PAUSED"), "The paused allocation accepted a request.");
  console.log("PASS  Pause switch: checkout creation stops immediately when sales are paused.");

  const rateResults = await Promise.all(
    Array.from({ length: 12 }, () =>
      supabase.rpc("consume_preorder_rate_limit", {
        p_scope: rateScope,
        p_subject_hash: rateSubject,
        p_limit: 5,
        p_window_seconds: 60,
      }),
    ),
  );
  const rateRows = rateResults.map((result, index) => resultRow(result, `Rate-limit request ${index + 1}`));
  assert(rateRows.filter((row) => row.allowed).length === 5, "The rate limiter allowed the wrong number of requests.");
  assert(rateRows.filter((row) => !row.allowed).length === 7, "The rate limiter blocked the wrong number of requests.");
  const storedRate = await supabase
    .from("preorder_rate_limits")
    .select("request_count")
    .eq("scope", rateScope)
    .eq("subject_hash", rateSubject)
    .single();
  if (storedRate.error) throw new Error(`Rate-limit verification: ${storedRate.error.message}`);
  assert(storedRate.data.request_count === 12, "The atomic rate-limit counter lost requests.");
  console.log("PASS  Rate limiting: 12 simultaneous requests produced an exact 5 allowed / 7 blocked split.");

  const firstClaims = await Promise.all(
    Array.from({ length: 10 }, () =>
      supabase.rpc("claim_stripe_webhook_event", webhookClaimArgs(eventId)),
    ),
  );
  const firstClaimRows = firstClaims.map((result, index) => resultRow(result, `Webhook claim ${index + 1}`));
  assert(firstClaimRows.filter((row) => !row.duplicate).length === 1, "More than one worker claimed a new webhook.");
  assert(firstClaimRows.every((row) => row.processing_attempts === 1), "A duplicate delivery incremented processing attempts.");
  console.log("PASS  Webhook concurrency: 10 simultaneous deliveries produced one processing claim.");

  const processed = await supabase
    .from("stripe_webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (processed.error) throw new Error(`Webhook completion setup: ${processed.error.message}`);
  const processedDuplicate = resultRow(
    await supabase.rpc("claim_stripe_webhook_event", webhookClaimArgs(eventId)),
    "Processed webhook duplicate",
  );
  assert(processedDuplicate.duplicate, "A processed webhook was claimed again.");

  const failed = await supabase
    .from("stripe_webhook_events")
    .update({ status: "failed", error_message: "synthetic reliability test" })
    .eq("event_id", eventId);
  if (failed.error) throw new Error(`Webhook recovery setup: ${failed.error.message}`);
  const retryClaims = await Promise.all(
    Array.from({ length: 6 }, () =>
      supabase.rpc("claim_stripe_webhook_event", webhookClaimArgs(eventId)),
    ),
  );
  const retryRows = retryClaims.map((result, index) => resultRow(result, `Webhook retry ${index + 1}`));
  assert(retryRows.filter((row) => !row.duplicate).length === 1, "Concurrent recovery produced multiple workers.");
  assert(retryRows.every((row) => row.processing_attempts === 2), "Webhook recovery attempts were counted incorrectly.");

  const stale = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      last_attempted_at: new Date(Date.now() - 10 * 60 * 1_000).toISOString(),
    })
    .eq("event_id", eventId);
  if (stale.error) throw new Error(`Stale webhook setup: ${stale.error.message}`);
  const staleClaim = resultRow(
    await supabase.rpc("claim_stripe_webhook_event", webhookClaimArgs(eventId)),
    "Stale webhook recovery",
  );
  assert(!staleClaim.duplicate && staleClaim.processing_attempts === 3, "A stale webhook was not recovered.");
  console.log("PASS  Webhook recovery: processed duplicates, failed retries, and stale claims behave safely.");
} finally {
  await cleanup("synthetic webhook cleanup", () =>
    supabase.from("stripe_webhook_events").delete().eq("event_id", eventId),
  );
  await cleanup("synthetic rate-limit cleanup", () =>
    supabase
      .from("preorder_rate_limits")
      .delete()
      .eq("scope", rateScope)
      .eq("subject_hash", rateSubject),
  );
  await cleanup("synthetic checkout cleanup", () =>
    supabase.from("preorder_checkout_intents").delete().eq("source", source),
  );
  if (originalTestControl) {
    await cleanup("test allocation restoration", () =>
      supabase
        .from("preorder_sales_controls")
        .update({
          sales_status: originalTestControl.sales_status,
          unit_limit: originalTestControl.unit_limit,
          updated_by: originalTestControl.updated_by,
          updated_at: originalTestControl.updated_at,
        })
        .eq("environment", "test"),
    );
  }
  await cleanup("live allocation verification", async () => {
    const result = await supabase
      .from("preorder_sales_controls")
      .select("sales_status")
      .eq("environment", "live")
      .single();
    if (result.error) throw result.error;
    if (result.data.sales_status !== "paused") throw new Error("Live pre-orders are no longer paused.");
  });
}

if (cleanupFailures.length) {
  throw new Error(`Reliability checks finished, but cleanup failed:\n${cleanupFailures.join("\n")}`);
}

console.log("\nPASS  Cleanup: synthetic records were removed, the test allocation was restored, and live remained paused.");
console.log("\nRELIABILITY CHECK PASSED");
