import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
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
import {
  GEO_ATTESTATION_AUDIENCE,
  GEO_ATTESTATION_ENDPOINT,
  GEO_ATTESTATION_PUBLIC_KEY_SHA256_FINGERPRINT,
  GEO_POLICY_VERSION,
  requestTrackingPolicyAttestation,
  submittedTrackingPolicy,
  trackingPolicyForRegion,
  verifyGeoAttestationToken,
} from "../lib/geo-attestation";

const eventId = "10000000-0000-4000-8000-000000000001";
const NOW = 1_786_400_000;
const testKeys = generateKeyPairSync("ed25519");
const testPrivateKeyPkcs8Base64 = testKeys.privateKey
  .export({ type: "pkcs8", format: "der" })
  .toString("base64");
const testPublicKeySpkiBase64 = testKeys.publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64");

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function attestationPayload(
  country: string | null,
  region: string | null,
  overrides: Record<string, unknown> = {},
) {
  let resolutionOutcome = "resolved_non_us";
  if (country === null) resolutionOutcome = "country_unresolved";
  if (country === "US" && region === null) {
    resolutionOutcome = "us_subdivision_missing";
  }
  if (country === "US" && region && ["WA", "NV"].includes(region)) {
    resolutionOutcome = "resolved_explicit_consent_us_state";
  }
  if (country === "US" && region && !["WA", "NV"].includes(region)) {
    resolutionOutcome = "resolved_us_state";
  }
  return {
    effective_policy: trackingPolicyForRegion(country, region),
    country_code: country,
    subdivision_code: country === "US" ? region : null,
    geo_source: "netlify_context_geo",
    resolution_outcome: resolutionOutcome,
    policy_version: GEO_POLICY_VERSION,
    issued_at: NOW,
    expires_at: NOW + 300,
    ...overrides,
  };
}

async function signTestToken(
  payload: Record<string, unknown>,
  audience = GEO_ATTESTATION_AUDIENCE,
) {
  const header = base64Url(
    JSON.stringify({ alg: "EdDSA", aud: audience, typ: "JWT" }),
  );
  const body = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(testPrivateKeyPkcs8Base64, "base64"),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

async function responseFor(
  country: string | null,
  region: string | null,
  overrides: Record<string, unknown> = {},
) {
  return Response.json({
    token: await signTestToken(attestationPayload(country, region, overrides)),
  });
}

const verifyOptions = {
  nowSeconds: NOW,
  publicKeySpkiBase64: testPublicKeySpkiBase64,
};
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
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "explicit-consent",
      storedConsent: "granted",
      globalPrivacyControl: false,
      clientStateValid: true,
    }),
    { permitted: true, reason: "allowed_explicit_consent" },
  );
  assert.deepEqual(
    resolveMetaTrackingDecision({
      policyMode: "us-opt-out",
      storedConsent: null,
      globalPrivacyControl: false,
      clientStateValid: true,
    }),
    { permitted: true, reason: "allowed_us_opt_out" },
  );
});

test("configured production public-key fingerprint is pinned", () => {
  const fingerprint = createHash("sha256")
    .update(
      Buffer.from(
        "MCowBQYDK2VwAyEAxEG74SlKrBlq8FVzZFgUd0u4Y5Jt7AjyNUyjoIzXZKA=",
        "base64",
      ),
    )
    .digest("hex")
    .match(/.{2}/gu)
    ?.join(":");
  assert.equal(fingerprint, GEO_ATTESTATION_PUBLIC_KEY_SHA256_FINGERPRINT);
});

for (const [name, country, region, expectedMode] of [
  ["California", "US", "CA", "us-opt-out"],
  ["New York", "US", "NY", "us-opt-out"],
  ["Washington", "US", "WA", "explicit-consent"],
  ["Nevada", "US", "NV", "explicit-consent"],
  ["UK", "GB", null, "explicit-consent"],
  ["France", "FR", null, "explicit-consent"],
  ["missing country", null, null, "explicit-consent"],
] as const) {
  test(`${name} signed attestation resolves to ${expectedMode}`, async () => {
    const result = await requestTrackingPolicyAttestation({
      ...verifyOptions,
      fetcher: (async () => responseFor(country, region)) as typeof fetch,
      wait: async () => undefined,
    });
    assert.equal(result.mode, expectedMode);
    assert.equal(result.country, country);
    assert.equal(result.regionCode, country === "US" ? region : null);
  });
}

test("US missing state retries once and accepts a valid California result", async () => {
  let requests = 0;
  const responses = [
    await responseFor("US", null),
    await responseFor("US", "CA"),
  ];
  const result = await requestTrackingPolicyAttestation({
    ...verifyOptions,
    fetcher: (async () => responses[requests++]) as typeof fetch,
    wait: async () => undefined,
  });
  assert.equal(requests, 2);
  assert.equal(result.mode, "us-opt-out");
  assert.equal(result.resolutionReason, "resolved_after_retry");
  assert.equal(result.retryAttempted, true);
  assert.equal(result.retrySucceeded, true);
});

