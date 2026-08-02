"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BrandWordmark } from "./components/brand-wordmark";

const COLLABORATION_EMAIL = "support@framewearable.com";
const INSTAGRAM_URL = "https://www.instagram.com/framewearable/";
const WAITLIST_JOINED_STORAGE_KEY = "frame-waitlist-joined";
const WAITLIST_PROMPT_SEEN_SESSION_KEY = "frame-waitlist-prompt-seen";
const WAITLIST_JOINED_EVENT = "frame:waitlist-joined";
const WAITLIST_PROMPT_DELAY_MS = 12_000;
const WAITLIST_SCROLL_THRESHOLD = 0.4;
const MIN_MOTIVATION_LENGTH = 30;
const MAX_MOTIVATION_LENGTH = 500;
const MIN_AGE = 18;
const MAX_AGE = 120;
const GENDER_OPTIONS = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["non_binary", "Non-binary"],
  ["another_identity", "Another identity"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;

const content = {
  navigation: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Research", href: "#research" },
  ],
  insights: [
    ["Baseline", "What is normal for you during comparable periods."],
    ["Recovery", "How quickly you return toward your usual pattern."],
    ["Response", "How your cardiovascular system changes around meaningful events."],
    ["Confidence", "What was measured reliably-and what was not."],
  ],
  principles: [
    ["Personal, not generic", "Interpreted against your own baseline and daily context."],
    ["Context before judgment", "A temporary rise is not automatically a concern."],
    ["Patterns over moments", "Repeated associations matter more than any single event."],
    ["Honest gaps", "When a signal is unreliable, Frame does not invent an answer."],
  ],
  researchStandards: [
    ["Signal integrity", "Report confidence and coverage alongside every measurement."],
    ["Human validation", "Evaluate comfort, motion tolerance, and repeatability in real use."],
    ["Responsible claims", "Only communicate conclusions supported by evidence."],
  ],
  contact: {
    general: "support@framewearable.com",
    collaboration: COLLABORATION_EMAIL,
  },
} as const;

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

type WaitlistStatus = "idle" | "submitting" | "joined" | "updated" | "error";
type WaitlistField =
  | "firstName"
  | "lastName"
  | "email"
  | "gender"
  | "age"
  | "motivation";
type WaitlistErrors = Partial<Record<WaitlistField, string>>;

