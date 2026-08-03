import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { CONTRIBUTOR_TERMS_VERSION } from "@/lib/contributor-membership";

export const metadata: Metadata = {
  title: "Founding Contributor Membership Terms — Frame",
  description: "Draft terms for the Frame Founding Contributor Membership testing flow.",
  robots: { index: false, follow: false },
};

export default function ContributorTermsPage() {
  return (
    <main className="legal-page">
      <SiteHeader backHref="/founding-contributors/review" backLabel="Membership review" />
      <article className="legal-shell">
        <div className="legal-draft-banner" role="note">
          Draft for testing — not approved for live sales
        </div>
        <p className="eyebrow">Founding Contributor Membership</p>
        <h1>Membership Terms</h1>
        <p className="legal-updated">Version {CONTRIBUTOR_TERMS_VERSION}</p>
        <p className="legal-intro">
          These draft terms are provided to test the membership flow. The legal entity name, registered address, governing law, and final consumer terms must be completed and reviewed before live payments are enabled.
        </p>

        <section>
          <h2>1. Who provides the membership</h2>
          <p>
            The membership will be provided by <strong>[LEGAL BUSINESS NAME TO BE CONFIRMED]</strong>, of <strong>[REGISTERED BUSINESS ADDRESS TO BE CONFIRMED]</strong>. Questions may be sent to support@framewearable.com.
          </p>
        </section>
        <section>
          <h2>2. What you are purchasing</h2>
          <p>
            Your US$99 payment purchases a Frame Founding Contributor Membership. It provides permanent Founding Contributor status and 12 months of access to the private contributor community, beginning when payment is confirmed.
          </p>
          <p>
            The membership is not a purchase, pre-order, reservation, deposit, charitable donation, investment, or payment toward a Frame device. It does not place you in a delivery queue and does not guarantee a product launch.
          </p>
        </section>
        <section>
          <h2>3. Present-day membership benefits</h2>
          <p>
            Membership includes a contributor number and badge, monthly development updates with access to the archive, a weekly written Q&A with the founders, quarterly group briefings or demonstrations, selected advisory votes, and priority consideration for voluntary research opportunities subject to eligibility and consent. Specific dates and formats may change while Frame remains in development.
          </p>
        </section>
        <section>
          <h2>4. Conditional future benefits</h2>
          <p>
            If and when Frame becomes commercially available in your region, members may receive a priority purchase invitation and a 10% discount capped at $50. These benefits are conditional on launch, availability, eligibility, stock, applicable law, and the terms in force at that time. They have no cash value and the $99 payment is not credited against a device purchase.
          </p>
        </section>
        <section>
          <h2>5. Development and product status</h2>
          <p>
            Frame is an early-stage development project. There is no finished product, the proposed technology has not been fully developed or clinically validated, and Frame may change substantially or never become commercially available. No feature, performance level, authorization, price, or delivery date is guaranteed.
          </p>
        </section>
        <section>
          <h2>6. Community conduct</h2>
          <p>
            Members must participate respectfully, avoid harassment or unlawful content, protect confidential or personal information, and not use the community to provide or request medical diagnosis or treatment. Frame may moderate content and suspend access for serious or repeated breaches. Any permanent-status consequences will be handled consistently with applicable consumer law.
          </p>
        </section>
        <section>
          <h2>7. Advisory participation and research</h2>
          <p>
            Votes and feedback are advisory. Frame is not required to implement any result. A membership does not enroll you in research. Each research opportunity will have separate eligibility information, consent, and regulatory safeguards where applicable.
          </p>
        </section>
        <section>
          <h2>8. Refunds</h2>
          <p>
            You may request a full refund within 14 days of purchase for any reason. Access, founding status, badge, and conditional future benefits end after a full refund. Other refunds or remedies remain available where required by law or where Frame fails to provide a substantial part of the promised service. See the <Link href="/contributors/refunds">Refund Policy</Link>.
          </p>
        </section>
        <section>
          <h2>9. Privacy and communications</h2>
          <p>
            Service emails required to deliver membership are separate from optional marketing. How Frame handles membership, payment, authentication, profile, and participation data is described in the <Link href="/privacy">Privacy Notice</Link>.
          </p>
        </section>
        <section>
          <h2>10. Governing terms</h2>
          <p>
            <strong>[GOVERNING LAW AND COURTS TO BE CONFIRMED FOLLOWING LEGAL REVIEW]</strong>. Nothing in these terms limits consumer rights that cannot lawfully be excluded.
          </p>
        </section>
        <p className="legal-disclaimer">
          Testing safeguard: live Stripe credentials and public promotion must not be enabled while these terms remain marked as draft.
        </p>
        <Link className="text-link" href="/founding-contributors/review">← Back to membership review</Link>
      </article>
    </main>
  );
}
