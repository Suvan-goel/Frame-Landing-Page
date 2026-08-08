"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PREORDER_US_STATE_OPTIONS } from "@/lib/preorder-shipping";

type ManagedOrder = {
  orderNumber: string;
  fullName: string;
  email: string;
  shippingAddress: Record<string, unknown>;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  cancellationStatus: string;
  cancellationRequestedAt: string | null;
  cancellationResolutionNote: string | null;
  canRequestCancellation: boolean;
  amountPaid: string;
  originalEstimatedShipping: string;
  estimatedShipping: string;
  addressChangeStatus: string;
  addressChangeRequestedAt: string | null;
  requestedShippingAddress: Record<string, unknown> | null;
  addressChangeReason: string | null;
  addressChangeResolutionNote: string | null;
  canRequestAddressChange: boolean;
  deliveryUpdateVersion: number;
  deliveryUpdateStatus: string;
  deliveryUpdateNoticeType: string;
  deliveryUpdateResponseMode: string;
  deliveryUpdateResponseDeadline: string | null;
  deliveryUpdateMessage: string | null;
  deliveryUpdateSentAt: string | null;
  deliveryUpdateAcknowledgedAt: string | null;
  deliveryUpdateExpiredAt: string | null;
  requiresDeliveryResponse: boolean;
  requiresAffirmativeDeliveryConsent: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  placedAt: string;
};

type ManageResult = {
  status?: string;
  order?: ManagedOrder;
  error?: string;
};

type AddressForm = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const emptyAddress: AddressForm = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(value),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function addressLines(address: Record<string, unknown> | null) {
  if (!address) return [];
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter((value): value is string => typeof value === "string" && Boolean(value));
}

function addressForm(address: Record<string, unknown>): AddressForm {
  const value = (key: string) =>
    typeof address[key] === "string" ? (address[key] as string) : "";
  return {
    line1: value("line1"),
    line2: value("line2"),
    city: value("city"),
    state: value("state"),
    postal_code: value("postal_code"),
    country: value("country") || "US",
  };
}

