import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Shop-owned payout accounts (Stripe Connect Express). Client prepayments are
// charged on the platform and transferred straight to the shop's own account.

const envSchema = z.enum(["sandbox", "live"]);

export type PayoutAccount = {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export const getPayoutAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid(), environment: envSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PayoutAccount> => {
    const { data: row, error } = await context.supabase
      .from("shop_payout_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
      .eq("shop_id", data.shopId)
      .eq("environment", data.environment)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: Boolean(row?.stripe_account_id),
      accountId: row?.stripe_account_id ?? null,
      chargesEnabled: row?.charges_enabled ?? false,
      payoutsEnabled: row?.payouts_enabled ?? false,
      detailsSubmitted: row?.details_submitted ?? false,
    };
  });

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

type LinkResult = { url: string } | { error: string };

/** Create (or reuse) the shop's Express account and return an onboarding link. */
export const startPayoutOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        environment: envSchema,
        returnUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LinkResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    const shop = await requireOwnedShop(context.supabase, context.userId, data.shopId);

    try {
      const stripe = createStripeClient(data.environment);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: existing } = await context.supabase
        .from("shop_payout_accounts")
        .select("stripe_account_id")
        .eq("shop_id", shop.id)
        .eq("environment", data.environment)
        .maybeSingle();

      let accountId = existing?.stripe_account_id ?? null;
      if (!accountId) {
        const {
          data: { user },
        } = await context.supabase.auth.getUser();
        const account = await stripe.accounts.create({
          type: "express",
          business_profile: { name: shop.name },
          ...(user?.email ? { email: user.email } : {}),
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { shop_id: shop.id, userId: context.userId },
        });
        accountId = account.id;
        const { error } = await supabaseAdmin.from("shop_payout_accounts").upsert(
          {
            shop_id: shop.id,
            environment: data.environment,
            stripe_account_id: accountId,
          },
          { onConflict: "shop_id,environment" },
        );
        if (error) throw new Error(error.message);
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: data.returnUrl,
        return_url: data.returnUrl,
      });
      return { url: link.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Refresh capability flags from Stripe (called after onboarding returns). */
export const refreshPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid(), environment: envSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PayoutAccount> => {
    const { createStripeClient } = await import("@/lib/stripe.server");
    await requireOwnedShop(context.supabase, context.userId, data.shopId);

    const { data: row, error } = await context.supabase
      .from("shop_payout_accounts")
      .select("stripe_account_id")
      .eq("shop_id", data.shopId)
      .eq("environment", data.environment)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.stripe_account_id) {
      return {
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const stripe = createStripeClient(data.environment);
    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("shop_payout_accounts")
      .update({
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", account.id);

    return {
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  });

/** Express dashboard login link so owners can see their own payouts. */
export const createPayoutLoginLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid(), environment: envSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<LinkResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    await requireOwnedShop(context.supabase, context.userId, data.shopId);

    const { data: row, error } = await context.supabase
      .from("shop_payout_accounts")
      .select("stripe_account_id")
      .eq("shop_id", data.shopId)
      .eq("environment", data.environment)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.stripe_account_id) return { error: "Connect a payout account first." };

    try {
      const stripe = createStripeClient(data.environment);
      const link = await stripe.accounts.createLoginLink(row.stripe_account_id);
      return { url: link.url };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });