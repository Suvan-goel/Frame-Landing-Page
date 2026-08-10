import type {
  OptionalTrackingConsent,
  TrackingPolicyMode,
} from "./tracking-policy";

export const META_PIXEL_ID = "1068997465474786";
export const META_TRACKING_POLICY_HEADER = "x-frame-tracking-policy";
export const META_TRACKING_STATE_VERSION = 1;

export type MetaTrackingClientState = {
  version: typeof META_TRACKING_STATE_VERSION;
  storedConsent: OptionalTrackingConsent | null;
  globalPrivacyControl: boolean;
  pixelReady: boolean;
  eventSourceUrl: string | null;
  fbp: string | null;
  fbc: string | null;
};

export type MetaTrackingDecisionReason =
  | "allowed_explicit_consent"
  | "allowed_stored_consent"
  | "allowed_us_opt_out"
  | "denied_explicit_consent_required"
  | "denied_global_privacy_control"
  | "denied_missing_client_state"
  | "denied_stored_choice";

export type MetaTrackingDecision = {
  permitted: boolean;
  reason: MetaTrackingDecisionReason;
};

export function resolveMetaTrackingDecision(input: {
  policyMode: TrackingPolicyMode;
  storedConsent: OptionalTrackingConsent | null;
  globalPrivacyControl: boolean;
  clientStateValid: boolean;
}): MetaTrackingDecision {
  if (!input.clientStateValid) {
    return { permitted: false, reason: "denied_missing_client_state" };
  }
  if (input.globalPrivacyControl) {
    return {
      permitted: false,
      reason: "denied_global_privacy_control",
    };
  }
  if (input.storedConsent === "denied") {
    return { permitted: false, reason: "denied_stored_choice" };
  }
  if (input.storedConsent === "granted") {
    return {
      permitted: true,
      reason:
        input.policyMode === "explicit-consent"
          ? "allowed_explicit_consent"
          : "allowed_stored_consent",
    };
  }
  if (input.policyMode === "us-opt-out") {
    return { permitted: true, reason: "allowed_us_opt_out" };
  }
  return {
    permitted: false,
    reason: "denied_explicit_consent_required",
  };
}
