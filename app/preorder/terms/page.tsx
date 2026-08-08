import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { HistoryBackLink } from "../../components/history-back-link";
import {
  formatPreorderMoney,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DISCOUNT_PERCENT,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_LEGAL_PACK_UPDATED,
  PREORDER_RELEASE_PRICE_CENTS,
  PREORDER_SAVINGS_CENTS,
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_TERMS_VERSION,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

const TERMS_TITLE = "Frame Pre-order Terms";
const TERMS_DESCRIPTION = "Terms for placing and managing a Frame device pre-order.";
const PRODUCT_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const SHIPPING_PRICE = formatPreorderMoney(
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const RELEASE_PRICE = formatPreorderMoney(
  PREORDER_RELEASE_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const PREORDER_SAVING = formatPreorderMoney(
  PREORDER_SAVINGS_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);

const TERMS_SECTIONS = [
  ["seller", "Seller and contact details"],
  ["eligibility", "Eligibility and order formation"],
  ["purchase", "What the pre-order purchases"],
  ["payment", "Price, tax, shipping, and payment"],
  ["shipping", "Estimated shipping and delays"],
  ["delivery", "Delivery and risk of loss"],
  ["cancellations", "Cancellation, refunds, and returns"],
  ["warranty", "Warranty and product problems"],
  ["product-use", "Product use and medical decisions"],
  ["information", "Order information and communications"],
  ["changes", "Changes to the legal pack"],
  ["law", "Governing law and consumer rights"],
] as const;

export const metadata: Metadata = {
  title: `${TERMS_TITLE} — launch candidate`,
  description: TERMS_DESCRIPTION,
  alternates: { canonical: "/preorder/terms" },
  openGraph: {
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    type: "website",
    url: "/preorder/terms",
  },
  twitter: {
    card: "summary",
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderTermsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page preorder-terms-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Back" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Pre-order Terms</h1>
        <p className="legal-updated">
          {`Legal pack version ${PREORDER_TERMS_VERSION} · ${PREORDER_LEGAL_PACK_UPDATED}`}
        </p>
        <p className="legal-intro">
          These terms explain what you are buying, when you will be charged, how shipping updates work,
          and how to cancel. Read them together with the <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>,
          the <Link href="/preorder/product-status">Product Status Disclosure</Link>, and the <Link href="/privacy">Privacy Notice</Link>.
        </p>

        <section className="preorder-terms-summary" aria-labelledby="preorder-terms-summary-heading">
          <div className="preorder-terms-summary__heading">
            <p className="eyebrow">Key terms</p>
            <h2 id="preorder-terms-summary-heading">Your pre-order at a glance.</h2>
          </div>
          <dl>
            <div>
              <dt>Pre-order offer</dt>
              <dd>{PRODUCT_PRICE} — save {PREORDER_SAVING} ({PREORDER_DISCOUNT_PERCENT}%) from the {RELEASE_PRICE} release price</dd>
            </div>
            <div>
              <dt>Estimated shipping</dt>
              <dd>{PREORDER_ESTIMATED_SHIPPING}</dd>
            </div>
            <div>
              <dt>Before fulfilment</dt>
              <dd>Cancel for a full refund</dd>
            </div>
            <div>
              <dt>After delivery</dt>
              <dd>30-day voluntary return window</dd>
            </div>
          </dl>
        </section>

        <div className="preorder-terms-layout">
          <nav className="preorder-terms-toc preorder-terms-toc--desktop" aria-label="Pre-order Terms sections">
            <p className="eyebrow">On this page</p>
            <ol>
              {TERMS_SECTIONS.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <details className="preorder-terms-toc-mobile">
            <summary>On this page</summary>
            <nav aria-label="Pre-order Terms sections on mobile">
              <ol>
                {TERMS_SECTIONS.map(([id, label], index) => (
                  <li key={id}>
                    <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          <div className="preorder-terms-content">
            <section id="seller">
              <h2>1. Seller and contact details</h2>
              <p>
                The seller will be the UK company being incorporated for Frame. Its exact legal name,
                company number, registered office, jurisdiction of registration, and customer-support details
                will be inserted here before pre-orders open. Until those details are present, these terms remain
                a launch candidate and no public order may be accepted.
              </p>
              <p>
                Questions and order requests can be submitted through the <Link href="/contact?topic=preorder">Frame pre-order support form</Link>.
                Never send payment-card details or private medical information.
              </p>
            </section>

            <section id="eligibility">
              <h2>2. Eligibility and order formation</h2>
              <p>
                You must be at least 18 years old and provide a valid delivery address in one of the 50
                United States or Washington, DC. US territories and international destinations are not
                supported at launch. Each checkout is limited to one Frame.
              </p>
              <p>
                Stripe&apos;s payment confirmation does not by itself constitute acceptance. Frame accepts your
                order when payment succeeds and Frame issues an order confirmation to the email address you provide.
                Frame may reject or cancel an order before dispatch where reasonably necessary, including suspected
                fraud, an address outside the launch area, an inventory error, or an inability to supply the product.
                If Frame cancels, it will refund the full amount paid.
              </p>
            </section>

            <section id="purchase">
              <h2>3. What the pre-order purchases</h2>
              <p>
                A pre-order purchases one future Frame device, subject to the development status and cancellation
                rights described here. It is not a deposit, investment, membership, donation, or reservation without
                payment. Your place in the controlled pre-order allocation is recorded after payment succeeds.
              </p>
              <p>
                Frame remains under development. Final design, components, software, specifications, performance,
                regulatory status, manufacturing plan, and packaging may change. Frame will not substitute a materially
                different product without explaining the change and asking you to accept it by a stated deadline or
                cancel for a full refund. If you do not affirmatively accept a material change by that deadline, Frame
                will cancel the unshipped order and refund it automatically. Read the
                <Link href="/preorder/product-status"> Product Status Disclosure</Link> before ordering.
              </p>
            </section>

            <section id="payment">
              <h2>4. Price, tax, shipping, and payment</h2>
              <p>
                The pre-order product subtotal is {PRODUCT_PRICE}, which is {PREORDER_SAVING} ({PREORDER_DISCOUNT_PERCENT}%)
                below Frame&apos;s {RELEASE_PRICE} release price. Standard US shipping and handling is an additional {SHIPPING_PRICE}.
                Applicable sales tax is additional and is calculated from the supplied address. The complete total
                is shown in Stripe Checkout before you pay.
              </p>
              <p>
                The complete amount is charged once at checkout. Payment is processed by Stripe, and Frame does not
                receive or store your full card number. There are no recurring charges. Your card issuer may apply its
                own currency-conversion or other fees.
              </p>
            </section>

            <section id="shipping">
              <h2>5. Estimated shipping and delays</h2>
              <p>
                Frame is currently estimated to ship in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong>. This is the
                estimate for when the order will leave the fulfillment facility, not a guaranteed delivery date.
                Transit time begins after dispatch. The estimate is based on the development and supply plan available
                when the order is accepted and may change.
              </p>
              <p>
                If Frame expects not to ship within the current estimate, it will email you no later than that estimate
                with the reason, a definite revised date where there is a reasonable basis for one, or a statement that
                a revised date cannot yet be provided. Every notice will give you a free way to accept the delay or cancel
                for a full refund and will state exactly what happens if you do not respond.
              </p>
              <p>
                For a first delay with a definite revised shipping date no more than 30 days later, the notice may state
                that no response will be treated as consent to that short delay. For a delay longer than 30 days, an
                unknown shipping date, or a second or later delay, Frame will ask you to accept by a stated deadline. If
                affirmative consent is required and you do not accept by the deadline, Frame will automatically cancel
                the unshipped order and issue a full refund. These delay rights apply even if ordinary fulfilment has
                begun, provided the order has not shipped.
              </p>
            </section>

            <section id="delivery">
              <h2>6. Delivery and risk of loss</h2>
              <p>
                Frame remains responsible for loss or damage until the carrier records delivery to the shipping address
                provided for the order. If the package is lost in transit, arrives damaged, or contains the wrong item,
                contact <Link href="/contact?topic=preorder">pre-order support</Link> promptly so Frame can investigate and
                provide a replacement or refund at no additional cost after reasonable verification. Frame will cover
                authorised return shipping for a damaged or incorrect item. This section does not limit any mandatory
                consumer rights.
              </p>
            </section>

            <section id="cancellations">
              <h2>7. Cancellation, refunds, and returns</h2>
              <p>
                You may cancel for any reason until fulfilment begins, meaning before the order status changes to
                processing, and receive a full refund of the product, standard shipping, and tax paid. Use the secure
                management link in your order email or the
                <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>. After delivery, Frame offers
                the return rights described in the <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>.
              </p>
              <p>
                Once fulfilment is processing, Frame may be unable to stop an ordinary cancellation before shipment.
                Shipping-delay and material-change cancellation rights described in these terms continue to apply while
                the order is unshipped. After shipment, use the return process instead.
              </p>
              <p>
                Nothing in these terms limits rights or remedies that cannot lawfully be excluded, including rights for
                goods that are faulty, unsafe, or not as described.
              </p>
            </section>

            <section id="warranty">
              <h2>8. Warranty and product problems</h2>
              <p>
                <strong>Frame One-Year Limited Warranty.</strong> The incorporated Frame seller identified in section 1
                warrants to the original purchaser that the Frame device will be free from defects in materials and
                workmanship under normal household, general-wellness use for one year from documented delivery.
              </p>
              <p>
                For a valid warranty claim, Frame will, at no charge and within a reasonable time, repair the device or
                replace it with an equivalent device. If neither remedy is reasonably available, Frame will refund the
                purchase price. Frame pays authorised shipping costs for a covered claim. Coverage does not include
                normal cosmetic wear, accidental damage, misuse, abuse, neglect, unauthorised modification or repair,
                or use contrary to the supplied instructions.
              </p>
              <p>
                To make a claim, use <Link href="/contact?topic=preorder">pre-order support</Link> with the order number,
                a description of the problem, and reasonably requested photographs or diagnostic information. Do not
                return the device until Frame provides instructions. This limited warranty does not replace or reduce
                rights and remedies that apply under mandatory law to faulty, unsafe, damaged, or misdescribed goods.
              </p>
            </section>

            <section id="product-use">
              <h2>9. Product use and medical decisions</h2>
              <p>
                Frame is being developed solely for general-wellness use. It has not received FDA marketing
                authorization as a blood-pressure monitor, and its performance has not been established for medical use.
                It is not intended to diagnose, screen for, monitor, treat, or manage any disease or medical condition,
                guide treatment or medication decisions, provide emergency alerts, or replace an FDA-authorized
                blood-pressure monitor or professional medical care. Do not use Frame to delay care or make treatment,
                medication, or emergency decisions.
              </p>
            </section>

            <section id="information">
              <h2>10. Order information and communications</h2>
              <p>
                Frame uses the name, email, delivery address, payment status, accepted document versions, and order
                history to process and support the pre-order. Essential order, delay, cancellation, refund, and shipping
                messages are sent even if you do not opt into marketing. Optional marketing requires separate consent
                and can be unsubscribed from at any time. See the <Link href="/privacy">Privacy Notice</Link>.
              </p>
            </section>

            <section id="changes">
              <h2>11. Changes to the legal pack</h2>
              <p>
                The legal pack version accepted at checkout covers these Pre-order Terms and the Cancellation and Refund
                Policy and is recorded with the order. The Product Status Disclosure is versioned and acknowledged
                separately. Frame may make non-material administrative updates without reducing your rights. If a proposed
                change materially affects the product, price, shipping commitment, or your rights, Frame will explain the
                change and ask you to accept it by a stated deadline or cancel with a full refund. If you do not accept
                by that deadline, Frame will cancel and refund the unshipped order.
              </p>
            </section>

            <section id="law">
              <h2>12. Governing law and consumer rights</h2>
              <p>
                To the extent permitted by law, these terms are governed by the laws of England and Wales. This choice
                does not deprive you of mandatory consumer protections available where you live. Nothing here requires
                an individual consumer to waive a right or remedy that cannot legally be waived.
              </p>
            </section>
          </div>
        </div>

        <p className="legal-disclaimer">
          Launch safeguard: this legal pack remains marked as a draft, and public sales remain blocked while the
          incorporated seller identity and final legal approval are pending.
        </p>
        <HistoryBackLink
          className="button button--secondary preorder-terms-return"
          fallbackHref="/preorder/review"
        >
          Exit
        </HistoryBackLink>
      </article>
    </main>
  );
}
