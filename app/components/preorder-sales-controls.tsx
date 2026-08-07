"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type {
  PreorderSalesSnapshot,
  PreorderSalesStatus,
} from "@/lib/preorder-operations.server";

export function PreorderSalesControls({
  snapshot,
  liveGateReady,
  launchBlockers,
}: {
  snapshot: PreorderSalesSnapshot;
  liveGateReady: boolean;
  launchBlockers: string[];
}) {
  const router = useRouter();
  const [salesStatus, setSalesStatus] = useState(snapshot.salesStatus);
  const [unitLimit, setUnitLimit] = useState(
    snapshot.unitLimit === null ? "" : String(snapshot.unitLimit),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const liveOpenBlocked = snapshot.environment === "live" && !liveGateReady;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/preorders/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: snapshot.environment,
          salesStatus,
          unitLimit: unitLimit.trim() ? Number(unitLimit) : null,
        }),
      });
      const result = (await response.json()) as { error?: string; blockers?: string[] };
      if (!response.ok) {
        throw new Error(
          result.blockers?.length
            ? `${result.error ?? "Live sales remain locked."} ${result.blockers.join(" ")}`
            : result.error ?? "Sales controls could not be updated.",
        );
      }
      setMessage("Sales controls saved.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sales controls could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="preorder-sales-controls" aria-labelledby="sales-controls-heading">
      <div className="preorder-sales-controls__heading">
        <div>
          <p className="eyebrow">Sales controls</p>
          <h2 id="sales-controls-heading">
            {snapshot.environment === "test" ? "Sandbox" : "Live"} allocation
          </h2>
        </div>
        <span className={`admin-status admin-status--${snapshot.salesStatus}`}>
          {snapshot.salesStatus.replaceAll("_", " ")}
        </span>
      </div>

      <dl className="preorder-sales-controls__numbers">
        <div><dt>Paid units</dt><dd>{snapshot.paidUnits}</dd></div>
        <div><dt>Reserved checkouts</dt><dd>{snapshot.reservedUnits}</dd></div>
        <div>
          <dt>Remaining</dt>
          <dd>{snapshot.remainingUnits === null ? "Unlimited" : snapshot.remainingUnits}</dd>
        </div>
      </dl>

      <form onSubmit={save}>
        <label>
          <span>Checkout status</span>
          <select
            value={salesStatus}
            onChange={(event) => {
              setSalesStatus(event.target.value as PreorderSalesStatus);
              setMessage("");
              setError("");
            }}
          >
            <option value="open" disabled={liveOpenBlocked}>Open</option>
            <option value="paused">Paused</option>
            <option value="sold_out">Sold out</option>
          </select>
        </label>
        <label>
          <span>Maximum units</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1000000"
            step="1"
            placeholder="Unlimited"
            value={unitLimit}
            onChange={(event) => {
              setUnitLimit(event.target.value);
              setMessage("");
              setError("");
            }}
          />
        </label>
        <button className="button button--dark" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save controls"}
        </button>
      </form>

      {liveOpenBlocked ? (
        <div className="preorder-sales-controls__blockers">
          <p className="preorder-sales-controls__note">
            Live checkout stays locked until every launch safeguard passes.
          </p>
          {launchBlockers.length ? (
            <ul>
              {launchBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
