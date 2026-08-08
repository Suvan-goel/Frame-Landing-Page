"use client";

import { useEffect, useMemo, useState } from "react";

type TimeZoneClockProps = {
  initialDateTime: string;
  timeZone: string;
  timeZoneLabel: string;
};

export function TimeZoneClock({
  initialDateTime,
  timeZone,
  timeZoneLabel,
}: TimeZoneClockProps) {
  const [now, setNow] = useState(() => new Date(initialDateTime));
  const formatters = useMemo(
    () => ({
      date: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone,
        weekday: "short",
      }),
      time: new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        second: "2-digit",
        timeZone,
      }),
    }),
    [timeZone],
  );

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1_000);

    return () => window.clearInterval(interval);
  }, [timeZone]);

  return (
    <aside className="admin-timezone-clock" aria-label={`Current time in ${timeZoneLabel}`}>
      <span>Current time</span>
      <strong>
        <time dateTime={now.toISOString()}>{formatters.time.format(now)}</time>
      </strong>
      <small>{formatters.date.format(now)} · {timeZoneLabel}</small>
    </aside>
  );
}
