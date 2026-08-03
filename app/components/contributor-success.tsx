"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusResult = {
  status?: string;
  error?: string;
  membership?: {
    contributorNumber: string;
    fullName: string;
    paidAt: string;
    accessExpiresAt: string;
    amountPaidCents: number;
    currency: string;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(value));
}

export function ContributorSuccess() {
  const [result, setResult] = useState<StatusResult>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    const preview = query.get("preview") === "1";

    async function check(attempt = 0) {
      const params = preview
        ? "preview=1"
        : `session_id=${encodeURIComponent(sessionId ?? "")}`;
      try {
        const response = await fetch(`/api/founding-contributors/status?${params}`, {
          headers: { Accept: "application/json" },
        });
        const next = (await response.json()) as StatusResult;
        if (cancelled) return;
        setResult(next);
        if (next.status === "processing" && attempt < 8) {
          timer = window.setTimeout(() => check(attempt + 1), 1600);
        }
      } catch {
        if (!cancelled) setResult({ error: "Payment confirmation is temporarily unavailable." });
      }
    }

    check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  if (result.status === "loading" || result.status === "processing") {
    return (
      <section className="contributor-success" role="status" aria-live="polite">
        <p className="eyebrow">Payment received</p>
        <h1>We’re activating your membership.</h1>
        <p>Stripe has returned you to Frame. We’re waiting for the signed payment confirmation before granting member access.</p>
        <div className="contributor-success__loader" aria-hidden="true" />
      </section>
    );
  }

  if (result.status?.startsWith("duplicate_") && result.membership) {
    const refundFailed = result.status === "duplicate_refund_failed";
    return (
      <section className="contributor-success" role="status" aria-live="polite">
        <p className="eyebrow">Existing membership · {result.membership.contributorNumber}</p>
        <h1>You’re already a Frame Founding Contributor.</h1>
        <p>
          This payment used the email address of an existing membership, so it has not
          created another contributor number or extended your access. {refundFailed
            ? "The automatic duplicate-payment refund needs support review."
            : "A full refund of the duplicate payment has been initiated automatically."}
        </p>
        <div className="contributor-success__actions">
          <Link className="button button--dark" href="/contributors/sign-in">Open member sign in</Link>
          <Link className="text-link" href={refundFailed ? "/contact?topic=general" : "/contributors/refunds"}>
            {refundFailed ? "Contact support" : "View the refund policy"}
          </Link>
        </div>
      </section>
    );
  }

  if (result.error || result.status !== "active" || !result.membership) {
    return (
      <section className="contributor-success">
        <p className="eyebrow">Confirmation needs attention</p>
        <h1>Your membership details are not ready yet.</h1>
        <p>{result.error ?? "Payment has not been confirmed. If you completed payment, check again shortly or contact support."}</p>
        <div className="contributor-success__actions">
          <Link className="button button--dark" href="/contact?topic=general">Contact support</Link>
          <Link className="text-link" href="/founding-contributors">Back to membership details</Link>
        </div>
      </section>
    );
  }

  const membership = result.membership;
  const preview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";
  const hubHref = preview
    ? "/contributors?preview=1&section=profile"
    : "/contributors/sign-in?next=profile";
  return (
    <section className="contributor-success" role="status" aria-live="polite">
      <p className="eyebrow">Membership active · {membership.contributorNumber}</p>
      <h1>You’re now a Frame Founding Contributor.</h1>
      <p>
        Welcome, {membership.fullName}. Your Founding Contributor status and 12 months of private community access are now active.
      </p>
      <dl>
        <div><dt>Payment</dt><dd>$99 · one-time payment</dd></div>
        <div><dt>Membership started</dt><dd>{formatDate(membership.paidAt)}</dd></div>
        <div><dt>Access through</dt><dd>{formatDate(membership.accessExpiresAt)}</dd></div>
        <div><dt>Renewal</dt><dd>No automatic renewal</dd></div>
      </dl>
      <div className="contributor-success__steps-heading">
        <p className="eyebrow">Start here</p>
        <h2>Your next steps</h2>
      </div>
      <ol className="contributor-success__steps">
        <li><span>01</span><strong>Activate your contributor hub</strong></li>
        <li><span>02</span><strong>Complete your profile inside the hub</strong></li>
        <li><span>03</span><strong>Read the latest development briefing</strong></li>
        <li><span>04</span><strong>Share your first feedback</strong></li>
      </ol>
      <div className="contributor-success__actions">
        <Link className="button button--dark" href={hubHref}>Activate your contributor hub</Link>
      </div>
      <Link className="contributor-success__refund-link" href="/contributors/refunds">View the refund policy</Link>
    </section>
  );
}
