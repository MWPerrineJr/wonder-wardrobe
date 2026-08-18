import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "@/lib/db-error";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProviderBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  service: { id: string; name: string; duration_minutes: number } | null;
};

export type ProviderDay = {
  provider: { id: string; display_name: string; shop_id: string; shop_name: string } | null;
  bookings: ProviderBooking[];
};

const DayInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tzOffsetMinutes: z.number().int().min(-900).max(900),
});

export type ProviderProfile = {
  displayName: string;
  avatarUrl: string | null;
  shopName: string;
  shopSlug: string;
} | null;

/** Identity strip for the provider terminal — no hardcoded shop names. */
export const getMyProviderProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderProfile> => {
    const { data, error } = await context.supabase
      .from("providers")
      .select("display_name, avatar_url, shop:shops(name, slug)")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw dbError(error, "provider");
    const shop = (data as any)?.shop as { name: string; slug: string } | null | undefined;
    if (!data || !shop) return null;
    return {
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      shopName: shop.name,
      shopSlug: shop.slug,
    };
  });

export const getMyProviderDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DayInput.parse(input))
  .handler(async ({ data, context }): Promise<ProviderDay> => {
    const { supabase, userId } = context;
    const { data: provider, error: bErr } = await supabase
      .from("providers")
      .select("id, display_name, shop_id, shop:shops(name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (bErr) throw dbError(bErr, "provider");
    if (!provider) return { provider: null, bookings: [] };

    const [y, m, d] = data.date.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + data.tzOffsetMinutes * 60_000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, customer_name, customer_phone, notes,
         service:services(id, name, duration_minutes)`,
      )
      .eq("provider_id", provider.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at");
    if (error) throw dbError(error, "provider");

    return {
      provider: {
        id: provider.id,
        display_name: provider.display_name,
        shop_id: provider.shop_id,
        shop_name: (provider as unknown as { shop?: { name?: string } }).shop?.name ?? "",
      },
      bookings: (bookings ?? []) as unknown as ProviderBooking[],
    };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.bookingId)
      .select("id, status, starts_at")
      .single();
    if (error) throw dbError(error, "provider");
    return saved;
  });
