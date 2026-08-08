"use client";

import { useEffect, useRef, useState } from "react";

type MobileNavigationItem = {
  label: string;
  href: string;
};

export function MobileNavigation({
  items,
  primaryItem = { label: "Register your interest", href: "/interest" },
}: {
  items: readonly MobileNavigationItem[];
  primaryItem?: MobileNavigationItem;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;

    firstLinkRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={`mobile-nav${open ? " is-open" : ""}`}>
      <button
        ref={toggleRef}
        className="mobile-nav__toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <div className="mobile-nav__panel" id="mobile-navigation-panel">
          <div className="container mobile-nav__panel-inner">
            {items.map((item, index) => (
              <a
                key={item.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              className="mobile-nav__primary"
              href={primaryItem.href}
              onClick={() => setOpen(false)}
            >
              {primaryItem.label}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