export function PreorderManage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ManageResult>({ status: "loading" });
  const [cancellationReason, setCancellationReason] = useState("");
  const [addressReason, setAddressReason] = useState("");
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [email, setEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showCancellationForm, setShowCancellationForm] = useState(false);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(nextToken);
    if (!nextToken) {
      setResult({ error: "This order-management link is incomplete." });
      return;
    }

    let cancelled = false;
    fetch(`/api/preorders/manage?token=${encodeURIComponent(nextToken)}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const next = (await response.json()) as ManageResult;
        if (!response.ok) throw new Error(next.error ?? "Your order could not be loaded.");
        if (!cancelled) {
          setResult(next);
          if (next.order) {
            setAddress(addressForm(next.order.shippingAddress));
            setEmail(next.order.email);
            setEmailConfirmation(next.order.email);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResult({
            error: error instanceof Error ? error.message : "Your order could not be loaded.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitAction(
    action: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(action);
    setMessage("");
    setResult((current) => ({ ...current, error: undefined }));
    try {
      const response = await fetch("/api/preorders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, ...payload }),
      });
      const next = (await response.json()) as ManageResult;
      if (!response.ok) throw new Error(next.error ?? "Your request could not be submitted.");
      setResult(next);
      setMessage(successMessage);
      if (next.order) {
        setAddress(addressForm(next.order.shippingAddress));
        setEmail(next.order.email);
        setEmailConfirmation(next.order.email);
      }
      return next;
    } catch (error) {
      setResult((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Your request could not be submitted.",
      }));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function requestCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction(
      "request_cancellation",
      { reason: cancellationReason },
      "Your cancellation has been recorded. We’ll email you when the full refund has been submitted.",
    );
  }

  async function requestAddressChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction(
      "request_address_change",
      { reason: addressReason, shippingAddress: address },
      "Your shipping-address request has been submitted for review.",
    );
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    const confirmedEmail = emailConfirmation.trim().toLowerCase();
    if (nextEmail !== confirmedEmail) {
      setMessage("");
      setResult((current) => ({
        ...current,
        error: "The two email addresses do not match.",
      }));
      return;
    }
    const next = await submitAction(
      "update_email",
      { email: nextEmail },
      "Your updates email has been changed.",
    );
    if (next?.order) setShowEmailForm(false);
  }

  async function respondToDeliveryUpdate(response: "accept" | "request_cancellation") {
    const order = result.order;
    if (!order) return;
    const materialChange = order.deliveryUpdateNoticeType === "material_product_change";
    if (
      response === "request_cancellation" &&
      !window.confirm(
        materialChange
          ? "Request cancellation instead of accepting the proposed product change?"
          : "Request cancellation instead of accepting the updated shipping estimate?",
      )
    ) {
      return;
    }
    await submitAction(
      "respond_delivery_update",
      {
        response,
        deliveryUpdateVersion: order.deliveryUpdateVersion,
        reason: response === "request_cancellation" ? cancellationReason : null,
      },
      response === "accept"
        ? "Thank you. Your response has been recorded."
        : "Your cancellation request has been submitted.",
    );
  }

  if (result.status === "loading") {
    return (
      <section className="preorder-manage-card preorder-manage-card--state" role="status">
        <p className="eyebrow">Your pre-order</p>
        <h1>Loading your order.</h1>
        <p>We’re securely retrieving the latest status.</p>
      </section>
    );
  }

  if (!result.order) {
    return (
      <section className="preorder-manage-card preorder-manage-card--state">
        <p className="eyebrow">Order management</p>
        <h1>We couldn’t open this order.</h1>
        <p>{result.error ?? "The link may have expired."}</p>
        <div className="preorder-manage-actions">
          <Link className="button button--dark" href="/contact?topic=general">Contact support</Link>
          <Link className="text-link" href="/">Return to Frame</Link>
        </div>
      </section>
    );
  }

  const order = result.order;
  const shipping = addressLines(order.shippingAddress);
  const requestedShipping = addressLines(order.requestedShippingAddress);
  const cancellationPending = ["requested", "processing"].includes(
    order.cancellationStatus,
  );
  const addressChangePending = ["requested", "processing"].includes(
    order.addressChangeStatus,
  );
  const cancelled =
    order.orderStatus === "cancelled" ||
    order.paymentStatus === "refunded" ||
    order.cancellationStatus === "completed";
  const statusLabel = cancelled
    ? "Cancelled"
    : cancellationPending
      ? "Cancellation requested"
      : order.deliveredAt
        ? "Delivered"
        : order.shippedAt
          ? "Shipped"
          : "Pre-order confirmed";

  return (
    <section className="preorder-manage-card">
      <header className="preorder-manage-card__header">
        <div className="preorder-manage-card__kicker">
          <span className="preorder-confirmation__mark" aria-hidden="true">{cancelled ? "×" : "✓"}</span>
          <p className="eyebrow">Order {order.orderNumber}</p>
        </div>
        <div className="preorder-manage-card__heading">
          <div>
            <h1>Manage your<br />pre-order.</h1>
            <p>Review your order, delivery details, and available changes.</p>
          </div>
          <span className={`preorder-manage-status${cancelled ? " preorder-manage-status--cancelled" : ""}`}>
            {statusLabel}
          </span>
        </div>
      </header>

      {message ? <p className="form-success" role="status">{message}</p> : null}
      {result.error ? <p className="form-error" role="alert">{result.error}</p> : null}

      <section className="preorder-manage-summary" aria-labelledby="managed-order-heading">
        <div className="preorder-manage-summary__product">
          <div className="preorder-manage-summary__media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt="Frame upper-arm wearable product concept"
              width={720}
              height={720}
              unoptimized
            />
          </div>
          <div className="preorder-manage-summary__copy">
            <p className="eyebrow">Your order</p>
            <h2 id="managed-order-heading">Frame</h2>
            <p>One device</p>
          </div>
          <div className="preorder-manage-summary__total">
            <span>Total paid</span>
            <strong>{order.amountPaid}</strong>
          </div>
        </div>

        <dl className="preorder-manage-summary__facts">
          <div><dt>Order number</dt><dd>{order.orderNumber}</dd></div>
          <div><dt>Order date</dt><dd><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time></dd></div>
          <div><dt>Estimated shipping</dt><dd>{order.estimatedShipping}</dd></div>
        </dl>

        <div className="preorder-manage-summary__delivery">
          <div>
            <p className="eyebrow">Shipping to</p>
            <h3>{order.fullName}</h3>
            <address>{shipping.map((line, index) => <span key={`${line}-${index}`}>{line}<br /></span>)}</address>
          </div>
          <div>
            <p className="eyebrow">Order updates</p>
            <p>We’ll send important product, timing, and delivery updates to:</p>
            <a href={`mailto:${order.email}`}>{order.email}</a>
            <button
              className="preorder-manage-email-toggle"
              type="button"
              aria-expanded={showEmailForm}
              aria-controls="preorder-email-form"
              onClick={() => {
                setEmail(order.email);
                setEmailConfirmation(order.email);
                setShowEmailForm((current) => !current);
              }}
            >
              {showEmailForm ? "Close" : "Change email"}
            </button>
            {showEmailForm ? (
              <form className="preorder-manage-email-form" id="preorder-email-form" onSubmit={updateEmail}>
                <label htmlFor="preorder-updates-email">New email address</label>
                <input
                  id="preorder-updates-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="preorder-updates-email-confirmation">Confirm new email address</label>
                <input
                  id="preorder-updates-email-confirmation"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={emailConfirmation}
                  onChange={(event) => setEmailConfirmation(event.target.value)}
                />
                <div className="preorder-manage-form-actions">
                  <button className="button button--dark" type="submit" disabled={Boolean(busy)}>
                    {busy === "update_email" ? "Updating…" : "Update email"}
                  </button>
                  <button className="text-link" type="button" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
                <p className="preorder-manage-form-note">This changes essential order updates only. Marketing preferences are unchanged.</p>
              </form>
            ) : null}
          </div>
        </div>

        {order.shippedAt || order.trackingNumber || order.trackingUrl ? (
          <div className="preorder-manage-summary__tracking">
            <p>{order.shippedAt ? `Shipped ${formatDate(order.shippedAt)}` : "Your order has shipped."}</p>
            {order.trackingNumber ? <p><strong>{order.carrier ?? "Tracking"}:</strong> {order.trackingNumber}</p> : null}
            {order.trackingUrl ? <a className="text-link" href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a> : null}
          </div>
        ) : null}
      </section>

      {order.requiresDeliveryResponse ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">
            {order.deliveryUpdateNoticeType === "material_product_change"
              ? "Proposed product change"
              : "Shipping estimate update"}
          </p>
          <h2>
            {order.deliveryUpdateNoticeType === "material_product_change"
              ? "Please review this change."
              : "Please review the updated estimate."}
          </h2>
          <p>{order.deliveryUpdateMessage}</p>
          {order.deliveryUpdateNoticeType !== "material_product_change" ? (
            <dl className="preorder-manage-delivery-change">
              <div><dt>Original estimate</dt><dd>{order.originalEstimatedShipping}</dd></div>
              <div><dt>Current estimate</dt><dd>{order.estimatedShipping}</dd></div>
            </dl>
          ) : null}
          {order.requiresAffirmativeDeliveryConsent && order.deliveryUpdateResponseDeadline ? (
            <p>
              <strong>Response required by {formatDateTime(order.deliveryUpdateResponseDeadline)}.</strong>{" "}
              If you do not accept by then, we will automatically cancel and refund the unshipped order.
            </p>
          ) : (
            <p>
              This is a first, definite shipping delay of no more than 30 days. If you do nothing, your order
              remains active and your silence is treated as consent to this short delay.
            </p>
          )}
          <div className="preorder-manage-actions">
            <button className="button button--dark" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("accept")}>{busy === "respond_delivery_update" ? "Saving…" : order.deliveryUpdateNoticeType === "material_product_change" ? "Accept product change" : "Accept updated estimate"}</button>
            <button className="text-link" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("request_cancellation")}>Request cancellation</button>
          </div>
        </section>
      ) : order.deliveryUpdateStatus === "accepted" ? (
        <section className="preorder-manage-notice">
          <p className="eyebrow">Shipping response recorded</p>
          <h2>{order.deliveryUpdateNoticeType === "material_product_change" ? "You accepted the product change." : "You accepted the current estimate."}</h2>
          <p>{order.deliveryUpdateMessage}</p>
        </section>
      ) : null}

      {addressChangePending ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">Address request received</p>
          <h2>We’re reviewing your shipping address.</h2>
          <p>{requestedShipping.map((line, index) => <span key={`${line}-${index}`}>{line}<br /></span>)}</p>
          <p>Do not submit another request. We’ll confirm after the change has been reviewed.</p>
        </section>
      ) : order.canRequestAddressChange ? (
        <section className="preorder-manage-option preorder-manage-delivery-details">
          <div className="preorder-manage-delivery-details__header">
            <div>
              <p className="eyebrow">Delivery details</p>
              <h2>Change your shipping address.</h2>
              <p>Moving before {order.estimatedShipping}? Send us the address you’d like us to use.</p>
            </div>
            <button
              className="button button--secondary"
              type="button"
              aria-expanded={showAddressForm}
              aria-controls="preorder-address-form"
              onClick={() => setShowAddressForm((current) => !current)}
            >
              {showAddressForm ? "Close form" : "Change address"}
            </button>
          </div>
          {order.addressChangeStatus === "declined" && order.addressChangeResolutionNote ? (
            <p className="preorder-manage-resolution-note"><strong>Previous request:</strong> {order.addressChangeResolutionNote}</p>
          ) : null}
          {showAddressForm ? (
            <form id="preorder-address-form" onSubmit={requestAddressChange}>
              <div className="preorder-manage-address-grid">
                <label className="preorder-manage-address-grid__wide">Address line 1<input required minLength={3} maxLength={200} value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} /></label>
                <label className="preorder-manage-address-grid__wide">Address line 2 <span>(optional)</span><input maxLength={200} value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))} /></label>
                <label>City<input required minLength={2} maxLength={100} value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></label>
                <label>State<select required value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))}><option value="">Select a state</option>{PREORDER_US_STATE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
                <label>ZIP code<input required minLength={3} maxLength={20} value={address.postal_code} onChange={(event) => setAddress((current) => ({ ...current, postal_code: event.target.value }))} /></label>
                <label>Country<select value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))}><option value="US">United States</option></select></label>
                <label className="preorder-manage-address-grid__wide">Anything we should know? <span>(optional)</span><textarea rows={3} maxLength={1_000} value={addressReason} onChange={(event) => setAddressReason(event.target.value)} /></label>
              </div>
              <div className="preorder-manage-form-actions">
                <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "request_address_change" ? "Submitting…" : "Submit address request"}</button>
                <button className="text-link" type="button" onClick={() => setShowAddressForm(false)}>Cancel</button>
              </div>
              <p className="preorder-manage-form-note">We review address changes before applying them and will confirm the outcome by email.</p>
            </form>
          ) : null}
        </section>
      ) : null}

      {cancellationPending ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">Request received</p>
          <h2>Your cancellation is being processed.</h2>
          <p>Your order is blocked from shipment. We’ll submit the full remaining refund as soon as possible and no later than seven working days after cancellation, then email you with the status.</p>
        </section>
      ) : cancelled ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">Order cancelled</p>
          <h2>Your pre-order is no longer active.</h2>
          <p>Contact support if you have questions about the refund status.</p>
        </section>
      ) : order.canRequestCancellation && !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-option preorder-manage-option--cancellation">
          <div className="preorder-manage-option__header">
            <div>
              <p className="eyebrow">Cancellation</p>
              <h2>Need to cancel?</h2>
              <p>You can cancel until fulfilment begins, before the order moves to processing. We’ll refund the full remaining amount to your original payment method.</p>
            </div>
            <button
              className="button button--secondary"
              type="button"
              aria-expanded={showCancellationForm}
              aria-controls="preorder-cancellation-form"
              onClick={() => setShowCancellationForm((current) => !current)}
            >
              {showCancellationForm ? "Close" : "Start cancellation"}
            </button>
          </div>
          {showCancellationForm ? (
            <form id="preorder-cancellation-form" onSubmit={requestCancellation}>
              <label htmlFor="cancellation-reason">Why are you cancelling? <span>(optional)</span></label>
              <textarea id="cancellation-reason" rows={4} maxLength={1_000} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Share anything that could help us improve" />
              <div className="preorder-manage-form-actions">
                <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "request_cancellation" ? "Submitting…" : "Cancel pre-order and request refund"}</button>
                <button className="text-link" type="button" onClick={() => setShowCancellationForm(false)}>Keep my pre-order</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-notice">
          <p className="eyebrow">Order support</p>
          <h2>Online cancellation is unavailable.</h2>
          <p>Please contact us and include your order number so we can help.</p>
          <Link className="text-link" href="/contact?topic=preorder">Contact support</Link>
        </section>
      ) : null}

      <nav className="preorder-manage-policies" aria-label="Order policies">
        <Link href="/preorder/product-status">Product status</Link>
        <Link href="/preorder/terms">Pre-order terms</Link>
        <Link href="/preorder/refunds">Cancellation and refunds</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </section>
  );
}
