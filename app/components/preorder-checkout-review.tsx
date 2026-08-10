"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  parsePreorderCheckoutRequestKey,
  parsePreorderDeliveryDraft,
  PREORDER_CHECKOUT_REQUEST_KEY,
  PREORDER_DELIVERY_DRAFT_KEY,
  serializePreorderCheckoutRequestKey,
  serializePreorderDeliveryDraft,
  type PreorderDeliveryDraft,
} from "@/lib/preorder-checkout-draft";
import { PREORDER_US_STATE_OPTIONS } from "@/lib/preorder-shipping";
import { companyLegalIdentityLine } from "@/lib/company";

const sellerIdentityLine = companyLegalIdentityLine();

function readCheckoutDraft(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveDeliveryDraft(delivery: PreorderDeliveryDraft) {
  try {
    window.sessionStorage.setItem(
      PREORDER_DELIVERY_DRAFT_KEY,
      serializePreorderDeliveryDraft(delivery),
    );
  } catch {
    // Storage may be unavailable; checkout must still continue.
  }
}

function saveCheckoutDraft(delivery: PreorderDeliveryDraft, requestKey: string) {
  saveDeliveryDraft(delivery);
  try {
    window.sessionStorage.setItem(
      PREORDER_CHECKOUT_REQUEST_KEY,
      serializePreorderCheckoutRequestKey(requestKey),
    );
  } catch {
    // Storage may be unavailable; checkout must still continue.
  }
}

function clearCheckoutRequestKey() {
  try {
    window.sessionStorage.removeItem(PREORDER_CHECKOUT_REQUEST_KEY);
  } catch {
    // Storage may be unavailable; checkout must still continue.
  }
}

export function PreorderCheckoutReview({
  priceLabel,
  releasePriceLabel,
  savingsLabel,
  discountPercent,
  shippingLabel,
  estimatedTotalLabel,
  estimatedShipping,
}: {
  priceLabel: string;
  releasePriceLabel: string;
  savingsLabel: string;
  discountPercent: number;
  shippingLabel: string;
  estimatedTotalLabel: string;
  estimatedShipping: string;
}) {
  const [productStatusAcknowledged, setProductStatusAcknowledged] = useState(false);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [delivery, setDelivery] = useState<PreorderDeliveryDraft>({
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
  const [acknowledgementError, setAcknowledgementError] = useState<
    "product-status" | "terms" | "both" | null
  >(null);
  const [cancelled, setCancelled] = useState(false);
  const requestKey = useRef<string | null>(null);
  const deliveryRef = useRef(delivery);
  const deliveryChangedSinceMount = useRef(false);
  const productStatusCheckbox = useRef<HTMLInputElement>(null);
  const termsCheckbox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const checkoutWasCancelled = new URLSearchParams(window.location.search).get("cancelled") === "1";
      setCancelled(checkoutWasCancelled);
      const restored = parsePreorderDeliveryDraft(
        readCheckoutDraft(PREORDER_DELIVERY_DRAFT_KEY),
      );
      if (restored && !deliveryChangedSinceMount.current) {
        deliveryRef.current = restored;
        setDelivery(restored);
      }
      if (checkoutWasCancelled && !deliveryChangedSinceMount.current) {
        requestKey.current = parsePreorderCheckoutRequestKey(
          readCheckoutDraft(PREORDER_CHECKOUT_REQUEST_KEY),
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateDelivery(
    field: keyof PreorderDeliveryDraft,
    value: string,
  ) {
    const nextDelivery = { ...deliveryRef.current, [field]: value };
    deliveryChangedSinceMount.current = true;
    deliveryRef.current = nextDelivery;
    requestKey.current = null;
    clearCheckoutRequestKey();
    saveDeliveryDraft(nextDelivery);
    setDelivery(nextDelivery);
    setError("");
  }

  function updateAcknowledgementError(
    nextProductStatusAcknowledged: boolean,
    nextTermsAcknowledged: boolean,
  ) {
    if (!acknowledgementError || (nextProductStatusAcknowledged && nextTermsAcknowledged)) {
      setAcknowledgementError(null);
      setError("");
      return;
    }
    if (!nextProductStatusAcknowledged && !nextTermsAcknowledged) {
      setAcknowledgementError("both");
      setError("Tick both highlighted checkboxes to continue to secure checkout.");
      return;
    }
    if (!nextProductStatusAcknowledged) {
      setAcknowledgementError("product-status");
      setError("Review and confirm Frame’s current product status.");
      return;
    }
    setAcknowledgementError("terms");
    setError("Accept the Pre-order Terms to continue.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    if (!productStatusAcknowledged || !termsAcknowledged) {
      const missingBoth = !productStatusAcknowledged && !termsAcknowledged;
      setError(
        missingBoth
          ? "Tick both highlighted checkboxes to continue to secure checkout."
          : !productStatusAcknowledged
            ? "Review and confirm Frame’s current product status."
            : "Accept the Pre-order Terms to continue.",
      );
      setAcknowledgementError(
        missingBoth
          ? "both"
          : !productStatusAcknowledged
            ? "product-status"
            : "terms",
      );
      window.requestAnimationFrame(() => {
        if (!productStatusAcknowledged) {
          productStatusCheckbox.current?.focus();
          productStatusCheckbox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        termsCheckbox.current?.focus();
        termsCheckbox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setSubmitting(true);
    setError("");
    const query = new URLSearchParams(window.location.search);
    const checkoutRequestKey =
      (requestKey.current ??= window.crypto.randomUUID());
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
          requestKey: checkoutRequestKey,
        }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Secure payment is temporarily unavailable.");
      }
      saveCheckoutDraft(delivery, checkoutRequestKey);
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
            <p className="preorder-order-summary__offer">
              <span>Pre-order saving</span>
              <strong>Save {savingsLabel}</strong>
              <small>{discountPercent}% off the {releasePriceLabel} release price</small>
            </p>
            <p className="preorder-order-summary__shipping">
              <span>Estimated shipping</span>
              <strong>{estimatedShipping}</strong>
            </p>
          </div>

          <div className="preorder-order-summary__checkout">
            <dl className="preorder-order-summary__prices">
              <div className="preorder-order-summary__release-price">
                <dt>Release price</dt><dd><del>{releasePriceLabel}</del></dd>
              </div>
              <div className="preorder-order-summary__saving">
                <dt>Pre-order saving</dt><dd>−{savingsLabel}</dd>
              </div>
              <div><dt>Product subtotal</dt><dd>{priceLabel}</dd></div>
              <div><dt>Standard US shipping</dt><dd>{shippingLabel}</dd></div>
              <div className="preorder-order-summary__total">
                <dt>Total before tax</dt><dd>{estimatedTotalLabel}</dd>
              </div>
            </dl>
            <p className="preorder-order-summary__tax">Applicable sales tax is calculated at Stripe Checkout.</p>
          </div>
        </section>

        <div className="preorder-checkout-body">
          <div className="preorder-checkout-body__delivery">
            <fieldset className="preorder-delivery-details" aria-describedby="preorder-country-note">
              <legend>Delivery details</legend>
              <p>
                Enter the US address where you’d like us to ship your Frame. Stripe
                will use it to calculate sales tax.
              </p>
              <div className="preorder-delivery-details__grid">
                <label htmlFor="preorder-delivery-email">
                  <span>Email address</span>
                  <input
                    id="preorder-delivery-email"
                    name="email"
                    required
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={delivery.email}
                    onChange={(event) => updateDelivery("email", event.target.value)}
                  />
                </label>
                <label htmlFor="preorder-delivery-name">
                  <span>Full name</span>
                  <input
                    id="preorder-delivery-name"
                    name="fullName"
                    required
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    value={delivery.fullName}
                    onChange={(event) => updateDelivery("fullName", event.target.value)}
                  />
                </label>
                <label className="preorder-delivery-details__wide" htmlFor="preorder-delivery-line1">
                  <span>Address line 1</span>
                  <input
                    id="preorder-delivery-line1"
                    name="addressLine1"
                    required
                    autoComplete="shipping address-line1"
                    minLength={3}
                    maxLength={200}
                    value={delivery.line1}
                    onChange={(event) => updateDelivery("line1", event.target.value)}
                  />
                </label>
                <label className="preorder-delivery-details__wide" htmlFor="preorder-delivery-line2">
                  <span>Address line 2 <small>Optional</small></span>
                  <input
                    id="preorder-delivery-line2"
                    name="addressLine2"
                    autoComplete="shipping address-line2"
                    maxLength={200}
                    value={delivery.line2}
                    onChange={(event) => updateDelivery("line2", event.target.value)}
                  />
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__city" htmlFor="preorder-delivery-city">
                  <span>City</span>
                  <input
                    id="preorder-delivery-city"
                    name="city"
                    required
                    autoComplete="shipping address-level2"
                    minLength={2}
                    maxLength={100}
                    value={delivery.city}
                    onChange={(event) => updateDelivery("city", event.target.value)}
                  />
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__state" htmlFor="preorder-delivery-state">
                  <span>State</span>
                  <select
                    id="preorder-delivery-state"
                    name="state"
                    required
                    autoComplete="shipping address-level1"
                    value={delivery.state}
                    onChange={(event) => updateDelivery("state", event.target.value)}
                  >
                    <option value="">Select a state</option>
                    {PREORDER_US_STATE_OPTIONS.map(([code, label]) => (
                      <option value={code} key={code}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="preorder-delivery-details__compact preorder-delivery-details__zip" htmlFor="preorder-delivery-postal-code">
                  <span>ZIP code</span>
                  <input
                    id="preorder-delivery-postal-code"
                    name="postalCode"
                    required
                    inputMode="numeric"
                    autoComplete="shipping postal-code"
                    pattern="[0-9]{5}(-[0-9]{4})?"
                    maxLength={10}
                    value={delivery.postalCode}
                    onChange={(event) => updateDelivery("postalCode", event.target.value)}
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
                <h2 id="preorder-development-title">Frame product status</h2>
                <p>
                  Frame is an upper-arm wearable for everyday general-wellness insight.
                  Final specifications and estimated shipping may evolve as validation
                  and production readiness are completed. Frame has not received FDA
                  marketing authorization as a blood-pressure monitor and should not
                  guide medical decisions.
                </p>
              </div>
              <Link href="/preorder/product-status">Read Product Status →</Link>
            </section>

            <fieldset className={`checkout-review__acknowledgements${acknowledgementError ? " checkout-review__acknowledgements--invalid" : ""}`}>
              <legend>Before you continue</legend>
              {acknowledgementError ? (
                <div
                  id="preorder-acknowledgement-error"
                  className="preorder-checkout-review__acknowledgement-alert"
                  role="alert"
                >
                  <span className="preorder-checkout-review__acknowledgement-alert-icon" aria-hidden="true">!</span>
                  <span>
                    <strong>Required confirmations are missing</strong>
                    <span>{error}</span>
                  </span>
                </div>
              ) : null}
              <div className={`checkout-checkbox checkout-checkbox--required${acknowledgementError === "product-status" || acknowledgementError === "both" ? " checkout-checkbox--invalid" : ""}`}>
                <input
                  ref={productStatusCheckbox}
                  id="preorder-product-status-acknowledgement"
                  type="checkbox"
                  aria-required="true"
                  aria-invalid={acknowledgementError === "product-status" || acknowledgementError === "both"}
                  aria-describedby={acknowledgementError === "product-status" || acknowledgementError === "both" ? "preorder-acknowledgement-error" : undefined}
                  checked={productStatusAcknowledged}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setProductStatusAcknowledged(checked);
                    updateAcknowledgementError(checked, termsAcknowledged);
                  }}
                />
                <span className="checkout-checkbox__copy">
                  <label htmlFor="preorder-product-status-acknowledgement">
                    <strong>I’ve reviewed Frame’s current product status.</strong>
                  </label>
                  <span>Final specifications and estimated shipping may change. Frame is intended for general wellness rather than medical decisions.</span>
                </span>
              </div>
              <div className={`checkout-checkbox checkout-checkbox--required preorder-checkout-review__second-check${acknowledgementError === "terms" || acknowledgementError === "both" ? " checkout-checkbox--invalid" : ""}`}>
                <input
                  ref={termsCheckbox}
                  id="preorder-terms-acknowledgement"
                  type="checkbox"
                  aria-required="true"
                  aria-invalid={acknowledgementError === "terms" || acknowledgementError === "both"}
                  aria-describedby={acknowledgementError === "terms" || acknowledgementError === "both" ? "preorder-acknowledgement-error" : undefined}
                  checked={termsAcknowledged}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setTermsAcknowledged(checked);
                    updateAcknowledgementError(productStatusAcknowledged, checked);
                  }}
                />
                <span className="checkout-checkbox__copy">
                  <label htmlFor="preorder-terms-acknowledgement">
                    <strong>I agree to the terms that apply to this pre-order.</strong>
                  </label>
                  <span>
                    Review the <Link href="/preorder/terms">Pre-order Terms</Link> and{" "}
                    <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>.
                  </span>
                </span>
              </div>
            </fieldset>

          </div>
        </div>

        <footer className="preorder-checkout-footer">
          {error && !acknowledgementError ? <p className="form-error checkout-review__error" role="alert">{error}</p> : null}
          <div className="preorder-checkout-action">
            <button className="button button--dark checkout-review__submit" type="submit" disabled={submitting}>
              {submitting ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
            <p className="preorder-checkout-action__promise">
              You’ll review the final total, including tax, before payment. One-time
              payment; cancel before fulfilment for a full refund.
            </p>
          </div>

          <div className="checkout-review__policies">
            <Link href="/preorder/product-status">Product Status</Link>
            <Link href="/preorder/terms">Pre-order Terms</Link>
            <Link href="/preorder/refunds">Cancellation and Refund Policy</Link>
            <Link href="/privacy">Privacy Notice</Link>
          </div>
          {sellerIdentityLine ? (
            <p className="checkout-review__seller-identity">{sellerIdentityLine}</p>
          ) : null}
        </footer>
      </div>
    </form>
  );
}