function WaitlistForm({
  idPrefix,
  placement,
  tone = "light",
}: {
  idPrefix: string;
  placement: "hero" | "footer" | "popup";
  tone?: "light" | "dark";
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [motivation, setMotivation] = useState("");
  const [errors, setErrors] = useState<WaitlistErrors>({});
  const [submissionError, setSubmissionError] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");

  function clearFieldError(field: WaitlistField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmissionError("");
    if (status === "error") setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const normalizedFirstName = firstName.trim().replace(/\s+/g, " ");
    const normalizedLastName = lastName.trim().replace(/\s+/g, " ");
    const normalizedEmail = email.trim();
    const normalizedAge = age.trim();
    const parsedAge = Number(normalizedAge);
    const normalizedMotivation = motivation.trim();
    const nextErrors: WaitlistErrors = {};

    if (!normalizedFirstName || normalizedFirstName.length > 60) {
      nextErrors.firstName = "Enter your first name.";
    }
    if (!normalizedLastName || normalizedLastName.length > 60) {
      nextErrors.lastName = "Enter your last name.";
    }
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!GENDER_OPTIONS.some(([value]) => value === gender)) {
      nextErrors.gender = "Select a gender option.";
    }
    if (
      !/^\d{1,3}$/.test(normalizedAge) ||
      !Number.isInteger(parsedAge) ||
      parsedAge < MIN_AGE ||
      parsedAge > MAX_AGE
    ) {
      nextErrors.age = `Enter an age between ${MIN_AGE} and ${MAX_AGE}.`;
    }
    if (normalizedMotivation.length < MIN_MOTIVATION_LENGTH) {
      nextErrors.motivation = `Write at least ${MIN_MOTIVATION_LENGTH} characters so we can understand the problem you want Frame to solve.`;
    } else if (normalizedMotivation.length > MAX_MOTIVATION_LENGTH) {
      nextErrors.motivation = `Keep your response to ${MAX_MOTIVATION_LENGTH} characters or fewer.`;
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStatus("error");
      return;
    }

    setErrors({});
    setSubmissionError("");
    setStatus("submitting");

    const query = new URLSearchParams(window.location.search);
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          gender,
          age: parsedAge,
          motivation: normalizedMotivation,
          website: formData.get("website"),
          placement,
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
        }),
      });
      const result = (await response.json()) as {
        status?: "joined" | "updated";
        error?: string;
      };

      if (!response.ok || !result.status) {
        throw new Error(
          result.error ?? "We couldn’t save your application. Please try again.",
        );
      }

      setStatus(result.status);
      try {
        window.localStorage.setItem(WAITLIST_JOINED_STORAGE_KEY, "true");
      } catch {
        // A successful signup should not be affected by unavailable storage.
      }
      window.dispatchEvent(new Event(WAITLIST_JOINED_EVENT));
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your application. Please try again.",
      );
      setStatus("error");
    }
  }

  if (status === "joined" || status === "updated") {
    return (
      <div
        className={`form-success form-success--${tone}`}
        role="status"
        aria-live="polite"
      >
        <div>
          <strong>
            {status === "joined"
              ? "Application received."
              : "Your application is updated."}
          </strong>
          <p>Thanks, {firstName.trim()}. We review every response thoughtfully.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setFirstName("");
            setLastName("");
            setEmail("");
            setGender("");
            setAge("");
            setMotivation("");
          }}
        >
          Submit another response
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
      {placement === "hero" ? (
        <div className="waitlist-form__intro">
          <strong>Tell us how Frame could fit into your life.</strong>
          <p>
            We’re inviting a small group of early users. Your response helps us
            understand who Frame can serve best.
          </p>
        </div>
      ) : null}
      <p className="form-required-note">All fields are required.</p>
      <div className="form-name-fields">
        <div className="form-field">
          <label htmlFor={`${idPrefix}-first-name`}>First name</label>
          <input
            id={`${idPrefix}-first-name`}
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              clearFieldError("firstName");
            }}
            disabled={status === "submitting"}
            required
            maxLength={60}
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={
              errors.firstName ? `${idPrefix}-first-name-error` : undefined
            }
          />
          {errors.firstName ? (
            <p
              className="form-error"
              id={`${idPrefix}-first-name-error`}
              role="alert"
            >
              {errors.firstName}
            </p>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-last-name`}>Last name</label>
          <input
            id={`${idPrefix}-last-name`}
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              clearFieldError("lastName");
            }}
            disabled={status === "submitting"}
            required
            maxLength={60}
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={
              errors.lastName ? `${idPrefix}-last-name-error` : undefined
            }
          />
          {errors.lastName ? (
            <p
              className="form-error"
              id={`${idPrefix}-last-name-error`}
              role="alert"
            >
              {errors.lastName}
            </p>
          ) : null}
        </div>
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
            clearFieldError("email");
          }}
          disabled={status === "submitting"}
          required
          maxLength={254}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={
            errors.email ? `${idPrefix}-email-error` : undefined
          }
        />
        {errors.email ? (
          <p
            className="form-error"
            id={`${idPrefix}-email-error`}
            role="alert"
          >
            {errors.email}
          </p>
        ) : null}
      </div>
      <div className="form-demographic-fields">
        <div className="form-field">
          <label htmlFor={`${idPrefix}-gender`}>Gender</label>
          <select
            id={`${idPrefix}-gender`}
            name="gender"
            value={gender}
            onChange={(event) => {
              setGender(event.target.value);
              clearFieldError("gender");
            }}
            disabled={status === "submitting"}
            required
            aria-invalid={Boolean(errors.gender)}
            aria-describedby={
              errors.gender ? `${idPrefix}-gender-error` : undefined
            }
          >
            <option value="" disabled>
              Select an option
            </option>
            {GENDER_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.gender ? (
            <p
              className="form-error"
              id={`${idPrefix}-gender-error`}
              role="alert"
            >
              {errors.gender}
            </p>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-age`}>Age</label>
          <input
            id={`${idPrefix}-age`}
            name="age"
            type="number"
            inputMode="numeric"
            placeholder="Age"
            value={age}
            onChange={(event) => {
              setAge(event.target.value);
              clearFieldError("age");
            }}
            disabled={status === "submitting"}
            required
            min={MIN_AGE}
            max={MAX_AGE}
            step={1}
            aria-invalid={Boolean(errors.age)}
            aria-describedby={errors.age ? `${idPrefix}-age-error` : undefined}
          />
          {errors.age ? (
            <p
              className="form-error"
              id={`${idPrefix}-age-error`}
              role="alert"
            >
              {errors.age}
            </p>
          ) : null}
        </div>
      </div>
      <div className="form-field form-field--motivation">
        <label htmlFor={`${idPrefix}-motivation`}>
          How would you use Frame?
        </label>
        <textarea
          id={`${idPrefix}-motivation`}
          name="motivation"
          placeholder="Tell us what you expect Frame to solve for you that existing products cannot"
          value={motivation}
          onChange={(event) => {
            setMotivation(event.target.value);
            clearFieldError("motivation");
          }}
          disabled={status === "submitting"}
          required
          minLength={MIN_MOTIVATION_LENGTH}
          maxLength={MAX_MOTIVATION_LENGTH}
          aria-invalid={Boolean(errors.motivation)}
          aria-describedby={`${idPrefix}-motivation-hint${
            errors.motivation ? ` ${idPrefix}-motivation-error` : ""
          }`}
        />
        <div className="field-hint" id={`${idPrefix}-motivation-hint`}>
          <span>Minimum {MIN_MOTIVATION_LENGTH} characters</span>
          <span>
            {motivation.trim().length}/{MAX_MOTIVATION_LENGTH}
          </span>
        </div>
        {errors.motivation ? (
          <p
            className="form-error"
            id={`${idPrefix}-motivation-error`}
            role="alert"
          >
            {errors.motivation}
          </p>
        ) : null}
      </div>
      {submissionError ? (
        <p className="form-error form-error--submission" role="alert">
          {submissionError}
        </p>
      ) : null}
      <button
        className={`button ${tone === "dark" ? "button--dark" : "button--light"}`}
        type="submit"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Submitting…" : "Sign me up!"}
      </button>
      <p className="form-note" id={`${idPrefix}-note`}>
        We’ll only contact you about Frame. No spam. Please don’t include
        private medical information. Unsubscribe any time.{" "}
        <a href="/privacy">Privacy</a>
      </p>
    </form>
  );
}

