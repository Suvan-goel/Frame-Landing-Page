"use client";

import type { MouseEvent, ReactNode } from "react";

export function HistoryBackLink({
  fallbackHref,
  className,
  ariaLabel,
  children,
}: {
  fallbackHref: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(fallbackHref);
  }

  return (
    <a
      aria-label={ariaLabel}
      className={className}
      href={fallbackHref}
      onClick={goBack}
    >
      {children}
    </a>
  );
}
