"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusResult = {
  status?: string;
  error?: string;
  order?: {
    orderNumber: string;
    fullName: string;
    email: string;
    quantity: number;
    amountPaidCents: number;
    currency: string;
    placedAt: string;
    estimatedDelivery: string;
    fulfillmentStatus: string;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(value));
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(currency.toLowerCase() === "usd" ? "en-US" : "en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PreorderSuccess() {
  const [result, setResult] = useState<StatusResult>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    const preview = query.get("preview") === "1";

    async function check(attempt = 0) {
      const params = preview ? "preview=1" : `session_id=${encodeURIComponent(sessionId ?? "")}`;
      try {
        const response = await fetch(`/api/preorders/status?${params}`, {
          headers: { Accept: "application/json" },
        });
        const next = (await response.json()) as StatusResult;
        if (cancelled) return;
        setResult(next);
        if ((next.status === "processing" || response.status === 202) && attempt < 8) {
          timer = window.setTimeout(() => check(attempt + 1), 1600);
        }
      } catch {
        if (!cancelled) setResult({ error: "Test payment confirmation is temporarily unavailable." });
      }
    }

    check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  if (result.status === "loading" || result.status === "processing") {
    return (
      <section className="contributor-success preorder-success" role="status" aria-live="polite">
        <p className="eyebrow">Test payment received</p>
        <h1>We’re confirming your test pre-order.</h1>
        <p>Stripe has returned you to Frame. The order appears only after the signed payment details have been validated.</p>
        <div className="contributor-success__loader" aria-hidden="true" />
      </section>
    );
  }

  if (result.error || result.status !== "confirmed" || !result.order) {
    return (
      <section className="contributor-success preorder-success">
        <p className="eyebrow">Confirmation needs attention</p>
        <h1>Your test order details are not ready yet.</h1>
        <p>{result.error ?? "The payment has not been confirmed. If you completed a test payment, check again shortly."}</p>
        <div className="contributor-success__actions">
          <Link className="button button--dark" href="/contact?topic=general">Contact support</Link>
          <Link className="text-link" href="/preorder/review?source=success_error">Back to order review</Link>
        </div>
      </section>
    );
  }

  const order = result.order;
  return (
    <section className="contributor-success preorder-success" role="status" aria-live="polite">
      <p className="eyebrow">Test order confirmed · {order.orderNumber}</p>
      <h1>The local pre-order flow is working.</h1>
      <p>
        Thanks, {order.fullName}. The test payment, signed webhook fulfilment and separate pre-order record have been connected successfully.
      </p>
      <dl>
        <div><dt>Test payment</dt><dd>{formatMoney(order.amountPaidCents, order.currency)}</dd></div>
        <div><dt>Quantity</dt><dd>{order.quantity}</dd></div>
        <div><dt>Placed</dt><dd>{formatDate(order.placedAt)}</dd></div>
        <div><dt>Fulfilment</dt><dd>{order.fulfillmentStatus.replaceAll("_", " ")}</dd></div>
      </dl>
      <div className="contributor-success__steps-heading">
        <p className="eyebrow">Recorded delivery wording</p>
        <h2>{order.estimatedDelivery}</h2>
      </div>
      <p className="preorder-success__notice">
        This remains a local test transaction. Refund test payments from the Stripe test dashboard when validation is complete.
      </p>
      <div className="contributor-success__actions">
        <Link className="button button--dark" href="/admin/preorders">Open owner view</Link>
        <Link className="text-link" href="/preorder/review?source=success_retry">Run another test</Link>
      </div>
      <Link className="contributor-success__refund-link" href="/preorder/refunds">View the draft refund policy</Link>
    </section>
  );
}
