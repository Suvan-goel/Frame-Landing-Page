import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LANDING_DIAGNOSTIC_TTL_HOURS,
  landingDiagnosticBootstrapScript,
  metaLandingAttribution,
  parseLandingDiagnosticEvents,
  sanitizeLandingDiagnosticCampaignId,
} from "../lib/landing-diagnostics";

const diagnosticId = "123e4567-e89b-12d3-a456-426614174000";

test("detects Meta attribution without returning advertising identifiers", () => {
  const attributed = metaLandingAttribution(
    new URL(
      "https://framewearable.com/?utm_source=fb&utm_medium=paid&utm_campaign=120251681707970592&fbclid=secret-click-id",
    ),
    "Mozilla/5.0",
  );
  assert.deepEqual(attributed, { campaignId: "120251681707970592" });
  assert.equal(JSON.stringify(attributed).includes("secret-click-id"), false);

  assert.deepEqual(
    metaLandingAttribution(
      new URL("https://framewearable.com/?fbclid=another-secret"),
      "Mozilla/5.0",
    ),
    { campaignId: null },
  );
});

test("excludes tests, crawlers, non-paid traffic, and non-landing paths", () => {
  assert.equal(
    metaLandingAttribution(
      new URL("https://framewearable.com/?fbclid=codex_synthetic"),
      "Mozilla/5.0",
    ),
    null,
  );
  assert.equal(
    metaLandingAttribution(
      new URL("https://framewearable.com/?fbclid=real-click"),
      "facebookexternalhit/1.1",
    ),
    null,
  );
  assert.equal(
    metaLandingAttribution(
      new URL("https://framewearable.com/?utm_source=fb&utm_medium=organic"),
      "Mozilla/5.0",
    ),
    null,
  );
  assert.equal(
    metaLandingAttribution(
      new URL("https://framewearable.com/privacy?fbclid=real-click"),
      "Mozilla/5.0",
    ),
    null,
  );
});

test("stores only bounded campaign identifiers", () => {
  assert.equal(
    sanitizeLandingDiagnosticCampaignId("120251681707970592"),
    "120251681707970592",
  );
  assert.equal(sanitizeLandingDiagnosticCampaignId("campaign-name"), null);
  assert.equal(sanitizeLandingDiagnosticCampaignId("1".repeat(33)), null);
});

test("accepts only bounded milestone payloads with no extra fields", () => {
  assert.deepEqual(parseLandingDiagnosticEvents([{ milestone: "hydrated" }]), [
    { milestone: "hydrated" },
  ]);
  assert.deepEqual(
    parseLandingDiagnosticEvents([
      {
        milestone: "geo_resolved",
        geoStatus: "success",
        geoPolicy: "us-opt-out",
      },
      { milestone: "pixel_failure", pixelFailureCode: "script_error" },
    ]),
    [
      {
        milestone: "geo_resolved",
        geoStatus: "success",
        geoPolicy: "us-opt-out",
      },
      { milestone: "pixel_failure", pixelFailureCode: "script_error" },
    ],
  );
  assert.equal(
    parseLandingDiagnosticEvents([
      { milestone: "hydrated", freeText: "do not store this" },
    ]),
    null,
  );
  assert.equal(
    parseLandingDiagnosticEvents([{ milestone: "geo_resolved" }]),
    null,
  );
  assert.equal(
    parseLandingDiagnosticEvents([
      { milestone: "client_failure", clientFailureCode: "stack trace" },
    ]),
    null,
  );
});

test("the inline collector is small, asynchronous, ephemeral, and strips request metadata", () => {
  const script = landingDiagnosticBootstrapScript(diagnosticId);
  assert.ok(script.length < 2_000);
  assert.match(script, /requestIdleCallback/);
  assert.match(script, /keepalive:true/);
  assert.match(script, /credentials:'omit'/);
  assert.match(script, /referrerPolicy:'no-referrer'/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(script, /fbclid|_fbc|_fbp|userAgent/);
  assert.equal(LANDING_DIAGNOSTIC_TTL_HOURS, 48);
});

test("the temporary schema contains no prohibited visitor-data columns", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260811180000_add_temporary_landing_diagnostics.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const tableDefinition = migration.slice(
    migration.indexOf("create table"),
    migration.indexOf("create index"),
  );
  for (const prohibitedColumn of [
    "email",
    "name",
    "ip_address",
    "fbclid",
    "_fbc",
    "_fbp",
    "referrer",
    "user_agent",
    "survey",
    "health",
    "blood_pressure",
    "demographic",
    "free_text",
  ]) {
    assert.doesNotMatch(
      tableDefinition,
      new RegExp(`\\b${prohibitedColumn}\\b`, "i"),
    );
  }
  assert.match(tableDefinition, /interval '48 hours'/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /purge_expired_landing_diagnostics/);
});
