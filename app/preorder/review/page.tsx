import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderCheckoutReview } from "../../components/preorder-checkout-review";
import { PreorderHeader } from "../../components/preorder-chrome";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { formatPreorderMoney } from "@/lib/preorder";
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
  const deliveryLabel = /local test|approved before launch/i.test(
    offer.estimatedDelivery,
  )
    ? "To be confirmed"
    : offer.estimatedDelivery;

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
          estimatedDelivery={deliveryLabel}
          allowedCountries={offer.allowedCountries}
        />
      </div>
    </main>
  );
}
