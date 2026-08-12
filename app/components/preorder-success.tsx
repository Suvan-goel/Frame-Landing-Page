"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  preorderConfirmationRecovery,
  preorderShippingAddressLines,
  type PreorderShippingAddress,
} from "@/lib/preorder-confirmation";
import {
  PREORDER_CHECKOUT_REQUEST_KEY,
  PREORDER_DELIVERY_DRAFT_KEY,
} from "@/lib/preorder-checkout-draft";

type StatusResult = {
  status?: string;
  error?: string;
  order?: {
    orderNumber: string;
    fullName: string;
    email: string;
    shippingAddress: PreorderShippingAddress | null;
    quantity: number;
    amountSubtotalCents: number;
    amountShippingCents: number;
    amountTaxCents: number;
    amountPaidCents: number;
    currency: string;
    placedAt: string;
    estimatedShipping: string;
    managePath?: string | null;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
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
        if ((next.status === "processing" || response.status === 202) && attempt < 8) {
          setResult({ ...next, status: "processing" });
          timer = window.setTimeout(() => check(attempt + 1), 1600);
          return;
        }
        if (next.status === "processing" || response.status === 202) {
          setResult({ status: "unavailable" });
          return;
        }
        setResult(next);
      } catch {
        if (!cancelled) setResult({ status: "unavailable" });
      }
    }

    check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (result.status !== "confirmed") return;
    try {
      window.sessionStorage.removeItem(PREORDER_DELIVERY_DRAFT_KEY);
      window.sessionStorage.removeItem(PREORDER_CHECKOUT_REQUEST_KEY);
    } catch {
      // Storage may be unavailable; confirmation must still load.
    }
  }, [result.status]);

  if (result.status === "loading" || result.status === "processing") {
    return (
      <section className="preorder-confirmation preorder-confirmation--state" role="status" aria-live="polite">
        <div className="preorder-confirmation__mark" aria-hidden="true">…</div>
        <p className="eyebrow">Confirming payment</p>
        <h1>We’re confirming your pre-order.</h1>
        <p>This usually takes only a few moments. Please keep this page open while we finish preparing your confirmation.</p>
        <div className="preorder-confirmation__loader" aria-hidden="true" />
      </section>
    );
  }

  if (result.error || result.status !== "confirmed" || !result.order) {
    const recovery = preorderConfirmationRecovery(result);
    return (
      <section className="preorder-confirmation preorder-confirmation--state">
        <div className="preorder-confirmation__state-copy" role="alert">
          <p className="eyebrow">{recovery.eyebrow}</p>
          <h1>{recovery.heading}</h1>
          <p>{recovery.message}</p>
        </div>
        <div className="preorder-confirmation__actions">
          {recovery.primaryAction.kind === "retry" ? (
            <button className="button button--dark" type="button" onClick={() => window.location.reload()}>
              {recovery.primaryAction.label}
            </button>
          ) : (
            <Link className="button button--dark" href={recovery.primaryAction.href}>
              {recovery.primaryAction.label}
            </Link>
          )}
          <Link className="text-link" href="/contact?topic=preorder">Contact pre-order support</Link>
        </div>
      </section>
    );
  }

  const order = result.order;
  const shippingAddress = order.shippingAddress
    ? preorderShippingAddressLines(order.shippingAddress)
    : [];

  return (
    <section className="preorder-confirmation">
      <p className="sr-only" role="status" aria-live="polite">
        Your Frame pre-order is confirmed. Payment received.
      </p>
      <header className="preorder-confirmation__hero">
        <div className="preorder-confirmation__status">
          <span className="preorder-confirmation__mark" aria-hidden="true">✓</span>
          <p className="eyebrow">Payment received</p>
        </div>
        <h1>Your pre-order is confirmed.</h1>
        <p className="preorder-confirmation__email">
          Thanks - your payment is complete. Order updates will be sent to <a href={`mailto:${order.email}`}>{order.email}</a>.
        </p>
      </header>

      <section className="preorder-confirmation__receipt" aria-labelledby="order-summary-heading">
        <div className="preorder-confirmation__product">
          <div className="preorder-confirmation__product-media">
            <Image
              src="/frame-product-concept-realistic-v3-transparent.webp"
              alt="Frame upper-arm wearable product concept"
              width={720}
              height={720}
              unoptimized
            />
          </div>
          <div className="preorder-confirmation__product-copy">
            <p className="eyebrow">Your order</p>
            <h2 id="order-summary-heading">Frame</h2>
            <p>Quantity {order.quantity}</p>
          </div>
          <span className="preorder-confirmation__paid">Paid</span>
        </div>

        <div className="preorder-confirmation__receipt-body">
          <dl className="preorder-confirmation__order-meta">
            <div>
              <dt>Order number</dt>
              <dd>{order.orderNumber}</dd>
            </div>
            <div>
              <dt>Order date</dt>
              <dd><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time></dd>
            </div>
          </dl>

          <dl className="preorder-confirmation__pricing">
            <div>
              <dt>Product subtotal</dt>
              <dd>{formatMoney(order.amountSubtotalCents, order.currency)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{order.amountShippingCents === 0 ? "Free" : formatMoney(order.amountShippingCents, order.currency)}</dd>
            </div>
            <div>
              <dt>Sales tax</dt>
              <dd>{formatMoney(order.amountTaxCents, order.currency)}</dd>
            </div>
            <div className="preorder-confirmation__total">
              <dt>Total paid</dt>
              <dd>{formatMoney(order.amountPaidCents, order.currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="preorder-confirmation__shipping">
          <div>
            <p className="eyebrow">Estimated shipping</p>
            <h3>{order.estimatedShipping}</h3>
          </div>
          <div className="preorder-confirmation__shipping-details">
            {shippingAddress.length ? (
              <div>
                <p className="eyebrow">Shipping to</p>
                <address>
                  {shippingAddress.map((line) => <span key={line}>{line}</span>)}
                </address>
              </div>
            ) : null}
            <p>
              We’re targeting this window for dispatch. You can request an address change from your secure
              management page.
            </p>
          </div>
        </div>
      </section>

      <section className="preorder-confirmation__follow-up" aria-labelledby="next-heading">
        <div>
          <p className="eyebrow">What happens next</p>
          <h2 id="next-heading">Watch your inbox.</h2>
        </div>
        <p>
          Your receipt and secure management link are on their way. We’ll send shipping and tracking updates
          before dispatch.
        </p>
        <ol className="preorder-confirmation__steps">
          <li>
            <span>01</span>
            <div>
              <strong>Receipt and secure link</strong>
              <small>Sent to your order email.</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Delivery updates</strong>
              <small>Timing changes shared before dispatch.</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Shipping and tracking</strong>
              <small>Sent when your order dispatches.</small>
            </div>
          </li>
        </ol>
        {order.managePath ? (
          <a className="button button--dark preorder-confirmation__mobile-manage" href={order.managePath}>
            Manage your pre-order
          </a>
        ) : null}
      </section>

      <div className="preorder-confirmation__actions">
        {order.managePath ? (
          <a className="button button--dark preorder-confirmation__desktop-manage" href={order.managePath}>
            Manage your pre-order
          </a>
        ) : null}
        <Link
          className={`${order.managePath ? "text-link" : "button button--dark"} preorder-confirmation__return-link`}
          href="/"
        >
          <span className="preorder-confirmation__return-arrow" aria-hidden="true">←</span>
          Return to Frame
        </Link>
      </div>

      <nav className="preorder-confirmation__policies" aria-label="Order policies">
        <Link href="/contact?topic=preorder">Support</Link>
        <Link href="/preorder/product-status">Product status</Link>
        <Link href="/preorder/terms">Pre-order terms</Link>
        <Link href="/preorder/refunds">Cancellation and refunds</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </section>
  );
}
