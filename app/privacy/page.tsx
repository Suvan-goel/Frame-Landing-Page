import type { Metadata } from "next";
import { HistoryBackLink } from "../components/history-back-link";
import { SiteHeader } from "../components/site-header";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  COMPANY_INCORPORATION_DETAILS_COMPLETE,
  formatCorrespondenceAddress,
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
  const privacySections = [
    ...(COMPANY_INCORPORATION_DETAILS_COMPLETE
      ? [{ id: "controller", label: "Who is responsible for your information" }]
      : []),
    { id: "contact-messages", label: "Contact messages" },
    ...(showContributorAreas
      ? [{ id: "founding-contributors", label: "Founding Contributor membership" }]
      : []),
    ...(showPreorderAreas
      ? [{ id: "device-preorders", label: "Device pre-orders" }]
      : []),
    { id: "information-collected", label: "Information we collect" },
    { id: "information-use", label: "How we use it" },
    { id: "legal-bases", label: "Legal bases" },
    { id: "advertising-measurement", label: "Advertising measurement" },
    { id: "sharing-retention", label: "Sharing and retention" },
    { id: "your-choices", label: "Your choices" },
  ];
  const sectionHeading = (id: string, label: string) =>
    `${privacySections.findIndex((section) => section.id === id) + 1}. ${label}`;

  return (
    <main className="legal-page privacy-page preorder-terms-page">
      <SiteHeader backHref="/" backLabel="Back" historyBack />
      <article className="legal-shell">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Effective August 11, 2026</p>

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

        <div className="preorder-terms-layout">
          <nav className="preorder-terms-toc preorder-terms-toc--desktop" aria-label="Privacy Notice sections">
            <p className="eyebrow">On this page</p>
            <ol>
              {privacySections.map(({ id, label }, index) => (
                <li key={id}>
                  <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <details className="preorder-terms-toc-mobile">
            <summary>On this page</summary>
            <nav aria-label="Privacy Notice sections on mobile">
              <ol>
                {privacySections.map(({ id, label }, index) => (
                  <li key={id}>
                    <a href={`#${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          <div className="preorder-terms-content">
            {COMPANY_INCORPORATION_DETAILS_COMPLETE ? (
              <section id="controller">
                <h2>{sectionHeading("controller", "Who is responsible for your information")}</h2>
                <p>
                  {COMPANY_DETAILS.privacyControllerName} is the controller responsible for the processing described in
                  this notice. It is registered in {COMPANY_DETAILS.jurisdiction}
                  {` under registration number ${COMPANY_DETAILS.registrationNumber}`}, with its registered office at {formatRegisteredOffice()}.
                  {COMPANY_DETAILS_COMPLETE
                    ? ` Its customer and privacy correspondence address is ${formatCorrespondenceAddress()}.`
                    : " A separately authorised postal correspondence address will be published before public pre-orders open."}
                  {` Privacy questions can be sent to ${SUPPORT_EMAIL} or submitted through the privacy contact form.`}
                </p>
              </section>
            ) : null}

            <section id="contact-messages">
              <h2>{sectionHeading("contact-messages", "Contact messages")}</h2>
              <p>
                If you use the contact form, we collect your name, email address,
                the topic you select, and your message so we can respond. Please do
                not include private medical information.
              </p>
            </section>

            {showContributorAreas ? (
              <section id="founding-contributors">
                <h2>{sectionHeading("founding-contributors", "Founding Contributor membership")}</h2>
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
              <section id="device-preorders">
                <h2>{sectionHeading("device-preorders", "Device pre-orders")}</h2>
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

            <section id="information-collected">
              <h2>{sectionHeading("information-collected", "Information we collect")}</h2>
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

            <section id="information-use">
              <h2>{sectionHeading("information-use", "How we use it")}</h2>
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

            <section id="legal-bases">
              <h2>{sectionHeading("legal-bases", "Legal bases")}</h2>
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

            <section id="advertising-measurement">
              <h2>{sectionHeading("advertising-measurement", "Advertising measurement")}</h2>
              <p>
                We use the Meta Pixel on eligible public pages to understand whether
                a visit, updates signup, or optional survey completion came from a
                Meta ad and to measure and improve our campaigns. For visitors outside
                the United States, visitors in US states where Frame applies an
                explicit-consent policy, and visitors whose location cannot be
                determined, Meta measurement stays off unless they choose “Allow.” For other
                US visitors, it may start automatically unless they previously turned
                it off or enabled Global Privacy Control in their browser. Permitted
                Meta processes Pixel information under its own privacy policy. We do
                not send your name, email address, age, gender, survey selections,
                health-related answers, or written responses through the Pixel.
                Frame uses Netlify’s platform-derived country and US state to select
                this regional policy. Frame receives a short-lived signed result
                containing only coarse country, state, resolution, and policy fields;
                it does not send Netlify your form entries or Meta click identifier
                for this check. If
                Frame enables the Meta Conversions API in the future, the same regional
                policy, privacy choice, and Global Privacy Control rules will apply,
                and this notice will describe the permitted data used for matching.
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

            <section id="sharing-retention">
              <h2>{sectionHeading("sharing-retention", "Sharing and retention")}</h2>
              <p>
                We do not sell your information for money. Where applicable law
                treats advertising disclosures as a sale or sharing for cross-context
                behavioural advertising, the “Privacy choices” control and Global
                Privacy Control provide a way to opt out. We otherwise share
                information only with service
                providers that help us host, secure, operate the website, store
                submissions, and deliver messages, or when required by law. These
                providers currently include Supabase for data storage, Resend for
                email delivery, Netlify for the coarse regional policy check described
                above, and our website hosting provider.
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

            <section id="your-choices">
              <h2>{sectionHeading("your-choices", "Your choices")}</h2>
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
          </div>
        </div>

        {!showPreorderAreas ? (
          <p className="legal-disclaimer">
            Frame is under development and is not intended to diagnose or treat
            any medical condition.
          </p>
        ) : null}

        <HistoryBackLink
          className="button button--secondary preorder-terms-return"
          fallbackHref="/"
        >
          Exit
        </HistoryBackLink>
      </article>
    </main>
  );
}
