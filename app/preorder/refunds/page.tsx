import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Draft Frame Pre-order Refund Policy — local test",
  description: "Implementation draft for Frame pre-order refunds.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderRefundsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Pre-order review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">Implementation draft — legal review required</div>
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Draft Refund Workflow</h1>
        <p className="legal-updated">Effective date: not set</p>
        <p className="legal-intro">The backend can reconcile full refunds, partial refunds, failed refunds and disputes from signed Stripe events. The customer policy remains to be approved.</p>
        <section><h2>Before dispatch</h2><p><strong>[CUSTOMER CANCELLATION WINDOW, METHOD, DEDUCTIONS IF ANY, AND REFUND DEADLINE TO BE APPROVED]</strong></p></section>
        <section><h2>If delivery timing changes</h2><p><strong>[NOTICE, ACCEPTANCE, CONTINUED WAITING AND CANCELLATION OPTIONS TO BE APPROVED]</strong></p></section>
        <section><h2>After delivery</h2><p><strong>[STATUTORY CANCELLATION, RETURN, FAULTY-GOODS, WARRANTY AND HYGIENE-SAFETY TERMS TO BE APPROVED]</strong></p></section>
        <section><h2>How the implementation processes refunds</h2><p>Refunds are initiated in Stripe test mode. Signed events update the payment and order separately, preserving the amount refunded and an audit event. No card details are stored by Frame.</p></section>
        <section><h2>Requesting help</h2><p>Use the <Link href="/contact?topic=general">Frame contact form</Link> with the order number and purchase email. Never send card details or medical information.</p></section>
        <p className="legal-disclaimer">This page validates the policy surface only. It must be replaced with approved terms before live mode can be enabled.</p>
        <Link className="text-link" href="/preorder/review">← Back to pre-order review</Link>
      </article>
    </main>
  );
}
