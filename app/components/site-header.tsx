import Link from "next/link";
import { BrandWordmark } from "./brand-wordmark";

type SiteHeaderLink = {
  href: string;
  label: string;
};

export function SiteHeader({
  backHref = "/",
  backLabel = "Back to home",
  links = [],
}: {
  backHref?: string;
  backLabel?: string;
  links?: readonly SiteHeaderLink[];
}) {
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
        <Link className="site-header__back" href={backHref} aria-label={backLabel}>
          <span className="site-header__back-arrow" aria-hidden="true">←</span>
          <span className="site-header__back-label">{backLabel}</span>
        </Link>
      </nav>
    </header>
  );
}
