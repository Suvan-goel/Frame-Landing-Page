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
        setResult(next);
        if ((next.status === "processing" || response.status === 202) && attempt < 8) {
          timer = window.setTimeout(() => check(attempt + 1), 1600);
        }
      } catch {
        if (!cancelled) setResult({ error: "Your confirmation is temporarily unavailable." });
      }
    }

    check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  if (result.status === "loading" || result.status === "processing") {
    return (
      <section className="preorder-confirmation preorder-confirmation--state" role="status" aria-live="polite">
        <div className="preorder-confirmation__mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Payment received</p>
        <h1>We’re confirming your pre-order.</h1>
        <p>This usually takes only a few moments. Please keep this page open while we finish preparing your confirmation.</p>
        <div className="preorder-confirmation__loader" aria-hidden="true" />
      </section>
    );
  }

  if (result.error || result.status !== "confirmed" || !result.order) {
    return (
      <section className="preorder-confirmation preorder-confirmation--state">
        <p className="eyebrow">Payment confirmation</p>
        <h1>We’re still confirming your order.</h1>
        <p>{result.error ?? "We haven’t been able to load your confirmation yet. Refresh this page, or contact us if you continue to see this message."}</p>
        <div className="preorder-confirmation__actions">
          <button className="button button--dark" type="button" onClick={() => window.location.reload()}>
            Check again
          </button>
          <Link className="text-link" href="/contact?topic=general">Contact us</Link>
        </div>
      </section>
    );
  }

  const order = result.order;
  const firstName = order.fullName.trim().split(/\s+/)[0];

  return (
    <section className="preorder-confirmation" role="status" aria-live="polite">
      <header className="preorder-confirmation__hero">
        <div className="preorder-confirmation__mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Pre-order confirmed · {order.orderNumber}</p>
        <h1>Your Frame pre-order is confirmed.</h1>
        <p>
          Thank you, {firstName}. We’ve received your order for one Frame and your payment is complete.
        </p>
        <p className="preorder-confirmation__email">
          Important order and delivery updates will be sent to <a href={`mailto:${order.email}`}>{order.email}</a>.
        </p>
      </header>

      <div className="preorder-confirmation__summary-grid">
        <section className="preorder-confirmation__order-card" aria-labelledby="order-summary-heading">
          <div className="preorder-confirmation__card-heading">
            <div>
              <p className="eyebrow">Order summary</p>
              <h2 id="order-summary-heading">Frame</h2>
            </div>
            <span>Payment received</span>
          </div>
          <dl>
            <div>
              <dt>Quantity</dt>
              <dd>{order.quantity}</dd>
            </div>
            <div>
              <dt>Total paid</dt>
              <dd>{formatMoney(order.amountPaidCents, order.currency)}</dd>
            </div>
            <div>
              <dt>Order date</dt>
              <dd><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time></dd>
            </div>
          </dl>
        </section>

        <section className="preorder-confirmation__delivery" aria-labelledby="delivery-heading">
          <p className="eyebrow">Estimated delivery</p>
          <h2 id="delivery-heading">{order.estimatedDelivery}</h2>
          <p>
            This is our current estimate, not a guaranteed date. We’ll keep you informed if the timing changes.
          </p>
        </section>
      </div>

      <section className="preorder-confirmation__next" aria-labelledby="next-heading">
        <div className="preorder-confirmation__next-heading">
          <p className="eyebrow">What happens next</p>
          <h2 id="next-heading">From pre-order to delivery.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div><h3>Your order is confirmed</h3><p>Your payment and place in the pre-order queue have been recorded.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><h3>We’ll keep you updated</h3><p>We’ll email you about meaningful product progress and any change to the estimated timing.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><h3>Shipping confirmation</h3><p>When your Frame is ready, we’ll confirm your delivery details and send tracking information.</p></div>
          </li>
        </ol>
      </section>

      <div className="preorder-confirmation__actions">
        {order.managePath ? (
          <a className="button button--dark" href={order.managePath}>Manage your pre-order</a>
        ) : (
          <Link className="button button--dark" href="/">Return to Frame</Link>
        )}
        <Link className="text-link" href="/contact?topic=general">Need help? Contact us</Link>
      </div>

      <nav className="preorder-confirmation__policies" aria-label="Order policies">
        <Link href="/preorder/terms">Pre-order terms</Link>
        <Link href="/preorder/refunds">Cancellation and refunds</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </section>
  );
}
