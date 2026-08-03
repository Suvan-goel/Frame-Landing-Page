import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContributorFooter, ContributorHeader } from "../components/contributor-chrome";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import {
  conditionalBenefits,
  currentBenefits,
  getRoadmapStageStatus,
  NEXT_ROADMAP_STAGE_LABEL,
  roadmapStages,
} from "@/lib/contributor-membership";

export const metadata: Metadata = {
  title: "Become a Frame Founding Contributor",
  description:
    "Join Frame’s private development community with a one-time $99 Founding Contributor Membership.",
  alternates: { canonical: "/founding-contributors" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Become a Frame Founding Contributor",
    description:
      "Permanent founding status and 12 months inside Frame’s private development community. No device included.",
    images: ["/og-founding-contributors.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a Frame Founding Contributor",
    description:
      "Permanent founding status and 12 months inside Frame’s private development community. No device included.",
    images: ["/og-founding-contributors.png"],
  },
};

export const dynamic = "force-dynamic";

const faq = [
  [
    "Am I purchasing a Frame device?",
    "No. The membership does not purchase, reserve, pre-order, deposit toward, or contribute to the price of a Frame device.",
  ],
  [
    "What works today?",
    "Published research supports ultrasound-based measurement of arterial signals and blood-pressure estimation. Frame has completed early proof-of-concept work and is now developing an integrated prototype.",
  ],
  [
    "Will Frame definitely launch?",
    "No. Frame may encounter technical, financial, manufacturing, safety, or regulatory obstacles and may never launch.",
  ],
  [
    "What does the $99 pay for?",
    "It purchases the 12-month contributor membership and the present-day community benefits listed on this page.",
  ],
  [
    "What happens if Frame never launches?",
    "The membership remains a purchase of current community services, not a promise of a future device. The separate 14-day membership refund policy still applies.",
  ],
  [
    "Can the community provide medical advice?",
    "No. Frame, its team, and its community cannot provide diagnosis, treatment, medication, or other personal medical guidance.",
  ],
  [
    "How long does access last?",
    "Community access lasts for 12 months from purchase. Permanent contributor status and conditional future-launch benefits remain after access ends unless the membership is refunded or revoked under the terms.",
  ],
] as const;

export default async function FoundingContributorsPage() {
  if (!(await isFoundingContributorSalesPageEnabled())) notFound();

  return (
    <main className="founding-page">
      <ContributorHeader />

      <section className="founding-hero">
        <div className="founding-hero__copy">
          <p className="eyebrow">Frame Founding Contributors</p>
          <h1>Help build Frame from the beginning.</h1>
          <p className="founding-hero__intro">
            Join Frame’s private development community to follow the work, share your perspective, and help shape what comes next.
          </p>
          <p className="founding-price-line">$99 once <span>·</span> 12 months of community access <span>·</span> No automatic renewal</p>
          <div className="founding-actions">
            <a className="button button--dark" href="/founding-contributors/review">
              Become a Founding Contributor — $99
            </a>
            <a className="text-link" href="#membership-includes">
              See exactly what membership includes <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="founding-hero__note" role="note">
            Membership only—does not include or reserve a Frame device. Frame is still in development.
          </p>
        </div>
        <figure className="founding-hero__visual">
          <div>
            <Image
              src="/frame-on-arm-editorial-v7-product-transparent.png"
              alt="Frame upper-arm wearable concept shown on a person"
              width={1400}
              height={1400}
              priority
              unoptimized
            />
          </div>
          <figcaption>Concept visualization — not a finished product</figcaption>
        </figure>
      </section>

      <section className="founding-benefits" id="membership-includes">
        <div className="founding-section-heading">
          <p className="eyebrow">Included with membership</p>
          <h2>Follow Frame’s development from the inside.</h2>
          <p>
            Your membership includes 12 months inside Frame’s private development community, with regular updates, founder Q&As, briefings, and selected opportunities to share feedback.
          </p>
        </div>
        <div className="founding-benefit-grid">
          {currentBenefits.map((benefit, index) => (
            <article key={benefit}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{benefit}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="founding-stage">
        <div className="founding-stage__intro">
          <p className="eyebrow">Where Frame is today</p>
          <h2>Now building an integrated prototype.</h2>
          <p>
            Frame has completed its initial technical proof-of-concept and measurement-validation phases. We’re now combining sensing, electronics, software, and data processing into a working prototype. Wearability, safety, and regulatory work still lie ahead.
          </p>
        </div>
        <ol className="founding-roadmap">
          {roadmapStages.map(([label, title, description]) => {
            const status = getRoadmapStageStatus(label);
            const statusLabel = status === "current"
              ? "Current"
              : status === "completed"
                ? "Completed"
                : label === NEXT_ROADMAP_STAGE_LABEL
                  ? "Next proposed stage"
                  : "Proposed";

            return (
              <li
                key={label}
                className={`is-${status}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span>{label}</span>
                <div>
                  <p>{statusLabel}</p>
                  <h3>{title}</h3>
                  <small>{description}</small>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="founding-support">
        <div>
          <p className="eyebrow">What membership revenue supports</p>
          <h2>Supporting Frame’s next stage.</h2>
        </div>
        <div>
          <p>
            Membership revenue supports Frame’s development and the operation of the Founding Contributor programme. Current priorities include the work below, but allocations may change as the project develops.
          </p>
          <ul>
            <li>Prototype components, equipment, and testing</li>
            <li>Sensing, electronics, and software engineering</li>
            <li>Measurement and signal validation</li>
            <li>Safety, regulatory, and legal preparation</li>
            <li>Operation of the contributor programme and community</li>
          </ul>
        </div>
      </section>

      <section className="founding-conditional">
        <div className="founding-section-heading">
          <p className="eyebrow">Early supporter benefits</p>
          <h2>A thank-you for joining us early.</h2>
          <p>
            If Frame becomes commercially available, early supporters may receive:
          </p>
        </div>
        <div className="founding-conditional__grid">
          {conditionalBenefits.map((benefit) => (
            <article key={benefit}><span aria-hidden="true">↗</span><p>{benefit}</p></article>
          ))}
        </div>
        <p className="founding-conditional__note">
          Benefits depend on a commercial launch. Regional availability, eligibility, and consent requirements may apply.
        </p>
      </section>

      <section className="founding-faq">
        <div>
          <p className="eyebrow">Frequently asked questions</p>
          <h2>Clarity before contribution.</h2>
        </div>
        <div className="founding-faq__list">
          {faq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="founding-final-cta">
        <p className="eyebrow">Join the development community</p>
        <h2>Become a Frame Founding Contributor.</h2>
        <p>$99 once. No automatic renewal. No device included.</p>
        <a className="button button--light" href="/founding-contributors/review">
          Review the membership
        </a>
      </section>

      <ContributorFooter />
    </main>
  );
}
