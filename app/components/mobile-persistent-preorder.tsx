"use client";

import { useEffect, useState } from "react";

const REVEAL_SCROLL_DISTANCE = 120;

export function MobilePersistentPreorder({
  href,
  priceLabel,
}: {
  href: string;
  priceLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 680px)");
    const updateVisibility = () => {
      setVisible(
        mobileQuery.matches && window.scrollY >= REVEAL_SCROLL_DISTANCE,
      );
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    mobileQuery.addEventListener("change", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      mobileQuery.removeEventListener("change", updateVisibility);
    };
  }, []);

  return (
    <a
      className={`mobile-persistent-preorder${visible ? " is-visible" : ""}`}
      href={href}
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
    >
      Reserve {priceLabel}
    </a>
  );
}
