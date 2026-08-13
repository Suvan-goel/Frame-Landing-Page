import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderCheckoutReview } from "../../components/preorder-checkout-review";
import { PreorderHeader } from "../../components/preorder-chrome";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import {
  formatPreorderMoney,
  formatPreorderShipping,
  PREORDER_DISCOUNT_PERCENT,
  PREORDER_RELEASE_PRICE_CENTS,
  PREORDER_SHIPPING_RATE_CENTS,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Review your Frame pre-order",
  description: "Review your Frame pre-order details before secure payment.",
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
          <p className="eyebrow">Frame pre-order</p>
          <h1>
            <span className="preorder-review-copy__desktop">Review your pre-order.</span>
            <span className="preorder-review-copy__mobile">Review your pre-order.</span>
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
          priceLabel={formatPreorderMoney(offer.priceCents, offer.currency)}
          releasePriceLabel={formatPreorderMoney(
            PREORDER_RELEASE_PRICE_CENTS,
            offer.currency,
          )}
          savingsLabel={formatPreorderMoney(
            PREORDER_RELEASE_PRICE_CENTS - offer.priceCents,
            offer.currency,
          )}
          discountPercent={PREORDER_DISCOUNT_PERCENT}
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
