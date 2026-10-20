import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeClients } from "./clients.ts";

const now = new Date("2026-10-20T12:00:00Z");
const row = (o: Record<string, unknown>) => ({
  customer_id: "a",
  customer_name: "Ana Diaz",
  customer_phone: null,
  starts_at: "2026-10-01T10:00:00Z",
  status: "completed",
  price_cents: 5000,
  ...o,
});

describe("summarizeClients", () => {
  it("counts only completed visits toward spend", () => {
    const [c] = summarizeClients(
      [row({}), row({ status: "confirmed", starts_at: "2026-09-01T10:00:00Z" })],
      now,
    );
    assert.equal(c.visits, 2);
    assert.equal(c.total_spent_cents, 5000);
  });

  it("flags a client lapsed after 45 days with no upcoming booking", () => {
    const [c] = summarizeClients([row({ starts_at: "2026-09-04T12:00:00Z" })], now);
    assert.equal(c.lapsed, true);
  });

  it("does not flag lapsed at 44 days", () => {
    const [c] = summarizeClients([row({ starts_at: "2026-09-06T12:00:00Z" })], now);
    assert.equal(c.lapsed, false);
  });

  it("does not flag lapsed when a future booking exists", () => {
    const [c] = summarizeClients(
      [
        row({ starts_at: "2026-08-01T12:00:00Z" }),
        row({ status: "confirmed", starts_at: "2026-11-01T12:00:00Z" }),
      ],
      now,
    );
    assert.equal(c.lapsed, false);
  });
});
