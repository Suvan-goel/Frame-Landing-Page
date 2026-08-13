"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
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
  amountRefunded: string;
  amountRemaining: string;
  refundStatus: string;
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

type FeedbackTarget = "email" | "address" | "delivery" | "cancellation";
type Feedback = {
  target: FeedbackTarget;
  type: "success" | "error";
  message: string;
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

function cleanAddressValue(address: Record<string, unknown>, key: string) {
  return typeof address[key] === "string" ? address[key].trim() : "";
}

function addressLines(address: Record<string, unknown> | null) {
  if (!address) return [];
  const line1 = cleanAddressValue(address, "line1");
  const line2 = cleanAddressValue(address, "line2");
  const city = cleanAddressValue(address, "city");
  const state = cleanAddressValue(address, "state");
  const postalCode =
    cleanAddressValue(address, "postal_code") ||
    cleanAddressValue(address, "postalCode");
  const locality = [city, state].filter(Boolean).join(", ");
  const localityAndPostal = [locality, postalCode].filter(Boolean).join(" ");
  const country = cleanAddressValue(address, "country");
  return [
    line1,
    line2,
    localityAndPostal,
    country === "US" ? "United States" : country,
  ].filter(Boolean);
}

function addressForm(address: Record<string, unknown>): AddressForm {
  return {
    line1: cleanAddressValue(address, "line1"),
    line2: cleanAddressValue(address, "line2"),
    city: cleanAddressValue(address, "city"),
    state: cleanAddressValue(address, "state").toUpperCase(),
    postal_code:
      cleanAddressValue(address, "postal_code") ||
      cleanAddressValue(address, "postalCode"),
    country: cleanAddressValue(address, "country") || "US",
  };
}

function InlineFeedback({
  feedback,
  target,
}: {
  feedback: Feedback | null;
  target: FeedbackTarget;
}) {
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const visible = feedback?.target === target;
  useEffect(() => {
    if (visible) feedbackRef.current?.focus();
  }, [visible, feedback?.message]);
  if (!visible || !feedback) return null;
  return (
    <p
      className={`preorder-manage-feedback form-${feedback.type}`}
      ref={feedbackRef}
      role={feedback.type === "error" ? "alert" : "status"}
      tabIndex={-1}
    >
      {feedback.message}
    </p>
  );
}

function refundCopy(order: ManagedOrder) {
  if (order.refundStatus === "completed") {
    return {
      eyebrow: "Refund completed",
      heading: `${order.amountRefunded} has been refunded.`,
      body: "The refund was returned to your original payment method. Your bank may take additional time to display the credit.",
    };
  }
  if (order.refundStatus === "processing") {
    return {
      eyebrow: "Refund in progress",
      heading: `${order.amountRemaining} is being refunded.`,
      body: "We’ll email you when the refund has completed. Your bank may take additional time to display the credit after processing.",
    };
  }
  if (order.refundStatus === "failed") {
    return {
      eyebrow: "Refund needs attention",
      heading: "We couldn’t complete the refund.",
      body: `The remaining ${order.amountRemaining} still needs to be returned. Please contact support so we can resolve it.`,
    };
  }
  if (order.refundStatus === "partial") {
    return {
      eyebrow: "Partially refunded",
      heading: `${order.amountRefunded} has been refunded.`,
      body: `${order.amountRemaining} remains on the order. Contact support if this is not what you expected.`,
    };
  }
  return {
    eyebrow: "Order cancelled",
    heading: "Your pre-order is no longer active.",
    body: `The remaining ${order.amountRemaining} will be returned to your original payment method. We’ll email you with the refund status.`,
  };
}

export function PreorderManage() {
  const tokenRef = useRef("");
  const previewRef = useRef(false);
  const previewStateRef = useRef("active");
  const [result, setResult] = useState<ManageResult>({ status: "loading" });
  const [cancellationReason, setCancellationReason] = useState("");
  const [addressReason, setAddressReason] = useState("");
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [email, setEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showCancellationForm, setShowCancellationForm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token") ?? "";
    const nextPreview = params.get("preview") === "1";
    const nextPreviewState = params.get("state") ?? "active";
    const emailChange = params.get("email_change");
    tokenRef.current = nextToken;
    previewRef.current = nextPreview;
    previewStateRef.current = nextPreviewState;

    if (!nextToken && !nextPreview) {
      queueMicrotask(() => {
        setResult({
          error:
            emailChange === "invalid"
              ? "This email-verification link is invalid, expired, or has already been used."
              : emailChange === "unavailable"
                ? "We couldn’t verify that email address right now. Please try the change again from your order link."
                : "This order-management link is incomplete.",
        });
      });
      return;
    }

    const query = nextPreview
      ? `preview=1&state=${encodeURIComponent(nextPreviewState)}`
      : `token=${encodeURIComponent(nextToken)}`;
    let cancelled = false;
    fetch(`/api/preorders/manage?${query}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const next = (await response.json()) as ManageResult;
        if (!response.ok) throw new Error(next.error ?? "Your order could not be loaded.");
        if (!cancelled) {
          setResult(next);
          if (next.order) setAddress(addressForm(next.order.shippingAddress));
          if (params.get("notice") === "email-updated") {
            setFeedback({
              target: "email",
              type: "success",
              message: "Your order email has been verified and updated.",
            });
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
    target: FeedbackTarget,
    successMessage: string | ((next: ManageResult) => string),
  ) {
    setBusy(action);
    setFeedback(null);
    try {
      const response = await fetch("/api/preorders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          token: tokenRef.current,
          preview: previewRef.current,
          previewState: previewStateRef.current,
          ...payload,
        }),
      });
      const next = (await response.json()) as ManageResult;
      if (next.order) {
        setResult({ ...next, error: undefined });
        setAddress(addressForm(next.order.shippingAddress));
      }
      if (!response.ok) {
        setFeedback({
          target,
          type: "error",
          message: next.error ?? "Your request could not be submitted.",
        });
        return null;
      }
      setResult(next);
      setFeedback({
        target,
        type: "success",
        message:
          typeof successMessage === "function" ? successMessage(next) : successMessage,
      });
      return next;
    } catch (error) {
      setFeedback({
        target,
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your request could not be submitted.",
      });
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
      "cancellation",
      "Your cancellation request has been recorded. We’ll email you when the refund is submitted.",
    );
  }

  async function requestAddressChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction(
      "request_address_change",
      { reason: addressReason, shippingAddress: address },
      "address",
      "Your shipping-address request has been submitted for review.",
    );
  }

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    const confirmedEmail = emailConfirmation.trim().toLowerCase();
    if (nextEmail !== confirmedEmail) {
      setFeedback({
        target: "email",
        type: "error",
        message: "The two email addresses do not match.",
      });
      return;
    }
    const next = await submitAction(
      "request_email_change",
      { email: nextEmail },
      "email",
      (response) =>
        response.status === "email_unchanged"
          ? "That address is already your order email."
          : `Check ${nextEmail} for a verification link. Your current order email will stay active until you verify the new address.`,
    );
    if (next) {
      setShowEmailForm(false);
      setEmail("");
      setEmailConfirmation("");
    }
  }

  function toggleAddressEditor(scrollToEditor = false) {
    const opening = !showAddressForm;
    setFeedback(null);
    setShowAddressForm(opening);
    if (opening && scrollToEditor) {
      window.setTimeout(() => {
        document
          .getElementById("preorder-address-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
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
      "delivery",
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
      <section className="preorder-manage-card preorder-manage-card--state" role="alert">
        <p className="eyebrow">Order management</p>
        <h1>We couldn’t open this order.</h1>
        <p>{result.error ?? "The link may have expired."}</p>
        <div className="preorder-manage-actions">
          <Link className="button button--dark" href="/contact?topic=preorder">Contact support</Link>
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
  const postShipment = Boolean(
    order.shippedAt ||
    order.deliveredAt ||
    ["shipped", "delivered", "returned"].includes(order.fulfillmentStatus),
  );
  const statusLabel = cancelled
    ? "Cancelled"
    : cancellationPending
      ? "Cancellation requested"
      : order.deliveredAt || order.fulfillmentStatus === "delivered"
        ? "Delivered"
        : order.shippedAt || order.fulfillmentStatus === "shipped"
          ? "Shipped"
          : order.fulfillmentStatus === "processing"
            ? "Preparing for shipment"
            : order.fulfillmentStatus === "ready"
              ? "Ready to ship"
              : "Pre-order confirmed";
  const cancelledRefundCopy = refundCopy(order);

  return (
    <section className="preorder-manage-card">
      <header className="preorder-manage-card__header">
        <div className="preorder-manage-card__kicker">
          <span className="preorder-confirmation__mark" aria-hidden="true">{cancelled ? "×" : "✓"}</span>
          <p className="eyebrow">
            <span className="preorder-manage-copy--desktop">{statusLabel}</span>
            <span className="preorder-manage-copy--mobile">{statusLabel}</span>
          </p>
        </div>
        <div className="preorder-manage-card__heading">
          <div>
            <h1>Manage your<br />pre-order.</h1>
            <p>
              <span className="preorder-manage-copy--desktop">Review your order and make changes.</span>
              <span className="preorder-manage-copy--mobile">Review your order and make changes.</span>
            </p>
          </div>
        </div>
      </header>

      <section className="preorder-manage-summary" aria-labelledby="managed-order-heading">
        <div className="preorder-manage-summary__product">
          <div className="preorder-manage-summary__media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt="Frame upper-arm wearable preview"
              width={720}
              height={720}
              unoptimized
            />
          </div>
          <div className="preorder-manage-summary__copy">
            <h2 id="managed-order-heading">Frame</h2>
            <p className="preorder-manage-copy--desktop">Qty 1</p>
          </div>
          <div className="preorder-manage-summary__total">
            <strong>{order.amountPaid}</strong>
            {order.refundStatus !== "none" ? (
              <small>{order.amountRefunded} refunded</small>
            ) : <small className="preorder-manage-summary__paid">Paid</small>}
          </div>
          <p className="preorder-manage-summary__quantity-mobile">Qty 1</p>
        </div>

        <dl className="preorder-manage-summary__facts">
          <div><dt>Order number</dt><dd>{order.orderNumber}</dd></div>
          <div><dt>Order date</dt><dd><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time></dd></div>
          <div><dt>Estimated shipping</dt><dd>{order.estimatedShipping}</dd></div>
        </dl>

        <div className="preorder-manage-summary__section-heading">
          <p className="eyebrow">Delivery &amp; contact</p>
        </div>

        <div className="preorder-manage-summary__delivery">
          <div>
            <div className="preorder-manage-info-heading">
              <p className="eyebrow">
                <span className="preorder-manage-copy--desktop">Delivery address</span>
                <span className="preorder-manage-copy--mobile">Delivery address</span>
              </p>
              {order.canRequestAddressChange ? (
                <button
                  className="preorder-manage-info-action"
                  type="button"
                  aria-expanded={showAddressForm}
                  aria-controls="preorder-address-form"
                  onClick={() => toggleAddressEditor(true)}
                >
                  {showAddressForm ? "Close" : <>Change <span aria-hidden="true">→</span></>}
                </button>
              ) : null}
            </div>
            <h3>{order.fullName}</h3>
            <address>{shipping.map((line) => <span key={line}>{line}<br /></span>)}</address>
          </div>
          <div>
            <div className="preorder-manage-info-heading">
              <p className="eyebrow">Order email</p>
              <button
                className="preorder-manage-email-toggle preorder-manage-email-toggle--mobile"
                type="button"
                aria-expanded={showEmailForm}
                aria-controls="preorder-email-form"
                onClick={() => {
                  setFeedback(null);
                  setEmail("");
                  setEmailConfirmation("");
                  setShowEmailForm((current) => !current);
                }}
              >
                {showEmailForm ? "Close" : <>Change <span aria-hidden="true">→</span></>}
              </button>
            </div>
            <a href={`mailto:${order.email}`}>{order.email}</a>
            <button
              className="preorder-manage-email-toggle preorder-manage-email-toggle--desktop"
              type="button"
              aria-expanded={showEmailForm}
              aria-controls="preorder-email-form"
              onClick={() => {
                setFeedback(null);
                setEmail("");
                setEmailConfirmation("");
                setShowEmailForm((current) => !current);
              }}
            >
              {showEmailForm ? "Close" : <>Change <span aria-hidden="true">→</span></>}
            </button>
            <InlineFeedback feedback={feedback} target="email" />
            {showEmailForm ? (
              <form className="preorder-manage-email-form" id="preorder-email-form" onSubmit={requestEmailChange}>
                <label htmlFor="preorder-updates-email">New email address</label>
                <input
                  id="preorder-updates-email"
                  name="email"
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
                  name="email-confirmation"
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
                    {busy === "request_email_change" ? "Sending…" : "Send verification email"}
                  </button>
                  <button className="text-link" type="button" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
                <p className="preorder-manage-form-note">We’ll verify the new address before changing essential order updates. Marketing preferences are unchanged.</p>
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
          <p className="eyebrow">{order.deliveryUpdateNoticeType === "material_product_change" ? "Proposed product change" : "Shipping estimate update"}</p>
          <h2>{order.deliveryUpdateNoticeType === "material_product_change" ? "Please review this change." : "Please review the updated estimate."}</h2>
          <p>{order.deliveryUpdateMessage}</p>
          {order.deliveryUpdateNoticeType !== "material_product_change" ? (
            <dl className="preorder-manage-delivery-change">
              <div><dt>Original estimate</dt><dd>{order.originalEstimatedShipping}</dd></div>
              <div><dt>Current estimate</dt><dd>{order.estimatedShipping}</dd></div>
            </dl>
          ) : null}
          {order.requiresAffirmativeDeliveryConsent && order.deliveryUpdateResponseDeadline ? (
            <p><strong>Response required by {formatDateTime(order.deliveryUpdateResponseDeadline)}.</strong>{" "}If you do not accept by then, we will automatically cancel and refund the unshipped order.</p>
          ) : (
            <p>This is a first, definite shipping delay of no more than 30 days. If you do nothing, your order remains active and your silence is treated as consent to this short delay.</p>
          )}
          <InlineFeedback feedback={feedback} target="delivery" />
          <div className="preorder-manage-actions">
            <button className="button button--dark" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("accept")}>{busy === "respond_delivery_update" ? "Saving…" : order.deliveryUpdateNoticeType === "material_product_change" ? "Accept product change" : "Accept updated estimate"}</button>
            <button className="text-link" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("request_cancellation")}>Request cancellation</button>
          </div>
        </section>
      ) : order.deliveryUpdateStatus === "accepted" ? (
        <section className="preorder-manage-notice">
          <p className="eyebrow">Response recorded</p>
          <h2>{order.deliveryUpdateNoticeType === "material_product_change" ? "You accepted the product change." : "You accepted the current estimate."}</h2>
          <p>{order.deliveryUpdateMessage}</p>
          <InlineFeedback feedback={feedback} target="delivery" />
        </section>
      ) : null}

      {addressChangePending ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">Address request received</p>
          <h2>We’re reviewing your shipping address.</h2>
          <p>{requestedShipping.map((line) => <span key={line}>{line}<br /></span>)}</p>
          <p>Do not submit another request. We’ll confirm after the change has been reviewed.</p>
          <InlineFeedback feedback={feedback} target="address" />
        </section>
      ) : order.canRequestAddressChange ? (
        <section
          className={`preorder-manage-option preorder-manage-delivery-details${showAddressForm ? " is-open" : ""}`}
          id="preorder-address-section"
        >
          <div className="preorder-manage-delivery-details__header">
            <div>
              <p className="eyebrow">Delivery details</p>
              <h2>Change your shipping address.</h2>
              <p>
                <span className="preorder-manage-copy--desktop">Request a change before fulfilment.</span>
                <span className="preorder-manage-copy--mobile">Request a change before fulfilment.</span>
              </p>
            </div>
            <button className="button button--secondary" type="button" aria-expanded={showAddressForm} aria-controls="preorder-address-form" onClick={() => toggleAddressEditor()}>
              {showAddressForm ? "Close form" : "Change address"}
            </button>
          </div>
          {order.addressChangeStatus === "declined" && order.addressChangeResolutionNote ? <p className="preorder-manage-resolution-note"><strong>Previous request:</strong> {order.addressChangeResolutionNote}</p> : null}
          <InlineFeedback feedback={feedback} target="address" />
          {showAddressForm ? (
            <form id="preorder-address-form" onSubmit={requestAddressChange}>
              <div className="preorder-manage-address-grid">
                <label className="preorder-manage-address-grid__wide">Address line 1<input name="address-line1" autoComplete="shipping address-line1" required minLength={3} maxLength={200} value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} /></label>
                <label className="preorder-manage-address-grid__wide">Address line 2 <span>(optional)</span><input name="address-line2" autoComplete="shipping address-line2" maxLength={200} value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))} /></label>
                <label>City<input name="city" autoComplete="shipping address-level2" required minLength={2} maxLength={100} value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></label>
                <label>State<select name="state" autoComplete="shipping address-level1" required value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))}><option value="">Select a state</option>{PREORDER_US_STATE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
                <label>ZIP code<input name="postal-code" autoComplete="shipping postal-code" inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a 5-digit ZIP code or ZIP+4" required maxLength={10} value={address.postal_code} onChange={(event) => setAddress((current) => ({ ...current, postal_code: event.target.value }))} /></label>
                <label>Country<select name="country" autoComplete="shipping country" value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))}><option value="US">United States</option></select></label>
                <label className="preorder-manage-address-grid__wide">Anything we should know? <span>(optional)</span><textarea name="address-reason" rows={3} maxLength={1_000} value={addressReason} onChange={(event) => setAddressReason(event.target.value)} /></label>
              </div>
              <div className="preorder-manage-form-actions">
                <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "request_address_change" ? "Submitting…" : "Submit address request"}</button>
                <button className="text-link" type="button" onClick={() => setShowAddressForm(false)}>Cancel</button>
              </div>
              <p className="preorder-manage-form-note">We’ll confirm the outcome by email. A request does not change the address until it has been reviewed.</p>
            </form>
          ) : null}
        </section>
      ) : null}

      {cancellationPending ? (
        <section className="preorder-manage-notice preorder-manage-notice--attention">
          <p className="eyebrow">Request received</p>
          <h2>Your cancellation is being processed.</h2>
          <p>Your order is blocked from shipment while we process the request. We’ll email you when the remaining refund has been submitted.</p>
          <InlineFeedback feedback={feedback} target="cancellation" />
        </section>
      ) : cancelled ? (
        <section className={`preorder-manage-notice${order.refundStatus === "failed" ? " preorder-manage-notice--attention" : ""}`}>
          <p className="eyebrow">{cancelledRefundCopy.eyebrow}</p>
          <h2>{cancelledRefundCopy.heading}</h2>
          <p>{cancelledRefundCopy.body}</p>
          {order.refundStatus === "failed" || order.refundStatus === "partial" ? <Link className="text-link" href="/contact?topic=preorder">Contact support</Link> : null}
          <InlineFeedback feedback={feedback} target="cancellation" />
        </section>
      ) : order.canRequestCancellation && !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-option preorder-manage-option--cancellation">
          <div className="preorder-manage-option__header">
            <div>
              <p className="eyebrow">Cancellation</p>
              <h2>Need to cancel?</h2>
              <p>
                <span className="preorder-manage-copy--desktop">Cancel before fulfilment for a full refund.</span>
                <span className="preorder-manage-copy--mobile">Cancel before fulfilment for a full refund.</span>
              </p>
            </div>
            <button className="button button--secondary preorder-manage-cancel-toggle" type="button" aria-expanded={showCancellationForm} aria-controls="preorder-cancellation-form" onClick={() => { setFeedback(null); setShowCancellationForm((current) => !current); }}>
              {showCancellationForm ? "Close" : <>Start cancellation <span aria-hidden="true">→</span></>}
            </button>
          </div>
          <InlineFeedback feedback={feedback} target="cancellation" />
          {showCancellationForm ? (
            <form id="preorder-cancellation-form" onSubmit={requestCancellation}>
              <label htmlFor="cancellation-reason">Why are you cancelling? <span>(optional)</span></label>
              <textarea id="cancellation-reason" name="cancellation-reason" rows={4} maxLength={1_000} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Share anything that could help us improve" />
              <div className="preorder-manage-form-actions">
                <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "request_cancellation" ? "Submitting…" : "Cancel pre-order and request refund"}</button>
                <button className="text-link" type="button" onClick={() => setShowCancellationForm(false)}>Keep my pre-order</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : postShipment ? (
        <section className="preorder-manage-notice">
          <p className="eyebrow">Shipment support</p>
          <h2>{order.deliveredAt ? "Need help with your delivered order?" : "Need help with this shipment?"}</h2>
          <p>Review the returns and refund policy or contact us with your order number for shipment support.</p>
          <div className="preorder-manage-actions preorder-manage-actions--compact">
            <Link className="text-link" href="/preorder/refunds">Returns and refunds</Link>
            <Link className="text-link" href="/contact?topic=preorder">Contact support</Link>
          </div>
        </section>
      ) : !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-notice">
          <p className="eyebrow">Order support</p>
          <h2>Your order is being prepared.</h2>
          <p>Online cancellation is unavailable once fulfilment begins. Contact us with your order number if you need help.</p>
          <Link className="text-link" href="/contact?topic=preorder">Contact support</Link>
        </section>
      ) : null}

      <nav className="preorder-manage-policies" aria-label="Order policies">
        <span className="preorder-manage-policies__label">Order policies</span>
        <Link href="/preorder/product-status">Product status</Link>
        <Link href="/preorder/terms">Pre-order terms</Link>
        <Link href="/preorder/refunds">Cancellation and refunds</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </section>
  );
}
