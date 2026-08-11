import {
  requestTrackingPolicyAttestation,
  type TrackingPolicyMode,
} from "./geo-attestation.ts";

export { trackingPolicyForRegion } from "./geo-attestation.ts";
export type { TrackingPolicyMode } from "./geo-attestation.ts";
export type OptionalTrackingConsent = "granted" | "denied";

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
  options: Parameters<typeof requestTrackingPolicyAttestation>[0] = {},
): Promise<TrackingPolicyMode> {
  return (await requestTrackingPolicyAttestation(options)).mode;
}
