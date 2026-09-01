import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canReserveSlot,
  occupiesSlot,
  occupyingBookings,
  rangesOverlap,
  shouldExpireHold,
  type OccupyingBooking,
} from "./booking-hold.ts";

const noon = Date.parse("2026-09-01T12:00:00.000Z");
const one = Date.parse("2026-09-01T13:00:00.000Z");
const two = Date.parse("2026-09-01T14:00:00.000Z");
const now = Date.parse("2026-09-01T11:00:00.000Z");

function booking(
  overrides: Partial<OccupyingBooking> & Pick<OccupyingBooking, "providerId">,
): OccupyingBooking {
  return {
    start: noon,
    end: one,
    status: "pending",
    holdExpiresAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("occupiesSlot", () => {
  it("counts pending and confirmed rows that have no expiry", () => {
    assert.equal(occupiesSlot("pending", null, now), true);
    assert.equal(occupiesSlot("confirmed", null, now), true);
    assert.equal(occupiesSlot("cancelled", null, now), false);
  });

  it("stops counting a prepaid hold after hold_expires_at", () => {
    assert.equal(occupiesSlot("pending", "2026-09-01T12:00:00.000Z", now), true);
    assert.equal(occupiesSlot("pending", "2026-09-01T10:00:00.000Z", now), false);
  });
});

describe("canReserveSlot", () => {
  it("rejects a second request for the same provider and time after the first commits", () => {
    const committed: OccupyingBooking[] = [];
    const tryReserve = (providerId: string) => {
      const result = canReserveSlot({
        existing: occupyingBookings(committed, now),
        activeProviderCount: 2,
        providerId,
        start: noon,
        end: one,
        nowMs: now,
      });
      if (result.ok) committed.push(booking({ providerId }));
      return result;
    };
    assert.deepEqual(tryReserve("prov-a"), { ok: true });
    assert.deepEqual(tryReserve("prov-a"), { ok: false, reason: "provider_busy" });
  });

  it("allows two providers to take overlapping times when the shop has capacity", () => {
    const first = booking({ providerId: "prov-a" });
    const second = canReserveSlot({
      existing: occupyingBookings([first], now),
      activeProviderCount: 2,
      providerId: "prov-b",
      start: noon,
      end: one,
      nowMs: now,
    });
    assert.deepEqual(second, { ok: true });
  });

  it("lets an expired hold be reserved again by another request", () => {
    const expired = booking({
      providerId: "prov-a",
      holdExpiresAt: "2026-09-01T10:00:00.000Z",
    });
    const second = canReserveSlot({
      existing: occupyingBookings([expired], now),
      activeProviderCount: 1,
      providerId: "prov-a",
      start: noon,
      end: one,
      nowMs: now,
    });
    assert.deepEqual(second, { ok: true });
  });

  it("treats a no-provider-preference booking as one chair of shop capacity", () => {
    const unassigned = booking({ providerId: null });
    const taken = occupyingBookings([unassigned], now);

    assert.deepEqual(
      canReserveSlot({
        existing: taken,
        activeProviderCount: 1,
        providerId: null,
        start: noon,
        end: one,
        nowMs: now,
      }),
      { ok: false, reason: "shop_full" },
    );

    assert.deepEqual(
      canReserveSlot({
        existing: taken,
        activeProviderCount: 1,
        providerId: "prov-a",
        start: noon,
        end: one,
        nowMs: now,
      }),
      { ok: false, reason: "shop_full" },
    );

    assert.deepEqual(
      canReserveSlot({
        existing: taken,
        activeProviderCount: 2,
        providerId: "prov-a",
        start: noon,
        end: one,
        nowMs: now,
      }),
      { ok: true },
    );
  });

  it("rejects an unassigned booking when every chair is already assigned", () => {
    const a = booking({ providerId: "prov-a" });
    const b = booking({ providerId: "prov-b" });
    assert.deepEqual(
      canReserveSlot({
        existing: occupyingBookings([a, b], now),
        activeProviderCount: 2,
        providerId: null,
        start: noon,
        end: one,
        nowMs: now,
      }),
      { ok: false, reason: "shop_full" },
    );
  });

  it("does not treat non-overlapping times as a conflict", () => {
    const first = booking({ providerId: "prov-a", start: noon, end: one });
    assert.equal(rangesOverlap(noon, one, one, two), false);
    assert.deepEqual(
      canReserveSlot({
        existing: occupyingBookings([first], now),
        activeProviderCount: 1,
        providerId: "prov-a",
        start: one,
        end: two,
        nowMs: now,
      }),
      { ok: true },
    );
  });
});

describe("shouldExpireHold", () => {
  it("expires only unpaid pending holds past hold_expires_at", () => {
    assert.equal(shouldExpireHold("pending", "awaiting_payment", "2026-09-01T10:00:00.000Z", now), true);
    assert.equal(shouldExpireHold("pending", "awaiting_payment", "2026-09-01T12:00:00.000Z", now), false);
    assert.equal(shouldExpireHold("pending", "not_required", "2026-09-01T10:00:00.000Z", now), false);
    assert.equal(shouldExpireHold("confirmed", "paid", "2026-09-01T10:00:00.000Z", now), false);
  });
});
