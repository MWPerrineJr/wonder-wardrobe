import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { freeSlotTimes } from "./slot-grid.ts";

const base = {
  date: "2026-11-02",
  tzOffsetMinutes: 0,
  openMinutes: 9 * 60,
  closeMinutes: 11 * 60,
  durationMinutes: 60,
  nowMs: Date.parse("2026-11-02T08:00:00Z"),
  activeProviderCount: 1,
  providerId: "p1",
};

describe("walk-in slot list only offers free times", () => {
  it("lists every opening when the calendar is empty", () => {
    assert.deepEqual(freeSlotTimes({ ...base, occupying: [] }), [
      "09:00", "09:15", "09:30", "09:45", "10:00",
    ]);
  });

  it("hides times that overlap an existing appointment", () => {
    const slots = freeSlotTimes({
      ...base,
      occupying: [{
        providerId: "p1",
        start: Date.parse("2026-11-02T09:30:00Z"),
        end: Date.parse("2026-11-02T10:30:00Z"),
        status: "confirmed",
        holdExpiresAt: null,
      }],
    });
    assert.deepEqual(slots, []);
  });

  it("hides times already in the past", () => {
    const slots = freeSlotTimes({ ...base, occupying: [], nowMs: Date.parse("2026-11-02T09:40:00Z") });
    assert.deepEqual(slots, ["09:45", "10:00"]);
  });
});
