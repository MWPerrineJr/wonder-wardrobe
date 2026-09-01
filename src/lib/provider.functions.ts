import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "@/lib/db-error";
import { ProviderSelfPatch } from "@/lib/provider-profile";

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
    const shopJoin = data?.shop;
    const shop = Array.isArray(shopJoin) ? shopJoin[0] : shopJoin;
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

/**
 * Range variant of getMyProviderDay — powers the week and month calendar views.
 * startDate/endDate are inclusive local dates (YYYY-MM-DD); range is capped at 62 days.
 */
export const getMyProviderRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tzOffsetMinutes: z.number().int().min(-900).max(900),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ProviderDay> => {
    const { supabase, userId } = context;
    const { data: provider, error: pErr } = await supabase
      .from("providers")
      .select("id, display_name, shop_id, shop:shops(name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw dbError(pErr, "provider");
    if (!provider) return { provider: null, bookings: [] };

    const toUtcMidnight = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + data.tzOffsetMinutes * 60_000);
    };
    const rangeStart = toUtcMidnight(data.startDate);
    let rangeEnd = new Date(toUtcMidnight(data.endDate).getTime() + 24 * 60 * 60_000);
    if (rangeEnd.getTime() <= rangeStart.getTime()) {
      rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60_000);
    }
    const MAX_RANGE_MS = 62 * 24 * 60 * 60_000;
    if (rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS) {
      throw new Error("Date range too large");
    }

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, customer_name, customer_phone, notes,
         service:services(id, name, duration_minutes)`,
      )
      .eq("provider_id", provider.id)
      .gte("starts_at", rangeStart.toISOString())
      .lt("starts_at", rangeEnd.toISOString())
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

/** Providers may edit display fields only. Identity and shop assignment stay frozen. */
export const updateMyProviderProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProviderSelfPatch.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      display_name?: string;
      bio?: string | null;
      avatar_url?: string | null;
      specialties?: string[];
    } = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl ? data.avatarUrl : null;
    if (data.specialties !== undefined) patch.specialties = data.specialties;
    if (Object.keys(patch).length === 0) {
      throw new Error("No profile fields to update");
    }

    const { data: saved, error } = await context.supabase
      .from("providers")
      .update(patch)
      .eq("user_id", context.userId)
      .select("id, display_name, bio, avatar_url, specialties")
      .single();
    if (error) throw dbError(error, "provider");
    return saved;
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
    if (data.status === "confirmed" && saved) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enqueueCalendarSync } = await import("@/lib/booking-calendar-outbox");
        await enqueueCalendarSync(supabaseAdmin, saved.id);
      } catch (e) {
        console.error("[provider] calendar enqueue skipped", e);
      }
    }
    return saved;
  });
