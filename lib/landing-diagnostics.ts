export const LANDING_DIAGNOSTIC_TTL_HOURS = 48;
export const LANDING_DIAGNOSTIC_API_PATH = "/api/landing-diagnostics";

export const landingDiagnosticMilestones = [
  "html_executed",
  "dom_ready",
  "hydrated",
  "geo_resolved",
  "pixel_initialized",
  "pixel_script_loaded",
  "pixel_failure",
  "pageview_attempted",
  "pageview_network_observed",
  "lead_attempted",
  "lead_completed",
  "client_failure",
] as const;

export type LandingDiagnosticMilestone =
  (typeof landingDiagnosticMilestones)[number];

export const landingDiagnosticGeoStatuses = [
  "success",
  "timeout",
  "fetch_failed",
  "unresolved",
  "invalid",
] as const;

export type LandingDiagnosticGeoStatus =
  (typeof landingDiagnosticGeoStatuses)[number];

export const landingDiagnosticGeoFailureCodes = [
  "timeout",
  "fetch_failed",
  "missing_country",
  "missing_region",
  "invalid_region",
  "missing_token",
  "invalid_token",
  "policy_mismatch",
] as const;

export type LandingDiagnosticGeoFailureCode =
  (typeof landingDiagnosticGeoFailureCodes)[number];

export const landingDiagnosticPixelFailureCodes = [
  "bootstrap_error",
  "script_error",
  "script_timeout",
  "fbq_unavailable",
] as const;

export type LandingDiagnosticPixelFailureCode =
  (typeof landingDiagnosticPixelFailureCodes)[number];

export const landingDiagnosticClientFailureCodes = [
  "uncaught_error",
  "unhandled_rejection",
  "collector_error",
] as const;

export type LandingDiagnosticClientFailureCode =
  (typeof landingDiagnosticClientFailureCodes)[number];

export type LandingDiagnosticEvent = {
  milestone: LandingDiagnosticMilestone;
  geoStatus?: LandingDiagnosticGeoStatus;
  geoPolicy?: "us-opt-out" | "explicit-consent";
  geoFailureCode?: LandingDiagnosticGeoFailureCode;
  pixelFailureCode?: LandingDiagnosticPixelFailureCode;
  clientFailureCode?: LandingDiagnosticClientFailureCode;
};

