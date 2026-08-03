import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutReview } from "../../components/checkout-review";
import { ContributorHeader } from "../../components/contributor-chrome";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";

export const metadata: Metadata = {
  title: "Review your Founding Contributor Membership — Frame",
  description: "Review the Frame Founding Contributor Membership before secure payment.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ContributorReviewPage() {
  if (!(await isFoundingContributorSalesPageEnabled())) notFound();

  return (
    <main className="checkout-page">
      <ContributorHeader backHref="/founding-contributors" backLabel="Back to membership details" />
      <div className="checkout-page__layout">
        <aside>
          <p className="eyebrow">Before payment</p>
          <h2>Know exactly what you’re joining.</h2>
          <p>
            Review the membership, current product status, and required terms before continuing. Your card details won’t be requested until the next step.
          </p>
        </aside>
        <CheckoutReview />
      </div>
    </main>
  );
}
