import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderCheckoutReview } from "../../components/preorder-checkout-review";
import { PreorderHeader } from "../../components/preorder-chrome";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import {
  formatPreorderMoney,
  PREORDER_SHIPPING_RATE_CENTS,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Review your Frame pre-order",
  description: "Review your Frame pre-order details before secure payment.",
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
      <div className="checkout-page__layout">
        <aside className="preorder-review-intro">
          <p className="eyebrow">Secure pre-order</p>
          <h2>Review your Frame pre-order.</h2>
          <p>
            Confirm the details and important product information before continuing to secure payment.
          </p>
          <ul aria-label="Payment and order information">
            <li><span>01</span><strong>One-time payment</strong></li>
            <li><span>02</span><strong>Secure checkout by Stripe</strong></li>
            <li><span>03</span><strong>Confirmation sent by email</strong></li>
          </ul>
        </aside>
        <PreorderCheckoutReview
          priceLabel={formatPreorderMoney(offer.priceCents, offer.currency)}
          shippingPriceLabel={formatPreorderMoney(
            offer.shippingRateCents ?? PREORDER_SHIPPING_RATE_CENTS,
            offer.currency,
          )}
          estimatedShipping={shippingLabel}
          allowedCountries={offer.allowedCountries}
        />
      </div>
    </main>
  );
}
