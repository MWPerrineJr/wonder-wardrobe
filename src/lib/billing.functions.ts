import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Per-shop analytics subscription (Stripe Checkout + Customer Portal).
// Free tier: calendar, services, bookings. Paid plan gates ALL analytics —
// Feedback Intelligence today, the business-analysis tool next.

const shopInput = z.object({ shopId: z.string().uuid() });

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL environment variable");
  return url.replace(/\/$/, "");
}

/** Owner check via the caller's own RLS-scoped client. */
async function requireOwnedShop(
  supabase: Awaited<ReturnType<typeof importUserClient>>,
  userId: string,
  shopId: string,
) {
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name, owner_id")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop || shop.owner_id !== userId) throw new Error("You don't own this shop.");
  return shop;
}

// Helper purely for typing requireOwnedShop's first parameter.
async function importUserClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type BillingStatus = {
  hasAnalytics: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => shopInput.parse(input))
  .handler(async ({ data, context }): Promise<BillingStatus> => {
    const { supabase } = context;

    const [{ data: active, error: fnErr }, { data: sub, error: subErr }] = await Promise.all([
      supabase.rpc("shop_has_active_analytics", { _shop_id: data.shopId }),
      supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("shop_id", data.shopId)
        .maybeSingle(),
    ]);
    if (fnErr) throw new Error(fnErr.message);
    if (subErr) throw new Error(subErr.message);

    return {
      hasAnalytics: Boolean(active),
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    };
  });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => shopInput.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { stripeRequest } = await import("@/lib/stripe.server");

    const priceId = process.env.STRIPE_PRICE_ID_ANALYTICS;
    if (!priceId) throw new Error("Missing STRIPE_PRICE_ID_ANALYTICS environment variable");

    const shop = await requireOwnedShop(supabaseAdmin, userId, data.shopId);

    // Reuse the shop's Stripe customer if we've seen it before.
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("shop_id", shop.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing && ["trialing", "active", "past_due"].includes(existing.status)) {
      throw new Error(
        "This shop already has an analytics subscription. Use Manage billing instead.",
      );
    }

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const email = (claims as { email?: string } | null)?.email;
      const customer = await stripeRequest<{ id: string }>("POST", "/customers", {
        email,
        name: shop.name,
        metadata: { shop_id: shop.id, owner_user_id: userId },
      });
      customerId = customer.id;
      const { error: upErr } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          { shop_id: shop.id, stripe_customer_id: customerId, status: "incomplete" },
          { onConflict: "shop_id" },
        );
      if (upErr) throw new Error(upErr.message);
    }

    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? "14");
    const session = await stripeRequest<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: { shop_id: shop.id },
      },
      metadata: { shop_id: shop.id },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/owner/feedback?billing=success`,
      cancel_url: `${appUrl()}/owner/feedback?billing=canceled`,
    });
    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => shopInput.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { stripeRequest } = await import("@/lib/stripe.server");

    await requireOwnedShop(supabaseAdmin, userId, data.shopId);

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No billing record for this shop yet.");

    const portal = await stripeRequest<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: sub.stripe_customer_id,
      return_url: `${appUrl()}/owner/feedback`,
    });
    return { url: portal.url };
  });
