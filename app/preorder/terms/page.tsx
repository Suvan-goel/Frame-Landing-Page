import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import {
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_TERMS_VERSION,
} from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Frame Pre-order Terms — launch candidate",
  description: "Terms for placing and managing a Frame device pre-order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderTermsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Pre-order review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">
          Launch candidate — incorporated seller details still required
        </div>
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Pre-order Terms</h1>
        <p className="legal-updated">Candidate version {PREORDER_TERMS_VERSION} · August 7, 2026</p>
        <p className="legal-intro">
          These terms explain what you are buying, when you will be charged, how shipping updates work,
          and how to cancel. Please read them together with the <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>,
          the <Link href="/preorder/product-status">Product Status Disclosure</Link>, and the <Link href="/privacy">Privacy Notice</Link>.
        </p>

        <section>
          <h2>1. Seller and contact details</h2>
          <p>
            The seller will be the UK company being incorporated for Frame. Its exact legal name,
            company number, registered office, and customer-support details will be inserted here
            before pre-orders open. Until those details are present, these terms are a launch candidate
            and no public order may be accepted.
          </p>
          <p>
            Questions and order requests can be submitted through the <Link href="/contact?topic=general">Frame contact form</Link>.
            Never send payment-card details or private medical information.
          </p>
        </section>

        <section>
          <h2>2. Eligibility and order formation</h2>
          <p>
            You must be at least 18 years old and provide a valid delivery address in one of the 50
            United States or Washington, DC. US territories and international destinations are not
            supported at launch. Each checkout is limited to one Frame.
          </p>
          <p>
            Your pre-order becomes binding when Stripe confirms payment and Frame sends an order
            confirmation. Frame may reject or cancel an order before shipment where reasonably necessary,
            including suspected fraud, an address outside the launch area, an inventory error, or an inability
            to supply the product. If Frame cancels, it will refund the full amount paid.
          </p>
        </section>

        <section>
          <h2>3. What the pre-order purchases</h2>
          <p>
            A pre-order purchases one future Frame device, subject to the development status and cancellation
            rights described here. It is not a deposit, investment, membership, donation, or reservation without
            payment. Your place in the controlled pre-order allocation is recorded after payment succeeds.
          </p>
          <p>
            Frame remains under development. Final design, components, software, specifications, performance,
            regulatory status, manufacturing plan, and packaging may change. Frame will not substitute a materially
            different product without explaining the change and giving you the option to cancel for a full refund.
            Read the <Link href="/preorder/product-status">Product Status Disclosure</Link> before ordering.
          </p>
        </section>

        <section>
          <h2>4. Price, tax, shipping, and payment</h2>
          <p>
            The product subtotal is $299 USD. Standard US shipping and handling is an additional $19 USD.
            Applicable sales tax is additional and is calculated from the supplied address. The complete total
            is shown in Stripe Checkout before you pay.
          </p>
          <p>
            The complete amount is charged once at checkout. Payment is processed by Stripe, and Frame does not
            receive or store your full card number. There are no recurring charges. Your card issuer may apply its
            own currency-conversion or other fees.
          </p>
        </section>

        <section>
          <h2>5. Estimated shipping and delays</h2>
          <p>
            Frame is currently estimated to ship in <strong>{PREORDER_ESTIMATED_SHIPPING}</strong>. This is the
            estimate for when the order will leave the fulfilment facility, not a guaranteed delivery date.
            Transit time begins after dispatch. The estimate is based on the development and supply plan available
            when the order is accepted and may change.
          </p>
          <p>
            If Frame expects not to ship within the stated estimate, it will send an order email with the reason,
            a revised estimate where one can reasonably be provided, and a free way to either accept the delay or
            cancel. Where affirmative agreement is required and is not received by the deadline in that notice,
            Frame will cancel the unshipped order and issue a full refund. You retain the right to cancel at any
            time before dispatch.
          </p>
        </section>

        <section>
          <h2>6. Cancellation, refunds, and returns</h2>
          <p>
            You may cancel for any reason at any time before dispatch and receive a full refund of the product,
            standard shipping, and tax paid. Use the secure management link in your order email or the Frame contact
            form. After delivery, Frame offers the return rights described in the <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>.
          </p>
          <p>
            Nothing in these terms limits rights or remedies that cannot lawfully be excluded, including rights for
            goods that are faulty, unsafe, or not as described.
          </p>
        </section>

        <section>
          <h2>7. Product use and medical decisions</h2>
          <p>
            Frame is being developed for general wellness use. It is not currently FDA cleared or approved and is
            not intended to diagnose, screen for, monitor, treat, or manage any disease or medical condition, guide
            treatment or medication decisions, or replace an FDA-authorized blood-pressure monitor or professional
            medical care. Do not delay seeking medical attention or change treatment based on Frame.
          </p>
        </section>

        <section>
          <h2>8. Order information and communications</h2>
          <p>
            Frame uses the name, email, delivery address, payment status, accepted document versions, and order
            history to process and support the pre-order. Essential order, delay, cancellation, refund, and shipping
            messages are sent even if you do not opt into marketing. Optional marketing requires separate consent
            and can be unsubscribed from at any time. See the <Link href="/privacy">Privacy Notice</Link>.
          </p>
        </section>

        <section>
          <h2>9. Changes to these terms</h2>
          <p>
            The version accepted at checkout is recorded with the order. Frame may make non-material administrative
            updates without reducing your rights. If a proposed change materially affects the product, price, shipping
            commitment, or your rights, Frame will explain the change and, where required, ask for agreement or offer
            cancellation with a full refund.
          </p>
        </section>

        <section>
          <h2>10. Governing law and consumer rights</h2>
          <p>
            To the extent permitted by law, these terms are governed by the laws of England and Wales. This choice
            does not deprive you of mandatory consumer protections available where you live. Nothing here requires
            an individual consumer to waive a right or remedy that cannot legally be waived.
          </p>
        </section>

        <p className="legal-disclaimer">
          Launch safeguard: this candidate version remains marked as a draft in the application, so the server rejects public sales.
        </p>
        <Link className="text-link" href="/preorder/review">← Back to pre-order review</Link>
      </article>
    </main>
  );
}
