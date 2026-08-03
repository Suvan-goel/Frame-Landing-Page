/* eslint-disable @next/next/no-html-link-for-pages */
import { BrandWordmark } from "./brand-wordmark";

export function ContributorHeader({
  backHref = "/",
  backLabel = "← Back to home",
  memberLink = true,
}: {
  backHref?: string;
  backLabel?: string;
  memberLink?: boolean;
}) {
  return (
    <header className="contributor-header">
      <a className="contributor-header__wordmark" href="/" aria-label="Frame home">
        <BrandWordmark priority />
      </a>
      <nav aria-label="Contributor navigation">
        {memberLink ? <a href="/contributors/sign-in">Member sign in</a> : null}
        <a href={backHref}>{backLabel}</a>
      </nav>
    </header>
  );
}

export function ContributorFooter() {
  return (
    <footer className="contributor-footer">
      <div>
        <BrandWordmark variant="light" />
        <p>Frame is under development and is not currently available for sale.</p>
      </div>
      <nav aria-label="Membership policies">
        <a href="/contributors/terms">Membership Terms</a>
        <a href="/contributors/refunds">Refund Policy</a>
        <a href="/contributors/product-status">Product Status</a>
        <a href="/privacy">Privacy</a>
        <a href="/contact">Contact</a>
      </nav>
    </footer>
  );
}
