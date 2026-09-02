import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { amountDueCents } from "./booking-money.ts";

describe("amountDueCents", () => {
  it("charges nothing when prepay is off", () => {
    assert.equal(amountDueCents(12_000, "off", 25), 0);
  });

  it("charges the full service price when prepay is full", () => {
    assert.equal(amountDueCents(12_000, "full", 25), 12_000);
  });

  it("charges the configured deposit percent, never less than 50 cents", () => {
    assert.equal(amountDueCents(10_000, "deposit", 25), 2_500);
    assert.equal(amountDueCents(100, "deposit", 10), 50);
    assert.equal(amountDueCents(10_000, "deposit", 0), 50);
  });
});
