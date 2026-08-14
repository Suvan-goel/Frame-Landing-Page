import {
  ADMIN_TIME_ZONES,
  type AdminTimeZone,
} from "@/lib/admin-time-zone";
import { AdminTimeZoneClock } from "./admin-time-zone-clock";

type WaitlistView = "new" | "legacy" | "unqualified" | "insights";

export function AdminTimeZoneForm({
  activeTab,
  selectedTimeZone,
}: {
  activeTab: WaitlistView;
  selectedTimeZone: AdminTimeZone;
}) {
  const selectedTimeZoneLabel =
    ADMIN_TIME_ZONES.find((option) => option.value === selectedTimeZone)?.label ??
    "UTC";

  return (
    <form
      className="admin-timezone"
      action="/api/admin/time-zone?form=v2"
      method="post"
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
      <AdminTimeZoneClock
        label={selectedTimeZoneLabel}
        timeZone={selectedTimeZone}
      />
    </form>
  );
}
