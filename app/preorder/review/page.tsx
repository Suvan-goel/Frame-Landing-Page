import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderCheckoutReview } from "../../components/preorder-checkout-review";
import { PreorderHeader } from "../../components/preorder-chrome";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import {
  formatPreorderMoney,
  formatPreorderShipping,
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_REMAINING_BALANCE_CENTS,
  PREORDER_SHIPPING_RATE_CENTS,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Review your Frame reservation",
  description: "Review your Frame reservation before secure payment.",
  alternates: { canonical: "/preorder/review" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderReviewPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  const offer = await getPreorderConfiguration();
  const shippingLabel = /local test|approved before launch/i.test(
    offer.estimatedShipping,
  )
    ? "To be confirmed"
    : offer.estimatedShipping;

  return (
    <main className="checkout-page preorder-checkout-page">
      <PreorderHeader backHref="/" backLabel="Back to home" />
      <div className="preorder-review-shell">
        <header className="preorder-review-heading">
          <p className="eyebrow">Frame reservation</p>
          <h1>
            <span className="preorder-review-copy__desktop">Review your reservation.</span>
            <span className="preorder-review-copy__mobile">Review your reservation.</span>
          </h1>
          <p>
            <span className="preorder-review-copy__desktop">
              Confirm your offer before secure checkout.
            </span>
            <span className="preorder-review-copy__mobile">
              Confirm your offer before secure checkout.
            </span>
          </p>
        </header>
        <PreorderCheckoutReview
          reservationPriceLabel={formatPreorderMoney(offer.priceCents, offer.currency)}
          foundingPriceLabel={formatPreorderMoney(
            PREORDER_FOUNDING_PRICE_CENTS,
            offer.currency,
          )}
          remainingBalanceLabel={formatPreorderMoney(
            PREORDER_REMAINING_BALANCE_CENTS,
            offer.currency,
          )}
          shippingLabel={formatPreorderShipping(
            offer.shippingRateCents ?? PREORDER_SHIPPING_RATE_CENTS,
            offer.currency,
          )}
          estimatedTotalLabel={formatPreorderMoney(
            offer.priceCents +
              (offer.shippingRateCents ?? PREORDER_SHIPPING_RATE_CENTS),
            offer.currency,
          )}
          estimatedShipping={shippingLabel}
        />
      </div>
    </main>
  );
}
