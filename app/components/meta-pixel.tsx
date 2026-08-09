"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

export const META_PIXEL_ID = "1068997465474786";
const META_LEAD_RECORDED_STORAGE_KEY = "frame-meta-lead-recorded-v1";
export const OPTIONAL_TRACKING_CONSENT_STORAGE_KEY =
  "frame-optional-tracking-consent-v1";

type OptionalTrackingConsent = "granted" | "denied";
type OptionalTrackingConsentSnapshot = OptionalTrackingConsent | null | "pending";

const OPTIONAL_TRACKING_CONSENT_EVENT = "frame:optional-tracking-consent";
let inMemoryTrackingConsent: OptionalTrackingConsent | null = null;

export type WaitlistAnalyticsEvent =
  | "waitlist_form_viewed"
  | "waitlist_email_submitted"
  | "waitlist_email_success"
  | "waitlist_email_error"
  | "qualification_started"
  | "qualification_skipped"
  | "qualification_completed";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
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

function removeMetaPixel() {
  document.getElementById("meta-pixel")?.remove();
  document
    .querySelectorAll('script[src*="connect.facebook.net"]')
    .forEach((script) => script.remove());
  window.fbq = undefined;
  (window as Window & { _fbq?: unknown })._fbq = undefined;
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

export function isMetaPixelAllowed(pathname: string) {
  return (
    !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_ADDITIONAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_EXACT_PATHS.includes(pathname)
  );
}

export function MetaPixelRouteGuard() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(
    subscribeToOptionalTrackingConsent,
    readOptionalTrackingConsent,
    readServerOptionalTrackingConsent,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const pixelAllowedOnRoute = isMetaPixelAllowed(pathname);
  const consentReady = consent !== "pending";

  useEffect(() => {
    if (!consentReady) return;

    if (
      isLocalBrowserHost() ||
      !pixelAllowedOnRoute ||
      consent !== "granted"
    ) {
      removeMetaPixel();
      if (consent !== "granted") clearMetaCookies();
      return;
    }

    if (typeof window.fbq === "function") {
      window.fbq("trackSingle", META_PIXEL_ID, "PageView");
      return;
    }
    if (document.getElementById("meta-pixel")) return;

    const script = document.createElement("script");
    script.id = "meta-pixel";
    script.text = META_PIXEL_BOOTSTRAP;
    document.head.appendChild(script);
  }, [consent, consentReady, pathname, pixelAllowedOnRoute]);

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
    }
  }

  if (!consentReady || !pixelAllowedOnRoute) return null;

  const showBanner = preferencesOpen;

  return (
    <>
      {showBanner ? (
        <section
          className="tracking-consent"
          aria-labelledby="tracking-consent-title"
          aria-describedby="tracking-consent-description"
        >
          <div className="tracking-consent__copy">
            <p className="eyebrow">Privacy choices</p>
            <h2 id="tracking-consent-title">Optional measurement</h2>
            <p id="tracking-consent-description">
              Help us understand which campaigns are useful. Optional advertising
              measurement stays off unless you allow it.
            </p>
            <Link href="/privacy">Privacy notice</Link>
          </div>
          <div className="tracking-consent__actions" aria-label="Optional tracking choices">
            <button
              className="tracking-consent__button"
              type="button"
              aria-pressed={consent === "denied"}
              onClick={() => recordConsent("denied")}
            >
              Decline
            </button>
            <button
              className="tracking-consent__button"
              type="button"
              aria-pressed={consent === "granted"}
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

function trackMetaConversion(
  eventName: "Lead" | "QualifiedLead",
  recordKey: string,
) {
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

  if (eventName === "Lead") {
    window.fbq("trackSingle", META_PIXEL_ID, "Lead", {
      content_name: "Frame updates signup",
    });
  } else {
    window.fbq("trackSingleCustom", META_PIXEL_ID, "QualifiedLead", {
      content_name: "Frame optional qualification survey",
    });
  }

  try {
    window.localStorage.setItem(storageKey, "true");
  } catch {
    // A sent conversion should not be affected by unavailable storage.
  }
}

export function trackMetaLead(recordKey = "legacy") {
  trackMetaConversion("Lead", recordKey);
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
}
