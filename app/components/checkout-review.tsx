"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export function CheckoutReview() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCancelled(new URLSearchParams(window.location.search).get("cancelled") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged) {
      setError("Confirm that you understand this is a membership and not a Frame device order.");
      return;
    }

    setSubmitting(true);
    setError("");
    const query = new URLSearchParams(window.location.search);
    try {
      const response = await fetch("/api/founding-contributors/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledged,
          marketingOptIn,
          source: query.get("source") ?? "membership_review",
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
        }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Secure payment is temporarily unavailable.");
      }
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Secure payment is temporarily unavailable.");
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout-review" onSubmit={submit} noValidate>
      {cancelled ? (
        <div className="checkout-review__notice" role="status">
          Payment was not completed. Your membership has not started and you have not been charged.
        </div>
      ) : null}

      <div className="checkout-summary">
        <div className="checkout-summary__heading">
          <p className="eyebrow">Membership summary</p>
          <h1>Frame Founding Contributor Membership</h1>
        </div>
        <div className="checkout-summary__price"><strong>$99</strong><span>one-time payment</span></div>
        <ul>
          <li><span>Community access</span><strong>12 months</strong></li>
          <li><span>Founding status</span><strong>Permanent</strong></li>
          <li><span>Renews automatically</span><strong>No</strong></li>
          <li><span>Frame device included</span><strong>No</strong></li>
          <li><span>Device reservation or pre-order</span><strong>No</strong></li>
          <li><span>Membership refund period</span><strong>14 days</strong></li>
        </ul>
      </div>

      <fieldset className="checkout-review__acknowledgements">
        <legend>Required acknowledgment</legend>
        <label className="checkout-checkbox checkout-checkbox--required">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => { setAcknowledged(event.target.checked); setError(""); }}
          />
          <span className="checkout-checkbox__copy">
            <strong>I understand this is a membership, not a Frame device order.</strong>
            <span>
              I am not ordering, reserving, pre-ordering, or paying toward a device. No product launch, authorization, performance level, price, or delivery date is guaranteed.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="checkout-review__marketing">
        <legend>Optional communications</legend>
        <label className="checkout-checkbox">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(event) => setMarketingOptIn(event.target.checked)}
          />
          <span className="checkout-checkbox__copy">
            <strong>
              Send me occasional Frame news and future product announcements, in addition to essential membership updates.
            </strong>
            <span>You can unsubscribe at any time.</span>
          </span>
        </label>
      </fieldset>

      {error ? <p className="form-error checkout-review__error" role="alert">{error}</p> : null}
      <button className="button button--dark checkout-review__submit" type="submit" disabled={submitting}>
        {submitting ? "Opening secure checkout…" : "Continue to secure checkout — $99"}
      </button>
      <p className="checkout-review__footnote">
        Payment details are entered on Stripe’s secure checkout. Frame does not receive or store your card number. Automatic tax is disabled during testing.
      </p>

      <div className="checkout-review__policies">
        <Link href="/contributors/terms">Membership Terms</Link>
        <Link href="/contributors/refunds">Refund Policy</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/contributors/product-status">Important Product Status Disclosure</Link>
      </div>
    </form>
  );
}
