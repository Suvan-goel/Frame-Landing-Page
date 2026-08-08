"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

const MAX_MESSAGE_LENGTH = 3000;

const CONTACT_TOPICS = [
  ["general", "General question"],
  ["preorder", "Pre-order support"],
  ["research", "Research or engineering"],
  ["partnerships", "Partnership or press"],
  ["privacy", "Privacy or data request"],
  ["other", "Something else"],
] as const;

type FieldName = "name" | "email" | "topic" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;
type ContactStatus = "idle" | "submitting" | "sent" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedTopic = new URLSearchParams(window.location.search).get("topic");
      if (CONTACT_TOPICS.some(([value]) => value === requestedTopic)) {
        setTopic(requestedTopic ?? "general");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function clearError(field: FieldName) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmissionError("");
    if (status === "error") setStatus("idle");
  }

  function validate() {
    const nextErrors: FieldErrors = {};
    const normalizedName = name.trim().replace(/\s+/g, " ");
    const normalizedEmail = email.trim();
    const normalizedMessage = message.trim();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      nextErrors.name = "Enter your name.";
    }
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!CONTACT_TOPICS.some(([value]) => value === topic)) {
      nextErrors.topic = "Choose what you’d like to discuss.";
    }
    if (!normalizedMessage) {
      nextErrors.message = "Enter a message.";
    } else if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      nextErrors.message = `Keep your message to ${MAX_MESSAGE_LENGTH} characters or fewer.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    setSubmissionError("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().replace(/\s+/g, " "),
          email: email.trim(),
          topic,
          message: message.trim(),
          website: formData.get("website"),
        }),
      });
      const result = (await response.json()) as { sent?: boolean; error?: string };

      if (!response.ok || !result.sent) {
        throw new Error(result.error ?? "We couldn’t send your message. Please try again.");
      }

      setStatus("sent");
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We couldn’t send your message. Please try again.",
      );
      setStatus("error");
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setTopic("general");
    setMessage("");
    setErrors({});
    setSubmissionError("");
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div className="contact-form__success" role="status" aria-live="polite">
        <span className="contact-form__success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Message sent</p>
        <h2>Thank you for reaching out.</h2>
        <p>
          Your message is with the Frame team. We’ll reply to {email.trim()} as
          soon as we can.
        </p>
        <div className="contact-form__success-actions">
          <Link className="button button--dark" href="/">
            <span aria-hidden="true">←</span> Back to home
          </Link>
          <button type="button" onClick={resetForm}>
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="contact-form__heading">
        <div>
          <p className="eyebrow">Send a message</p>
          <h2>How can we help?</h2>
          <p>Share a few details and we’ll make sure your message reaches the right person.</p>
        </div>
        <p className="contact-form__status">
          <span aria-hidden="true" />
          Replies by email
        </p>
      </div>

      <div className="contact-form__fields">
        <div className="form-field">
          <label htmlFor="contact-name">Name</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            maxLength={100}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name ? (
            <p className="form-error" id="contact-name-error" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email ? (
            <p className="form-error" id="contact-email-error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field contact-form__topic">
          <label htmlFor="contact-topic">What would you like to discuss?</label>
          <select
            id="contact-topic"
            name="topic"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              clearError("topic");
            }}
            aria-invalid={Boolean(errors.topic)}
            aria-describedby={errors.topic ? "contact-topic-error" : undefined}
          >
            {CONTACT_TOPICS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.topic ? (
            <p className="form-error" id="contact-topic-error" role="alert">
              {errors.topic}
            </p>
          ) : null}
        </div>

        <div className="form-field contact-form__message">
          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            name="message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              clearError("message");
            }}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message
                ? "contact-message-hint contact-message-error"
                : "contact-message-hint"
            }
            placeholder="Tell us what you’d like to discuss, and include any context that will help us respond."
          />
          <div className="field-hint" id="contact-message-hint">
            <span>Up to {MAX_MESSAGE_LENGTH} characters</span>
            <span>{message.trim().length}/{MAX_MESSAGE_LENGTH}</span>
          </div>
          {errors.message ? (
            <p className="form-error" id="contact-message-error" role="alert">
              {errors.message}
            </p>
          ) : null}
        </div>
      </div>

      {submissionError ? (
        <p className="form-error contact-form__submission-error" role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className="contact-form__footer">
        <p className="contact-form__note">
          Please don’t include private medical information. Your message is sent
          to support@framewearable.com.
        </p>
        <button
          className="button button--dark contact-form__submit"
          type="submit"
          disabled={status === "submitting"}
        >
          <span>{status === "submitting" ? "Sending…" : "Send message"}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
