"use client";

import type {
  LandingDiagnosticClientFailureCode,
  LandingDiagnosticEvent,
  LandingDiagnosticGeoFailureCode,
  LandingDiagnosticGeoStatus,
  LandingDiagnosticPixelFailureCode,
} from "@/lib/landing-diagnostics";
import type {
  GeoPolicyResult,
  GeoResolutionReason,
} from "@/lib/geo-attestation";

type LandingDiagnosticRuntime = {
  record(event: LandingDiagnosticEvent["milestone"], detail?: Omit<LandingDiagnosticEvent, "milestone">): void;
};

declare global {
  interface Window {
    __frameLandingDiagnostic?: LandingDiagnosticRuntime;
  }
}

let pixelObserverStarted = false;

export function recordLandingDiagnostic(
  milestone: LandingDiagnosticEvent["milestone"],
  detail: Omit<LandingDiagnosticEvent, "milestone"> = {},
) {
  try {
    window.__frameLandingDiagnostic?.record(milestone, detail);
  } catch {
    // Diagnostics are strictly fail-open and never affect the page lifecycle.
  }
}

function isMetaPageViewResource(entry: PerformanceEntry) {
  try {
    const url = new URL(entry.name);
    return (
      url.hostname === "www.facebook.com" &&
      (url.pathname === "/tr" || url.pathname === "/tr/") &&
      url.searchParams.get("ev") === "PageView"
    );
  } catch {
    return false;
  }
}

export function startLandingDiagnosticResourceObserver() {
  if (pixelObserverStarted || typeof PerformanceObserver === "undefined") {
    return () => undefined;
  }
  pixelObserverStarted = true;

  const inspect = (entries: PerformanceEntry[]) => {
    if (entries.some(isMetaPageViewResource)) {
      recordLandingDiagnostic("pageview_network_observed");
    }
  };
  inspect(performance.getEntriesByType("resource"));

  const observer = new PerformanceObserver((list) => inspect(list.getEntries()));
  try {
    observer.observe({ type: "resource", buffered: true });
  } catch {
    observer.observe({ entryTypes: ["resource"] });
  }

  return () => {
    observer.disconnect();
    pixelObserverStarted = false;
  };
}

function geoFailureCode(
  reason: GeoResolutionReason,
): LandingDiagnosticGeoFailureCode | undefined {
  if (reason === "attestation_timeout") return "timeout";
  if (reason === "attestation_fetch_failed") return "fetch_failed";
  if (reason === "missing_country") return "missing_country";
  if (reason === "missing_region") return "missing_region";
  if (reason === "invalid_region") return "invalid_region";
  if (reason === "missing_token") return "missing_token";
  if (reason === "policy_mismatch") return "policy_mismatch";
  if (
    reason === "malformed_token" ||
    reason === "invalid_signature" ||
    reason === "expired_token" ||
    reason === "issued_at_invalid" ||
    reason === "wrong_version" ||
    reason === "wrong_audience" ||
    reason === "unexpected_claims" ||
    reason === "invalid_country"
  ) {
    return "invalid_token";
  }
  return undefined;
}

function geoStatus(reason: GeoResolutionReason): LandingDiagnosticGeoStatus {
  if (reason === "resolved_first_attempt" || reason === "resolved_after_retry") {
    return "success";
  }
  if (reason === "attestation_timeout") return "timeout";
  if (reason === "attestation_fetch_failed") return "fetch_failed";
  if (
    reason === "missing_country" ||
    reason === "missing_region" ||
    reason === "invalid_region"
  ) {
    return "unresolved";
  }
  return "invalid";
}

export function recordLandingDiagnosticGeo(result: GeoPolicyResult) {
  recordLandingDiagnostic("geo_resolved", {
    geoStatus: geoStatus(result.resolutionReason),
    geoPolicy: result.mode,
    geoFailureCode: geoFailureCode(result.resolutionReason),
  });
}

export function recordLandingDiagnosticPixelFailure(
  code: LandingDiagnosticPixelFailureCode,
) {
  recordLandingDiagnostic("pixel_failure", { pixelFailureCode: code });
}

export function recordLandingDiagnosticClientFailure(
  code: LandingDiagnosticClientFailureCode,
) {
  recordLandingDiagnostic("client_failure", { clientFailureCode: code });
}
