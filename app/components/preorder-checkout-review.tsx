"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export function PreorderCheckoutReview({
  priceLabel,
  estimatedDelivery,
  allowedCountries,
}: {
  priceLabel: string;
  estimatedDelivery: string;
  allowedCountries: string[];
}) {
  const [productStatusAcknowledged, setProductStatusAcknowledged] = useState(false);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const countryLabel = allowedCountries
    .map((country) => country === "GB" ? "UK" : country)
    .join(", ");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCancelled(new URLSearchParams(window.location.search).get("cancelled") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productStatusAcknowledged) {
      setError("Confirm that you understand Frame is still in development.");
      return;
    }
    if (!termsAcknowledged) {
      setError("Accept the Pre-order Terms to continue.");
      return;
    }

    setSubmitting(true);
    setError("");
    const query = new URLSearchParams(window.location.search);
    try {
      const response = await fetch("/api/preorders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productStatusAcknowledged,
          termsAcknowledged,
          marketingOptIn,
          quantity: 1,
          source: query.get("source") ?? "preorder_review",
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
    <form className="checkout-review preorder-checkout-review" onSubmit={submit} noValidate>
      {cancelled ? (
        <div className="checkout-review__notice" role="status">
          Checkout was cancelled. No pre-order was placed and no payment was taken.
        </div>
      ) : null}

      <section className="preorder-order-card" aria-labelledby="preorder-order-title">
        <div className="preorder-order-card__top">
          <div className="checkout-summary__heading">
            <p className="eyebrow">Your pre-order</p>
            <h1 id="preorder-order-title">Frame</h1>
            <p>Continuous blood-pressure insight, designed for everyday life.</p>
          </div>
          <div className="checkout-summary__price">
            <span>Due today</span>
            <strong>{priceLabel}</strong>
          </div>
        </div>

        <dl className="preorder-order-facts">
          <div><dt>Quantity</dt><dd>1</dd></div>
          <div><dt>Available in</dt><dd>{countryLabel}</dd></div>
          <div><dt>Shipping</dt><dd>No charge today</dd></div>
          <div><dt>Estimated delivery</dt><dd>{estimatedDelivery}</dd></div>
        </dl>

        <div className="preorder-development-note">
          <p className="eyebrow">Important product information</p>
          <h2>Frame is still in development.</h2>
          <p>
            Final design, performance, regulatory status and delivery timing may change as engineering and manufacturing progress.
          </p>
          <Link href="/preorder/terms#product-status">Read the product status</Link>
        </div>
      </section>

      <fieldset className="checkout-review__acknowledgements">
        <legend>Before you continue</legend>
        <label className="checkout-checkbox checkout-checkbox--required">
          <input
            type="checkbox"
            checked={productStatusAcknowledged}
            onChange={(event) => { setProductStatusAcknowledged(event.target.checked); setError(""); }}
          />
          <span className="checkout-checkbox__copy">
            <strong>I understand that Frame is still in development.</strong>
            <span>Final specifications, approvals and delivery timing may change before fulfilment.</span>
          </span>
        </label>
        <label className="checkout-checkbox checkout-checkbox--required preorder-checkout-review__second-check">
          <input
            type="checkbox"
            checked={termsAcknowledged}
            onChange={(event) => { setTermsAcknowledged(event.target.checked); setError(""); }}
          />
          <span className="checkout-checkbox__copy">
            <strong>I agree to the Pre-order Terms and Refund Policy.</strong>
            <span>I have reviewed the terms that apply to this pre-order.</span>
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
            <strong>Send me occasional Frame news in addition to essential order updates.</strong>
            <span>You can unsubscribe from marketing at any time.</span>
          </span>
        </label>
      </fieldset>

      {error ? <p className="form-error checkout-review__error" role="alert">{error}</p> : null}
      <button className="button button--dark checkout-review__submit" type="submit" disabled={submitting}>
        {submitting ? "Opening secure checkout…" : `Continue to secure checkout — ${priceLabel}`}
      </button>
      <p className="checkout-review__footnote">
        Secure payment is provided by Stripe. Frame never receives or stores your full card number.
      </p>

      <div className="checkout-review__policies">
        <Link href="/preorder/terms">Pre-order Terms</Link>
        <Link href="/preorder/refunds">Refund Policy</Link>
        <Link href="/privacy">Privacy Notice</Link>
      </div>
    </form>
  );
}
