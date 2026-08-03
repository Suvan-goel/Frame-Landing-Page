import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "../../components/brand-wordmark";

export const metadata: Metadata = {
  title: "Important Product Status Disclosure — Frame",
  description: "Important information about Frame’s early development status.",
  robots: { index: false, follow: false },
};

export default function ProductStatusPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <Link className="wordmark" href="/" aria-label="Frame home"><BrandWordmark priority /></Link>
        <p className="eyebrow">Important information</p>
        <h1>Product Status Disclosure</h1>
        <p className="legal-intro">
          Frame is an early-stage development project. No finished Frame product currently exists.
        </p>
        <section>
          <h2>The Founding Contributor Membership is not:</h2>
          <ul>
            <li>a purchase or pre-order of a Frame device;</li>
            <li>a product reservation, deposit, or place in a delivery queue;</li>
            <li>an investment in Frame;</li>
            <li>a charitable donation;</li>
            <li>a guarantee that Frame will launch;</li>
            <li>a guarantee of regulatory authorization; or</li>
            <li>a guarantee of any product feature, performance level, price, or delivery date.</li>
          </ul>
        </section>
        <section>
          <h2>Development may change</h2>
          <p>
            The immediate objective is to investigate whether ultrasound can capture useful arterial information, whether that information can support blood-pressure estimation, and whether the approach could eventually become wearable. Frame may change substantially during this work or may never become commercially available.
          </p>
        </section>
        <section>
          <h2>No medical use</h2>
          <p>
            Current Frame concepts, renders, demonstrations, development information, and community discussions must not be used to make medical decisions. Frame does not diagnose, treat, or provide personal medical guidance.
          </p>
        </section>
        <p className="legal-disclaimer">
          Your $99 payment purchases the membership benefits described in the Membership Terms. It does not purchase a future device.
        </p>
        <Link className="text-link" href="/founding-contributors/review">← Back to membership review</Link>
      </article>
    </main>
  );
}
