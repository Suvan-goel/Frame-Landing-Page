"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/company";

export function UnsubscribeControl({
  token,
  usePreorderLaunchCopy = false,
  previewSuccess = false,
}: {
  token: string;
  usePreorderLaunchCopy?: boolean;
  previewSuccess?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!previewSuccess || status !== "idle") return;

    const hostname = window.location.hostname.toLowerCase();
    if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return;

    const timer = window.setTimeout(() => {
      setMessage(
        usePreorderLaunchCopy
          ? "You’ve been unsubscribed from Frame updates."
          : "You’ve been unsubscribed from Frame development updates.",
      );
      setStatus("done");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [previewSuccess, status, usePreorderLaunchCopy]);

  async function unsubscribe() {
    if (!token) {
      setStatus("error");
      setMessage("This unsubscribe link is invalid.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch(
        `/api/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Your preference could not be updated.");
      }
      setStatus("done");
      setMessage(
        usePreorderLaunchCopy
          ? "You’ve been unsubscribed from Frame updates."
          : "You’ve been unsubscribed from Frame development updates.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Your preference could not be updated.",
      );
    }
  }

  if (status === "done") {
    return (
      <section className="unsubscribe-card unsubscribe-card--status" role="status" aria-live="polite">
        <span className="unsubscribe-state__mark unsubscribe-state__mark--success" aria-hidden="true">✓</span>
        <p className="eyebrow">Email preference updated</p>
        <h1>You’re unsubscribed.</h1>
        <p className="unsubscribe-state__message">{message}</p>
        <p className="unsubscribe-state__guidance">
          Essential messages about an active order or paid membership will still reach you.
        </p>
        <Link className="button button--dark unsubscribe-state__action" href="/">
          Return to Frame
        </Link>
      </section>
    );
  }

  if (!token || status === "error") {
    return (
      <section className="unsubscribe-card unsubscribe-card--status unsubscribe-card--error" role="alert">
        <span className="unsubscribe-state__mark unsubscribe-state__mark--error" aria-hidden="true">!</span>
        <p className="eyebrow">Link problem</p>
        <h1>We couldn’t update your preferences.</h1>
        <p className="unsubscribe-state__message">
          {message || "This unsubscribe link is invalid."}
        </p>
        <p className="unsubscribe-state__guidance">
          Use the unsubscribe link in the most recent Frame email, or contact us if you still need help.
        </p>
        <div className="unsubscribe-state__actions">
          <Link className="button button--dark" href="/">
            Return to Frame
          </Link>
          <a className="text-link" href={`mailto:${SUPPORT_EMAIL}`}>
            Contact support
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="unsubscribe-card" aria-labelledby="unsubscribe-title">
      <p className="eyebrow">Email preferences</p>
      <h1 id="unsubscribe-title">
        {usePreorderLaunchCopy
          ? "Stop Frame updates?"
          : "Stop Frame development updates?"}
      </h1>
      <p className="unsubscribe-card__intro">
        Confirm below and we’ll update this email address immediately.
      </p>

      <dl className="unsubscribe-impact">
        <div>
          <dt>You’ll stop receiving</dt>
          <dd>
            {usePreorderLaunchCopy
              ? "Frame product and launch-update emails."
              : "Frame development and product-update emails."}
          </dd>
        </div>
        <div>
          <dt>You’ll still receive</dt>
          <dd>Essential messages about an active order or paid membership.</dd>
        </div>
      </dl>

      <div className="unsubscribe-control">
        <button
          className="button button--dark"
          type="button"
          onClick={unsubscribe}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Updating…" : "Confirm unsubscribe"}
        </button>
        <Link className="text-link" href="/">
          Keep receiving updates
        </Link>
      </div>
    </section>
  );
}
