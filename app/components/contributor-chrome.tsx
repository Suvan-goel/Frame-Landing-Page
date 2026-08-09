import { BrandWordmark } from "./brand-wordmark";
import { SiteHeader } from "./site-header";

export function ContributorHeader({
  backHref = "/",
  backLabel = "Back to home",
  memberLink = true,
}: {
  backHref?: string;
  backLabel?: string;
  memberLink?: boolean;
}) {
  return (
    <SiteHeader
      backHref={backHref}
      backLabel={backLabel}
      links={memberLink
        ? [{ href: "/contributors/sign-in", label: "Member sign in" }]
        : []}
    />
  );
}

export function ContributorFooter() {
  return (
    <footer className="contributor-footer">
      <div>
        <BrandWordmark variant="light" />
        <p>Built with Frame Founding Contributors through private updates, briefings, and product input.</p>
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
