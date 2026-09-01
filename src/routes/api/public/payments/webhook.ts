import { createFileRoute } from "@tanstack/react-router";

import { type StripeEnv, type StripeWebhookEvent, verifyWebhook } from "@/lib/stripe.server";

// Payments webhook. Registered automatically per environment
// (?env=sandbox | ?env=live). Security comes from verifying the payment
// provider's signature on every request — never from session auth.
//
// Durability rules:
//  - Every event is recorded in public.payment_events before it is applied, so a
//    replayed delivery is a no-op instead of a second financial effect.
//  - A failed database write returns 5xx so the provider retries. Never 2xx on
//    a write we could not complete.
//  - Only signature/payload problems return 400 (a retry would never help).

type Supabase = Awaited<ReturnType<typeof getSupabase>>;

async function getSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Throws when a write failed or matched nothing it was required to match. */
function assertWrite(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function upsertSubscription(supabase: Supabase, subscription: any, env: StripeEnv) {
  const shopId = subscription.metadata?.shop_id;
  if (!shopId) {
    // Nothing to attach this to — not retryable, so treat as handled.
    console.error("[payments-webhook] subscription without shop_id metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const eventStamp = isoFromUnix(subscription.created) ?? new Date().toISOString();

  // Never let an older event overwrite newer state.
  const { data: existing, error: readErr } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, updated_at, status")
    .eq("shop_id", shopId)
    .eq("environment", env)
    .maybeSingle();
  assertWrite(readErr, "read subscription");
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== subscription.id &&
    existing.updated_at > eventStamp
  ) {
    console.log("[payments-webhook] ignoring stale subscription event", subscription.id);
    return;
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      shop_id: shopId,
      environment: env,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan: "analytics",
      status: subscription.status,
      price_id: priceId,
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,environment" },
  );
  assertWrite(error, "upsert subscription");
}

async function markCanceled(supabase: Supabase, subscription: any, env: StripeEnv) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  assertWrite(error, "cancel subscription");
}

/**
 * Client prepaid a booking through the shop's own connected account.
 * The session is only trusted when it reports paid and its metadata matches the
 * stored booking (id, shop, and the checkout session we created).
 */
async function markBookingPaid(supabase: Supabase, session: any) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;

  if (session.payment_status && session.payment_status !== "paid") {
    console.log("[payments-webhook] session not paid yet", session.id, session.payment_status);
    return;
  }

  const { data: booking, error: readErr } = await supabase
    .from("bookings")
    .select("id, shop_id, payment_status, price_cents, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  assertWrite(readErr, "read booking");
  if (!booking) {
    console.error("[payments-webhook] unknown booking in session metadata", bookingId);
    return;
  }
  if (session.metadata?.shop_id && session.metadata.shop_id !== booking.shop_id) {
    console.error("[payments-webhook] shop mismatch for booking", bookingId);
    return;
  }
  if (booking.stripe_checkout_session_id && booking.stripe_checkout_session_id !== session.id) {
    console.error("[payments-webhook] session mismatch for booking", bookingId);
    return;
  }
  if (booking.payment_status === "paid") return; // already applied

  const amountPaid = session.amount_total ?? 0;
  if (amountPaid <= 0 || amountPaid > booking.price_cents) {
    console.error("[payments-webhook] unexpected amount for booking", bookingId, amountPaid);
    return;
  }
  if (session.currency && session.currency !== "usd") {
    console.error("[payments-webhook] unexpected currency", session.currency);
    return;
  }

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      amount_paid_cents: amountPaid,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: "confirmed",
      hold_expires_at: null,
    })
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();
  assertWrite(error, "mark booking paid");
  if (!updated) throw new Error("mark booking paid: no row updated");
}

/** Checkout abandoned or expired — release the held slot, never a paid one. */
async function releaseBooking(supabase: Supabase, session: any) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: "failed", status: "cancelled", hold_expires_at: null })
    .eq("id", bookingId)
    .eq("payment_status", "awaiting_payment");
  assertWrite(error, "release booking");
}

/** Connected shop account finished (or changed) onboarding. */
async function syncPayoutAccount(supabase: Supabase, account: any, env: StripeEnv) {
  const { error } = await supabase
    .from("shop_payout_accounts")
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id)
    .eq("environment", env);
  assertWrite(error, "sync payout account");
}

async function applyEvent(supabase: Supabase, event: StripeWebhookEvent, env: StripeEnv) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(supabase, event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await markCanceled(supabase, event.data.object, env);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await markBookingPaid(supabase, event.data.object);
      break;
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await releaseBooking(supabase, event.data.object);
      break;
    case "account.updated":
      await syncPayoutAccount(supabase, event.data.object, env);
      break;
    default:
      console.log("[payments-webhook] unhandled event", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[payments-webhook] invalid env parameter:", rawEnv);
          return new Response("Invalid env parameter", { status: 400 });
        }
        const env: StripeEnv = rawEnv;

        let event: StripeWebhookEvent;
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("[payments-webhook] verification failed", e);
          return new Response("Webhook signature verification failed", { status: 400 });
        }
        if (!event?.id || !event?.type) {
          return new Response("Malformed event", { status: 400 });
        }

        const supabase = await getSupabase();

        // Claim the event. A duplicate delivery either loses the race here or
        // finds an already-processed row and exits without repeating the work.
        const { error: claimErr } = await supabase.from("payment_events").insert({
          event_id: event.id,
          event_type: event.type,
          environment: env,
          status: "processing",
        });

        if (claimErr) {
          const { data: prior, error: readErr } = await supabase
            .from("payment_events")
            .select("id, status, attempts")
            .eq("event_id", event.id)
            .eq("environment", env)
            .maybeSingle();
          if (readErr || !prior) {
            console.error("[payments-webhook] could not record event", claimErr.message);
            return new Response("Ledger unavailable", { status: 500 });
          }
          if (prior.status === "processed") {
            return Response.json({ received: true, duplicate: true });
          }
          await supabase
            .from("payment_events")
            .update({ status: "processing", attempts: prior.attempts + 1 })
            .eq("id", prior.id);
        }

        try {
          await applyEvent(supabase, event, env);
          await supabase
            .from("payment_events")
            .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
            .eq("event_id", event.id)
            .eq("environment", env);
          return Response.json({ received: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[payments-webhook] processing failed", event.type, message);
          await supabase
            .from("payment_events")
            .update({ status: "failed", last_error: message.slice(0, 500) })
            .eq("event_id", event.id)
            .eq("environment", env);
          // 5xx so the provider retries this event.
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
