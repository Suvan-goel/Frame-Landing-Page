/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Privacy — Frame",
  description: "How Frame handles information submitted through its website.",
  alternates: {
    canonical: "/privacy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function PrivacyPage() {
  const [showLocalContributorAreas, showPreorderAreas] = await Promise.all([
    isFoundingContributorSalesPageEnabled(),
    isPreorderSalesPageEnabled(),
  ]);

  return (
    <main className="legal-page">
      <SiteHeader />
      <article className="legal-shell">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Effective August 3, 2026</p>

        <p className="legal-intro">
          This notice explains how Frame Health Technologies handles information
          submitted through the Frame website, including its research and
          early-access waitlist and contact form.
          {showLocalContributorAreas
            ? " It also covers the locally tested Founding Contributor membership experience."
            : null}
          {showPreorderAreas
            ? " It also covers the Frame device pre-order experience."
            : null}
        </p>

        <section>
          <h2>Contact messages</h2>
          <p>
            If you use the contact form, we collect your name, email address,
            the topic you select, and your message so we can respond. Please do
            not include private medical information.
          </p>
        </section>

        {showLocalContributorAreas ? (
          <section>
            <h2>Founding Contributor membership</h2>
            <p>
              If you purchase a membership, we collect the name and email address
              associated with your purchase, payment status and amount, the terms
              version you accepted, membership and access dates, and your
              contributor number. Stripe processes your payment details. Frame
              does not receive or store your full card number.
            </p>
            <p>
              The private contributor hub uses passwordless authentication. If
              you complete your contributor profile or participate in the hub, we may also
              collect your preferred name, country, interests, programme
              feedback, questions, advisory votes, event participation, and
              optional research applications. Please do not submit diagnoses,
              symptoms, test results, or other medical information.
            </p>
          </section>
        ) : null}

        {showPreorderAreas ? (
          <section>
            <h2>Device pre-orders</h2>
            <p>
              If you place a pre-order, we record your name, email address,
              shipping address, payment status and amount, the product and
              quantity, the terms and product-status versions you accepted,
              fulfilment status, order events, and email-delivery status. Stripe
              processes your card details; Frame does not receive or store your
              full card number.
            </p>
          </section>
        ) : null}

        <section>
          <h2>Information we collect</h2>
          <p>
            If you join Frame early access, we collect your email address. You
            can optionally tell us why you are interested in Frame, how you
            currently monitor your blood pressure, what feels frustrating or
            missing, and whether you would be open to a short research call. We
            ask for your first name only if you say yes to a call. Earlier
            versions of the application also asked some applicants for their
            name, age and gender; those historical responses remain stored.
            Please do not include private medical information in your written
            response. We also collect the time and location of signup within the
            site, referral information, and campaign labels or click identifiers
            included in the link you used. Our hosting providers may process
            limited technical information, such as IP address and browser
            details, to operate and secure the site.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to send research updates, share product
            progress, understand the needs people hope Frame can address, review
            suitability for early product access or future testing, understand
            which launch efforts are useful, and protect the waitlist from
            abuse, and to respond to messages sent through the contact form.
            Applying for early access does not enroll you in a study or make you
            a research participant.
          </p>
        </section>

        <section>
          <h2>Advertising measurement</h2>
          <p>
            We use the Meta Pixel to understand whether a visit, early-access
            signup or optional survey completion came from a Meta ad and to
            measure and improve our campaigns. The Pixel may use browser identifiers and similar
            technologies, which Meta processes under its own privacy policy. We
            do not send your name, email address, age, gender, or written
            responses to Meta through the Pixel.
            {showLocalContributorAreas
              ? " The Pixel is not initialized on checkout review, payment-success, member sign-in, contributor-profile, private contributor-hub, or administration routes."
              : null}
          </p>
        </section>

        <section>
          <h2>Sharing and retention</h2>
          <p>
            We do not sell your information. We share it only with service
            providers that help us host, secure, operate the website, store
            submissions, and deliver messages, or when required by law. These
            providers currently include Supabase for data storage, Resend for
            email delivery, and our website hosting provider.
            {showLocalContributorAreas
              ? " The local membership flow also uses Stripe for payments and Supabase for member authentication."
              : null}
            {showPreorderAreas
              ? " The pre-order flow also uses Stripe for payment processing and shipping-address collection."
              : null}
            {" "}We keep submitted information while Frame is in development,
            for the period needed to provide the relevant service and meet
            legal or accounting duties, or until you ask us to delete
            information we are not required to retain.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can unsubscribe from any update using the link in that message.
            To ask what information we hold or request deletion, use our{" "}
            <a href="/contact?topic=privacy">contact page</a>.
          </p>
        </section>

        <p className="legal-disclaimer">
          Frame is under development and is not intended to diagnose or treat
          any medical condition.
        </p>

        <a className="text-link" href="/">
          <span aria-hidden="true">←</span> Back to home
        </a>
      </article>
    </main>
  );
}
