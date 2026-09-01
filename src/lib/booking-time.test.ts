import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toInstant } from "./booking-time.ts";

describe("toInstant", () => {
  it("applies the caller's UTC offset to the local wall clock", () => {
    const easternWinter = toInstant("2026-01-15", "12:00", 300);
    assert.equal(easternWinter.toISOString(), "2026-01-15T17:00:00.000Z");

    const easternSummer = toInstant("2026-07-15", "12:00", 240);
    assert.equal(easternSummer.toISOString(), "2026-07-15T16:00:00.000Z");
  });

  it("keeps the skipped US spring-forward hour as a 60-minute UTC gap", () => {
    // 2026-03-08 is the second Sunday in March. America/New_York jumps from
    // 01:59 EST (UTC-5) to 03:00 EDT (UTC-4). The client sends the offset that
    // applies to that local wall clock, not a named time zone.
    const before = toInstant("2026-03-08", "01:30", 300);
    const after = toInstant("2026-03-08", "03:30", 240);
    assert.equal(after.getTime() - before.getTime(), 60 * 60_000);
    assert.equal(before.toISOString(), "2026-03-08T06:30:00.000Z");
    assert.equal(after.toISOString(), "2026-03-08T07:30:00.000Z");
  });

  it("keeps the repeated US fall-back hour as a 120-minute UTC gap", () => {
    // 2026-11-01 is the first Sunday in November. 01:30 can be EST or EDT;
    // the offset the client sends is what distinguishes them.
    const stillDaylight = toInstant("2026-11-01", "01:30", 240);
    const standard = toInstant("2026-11-01", "01:30", 300);
    assert.equal(standard.getTime() - stillDaylight.getTime(), 60 * 60_000);
  });
});
