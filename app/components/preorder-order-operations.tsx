"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import type { PreorderDeliveryNoticeType } from "@/lib/preorder-delivery-policy";

const fulfillmentOptions = [
  ["on_hold", "On hold"],
  ["ready", "Ready"],
  ["processing", "Processing"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["returned", "Returned"],
] as const;

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

function formatUtcDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function PreorderOrderOperations({
  orderId,
  environment,
  amountRemainingLabel,
  fulfillmentStatus: initialFulfillmentStatus,
  cancellationStatus,
  addressChangeStatus,
  requestedShippingAddress,
  addressChangeReason,
  currentEstimatedDelivery,
  deliveryUpdateVersion,
  deliveryUpdateStatus,
  deliveryUpdateNoticeType,
  deliveryUpdateResponseMode,
  deliveryUpdateResponseDeadline,
  deliveryUpdateMessage: initialDeliveryUpdateMessage,
  carrier: initialCarrier,
  trackingNumber: initialTrackingNumber,
  trackingUrl: initialTrackingUrl,
  ownerNote: initialOwnerNote,
  canRefund,
}: {
  orderId: string;
  environment: "test" | "live";
  amountRemainingLabel: string;
  fulfillmentStatus: string;
  cancellationStatus: string;
  addressChangeStatus: string;
  requestedShippingAddress: Record<string, unknown> | null;
  addressChangeReason: string | null;
  currentEstimatedDelivery: string;
  deliveryUpdateVersion: number;
  deliveryUpdateStatus: string;
  deliveryUpdateNoticeType: string;
  deliveryUpdateResponseMode: string;
  deliveryUpdateResponseDeadline: string | null;
  deliveryUpdateMessage: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  ownerNote: string | null;
  canRefund: boolean;
}) {
  const router = useRouter();
  const refundRequestKey = useRef<string | null>(null);
  const [fulfillmentStatus, setFulfillmentStatus] = useState(
    initialFulfillmentStatus,
  );
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(
    initialTrackingNumber ?? "",
  );
  const [trackingUrl, setTrackingUrl] = useState(initialTrackingUrl ?? "");
  const [ownerNote, setOwnerNote] = useState(initialOwnerNote ?? "");
  const [addressResolutionNote, setAddressResolutionNote] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState(currentEstimatedDelivery);
  const [deliveryNoticeType, setDeliveryNoticeType] =
    useState<PreorderDeliveryNoticeType>(
      deliveryUpdateVersion === 0 ? "first_short_delay" : "consent_required_delay",
    );
  const [deliveryResponseDeadline, setDeliveryResponseDeadline] = useState("");
  const [shortDelayEligibilityConfirmed, setShortDelayEligibilityConfirmed] =
    useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState(
    initialDeliveryUpdateMessage ?? "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function request(
    path: string,
    options: RequestInit,
    successMessage: string,
  ) {
    setMessage("");
    setError("");
    const response = await fetch(path, options);
    const result = (await response.json()) as {
      error?: string;
      shippingEmail?: string;
      customerEmail?: string;
      status?: string;
    };
    if (!response.ok) throw new Error(result.error ?? "The order could not be updated.");
    const emailFailed =
      result.shippingEmail === "failed" || result.customerEmail === "failed";
    const emailNote = emailFailed
      ? " The order was updated, but the customer email needs attention."
      : "";
    setMessage(`${successMessage}${emailNote}`);
    router.refresh();
    return result;
  }

  async function saveFulfillment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("fulfillment");
    try {
      await request(
        `/api/admin/preorders/${orderId}/operations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_fulfillment",
            fulfillmentStatus,
            carrier,
            trackingNumber,
            trackingUrl,
            ownerNote,
          }),
        },
        "Fulfilment updated.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fulfilment could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function resendConfirmation() {
    setBusy("email");
    try {
      await request(
        `/api/admin/preorders/${orderId}/email`,
        { method: "POST" },
        "Confirmation email sent.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Email could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  async function resolveAddressChange(approved: boolean) {
    if (!approved && !addressResolutionNote.trim()) {
      setError("Add a reason before declining the address change.");
      return;
    }
    const verb = approved ? "Apply" : "Decline";
    if (!window.confirm(`${verb} this customer’s shipping-address request?`)) return;
    setBusy(approved ? "approve-address" : "decline-address");
    try {
      await request(
        `/api/admin/preorders/${orderId}/operations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: approved ? "approve_address_change" : "decline_address_change",
            resolutionNote: addressResolutionNote,
          }),
        },
        approved ? "Shipping address updated." : "Address request declined.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The address request could not be resolved.");
    } finally {
      setBusy(null);
    }
  }

  async function sendDeliveryUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const materialChange = deliveryNoticeType === "material_product_change";
    const affirmativeConsent = deliveryNoticeType !== "first_short_delay";
    if ((!materialChange && !deliveryEstimate.trim()) || !deliveryMessage.trim()) {
      setError("Add the new estimate and a customer-facing explanation.");
      return;
    }
    if (affirmativeConsent && !deliveryResponseDeadline) {
      setError("Choose the deadline for the customer’s affirmative response.");
      return;
    }
    if (!affirmativeConsent && !shortDelayEligibilityConfirmed) {
      setError("Confirm that this is the first definite delay and is no more than 30 days later.");
      return;
    }
    if (!window.confirm("Send this order-change notice to the customer?")) return;
    setBusy("delivery-update");
    try {
      await request(
        `/api/admin/preorders/${orderId}/operations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_delivery_update",
            noticeType: deliveryNoticeType,
            shortDelayEligibilityConfirmed,
            currentEstimate: deliveryEstimate,
            message: deliveryMessage,
            responseDeadline: affirmativeConsent
              ? new Date(deliveryResponseDeadline).toISOString()
              : null,
          }),
        },
        "Order-change notice recorded and queued for the customer.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The delivery update could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  async function refundOrder() {
    if (
      !window.confirm(
        `Issue a ${amountRemainingLabel} refund for this ${environment} order? This sends the refund to Stripe immediately and cannot be undone.`,
      )
    ) {
      return;
    }
    refundRequestKey.current ??= window.crypto.randomUUID();
    setBusy("refund");
    try {
      await request(
        `/api/admin/preorders/${orderId}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestKey: refundRequestKey.current }),
        },
        "Refund started in Stripe.",
      );
      refundRequestKey.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The refund could not be started.");
    } finally {
      setBusy(null);
    }
  }

  const requestedAddressLines = addressLines(requestedShippingAddress);

  return (
    <div className="preorder-order-operations">
      <section className="preorder-owner-card">
        <div className="preorder-owner-card__heading">
          <div><p className="eyebrow">Operations</p><h2>Fulfilment</h2></div>
          <span className={`admin-status admin-status--${initialFulfillmentStatus}`}>
            {initialFulfillmentStatus.replaceAll("_", " ")}
          </span>
        </div>
        <form className="preorder-fulfillment-form" onSubmit={saveFulfillment}>
          <label>
            <span>Status</span>
            <select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)}>
              {fulfillmentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label><span>Carrier</span><input value={carrier} maxLength={100} onChange={(event) => setCarrier(event.target.value)} placeholder="UPS" /></label>
          <label><span>Tracking number</span><input value={trackingNumber} maxLength={200} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
          <label className="preorder-fulfillment-form__wide"><span>Tracking URL</span><input type="url" value={trackingUrl} maxLength={500} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://…" /></label>
          <label className="preorder-fulfillment-form__wide"><span>Private owner note</span><textarea rows={3} maxLength={2000} value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} /></label>
          <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "fulfillment" ? "Saving…" : "Save fulfilment"}</button>
        </form>
      </section>

      {["requested", "processing"].includes(cancellationStatus) ? (
        <section className="preorder-owner-card preorder-owner-card--attention">
          <p className="eyebrow">Customer request</p>
          <h2>Cancellation requires a full refund.</h2>
          <p>Issue the full remaining refund below as soon as possible and no later than seven working days after the request. The order is blocked from shipment while cancellation is pending.</p>
        </section>
      ) : null}

      {["requested", "processing"].includes(addressChangeStatus) ? (
        <section className="preorder-owner-card preorder-owner-card--attention">
          <p className="eyebrow">Customer request</p>
          <h2>Shipping address needs review.</h2>
          <div className="preorder-owner-requested-address">
            {requestedAddressLines.map((line, index) => (
              <span key={`${line}-${index}`}>{line}<br /></span>
            ))}
          </div>
          {addressChangeReason ? <p><strong>Customer note:</strong> {addressChangeReason}</p> : null}
          <label><span>Resolution note</span><textarea rows={3} maxLength={1000} value={addressResolutionNote} onChange={(event) => setAddressResolutionNote(event.target.value)} placeholder="Required when declining" /></label>
          <div className="preorder-owner-inline-actions">
            <button className="button button--dark" type="button" onClick={() => resolveAddressChange(true)} disabled={Boolean(busy)}>{busy === "approve-address" ? "Applying…" : "Apply new address"}</button>
            <button className="button button--secondary" type="button" onClick={() => resolveAddressChange(false)} disabled={Boolean(busy)}>{busy === "decline-address" ? "Saving…" : "Decline request"}</button>
          </div>
        </section>
      ) : null}

      <section className="preorder-owner-card">
        <div className="preorder-owner-card__heading">
          <div><p className="eyebrow">Customer communication</p><h2>Order-change notice</h2></div>
          <span className={`admin-status admin-status--${deliveryUpdateStatus}`}>
            {deliveryUpdateStatus.replaceAll("_", " ")}
          </span>
        </div>
        <p>Use this for a shipping delay or a material product change. The notice records whether silence can keep the order active or affirmative consent is required.</p>
        {deliveryUpdateStatus === "pending" ? (
          <p className="preorder-manage-form-note">
            <strong>Pending notice:</strong>{" "}
            {deliveryUpdateNoticeType.replaceAll("_", " ")} · {deliveryUpdateResponseMode.replaceAll("_", " ")}
            {deliveryUpdateResponseDeadline
              ? ` · response due ${formatUtcDateTime(deliveryUpdateResponseDeadline)}`
              : ""}
          </p>
        ) : null}
        <form className="preorder-owner-delivery-form" onSubmit={sendDeliveryUpdate}>
          <label>
            <span>Notice type</span>
            <select value={deliveryNoticeType} onChange={(event) => setDeliveryNoticeType(event.target.value as PreorderDeliveryNoticeType)}>
              <option value="first_short_delay" disabled={deliveryUpdateVersion !== 0}>First definite delay of 30 days or less</option>
              <option value="consent_required_delay">Long, unknown, or subsequent delay</option>
              <option value="material_product_change">Material product change</option>
            </select>
          </label>
          {deliveryNoticeType !== "material_product_change" ? (
            <label><span>Current estimate</span><input required maxLength={200} value={deliveryEstimate} onChange={(event) => setDeliveryEstimate(event.target.value)} /></label>
          ) : null}
          {deliveryNoticeType !== "first_short_delay" ? (
            <label><span>Response deadline</span><input required type="datetime-local" value={deliveryResponseDeadline} onChange={(event) => setDeliveryResponseDeadline(event.target.value)} /></label>
          ) : null}
          {deliveryNoticeType === "first_short_delay" ? (
            <label className="preorder-owner-policy-confirmation">
              <input type="checkbox" checked={shortDelayEligibilityConfirmed} onChange={(event) => setShortDelayEligibilityConfirmed(event.target.checked)} />
              <span>I confirm this is the first delay and the definite revised shipping date is no more than 30 days later.</span>
            </label>
          ) : null}
          <label><span>Customer-facing explanation</span><textarea required rows={4} maxLength={1000} value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} placeholder="Explain what changed and what the customer can expect." /></label>
          <p className="preorder-manage-form-note">
            {deliveryNoticeType === "first_short_delay"
              ? "Silence may count as consent only for this first, definite delay of no more than 30 days."
              : "The customer must accept by the deadline or the unshipped order will be cancelled and refunded automatically."}
          </p>
          <button className="button button--secondary" type="submit" disabled={Boolean(busy)}>{busy === "delivery-update" ? "Sending…" : "Send order-change notice"}</button>
        </form>
      </section>

      <section className="preorder-owner-card">
        <p className="eyebrow">Customer communication</p>
        <h2>Order confirmation</h2>
        <p>Send a fresh confirmation with the secure customer order-management link.</p>
        <button className="button button--secondary" type="button" onClick={resendConfirmation} disabled={Boolean(busy)}>{busy === "email" ? "Sending…" : "Resend confirmation"}</button>
      </section>

      <section className="preorder-owner-card preorder-owner-card--danger">
        <p className="eyebrow">Payment operation</p>
        <h2>Full remaining refund</h2>
        <p>This immediately submits a {amountRemainingLabel} refund to the Stripe {environment} environment.</p>
        <button className="button preorder-danger-button" type="button" onClick={refundOrder} disabled={Boolean(busy) || !canRefund}>{busy === "refund" ? "Starting refund…" : canRefund ? `Refund ${amountRemainingLabel}` : "Refund unavailable"}</button>
      </section>

      {message ? <p className="form-success preorder-owner-feedback" role="status">{message}</p> : null}
      {error ? <p className="form-error preorder-owner-feedback" role="alert">{error}</p> : null}
    </div>
  );
}
