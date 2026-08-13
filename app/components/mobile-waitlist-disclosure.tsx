"use client";

import { ReactNode, useEffect, useRef } from "react";

export function MobileWaitlistDisclosure({
  children,
}: {
  children: ReactNode;
}) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const disclosure = disclosureRef.current;
    if (!disclosure) return;

    disclosure.dataset.mobileReady = "true";
  }, []);

  return (
    <details className="home-preorder-hero__waitlist-disclosure" ref={disclosureRef}>
      <summary>
        <span>Prefer updates?</span>
        <span className="home-preorder-hero__waitlist-action">
          Join the list <span aria-hidden="true">→</span>
        </span>
      </summary>
      {children}
    </details>
  );
}
