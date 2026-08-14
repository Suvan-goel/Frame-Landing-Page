"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  effectiveTrackingConsent,
  type OptionalTrackingConsent,
  type TrackingPolicyMode,
} from "../../lib/tracking-policy";
import {
  GEO_POLICY_UPDATED_EVENT,
  readCachedTrackingPolicy,
  requestTrackingPolicyAttestation,
  type GeoPolicyResult,
} from "../../lib/geo-attestation";
import {
  META_PIXEL_ID,
  META_TRACKING_STATE_VERSION,
  type MetaTrackingClientState,
} from "../../lib/meta-tracking";
import type { ReservationFunnelEventName } from "../../lib/funnel-analytics";
import {
  recordLandingDiagnostic,
  recordLandingDiagnosticGeo,
  recordLandingDiagnosticPixelFailure,
  startLandingDiagnosticResourceObserver,
} from "./landing-diagnostics.client";

const META_LEAD_RECORDED_STORAGE_KEY = "frame-meta-lead-recorded-v1";
const META_PENDING_LEADS_STORAGE_KEY = "frame-meta-pending-leads-v1";
const META_PENDING_LEAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const META_PENDING_LEAD_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OPTIONAL_TRACKING_CONSENT_STORAGE_KEY =
  "frame-optional-tracking-consent-v1";
export { META_PIXEL_ID } from "../../lib/meta-tracking";

type OptionalTrackingConsentSnapshot = OptionalTrackingConsent | null | "pending";

const OPTIONAL_TRACKING_CONSENT_EVENT = "frame:optional-tracking-consent";
let inMemoryTrackingConsent: OptionalTrackingConsent | null = null;
let inMemoryEffectiveTrackingConsent: OptionalTrackingConsent | null = null;
let inMemoryPixelAllowedOnRoute = false;
let inMemoryPendingMetaLeads: PendingMetaLead[] = [];
const metaLeadDeliveriesInFlight = new Set<string>();
const metaLeadsRecordedInMemory = new Set<string>();
const observedMetaPixelScripts = new WeakSet<HTMLScriptElement>();

type PendingMetaLead = {
  eventId: string;
  queuedAt: number;
};

export type WaitlistAnalyticsEvent = ReservationFunnelEventName;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }

  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

const META_PIXEL_BOOTSTRAP = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`;

const PRIVATE_PREFIXES = ["/contributors", "/admin", "/api"];
const PRIVATE_EXACT_PATHS = [
  "/founding-contributors/review",
  "/founding-contributors/success",
];
const PRIVATE_ADDITIONAL_PREFIXES = ["/preorder", "/preorders"];
const NO_PIXEL_EXACT_PATHS = ["/contact", "/privacy", "/unsubscribe"];
function isLocalBrowserHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname.toLowerCase(),
  );
}

function readOptionalTrackingConsent(): OptionalTrackingConsent | null {
  try {
    const value = window.localStorage.getItem(
      OPTIONAL_TRACKING_CONSENT_STORAGE_KEY,
    );
    if (value === "granted" || value === "denied") {
      inMemoryTrackingConsent = value;
      return value;
    }
    return inMemoryTrackingConsent;
  } catch {
    return inMemoryTrackingConsent;
  }
}

function subscribeToOptionalTrackingConsent(onChange: () => void) {
  const syncConsentAcrossTabs = (event: StorageEvent) => {
    if (event.key !== OPTIONAL_TRACKING_CONSENT_STORAGE_KEY) return;
    inMemoryTrackingConsent =
      event.newValue === "granted" || event.newValue === "denied"
        ? event.newValue
        : null;
    onChange();
  };

  window.addEventListener("storage", syncConsentAcrossTabs);
  window.addEventListener(OPTIONAL_TRACKING_CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", syncConsentAcrossTabs);
    window.removeEventListener(OPTIONAL_TRACKING_CONSENT_EVENT, onChange);
  };
}

function readServerOptionalTrackingConsent(): OptionalTrackingConsentSnapshot {
  return "pending";
}

function subscribeToGlobalPrivacyControl() {
  return () => undefined;
}

function readGlobalPrivacyControl(): boolean | "pending" {
  return navigator.globalPrivacyControl === true;
}

function readServerGlobalPrivacyControl(): boolean | "pending" {
  return "pending";
}

function removeMetaPixel() {
  document.getElementById("meta-pixel")?.remove();
  document
    .querySelectorAll('script[src*="connect.facebook.net"]')
    .forEach((script) => script.remove());
  window.fbq = undefined;
  (window as Window & { _fbq?: unknown })._fbq = undefined;
}

function observeMetaPixelScript(script: HTMLScriptElement) {
  if (observedMetaPixelScripts.has(script)) return;
  observedMetaPixelScripts.add(script);

  let settled = false;
  const settle = (outcome: "loaded" | "error" | "timeout") => {
    if (settled) return;
    settled = true;
    if (outcome === "loaded") {
      recordLandingDiagnostic("pixel_script_loaded");
    } else {
      recordLandingDiagnosticPixelFailure(
        outcome === "error" ? "script_error" : "script_timeout",
      );
    }
  };
  script.addEventListener("load", () => settle("loaded"), { once: true });
  script.addEventListener("error", () => settle("error"), { once: true });
  window.setTimeout(() => settle("timeout"), 5_000);
}

function clearMetaCookies() {
  const metaCookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name?.startsWith("_fb")));

  for (const name of metaCookieNames) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.framewearable.com; SameSite=Lax`;
  }
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)).slice(0, 500) : null;
}

