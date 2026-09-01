import type { StripeEnv } from "./stripe.server.ts";
import { enqueueCalendarSync } from "./booking-calendar-outbox.ts";
import { configuredPaymentsEnv, PaymentsConfigError } from "./payments-env.ts";
import {
  assertBookingPaymentMatches,
  canReleaseBookingHold,
  checkoutMetadata,
  httpStatusForWebhookError,
  ledgerDecision,
  parseStripeEnv,
  paymentIntentId,
  sanitizeWebhookError,
  shouldApplySubscriptionEvent,
  shouldCaptureBookingPayment,
  shouldReleaseBookingHold,
  WebhookError,
  type BookingLike,
  type CheckoutSessionLike,
} from "./payments-webhook.logic.ts";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function requireOk(result: { error: { message: string } | null }, message: string) {
  if (result.error) throw new WebhookError(result.error.message || message, "retryable");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function finishEvent(
  admin: Admin,
  eventId: string,
  status: "completed" | "failed" | "ignored",
  lastError?: string | null,
) {
  const result = await admin
    .from("stripe_webhook_events")
    .update({
      status,
      last_error: lastError ?? null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId)
    .select("stripe_event_id");
  requireOk(result, "Could not finalize webhook event");
  if (!result.data?.length) throw new WebhookError("Webhook event row missing on finalize", "retryable");
}

async function claimEvent(admin: Admin, event: StripeEvent, env: StripeEnv): Promise<"skip" | "process"> {
  const { data: existing, error } = await admin
    .from("stripe_webhook_events")
    .select("stripe_event_id, status, updated_at, attempts")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (error) throw new WebhookError(error.message, "retryable");

  const decision = ledgerDecision(
    existing
      ? {
          stripe_event_id: existing.stripe_event_id,
          status: existing.status as "processing" | "completed" | "failed" | "ignored",
          updated_at: existing.updated_at,
        }
      : null,
    Date.now(),
  );
  if (decision === "skip") return "skip";
  if (decision === "busy") {
    throw new WebhookError("Event is already being processed", "retryable", true);
  }

  if (!existing) {
    const inserted = await admin.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      environment: env,
      event_type: event.type,
      stripe_created_at: isoFromUnix(event.created) ?? new Date().toISOString(),
      status: "processing",
      attempts: 1,
    });
    if (inserted.error) {
      if (inserted.error.code === "23505") {
        throw new WebhookError("Event is already being processed", "retryable", true);
      }
      throw new WebhookError(inserted.error.message, "retryable");
    }
    return "process";
  }

  const nextAttempts = (existing.attempts ?? 1) + 1;
  const updated = await admin
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempts: nextAttempts,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", event.id)
    .select("stripe_event_id");
  requireOk(updated, "Could not claim webhook event");
  if (!updated.data?.length) {
    throw new WebhookError("Could not claim webhook event", "retryable", true);
  }
  return "process";
}

