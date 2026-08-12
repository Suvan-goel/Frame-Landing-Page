"use client";

import { useEffect, useRef, useState } from "react";

type MobileNavigationItem = {
  label: string;
  href: string;
};

export function MobileNavigation({
  items,
  primaryItem = {
    label: "Register your interest",
    href: "/#homepage-hero-waitlist",
  },
  offerLabel,
}: {
  items: readonly MobileNavigationItem[];
  primaryItem?: MobileNavigationItem;
  offerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;

    firstLinkRef.current?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.classList.add("mobile-navigation-open");
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("mobile-navigation-open");
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  return (
    <div className={`mobile-nav${open ? " is-open" : ""}`}>
      <button
        ref={toggleRef}
        className="mobile-nav__toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => {
          if (!open) setActiveHref(window.location.hash);
          setOpen((current) => !current);
        }}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <div className="mobile-nav__panel" id="mobile-navigation-panel">
          <div className="container mobile-nav__panel-inner">
            <p className="mobile-nav__eyebrow">Explore Frame</p>
            <div className="mobile-nav__links">
              {items.map((item, index) => {
                const active = item.href === activeHref;

                return (
                  <a
                    key={item.href}
                    ref={index === 0 ? firstLinkRef : undefined}
                    className={active ? "is-active" : undefined}
                    href={item.href}
                    aria-current={active ? "location" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span className="mobile-nav__index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="mobile-nav__label">{item.label}</span>
                    <span className="mobile-nav__current" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
            <div className="mobile-nav__offer">
              {offerLabel ? (
                <p className="mobile-nav__offer-label">{offerLabel}</p>
              ) : null}
              <a
                className="mobile-nav__primary"
                href={primaryItem.href}
                onClick={() => setOpen(false)}
              >
                {primaryItem.label}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