function readPendingMetaLeads() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(META_PENDING_LEADS_STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return inMemoryPendingMetaLeads;
    const oldestAllowed = Date.now() - META_PENDING_LEAD_MAX_AGE_MS;
    const stored = parsed.filter(
      (value): value is PendingMetaLead =>
        Boolean(value) &&
        typeof value === "object" &&
        UUID_PATTERN.test((value as PendingMetaLead).eventId) &&
        typeof (value as PendingMetaLead).queuedAt === "number" &&
        (value as PendingMetaLead).queuedAt >= oldestAllowed,
    );
    const inMemory = inMemoryPendingMetaLeads.filter(
      (lead) => lead.queuedAt >= oldestAllowed,
    );
    const combined = [...stored, ...inMemory].filter(
      (lead, index, leads) =>
        leads.findIndex((candidate) => candidate.eventId === lead.eventId) ===
        index,
    );
    inMemoryPendingMetaLeads = combined.slice(-META_PENDING_LEAD_LIMIT);
    return inMemoryPendingMetaLeads;
  } catch {
    return inMemoryPendingMetaLeads;
  }
}

function writePendingMetaLeads(leads: PendingMetaLead[]) {
  inMemoryPendingMetaLeads = leads;
  try {
    const storedConsent = readOptionalTrackingConsent();
    const storagePermitted =
      navigator.globalPrivacyControl !== true &&
      storedConsent !== "denied" &&
      (storedConsent === "granted" ||
        inMemoryEffectiveTrackingConsent === "granted");
    if (leads.length && storagePermitted) {
      window.localStorage.setItem(
        META_PENDING_LEADS_STORAGE_KEY,
        JSON.stringify(leads),
      );
    } else {
      window.localStorage.removeItem(META_PENDING_LEADS_STORAGE_KEY);
    }
  } catch {
    // Pending delivery remains best effort if browser storage is unavailable.
  }
}

function clearPendingMetaLeads() {
  writePendingMetaLeads([]);
}

function queueMetaLead(eventId: string) {
  const pending = readPendingMetaLeads();
  if (!pending.some((lead) => lead.eventId === eventId)) {
    pending.push({ eventId, queuedAt: Date.now() });
  }
  writePendingMetaLeads(pending);
}

