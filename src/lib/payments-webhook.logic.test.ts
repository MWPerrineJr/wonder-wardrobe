import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertBookingPaymentMatches,
  canReleaseBookingHold,
  httpStatusForWebhookError,
  ledgerDecision,
  shouldApplySubscriptionEvent,
  shouldCaptureBookingPayment,
  WebhookError,
  type BookingLike,
} from "./payments-webhook.logic.ts";

const booking: BookingLike = {
  id: "book-1",
  shop_id: "shop-1",
  payment_status: "awaiting_payment",
  status: "pending",
  stripe_checkout_session_id: "cs_1",
  amount_due_cents: 2500,
  payment_environment: "sandbox",
};

describe("shouldCaptureBookingPayment", () => {
  it("does not confirm an unpaid asynchronous checkout", () => {
    assert.equal(
      shouldCaptureBookingPayment("checkout.session.completed", {
        mode: "payment",
        payment_status: "unpaid",
      }),
      false,
    );
  });

  it("captures paid completed sessions and async successes", () => {
    assert.equal(
      shouldCaptureBookingPayment("checkout.session.completed", {
        mode: "payment",
        payment_status: "paid",
      }),
      true,
    );
    assert.equal(
      shouldCaptureBookingPayment("checkout.session.async_payment_succeeded", {
        mode: "payment",
        payment_status: "paid",
      }),
      true,
    );
  });

  it("ignores subscription checkouts", () => {
    assert.equal(
      shouldCaptureBookingPayment("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
      }),
      false,
    );
  });
});

describe("booking verification", () => {
  it("rejects metadata that would update an unrelated booking", () => {
    assert.throws(
      () =>
        assertBookingPaymentMatches(
          "sandbox",
          {
            id: "cs_1",
            currency: "usd",
            amount_total: 2500,
            metadata: { booking_id: "book-OTHER", shop_id: "shop-1" },
          },
          booking,
        ),
      WebhookError,
    );
  });

  it("accepts a matching paid session", () => {
    assert.doesNotThrow(() =>
      assertBookingPaymentMatches(
        "sandbox",
        {
          id: "cs_1",
          currency: "usd",
          amount_total: 2500,
          metadata: { booking_id: "book-1", shop_id: "shop-1" },
        },
        booking,
      ),
    );
  });

  it("rejects amount and environment mismatches", () => {
    assert.throws(
      () =>
        assertBookingPaymentMatches(
          "sandbox",
          {
            id: "cs_1",
            currency: "usd",
            amount_total: 9999,
            metadata: { booking_id: "book-1", shop_id: "shop-1" },
          },
          booking,
        ),
      WebhookError,
    );
    assert.throws(
      () =>
        assertBookingPaymentMatches(
          "live",
          {
            id: "cs_1",
            currency: "usd",
            amount_total: 2500,
            metadata: { booking_id: "book-1", shop_id: "shop-1" },
          },
          booking,
        ),
      WebhookError,
    );
  });
});

describe("booking hold release", () => {
  it("does not cancel an already-paid booking", () => {
    assert.equal(
      canReleaseBookingHold({ ...booking, payment_status: "paid", status: "confirmed" }),
      false,
    );
  });

  it("releases an unpaid hold", () => {
    assert.equal(canReleaseBookingHold(booking), true);
  });
});

describe("subscription event ordering", () => {
  it("keeps the newest valid state when events arrive out of order", () => {
    const newer = "2026-09-01T12:00:00.000Z";
    assert.equal(shouldApplySubscriptionEvent(Math.floor(Date.parse(newer) / 1000) - 60, { last_stripe_event_at: newer }), false);
    assert.equal(shouldApplySubscriptionEvent(Math.floor(Date.parse(newer) / 1000) + 60, { last_stripe_event_at: newer }), true);
  });
});

describe("ledger and HTTP mapping", () => {
  it("treats a completed duplicate delivery as a skip", () => {
    assert.equal(
      ledgerDecision(
        {
          stripe_event_id: "evt_1",
          status: "completed",
          updated_at: "2026-09-01T12:00:00.000Z",
        },
        Date.parse("2026-09-01T12:01:00.000Z"),
      ),
      "skip",
    );
  });

  it("returns busy for a fresh in-flight event and reprocesses stale or failed rows", () => {
    const updatedAt = "2026-09-01T12:00:00.000Z";
    assert.equal(
      ledgerDecision(
        { stripe_event_id: "evt_1", status: "processing", updated_at: updatedAt },
        Date.parse("2026-09-01T12:01:00.000Z"),
      ),
      "busy",
    );
    assert.equal(
      ledgerDecision(
        { stripe_event_id: "evt_1", status: "processing", updated_at: updatedAt },
        Date.parse("2026-09-01T12:20:00.000Z"),
      ),
      "process",
    );
    assert.equal(
      ledgerDecision(
        { stripe_event_id: "evt_1", status: "failed", updated_at: updatedAt },
        Date.parse("2026-09-01T12:01:00.000Z"),
      ),
      "process",
    );
  });

  it("maps a database failure to 500 so Stripe retries", () => {
    assert.equal(httpStatusForWebhookError(new Error("upsert failed")), 500);
    assert.equal(
      httpStatusForWebhookError(new WebhookError("bad signature", "signature")),
      400,
    );
  });
});
