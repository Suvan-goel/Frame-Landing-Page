import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaLeadPayload,
  META_GRAPH_API_VERSION,
  sendMetaLeadConversion,
} from "../lib/meta-conversions.server";
import {
  META_PIXEL_ID,
  resolveMetaTrackingDecision,
} from "../lib/meta-tracking";
import { requestTrackingPolicyMode } from "../lib/tracking-policy";

const eventId = "10000000-0000-4000-8000-000000000001";
const conversionInput = {
  eventId,
  email: "Tracking.Test+Lead@Example.com",
  eventTime: 1_786_363_200,
  eventSourceUrl: "https://framewearable.com/interest",
  clientIpAddress: "203.0.113.10",
  clientUserAgent: "Frame tracking test browser",
  metaClickId: "test-meta-click-id",
  fbp: "fb.1.1786363200000.test-browser-id",
  fbc: null,
};

test("Meta delivery permission fails closed and honors consent and GPC", () => {
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "us-opt-out",
      storedConsent: null,
      globalPrivacyControl: false,
      clientStateValid: false,
    }),
    { permitted: false, reason: "denied_missing_client_state" },
  );
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "us-opt-out",
      storedConsent: null,
      globalPrivacyControl: true,
      clientStateValid: true,
    }),
    { permitted: false, reason: "denied_global_privacy_control" },
  );
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "us-opt-out",
      storedConsent: "denied",
      globalPrivacyControl: false,
      clientStateValid: true,
    }),
    { permitted: false, reason: "denied_stored_choice" },
  );
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "explicit-consent",
      storedConsent: null,
      globalPrivacyControl: false,
      clientStateValid: true,
    }),
    { permitted: false, reason: "denied_explicit_consent_required" },
  );
  assert.equal(
    resolveMetaTrackingDecision({
      policyMode: "explicit-consent",
      storedConsent: "granted",
      globalPrivacyControl: false,
      clientStateValid: true,
    }).permitted,
    true,
  );
  assert.equal(
    resolveMetaTrackingDecision({
      policyMode: "us-opt-out",
      storedConsent: null,
      globalPrivacyControl: false,
      clientStateValid: true,
    }).permitted,
    true,
  );
});

test("tracking policy request returns the regional mode and fails closed", async () => {
  const usOptOut = await requestTrackingPolicyMode({
    fetcher: (async () =>
      Response.json({ mode: "us-opt-out" })) as typeof fetch,
  });
  assert.equal(usOptOut, "us-opt-out");

  const malformed = await requestTrackingPolicyMode({
    fetcher: (async () => Response.json({ mode: "unexpected" })) as typeof fetch,
  });
  assert.equal(malformed, "explicit-consent");

  const unavailable = await requestTrackingPolicyMode({
    fetcher: (async () =>
      new Response("Unavailable", { status: 503 })) as typeof fetch,
  });
  assert.equal(unavailable, "explicit-consent");
});

test("tracking policy request has a bounded fail-closed timeout", async () => {
  let requestAborted = false;
  const fetcher = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          requestAborted = true;
          reject(new DOMException("Timed out", "AbortError"));
        },
        { once: true },
      );
    })) as typeof fetch;

  const result = await requestTrackingPolicyMode({ fetcher, timeoutMs: 10 });
  assert.equal(result, "explicit-consent");
  assert.equal(requestAborted, true);
});

test("CAPI Lead payload uses the stable event ID and contains no survey data", async () => {
  const payload = await buildMetaLeadPayload(conversionInput);
  const event = payload.data[0];
  const serialized = JSON.stringify(payload);

  assert.equal(event.event_name, "Lead");
  assert.equal(event.event_id, eventId);
  assert.equal(event.event_time, conversionInput.eventTime);
  assert.equal(event.event_source_url, conversionInput.eventSourceUrl);
  assert.deepEqual(event.custom_data, {
    content_name: "Frame updates signup",
  });
  assert.match(event.user_data.em[0], /^[0-9a-f]{64}$/);
  assert.equal(event.user_data.fbp, conversionInput.fbp);
  assert.equal(
    event.user_data.fbc,
    `fb.1.${conversionInput.eventTime * 1000}.${conversionInput.metaClickId}`,
  );
  assert.doesNotMatch(serialized, /Tracking\.Test\+Lead@Example\.com/i);
  assert.doesNotMatch(
    serialized,
    /survey|frustration|health|answer|free.?text|first_name|last_name|gender|"age"/i,
  );
});

test("CAPI posts the same event ID to the configured Pixel dataset", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const result = await sendMetaLeadConversion(conversionInput, {
    accessToken: "meta-test-access-token",
    testEventCode: "TEST12345",
    fetcher,
  });

  assert.deepEqual(result, { status: "sent", error: null });
  assert.equal(
    requestUrl,
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PIXEL_ID}/events`,
  );
  assert.equal(requestBody.access_token, "meta-test-access-token");
  assert.equal(requestBody.test_event_code, "TEST12345");
  assert.equal(
    (requestBody.data as Array<Record<string, unknown>>)[0].event_id,
    eventId,
  );
});

test("CAPI does not make a request when credentials are not configured", async () => {
  let called = false;
  const fetcher = (async () => {
    called = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  const result = await sendMetaLeadConversion(conversionInput, {
    accessToken: "",
    fetcher,
  });

  assert.deepEqual(result, {
    status: "skipped_not_configured",
    error: null,
  });
  assert.equal(called, false);
});
