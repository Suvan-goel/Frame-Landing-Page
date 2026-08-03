import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "../../components/brand-wordmark";

export const metadata: Metadata = {
  title: "Founding Contributor Refund Policy — Frame",
  description: "Draft refund policy for the Frame Founding Contributor Membership.",
  robots: { index: false, follow: false },
};

export default function ContributorRefundsPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <Link className="wordmark" href="/" aria-label="Frame home"><BrandWordmark priority /></Link>
        <div className="legal-draft-banner" role="note">Draft for testing — legal review required</div>
        <p className="eyebrow">Founding Contributor Membership</p>
        <h1>Refund Policy</h1>
        <p className="legal-updated">Draft effective date: to be confirmed before launch</p>
        <p className="legal-intro">
          Frame intends to offer a straightforward global refund window for the initial Founding Contributor Membership launch.
        </p>
        <section>
          <h2>Full refund within 14 days</h2>
          <p>
            You may request a full refund within 14 days of purchase for any reason. After a full refund is confirmed, community access is revoked and the contributor badge, number, founding status, and conditional future benefits are cancelled.
          </p>
        </section>
        <section>
          <h2>After 14 days</h2>
          <p>
            Refunds are not ordinarily available merely because a member decides not to participate or because a future Frame device does not launch. Refunds, proportional compensation, or other remedies will still be provided where legally required or where Frame fails to provide a substantial part of the promised membership service.
          </p>
        </section>
        <section>
          <h2>How to request a refund</h2>
          <p>
            Use the <Link href="/contact?topic=general">Frame contact form</Link> and include the email address used for payment. Do not include card details or medical information. Frame will verify the payment and confirm the refund status by email.
          </p>
        </section>
        <section>
          <h2>How refunds are processed</h2>
          <p>
            Approved refunds are returned through Stripe to the original payment method. Processing times depend on the payment provider. Frame will update member access only after receiving a verified refund event from Stripe.
          </p>
        </section>
        <p className="legal-disclaimer">This policy is a testing draft and must be approved before live payments begin.</p>
        <Link className="text-link" href="/founding-contributors/review">← Back to membership review</Link>
      </article>
    </main>
  );
}
