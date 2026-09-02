import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dbError } from "@/lib/db-error";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { categorySchema } from "@/lib/categories";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const listPublicShops = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, slug, name, description, address, cover_image_url, categories")
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw dbError(error, "shops");
  return data ?? [];
});

export const getPublicShopBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: shop, error } = await supabase
      .from("shops")
      .select(
        "id, slug, name, description, address, cover_image_url, categories, instagram_url, facebook_url, tiktok_url, x_url, youtube_url, website_url, contact_phone, whatsapp, social_links",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw dbError(error, "shops");
    if (!shop) return null;

    const { data: services, error: sErr } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, category")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });
    if (sErr) throw dbError(sErr, "shops");

    const { data: providers, error: pErr } = await supabase
      .from("providers")
      .select("id, display_name, specialties, avatar_url")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (pErr) throw dbError(pErr, "shops");

    return { shop, services: services ?? [], providers: providers ?? [] };
  });

export const getMyShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: shops, error } = await supabase
      .from("shops")
      .select(
        "id, slug, name, description, address, cover_image_url, google_review_url, categories, prepay_mode, deposit_percent, cancel_free_hours, late_cancel_fee_percent, reschedule_allowed, reschedule_min_hours, instagram_url, facebook_url, tiktok_url, x_url, youtube_url, website_url, contact_phone, whatsapp, social_links, created_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw dbError(error, "shops");

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const enriched = await Promise.all(
      (shops ?? []).map(async (s) => {
        const [{ count: servicesCount }, { count: providersCount }, { count: todayBookings }] =
          await Promise.all([
            supabase
              .from("services")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id)
              .eq("is_active", true),
            supabase
              .from("providers")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id),
            supabase
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", s.id)
              .gte("starts_at", start)
              .lt("starts_at", end),
          ]);
        return {
          ...s,
          services_count: servicesCount ?? 0,
          providers_count: providersCount ?? 0,
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
      .select("id, slug, name, description, address, cover_image_url, categories")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopError) throw dbError(shopError, "shops");
    if (!shop) throw new Error("Shop not found");

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, is_active, category")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: true });
    if (servicesError) throw dbError(servicesError, "shops");

    return { shop, services: services ?? [] };
  });

export const updateShopCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        categories: categorySchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: updated, error } = await supabase
      .from("shops")
      .update({ categories: data.categories })
      .eq("id", data.shopId)
      .eq("owner_id", context.userId)
      .select("id, categories")
      .single();
    if (error) throw dbError(error, "shops");
    return updated;
  });
