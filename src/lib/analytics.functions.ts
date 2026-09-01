import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";
import { requirePaymentsEnv } from "@/lib/payments-env";
import { emptyAnalytics, type ShopAnalytics } from "@/lib/analytics-types";

const analyticsInput = z.object({
  shopId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("live"),
  days: z.number().int().min(7).max(365).default(30),
});

export const getShopAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => analyticsInput.parse(input))
  .handler(async ({ data, context }): Promise<ShopAnalytics> => {
    const { supabase, userId } = context;

    // Owner-only. RLS already scopes the read, but the explicit check keeps
    // provider/customer accounts out of the owner dashboard entirely.
    const { data: shop, error: shopErr } = await supabase
      .from("shops")
      .select("id, owner_id")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopErr) throw dbError(shopErr, "analytics");
    if (!shop || shop.owner_id !== userId) throw new Error("Not your shop");

    const environment = requirePaymentsEnv(data.environment);

    // Business analytics is part of the paid plan — gated server-side so the
    // function can't be called directly to bypass the upgrade screen.
    const { data: hasAnalytics, error: gateErr } = await supabase.rpc(
      "shop_has_active_analytics",
      { _shop_id: data.shopId, _env: environment },
    );
    if (gateErr) throw dbError(gateErr, "analytics");
    if (!hasAnalytics) return emptyAnalytics(data.days);

    const { buildShopAnalytics } = await import("@/lib/analytics.server");
    const result = await buildShopAnalytics(supabase, { shopId: data.shopId, days: data.days });
    return { locked: false, ...result };
  });