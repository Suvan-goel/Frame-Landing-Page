import type { Metadata } from "next";
import { ContactForm } from "../components/contact-form";
import { SiteHeader } from "../components/site-header";
import { SUPPORT_EMAIL } from "@/lib/company";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

export const metadata: Metadata = {
  title: "Contact Frame",
  description:
    "Contact Frame about pre-orders, research, engineering, partnerships, press, privacy, or general questions.",
  alternates: {
    canonical: "/contact",
  },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<{
    topic?: string | string[];
    preview?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawTopic = query?.topic;
  const requestedTopic = typeof rawTopic === "string" ? rawTopic : "general";
  const initialTopic = CONTACT_TOPICS.some(
    ({ value }) => value === requestedTopic,
  )
    ? requestedTopic
    : "general";
  const isPreorderSupport = initialTopic === "preorder";
  const previewSuccess = query?.preview === "success";

  return (
    <main
      className={`contact-page${isPreorderSupport ? " contact-page--preorder" : ""}`}
    >
      <SiteHeader />

      <div className="contact-page__layout">
        <section className="contact-page__intro" aria-labelledby="contact-title">
          <div className="contact-page__intro-copy">
            <p className="eyebrow">Contact Frame</p>
            <h1 id="contact-title">Start a conversation.</h1>
            <p>
              <span className="contact-page__intro-description--desktop">
                Choose a topic below and your message will go directly to our team.
              </span>
              <span className="contact-page__intro-description--mobile">
                Choose a topic below and your message will go directly to our team.
              </span>
            </p>
          </div>

          <div className="contact-page__direct">
            <span>Direct email</span>
            <strong>{SUPPORT_EMAIL}</strong>
          </div>
        </section>

        <ContactForm
          initialTopic={initialTopic}
          previewSuccess={previewSuccess}
          preorderSupport={isPreorderSupport}
        />
      </div>
    </main>
  );
}
