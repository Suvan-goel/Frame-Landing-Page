export const GEO_ATTESTATION_ENDPOINT =
  "https://frame-geo-attestation.netlify.app/v1/attest";
export const GEO_ATTESTATION_PUBLIC_KEY_SPKI_B64 =
  "MCowBQYDK2VwAyEAxEG74SlKrBlq8FVzZFgUd0u4Y5Jt7AjyNUyjoIzXZKA=";
export const GEO_ATTESTATION_PUBLIC_KEY_SHA256_FINGERPRINT =
  "77:32:df:98:b6:09:60:36:83:50:fc:2d:36:fe:7c:0d:cd:89:f6:d6:3f:06:c1:70:6b:44:1f:70:c8:ca:b8:2f";
export const GEO_ATTESTATION_AUDIENCE = "framewearable.com";
export const GEO_POLICY_VERSION = "frame-meta-geo-v1";
export const GEO_ATTESTATION_TIMEOUT_MS = 2_500;
export const GEO_ATTESTATION_RETRY_DELAY_MS = 750;
export const GEO_ATTESTATION_MIN_FRESHNESS_SECONDS = 15;
export const GEO_POLICY_UPDATED_EVENT = "frame:geo-policy-updated";

export type TrackingPolicyMode = "explicit-consent" | "us-opt-out";

export type GeoResolutionReason =
  | "resolved_first_attempt"
  | "resolved_after_retry"
  | "missing_country"
  | "missing_region"
  | "invalid_region"
  | "attestation_fetch_failed"
  | "attestation_timeout"
  | "missing_token"
  | "malformed_token"
  | "invalid_signature"
  | "expired_token"
  | "issued_at_invalid"
  | "wrong_version"
  | "wrong_audience"
  | "unexpected_claims"
  | "invalid_country"
  | "policy_mismatch";

export type GeoAttestationPayload = {
  effective_policy: TrackingPolicyMode;
  country_code: string | null;
  subdivision_code: string | null;
  geo_source: "netlify_context_geo";
  resolution_outcome:
    | "country_unresolved"
    | "resolved_non_us"
    | "us_subdivision_missing"
    | "us_subdivision_invalid"
    | "resolved_explicit_consent_us_state"
    | "resolved_us_state";
  policy_version: typeof GEO_POLICY_VERSION;
  issued_at: number;
  expires_at: number;
};

export type GeoPolicyResult = {
  mode: TrackingPolicyMode;
  token: string | null;
  geoSource: "netlify_context_geo" | "unknown";
  country: string | null;
  regionCode: string | null;
  resolutionReason: GeoResolutionReason;
  policyVersion: typeof GEO_POLICY_VERSION | null;
  retryAttempted: boolean;
  retrySucceeded: boolean;
  issuedAt: number | null;
  expiresAt: number | null;
};

type VerifyOptions = {
  nowSeconds?: number;
  publicKeySpkiBase64?: string;
  expectedAudience?: string;
  expectedPolicyVersion?: string;
};

type RequestOptions = VerifyOptions & {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  retryDelayMs?: number;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  forceRefresh?: boolean;
};

const HEADER_KEYS = ["alg", "aud", "typ"];
const PAYLOAD_KEYS = [
  "country_code",
  "effective_policy",
  "expires_at",
  "geo_source",
  "issued_at",
  "policy_version",
  "resolution_outcome",
  "subdivision_code",
];
const RESOLUTION_OUTCOMES = new Set([
  "country_unresolved",
  "resolved_non_us",
  "us_subdivision_missing",
  "us_subdivision_invalid",
  "resolved_explicit_consent_us_state",
  "resolved_us_state",
]);
export const VALID_US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);
const EXPLICIT_CONSENT_US_STATES = new Set(["NV", "WA"]);
const MAX_TOKEN_LENGTH = 4_096;
const MAX_TOKEN_LIFETIME_SECONDS = 600;
const MAX_CLOCK_SKEW_SECONDS = 30;

let cachedPolicy: GeoPolicyResult | null = null;
let policyRequestInFlight: Promise<GeoPolicyResult> | null = null;

export class GeoAttestationError extends Error {
  readonly reason: GeoResolutionReason;

  constructor(reason: GeoResolutionReason) {
    super(reason);
    this.name = "GeoAttestationError";
    this.reason = reason;
  }
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function decodeBase64(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new GeoAttestationError("malformed_token");
  }
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new GeoAttestationError("malformed_token");
  }
  const remainder = value.length % 4;
  if (remainder === 1) throw new GeoAttestationError("malformed_token");
  return decodeBase64(
    value.replace(/-/gu, "+").replace(/_/gu, "/") +
      (remainder ? "=".repeat(4 - remainder) : ""),
  );
}

