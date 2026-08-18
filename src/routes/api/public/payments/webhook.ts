import { createFileRoute } from "@tanstack/react-router";

import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

// Payments webhook. Registered automatically per environment
// (?env=sandbox | ?env=live). Security comes from verifying the payment
// provider's signature on every request — never from session auth.

async function getSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const shopId = subscription.metadata?.shop_id;
  if (!shopId) {
    console.error("[payments-webhook] subscription without shop_id metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const supabase = await getSupabase();
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
  if (error) console.error("[payments-webhook] upsert failed", error.message);
}

async function markCanceled(subscription: any, env: StripeEnv) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (error) console.error("[payments-webhook] cancel update failed", error.message);
}

/** Client prepaid a booking through the shop's own connected account. */
async function markBookingPaid(session: any) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      amount_paid_cents: session.amount_total ?? 0,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: "confirmed",
    })
    .eq("id", bookingId);
  if (error) console.error("[payments-webhook] booking paid update failed", error.message);
}

/** Checkout abandoned or expired — release the held slot. */
async function releaseBooking(session: any) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: "failed", status: "cancelled" })
    .eq("id", bookingId)
    .eq("payment_status", "awaiting_payment");
  if (error) console.error("[payments-webhook] booking release failed", error.message);
}

/** Connected shop account finished (or changed) onboarding. */
async function syncPayoutAccount(account: any, env: StripeEnv) {
  const supabase = await getSupabase();
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
  if (error) console.error("[payments-webhook] payout account sync failed", error.message);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[payments-webhook] invalid env parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;

        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscription(event.data.object, env);
              break;
            case "customer.subscription.deleted":
              await markCanceled(event.data.object, env);
              break;
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await markBookingPaid(event.data.object);
              break;
            case "checkout.session.expired":
            case "checkout.session.async_payment_failed":
              await releaseBooking(event.data.object);
              break;
            case "account.updated":
              await syncPayoutAccount(event.data.object, env);
              break;
            default:
              console.log("[payments-webhook] unhandled event", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[payments-webhook] error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