function WaitlistPopup() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    try {
      if (
        window.localStorage.getItem(WAITLIST_JOINED_STORAGE_KEY) === "true" ||
        window.sessionStorage.getItem(WAITLIST_PROMPT_SEEN_SESSION_KEY) ===
          "true"
      ) {
        return;
      }
    } catch {
      // Continue with the prompt when browser storage is unavailable.
    }

    function removePromptTriggers() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    }

    function showPrompt() {
      if (dialog.open) return;

      removePromptTriggers();
      try {
        window.sessionStorage.setItem(
          WAITLIST_PROMPT_SEEN_SESSION_KEY,
          "true",
        );
      } catch {
        // The prompt remains dismissible when browser storage is unavailable.
      }
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="firstName"]')?.focus();
    }

    function handleScroll() {
      const scrollableDistance =
        document.documentElement.scrollHeight - window.innerHeight;
      if (
        scrollableDistance > 0 &&
        window.scrollY / scrollableDistance >= WAITLIST_SCROLL_THRESHOLD
      ) {
        showPrompt();
      }
    }

    function handleJoined() {
      removePromptTriggers();
      if (dialog.open) dialog.close();
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === WAITLIST_JOINED_STORAGE_KEY &&
        event.newValue === "true"
      ) {
        handleJoined();
      }
    }

    const timer = window.setTimeout(showPrompt, WAITLIST_PROMPT_DELAY_MS);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener(WAITLIST_JOINED_EVENT, handleJoined);
    window.addEventListener("storage", handleStorage);
    handleScroll();

    return () => {
      removePromptTriggers();
      window.removeEventListener(WAITLIST_JOINED_EVENT, handleJoined);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <dialog
      className="waitlist-popup"
      ref={dialogRef}
      aria-labelledby="waitlist-popup-title"
      aria-describedby="waitlist-popup-description"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
    >
      <div className="waitlist-popup__card">
        <button
          className="waitlist-popup__close"
          type="button"
          aria-label="Close waitlist signup"
          onClick={() => dialogRef.current?.close()}
        >
          Close <span aria-hidden="true">×</span>
        </button>
        <p className="eyebrow">Frame early access</p>
        <h2 id="waitlist-popup-title">
          Tell us how Frame could fit into your life.
        </h2>
        <p id="waitlist-popup-description">
          We’re inviting a small group of early users. Your response helps us
          understand who Frame can serve best.
        </p>
        <WaitlistForm
          idPrefix="popup-waitlist"
          placement="popup"
          tone="dark"
        />
      </div>
    </dialog>
  );
}

