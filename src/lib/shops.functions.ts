import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listPublicShops = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, slug, name, description, address, cover_image_url")
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPublicShopBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: shop, error } = await supabase
      .from("shops")
      .select("id, slug, name, description, address, cover_image_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) return null;

    const { data: services, error: sErr } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    return { shop, services: services ?? [] };
  });

export const getMyShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: shops, error } = await supabase
      .from("shops")
      .select("id, slug, name, description, address, cover_image_url, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const enriched = await Promise.all(
      (shops ?? []).map(async (s) => {
        const [{ count: servicesCount }, { count: barbersCount }, { count: todayBookings }] =
          await Promise.all([
            supabase
              .from("services")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id)
              .eq("is_active", true),
            supabase
              .from("barbers")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id),
            supabase
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id)
              .gte("start_time", start)
              .lt("start_time", end),
          ]);
        return {
          ...s,
          services_count: servicesCount ?? 0,
          barbers_count: barbersCount ?? 0,
          today_bookings: todayBookings ?? 0,
        };
      }),
    );
    return enriched;
  });

export const getShopDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, slug, name, description, address, cover_image_url")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopError) throw new Error(shopError.message);
    if (!shop) throw new Error("Shop not found");

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, is_active")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: true });
    if (servicesError) throw new Error(servicesError.message);

    return { shop, services: services ?? [] };
  });