function decodeJsonSegment(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch (error) {
    if (error instanceof GeoAttestationError) throw error;
    throw new GeoAttestationError("malformed_token");
  }
}

function normalizedCode(value: unknown) {
  return typeof value === "string" && /^[A-Z]{2}$/u.test(value)
    ? value
    : null;
}

export function trackingPolicyForRegion(
  country: unknown,
  regionCode: unknown,
): TrackingPolicyMode {
  const normalizedCountry = normalizedCode(country);
  const normalizedRegion = normalizedCode(regionCode);
  if (
    normalizedCountry !== "US" ||
    !normalizedRegion ||
    !VALID_US_STATE_CODES.has(normalizedRegion)
  ) {
    return "explicit-consent";
  }
  return EXPLICIT_CONSENT_US_STATES.has(normalizedRegion)
    ? "explicit-consent"
    : "us-opt-out";
}

function assertPayload(
  value: unknown,
  nowSeconds: number,
  expectedPolicyVersion: string,
): GeoAttestationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GeoAttestationError("malformed_token");
  }
  const payload = value as Record<string, unknown>;
  if (!exactKeys(payload, PAYLOAD_KEYS)) {
    throw new GeoAttestationError("unexpected_claims");
  }
  if (payload.policy_version !== expectedPolicyVersion) {
    throw new GeoAttestationError("wrong_version");
  }
  if (payload.geo_source !== "netlify_context_geo") {
    throw new GeoAttestationError("unexpected_claims");
  }
  if (!RESOLUTION_OUTCOMES.has(String(payload.resolution_outcome))) {
    throw new GeoAttestationError("unexpected_claims");
  }
  if (
    payload.effective_policy !== "us-opt-out" &&
    payload.effective_policy !== "explicit-consent"
  ) {
    throw new GeoAttestationError("policy_mismatch");
  }
  if (
    payload.country_code !== null &&
    !normalizedCode(payload.country_code)
  ) {
    throw new GeoAttestationError("invalid_country");
  }
  if (
    payload.subdivision_code !== null &&
    !normalizedCode(payload.subdivision_code)
  ) {
    throw new GeoAttestationError("invalid_region");
  }
  if (
    !Number.isInteger(payload.issued_at) ||
    !Number.isInteger(payload.expires_at) ||
    (payload.issued_at as number) > nowSeconds + MAX_CLOCK_SKEW_SECONDS ||
    (payload.expires_at as number) <= (payload.issued_at as number) ||
    (payload.expires_at as number) - (payload.issued_at as number) >
      MAX_TOKEN_LIFETIME_SECONDS
  ) {
    throw new GeoAttestationError("issued_at_invalid");
  }
  if ((payload.expires_at as number) <= nowSeconds) {
    throw new GeoAttestationError("expired_token");
  }
  if (
    (payload.issued_at as number) <
    nowSeconds - MAX_TOKEN_LIFETIME_SECONDS - MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new GeoAttestationError("issued_at_invalid");
  }

  const country = payload.country_code as string | null;
  const region = payload.subdivision_code as string | null;
  const outcome = payload.resolution_outcome as string;
  const expectedPolicy = trackingPolicyForRegion(country, region);
  const validSemanticCombination =
    (country === null &&
      region === null &&
      outcome === "country_unresolved") ||
    (country !== null &&
      country !== "US" &&
      region === null &&
      outcome === "resolved_non_us") ||
    (country === "US" &&
      region === null &&
      (outcome === "us_subdivision_missing" ||
        outcome === "us_subdivision_invalid")) ||
    (country === "US" &&
      region !== null &&
      VALID_US_STATE_CODES.has(region) &&
      ((EXPLICIT_CONSENT_US_STATES.has(region) &&
        outcome === "resolved_explicit_consent_us_state") ||
        (!EXPLICIT_CONSENT_US_STATES.has(region) &&
          outcome === "resolved_us_state")));
  if (
    !validSemanticCombination ||
    payload.effective_policy !== expectedPolicy
  ) {
    throw new GeoAttestationError("policy_mismatch");
  }
  return payload as GeoAttestationPayload;
}