function metaLeadWasRecorded(eventId: string) {
  if (metaLeadsRecordedInMemory.has(eventId)) return true;
  try {
    return (
      window.localStorage.getItem(
        `${META_LEAD_RECORDED_STORAGE_KEY}:Lead:${eventId}`,
      ) === "true"
    );
  } catch {
    return false;
  }
}

function markMetaLeadRecorded(eventId: string) {
  metaLeadsRecordedInMemory.add(eventId);
  try {
    window.localStorage.setItem(
      `${META_LEAD_RECORDED_STORAGE_KEY}:Lead:${eventId}`,
      "true",
    );
  } catch {
    // A queued fbq call should not be repeated solely because storage is unavailable.
  }
}

export function getMetaTrackingContext(): MetaTrackingClientState {
  const storedConsent = readOptionalTrackingConsent();
  const globalPrivacyControl = navigator.globalPrivacyControl === true;
  const identifiersPermitted =
    !globalPrivacyControl &&
    storedConsent !== "denied" &&
    (storedConsent === "granted" ||
      inMemoryEffectiveTrackingConsent === "granted");
  const source = new URL(window.location.href);
  source.search = "";
  source.hash = "";

  return {
    version: META_TRACKING_STATE_VERSION,
    storedConsent,
    globalPrivacyControl,
    pixelReady: typeof window.fbq === "function",
    eventSourceUrl: source.href,
    fbp: identifiersPermitted ? readCookie("_fbp") : null,
    fbc: identifiersPermitted ? readCookie("_fbc") : null,
  };
}

