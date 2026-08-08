import { TimeZoneClock } from "@/app/components/time-zone-clock";
import {
  ADMIN_TIME_ZONES,
  type AdminTimeZone,
} from "@/lib/admin-time-zone";

type WaitlistView = "qualified" | "unqualified" | "insights";

export function AdminTimeZoneForm({
  activeTab,
  initialDateTime,
  selectedTimeZone,
}: {
  activeTab: WaitlistView;
  initialDateTime: string;
  selectedTimeZone: AdminTimeZone;
}) {
  const selectedTimeZoneLabel =
    ADMIN_TIME_ZONES.find((option) => option.value === selectedTimeZone)?.label ??
    "UTC";

  return (
    <form
      className="admin-timezone"
      action="/api/admin/time-zone"
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
      <TimeZoneClock
        initialDateTime={initialDateTime}
        timeZone={selectedTimeZone}
        timeZoneLabel={selectedTimeZoneLabel}
      />
    </form>
  );
}
