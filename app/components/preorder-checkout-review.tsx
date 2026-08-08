"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PREORDER_US_STATE_OPTIONS } from "@/lib/preorder-shipping";

export function PreorderCheckoutReview({
  priceLabel,
  shippingPriceLabel,
  estimatedTotalLabel,
  estimatedShipping,
}: {
  priceLabel: string;
  shippingPriceLabel: string;
  estimatedTotalLabel: string;
  estimatedShipping: string;
}) {
  const [productStatusAcknowledged, setProductStatusAcknowledged] = useState(false);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [delivery, setDelivery] = useState({
    email: "",
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCancelled(new URLSearchParams(window.location.search).get("cancelled") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
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
    requestKey.current ??= window.crypto.randomUUID();
    try {
      const response = await fetch("/api/preorders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productStatusAcknowledged,
          termsAcknowledged,
          customer: {
            email: delivery.email,
            fullName: delivery.fullName,
            shippingAddress: {
              line1: delivery.line1,
              line2: delivery.line2,
              city: delivery.city,
              state: delivery.state,
              postalCode: delivery.postalCode,
              country: "US",
            },
          },
          quantity: 1,
          source: query.get("source") ?? "preorder_review",
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
          requestKey: requestKey.current,
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
    <form className="checkout-review preorder-checkout-review" onSubmit={submit}>
      {cancelled ? (
        <div className="checkout-review__notice" role="status">
          Checkout was cancelled. No pre-order was placed and no payment was taken.
        </div>
      ) : null}

      <div className="preorder-checkout-surface">
        <section className="preorder-order-summary" aria-labelledby="preorder-order-title">
          <div className="preorder-order-summary__media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt="Frame upper-arm wearable product concept"
              width={720}
              height={720}
              priority
              unoptimized
            />
            <span>Product concept</span>
          </div>

          <div className="preorder-order-summary__body">
            <div className="preorder-order-summary__title">
              <h2 id="preorder-order-title">Frame</h2>
              <span>Qty 1</span>
            </div>
            <p className="preorder-order-summary__shipping">
              <span>Estimated shipping</span>
              <strong>{estimatedShipping}</strong>
            </p>
          </div>

          <div className="preorder-order-summary__checkout">
            <dl className="preorder-order-summary__prices">
              <div><dt>Product subtotal</dt><dd>{priceLabel}</dd></div>
              <div><dt>Standard US shipping</dt><dd>{shippingPriceLabel}</dd></div>
              <div className="preorder-order-summary__total">
                <dt>Estimated total</dt><dd>{estimatedTotalLabel}</dd>
              </div>
            </dl>
            <p className="preorder-order-summary__tax">Sales tax is calculated at Stripe Checkout.</p>
          </div>
        </section>

        <div className="preorder-checkout-body">
          <div className="preorder-checkout-body__delivery">
            <fieldset className="preorder-delivery-details">
              <legend>Delivery details</legend>
              <p>
                Enter the US address where you expect Frame to be shipped. Stripe
                uses it to calculate applicable sales tax.
              </p>
              <div className="preorder-delivery-details__grid">
                <label>
                  <span>Email address</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={delivery.email}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, email: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
                <label>
                  <span>Full name</span>
                  <input
                    required
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    value={delivery.fullName}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, fullName: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
                <label className="preorder-delivery-details__wide">
                  <span>Address line 1</span>
                  <input
                    required
                    autoComplete="shipping address-line1"
                    maxLength={200}
                    value={delivery.line1}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, line1: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
                <label className="preorder-delivery-details__wide">
                  <span>Address line 2 <small>Optional</small></span>
                  <input
                    autoComplete="shipping address-line2"
                    maxLength={200}
                    value={delivery.line2}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, line2: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__city">
                  <span>City</span>
                  <input
                    required
                    autoComplete="shipping address-level2"
                    maxLength={100}
                    value={delivery.city}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, city: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__state">
                  <span>State</span>
                  <select
                    required
                    autoComplete="shipping address-level1"
                    value={delivery.state}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, state: event.target.value }));
                      setError("");
                    }}
                  >
                    <option value="">Select a state</option>
                    {PREORDER_US_STATE_OPTIONS.map(([code, label]) => (
                      <option value={code} key={code}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__zip">
                  <span>ZIP code</span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="shipping postal-code"
                    pattern="[0-9]{5}(-[0-9]{4})?"
                    maxLength={10}
                    value={delivery.postalCode}
                    onChange={(event) => {
                      setDelivery((current) => ({ ...current, postalCode: event.target.value }));
                      setError("");
                    }}
                  />
                </label>
              </div>
              <p id="preorder-country-note" className="preorder-delivery-details__note">
                <strong>Shipping to the United States.</strong> Available in all 50 states and
                Washington, DC; US territories are not supported at launch.
              </p>
            </fieldset>
          </div>

          <div className="preorder-checkout-body__review">
            <section className="preorder-development-note" aria-labelledby="preorder-development-title">
              <div>
                <h2 id="preorder-development-title">Frame is still in development.</h2>
                <p>
                  Performance is not yet validated. Specifications and timing may
                  change. Frame is not currently FDA cleared or approved and is not
                  for medical decisions.
                </p>
              </div>
              <Link href="/preorder/product-status">Read Product Status →</Link>
            </section>

            <fieldset className="checkout-review__acknowledgements">
              <legend>Before you continue</legend>
              <div className="checkout-checkbox checkout-checkbox--required">
                <input
                  id="preorder-product-status-acknowledgement"
                  type="checkbox"
                  checked={productStatusAcknowledged}
                  onChange={(event) => { setProductStatusAcknowledged(event.target.checked); setError(""); }}
                />
                <span className="checkout-checkbox__copy">
                  <label htmlFor="preorder-product-status-acknowledgement">
                    <strong>I understand that Frame is a development-stage product.</strong>
                  </label>
                  <span>Specifications, validation and shipping timing may change. Frame is not for medical decisions.</span>
                </span>
              </div>
              <div className="checkout-checkbox checkout-checkbox--required preorder-checkout-review__second-check">
                <input
                  id="preorder-terms-acknowledgement"
                  type="checkbox"
                  checked={termsAcknowledged}
                  onChange={(event) => { setTermsAcknowledged(event.target.checked); setError(""); }}
                />
                <span className="checkout-checkbox__copy">
                  <label htmlFor="preorder-terms-acknowledgement">
                    <strong>I agree to the terms that apply to this pre-order.</strong>
                  </label>
                  <span>
                    Review the <Link href="/preorder/terms">Pre-order Terms</Link> and{" "}
                    <Link href="/preorder/refunds">Refund Policy</Link>.
                  </span>
                </span>
              </div>
            </fieldset>

          </div>
        </div>

        <footer className="preorder-checkout-footer">
          {error ? <p className="form-error checkout-review__error" role="alert">{error}</p> : null}
          <div className="preorder-checkout-action">
            <button className="button button--dark checkout-review__submit" type="submit" disabled={submitting}>
              {submitting ? "Opening secure checkout…" : "Continue to Secure Checkout"}
            </button>
            <p className="preorder-checkout-action__promise">
              One-time payment · Cancel before dispatch for a full refund
            </p>
          </div>

          <div className="checkout-review__policies">
            <Link href="/preorder/product-status">Product Status</Link>
            <Link href="/preorder/terms">Pre-order Terms</Link>
            <Link href="/preorder/refunds">Refund Policy</Link>
            <Link href="/privacy">Privacy Notice</Link>
          </div>
        </footer>
      </div>
    </form>
  );
}