async function loadBooking(admin: Admin, bookingId: string): Promise<BookingLike> {
  const result = await admin
    .from("bookings")
    .select(
      "id, shop_id, payment_status, status, stripe_checkout_session_id, amount_due_cents, payment_environment",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (result.error) throw new WebhookError(result.error.message, "retryable");
  if (!result.data) throw new WebhookError("Booking not found for checkout metadata", "permanent");
  return result.data as BookingLike;
}

async function markBookingPaid(
  admin: Admin,
  env: StripeEnv,
  eventType: string,
  session: CheckoutSessionLike,
) {
  if (!shouldCaptureBookingPayment(eventType, session)) return;
  const meta = checkoutMetadata(session);
  if (!meta.bookingId) {
    throw new WebhookError("Checkout is missing booking_id metadata", "permanent");
  }

  const booking = await loadBooking(admin, meta.bookingId);
  assertBookingPaymentMatches(env, session, booking);

  const result = await admin
    .from("bookings")
    .update({
      payment_status: "paid",
      amount_paid_cents: typeof session.amount_total === "number" ? session.amount_total : 0,
      stripe_payment_intent_id: paymentIntentId(session),
      status: "confirmed",
      hold_expires_at: null,
    })
    .eq("id", booking.id)
    .eq("shop_id", booking.shop_id)
    .eq("stripe_checkout_session_id", session.id as string)
    .select("id");
  requireOk(result, "Booking paid update failed");
  if (!result.data?.length) throw new WebhookError("Booking paid update matched zero rows", "retryable");
  await enqueueCalendarSync(admin, booking.id);
}

async function releaseBooking(admin: Admin, env: StripeEnv, eventType: string, session: CheckoutSessionLike) {
  if (!shouldReleaseBookingHold(eventType)) return;
  const meta = checkoutMetadata(session);
  if (!meta.bookingId) {
    throw new WebhookError("Checkout is missing booking_id metadata", "permanent");
  }

  const booking = await loadBooking(admin, meta.bookingId);
  assertBookingPaymentMatches(env, session, booking);
  if (!canReleaseBookingHold(booking)) return;

  const result = await admin
    .from("bookings")
    .update({ payment_status: "failed", status: "cancelled", hold_expires_at: null })
    .eq("id", booking.id)
    .eq("shop_id", booking.shop_id)
    .eq("stripe_checkout_session_id", session.id as string)
    .eq("payment_status", "awaiting_payment")
    .eq("status", "pending")
    .select("id");
  requireOk(result, "Booking release failed");
}

async function upsertSubscription(
  admin: Admin,
  env: StripeEnv,
  eventCreated: number,
  subscription: Record<string, unknown>,
) {
  const metadata = asRecord(subscription.metadata);
  const shopId = typeof metadata.shop_id === "string" ? metadata.shop_id : null;
  if (!shopId) {
    throw new WebhookError("Subscription is missing shop_id metadata", "permanent");
  }

  const shop = await admin.from("shops").select("id").eq("id", shopId).maybeSingle();
  if (shop.error) throw new WebhookError(shop.error.message, "retryable");
  if (!shop.data) throw new WebhookError("Subscription shop_id does not match a shop", "permanent");

  const existing = await admin
    .from("subscriptions")
    .select("id, last_stripe_event_at, stripe_customer_id")
    .eq("shop_id", shopId)
    .eq("environment", env)
    .maybeSingle();
  if (existing.error) throw new WebhookError(existing.error.message, "retryable");
  if (!shouldApplySubscriptionEvent(eventCreated, existing.data)) return;

  if (
    existing.data?.stripe_customer_id &&
    typeof subscription.customer === "string" &&
    existing.data.stripe_customer_id !== subscription.customer
  ) {
    throw new WebhookError("Subscription customer does not match the shop billing row", "permanent");
  }

  const items = asRecord(subscription.items);
  const itemList = Array.isArray(items.data) ? items.data : [];
  const item = asRecord(itemList[0]);
  const price = asRecord(item.price);
  const priceId =
    (typeof price.lookup_key === "string" && price.lookup_key) ||
    (typeof asRecord(price.metadata).lovable_external_id === "string" &&
      (asRecord(price.metadata).lovable_external_id as string)) ||
    (typeof price.id === "string" ? price.id : null);
  const periodEnd =
    (typeof item.current_period_end === "number" ? item.current_period_end : null) ??
    (typeof subscription.current_period_end === "number" ? subscription.current_period_end : null);

  const payload = {
    shop_id: shopId,
    environment: env,
    stripe_customer_id: String(subscription.customer ?? ""),
    stripe_subscription_id: String(subscription.id ?? ""),
    plan: "analytics",
    status: String(subscription.status ?? "incomplete"),
    price_id: priceId,
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    last_stripe_event_at: isoFromUnix(eventCreated),
    updated_at: new Date().toISOString(),
  };

  const result = await admin.from("subscriptions").upsert(payload, { onConflict: "shop_id,environment" }).select("id");
  requireOk(result, "Subscription upsert failed");
  if (!result.data?.length) throw new WebhookError("Subscription upsert matched zero rows", "retryable");
}

async function markCanceled(admin: Admin, env: StripeEnv, eventCreated: number, subscription: Record<string, unknown>) {
  const subId = typeof subscription.id === "string" ? subscription.id : null;
  if (!subId) throw new WebhookError("Subscription id missing", "permanent");

  const existing = await admin
    .from("subscriptions")
    .select("id, last_stripe_event_at, status")
    .eq("stripe_subscription_id", subId)
    .eq("environment", env)
    .maybeSingle();
  if (existing.error) throw new WebhookError(existing.error.message, "retryable");
  if (!existing.data) return;
  if (!shouldApplySubscriptionEvent(eventCreated, existing.data)) return;

  const result = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      last_stripe_event_at: isoFromUnix(eventCreated),
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.data.id)
    .select("id");
  requireOk(result, "Subscription cancel update failed");
  if (!result.data?.length) throw new WebhookError("Subscription cancel matched zero rows", "retryable");
}

