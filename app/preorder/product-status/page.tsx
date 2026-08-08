import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import {
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_PRODUCT_STATUS_VERSION,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Frame Product Status Disclosure — launch candidate",
  description: "Important development and intended-use information for Frame pre-orders.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderProductStatusPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Pre-order review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">
          Launch candidate — Frame remains under development
        </div>
        <p className="eyebrow">Important pre-order information</p>
        <h1>Product Status Disclosure</h1>
        <p className="legal-updated">
          Candidate version {PREORDER_PRODUCT_STATUS_VERSION} · August 7, 2026
        </p>
        <p className="legal-intro">
          Frame is a future product, not a finished device. Read this disclosure before deciding whether
          the uncertainty of a development-stage pre-order is right for you.
        </p>

        <section>
          <h2>Under development</h2>
          <p>
            Frame is being developed as a non-invasive, upper-arm wearable intended to help people explore
            blood-pressure patterns across everyday contexts such as sleep, stress, exercise, and recovery.
            Engineering, validation, manufacturing, and fulfilment work remain. Product images and prototypes
            may not show the final device.
          </p>
        </section>

        <section>
          <h2>Performance has not been established</h2>
          <p>
            Final accuracy, measurement availability, battery life, fit, supported arm sizes, materials,
            connectivity, software features, and compatibility have not yet been established. Frame will not
            represent development targets as validated performance. Material changes will be explained before
            shipment and you will retain the option to cancel for a full refund.
          </p>
        </section>

        <section>
          <h2>Not for medical decisions</h2>
          <p>
            Frame is being developed for general wellness use. It is not currently FDA cleared or approved.
            It is not intended to diagnose, screen for, monitor, treat, or manage any disease or medical
            condition, guide treatment or medication decisions, provide emergency alerts, or replace an
            FDA-authorized blood-pressure monitor or professional medical care.
          </p>
          <p>
            Do not ignore symptoms, delay medical attention, change medication, or make any health decision
            based on Frame. If your care depends on blood-pressure measurements, use an appropriate authorized
            device and speak with a qualified healthcare professional.
          </p>
        </section>

        <section>
          <h2>Shipping remains an estimate</h2>
          <p>
            The current estimate is to ship in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong>. Development,
            validation, regulatory, supply-chain, manufacturing, or quality work could cause delay or make the
            product unavailable. If Frame cannot meet the estimate, it will provide the choices described in the
            <Link href="/preorder/refunds"> Cancellation and Refund Policy</Link>. You may cancel at any time
            before dispatch.
          </p>
        </section>

        <section>
          <h2>What your payment means</h2>
          <p>
            The pre-order is a purchase of one future Frame device and is charged in full at checkout. It does
            not buy equity, a research role, medical services, or guaranteed access to future features. If Frame
            determines it cannot supply the product, it will cancel the order and refund the full amount paid.
          </p>
        </section>

        <p className="legal-disclaimer">
          By continuing, you acknowledge this development status separately from accepting the Pre-order Terms.
        </p>
        <Link className="text-link" href="/preorder/review">← Back to pre-order review</Link>
      </article>
    </main>
  );
}
