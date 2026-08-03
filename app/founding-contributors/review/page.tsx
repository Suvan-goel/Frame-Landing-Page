import type { Metadata } from "next";
import { CheckoutReview } from "../../components/checkout-review";
import { ContributorHeader } from "../../components/contributor-chrome";

export const metadata: Metadata = {
  title: "Review your Founding Contributor Membership — Frame",
  description: "Review the Frame Founding Contributor Membership before secure payment.",
  robots: { index: false, follow: false },
};

export default function ContributorReviewPage() {
  return (
    <main className="checkout-page">
      <ContributorHeader backHref="/founding-contributors" backLabel="Back to membership details" />
      <div className="checkout-page__layout">
        <aside>
          <p className="eyebrow">Before payment</p>
          <h2>Know exactly what you’re joining.</h2>
          <p>
            The review is intentionally separate from payment so the present-day membership and Frame’s product status are clear before card details are requested.
          </p>
        </aside>
        <CheckoutReview />
      </div>
    </main>
  );
}
