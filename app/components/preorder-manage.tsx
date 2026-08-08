"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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
  deliveryUpdateMessage: string | null;
  deliveryUpdateSentAt: string | null;
  deliveryUpdateAcknowledgedAt: string | null;
  requiresDeliveryResponse: boolean;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
          if (next.order) setAddress(addressForm(next.order.shippingAddress));
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
      if (next.order) setAddress(addressForm(next.order.shippingAddress));
    } catch (error) {
      setResult((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Your request could not be submitted.",
      }));
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

  async function respondToDeliveryUpdate(response: "accept" | "request_cancellation") {
    const order = result.order;
    if (!order) return;
    if (
      response === "request_cancellation" &&
      !window.confirm("Request cancellation instead of accepting the updated shipping estimate?")
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

  return (
    <section className="preorder-manage-card">
      <header className="preorder-manage-card__header">
        <div>
          <p className="eyebrow">Pre-order {order.orderNumber}</p>
          <h1>Manage your Frame pre-order.</h1>
          <p>Placed {formatDate(order.placedAt)} · {order.amountPaid}</p>
        </div>
        <span className={`preorder-manage-status preorder-manage-status--${cancelled ? "cancelled" : order.fulfillmentStatus}`}>
          {cancelled
            ? "Cancelled"
            : cancellationPending
              ? "Cancellation requested"
              : order.fulfillmentStatus.replaceAll("_", " ")}
        </span>
      </header>

      {message ? <p className="form-success" role="status">{message}</p> : null}
      {result.error ? <p className="form-error" role="alert">{result.error}</p> : null}

      <div className="preorder-manage-grid">
        <section>
          <p className="eyebrow">Estimated shipping</p>
          <h2>{order.estimatedShipping}</h2>
          {order.shippedAt ? <p>Shipped {formatDate(order.shippedAt)}</p> : <p>We’ll email you when your Frame ships.</p>}
          {order.trackingNumber ? <p><strong>{order.carrier ?? "Tracking"}:</strong> {order.trackingNumber}</p> : null}
          {order.trackingUrl ? <a className="text-link" href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a> : null}
        </section>
        <section>
          <p className="eyebrow">Shipping to</p>
          <h2>{order.fullName}</h2>
          <p>{shipping.map((line, index) => <span key={`${line}-${index}`}>{line}<br /></span>)}</p>
          <p className="preorder-manage-card__email">Updates: {order.email}</p>
        </section>
      </div>

      {order.requiresDeliveryResponse ? (
        <section className="preorder-manage-cancellation preorder-manage-cancellation--pending">
          <p className="eyebrow">Shipping estimate update</p>
          <h2>Please review the updated estimate.</h2>
          <p>{order.deliveryUpdateMessage}</p>
          <dl className="preorder-manage-delivery-change">
            <div><dt>Original estimate</dt><dd>{order.originalEstimatedShipping}</dd></div>
            <div><dt>Current estimate</dt><dd>{order.estimatedShipping}</dd></div>
          </dl>
          <div className="preorder-manage-actions">
            <button className="button button--dark" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("accept")}>{busy === "respond_delivery_update" ? "Saving…" : "Accept updated estimate"}</button>
            <button className="text-link" type="button" disabled={Boolean(busy)} onClick={() => respondToDeliveryUpdate("request_cancellation")}>Request cancellation</button>
          </div>
        </section>
      ) : order.deliveryUpdateStatus === "accepted" ? (
        <section className="preorder-manage-cancellation">
          <p className="eyebrow">Shipping response recorded</p>
          <h2>You accepted the current estimate.</h2>
          <p>{order.deliveryUpdateMessage}</p>
        </section>
      ) : null}

      {addressChangePending ? (
        <section className="preorder-manage-cancellation preorder-manage-cancellation--pending">
          <p className="eyebrow">Address request received</p>
          <h2>We’re reviewing your shipping address.</h2>
          <p>{requestedShipping.map((line, index) => <span key={`${line}-${index}`}>{line}<br /></span>)}</p>
          <p>Do not submit another request. We’ll confirm after the change has been reviewed.</p>
        </section>
      ) : order.canRequestAddressChange ? (
        <section className="preorder-manage-cancellation preorder-manage-address-change">
          <p className="eyebrow">Shipping address</p>
          <h2>Request an address change.</h2>
          <p>Changes are reviewed before they are applied to your order.</p>
          {order.addressChangeStatus === "declined" && order.addressChangeResolutionNote ? (
            <p className="preorder-manage-resolution-note"><strong>Previous request:</strong> {order.addressChangeResolutionNote}</p>
          ) : null}
          <form onSubmit={requestAddressChange}>
            <label>Address line 1<input required minLength={3} maxLength={200} value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} /></label>
            <label>Address line 2 <span>(optional)</span><input maxLength={200} value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))} /></label>
            <div className="preorder-manage-address-grid">
              <label>City<input required minLength={2} maxLength={100} value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>State<input required minLength={2} maxLength={100} value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))} /></label>
              <label>ZIP code<input required minLength={3} maxLength={20} value={address.postal_code} onChange={(event) => setAddress((current) => ({ ...current, postal_code: event.target.value }))} /></label>
              <label>Country<select value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))}><option value="US">United States</option></select></label>
            </div>
            <label>Reason <span>(optional)</span><textarea rows={3} maxLength={1_000} value={addressReason} onChange={(event) => setAddressReason(event.target.value)} /></label>
            <button className="button button--secondary" type="submit" disabled={Boolean(busy)}>{busy === "request_address_change" ? "Submitting…" : "Submit address request"}</button>
          </form>
        </section>
      ) : null}

      {cancellationPending ? (
        <section className="preorder-manage-cancellation preorder-manage-cancellation--pending">
          <p className="eyebrow">Request received</p>
          <h2>Your cancellation is being processed.</h2>
          <p>Your order is blocked from shipment. We’ll submit the full remaining refund as soon as possible and no later than seven working days after cancellation, then email you with the status.</p>
        </section>
      ) : cancelled ? (
        <section className="preorder-manage-cancellation preorder-manage-cancellation--pending">
          <p className="eyebrow">Order cancelled</p>
          <h2>Your pre-order is no longer active.</h2>
          <p>Contact support if you have questions about the refund status.</p>
        </section>
      ) : order.canRequestCancellation && !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-cancellation">
          <p className="eyebrow">Need to cancel?</p>
          <h2>Cancel your pre-order.</h2>
          <p>You can cancel for any reason before dispatch. We’ll refund the full remaining amount to the original payment method.</p>
          <form onSubmit={requestCancellation}>
            <label htmlFor="cancellation-reason">Reason <span>(optional)</span></label>
            <textarea id="cancellation-reason" rows={4} maxLength={1_000} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Tell us why you’d like to cancel" />
            <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy === "request_cancellation" ? "Submitting…" : "Cancel pre-order"}</button>
          </form>
        </section>
      ) : !order.requiresDeliveryResponse ? (
        <section className="preorder-manage-cancellation">
          <p className="eyebrow">Order support</p>
          <h2>Online cancellation is unavailable.</h2>
          <p>Please contact us and include your order number so we can help.</p>
          <Link className="text-link" href="/contact?topic=general">Contact support</Link>
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
