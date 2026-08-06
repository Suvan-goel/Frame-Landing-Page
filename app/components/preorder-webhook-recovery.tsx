"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type FailedWebhook = {
  eventId: string;
  eventType: string;
  status: "failed" | "stalled";
  errorMessage: string | null;
  processingAttempts: number;
  lastAttemptedAt: string | null;
};

export function PreorderWebhookRecovery({
  environment,
  events,
}: {
  environment: "test" | "live";
  events: FailedWebhook[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function retry(eventId: string) {
    setBusy(eventId);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/admin/preorders/webhooks/${encodeURIComponent(eventId)}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environment }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The event could not be retried.");
      setMessage(`${eventId} processed successfully.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The event could not be retried.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="preorder-reliability-panel">
      <div className="preorder-reliability-panel__heading">
        <div>
          <p className="eyebrow">Payment reliability</p>
          <h2>{events.length ? "Stripe events need recovery." : "Webhook processing is healthy."}</h2>
        </div>
        <span className={`admin-status ${events.length ? "admin-status--refund_failed" : "admin-status--paid"}`}>
          {events.length ? `${events.length} unresolved` : "No failures"}
        </span>
      </div>
      {events.length ? (
        <ul className="preorder-recovery-list">
          {events.map((event) => (
            <li key={event.eventId}>
              <div>
                <strong>{event.eventType}</strong>
                <code>{event.eventId}</code>
                <small>
                  {event.status === "stalled"
                    ? "Background processing did not finish and can now be recovered."
                    : event.errorMessage ?? "No failure detail was recorded."}
                  {` · ${event.processingAttempts} attempt${event.processingAttempts === 1 ? "" : "s"}`}
                  {event.lastAttemptedAt ? ` · ${new Date(event.lastAttemptedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : ""}
                </small>
              </div>
              <button
                className="button button--secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => retry(event.eventId)}
              >
                {busy === event.eventId ? "Retrying…" : "Retry event"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No failed or stalled Stripe events are recorded for this environment.</p>
      )}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
