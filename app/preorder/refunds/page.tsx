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
  PREORDER_REMAINING_BALANCE_CENTS,
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

const REFUNDS_TITLE = "Frame Reservation Cancellation and Refund Policy";
const REFUNDS_DESCRIPTION = "How to cancel a Frame reservation or obtain a refund.";
const LEGAL_PACK_IS_DRAFT = isDraftPreorderVersion(PREORDER_TERMS_VERSION);
const RESERVATION_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const REMAINING_BALANCE = formatPreorderMoney(
  PREORDER_REMAINING_BALANCE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);

const REFUND_SECTIONS = [
  ["cancelling", "Cancel before fulfilment"],
  ["shipping-delays", "Shipping estimate changes"],
  ["product-changes", "Material product changes"],
  ["fcc-authorization", "FCC authorization"],
  ["refund-timing", "Refund timing"],
  ["returns", "Change-of-mind returns"],
  ["product-problems", "Delivery and product problems"],
  ["failed-refunds", "Failed refunds and disputes"],
  ["contact", "Contact"],
] as const;

export const metadata: Metadata = {
  title: `${REFUNDS_TITLE}${LEGAL_PACK_IS_DRAFT ? ": Launch candidate" : ""}`,
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
        <p className="eyebrow">Frame device reservation</p>
        <h1>Cancellation and Refund Policy</h1>
        <p className="legal-updated">
          {`Legal pack version ${PREORDER_TERMS_VERSION} · ${PREORDER_LEGAL_PACK_UPDATED}`}
        </p>
        <p className="legal-intro">
          The {RESERVATION_PRICE} reservation fee is fully refundable before you pay the remaining balance. If you later
          complete the device purchase, you retain the cancellation and return rights described below.
        </p>

        <section className="preorder-terms-summary preorder-refunds-summary" aria-labelledby="refund-summary-heading">
          <div className="preorder-terms-summary__heading">
            <h2 id="refund-summary-heading">Key rights</h2>
          </div>
          <dl>
            <div>
              <dt>Reservation fee</dt>
              <dd>Cancel before paying the balance for a full refund</dd>
            </div>
            <div>
              <dt>Shipping or product changes</dt>
              <dd>Accept the change or cancel for a full refund</dd>
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
              <h2>1. Cancel your reservation</h2>
              <p>
                You may cancel your reservation for any reason before paying the remaining balance and receive
                a full refund of the {RESERVATION_PRICE} reservation fee and any tax paid. Use the secure “Manage your
                reservation” link in the confirmation email or submit a request through the
                <Link href="/contact?topic=preorder"> Frame reservation support form</Link> using the reservation
                email and number. Do not send card details.
              </p>
              <p>
                The reservation has no cancellation or restocking fee. The remaining {REMAINING_BALANCE} is not charged
                automatically, so cancelling the reservation only requires refunding the amount actually paid.
              </p>
              <p>
                If you later pay the remaining balance, you may still cancel for a full refund until fulfilment
                begins. Once fulfilment is processing, Frame may be unable to stop shipment; the return process
                below then applies.
              </p>
            </section>

            <section id="shipping-delays">
              <h2>2. If the shipping estimate changes</h2>
              <p>
                Frame will email you before the current shipping estimate expires if it expects not to meet it.
                The notice will explain the reason, provide a revised shipping date where there is a reasonable
                basis for one, and include a free way to accept the delay or cancel for a full refund.
              </p>
              <p>
                For a first delay with a definite revised shipping date no more than 30 days after the current estimate,
                the notice may explain that we will treat no response as agreement to that short delay. A longer or
                indefinite delay, or any further delay, requires you to agree by the deadline in the notice. If we do
                not receive that agreement, we will automatically cancel the unshipped order and issue a full refund.
              </p>
            </section>

            <section id="product-changes">
              <h2>3. If the product changes materially</h2>
              <p>
                Frame will explain any proposed change that would make the product materially different from what you
                ordered. We will ask you to accept the change by a stated deadline or cancel for a full refund. If you
                do not accept by that deadline, we will automatically cancel the unshipped order and refund every
                amount paid. If Frame cannot supply the device or otherwise cancels an unshipped order, we will also
                refund every amount paid.
              </p>
            </section>

            <section id="fcc-authorization">
              <h2>4. If FCC equipment authorization is not completed</h2>
              <p>
                Delivery of Frame is conditional upon successful completion of the applicable FCC equipment
                authorization process. Frame will not deliver the device before that process is successfully completed.
                If authorization is not successfully completed, we will automatically cancel the unshipped reservation
                or order and refund every amount paid to the original payment method. FCC rules governing conditional sales do
                not determine any other consumer-protection, contractual, or legal rights you may have under federal or
                state law.
              </p>
            </section>

            <section id="refund-timing">
              <h2>5. Refund timing</h2>
              <p>
                We will initiate a full pre-dispatch refund as soon as possible and no later than seven business days
                after you request cancellation or an automatic cancellation takes effect. The refund goes to your
                original payment method. Most card refunds appear within 5–10 business days after they are initiated,
                depending on the card issuer, and may appear as a reversal of the original charge.
              </p>
            </section>

            <section id="returns">
              <h2>6. Change-of-mind returns after delivery</h2>
              <p>
                Request a return through <Link href="/contact?topic=preorder">pre-order support</Link> within 30 calendar
                days after delivery, using your order number and purchase email. After receiving return instructions,
                send the device back within 14 calendar days with all supplied components. Do not return a device
                before receiving those instructions.
              </p>
              <p>
                A brief indoor try-on and the handling reasonably needed to assess fit and basic operation are allowed.
                For a change-of-mind return, the device must otherwise be clean, hygienic, undamaged, and complete.
                If the device is returned with damage or wear beyond that brief inspection, we may deduct the resulting
                loss in value from your refund and will explain any deduction.
              </p>
              <p>
                You are responsible for change-of-mind return shipping. We will initiate a refund of the product price
                and related tax to your original payment method within 14 calendar days after receiving the returned
                device. The issuer timing described in section 5 then applies.
              </p>
            </section>

            <section id="product-problems">
              <h2>7. Delivery and product problems</h2>
              <p>
                If the package is lost in transit, the device arrives faulty or damaged, or the wrong item is supplied,
                contact <Link href="/contact?topic=preorder">pre-order support</Link>. We may ask for photographs or
                other information needed to confirm the problem. Frame will then provide a replacement or refund at no
                additional cost and pay authorised return shipping for a damaged, faulty, or incorrect item.
              </p>
              <p>
                Product defects may also be covered by the <Link href="/preorder/terms#warranty">Frame One-Year Limited
                Warranty</Link>, which describes the available repair, replacement, or refund remedies. The condition
                rules for change-of-mind returns do not restrict rights for a faulty, unsafe, damaged, or misdescribed
                product, and this policy does not limit any mandatory consumer rights.
              </p>
            </section>

            <section id="failed-refunds">
              <h2>8. Failed refunds and disputes</h2>
              <p>
                If a refund fails, Frame will investigate and contact you. If it has not appeared 10 business days after
                we initiate it, use the support form below with your order number and purchase email. Nothing in this
                process removes any right you have to dispute a charge with your card issuer.
              </p>
            </section>

            <section id="contact">
              <h2>9. Contact</h2>
              {COMPANY_INCORPORATION_DETAILS_COMPLETE ? (
                <p>
                  Use the <Link href="/contact?topic=preorder">Frame pre-order support form</Link> or email {SUPPORT_EMAIL}
                  {" "}and include the order number and purchase email. The seller is {COMPANY_DETAILS.legalName}, registration
                  {` ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
                  {COMPANY_DETAILS_COMPLETE
                    ? ` Customer and order correspondence should be sent to ${formatCorrespondenceAddress()}.`
                    : " A separately authorised customer correspondence address will be published before public pre-orders open."}
                </p>
              ) : (
                <p>
                  Use the <Link href="/contact?topic=preorder">Frame pre-order support form</Link> and include the order
                  number and purchase email. The incorporated seller’s legal name, registered office, authorised correspondence address, and final support
                  details will be added before pre-orders open.
                </p>
              )}
            </section>
          </div>
        </div>

        {LEGAL_PACK_IS_DRAFT ? (
          <p className="legal-disclaimer">
            {COMPANY_DETAILS_COMPLETE
              ? "This launch candidate is not active for public sales until final legal approval is activated."
              : COMPANY_INCORPORATION_DETAILS_COMPLETE
                ? "The incorporated seller identity is confirmed, but this launch candidate remains inactive until the customer correspondence address and final legal approval are complete."
                : "This launch candidate is not active for public sales while the incorporated seller details are pending."}
          </p>
        ) : null}
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
