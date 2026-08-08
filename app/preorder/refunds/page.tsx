import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { HistoryBackLink } from "../../components/history-back-link";
import {
  formatPreorderMoney,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_LEGAL_PACK_UPDATED,
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_TERMS_VERSION,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

const REFUNDS_TITLE = "Frame Pre-order Cancellation and Refund Policy";
const REFUNDS_DESCRIPTION = "How to cancel, return, or obtain a refund for a Frame pre-order.";
const PRODUCT_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const SHIPPING_PRICE = formatPreorderMoney(
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);

const REFUND_SECTIONS = [
  ["cancelling", "Cancel before fulfilment"],
  ["shipping-delays", "Shipping estimate changes"],
  ["product-changes", "Material product changes"],
  ["refund-timing", "Refund timing"],
  ["returns", "Change-of-mind returns"],
  ["product-problems", "Delivery and product problems"],
  ["failed-refunds", "Failed refunds and disputes"],
  ["contact", "Contact"],
] as const;

export const metadata: Metadata = {
  title: `${REFUNDS_TITLE}: Launch candidate`,
  description: REFUNDS_DESCRIPTION,
  alternates: { canonical: "/preorder/refunds" },
  openGraph: {
    title: REFUNDS_TITLE,
    description: REFUNDS_DESCRIPTION,
    type: "website",
    url: "/preorder/refunds",
  },
  twitter: {
    card: "summary",
    title: REFUNDS_TITLE,
    description: REFUNDS_DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderRefundsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page preorder-terms-page preorder-refunds-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Back" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Cancellation and Refund Policy</h1>
        <p className="legal-updated">
          {`Legal pack version ${PREORDER_TERMS_VERSION} · ${PREORDER_LEGAL_PACK_UPDATED}`}
        </p>
        <p className="legal-intro">
          You can cancel a Frame pre-order until fulfilment begins. This policy explains how
          cancellations, shipping changes, post-delivery returns, and refunds work.
        </p>

        <section className="preorder-terms-summary" aria-labelledby="refund-summary-heading">
          <div className="preorder-terms-summary__heading">
            <p className="eyebrow">Key rights</p>
            <h2 id="refund-summary-heading">Policy at a glance.</h2>
          </div>
          <dl>
            <div>
              <dt>Cancellation cutoff</dt>
              <dd>Before the order moves to processing</dd>
            </div>
            <div>
              <dt>Valid cancellation</dt>
              <dd>Every amount paid is refunded</dd>
            </div>
            <div>
              <dt>After delivery</dt>
              <dd>30-day voluntary return window</dd>
            </div>
            <div>
              <dt>Refund method</dt>
              <dd>Your original payment method</dd>
            </div>
          </dl>
        </section>

        <div className="preorder-terms-layout">
          <nav className="preorder-terms-toc preorder-terms-toc--desktop" aria-label="Cancellation and Refund Policy sections">
            <p className="eyebrow">On this page</p>
            <ol>
              {REFUND_SECTIONS.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <details className="preorder-terms-toc-mobile">
            <summary>On this page</summary>
            <nav aria-label="Cancellation and Refund Policy sections on mobile">
              <ol>
                {REFUND_SECTIONS.map(([id, label], index) => (
                  <li key={id}>
                    <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          <div className="preorder-terms-content">
            <section id="cancelling">
              <h2>1. Cancel before fulfilment begins</h2>
              <p>
                You may cancel for any reason until the order status changes to processing. Use the
                secure “Manage your pre-order” link in the confirmation email or submit a request through
                the <Link href="/contact?topic=preorder">Frame pre-order support form</Link> using the purchase
                email and order number. Do not send card details.
              </p>
              <p>
                A valid cancellation receives a full refund of every amount paid for the unshipped order,
                including the {PRODUCT_PRICE} product subtotal, {SHIPPING_PRICE} standard shipping and handling,
                and collected tax. Frame does not charge a cancellation or restocking fee.
              </p>
              <p>
                Once fulfilment is processing, Frame may be unable to stop an ordinary cancellation before
                shipment. Shipping-delay and material-change cancellation rights remain available while the
                order is unshipped. After shipment, use the return process below.
              </p>
            </section>

            <section id="shipping-delays">
              <h2>2. If the shipping estimate changes</h2>
              <p>
                Frame will email you if it expects not to meet the current shipping estimate. The notice will
                explain the reason, provide a revised estimate where one can reasonably be given, and include a
                free way to accept the delay or cancel for a full refund.
              </p>
              <p>
                For a first delay with a definite revised shipping date no more than 30 days later than the original
                promised shipping time, the notice may state that no response will be treated as consent to that short
                delay. A delay longer than 30 days, an unknown shipping date, or a second or later delay requires your
                affirmative consent by the deadline in the notice. If that consent is not received, Frame will
                automatically cancel the unshipped order and issue a full refund.
              </p>
            </section>

            <section id="product-changes">
              <h2>3. If the product changes materially</h2>
              <p>
                Frame will explain any proposed change that would make the product materially different from the
                version you ordered. Frame will ask you to affirmatively accept the change by a stated deadline or
                cancel for a full refund. If you do not accept by that deadline, Frame will automatically cancel the
                unshipped order and refund every amount paid.
              </p>
            </section>

            <section id="refund-timing">
              <h2>4. Refund timing</h2>
              <p>
                Frame will initiate a required pre-dispatch refund as promptly as possible and no later than seven
                working days after cancellation. The refund is returned to the original payment method. Most card
                refunds appear within approximately 5–10 business days after they are initiated, depending on the
                card issuer, and may appear as a reversal of the original charge.
              </p>
            </section>

            <section id="returns">
              <h2>5. Change-of-mind returns after delivery</h2>
              <p>
                You may tell Frame that you wish to return the device within 30 calendar days after delivery. After
                receiving return instructions, send the device back within 14 calendar days with all supplied
                components. Do not return a device before receiving those instructions.
              </p>
              <p>
                A brief indoor try-on and the handling reasonably needed to assess fit and basic operation are allowed.
                For a change-of-mind return, the device must otherwise be clean, hygienic, undamaged, and complete.
                Frame may reduce the refund only for diminished value caused by handling beyond that brief inspection.
              </p>
              <p>
                You are responsible for change-of-mind return shipping. Frame will refund the product price, collected
                tax attributable to the returned product, and the original standard shipping charge. Frame will
                initiate an approved change-of-mind return refund within 14 calendar days after receiving and checking
                the returned product. The issuer timing described in section 4 then applies.
              </p>
            </section>

            <section id="product-problems">
              <h2>6. Delivery and product problems</h2>
              <p>
                If the package is lost in transit, the device arrives faulty or damaged, or the wrong item is supplied,
                contact <Link href="/contact?topic=preorder">pre-order support</Link>. After reasonable verification,
                Frame will provide a replacement or refund at no additional cost. Frame will pay authorised return
                shipping for a damaged, faulty, or incorrect item.
              </p>
              <p>
                Product defects may also be covered by the <Link href="/preorder/terms#warranty">Frame One-Year Limited
                Warranty</Link>, which describes the available repair, replacement, or refund remedies. The condition
                rules for change-of-mind returns do not restrict rights for a faulty, unsafe, damaged, or misdescribed
                product, and this policy does not limit any mandatory consumer rights.
              </p>
            </section>

            <section id="failed-refunds">
              <h2>7. Failed refunds and disputes</h2>
              <p>
                Frame monitors whether an initiated refund succeeds. If a refund fails, Frame will investigate and
                contact you. If the expected issuer window has passed and the refund is still missing, use the support
                form below with the order number and purchase email. Nothing in this process removes any right you have
                to dispute a charge with your card issuer.
              </p>
            </section>

            <section id="contact">
              <h2>8. Contact</h2>
              <p>
                Use the <Link href="/contact?topic=preorder">Frame pre-order support form</Link> and include the order
                number and purchase email. The incorporated seller’s legal name, registered address, and final support
                details will be added before pre-orders open.
              </p>
            </section>
          </div>
        </div>

        <p className="legal-disclaimer">
          This launch candidate is not active for public sales while the incorporated seller details are pending.
        </p>
        <nav className="preorder-refunds-actions" aria-label="Refund policy actions">
          <Link className="button button--dark" href="/contact?topic=preorder">
            Contact pre-order support
          </Link>
          <HistoryBackLink
            className="button button--secondary"
            fallbackHref="/preorder/review"
          >
            Exit
          </HistoryBackLink>
        </nav>
      </article>
    </main>
  );
}