async function syncPayoutAccount(admin: Admin, env: StripeEnv, account: Record<string, unknown>) {
  const accountId = typeof account.id === "string" ? account.id : null;
  if (!accountId) throw new WebhookError("Connected account id missing", "permanent");

  const result = await admin
    .from("shop_payout_accounts")
    .update({
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId)
    .eq("environment", env)
    .select("id");
  requireOk(result, "Payout account sync failed");
}

async function dispatch(admin: Admin, env: StripeEnv, event: StripeEvent) {
  const object = asRecord(event.data.object);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(admin, env, event.created, object);
      return;
    case "customer.subscription.deleted":
      await markCanceled(admin, env, event.created, object);
      return;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await markBookingPaid(admin, env, event.type, object);
      return;
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await releaseBooking(admin, env, event.type, object);
      return;
    case "account.updated":
      await syncPayoutAccount(admin, env, object);
      return;
    default:
      return;
  }
}

export async function handlePaymentsWebhook(
  request: Request,
  verify: (req: Request, env: StripeEnv) => Promise<StripeEvent>,
  admin?: Admin,
  deploymentEnv?: StripeEnv,
): Promise<Response> {
  let queryEnv: StripeEnv;
  try {
    queryEnv = parseStripeEnv(new URL(request.url).searchParams.get("env"));
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid env", { status: 400 });
  }

  let env: StripeEnv;
  try {
    env = deploymentEnv ?? configuredPaymentsEnv();
  } catch (error) {
    const message =
      error instanceof PaymentsConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Payments are not configured";
    return new Response(message, { status: 503 });
  }
  if (queryEnv !== env) {
    return new Response(`Webhook env=${queryEnv} does not match PAYMENTS_ENV=${env}`, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = await verify(request, env);
  } catch (error) {
    console.error("[payments-webhook] signature", sanitizeWebhookError(error));
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = admin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  try {
    const claim = await claimEvent(supabaseAdmin, event, env);
    if (claim === "skip") return Response.json({ received: true, duplicate: true });

    await dispatch(supabaseAdmin, env, event);
    await finishEvent(supabaseAdmin, event.id, "completed");
    return Response.json({ received: true });
  } catch (error) {
    const sanitized = sanitizeWebhookError(error);
    console.error("[payments-webhook]", sanitized);
    const webhookError = error instanceof WebhookError ? error : null;
    if (!webhookError?.skipFinalize) {
      try {
        await finishEvent(
          supabaseAdmin,
          event.id,
          webhookError?.kind === "permanent" ? "ignored" : "failed",
          sanitized,
        );
      } catch (finishError) {
        console.error("[payments-webhook] finalize", sanitizeWebhookError(finishError));
      }
    }
    if (webhookError?.kind === "permanent") return Response.json({ received: true, ignored: true });
    return new Response("Webhook error", { status: httpStatusForWebhookError(error) });
  }
}

export { parseStripeEnv };