async function notifyMetaLeadDelivery(
  eventId: string,
  geoPolicy: GeoPolicyResult,
) {
  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({
        action: "deliver_meta_lead",
        metaEventId: eventId,
        browserLeadAttempted: true,
        tracking: getMetaTrackingContext(),
        geoAttestationToken: geoPolicy.token,
        geoResolutionReason: geoPolicy.resolutionReason,
        geoRetryAttempted: geoPolicy.retryAttempted,
        geoRetrySucceeded: geoPolicy.retrySucceeded,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function deliverPendingMetaLead(lead: PendingMetaLead) {
  if (metaLeadDeliveriesInFlight.has(lead.eventId)) return;
  metaLeadDeliveriesInFlight.add(lead.eventId);
  try {
    const geoPolicy = await requestTrackingPolicyAttestation();
    const currentConsent = effectiveTrackingConsent({
      storedConsent: readOptionalTrackingConsent(),
      policyMode: geoPolicy.mode,
      globalPrivacyControl: navigator.globalPrivacyControl === true,
    });
    inMemoryEffectiveTrackingConsent = currentConsent;
    if (currentConsent !== "granted") {
      removeMetaPixel();
      clearMetaCookies();
      if (currentConsent === "denied") clearPendingMetaLeads();
      return;
    }
    if (!metaLeadWasRecorded(lead.eventId)) {
      const fbq = window.fbq;
      if (typeof fbq !== "function") return;
      fbq(
        "trackSingle",
        META_PIXEL_ID,
        "Lead",
        { content_name: "Frame updates signup" },
        { eventID: lead.eventId },
      );
      markMetaLeadRecorded(lead.eventId);
    }

    if (await notifyMetaLeadDelivery(lead.eventId, geoPolicy)) {
      writePendingMetaLeads(
        readPendingMetaLeads().filter(
          (candidate) => candidate.eventId !== lead.eventId,
        ),
      );
    }
  } catch {
    // Keep the pending ID so a later route change or visit can replay it.
  } finally {
    metaLeadDeliveriesInFlight.delete(lead.eventId);
  }
}

function replayPendingMetaLeads() {
  if (typeof window === "undefined" || isLocalBrowserHost()) return;
  if (
    navigator.globalPrivacyControl === true ||
    readOptionalTrackingConsent() === "denied" ||
    inMemoryEffectiveTrackingConsent === "denied"
  ) {
    clearPendingMetaLeads();
    return;
  }
  if (
    inMemoryEffectiveTrackingConsent !== "granted" ||
    !inMemoryPixelAllowedOnRoute ||
    typeof window.fbq !== "function"
  ) {
    return;
  }

  for (const lead of readPendingMetaLeads()) {
    void deliverPendingMetaLead(lead);
  }
}

export function isPrivacyChoicesAllowed(pathname: string) {
  return (
    !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_ADDITIONAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_EXACT_PATHS.includes(pathname)
  );
}

export function isMetaPixelAllowed(pathname: string) {
  return isPrivacyChoicesAllowed(pathname) && !NO_PIXEL_EXACT_PATHS.includes(pathname);
}

export function MetaPixelRouteGuard({
  useRedesignedConsent = false,
}: {
  useRedesignedConsent?: boolean;
}) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(
    subscribeToOptionalTrackingConsent,
    readOptionalTrackingConsent,
    readServerOptionalTrackingConsent,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [geoPolicy, setGeoPolicy] = useState<GeoPolicyResult | null>(null);
  const preferencesRef = useRef<HTMLElement>(null);
  const policyMode: TrackingPolicyMode | "pending" =
    geoPolicy?.mode ?? "pending";
  const globalPrivacyControl = useSyncExternalStore(
    subscribeToGlobalPrivacyControl,
    readGlobalPrivacyControl,
    readServerGlobalPrivacyControl,
  );
  const privacyChoicesAllowedOnRoute = isPrivacyChoicesAllowed(pathname);
  const pixelAllowedOnRoute = isMetaPixelAllowed(pathname);
  const consentReady =
    consent !== "pending" &&
    policyMode !== "pending" &&
    globalPrivacyControl !== "pending";
  const effectiveConsent = consentReady
    ? effectiveTrackingConsent({
        storedConsent: consent,
        policyMode,
        globalPrivacyControl,
      })
    : null;
  const requiresInitialChoice =
    consentReady &&
    policyMode === "explicit-consent" &&
    consent === null &&
    !globalPrivacyControl;

  useEffect(() => {
    if (preferencesOpen) preferencesRef.current?.focus();
  }, [preferencesOpen]);

  useEffect(() => {
    recordLandingDiagnostic("hydrated");
    return startLandingDiagnosticResourceObserver();
  }, []);

  useEffect(() => {
    if (!privacyChoicesAllowedOnRoute) return;

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const applyPolicy = (result: GeoPolicyResult) => {
      if (!active) return;
      recordLandingDiagnosticGeo(result);
      setGeoPolicy(result);
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      if (result.expiresAt !== null) {
        const refreshIn = Math.max(
          1_000,
          (result.expiresAt - Math.floor(Date.now() / 1_000) - 15) * 1_000,
        );
        refreshTimer = setTimeout(() => void loadPolicy(true), refreshIn);
      }
    };
    const loadPolicy = async (forceRefresh = false) => {
      const result = await requestTrackingPolicyAttestation({ forceRefresh });
      applyPolicy(result);
    };
    const useLatestSharedPolicy = () => {
      const latest = readCachedTrackingPolicy();
      if (latest) applyPolicy(latest);
    };
    window.addEventListener(GEO_POLICY_UPDATED_EVENT, useLatestSharedPolicy);
    void loadPolicy();

    return () => {
      active = false;
      window.removeEventListener(
        GEO_POLICY_UPDATED_EVENT,
        useLatestSharedPolicy,
      );
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [privacyChoicesAllowedOnRoute]);

  useEffect(() => {
    inMemoryPixelAllowedOnRoute = pixelAllowedOnRoute;
    inMemoryEffectiveTrackingConsent = consentReady ? effectiveConsent : null;
    if (!consentReady) return;

    if (
      isLocalBrowserHost() ||
      !pixelAllowedOnRoute ||
      effectiveConsent !== "granted"
    ) {
      removeMetaPixel();
      if (effectiveConsent !== "granted") {
        clearMetaCookies();
      }
      if (effectiveConsent === "denied") {
        clearPendingMetaLeads();
      }
      return;
    }

    if (typeof window.fbq === "function") {
      recordLandingDiagnostic("pixel_initialized");
      recordLandingDiagnostic("pageview_attempted");
      window.fbq("trackSingle", META_PIXEL_ID, "PageView");
      replayPendingMetaLeads();
      return;
    }
    if (document.getElementById("meta-pixel")) return;

    const script = document.createElement("script");
    script.id = "meta-pixel";
    script.text = META_PIXEL_BOOTSTRAP;
    try {
      document.head.appendChild(script);
    } catch {
      recordLandingDiagnosticPixelFailure("bootstrap_error");
      return;
    }
    if (typeof window.fbq !== "function") {
      recordLandingDiagnosticPixelFailure("fbq_unavailable");
      return;
    }
    recordLandingDiagnostic("pixel_initialized");
    recordLandingDiagnostic("pageview_attempted");
    const externalScript = document.querySelector<HTMLScriptElement>(
      'script[src*="connect.facebook.net/en_US/fbevents.js"]',
    );
    if (externalScript) observeMetaPixelScript(externalScript);
    replayPendingMetaLeads();
  }, [consentReady, effectiveConsent, pathname, pixelAllowedOnRoute]);

  function recordConsent(value: OptionalTrackingConsent) {
    inMemoryTrackingConsent = value;
    try {
      window.localStorage.setItem(
        OPTIONAL_TRACKING_CONSENT_STORAGE_KEY,
        value,
      );
    } catch {
      // The choice still applies for this page when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(OPTIONAL_TRACKING_CONSENT_EVENT));
    setPreferencesOpen(false);
    if (value === "denied") {
      removeMetaPixel();
      clearMetaCookies();
      clearPendingMetaLeads();
    }
  }

  if (!privacyChoicesAllowedOnRoute || !consentReady) return null;

  const showBanner =
    preferencesOpen || (pixelAllowedOnRoute && requiresInitialChoice);
  const defaultOnDisclosure = policyMode === "us-opt-out" && consent === null;

  return (
    <>
      {showBanner ? (
        <section
          ref={preferencesRef}
          tabIndex={-1}
          className={
            useRedesignedConsent
              ? "tracking-consent tracking-consent--redesigned"
              : "tracking-consent"
          }
          aria-labelledby="tracking-consent-title"
          aria-describedby="tracking-consent-description"
        >
          <div className="tracking-consent__copy">
            {useRedesignedConsent ? (
              <div className="tracking-consent__header">
                <p className="eyebrow">Privacy choices</p>
                <Link href="/privacy">Privacy notice</Link>
              </div>
            ) : (
              <p className="eyebrow">Privacy choices</p>
            )}
            <h2 id="tracking-consent-title">Advertising measurement</h2>
            <p id="tracking-consent-description">
              {globalPrivacyControl
                ? "Your browser’s Global Privacy Control is active, so advertising measurement is off."
                : defaultOnDisclosure
                  ? "Meta advertising measurement is allowed on eligible public pages. You can turn it off at any time."
                  : "Help us understand which campaigns are useful. Optional advertising measurement stays off unless you allow it."}
            </p>
            {useRedesignedConsent ? null : (
              <Link href="/privacy">Privacy notice</Link>
            )}
          </div>
          <div className="tracking-consent__actions" aria-label="Optional tracking choices">
            <button
              className="tracking-consent__button"
              type="button"
              aria-pressed={effectiveConsent === "denied"}
              onClick={() => recordConsent("denied")}
            >
              Turn off
            </button>
            <button
              className="tracking-consent__button"
              type="button"
              aria-pressed={effectiveConsent === "granted"}
              disabled={globalPrivacyControl === true}
              onClick={() => recordConsent("granted")}
            >
              Allow
            </button>
          </div>
        </section>
      ) : (
        <button
          className="tracking-consent-trigger"
          type="button"
          aria-label="Open privacy choices"
          onClick={() => setPreferencesOpen(true)}
        >
          <span className="tracking-consent-trigger__icon" aria-hidden="true" />
        </button>
      )}
    </>
  );
}

function trackMetaConversion(eventName: "QualifiedLead", recordKey: string) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }
  if (isLocalBrowserHost()) return;

  const storageKey = `${META_LEAD_RECORDED_STORAGE_KEY}:${eventName}:${recordKey}`;

  try {
    if (window.localStorage.getItem(storageKey) === "true") {
      return;
    }
  } catch {
    // Tracking should still work when browser storage is unavailable.
  }

  window.fbq("trackSingleCustom", META_PIXEL_ID, "QualifiedLead", {
    content_name: "Frame optional qualification survey",
  });

  try {
    window.localStorage.setItem(storageKey, "true");
  } catch {
    // A sent conversion should not be affected by unavailable storage.
  }
}

export function trackMetaLead(metaEventId?: string) {
  if (typeof window === "undefined" || isLocalBrowserHost()) return;
  if (
    navigator.globalPrivacyControl === true ||
    readOptionalTrackingConsent() === "denied" ||
    inMemoryEffectiveTrackingConsent === "denied"
  ) {
    clearPendingMetaLeads();
    return;
  }

  const eventId =
    metaEventId && UUID_PATTERN.test(metaEventId)
      ? metaEventId
      : crypto.randomUUID();
  if (metaLeadWasRecorded(eventId)) return;
  queueMetaLead(eventId);
  replayPendingMetaLeads();
}

export function trackMetaQualifiedLead(recordKey: string) {
  trackMetaConversion("QualifiedLead", recordKey);
}

export function trackWaitlistEvent(
  event: WaitlistAnalyticsEvent,
  detail: Record<string, string | boolean> = {},
) {
  if (typeof window === "undefined") return;

  const payload = { event, ...detail };
  window.dispatchEvent(
    new CustomEvent("frame:analytics", { detail: payload }),
  );
  window.dataLayer?.push(payload);
  recordFirstPartyFunnelEvent(event, detail);
}

const FUNNEL_SESSION_STORAGE_KEY = "frame-reservation-funnel-session-v1";
const FUNNEL_EVENT_STORAGE_PREFIX = "frame-reservation-funnel-event-v1";

function funnelStorageValue(key: string, create: () => string) {
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing && UUID_PATTERN.test(existing)) return existing;
    const value = create();
    window.sessionStorage.setItem(key, value);
    return value;
  } catch {
    return create();
  }
}

function analyticsSignatureHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanFunnelProperty(value: string | boolean | null) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 200);
  return cleaned || null;
}

