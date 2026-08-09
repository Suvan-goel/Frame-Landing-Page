import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";

export const metadata: Metadata = {
  title: "Product progress and membership scope | Frame",
  description: "Current Frame product progress and how it relates to the Founding Contributor Membership.",
  robots: { index: false, follow: false },
};

export default function ProductStatusPage() {
  return (
    <main className="legal-page">
      <SiteHeader backHref="/founding-contributors/review" backLabel="Membership review" />
      <article className="legal-shell">
        <p className="eyebrow">Frame Founding Contributors</p>
        <h1>Product progress and membership scope</h1>
        <p className="legal-intro">
          Frame has completed its initial technical proof-of-concept and measurement-validation phases and is now building an integrated wearable prototype.
        </p>
        <section>
          <h2>What your membership purchases</h2>
          <p>
            Your $99 payment purchases the 12-month community programme, permanent Founding Contributor status,
            and the current benefits described in the Membership Terms. It is separate from a device purchase or
            pre-order and does not reserve inventory or a place in a delivery queue.
          </p>
        </section>
        <section>
          <h2>Where product development stands</h2>
          <p>
            Current work combines ultrasound sensing, electronics, software, and data processing into a single wearable system. The next stages focus on comfort, repeatability, safety, manufacturing, and regulatory readiness. Any future launch benefits remain subject to availability, eligibility, stock, and the terms in force at that time.
          </p>
        </section>
        <section>
          <h2>No medical use</h2>
          <p>
            Current Frame concepts, renders, demonstrations, development information, and community discussions must not be used to make medical decisions. Frame does not diagnose, treat, or provide personal medical guidance.
          </p>
        </section>
        <Link className="text-link" href="/founding-contributors/review">← Back to membership review</Link>
      </article>
    </main>
  );
}
