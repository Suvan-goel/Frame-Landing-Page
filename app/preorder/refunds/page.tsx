import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { PREORDER_TERMS_VERSION } from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Frame Pre-order Cancellation and Refund Policy — launch candidate",
  description: "How to cancel, return, or obtain a refund for a Frame pre-order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderRefundsPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="legal-page">
      <PreorderHeader backHref="/preorder/review" backLabel="Pre-order review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">
          Launch candidate — incorporated seller details still required
        </div>
        <p className="eyebrow">Frame device pre-order</p>
        <h1>Cancellation and Refund Policy</h1>
        <p className="legal-updated">Candidate version {PREORDER_TERMS_VERSION} · August 7, 2026</p>
        <p className="legal-intro">
          You can cancel a Frame pre-order at any time before dispatch. This policy explains the
          process and the additional return rights available after delivery.
        </p>

        <section>
          <h2>Cancel any time before dispatch</h2>
          <p>
            You may cancel for any reason at any time before the order is handed to the carrier.
            Use the secure “Manage your pre-order” link in the confirmation email or submit a request
            through the <Link href="/contact?topic=general">Frame contact form</Link> using the purchase
            email and order number. Do not send card details.
          </p>
          <p>
            A valid pre-dispatch cancellation receives a full refund of every amount paid for the unshipped
            order, including the $299 product subtotal, $19 standard shipping and handling, and collected tax.
            Frame does not charge a cancellation or restocking fee.
          </p>
        </section>

        <section>
          <h2>If the shipping estimate changes</h2>
          <p>
            Frame will email you if it expects not to meet the current shipping estimate. The notice will
            explain the reason, give a revised estimate where one can reasonably be provided, and include a
            free way to accept the delay or cancel for a full refund. If applicable law requires affirmative
            agreement and it is not received by the deadline stated in the notice, Frame will cancel the
            unshipped order and refund it automatically.
          </p>
        </section>

        <section>
          <h2>Refund timing</h2>
          <p>
            Frame will submit a required pre-dispatch refund to Stripe as promptly as possible and no later
            than seven working days after cancellation. Refunds are issued to the original payment method.
            After submission, most card refunds appear within approximately 5–10 business days, depending on
            the card issuer. A refund may instead appear as a reversal of the original charge.
          </p>
        </section>

        <section>
          <h2>Returns after delivery</h2>
          <p>
            In addition to any mandatory rights, you may tell Frame that you wish to return the device within
            30 calendar days after delivery. After receiving return instructions, send the device back within
            14 calendar days with its supplied components. Reasonable inspection is permitted, but Frame may
            reduce the refund for loss in value caused by handling beyond what is reasonably needed to inspect
            the product. Do not return a device before receiving return instructions.
          </p>
          <p>
            For a change-of-mind return, you are responsible for the return shipping cost. Frame will refund the
            product price, collected tax attributable to the returned product, and the original standard shipping
            charge. If the product is faulty, unsafe, materially not as described, damaged in transit, or the wrong
            item was supplied, Frame will provide an appropriate remedy and cover reasonable return shipping where
            required by law.
          </p>
        </section>

        <section>
          <h2>When a return refund is issued</h2>
          <p>
            Frame will submit an approved return refund within 14 days after receiving the returned product or
            acceptable evidence that it was sent back, whichever is earlier where required by applicable law.
            Mandatory rights for faulty, unsafe, or misdescribed goods are not limited by this policy.
          </p>
        </section>

        <section>
          <h2>Failed refunds and disputes</h2>
          <p>
            Frame records refund status from signed Stripe notifications. If a refund fails, Frame will investigate
            and contact you. Starting a payment dispute can slow a separate refund, so please contact Frame first
            where practical; this does not remove any right you have to dispute a charge with your card issuer.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Use the <Link href="/contact?topic=general">Frame contact form</Link> and include the order number and
            purchase email. The incorporated seller’s legal name, registered address, and support details will be
            added before pre-orders open.
          </p>
        </section>

        <p className="legal-disclaimer">
          This launch candidate is not active for public sales while the incorporated seller details are pending.
        </p>
        <Link className="text-link" href="/preorder/review">← Back to pre-order review</Link>
      </article>
    </main>
  );
}