function recordFirstPartyFunnelEvent(
  event: WaitlistAnalyticsEvent,
  detail: Record<string, string | boolean>,
) {
  if (isLocalBrowserHost()) return;

  const query = new URLSearchParams(window.location.search);
  const properties = Object.fromEntries(
    Object.entries({
      ...detail,
      utmSource: query.get("utm_source"),
      utmMedium: query.get("utm_medium"),
      utmCampaign: query.get("utm_campaign"),
    })
      .map(([key, value]) => [key, cleanFunnelProperty(value)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
  const pagePath = window.location.pathname;
  const signature = JSON.stringify({ event, pagePath, properties });
  const sessionId = funnelStorageValue(
    FUNNEL_SESSION_STORAGE_KEY,
    () => crypto.randomUUID(),
  );
  const eventId = funnelStorageValue(
    `${FUNNEL_EVENT_STORAGE_PREFIX}:${analyticsSignatureHash(signature)}`,
    () => crypto.randomUUID(),
  );

  void fetch("/api/funnel-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
    referrerPolicy: "no-referrer",
    body: JSON.stringify({
      eventId,
      sessionId,
      event,
      pagePath,
      properties,
    }),
  }).catch(() => {
    // First-party funnel measurement is deliberately fail-open for visitors.
  });
}