export async function verifyGeoAttestationToken(
  token: unknown,
  options: VerifyOptions = {},
) {
  if (typeof token !== "string" || token.length === 0) {
    throw new GeoAttestationError("missing_token");
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new GeoAttestationError("malformed_token");
  }
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new GeoAttestationError("malformed_token");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const headerValue = decodeJsonSegment(encodedHeader);
  if (!headerValue || typeof headerValue !== "object" || Array.isArray(headerValue)) {
    throw new GeoAttestationError("malformed_token");
  }
  const header = headerValue as Record<string, unknown>;
  if (!exactKeys(header, HEADER_KEYS) || header.alg !== "EdDSA" || header.typ !== "JWT") {
    throw new GeoAttestationError("unexpected_claims");
  }
  if (header.aud !== (options.expectedAudience ?? GEO_ATTESTATION_AUDIENCE)) {
    throw new GeoAttestationError("wrong_audience");
  }

  let publicKey: CryptoKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "spki",
      decodeBase64(
        options.publicKeySpkiBase64 ?? GEO_ATTESTATION_PUBLIC_KEY_SPKI_B64,
      ),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    throw new GeoAttestationError("invalid_signature");
  }
  let signatureValid = false;
  try {
    signatureValid = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    throw new GeoAttestationError("invalid_signature");
  }
  if (!signatureValid) {
    throw new GeoAttestationError("invalid_signature");
  }

  const payload = assertPayload(
    decodeJsonSegment(encodedPayload),
    options.nowSeconds ?? Math.floor(Date.now() / 1_000),
    options.expectedPolicyVersion ?? GEO_POLICY_VERSION,
  );
  return payload;
}

function resultFromPayload(
  token: string,
  payload: GeoAttestationPayload,
  resolutionReason: GeoResolutionReason,
  retryAttempted: boolean,
  retrySucceeded: boolean,
): GeoPolicyResult {
  return {
    mode: trackingPolicyForRegion(
      payload.country_code,
      payload.subdivision_code,
    ),
    token,
    geoSource: payload.geo_source,
    country: payload.country_code,
    regionCode: payload.subdivision_code,
    resolutionReason,
    policyVersion: payload.policy_version,
    retryAttempted,
    retrySucceeded,
    issuedAt: payload.issued_at,
    expiresAt: payload.expires_at,
  };
}

function failureResult(reason: GeoResolutionReason): GeoPolicyResult {
  return {
    mode: "explicit-consent",
    token: null,
    geoSource: "unknown",
    country: null,
    regionCode: null,
    resolutionReason: reason,
    policyVersion: null,
    retryAttempted: false,
    retrySucceeded: false,
    issuedAt: null,
    expiresAt: null,
  };
}

function errorReason(error: unknown) {
  return error instanceof GeoAttestationError
    ? error.reason
    : "attestation_fetch_failed";
}

async function fetchOnce(options: RequestOptions) {
  const controller = new AbortController();
  let timedOut = false;
  const callerAborted = () => controller.abort();
  if (options.signal?.aborted) {
    throw new GeoAttestationError("attestation_fetch_failed");
  }
  options.signal?.addEventListener("abort", callerAborted, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? GEO_ATTESTATION_TIMEOUT_MS);

  try {
    const response = await (options.fetcher ?? fetch)(GEO_ATTESTATION_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GeoAttestationError("attestation_fetch_failed");
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GeoAttestationError("missing_token");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new GeoAttestationError("missing_token");
    }
    const responseBody = body as Record<string, unknown>;
    if (!exactKeys(responseBody, ["token"])) {
      throw new GeoAttestationError("unexpected_claims");
    }
    const token = responseBody.token;
    const payload = await verifyGeoAttestationToken(token, options);
    return { token: token as string, payload };
  } catch (error) {
    if (timedOut) throw new GeoAttestationError("attestation_timeout");
    if (error instanceof GeoAttestationError) throw error;
    throw new GeoAttestationError("attestation_fetch_failed");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", callerAborted);
  }
}

function defaultWait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new GeoAttestationError("attestation_fetch_failed"));
      },
      { once: true },
    );
  });
}