for (const [name, outcome, expectedReason] of [
  ["missing", "us_subdivision_missing", "missing_region"],
  ["invalid", "us_subdivision_invalid", "invalid_region"],
] as const) {
  test(`US ${name} state twice fails closed after exactly one retry`, async () => {
    let requests = 0;
    const fetcher = (async () => {
      requests += 1;
      return responseFor("US", null, { resolution_outcome: outcome });
    }) as typeof fetch;
    const result = await requestTrackingPolicyAttestation({
      ...verifyOptions,
      fetcher,
      wait: async () => undefined,
    });
    assert.equal(requests, 2);
    assert.equal(result.mode, "explicit-consent");
    assert.equal(result.resolutionReason, expectedReason);
    assert.equal(result.retryAttempted, true);
    assert.equal(result.retrySucceeded, false);
  });
}

test("valid signed token is accepted by browser and server verification", async () => {
  const token = await signTestToken(attestationPayload("US", "CA"));
  const verified = await verifyGeoAttestationToken(token, verifyOptions);
  const server = await submittedTrackingPolicy(token, {}, verifyOptions);
  assert.equal(verified.subdivision_code, "CA");
  assert.equal(server.mode, "us-opt-out");
  assert.equal(server.token, token);
});

test("tampered token is rejected and fails closed", async () => {
  const token = await signTestToken(attestationPayload("US", "CA"));
  const [header, payload, signature] = token.split(".");
  const tampered = `${header}.${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${signature}`;
  const result = await submittedTrackingPolicy(tampered, {}, verifyOptions);
  assert.equal(result.mode, "explicit-consent");
  assert.equal(result.resolutionReason, "invalid_signature");
});

test("expired token is rejected and fails closed", async () => {
  const token = await signTestToken(
    attestationPayload("US", "CA", {
      issued_at: NOW - 600,
      expires_at: NOW - 300,
    }),
  );
  const result = await submittedTrackingPolicy(token, {}, verifyOptions);
  assert.equal(result.mode, "explicit-consent");
  assert.equal(result.resolutionReason, "expired_token");
});

test("wrong audience and policy version are rejected", async () => {
  const wrongAudience = await signTestToken(
    attestationPayload("US", "CA"),
    "attacker.example",
  );
  const wrongVersion = await signTestToken(
    attestationPayload("US", "CA", { policy_version: "wrong-version" }),
  );
  assert.equal(
    (await submittedTrackingPolicy(wrongAudience, {}, verifyOptions))
      .resolutionReason,
    "wrong_audience",
  );
  assert.equal(
    (await submittedTrackingPolicy(wrongVersion, {}, verifyOptions))
      .resolutionReason,
    "wrong_version",
  );
});

test("unexpected claims and unsigned browser policy fail closed", async () => {
  const extraClaim = await signTestToken({
    ...attestationPayload("US", "CA"),
    browser_policy: "us-opt-out",
  });
  assert.equal(
    (await submittedTrackingPolicy(extraClaim, {}, verifyOptions)).mode,
    "explicit-consent",
  );
  const unsigned = await submittedTrackingPolicy(
    null,
    { resolutionReason: "resolved_first_attempt" },
    verifyOptions,
  );
  assert.equal(unsigned.mode, "explicit-consent");
  assert.equal(unsigned.resolutionReason, "missing_token");
});

test("Netlify request is data-free and sends no credentials, referrer, query, or body", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const result = await requestTrackingPolicyAttestation({
    ...verifyOptions,
    fetcher: (async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return responseFor("US", "CA");
    }) as typeof fetch,
  });
  assert.equal(result.mode, "us-opt-out");
  assert.equal(requestedUrl, GEO_ATTESTATION_ENDPOINT);
  assert.equal(new URL(requestedUrl).search, "");
  assert.equal(requestedInit?.method, "GET");
  assert.equal(requestedInit?.credentials, "omit");
  assert.equal(requestedInit?.referrerPolicy, "no-referrer");
  assert.equal(requestedInit?.body, undefined);
  const serialized = JSON.stringify(requestedInit).toLowerCase();
  assert.doesNotMatch(
    serialized,
    /email|name|fbclid|meta_click|survey|blood|health|demographic|free.?text/u,
  );
});

test("Netlify unavailability and timeout fail closed", async () => {
  const unavailable = await requestTrackingPolicyAttestation({
    ...verifyOptions,
    fetcher: (async () => new Response(null, { status: 503 })) as typeof fetch,
  });
  assert.equal(unavailable.mode, "explicit-consent");
  assert.equal(unavailable.resolutionReason, "attestation_fetch_failed");

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
  const result = await requestTrackingPolicyAttestation({
    ...verifyOptions,
    fetcher,
    timeoutMs: 10,
  });
  assert.equal(result.mode, "explicit-consent");
  assert.equal(result.resolutionReason, "attestation_timeout");
  assert.equal(requestAborted, true);
});

test("browser and server derive the same policy from the same signed decision", async () => {
  const browser = await requestTrackingPolicyAttestation({
    ...verifyOptions,
    fetcher: (async () => responseFor("US", "NY")) as typeof fetch,
  });
  const server = await submittedTrackingPolicy(
    browser.token,
    {
      resolutionReason: browser.resolutionReason,
      retryAttempted: browser.retryAttempted,
      retrySucceeded: browser.retrySucceeded,
    },
    verifyOptions,
  );
  assert.equal(browser.mode, server.mode);
  assert.equal(browser.country, server.country);
  assert.equal(browser.regionCode, server.regionCode);
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
