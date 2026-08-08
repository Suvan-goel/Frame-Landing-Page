"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminTimeZone } from "@/lib/admin-time-zone";

export function AdminTimeZoneClock({
  label,
  timeZone,
}: {
  label: string;
  timeZone: AdminTimeZone;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone,
      }),
    [timeZone],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone,
        timeZoneName: "short",
      }),
    [timeZone],
  );

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, [timeZone]);

  return (
    <div
      className="admin-timezone-clock"
      aria-label={`Current time in ${label}`}
      aria-live="off"
    >
      <span>Current time</span>
      <strong>
        <time dateTime={now?.toISOString()}>
          {now ? timeFormatter.format(now) : "--:--:--"}
        </time>
      </strong>
      <small>{now ? `${label} · ${dateFormatter.format(now)}` : label}</small>
    </div>
  );
}
