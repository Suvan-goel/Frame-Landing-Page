"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { formatPreorderAdminStatus } from "@/lib/preorder-admin-dashboard";
import type {
  PreorderSalesSnapshot,
  PreorderSalesStatus,
} from "@/lib/preorder-operations.server";

export function PreorderSalesControls({
  snapshot,
  liveGateReady,
}: {
  snapshot: PreorderSalesSnapshot;
  liveGateReady: boolean;
}) {
  const router = useRouter();
  const [salesStatus, setSalesStatus] = useState(snapshot.salesStatus);
  const [unitLimit, setUnitLimit] = useState(String(snapshot.unitLimit));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const liveOpenBlocked = snapshot.environment === "live" && !liveGateReady;
  const parsedUnitLimit = Number(unitLimit);
  const hasChanges =
    salesStatus !== snapshot.salesStatus || parsedUnitLimit !== snapshot.unitLimit;

  useEffect(() => {
    setSalesStatus(snapshot.salesStatus);
    setUnitLimit(String(snapshot.unitLimit));
    setMessage("");
    setError("");
  }, [snapshot.environment, snapshot.salesStatus, snapshot.unitLimit]);

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
          unitLimit: parsedUnitLimit,
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
          {formatPreorderAdminStatus(snapshot.salesStatus)}
        </span>
      </div>

      <p className="preorder-sales-controls__intro">
        These settings affect {snapshot.environment === "test" ? "sandbox" : "live"} checkout only. They do not change the fixed lifetime inventory ceiling.
      </p>

      <dl className="preorder-sales-controls__numbers">
        <div><dt>Paid units</dt><dd>{snapshot.paidUnits}</dd></div>
        <div><dt>Active reservations</dt><dd>{snapshot.reservedUnits}</dd></div>
        <div>
          <dt>Available in release</dt>
          <dd>{snapshot.remainingUnits}</dd>
        </div>
        <div><dt>Lifetime units left</dt><dd>{snapshot.inventoryRemainingUnits}</dd></div>
      </dl>

      <form onSubmit={save} aria-busy={saving}>
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
          <small>Pause checkout temporarily, or mark the release as sold out.</small>
        </label>
        <label>
          <span>Units released for sale</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={snapshot.inventoryLimit}
            step="1"
            value={unitLimit}
            onChange={(event) => {
              setUnitLimit(event.target.value);
              setMessage("");
              setError("");
            }}
          />
          <small>
            Up to {snapshot.inventoryLimit.toLocaleString()} units across the lifetime of this pre-order programme. Paid units and active reservations cannot be removed.
          </small>
        </label>
        <button className="button button--dark" type="submit" disabled={saving || !hasChanges}>
          {saving ? "Saving…" : "Save controls"}
        </button>
      </form>

      {liveOpenBlocked ? (
        <p className="preorder-sales-controls__note">
          Opening live checkout is disabled until every launch safeguard passes. The readiness panel explains what remains.
        </p>
      ) : null}
      <p className="preorder-sales-controls__updated">
        Last updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(snapshot.updatedAt))} UTC{snapshot.updatedBy ? ` by ${snapshot.updatedBy}` : ""}.
      </p>
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
