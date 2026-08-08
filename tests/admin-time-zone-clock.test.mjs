import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows a live clock for the applied admin time zone", async () => {
  const [form, clock, styles] = await Promise.all([
    readFile(
      new URL("../app/components/admin-time-zone-form.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/admin-time-zone-clock.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/admin-workspace.css", import.meta.url), "utf8"),
  ]);

  assert.match(form, /AdminTimeZoneClock/);
  assert.match(form, /timeZone=\{selectedTimeZone\}/);
  assert.doesNotMatch(form, /Showing lead times in/);
  assert.match(clock, /^"use client";/);
  assert.match(clock, /new Intl\.DateTimeFormat\("en-GB"/);
  assert.match(clock, /second: "2-digit"/);
  assert.match(clock, /timeZone,/);
  assert.match(clock, /window\.setInterval\(updateClock, 1000\)/);
  assert.match(clock, /Current time/);
  assert.match(styles, /\.admin-timezone-clock\s*\{/);
  assert.match(styles, /font-variant-numeric: tabular-nums/);
});
