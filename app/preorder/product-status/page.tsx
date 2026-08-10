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
  PREORDER_PRODUCT_STATUS_UPDATED,
  PREORDER_SAVINGS_CENTS,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  formatCorrespondenceAddress,
  formatRegisteredOffice,
  SUPPORT_EMAIL,
} from "@/lib/company";

const PRODUCT_STATUS_TITLE = "Frame Product Progress and Pre-order Information";
const PRODUCT_STATUS_DESCRIPTION =
  "Current product progress, intended use, shipping plan, and customer protections for Frame pre-orders.";
const PREORDER_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);
const PREORDER_SAVING = formatPreorderMoney(
  PREORDER_SAVINGS_CENTS,
  PREORDER_DEFAULT_CURRENCY,
);

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
      <PreorderHeader backHref="/preorder/review" backLabel="Back" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Frame pre-order information</p>
        <h1>Product Progress and Pre-order Information</h1>
        <p className="legal-updated">{`Last updated ${PREORDER_PRODUCT_STATUS_UPDATED}`}</p>
        <p className="legal-intro">
          Frame is a new approach to continuous blood-pressure tracking. Here is what the product is designed
          to do, where the programme stands today, and what you can expect when you pre-order.
        </p>

        <section className="product-status-summary" aria-labelledby="product-status-summary-heading">
          <div className="product-status-summary__heading">
            <p className="eyebrow">At a glance</p>
            <h2 id="product-status-summary-heading">Frame at a glance.</h2>
          </div>
          <ol>
            <li>
              <span aria-hidden="true">01</span>
              <p><strong>Initial proof of concept is complete.</strong> Frame has also completed its first measurement-validation phase.</p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <p><strong>An integrated wearable is now in progress.</strong> Current work covers engineering, wearability, manufacturing, and quality readiness.</p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <p><strong>Designed for everyday insight.</strong> Frame is intended for general wellness rather than medical decisions.</p>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <p><strong>Pre-order for {PREORDER_PRICE}.</strong> Save {PREORDER_SAVING} from the release price.</p>
            </li>
          </ol>
        </section>

        <section>
          <h2>Where Frame is now</h2>
          <p>
            Frame combines non-invasive upper-arm ultrasound with personalised software to help people explore
            blood-pressure patterns across sleep, stress, exercise, and recovery. Initial technical proof-of-concept
            and measurement-validation phases are complete. Current work focuses on integrating sensing, electronics,
            software, and data processing into a wearable system.
          </p>
          <p>
            Before shipping, Frame will complete the remaining performance, wearability, safety, manufacturing,
            and quality work and confirm final specifications including accuracy, measurement availability, battery
            life, fit, materials, connectivity, software features, and compatibility. Product images show the intended
            design direction. If we propose a material change, we will explain it and let you accept it or cancel for
            a full refund.
          </p>
        </section>

        <section>
          <h2>Not for medical decisions</h2>
          <p>
            Frame is being developed solely for general-wellness use. It has not received FDA marketing
            authorization as a blood-pressure monitor, and its performance has not been established for medical use.
            It is not intended to diagnose, screen for, monitor, treat, or manage any disease or medical
            condition, guide treatment or medication decisions, provide emergency alerts, or replace an
            FDA-authorized blood-pressure monitor or professional medical care.
          </p>
          <p>
            Do not use Frame to diagnose a condition, change medication or treatment, delay medical care, or decide
            whether to seek emergency help. If your care depends on blood-pressure measurements, use an appropriate
            FDA-authorized device and speak with a qualified healthcare professional.
          </p>
        </section>

        <section>
          <h2>What your payment means</h2>
          <p>
            Your payment secures one Frame device from the pre-order allocation and is charged in full at checkout. It is not an
            investment, subscription, participation in research, or payment for medical services. If we cannot
            supply Frame, we will cancel your order and issue a full refund.
          </p>
        </section>

        <section>
          <h2>Seller and support</h2>
          {COMPANY_DETAILS_COMPLETE ? (
            <p>
              The seller is {COMPANY_DETAILS.legalName}, registered in {COMPANY_DETAILS.jurisdiction}
              {` under registration number ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
              {` Customer and order correspondence should be sent to ${formatCorrespondenceAddress()}.`}
              {` Questions can be sent to ${SUPPORT_EMAIL}.`}
            </p>
          ) : (
            <p>
              The incorporated seller’s exact legal identity, registration details, registered office, authorised correspondence address, and jurisdiction
              will be inserted before public pre-orders open. Questions can be submitted through the
              <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>.
            </p>
          )}
        </section>

        <section>
          <h2>Current shipping plan</h2>
          <p>
            Our current plan targets dispatch in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong>. We’ll keep you
            informed as Frame moves through validation, manufacturing, and quality readiness.
          </p>
          <p>
            If the schedule changes, we will email you with revised timing and a way to accept the update or cancel
            for a full refund. The notice will explain whether a response is required. Read the
            <Link href="/preorder/refunds"> Cancellation and Refund Policy</Link> for details.
          </p>
        </section>

        <p className="legal-disclaimer">
          At checkout, you’ll confirm that you have reviewed this product status separately from accepting the
          Pre-order Terms. The version you accept will be recorded with your order.
        </p>
        <HistoryBackLink
          className="button button--secondary product-status-return"
          fallbackHref="/preorder/review"
        >
          Back to pre-order
        </HistoryBackLink>
      </article>
    </main>
  );
}
