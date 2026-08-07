"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const META_PIXEL_ID = "1068997465474786";
const META_LEAD_RECORDED_STORAGE_KEY = "frame-meta-lead-recorded-v1";

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

export function isMetaPixelAllowed(pathname: string) {
  return (
    !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_ADDITIONAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    !PRIVATE_EXACT_PATHS.includes(pathname)
  );
}

export function MetaPixelRouteGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (isLocalBrowserHost() || !isMetaPixelAllowed(pathname)) {
      document.getElementById("meta-pixel")?.remove();
      document
        .querySelectorAll('script[src*="connect.facebook.net"]')
        .forEach((script) => script.remove());
      window.fbq = undefined;
      return;
    }
    if (typeof window.fbq === "function") {
      window.fbq("trackSingle", META_PIXEL_ID, "PageView");
      return;
    }
    if (document.getElementById("meta-pixel")) return;

    const loadPixel = () => {
      if (document.getElementById("meta-pixel")) return;
      const script = document.createElement("script");
      script.id = "meta-pixel";
      script.text = META_PIXEL_BOOTSTRAP;
      document.head.appendChild(script);
    };

    // Keep third-party tracking out of the critical rendering path while still
    // recording engaged visits immediately on their first interaction.
    const timerId = window.setTimeout(loadPixel, 3500);
    window.addEventListener("pointerdown", loadPixel, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", loadPixel, { once: true });

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("pointerdown", loadPixel);
      window.removeEventListener("keydown", loadPixel);
    };
  }, [pathname]);

  return null;
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
      content_name: "Frame early access signup",
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
