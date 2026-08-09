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
          <h1>Review your order.</h1>
          <p>
            Review your order and enter your shipping details before continuing
            to secure checkout.
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
