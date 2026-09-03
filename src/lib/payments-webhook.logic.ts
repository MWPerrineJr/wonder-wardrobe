import { redactUnknown } from "./log.ts";

export type StripeEnv = "sandbox" | "live";

export type WebhookKind = "signature" | "permanent" | "retryable";

export class WebhookError extends Error {
  readonly kind: WebhookKind;
  readonly skipFinalize: boolean;

  constructor(message: string, kind: WebhookKind, skipFinalize = false) {
    super(message);
    this.name = "WebhookError";
    this.kind = kind;
    this.skipFinalize = skipFinalize;
  }
}

export function httpStatusForWebhookError(error: unknown): 400 | 500 {
  if (error instanceof WebhookError && error.kind !== "retryable") return 400;
  return 500;
}

export function sanitizeWebhookError(error: unknown): string {
  return redactUnknown(error);
}

export type CheckoutSessionLike = {
  id?: unknown;
  mode?: unknown;
  payment_status?: unknown;
  currency?: unknown;
  amount_total?: unknown;
  payment_intent?: unknown;
  metadata?: unknown;
};

export type BookingLike = {
  id: string;
  shop_id: string;
  payment_status: string;
  status: string;
  stripe_checkout_session_id: string | null;
  amount_due_cents: number | null;
  payment_environment: string | null;
};

export type SubscriptionLike = {
  last_stripe_event_at: string | null;
};

export function parseStripeEnv(raw: string | null): StripeEnv {
  if (raw !== "sandbox" && raw !== "live") {
    throw new WebhookError("Query parameter env must be sandbox or live", "signature");
  }
  return raw;
}

function metadataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

export function checkoutMetadata(session: CheckoutSessionLike): {
  bookingId: string | null;
  shopId: string | null;
} {
  const meta = metadataRecord(session.metadata);
  return {
    bookingId: meta.booking_id ?? null,
    shopId: meta.shop_id ?? null,
  };
}

export function paymentIntentId(session: CheckoutSessionLike): string | null {
  const value = session.payment_intent;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

/** Paid only when Stripe reports paid (or no payment was required). Unpaid async methods wait. */
export function shouldCaptureBookingPayment(
  eventType: string,
  session: CheckoutSessionLike,
): boolean {
  if (session.mode === "subscription" || session.mode === "setup") return false;
  if (eventType === "checkout.session.async_payment_succeeded") return true;
  if (eventType !== "checkout.session.completed") return false;
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export function shouldReleaseBookingHold(eventType: string): boolean {
  return (
    eventType === "checkout.session.expired" ||
    eventType === "checkout.session.async_payment_failed"
  );
}

export function assertBookingPaymentMatches(
  env: StripeEnv,
  session: CheckoutSessionLike,
  booking: BookingLike,
): void {
  const meta = checkoutMetadata(session);
  if (!meta.bookingId || meta.bookingId !== booking.id) {
    throw new WebhookError("Checkout booking_id does not match the booking row", "permanent");
  }
  if (!meta.shopId || meta.shopId !== booking.shop_id) {
    throw new WebhookError("Checkout shop_id does not match the booking row", "permanent");
  }
  if (!session.id || session.id !== booking.stripe_checkout_session_id) {
    throw new WebhookError("Checkout session id does not match the booking row", "permanent");
  }
  if (booking.payment_environment && booking.payment_environment !== env) {
    throw new WebhookError("Payment environment does not match the booking row", "permanent");
  }
  const currency = typeof session.currency === "string" ? session.currency.toLowerCase() : "";
  if (currency && currency !== "usd") {
    throw new WebhookError("Unexpected checkout currency", "permanent");
  }
  if (
    booking.amount_due_cents != null &&
    typeof session.amount_total === "number" &&
    session.amount_total !== booking.amount_due_cents
  ) {
    throw new WebhookError("Checkout amount does not match the booking amount due", "permanent");
  }
}

/** Expired/failed checkout must not touch a booking that already collected funds. */
export function canReleaseBookingHold(booking: BookingLike): boolean {
  return booking.payment_status === "awaiting_payment" && booking.status === "pending";
}

export function shouldApplySubscriptionEvent(
  eventCreatedUnix: number,
  existing: SubscriptionLike | null,
): boolean {
  if (!existing?.last_stripe_event_at) return true;
  const last = Date.parse(existing.last_stripe_event_at);
  if (!Number.isFinite(last)) return true;
  return eventCreatedUnix * 1000 >= last;
}

export type LedgerStatus = "processing" | "completed" | "failed" | "ignored";

export type LedgerRow = {
  stripe_event_id: string;
  status: LedgerStatus;
  updated_at: string;
};

const STALE_PROCESSING_MS = 10 * 60 * 1000;

export function ledgerDecision(
  existing: LedgerRow | null,
  nowMs: number,
): "skip" | "process" | "busy" {
  if (!existing) return "process";
  if (existing.status === "completed" || existing.status === "ignored") return "skip";
  if (existing.status === "failed") return "process";
  const updated = Date.parse(existing.updated_at);
  if (Number.isFinite(updated) && nowMs - updated > STALE_PROCESSING_MS) return "process";
  return "busy";
}

export type OwnerPlanState = "none" | "trialing" | "active" | "past_due" | "canceled" | "lifetime";

/** Maps a Stripe subscription status onto the owner-signup registry plan state. */
export function ownerPlanState(status: string): OwnerPlanState {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}
