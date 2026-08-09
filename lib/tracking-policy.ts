export const TRACKING_POLICY_ENDPOINT = "/api/privacy/tracking-policy";

export type TrackingPolicyMode = "explicit-consent" | "us-opt-out";
export type OptionalTrackingConsent = "granted" | "denied";

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
