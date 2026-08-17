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
