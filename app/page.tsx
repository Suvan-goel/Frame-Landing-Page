"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

const COLLABORATION_EMAIL = "research@frame.health";

const content = {
  navigation: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Research", href: "#research" },
  ],
  insights: [
    ["Baseline", "What is normal for you during comparable periods."],
    ["Response", "How your cardiovascular system changes around meaningful events."],
    ["Recovery", "How quickly you return toward your usual pattern."],
    ["Confidence", "What was measured reliably—and what was not."],
  ],
  principles: [
    ["Personal, not generic", "Compared with your own baseline and context."],
    ["Context before judgement", "A temporary rise is not automatically bad."],
    ["Patterns over moments", "Repeated associations matter more than one event."],
    ["Honest gaps", "No reliable signal means no fabricated number."],
  ],
  stages: [
    "Bench validation",
    "Human feasibility",
    "Sleep and rest validation",
    "Expanded daily-life coverage",
  ],
  contact: {
    general: "hello@frame.health",
    collaboration: COLLABORATION_EMAIL,
  },
} as const;

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

type WaitlistStatus =
  | "idle"
  | "submitting"
  | "joined"
  | "already_joined"
  | "error";

function WaitlistForm({
  idPrefix,
  placement,
  tone = "light",
}: {
  idPrefix: string;
  placement: "hero" | "footer";
  tone?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const normalizedEmail = email.trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      setError("Enter a valid email address.");
      setStatus("error");
      return;
    }

    setError("");
    setStatus("submitting");

    const query = new URLSearchParams(window.location.search);
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          website: formData.get("website"),
          placement,
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
        }),
      });
      const result = (await response.json()) as {
        status?: "joined" | "already_joined";
        error?: string;
      };

      if (!response.ok || !result.status) {
        throw new Error(
          result.error ?? "We couldn’t save your email. Please try again.",
        );
      }

      setStatus(result.status);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We couldn’t save your email. Please try again.",
      );
      setStatus("error");
    }
  }

  if (status === "joined" || status === "already_joined") {
    return (
      <div
        className={`form-success form-success--${tone}`}
        role="status"
        aria-live="polite"
      >
        <div>
          <strong>
            {status === "joined" ? "You’re on the list." : "You’re already in."}
          </strong>
          <p>We’ll share thoughtful updates as Frame develops.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
        >
          Use another email
        </button>
      </div>
    );
  }

  return (
    <form
      className={`waitlist-form waitlist-form--${tone}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="honeypot" aria-hidden="true">
        <label htmlFor={`${idPrefix}-website`}>Website</label>
        <input
          id={`${idPrefix}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-email`}>Email address</label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "error") {
              setError("");
              setStatus("idle");
            }
          }}
          disabled={status === "submitting"}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${idPrefix}-error ${idPrefix}-note` : `${idPrefix}-note`
          }
        />
        {error ? (
          <p className="form-error" id={`${idPrefix}-error`} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        className={`button ${tone === "dark" ? "button--dark" : "button--light"}`}
        type="submit"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Joining…" : "Join early access"}{" "}
        {status === "submitting" ? null : <Arrow />}
      </button>
      <p className="form-note" id={`${idPrefix}-note`}>
        Product and research updates only. Unsubscribe any time.{" "}
        <a href="/privacy">Privacy</a>
      </p>
    </form>
  );
}

export default function Home() {
  return (
    <main>
      <header className="nav-shell">
        <nav className="nav container" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="Frame home">
            Frame<span>.</span>
          </a>
          <div className="nav-links">
            {content.navigation.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <a className="nav-cta" href="#early-access">
            Join early access
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid container">
          <div className="hero-copy">
            <div className="hero-meta">
              <p className="eyebrow">Blood pressure, in context.</p>
              <span>Currently in development</span>
            </div>
            <h1>See how your cardiovascular system responds to daily life.</h1>
            <p className="hero-intro">
              Frame is developing a non-invasive upper-arm wearable that uses
              ultrasound to track blood-pressure patterns through sleep, rest,
              and recovery—then turns them into clear, personal insight.
            </p>
            <div className="hero-actions">
              <WaitlistForm
                idPrefix="hero-waitlist"
                placement="hero"
                tone="dark"
              />
              <a className="text-link" href="#how-it-works">
                How it works <span aria-hidden="true">↓</span>
              </a>
            </div>
            <ul className="attributes" aria-label="Product attributes">
              <li>Non-invasive</li>
              <li>Ultrasound-based</li>
              <li>Screenless</li>
            </ul>
          </div>
          <figure className="hero-image image-frame">
            <Image
              src="/frame-product-studio.png"
              alt="Frame screenless cardiovascular wearable in charcoal knit with an integrated ultrasound sensor"
              className="cover-image"
              fill
              sizes="(max-width: 980px) calc(100vw - 64px), 55vw"
              quality={88}
              unoptimized
              loading="eager"
              fetchPriority="high"
            />
            <figcaption>Product concept · final industrial design in development</figcaption>
          </figure>
        </div>
      </section>

      <section className="context-section section" id="product">
        <div className="container narrow">
          <div className="context-intro">
            <p className="eyebrow">Why context matters</p>
            <h2>A single reading cannot show a pattern.</h2>
            <p>
              Blood pressure changes with sleep, movement, stress, exercise,
              food, posture, and recovery. Most people only see an occasional
              snapshot. Frame aims to help make sense of what happens in
              between—without treating every temporary rise as harmful.
            </p>
          </div>
          <div className="insight-list" aria-label="The four concepts behind Frame">
            {content.insights.map(([title, description], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="method-section section" id="how-it-works">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Ultrasound, made wearable.</h2>
            <p>
              Ultrasound can look beneath the surface and observe the artery
              itself. Frame is exploring how to make that signal dependable,
              comfortable, and useful over time.
            </p>
          </div>
          <figure className="wide-image image-frame">
            <Image
              src="/frame-sensing-studio.png"
              alt="Exploded sensing concept showing the Frame ultrasound sensor above skin, tissue, and an artery"
              className="cover-image"
              fill
              sizes="(max-width: 680px) calc(100vw - 36px), (max-width: 1244px) calc(100vw - 64px), 1180px"
              quality={86}
              unoptimized
            />
            <figcaption>
              Simplified sensing concept · anatomy and final sensor configuration
              are illustrative
            </figcaption>
          </figure>
          <ol className="method-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Observe</h3>
                <p>A specialised sensor observes the artery beneath the skin.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Interpret</h3>
                <p>Arterial features are analysed using a personalised model.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Add context</h3>
                <p>Motion, contact, temperature, sleep, and activity add meaning.</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h3>Show what is trusted</h3>
                <p>Uncertain or interrupted periods remain clearly marked.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="software-section section">
        <div className="container software-grid">
          <figure className="software-image image-frame">
            <Image
              src="/frame-app-studio.png"
              alt="Frame companion app showing reliable overnight coverage, an interrupted period, and a pattern to explore"
              className="cover-image"
              fill
              sizes="(max-width: 980px) calc(100vw - 64px), 58vw"
              quality={86}
              unoptimized
            />
          </figure>
          <div className="software-copy">
            <p className="eyebrow">The experience</p>
            <h2>From measurements to personal experiments.</h2>
            <p>
              Frame is designed to explain patterns relative to your baseline,
              show how long a response lasts, and make confidence part of every
              result.
            </p>
            <blockquote>
              <span>Pattern to explore</span>
              “On three similar nights, later meals were associated with a
              higher overnight pattern.”
              <small>An association, not a conclusion.</small>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="principles-section section" id="research">
        <div className="container principles-grid">
          <div className="principles-copy">
            <p className="eyebrow">Product principles</p>
            <h2>
              Continuous monitoring does not mean continuous guessing.
            </h2>
            <div className="principle-list">
              {content.principles.map(([title, description]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="research-card">
            <span className="status-label">Research-stage technology</span>
            <h3>Building the evidence before making the promise.</h3>
            <p>
              Frame is currently testing sensing location, long-duration
              contact, calibration, motion tolerance, comfort, and measurement
              accuracy.
            </p>
            <ol>
              {content.stages.map((stage, index) => (
                <li key={stage}>
                  <span>{index + 1}</span>
                  {stage}
                  {index === 0 ? <small>Current focus</small> : null}
                </li>
              ))}
            </ol>
            <a
              className="text-link"
              href={`mailto:${content.contact.collaboration}?subject=Working%20on%20Frame`}
            >
              Work on Frame <Arrow />
            </a>
          </aside>
        </div>
      </section>

      <section className="final-cta" id="early-access">
        <div className="container final-grid">
          <div>
            <p className="eyebrow">Early access</p>
            <h2>Help shape a new way to understand cardiovascular health.</h2>
          </div>
          <div>
            <p>
              Join for research updates, product progress, and future testing
              opportunities.
            </p>
            <WaitlistForm idPrefix="footer-waitlist" placement="footer" />
            <a
              className="collaboration-link"
              href={`mailto:${content.contact.collaboration}?subject=Frame%20research%20collaboration`}
            >
              Interested in research or engineering collaboration? <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-top">
          <a className="wordmark wordmark--footer" href="#top">
            Frame<span>.</span>
          </a>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#research">Research</a>
            <a href="/privacy">Privacy</a>
            <a href={`mailto:${content.contact.general}`}>Contact</a>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>
            Frame is under development and is not currently available for sale.
            Product concepts and interfaces shown are illustrative. Frame is not
            intended to diagnose or treat any medical condition.
          </p>
          <p>© {new Date().getFullYear()} Frame Health Technologies</p>
        </div>
      </footer>
    </main>
  );
}