async function requestFreshPolicy(options: RequestOptions) {
  let first: Awaited<ReturnType<typeof fetchOnce>>;
  try {
    first = await fetchOnce(options);
  } catch (error) {
    return failureResult(errorReason(error));
  }

  const unresolvedUs =
    first.payload.country_code === "US" &&
    first.payload.subdivision_code === null;
  if (!unresolvedUs) {
    const reason: GeoResolutionReason = first.payload.country_code
      ? "resolved_first_attempt"
      : "missing_country";
    return resultFromPayload(first.token, first.payload, reason, false, false);
  }

  try {
    await (options.wait ?? defaultWait)(
      options.retryDelayMs ?? GEO_ATTESTATION_RETRY_DELAY_MS,
      options.signal,
    );
    const second = await fetchOnce(options);
    if (
      second.payload.country_code === "US" &&
      second.payload.subdivision_code !== null
    ) {
      return resultFromPayload(
        second.token,
        second.payload,
        "resolved_after_retry",
        true,
        true,
      );
    }
    const reason: GeoResolutionReason =
      second.payload.resolution_outcome === "us_subdivision_invalid"
        ? "invalid_region"
        : "missing_region";
    return resultFromPayload(second.token, second.payload, reason, true, false);
  } catch (error) {
    const result = resultFromPayload(
      first.token,
      first.payload,
      errorReason(error),
      true,
      false,
    );
    return result;
  }
}

function mayUseSharedBrowserCache(options: RequestOptions) {
  return (
    !options.fetcher &&
    options.nowSeconds === undefined &&
    options.publicKeySpkiBase64 === undefined &&
    options.expectedAudience === undefined &&
    options.expectedPolicyVersion === undefined &&
    options.retryDelayMs === undefined &&
    options.wait === undefined
  );
}

function cacheIsFresh(result: GeoPolicyResult) {
  return (
    result.token !== null &&
    result.expiresAt !== null &&
    result.expiresAt - Math.floor(Date.now() / 1_000) >
      GEO_ATTESTATION_MIN_FRESHNESS_SECONDS
  );
}

export async function requestTrackingPolicyAttestation(
  options: RequestOptions = {},
): Promise<GeoPolicyResult> {
  const useCache = mayUseSharedBrowserCache(options);
  if (useCache && !options.forceRefresh && cachedPolicy && cacheIsFresh(cachedPolicy)) {
    return cachedPolicy;
  }
  if (useCache && !options.forceRefresh && policyRequestInFlight) {
    return policyRequestInFlight;
  }

  const request = requestFreshPolicy(options);
  if (useCache) policyRequestInFlight = request;
  try {
    const result = await request;
    if (useCache && cacheIsFresh(result)) {
      cachedPolicy = result;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(GEO_POLICY_UPDATED_EVENT));
      }
    }
    return result;
  } finally {
    if (useCache && policyRequestInFlight === request) {
      policyRequestInFlight = null;
    }
  }
}

export function resetGeoAttestationCacheForTests() {
  cachedPolicy = null;
  policyRequestInFlight = null;
}

export function readCachedTrackingPolicy() {
  return cachedPolicy && cacheIsFresh(cachedPolicy) ? cachedPolicy : null;
}

export async function submittedTrackingPolicy(
  token: unknown,
  diagnostics: {
    resolutionReason?: unknown;
    retryAttempted?: unknown;
    retrySucceeded?: unknown;
  } = {},
  options: VerifyOptions = {},
): Promise<GeoPolicyResult> {
  try {
    const payload = await verifyGeoAttestationToken(token, options);
    const retryAttempted = diagnostics.retryAttempted === true;
    const retrySucceeded =
      retryAttempted &&
      diagnostics.retrySucceeded === true &&
      payload.country_code === "US" &&
      payload.subdivision_code !== null;
    let reason: GeoResolutionReason;
    if (retrySucceeded) {
      reason = "resolved_after_retry";
    } else if (payload.country_code === null) {
      reason = "missing_country";
    } else if (
      payload.country_code === "US" &&
      payload.subdivision_code === null
    ) {
      reason =
        payload.resolution_outcome === "us_subdivision_invalid"
          ? "invalid_region"
          : "missing_region";
    } else {
      reason = "resolved_first_attempt";
    }
    const submittedReason = diagnostics.resolutionReason;
    if (
      retryAttempted &&
      payload.country_code === "US" &&
      payload.subdivision_code === null &&
      (submittedReason === "attestation_fetch_failed" ||
        submittedReason === "attestation_timeout")
    ) {
      reason = submittedReason;
    }
    return resultFromPayload(
      token as string,
      payload,
      reason,
      retryAttempted,
      retrySucceeded,
    );
  } catch (error) {
    const verifiedReason = errorReason(error);
    const submittedReason = diagnostics.resolutionReason;
    const reason =
      verifiedReason === "missing_token" &&
      (submittedReason === "attestation_fetch_failed" ||
        submittedReason === "attestation_timeout")
        ? submittedReason
        : verifiedReason;
    return failureResult(reason);
  }
}
