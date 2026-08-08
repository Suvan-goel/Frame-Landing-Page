import type { Metadata } from "next";
import { ContactForm } from "../components/contact-form";
import { SiteHeader } from "../components/site-header";

export const metadata: Metadata = {
  title: "Contact Frame",
  description:
    "Contact Frame about research, engineering, partnerships, press, privacy, or general questions.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <SiteHeader />

      <div className="contact-page__layout">
        <section className="contact-page__intro" aria-labelledby="contact-title">
          <p className="eyebrow">Contact Frame</p>
          <h1 id="contact-title">Start a conversation.</h1>
          <p>
            For research, engineering, partnerships, press, privacy, or general
            questions, send us a note. It will go directly to the Frame team.
          </p>
          <ul aria-label="Reasons to contact Frame">
            <li>Research and engineering</li>
            <li>Partnerships and press</li>
            <li>General questions</li>
          </ul>
        </section>

        <ContactForm />
      </div>
    </main>
  );
}
