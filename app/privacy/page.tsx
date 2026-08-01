/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { BrandWordmark } from "../components/brand-wordmark";

export const metadata: Metadata = {
  title: "Privacy — Frame",
  description: "How Frame handles information submitted through its waitlist.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <a className="wordmark" href="/" aria-label="Frame home">
          <BrandWordmark priority />
        </a>
        <p className="eyebrow">Privacy</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Effective August 1, 2026</p>

        <p className="legal-intro">
          This notice explains how Frame Health Technologies handles information
          submitted through the Frame research and early-access waitlist.
        </p>

        <section>
          <h2>Information we collect</h2>
          <p>
            If you apply for early access, we collect your first and last name,
            email address, and the response you provide about why you want Frame
            and the problem you hope it will solve. Please do not include
            private medical information in that response. We also collect the
            time of signup, where on the page you signed up, and any campaign
            labels included in the link you used. Our hosting providers may
            process limited technical information, such as IP address and
            browser details, to operate and secure the site.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to send research updates, share product
            progress, understand the needs people hope Frame can address, review
            suitability for early product access or future testing, understand
            which launch efforts are useful, and protect the waitlist from
            abuse. Applying for early access does not enroll you in a study or
            make you a research participant.
          </p>
        </section>

        <section>
          <h2>Sharing and retention</h2>
          <p>
            We do not sell your information. We share it only with service
            providers that help us host, secure, and operate the waitlist, or
            when required by law. We keep waitlist information while Frame is
            in development or until you ask us to delete it.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can unsubscribe from any update using the link in that message.
            To ask what information we hold or request deletion, email{" "}
            <a href="mailto:support@framewearable.com">
              support@framewearable.com
            </a>
            .
          </p>
        </section>

        <p className="legal-disclaimer">
          Frame is under development and is not intended to diagnose or treat
          any medical condition.
        </p>

        <a className="text-link" href="/">
          ← Back to Frame
        </a>
      </article>
    </main>
  );
}
