import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { HistoryBackLink } from "../../components/history-back-link";
import {
  formatPreorderMoney,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_LEGAL_PACK_UPDATED,
  PREORDER_TERMS_VERSION,
  isDraftPreorderVersion,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  COMPANY_INCORPORATION_DETAILS_COMPLETE,
  formatCorrespondenceAddress,
  formatRegisteredOffice,
  SUPPORT_EMAIL,
} from "@/lib/company";

const TERMS_TITLE = "Frame Pre-order Terms";
const TERMS_DESCRIPTION = "Terms for placing and managing a Frame device pre-order.";
const PRODUCT_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const LEGAL_PACK_IS_DRAFT = isDraftPreorderVersion(PREORDER_TERMS_VERSION);

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
  ["fcc-authorization", "FCC equipment authorization"],
  ["information", "Order information and communications"],
  ["changes", "Changes to the legal pack"],
  ["law", "Governing law and consumer rights"],
] as const;

export const metadata: Metadata = {
  title: `${TERMS_TITLE}${LEGAL_PACK_IS_DRAFT ? ": Launch candidate" : ""}`,
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

        <section className="preorder-terms-summary preorder-terms-key-summary" aria-labelledby="preorder-terms-summary-heading">
          <div className="preorder-terms-summary__heading">
            <h2 id="preorder-terms-summary-heading">Key terms</h2>
          </div>
          <dl>
            <div>
              <dt>Pre-order price</dt>
              <dd>{PRODUCT_PRICE}, plus applicable sales tax</dd>
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
              {COMPANY_INCORPORATION_DETAILS_COMPLETE ? (
                <p>
                  The seller is <strong>{COMPANY_DETAILS.legalName}</strong>, registered in {COMPANY_DETAILS.jurisdiction}
                  {` under registration number ${COMPANY_DETAILS.registrationNumber}`}. Its registered office is {formatRegisteredOffice()}.
                  {COMPANY_DETAILS_COMPLETE
                    ? ` Customer and order correspondence should be sent to ${formatCorrespondenceAddress()}.`
                    : " A separately authorised customer correspondence address will be published before public pre-orders open."}
                </p>
              ) : (
                <p>
                  The seller will be the incorporated company for Frame. Its exact legal name,
                  registration number, registered office, authorised correspondence address, jurisdiction of registration, and customer-support details
                  will be inserted here before pre-orders open. Until those details are present, these terms remain
                  a launch candidate and no public order may be accepted.
                </p>
              )}
              <p>
                Questions and order requests can be submitted through the <Link href="/contact?topic=preorder">Frame pre-order support form</Link>.
                {` You can also email ${SUPPORT_EMAIL}. Never send payment-card details or private medical information.`}
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
                A pre-order purchases one Frame device to be supplied when it is ready. The full price is paid at
                checkout, and your pre-order is recorded when payment succeeds. It is not an investment, subscription,
                membership, donation, research participation, or payment for medical services.
              </p>
              <p>
                Frame is completing final engineering and production preparation for Q1 2027 dispatch. Final
                specifications may change. If Frame proposes a material change, it will explain the change and ask
                you to accept it by a stated deadline or cancel for a full refund. If you do not accept by that
                deadline, Frame will cancel the unshipped order and refund it automatically. Read the
                <Link href="/preorder/product-status"> Product Status Disclosure</Link> before ordering.
              </p>
            </section>

            <section id="payment">
              <h2>4. Price, tax, shipping, and payment</h2>
              <p>
                The pre-order product subtotal is {PRODUCT_PRICE}. Standard US shipping is included at no additional
                charge. Applicable sales tax is calculated from the supplied address, and the complete total is shown
                in Stripe Checkout before you pay.
              </p>
              <p>
                The complete amount is charged once at checkout. Payment is processed by Stripe, and Frame does not
                receive or store your full card number. There are no recurring charges.
              </p>
            </section>

            <section id="shipping">
              <h2>5. Estimated shipping and delays</h2>
              <p>
                Frame is currently estimated to ship in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong>. This is the
                estimate for when the order will leave the fulfillment facility, not a guaranteed delivery date.
                Transit time begins after dispatch.
              </p>
              <p>
                If Frame expects a delay, it will email you before the current estimate expires with a revised shipping
                date where one can reasonably be given, a free way to accept the delay or cancel for a full refund, and
                an explanation of what happens if you do not respond. For an eligible first delay of no more than 30
                days, the notice may explain that no response will be treated as agreement to that short delay. A longer,
                indefinite, or further delay requires your agreement; otherwise, Frame will automatically cancel and
                refund the unshipped order. The <Link href="/preorder/refunds#shipping-delays">Cancellation and Refund
                Policy</Link> explains these rights in full.
              </p>
            </section>

            <section id="delivery">
              <h2>6. Delivery and risk of loss</h2>
              <p>
                Frame remains responsible for loss or damage until the order is delivered to the shipping address you
                provide. If the package is lost in transit, arrives damaged, or contains the wrong item,
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
                <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>.
              </p>
              <p>
                Once fulfilment is processing, Frame may be unable to stop an ordinary cancellation before shipment.
                Shipping-delay and material-change cancellation rights continue while the order is unshipped. After
                shipment, use the return process in the <Link href="/preorder/refunds">Cancellation and Refund
                Policy</Link>, which also explains the 30-day voluntary return window and rights for faulty, unsafe,
                damaged, or misdescribed goods. Nothing in these terms limits rights or remedies that cannot lawfully
                be excluded.
              </p>
            </section>

            <section id="warranty">
              <h2>8. Warranty and product problems</h2>
              <p>
                <strong>Frame One-Year Limited Warranty.</strong>{" "}
                {COMPANY_INCORPORATION_DETAILS_COMPLETE
                  ? COMPANY_DETAILS.warrantyProviderName
                  : "The incorporated Frame seller identified in section 1"}{" "}
                warrants to the original purchaser that the Frame device will be free from defects in materials and
                workmanship under normal household, general-wellness use for one year from documented delivery.
              </p>
              <p>
                For a valid warranty claim, Frame will, at no charge, complete the repair or dispatch an equivalent
                replacement within 30 calendar days after receiving the device and the information reasonably needed
                to assess the claim. If neither remedy can reasonably be completed within that time, Frame will offer
                a refund of the purchase price. Frame pays authorised shipping costs for a covered claim. Coverage does
                not include normal cosmetic wear, accidental damage, misuse, abuse, neglect, unauthorised modification
                or repair, or use contrary to the supplied instructions.
              </p>
              <p>
                To make a claim, use <Link href="/contact?topic=preorder">pre-order support</Link> with the order number,
                a description of the problem, and reasonably requested photographs or diagnostic information. Do not
                return the device until Frame provides instructions. This limited warranty does not replace or reduce
                rights and remedies that apply under mandatory law to faulty, unsafe, damaged, or misdescribed goods.
                This warranty gives you specific legal rights, and you may also have other rights that vary from state
                to state.
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

            <section id="fcc-authorization">
              <h2>10. FCC equipment authorization and conditional delivery</h2>
              <p>
                Frame is subject to Federal Communications Commission rules. This pre-order is a conditional sale,
                and delivery to the end user is conditional upon successful completion of the applicable FCC equipment
                authorization process. Frame will not deliver the device to you before that process is successfully
                completed.
              </p>
              <p>
                FCC rules governing conditional sales do not determine the applicability of consumer-protection,
                contractual, or other provisions of federal or state law. If the applicable equipment authorization
                process is not successfully completed, Frame will cancel the unshipped pre-order and refund every
                amount paid to the original payment method under the <Link href="/preorder/refunds#fcc-authorization">Cancellation
                and Refund Policy</Link>. This section does not limit any other rights or remedies available to you.
              </p>
            </section>

            <section id="information">
              <h2>11. Order information and communications</h2>
              <p>
                Frame uses the name, email, delivery address, payment status, accepted document versions, and order
                history to process and support the pre-order. Essential order, delay, cancellation, refund, and shipping
                messages are sent even if you do not opt into marketing. Optional marketing requires separate consent
                and can be unsubscribed from at any time. See the <Link href="/privacy">Privacy Notice</Link>.
              </p>
            </section>

            <section id="changes">
              <h2>12. Changes to the legal pack</h2>
              <p>
                The legal pack version accepted at checkout covers these Pre-order Terms and the Cancellation and Refund
                Policy, is recorded with the order, and continues to apply to that order. The Product Status Disclosure
                is versioned and acknowledged separately. New versions and non-material administrative corrections apply
                only to future orders and do not change the rights in the version you accepted.
              </p>
              <p>
                If Frame proposes a material change to the product or shipping commitment while your order is unshipped,
                it will explain the change and ask you to accept it by a stated deadline or cancel for a full refund.
                Frame will not increase the price already paid or otherwise reduce your rights without your express
                agreement. If you do not accept a proposed material change by the deadline, Frame will cancel and refund
                the unshipped order.
              </p>
            </section>

            <section id="law">
              <h2>13. Governing law and consumer rights</h2>
              <p>
                To the extent permitted by law, these terms are governed by the laws of England and Wales. This choice
                does not deprive you of mandatory consumer protections available where you live. Nothing here requires
                an individual consumer to waive a right or remedy that cannot legally be waived.
              </p>
            </section>
          </div>
        </div>

        {LEGAL_PACK_IS_DRAFT ? (
          <p className="legal-disclaimer">
            {COMPANY_DETAILS_COMPLETE
              ? "Launch safeguard: this legal pack remains marked as a draft, and public sales remain blocked until final legal approval is activated."
              : COMPANY_INCORPORATION_DETAILS_COMPLETE
                ? "Launch safeguard: the incorporated seller identity is confirmed, but this legal pack remains a draft and public sales stay blocked until the customer correspondence address and final legal approval are complete."
                : "Launch safeguard: this legal pack remains marked as a draft, and public sales remain blocked while the incorporated seller identity and final legal approval are pending."}
          </p>
        ) : null}
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
