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
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_PRODUCT_STATUS_UPDATED,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_REMAINING_BALANCE_CENTS,
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

const PRODUCT_STATUS_TITLE = "Frame Product Progress and Reservation Information";
const PRODUCT_STATUS_DESCRIPTION =
  "Frame launch readiness, intended use, Q1 2027 shipping plan, and customer protections for reservations.";
const RESERVATION_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const FOUNDING_PRICE = formatPreorderMoney(
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const REMAINING_BALANCE = formatPreorderMoney(
  PREORDER_REMAINING_BALANCE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);

const PRODUCT_STATUS_SECTIONS = [
  ["launch-readiness", "Final steps to launch"],
  ["preorder-protection", "Reservation protection"],
  ["important-information", "Important information"],
] as const;

export const metadata: Metadata = {
  title: PRODUCT_STATUS_TITLE,
  description: PRODUCT_STATUS_DESCRIPTION,
  alternates: { canonical: "/preorder/product-status" },
  openGraph: {
    title: PRODUCT_STATUS_TITLE,
    description: PRODUCT_STATUS_DESCRIPTION,
    type: "website",
    url: "/preorder/product-status",
  },
  twitter: {
    card: "summary",
    title: PRODUCT_STATUS_TITLE,
    description: PRODUCT_STATUS_DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderProductStatusPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page preorder-terms-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Back" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Frame product status</p>
        <h1>Preparing for early 2027 launch</h1>
        <p className="legal-updated">
          {`Product status version ${PREORDER_PRODUCT_STATUS_VERSION} · ${PREORDER_PRODUCT_STATUS_UPDATED}`}
        </p>
        <p className="legal-intro">
          Frame’s sensing technology has completed measurement validation. Engineering is now bringing the validated
          sensing system, electronics, software, wearability, and data processing together in the Frame upper-arm
          wearable for launch.
        </p>

        <div className="preorder-terms-layout">
          <nav className="preorder-terms-toc preorder-terms-toc--desktop" aria-label="Product status sections">
            <p className="eyebrow">On this page</p>
            <ol>
              {PRODUCT_STATUS_SECTIONS.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <details className="preorder-terms-toc-mobile">
            <summary>On this page</summary>
            <nav aria-label="Product status sections on mobile">
              <ol>
                {PRODUCT_STATUS_SECTIONS.map(([id, label], index) => (
                  <li key={id}>
                    <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          <div className="preorder-terms-content">
            <section id="launch-readiness">
              <h2>1. Final steps to launch</h2>
              <p>
                Frame’s product direction and core sensing technology are established. Engineering is completing
                final system integration, refining the wearing experience, and preparing production for consistent
                quality at scale.
              </p>
              <p>
                <strong>Complete system integration.</strong> Bring Frame’s validated sensing technology together
                with electronics, software, and data processing in Frame’s final production design.
              </p>
              <p>
                <strong>Finalize everyday wear.</strong> Complete final refinements to fit, comfort, materials,
                battery life, and connectivity for dependable daily use.
              </p>
              <p>
                <strong>Prepare production at scale.</strong> Finalize manufacturing, safety, and quality processes
                for consistent Q1 2027 dispatch.
              </p>
              <p>
                Final specifications will be confirmed before shipping. Product images represent Frame’s planned
                launch design, and we will explain any material change before it affects your order.
              </p>
            </section>

            <section id="preorder-protection">
              <h2>2. Reservation protection</h2>
              <p>
                <strong>Your {FOUNDING_PRICE} price is locked.</strong> Your fully refundable {RESERVATION_PRICE} reservation secures one
                device at that price. The reservation counts toward the total, leaving {REMAINING_BALANCE} due before shipping.
              </p>
              <p>
                <strong>Q1 2027 dispatch.</strong> Engineering and production preparation are focused on
                {` ${PREORDER_ESTIMATED_SHIPPING}`} dispatch, with manufacturing and quality processes moving through
                final readiness.
              </p>
              <p>
                <strong>Your reservation stays protected.</strong> If timing or the product changes materially, we’ll
                explain the update and let you accept it or cancel for a full refund.
              </p>
              <p>
                We will not charge the remaining balance automatically. There is no subscription. If we cannot supply
                Frame, we will cancel your reservation and issue a full refund. Your payment is not an investment,
                participation in research, or payment for medical services. Read the
                <Link href="/preorder/refunds"> Cancellation and Refund Policy</Link> for details.
              </p>
            </section>

            <section id="important-information">
              <h2>3. Important information</h2>
              <p>
                <strong>Designed for general wellness.</strong> Frame is designed to help you explore personal
                blood-pressure patterns and is intended solely for general-wellness use. It is not an FDA-authorized medical
                blood-pressure monitor, its performance has not been established for medical use, and it does
                not provide emergency alerts. Do not use Frame to diagnose or manage a condition, change medication
                or treatment, decide whether to seek emergency care, or replace an appropriate FDA-authorized device
                or professional medical care.
              </p>
              <p>
                <strong>FCC equipment authorization and delivery.</strong> Frame is subject to Federal Communications
                Commission rules. Your reservation and any subsequent device order are conditional upon successful
                completion of the applicable FCC equipment authorization process. Frame will not deliver the device
                before that process is successfully completed. FCC rules governing conditional sales do not determine
                the applicability of consumer-protection, contractual, or other provisions of federal or state law.
                If authorization is not successfully completed, Frame will cancel your unshipped reservation or order and issue
                a full refund under the
                <Link href="/preorder/refunds#fcc-authorization"> Cancellation and Refund Policy</Link>.
              </p>
              <p>
                <strong>Seller and support.</strong>{" "}
              {COMPANY_INCORPORATION_DETAILS_COMPLETE ? (
                <>
                  The seller is {COMPANY_DETAILS.legalName}, registered in {COMPANY_DETAILS.jurisdiction}
                  {` under registration number ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
                  {COMPANY_DETAILS_COMPLETE
                    ? ` Customer and order correspondence should be sent to ${formatCorrespondenceAddress()}.`
                    : " A separately authorised customer correspondence address will be published before public pre-orders open."}
                  {` Questions can be sent to ${SUPPORT_EMAIL}.`}
                </>
              ) : (
                <>
                  The incorporated seller’s exact legal identity, registration details, registered office,
                  authorised correspondence address, and jurisdiction will be inserted before public pre-orders
                  open. Questions can be submitted through the
                  <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>.
                </>
              )}
              </p>
            </section>
          </div>
        </div>

        <HistoryBackLink
          className="button button--secondary preorder-terms-return"
          fallbackHref="/preorder/review"
        >
          Back
        </HistoryBackLink>
      </article>
    </main>
  );
}
