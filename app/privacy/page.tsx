/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  formatRegisteredOffice,
  SUPPORT_EMAIL,
} from "@/lib/company";
import { ORGANIZATION_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy | Frame",
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
  const [showContributorAreas, showPreorderAreas] = await Promise.all([
    isFoundingContributorSalesPageEnabled(),
    isPreorderSalesPageEnabled(),
  ]);

  return (
    <main className="legal-page privacy-page">
      <SiteHeader />
      <article className="legal-shell">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Effective August 9, 2026</p>

        <p className="legal-intro">
          This notice explains how {ORGANIZATION_NAME} handles information
          submitted through the Frame website, including its research and
          email-updates signup and contact form.
          {showContributorAreas
            ? " It also covers the locally tested Founding Contributor membership experience."
            : null}
          {showPreorderAreas
            ? " It also covers the Frame device pre-order and customer order-management experience."
            : null}
        </p>

        {COMPANY_DETAILS_COMPLETE ? (
          <section>
            <h2>Who is responsible for your information</h2>
            <p>
              {COMPANY_DETAILS.privacyControllerName} is the controller responsible for the processing described in
              this notice. It is registered in {COMPANY_DETAILS.jurisdiction}
              {` under registration number ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
              {` Privacy questions can be sent to ${SUPPORT_EMAIL} or submitted through the privacy contact form.`}
            </p>
          </section>
        ) : null}

        <section>
          <h2>Contact messages</h2>
          <p>
            If you use the contact form, we collect your name, email address,
            the topic you select, and your message so we can respond. Please do
            not include private medical information.
          </p>
        </section>

        {showContributorAreas ? (
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
              If you place a pre-order, we collect your name, email address,
              US shipping and billing address, order items and amounts, tax and
              shipping amounts, payment and refund status, the policy versions
              and acknowledgements recorded at checkout, marketing choice,
              attribution information, and order-support history. We also keep
              fulfilment, tracking, address-change, cancellation, delay-response,
              and customer-communication records needed to manage the order.
            </p>
            <p>
              Stripe processes the payment and related fraud-prevention information.
              Frame receives payment status and identifiers but does not receive or
              store your full card number. Do not submit diagnoses, symptoms, test
              results, or other private medical information when contacting Frame.
            </p>
          </section>
        ) : null}

        <section>
          <h2>Information we collect</h2>
          <p>
            If you sign up for updates, we first collect your email address. If
            you complete the optional survey, we also collect your first and
            last name, age, gender, your main reason for wanting Frame, what you
            want Frame to help you understand or do, how you currently monitor
            your blood pressure, and whether you would be open to a 20-minute
            conversation with us. Please do not include private medical
            information in your written response. We also collect the time and
            location of signup within the site, referral information, and
            campaign labels or click identifiers included in the link you used.
            Our hosting providers may process limited technical information,
            such as IP address and browser details, to operate and secure the
            site.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to send research updates, share product
            progress, understand the needs people hope Frame can address, review
            suitability for early product access or future testing, understand
            which launch efforts are useful, and protect the updates list from
            abuse and respond to messages sent through the contact form.
            Signing up for updates does not enroll you in a study or make you
            a research participant.
            {showPreorderAreas
              ? " Pre-order information is also used to take payment, calculate tax, reserve inventory, confirm and support orders, communicate delays, process cancellations and refunds, prevent fraud and abuse, meet accounting and legal duties, and arrange fulfilment."
              : null}
          </p>
        </section>

        <section>
          <h2>Legal bases</h2>
          <p>
            We process information where it is necessary to take steps at your
            request or perform a contract, comply with legal obligations, and
            pursue legitimate interests such as securing the website, maintaining
            reliable records, understanding demand, and improving Frame. We rely
            on consent for optional marketing and similar technologies where
            consent is required. You can withdraw marketing consent at any time
            without affecting earlier lawful processing.
          </p>
        </section>

        <section>
          <h2>Advertising measurement</h2>
          <p>
            We use the Meta Pixel on eligible public pages to understand whether
            a visit, updates signup, or optional survey completion came from a
            Meta ad and to measure and improve our campaigns. For visitors outside
            the United States, visitors in US states where Frame applies an
            explicit-consent policy, and visitors whose location cannot be
            determined, the Pixel stays off unless they choose “Allow.” For other
            US visitors, it may start automatically unless they previously turned
            it off or enabled Global Privacy Control in their browser. The Pixel
            may use browser identifiers and similar technologies, which Meta
            processes under its own privacy policy. We do not send your name,
            email address, age, gender, or written responses to Meta through the
            Pixel.
            {showContributorAreas
              ? " The Pixel is not initialized on checkout review, payment-success, member sign-in, contributor-profile, private contributor-hub, or administration routes."
              : null}
            {showPreorderAreas
              ? " The Pixel is not initialized on pre-order review, payment confirmation, customer order-management, or pre-order administration routes."
              : null}
          </p>
          <p>
            We store your choice in your browser. You can change or withdraw it
            at any time using the “Privacy choices” control displayed on pages
            where optional advertising measurement is available. We honor Global
            Privacy Control as an opt-out signal. Turning measurement off does not
            affect the website’s essential functions.
          </p>
        </section>

        <section>
          <h2>Sharing and retention</h2>
          <p>
            We do not sell your information for money. Where applicable law
            treats advertising disclosures as a sale or sharing for cross-context
            behavioural advertising, the “Privacy choices” control and Global
            Privacy Control provide a way to opt out. We otherwise share
            information only with service
            providers that help us host, secure, operate the website, store
            submissions, and deliver messages, or when required by law. These
            providers currently include Supabase for data storage, Resend for
            email delivery, and our website hosting provider.
            {showContributorAreas
              ? " The local membership flow also uses Stripe for payments and Supabase for member authentication."
              : null}
            {showPreorderAreas
              ? " The pre-order flow also uses Stripe for payment and tax calculation, Supabase for order storage, and Resend for transactional email."
              : null}
            {" "}Some providers may process information outside the UK. Where
            restricted transfers apply, we use an applicable adequacy mechanism
            or contractual safeguards provided for that service.
          </p>
          <p>
            We keep information only for as long as needed for the purpose for
            which it was collected. Order and payment records are retained for the
            period needed to fulfil and support the order and meet tax, accounting,
            fraud-prevention, dispute, and consumer-protection obligations. Marketing
            records are retained until you unsubscribe or they are no longer useful,
            subject to a minimal suppression record that prevents further marketing.
            Security logs are retained for a shorter period proportionate to the risk.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can unsubscribe from marketing using the link in that message;
            essential order messages will continue while an order is active. Depending
            on the circumstances, you may ask for access, correction, deletion,
            restriction, objection, or portability of your personal information, and
            you may complain to the UK Information Commissioner. To exercise a right,
            use our{" "}
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
