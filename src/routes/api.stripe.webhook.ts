import { createFileRoute } from "@tanstack/react-router";

// Stripe webhook receiver. Configure in the Stripe dashboard:
//   endpoint: {APP_URL}/api/stripe/webhook
//   events:  checkout.session.completed, customer.subscription.created,
//            customer.subscription.updated, customer.subscription.deleted
//
// Signature is verified against STRIPE_WEBHOOK_SECRET before anything is
// trusted; the subscriptions table is written with the service-role client.

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { verifyStripeEvent, stripeRequest, subscriptionPeriodEnd } =
          await import("@/lib/stripe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        type StripeSubscription = import("@/lib/stripe.server").StripeSubscription;

        const rawBody = await request.text();
        const event = await verifyStripeEvent(rawBody, request.headers.get("stripe-signature"));
        if (!event) {
          return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 });
        }

        const type = event.type as string;
        const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object;

        async function upsertFromSubscription(sub: StripeSubscription) {
          const shopId = sub.metadata?.shop_id;
          if (!shopId) {
            console.error("[stripe-webhook] subscription without shop_id metadata", sub.id);
            return;
          }
          const { error } = await supabaseAdmin.from("subscriptions").upsert(
            {
              shop_id: shopId,
              stripe_customer_id: sub.customer,
              stripe_subscription_id: sub.id,
              status: sub.status,
              price_id: sub.items?.data?.[0]?.price?.id ?? null,
              current_period_end: subscriptionPeriodEnd(sub),
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
            },
            { onConflict: "shop_id" },
          );
          if (error) console.error("[stripe-webhook] upsert failed", error.message);
        }

        try {
          switch (type) {
            case "checkout.session.completed": {
              const subscriptionId = object?.subscription as string | null;
              if (subscriptionId) {
                const sub = await stripeRequest<StripeSubscription>(
                  "GET",
                  `/subscriptions/${subscriptionId}`,
                );
                await upsertFromSubscription(sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await upsertFromSubscription(object as unknown as StripeSubscription);
              break;
            }
            default:
              // Acknowledge everything else so Stripe stops retrying.
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", err);
          // 500 -> Stripe retries with backoff; safe because upserts are idempotent.
          return new Response(JSON.stringify({ error: "handler failure" }), { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
