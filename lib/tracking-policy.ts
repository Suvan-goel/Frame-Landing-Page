export const TRACKING_POLICY_ENDPOINT = "/api/privacy/tracking-policy";
export const TRACKING_POLICY_REQUEST_TIMEOUT_MS = 2_500;

export type TrackingPolicyMode = "explicit-consent" | "us-opt-out";
export type OptionalTrackingConsent = "granted" | "denied";

type TrackingPolicyRequestOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type CloudflareLocation = {
  country?: unknown;
  regionCode?: unknown;
};

type RequestWithCloudflareLocation = Request & {
  cf?: CloudflareLocation;
};

// Frame uses an explicit-consent policy in US states with broad consumer-health
// privacy laws. Review this list whenever the site's data flows or state laws
// change. An unknown state always fails closed to explicit consent.
const US_HEALTH_PRIVACY_OPT_IN_REGIONS = new Set(["NV", "WA"]);

function normalizedRegionPart(value: unknown) {
  return typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : null;
}

export function trackingPolicyForRegion(
  country: unknown,
  regionCode: unknown,
): TrackingPolicyMode {
  const normalizedCountry = normalizedRegionPart(country);
  const normalizedRegionCode = normalizedRegionPart(regionCode);

  if (normalizedCountry !== "US" || !normalizedRegionCode) {
    return "explicit-consent";
  }

  return US_HEALTH_PRIVACY_OPT_IN_REGIONS.has(normalizedRegionCode)
    ? "explicit-consent"
    : "us-opt-out";
}

export function trackingPolicyForRequest(request: Request): TrackingPolicyMode {
  const location = (request as RequestWithCloudflareLocation).cf;
  return trackingPolicyForRegion(location?.country, location?.regionCode);
}

export function effectiveTrackingConsent(input: {
  storedConsent: OptionalTrackingConsent | null;
  policyMode: TrackingPolicyMode;
  globalPrivacyControl: boolean;
}): OptionalTrackingConsent | null {
  if (input.globalPrivacyControl) return "denied";
  if (input.storedConsent) return input.storedConsent;
  return input.policyMode === "us-opt-out" ? "granted" : null;
}

export async function requestTrackingPolicyMode(
  options: TrackingPolicyRequestOptions = {},
): Promise<TrackingPolicyMode> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) return "explicit-consent";
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? TRACKING_POLICY_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetcher ?? fetch)(TRACKING_POLICY_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) return "explicit-consent";
    const payload = (await response.json()) as { mode?: unknown };
    return payload.mode === "us-opt-out" ? "us-opt-out" : "explicit-consent";
  } catch {
    return "explicit-consent";
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
