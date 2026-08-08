import Link from "next/link";
import { BrandWordmark } from "./brand-wordmark";
import { HistoryBackLink } from "./history-back-link";

type SiteHeaderLink = {
  href: string;
  label: string;
};

export function SiteHeader({
  backHref = "/",
  backLabel = "Back to home",
  historyBack = false,
  arrowDirection = "left",
  links = [],
}: {
  backHref?: string;
  backLabel?: string;
  historyBack?: boolean;
  arrowDirection?: "left" | "right";
  links?: readonly SiteHeaderLink[];
}) {
  const arrow = (
    <span className="site-header__back-arrow" aria-hidden="true">←</span>
  );

  return (
    <header className="site-header">
      <Link className="site-header__wordmark" href="/" aria-label="Frame home">
        <BrandWordmark priority />
      </Link>
      <nav className="site-header__nav" aria-label="Page navigation">
        {links.map((link) => (
          <Link className="site-header__secondary" href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
        {historyBack ? (
          <HistoryBackLink
            ariaLabel={backLabel}
            className={`site-header__back${arrowDirection === "right" ? " site-header__back--forward" : ""}`}
            fallbackHref={backHref}
          >
            {arrowDirection === "left" ? arrow : null}
            <span className="site-header__back-label">{backLabel}</span>
            {arrowDirection === "right" ? arrow : null}
          </HistoryBackLink>
        ) : (
          <Link
            className={`site-header__back${arrowDirection === "right" ? " site-header__back--forward" : ""}`}
            href={backHref}
            aria-label={backLabel}
          >
            {arrowDirection === "left" ? arrow : null}
            <span className="site-header__back-label">{backLabel}</span>
            {arrowDirection === "right" ? arrow : null}
          </Link>
        )}
      </nav>
    </header>
  );
}
