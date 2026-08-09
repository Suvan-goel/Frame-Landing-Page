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
  PREORDER_RELEASE_PRICE_CENTS,
  PREORDER_SAVINGS_CENTS,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  formatRegisteredOffice,
  SUPPORT_EMAIL,
} from "@/lib/company";

const PRODUCT_STATUS_TITLE = "Frame Product Status Disclosure";
const PRODUCT_STATUS_DESCRIPTION =
  "Important development and intended-use information for Frame pre-orders.";
const PREORDER_PRICE = formatPreorderMoney(
  PREORDER_DEFAULT_PRICE_CENTS,
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
        <p className="eyebrow">Important pre-order information</p>
        <h1>Product Status Disclosure</h1>
        <p className="legal-updated">{`Last updated ${PREORDER_PRODUCT_STATUS_UPDATED}`}</p>
        <p className="legal-intro">
          Frame is a future product, not a finished device. Read this disclosure before deciding whether
          the uncertainty of a development-stage pre-order is right for you.
        </p>

        <section className="product-status-summary" aria-labelledby="product-status-summary-heading">
          <div className="product-status-summary__heading">
            <p className="eyebrow">At a glance</p>
            <h2 id="product-status-summary-heading">Before you pre-order.</h2>
          </div>
          <ol>
            <li>
              <span aria-hidden="true">01</span>
              <p><strong>Frame is still being developed.</strong> Final design, specifications, and performance may change.</p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <p><strong>Performance has not been established.</strong> Accuracy and measurement availability are not yet final.</p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <p><strong>Frame is not for medical decisions.</strong> It is being developed solely for general-wellness use.</p>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <p><strong>The pre-order price is {PREORDER_PRICE} plus applicable sales tax, with free standard US shipping.</strong> That is {PREORDER_SAVING} below the {RELEASE_PRICE} release price. You pay in full at checkout, shipping is estimated for {PREORDER_ESTIMATED_SHIPPING}, and you may cancel for a full refund before fulfilment begins.</p>
            </li>
          </ol>
        </section>

        <section>
          <h2>What is still being developed</h2>
          <p>
            Frame is being developed as a non-invasive, upper-arm wearable intended to help people explore
            blood-pressure patterns across everyday contexts such as sleep, stress, exercise, and recovery.
            Engineering, validation, manufacturing, and fulfillment work remain, so final design, accuracy,
            measurement availability, battery life, fit, supported arm sizes, materials, connectivity, software
            features, and compatibility have not yet been established.
          </p>
          <p>
            Development targets are not validated performance claims. Product images and prototypes may not show
            the final device. If we propose a material change before shipping, we will explain it and ask you to
            accept by a stated deadline or cancel for a full refund. If you do not affirmatively accept, we will
            cancel and refund the unshipped order automatically.
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
            Your payment purchases one future Frame device and is charged in full at checkout. It is not an
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
              {` Questions can be sent to ${SUPPORT_EMAIL}.`}
            </p>
          ) : (
            <p>
              The incorporated seller’s exact legal identity, registration details, registered office, and jurisdiction
              will be inserted before public pre-orders open. Questions can be submitted through the
              <Link href="/contact?topic=preorder"> Frame pre-order support form</Link>.
            </p>
          )}
        </section>

        <section>
          <h2>Shipping remains an estimate</h2>
          <p>
            Based on our current development and manufacturing plan, we estimate shipping in
            <strong> {PREORDER_ESTIMATED_SHIPPING}</strong>. This is an estimate, not a guaranteed ship date.
            Development, validation, regulatory, supply-chain, manufacturing, or quality work could cause delay
            or make the product unavailable.
          </p>
          <p>
            If we expect a delay, we will email you with a revised date, when available, and a way to accept the
            delay or cancel for a full refund. The notice will explain whether silence keeps a short first delay
            active or whether affirmative consent is required. Read the
            <Link href="/preorder/refunds"> Cancellation and Refund Policy</Link> for details.
          </p>
        </section>

        <p className="legal-disclaimer">
          At checkout, you will be asked to acknowledge this development status separately from accepting the
          Pre-order Terms. The version you accept will be recorded with your order.
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
