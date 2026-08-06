"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const META_PIXEL_ID = "1068997465474786";
const META_LEAD_RECORDED_STORAGE_KEY = "frame-meta-lead-recorded-v1";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
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
    if (!isMetaPixelAllowed(pathname)) {
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

export function trackMetaLead() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  try {
    if (
      window.localStorage.getItem(META_LEAD_RECORDED_STORAGE_KEY) === "true"
    ) {
      return;
    }
  } catch {
    // Tracking should still work when browser storage is unavailable.
  }

  window.fbq("trackSingle", META_PIXEL_ID, "Lead", {
    content_name: "Frame early access application",
  });

  try {
    window.localStorage.setItem(META_LEAD_RECORDED_STORAGE_KEY, "true");
  } catch {
    // A sent conversion should not be affected by unavailable storage.
  }
}
