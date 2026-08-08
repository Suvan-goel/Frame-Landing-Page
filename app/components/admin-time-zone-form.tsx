"use client";

import { useEffect, type FormEvent } from "react";
import {
  ADMIN_TIME_ZONE_COOKIE,
  ADMIN_TIME_ZONES,
  type AdminTimeZone,
} from "@/lib/admin-time-zone";

type WaitlistView = "qualified" | "unqualified" | "insights";

function storeTimeZone(timeZone: string) {
  document.cookie = `${ADMIN_TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; Path=/admin; Max-Age=31536000; SameSite=Lax`;
}

export function AdminTimeZoneForm({
  activeTab,
  selectedTimeZone,
}: {
  activeTab: WaitlistView;
  selectedTimeZone: AdminTimeZone;
}) {
  useEffect(() => {
    storeTimeZone(selectedTimeZone);
  }, [selectedTimeZone]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const timeZoneField = event.currentTarget.elements.namedItem("timezone");
    if (timeZoneField instanceof HTMLSelectElement) {
      storeTimeZone(timeZoneField.value);
    }
  }

  const selectedTimeZoneLabel =
    ADMIN_TIME_ZONES.find((option) => option.value === selectedTimeZone)?.label ??
    "UTC";

  return (
    <form
      className="admin-timezone"
      action="/admin/waitlist"
      method="get"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="tab" value={activeTab} />
      <div className="admin-timezone__field">
        <label htmlFor="admin-timezone-select">Lead time zone</label>
        <select
          id="admin-timezone-select"
          name="timezone"
          defaultValue={selectedTimeZone}
        >
          {ADMIN_TIME_ZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button className="admin-timezone__submit" type="submit">
        Apply
      </button>
      <p>Showing lead times in {selectedTimeZoneLabel}.</p>
    </form>
  );
}
