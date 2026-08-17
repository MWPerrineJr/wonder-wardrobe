import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

// Per-shop analytics subscription ($120/month or $1,000/year, 30-day trial).
// Free tier: shop listing, public page, services, hours, calendar, bookings.
// Paid tier gates ALL analytics — Feedback Intelligence and surveys today,
// the business-analysis tool next.

const envSchema = z.enum(["sandbox", "live"]);

const statusInput = z.object({
  shopId: z.string().uuid(),
  environment: envSchema,
});

const checkoutInput = z.object({
  shopId: z.string().uuid(),
  environment: envSchema,
  priceId: z.enum(["analytics_monthly", "analytics_yearly"]),
  returnUrl: z.string().url(),
});

const portalInput = z.object({
  shopId: z.string().uuid(),
  environment: envSchema,
  returnUrl: z.string().url().optional(),
});

export const TRIAL_DAYS = 30;

export type BillingStatus = {
  hasAnalytics: boolean;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data, context }): Promise<BillingStatus> => {
    const { supabase } = context;

    const [{ data: active, error: fnErr }, { data: sub, error: subErr }] = await Promise.all([
      supabase.rpc("shop_has_active_analytics", {
        _shop_id: data.shopId,
        _env: data.environment,
      }),
      supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end")
        .eq("shop_id", data.shopId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (fnErr) throw new Error(fnErr.message);
    if (subErr) throw new Error(subErr.message);

    return {
      hasAnalytics: Boolean(active),
      status: sub?.status ?? null,
      priceId: sub?.price_id ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    };
  });

/** Owner check through the caller's own RLS-scoped client. */
async function requireOwnedShop(
  supabase: { from: (t: "shops") => any },
  userId: string,
  shopId: string,
): Promise<{ id: string; name: string }> {
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name, owner_id")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop || shop.owner_id !== userId) throw new Error("You don't own this shop.");
  return { id: shop.id, name: shop.name };
}

/**
 * Resolve (or create) the Stripe customer for this shop owner, tagging it with
 * userId + shop_id so later reads and webhooks can find it.
 */
async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { userId: string; shopId: string; shopName: string; email?: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.shopId)) throw new Error("Invalid shopId");

  const found = await stripe.customers.search({
    query: `metadata['shop_id']:'${options.shopId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, userId: options.userId, shop_id: options.shopId },
      });
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    name: options.shopName,
    metadata: { userId: options.userId, shop_id: options.shopId },
  });
  return created.id;
}

type CheckoutResult = { clientSecret: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase } = context;
    const environment: StripeEnv = data.environment;

    const shop = await requireOwnedShop(supabase, userId, data.shopId);

    const { data: existing, error: exErr } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("shop_id", shop.id)
      .eq("environment", environment)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing && ["trialing", "active", "past_due"].includes(existing.status)) {
      throw new Error(
        "This shop already has an analytics subscription. Use Manage billing to change or cancel it.",
      );
    }

    try {
      const stripe = createStripeClient(environment);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const price = prices.data[0];

      const customerId = await resolveCustomer(stripe, {
        userId,
        shopId: shop.id,
        shopName: shop.name,
        email: user?.email ?? undefined,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId, shop_id: shop.id, managed_payments: "true" },
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          metadata: { userId, shop_id: shop.id },
        },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type PortalResult = { url: string } | { error: string };

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => portalInput.parse(input))
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { userId, supabase } = context;

    await requireOwnedShop(supabase, userId, data.shopId);

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("shop_id", data.shopId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.stripe_customer_id) throw new Error("No billing record for this shop yet.");

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl ? { return_url: data.returnUrl } : {}),
      });
      return { url: portal.url };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });
