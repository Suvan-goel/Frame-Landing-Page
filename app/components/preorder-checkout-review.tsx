"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  parsePreorderCheckoutRequestKey,
  PREORDER_CHECKOUT_REQUEST_KEY,
  serializePreorderCheckoutRequestKey,
} from "@/lib/preorder-checkout-draft";
import { companyLegalIdentityLine } from "@/lib/company";
import { trackWaitlistEvent } from "./meta-pixel";

const sellerIdentityLine = companyLegalIdentityLine();

function readCheckoutDraft(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveCheckoutRequestKey(requestKey: string) {
  try {
    window.sessionStorage.setItem(
      PREORDER_CHECKOUT_REQUEST_KEY,
      serializePreorderCheckoutRequestKey(requestKey),
    );
  } catch {
    // Storage may be unavailable; checkout must still continue.
  }
}

export function PreorderCheckoutReview({
  reservationPriceLabel,
  foundingPriceLabel,
  remainingBalanceLabel,
  shippingLabel,
  estimatedTotalLabel,
  estimatedShipping,
}: {
  reservationPriceLabel: string;
  foundingPriceLabel: string;
  remainingBalanceLabel: string;
  shippingLabel: string;
  estimatedTotalLabel: string;
  estimatedShipping: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const checkoutWasCancelled = new URLSearchParams(window.location.search).get("cancelled") === "1";
      setCancelled(checkoutWasCancelled);
      if (checkoutWasCancelled) {
        requestKey.current = parsePreorderCheckoutRequestKey(
          readCheckoutDraft(PREORDER_CHECKOUT_REQUEST_KEY),
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const query = new URLSearchParams(window.location.search);
    const checkoutRequestKey =
      (requestKey.current ??= window.crypto.randomUUID());
    trackWaitlistEvent("reservation_checkout_started", {
      source: query.get("source") ?? "preorder_review",
      attemptId: checkoutRequestKey,
    });
    try {
      const response = await fetch("/api/preorders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: 1,
          source: query.get("source") ?? "preorder_review",
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
          requestKey: checkoutRequestKey,
        }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Secure payment is temporarily unavailable.");
      }
      saveCheckoutRequestKey(checkoutRequestKey);
      window.location.assign(result.url);
    } catch (caught) {
      trackWaitlistEvent("reservation_checkout_error", {
        source: query.get("source") ?? "preorder_review",
        attemptId: checkoutRequestKey,
      });
      setError(caught instanceof Error ? caught.message : "Secure payment is temporarily unavailable.");
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout-review preorder-checkout-review" onSubmit={submit}>
      {cancelled ? (
        <div className="checkout-review__notice" role="status">
          Checkout was cancelled. No reservation was placed and no payment was taken.
        </div>
      ) : null}

      <div className="preorder-checkout-surface">
        <section
          className="preorder-order-summary-mobile"
          aria-labelledby="preorder-order-mobile-title"
        >
          <div className="preorder-order-summary-mobile__media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt=""
              width={240}
              height={240}
              priority
              unoptimized
            />
          </div>
          <div className="preorder-order-summary-mobile__body">
            <div className="preorder-order-summary-mobile__title">
              <h2 id="preorder-order-mobile-title">Frame</h2>
              <div className="preorder-order-summary-mobile__price">
                <strong>{reservationPriceLabel}</strong>
                <span>due today</span>
              </div>
            </div>
            <p className="preorder-order-summary-mobile__discount">
              Locks in your {foundingPriceLabel} price
            </p>
          </div>
          <dl className="preorder-order-summary-mobile__facts">
            <div>
              <dt>Estimated shipping</dt>
              <dd>{estimatedShipping}</dd>
            </div>
            <div>
              <dt>US shipping</dt>
              <dd>{shippingLabel}</dd>
            </div>
          </dl>
          <p className="preorder-order-summary-mobile__tax">
            {estimatedTotalLabel} reservation before tax · Tax calculated at secure checkout
          </p>
        </section>

        <section className="preorder-order-summary" aria-labelledby="preorder-order-title">
          <div className="preorder-order-summary__media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt="Frame upper-arm wearable preview"
              width={720}
              height={720}
              priority
              unoptimized
            />
          </div>

          <div className="preorder-order-summary__body">
            <div className="preorder-order-summary__title">
              <h2 id="preorder-order-title">Frame</h2>
            </div>
            <p className="preorder-order-summary__offer">
              <span>{reservationPriceLabel} today</span>
              <strong>Your price {foundingPriceLabel}</strong>
              <small>{remainingBalanceLabel} due before shipping</small>
            </p>
            <p className="preorder-order-summary__shipping">
              <span>Estimated shipping</span>
              <strong>{estimatedShipping}</strong>
            </p>
          </div>

          <div className="preorder-order-summary__checkout">
            <dl className="preorder-order-summary__prices">
              <div><dt>US shipping</dt><dd>{shippingLabel}</dd></div>
            </dl>
            <p className="preorder-order-summary__tax">
              {estimatedTotalLabel} reservation before tax · Tax calculated at secure checkout
            </p>
          </div>
        </section>

        <div className="preorder-checkout-conversion">
          <div className="preorder-checkout-body preorder-checkout-body--review-only">
            <div className="preorder-checkout-body__review">
              <section className="preorder-development-note" aria-labelledby="preorder-development-title">
                <div>
                  <h2 id="preorder-development-title">
                    <span className="preorder-review-copy__desktop">Preparing for launch.</span>
                    <span className="preorder-review-copy__mobile">Preparing for launch.</span>
                  </h2>
                  <p className="preorder-review-copy__desktop">
                    Your fully refundable {reservationPriceLabel} reservation locks in
                    your {foundingPriceLabel} price and counts toward that
                    total, leaving {remainingBalanceLabel} due before shipping. We
                    will ask before any later payment; there is no subscription.
                  </p>
                  <p className="preorder-review-copy__mobile">
                    Fully refundable {reservationPriceLabel} today. Lock in the{" "}
                    {foundingPriceLabel} price; {remainingBalanceLabel} is due
                    before shipping. No automatic later charge or subscription.
                  </p>
                </div>
                <Link href="/preorder/product-status">View product and shipping details →</Link>
              </section>
            </div>
          </div>

          <footer className="preorder-checkout-footer">
            {error ? <p className="form-error checkout-review__error" role="alert">{error}</p> : null}
            <div className="preorder-checkout-action">
              <button className="button button--dark checkout-review__submit" type="submit" disabled={submitting}>
                {submitting ? (
                  "Opening secure checkout…"
                ) : (
                  "Secure Stripe checkout"
                )}
              </button>
              <p className="preorder-checkout-action__promise">
                <span>
                  <span className="preorder-checkout-action__check" aria-hidden="true">✓</span>
                  Fully refundable
                </span>
                <span>
                  <span className="preorder-checkout-action__check" aria-hidden="true">✓</span>
                  No automatic later charges
                </span>
              </p>
            </div>

            <div className="preorder-checkout-footer__legal">
              <div className="checkout-review__policies">
                <Link href="/privacy">Privacy Notice</Link>
              </div>
              {sellerIdentityLine ? (
                <details className="preorder-seller-details">
                  <summary>Seller information</summary>
                  <p>{sellerIdentityLine}</p>
                </details>
              ) : null}
            </div>
          </footer>
        </div>
      </div>
    </form>
  );
}
