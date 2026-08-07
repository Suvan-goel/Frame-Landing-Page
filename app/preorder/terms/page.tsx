import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { PREORDER_TERMS_VERSION } from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Draft Frame Pre-order Terms — local test",
  description: "Terms for placing a Frame device pre-order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderTermsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Pre-order review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">Implementation draft — not approved for live sales</div>
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Draft Pre-order Terms</h1>
        <p className="legal-updated">Version {PREORDER_TERMS_VERSION}</p>
        <p className="legal-intro">
          These placeholders exist to validate versioned acceptance and the order-confirmation workflow. They are not legal terms and cannot be used for a live sale.
        </p>
        <section><h2>1. Seller</h2><p><strong>[LEGAL BUSINESS NAME, ADDRESS AND CONTACT DETAILS TO BE PROVIDED BY COUNSEL]</strong></p></section>
        <section><h2>2. Test transaction only</h2><p>The current local flow uses Stripe test mode and creates test records. It does not make Frame available for sale to the public.</p></section>
        <section id="product-status"><h2>3. Product status</h2><p>Frame remains under development. Final design, intended purpose, claims, specifications, conformity assessment, registration, price, manufacturing, availability and delivery timing require further work and approval.</p></section>
        <section><h2>4. Price, tax and shipping</h2><p>The product subtotal is $299 USD for one Frame. Standard shipping and handling is an additional $19 USD and applicable sales tax is calculated at checkout; both are shown before payment. Initial shipping is limited to addresses in all 50 United States and Washington, DC. US territories and international destinations are not supported at launch. The tax registrations and final treatment remain subject to accounting and legal approval before launch.</p></section>
        <section><h2>5. Shipping timing and delays</h2><p>Frame is currently estimated to ship in March 2027. This is a shipping estimate, not a delivery guarantee, and may change as development, approval, manufacturing and fulfilment planning progress. <strong>[APPROVED DELAY NOTICE PROCESS, CUSTOMER CHOICES AND CANCELLATION RIGHTS TO BE INSERTED]</strong></p></section>
        <section><h2>6. Cancellation, refunds and returns</h2><p><strong>[PRE-SHIPMENT CANCELLATION, REFUND TIMING, POST-DELIVERY RETURNS AND WARRANTY TERMS TO BE INSERTED]</strong> See the <Link href="/preorder/refunds">draft refund workflow</Link>.</p></section>
        <section><h2>7. Privacy and communications</h2><p>Essential order messages are separate from optional marketing. The local implementation stores order identity, address, payment status, accepted document versions and audit events.</p></section>
        <section><h2>8. Governing law</h2><p><strong>[GOVERNING LAW, COURTS AND NON-EXCLUDABLE CONSUMER RIGHTS TO BE INSERTED]</strong></p></section>
        <p className="legal-disclaimer">Hard launch safeguard: the server rejects public sales while the active terms version begins with “draft”.</p>
        <Link className="text-link" href="/preorder/review">← Back to pre-order review</Link>
      </article>
    </main>
  );
}
