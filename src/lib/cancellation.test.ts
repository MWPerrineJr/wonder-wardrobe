import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canReschedule,
  DEFAULT_CANCELLATION_POLICY,
  refundForCancellation,
} from "./cancellation.ts";

const policy = DEFAULT_CANCELLATION_POLICY;
const start = "2026-09-02T18:00:00.000Z";

describe("refundForCancellation", () => {
  it("refunds nothing when no money was collected", () => {
    const now = Date.parse("2026-09-01T18:00:00.000Z");
    assert.deepEqual(refundForCancellation(0, start, policy, now), {
      refundCents: 0,
      feeCents: 0,
      free: true,
    });
  });

  it("refunds the full deposit inside the free window", () => {
    const now = Date.parse("2026-09-01T17:00:00.000Z");
    assert.deepEqual(refundForCancellation(2500, start, policy, now), {
      refundCents: 2500,
      feeCents: 0,
      free: true,
    });
  });

  it("keeps the late-cancel fee after the free window", () => {
    const now = Date.parse("2026-09-02T12:00:00.000Z");
    assert.deepEqual(refundForCancellation(2500, start, policy, now), {
      refundCents: 1250,
      feeCents: 1250,
      free: false,
    });
  });

  it("keeps the whole deposit when the late fee is 100 percent", () => {
    const now = Date.parse("2026-09-02T12:00:00.000Z");
    assert.deepEqual(refundForCancellation(2500, start, { ...policy, lateFeePercent: 100 }, now), {
      refundCents: 0,
      feeCents: 2500,
      free: false,
    });
  });
});

describe("canReschedule", () => {
  it("allows a move only when the shop permits it and enough notice remains", () => {
    const now = Date.parse("2026-09-01T17:00:00.000Z");
    assert.equal(canReschedule(start, policy, now), true);
    assert.equal(canReschedule(start, { ...policy, rescheduleAllowed: false }, now), false);
    assert.equal(canReschedule(start, policy, Date.parse("2026-09-02T12:00:00.000Z")), false);
  });
});