export type LandingDiagnosticAttribution = {
  campaignId: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CAMPAIGN_ID_PATTERN = /^\d{1,32}$/u;
const META_SOURCES = new Set(["fb", "facebook", "ig", "instagram", "meta"]);
const PAID_MEDIA = new Set(["paid", "paid_social", "cpc"]);
const TEST_MARKER = /(?:^|[-_])(codex|test|qa|smoke|preview|synthetic)(?:[-_]|$)/iu;
const NON_VISITOR_USER_AGENT =
  /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|crawler|spider|\bbot\b/iu;

export function isLandingDiagnosticId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function sanitizeLandingDiagnosticCampaignId(value: unknown) {
  return typeof value === "string" && CAMPAIGN_ID_PATTERN.test(value)
    ? value
    : null;
}

export function metaLandingAttribution(
  url: URL,
  userAgent: string | null = null,
): LandingDiagnosticAttribution | null {
  if (url.pathname !== "/") return null;
  if (userAgent && NON_VISITOR_USER_AGENT.test(userAgent)) return null;

  const source = (url.searchParams.get("utm_source") ?? "").toLowerCase();
  const medium = (url.searchParams.get("utm_medium") ?? "").toLowerCase();
  const campaign = url.searchParams.get("utm_campaign");
  const content = url.searchParams.get("utm_content");
  const term = url.searchParams.get("utm_term");
  const clickId = url.searchParams.get("fbclid");
  const inspectedValues = [source, medium, campaign, content, term, clickId];

  if (
    inspectedValues.some(
      (value) => typeof value === "string" && TEST_MARKER.test(value),
    )
  ) {
    return null;
  }

  const hasMetaClickId = typeof clickId === "string" && clickId.length > 0;
  const hasPaidMetaUtm = META_SOURCES.has(source) && PAID_MEDIA.has(medium);
  if (!hasMetaClickId && !hasPaidMetaUtm) return null;

  return {
    campaignId: sanitizeLandingDiagnosticCampaignId(campaign),
  };
}

export function parseLandingDiagnosticEvents(
  value: unknown,
): LandingDiagnosticEvent[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) {
    return null;
  }

  const allowedMilestones = new Set<string>(landingDiagnosticMilestones);
  const allowedGeoStatuses = new Set<string>(landingDiagnosticGeoStatuses);
  const allowedGeoFailureCodes = new Set<string>(
    landingDiagnosticGeoFailureCodes,
  );
  const allowedPixelFailureCodes = new Set<string>(
    landingDiagnosticPixelFailureCodes,
  );
  const allowedClientFailureCodes = new Set<string>(
    landingDiagnosticClientFailureCodes,
  );
  const allowedGeoPolicies = new Set(["us-opt-out", "explicit-consent"]);
  const allowedKeys = new Set([
    "milestone",
    "geoStatus",
    "geoPolicy",
    "geoFailureCode",
    "pixelFailureCode",
    "clientFailureCode",
  ]);

  const parsed: LandingDiagnosticEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) return null;
    if (
      typeof candidate.milestone !== "string" ||
      !allowedMilestones.has(candidate.milestone)
    ) {
      return null;
    }
    if (
      candidate.geoStatus !== undefined &&
      (typeof candidate.geoStatus !== "string" ||
        !allowedGeoStatuses.has(candidate.geoStatus))
    ) {
      return null;
    }
    if (
      candidate.geoPolicy !== undefined &&
      (typeof candidate.geoPolicy !== "string" ||
        !allowedGeoPolicies.has(candidate.geoPolicy))
    ) {
      return null;
    }
    if (
      candidate.geoFailureCode !== undefined &&
      (typeof candidate.geoFailureCode !== "string" ||
        !allowedGeoFailureCodes.has(candidate.geoFailureCode))
    ) {
      return null;
    }
    if (
      candidate.pixelFailureCode !== undefined &&
      (typeof candidate.pixelFailureCode !== "string" ||
        !allowedPixelFailureCodes.has(candidate.pixelFailureCode))
    ) {
      return null;
    }
    if (
      candidate.clientFailureCode !== undefined &&
      (typeof candidate.clientFailureCode !== "string" ||
        !allowedClientFailureCodes.has(candidate.clientFailureCode))
    ) {
      return null;
    }

    const event = candidate as LandingDiagnosticEvent;
    if (
      event.milestone === "geo_resolved" &&
      (!event.geoStatus || !event.geoPolicy)
    ) {
      return null;
    }
    if (
      event.milestone === "pixel_failure" &&
      !event.pixelFailureCode
    ) {
      return null;
    }
    if (
      event.milestone === "client_failure" &&
      !event.clientFailureCode
    ) {
      return null;
    }
    parsed.push(event);
  }
  return parsed;
}

export function landingDiagnosticBootstrapScript(id: string) {
  if (!isLandingDiagnosticId(id)) {
    throw new Error("A valid landing diagnostic ID is required.");
  }

  const apiPath = JSON.stringify(LANDING_DIAGNOSTIC_API_PATH);
  const diagnosticId = JSON.stringify(id);
  return `(()=>{try{const i=${diagnosticId},u=${apiPath},q=[],s=new Set;let f=0;const p=e=>fetch(u,{method:'POST',headers:{'content-type':'application/json'},credentials:'omit',cache:'no-store',keepalive:true,referrerPolicy:'no-referrer',body:JSON.stringify({id:i,events:e})}).catch(()=>{}),x=()=>{if(f||!q.length)return;f=1;const run=()=>{f=0;if(q.length)p(q.splice(0,q.length))};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1500});else setTimeout(run,0)},r=(m,d={})=>{if(s.has(m))return;s.add(m);q.push({milestone:m,...d});x()};window.__frameLandingDiagnostic={record:r};r('html_executed');const dom=()=>r('dom_ready');if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',dom,{once:true});else dom();window.addEventListener('error',()=>r('client_failure',{clientFailureCode:'uncaught_error'}),{once:true});window.addEventListener('unhandledrejection',()=>r('client_failure',{clientFailureCode:'unhandled_rejection'}),{once:true});window.addEventListener('pagehide',()=>{if(q.length)p(q.splice(0,q.length))},{once:true})}catch{}})();`;
}