export default function Home() {
  return (
    <main>
      <WaitlistPopup />
      <header className="nav-shell">
        <nav className="nav container" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="Frame home">
            <BrandWordmark priority />
          </a>
          <div className="nav-links">
            {content.navigation.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <a className="nav-cta" href="#early-access">
            Apply for early access
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
              and recovery-then turns them into clear, personal insight.
            </p>
            <div className="hero-actions">
              <a className="button button--dark" href="#early-access">
                Interested?
              </a>
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
          <figure className="hero-visuals">
            <div className="hero-lifestyle">
              <Image
                src="/frame-on-arm-editorial-v7-product-transparent.png"
                alt="Frame wearable concept fitted around a person's upper arm"
                fill
                sizes="(max-width: 680px) 100vw, (max-width: 980px) 56vw, 34vw"
                quality={88}
                unoptimized
                loading="eager"
                fetchPriority="high"
              />
            </div>
            <figcaption>Product concept · final industrial design in development</figcaption>
          </figure>
        </div>
      </section>

      <section className="context-section section" id="product">
        <div className="container context-container">
          <div className="context-intro">
            <p className="eyebrow">Why context matters</p>
            <h2>A single reading cannot show a pattern.</h2>
            <p>
              Blood pressure changes with sleep, movement, stress, exercise,
              food, posture, and recovery. Most people only see an occasional
              snapshot. Frame aims to help make sense of what happens in
              between-without treating every temporary rise as harmful.
            </p>
          </div>
          <div className="context-content">
            <div className="insight-list" aria-label="Baseline and recovery">
              {content.insights.slice(0, 2).map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
            <figure className="product-concept-showcase">
              <div className="product-concept-showcase__media">
                <Image
                  src="/frame-product-concept-realistic-v3-transparent.png"
                  alt="Refined Frame upper-arm wearable concept with an adjustable charcoal knit band, burgundy clasp, and integrated ultrasound sensor"
                  width={1254}
                  height={1254}
                  sizes="(max-width: 680px) 84vw, (max-width: 980px) 480px, 42vw"
                  quality={88}
                  unoptimized
                />
              </div>
              <figcaption>Product concept · final industrial design in development</figcaption>
            </figure>
            <div className="insight-list" aria-label="Response and confidence">
              {content.insights.slice(2).map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 3}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
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
          <div className="method-layout">
            <figure className="wide-image">
              <div className="wide-image-media image-frame">
                <Image
                  src="/frame-sensing-concept-realistic-v3-transparent.png"
                  alt="Exploded sensing concept showing the refined Frame ultrasound contact module above skin, tissue, and an artery"
                  className="cover-image"
                  fill
                  sizes="(max-width: 680px) calc(100vw - 72px), (max-width: 980px) 40vw, 480px"
                  quality={86}
                  unoptimized
                />
              </div>
              <figcaption>
                Simplified sensing concept · anatomy and final sensor
                configuration are illustrative
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
                  <p>
                    Motion, contact, temperature, sleep, and activity add
                    meaning.
                  </p>
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
        </div>
      </section>

      <section className="software-section section">
        <div className="container software-grid">
          <figure className="software-image image-frame">
            <Image
              src="/frame-app-studio-v5.png"
              alt="Refined Frame companion app in an accurately proportioned iPhone 17 mockup, showing 82 percent reliable overnight coverage, a motion interruption, and a late meal timing pattern"
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
              Continuous monitoring should create context, not continuous
              conclusions.
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
          <aside className="research-panel">
            <span className="status-label">Research approach</span>
            <h3>Evidence before claims.</h3>
            <p>
              Frame is evaluating signal quality, wearability, and measurement
              accuracy before making broader claims.
            </p>
            <div className="research-standards" aria-label="Frame research standards">
              {content.researchStandards.map(([title, description]) => (
                <article key={title}>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </article>
              ))}
            </div>
            <a
              className="text-link"
              href={`mailto:${content.contact.collaboration}?subject=Frame%20research%20collaboration`}
            >
              Research and engineering inquiries <Arrow />
            </a>
          </aside>
        </div>
      </section>

      <section className="final-cta" id="early-access">
        <div className="container final-grid">
          <div className="final-cta__copy">
            <p className="eyebrow">Early access</p>
            <h2>Help shape a new way to understand cardiovascular health.</h2>
            <a
              className="collaboration-link"
              href={`mailto:${content.contact.collaboration}?subject=Frame%20research%20collaboration`}
            >
              Interested in research or engineering collaboration? <Arrow />
            </a>
          </div>
          <div className="final-cta__form">
            <p>
              We’re inviting a small group of early users. Your response helps
              us understand who Frame can serve best.
            </p>
            <WaitlistForm idPrefix="footer-waitlist" placement="footer" />
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-top">
          <a
            className="wordmark wordmark--footer"
            href="#top"
            aria-label="Frame home"
          >
            <BrandWordmark variant="light" />
          </a>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#research">Research</a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Frame on Instagram (opens in a new tab)"
            >
              Instagram <Arrow />
            </a>
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
