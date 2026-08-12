import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { HistoryBackLink } from "../../components/history-back-link";
import {
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_PRODUCT_STATUS_UPDATED,
  PREORDER_PRODUCT_STATUS_VERSION,
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

const PRODUCT_STATUS_TITLE = "Frame Product Progress and Pre-order Information";
const PRODUCT_STATUS_DESCRIPTION =
  "Current product progress, intended use, shipping plan, and customer protections for Frame pre-orders.";

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
    <main className="legal-page product-status-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Exit" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Frame product status</p>
        <h1>Where Frame stands today.</h1>
        <p className="legal-updated">
          {`Product status version ${PREORDER_PRODUCT_STATUS_VERSION} · ${PREORDER_PRODUCT_STATUS_UPDATED}`}
        </p>
        <p className="legal-intro">
          Frame is progressing from early proof of concept toward an integrated wearable for continuous
          blood-pressure tracking. Here’s what we’ve achieved, what comes next, and the protections included
          with every pre-order.
        </p>

        <section className="product-status-summary" aria-labelledby="product-status-summary-heading">
          <div className="product-status-summary__heading">
            <h2 id="product-status-summary-heading">Current status</h2>
          </div>
          <ol>
            <li>
              <span aria-hidden="true">01</span>
              <p>
                <strong>Early proof-of-concept work is complete.</strong> Frame has completed its initial measurement-validation phase.
              </p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <p>
                <strong>An integrated wearable is now in progress.</strong> Engineering is bringing sensing,
                electronics, software, wearability, and data processing into one upper-arm system.
              </p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <p>
                <strong>Designed for meaningful everyday insight.</strong> Frame is being built to reveal
                personal patterns across sleep, stress, exercise, and recovery.
              </p>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <p>
                <strong>Targeting dispatch in {PREORDER_ESTIMATED_SHIPPING}.</strong> Validation,
                manufacturing, and quality readiness are moving Frame toward this launch window.
              </p>
            </li>
          </ol>
        </section>

        <section className="product-status-next">
          <p className="eyebrow">Path to launch</p>
          <h2>Before Frame ships</h2>
          <p>
            Frame’s product direction is clear. The next phase brings the complete experience together and
            confirms the finished product.
          </p>
          <ul className="product-status-checklist">
            <li>
              <strong>Validate the integrated system</strong>
              <span>Complete validation of the integrated product across sensing, software, data processing, and measurement performance.</span>
            </li>
            <li>
              <strong>Refine everyday wear</strong>
              <span>Complete the remaining work on fit, comfort, materials, battery life, and connectivity.</span>
            </li>
            <li>
              <strong>Prepare for production</strong>
              <span>Complete manufacturing, safety, and quality readiness before dispatch.</span>
            </li>
          </ul>
          <p className="product-status-next__note">
            We’ll confirm final specifications before shipping. Product images show the intended design direction,
            and any material change will be explained clearly before it affects your order.
          </p>
        </section>

        <section className="product-status-protection">
          <p className="eyebrow">Pre-order protection</p>
          <h2>Your pre-order is protected.</h2>
          <div className="product-status-protection__grid">
            <div>
              <span aria-hidden="true">01</span>
              <h3>Your Frame is allocated</h3>
              <p>Your full payment secures one device from the Frame pre-order allocation.</p>
            </div>
            <div>
              <span aria-hidden="true">02</span>
              <h3>Current shipping plan</h3>
              <p>We’re targeting dispatch in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong> and will keep you updated as Frame advances toward production.</p>
            </div>
            <div>
              <span aria-hidden="true">03</span>
              <h3>Clear choices if plans change</h3>
              <p>If timing or the product changes materially, we’ll explain it and let you accept the update or cancel for a full refund.</p>
            </div>
          </div>
          <p className="product-status-protection__note">
            If we cannot supply Frame, we will cancel your order and issue a full refund. Your payment is not an
            investment, subscription, participation in research, or payment for medical services. Read the
            <Link href="/preorder/refunds"> Cancellation and Refund Policy</Link> for details.
          </p>
        </section>

        <section className="product-status-important">
          <p className="eyebrow">Important information</p>
          <h2>Clear expectations before you order.</h2>
          <div className="product-status-important__items">
            <div>
              <h3>Designed for general wellness</h3>
              <p>
                Frame is designed to help you explore personal blood-pressure patterns and is being developed solely
                for general-wellness use. It is not an FDA-authorized medical blood-pressure monitor, its performance
                has not been established for medical use, and it does not provide emergency alerts. Do not use Frame
                to diagnose or manage a condition, change medication or treatment, decide whether to seek emergency
                care, or replace an appropriate FDA-authorized device or professional medical care.
              </p>
            </div>
            <div>
              <h3>FCC equipment authorization and delivery</h3>
              <p>
                Frame is subject to Federal Communications Commission rules. This pre-order is a conditional sale,
                and delivery is conditional upon successful completion of the applicable FCC equipment authorization
                process. Frame will not deliver the device before that process is successfully completed.
              </p>
              <p>
                FCC rules governing conditional sales do not determine the applicability of consumer-protection,
                contractual, or other provisions of federal or state law. If authorization is not successfully
                completed, Frame will cancel your unshipped pre-order and issue a full refund under the
                <Link href="/preorder/refunds#fcc-authorization"> Cancellation and Refund Policy</Link>.
              </p>
            </div>
            <div>
              <h3>Seller and support</h3>
              {COMPANY_INCORPORATION_DETAILS_COMPLETE ? (
                <p>
                  The seller is {COMPANY_DETAILS.legalName}, registered in {COMPANY_DETAILS.jurisdiction}
                  {` under registration number ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
                  {COMPANY_DETAILS_COMPLETE
                    ? ` Customer and order correspondence should be sent to ${formatCorrespondenceAddress()}.`
                    : " A separately authorised customer correspondence address will be published before public pre-orders open."}
                  {` Questions can be sent to ${SUPPORT_EMAIL}.`}
                </p>
              ) : (
                <p>
                  The incorporated seller’s exact legal identity, registration details, registered office,
                  authorised correspondence address, and jurisdiction will be inserted before public pre-orders
                  open. Questions can be submitted through the
                  <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>.
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="legal-disclaimer">
          At checkout, you’ll confirm that you have reviewed this product status separately from accepting the
          Pre-order Terms and Cancellation and Refund Policy. The version you accept will be recorded with your order.
        </p>
        <HistoryBackLink
          className="button button--secondary product-status-return"
          fallbackHref="/preorder/review"
        >
          Exit
        </HistoryBackLink>
      </article>
    </main>
  );
}
