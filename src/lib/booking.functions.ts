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

/** Naive local wall-clock date + time -> exact instant, using the caller's UTC offset. */
function toInstant(date: string, time: string, tzOffsetMinutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) + tzOffsetMinutes * 60_000);
}

export type BookingContext = {
  shop: { id: string; slug: string; name: string };
  providers: Array<{ id: string; display_name: string; avatar_url: string | null; specialties: string[] }>;
  services: Array<{ id: string; name: string; description: string | null; duration_minutes: number; price_cents: number; category: string | null }>;
  hours: Array<{ weekday: number; open_time: string; close_time: string; is_closed: boolean }>;
};


export const getBookingContext = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<BookingContext | null> => {
    const supabase = publicClient();
    const { data: shop, error } = await supabase
      .from("shops")
      .select("id, slug, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) return null;

    const [providersRes, servicesRes, hoursRes] = await Promise.all([
      supabase
        .from("providers")
        .select("id, display_name, avatar_url, specialties")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("display_name"),
      supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents, category")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("price_cents"),
      supabase
        .from("shop_hours")
        .select("weekday, open_time, close_time, is_closed")
        .eq("shop_id", shop.id),
    ]);
    if (providersRes.error) throw new Error(providersRes.error.message);
    if (servicesRes.error) throw new Error(servicesRes.error.message);
    if (hoursRes.error) throw new Error(hoursRes.error.message);

    return {
      shop,
      providers: providersRes.data ?? [],
      services: servicesRes.data ?? [],
      hours: hoursRes.data ?? [],
    };

  });

const SlotsInput = z.object({
  shopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tzOffsetMinutes: z.number().int().min(-900).max(900),
});

const SLOT_STEP_MINUTES = 15;
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "18:00";

export const getAvailableSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlotsInput.parse(input))
  .handler(async ({ data }): Promise<{ slots: string[]; closed: boolean }> => {
    const pub = publicClient();

    const { data: service, error: svcErr } = await pub
      .from("services")
      .select("id, duration_minutes, shop_id")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (svcErr) throw new Error(svcErr.message);
    if (!service || service.shop_id !== data.shopId) throw new Error("Service not found for this shop");

    const [y, m, d] = data.date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();

    const { data: hours, error: hoursErr } = await pub
      .from("shop_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("shop_id", data.shopId)
      .eq("weekday", weekday)
      .maybeSingle();
    if (hoursErr) throw new Error(hoursErr.message);
    if (hours?.is_closed) return { slots: [], closed: true };

    const open = (hours?.open_time ?? DEFAULT_OPEN).slice(0, 5);
    const close = (hours?.close_time ?? DEFAULT_CLOSE).slice(0, 5);
    const toMinutes = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return (hh ?? 0) * 60 + (mm ?? 0);
    };
    const openM = toMinutes(open);
    const closeM = toMinutes(close);

    // Busy ranges for the chosen barber require reading other customers' rows,
    // so use the privileged client and return only opaque time ranges.
    let busy: Array<{ start: number; end: number }> = [];
    if (data.providerId) {
      const dayStart = toInstant(data.date, "00:00", data.tzOffsetMinutes);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("bookings")
        .select("starts_at, ends_at")
        .eq("provider_id", data.providerId)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString());
      if (error) throw new Error(error.message);
      busy = (rows ?? []).map((r) => ({
        start: new Date(r.starts_at).getTime(),
        end: new Date(r.ends_at).getTime(),
      }));
    }

    const now = Date.now();
    const slots: string[] = [];
    for (let mins = openM; mins + service.duration_minutes <= closeM; mins += SLOT_STEP_MINUTES) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;
      const start = toInstant(data.date, time, data.tzOffsetMinutes).getTime();
      const end = start + service.duration_minutes * 60_000;
      if (start <= now) continue;
      if (busy.some((b) => start < b.end && end > b.start)) continue;
      slots.push(time);
    }
    return { slots, closed: false };
  });

const CreateBookingInput = z.object({
  shopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  tzOffsetMinutes: z.number().int().min(-900).max(900),
  customerName: z.string().trim().min(2, "Enter your full name").max(80),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(30)
    .regex(/^[+()\d\s.-]+$/, "Phone can only contain digits and + ( ) - . spaces"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type SavedBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  barber: { id: string; display_name: string } | null;
  shop: { id: string; name: string; slug: string } | null;
};

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateBookingInput.parse(input))
  .handler(async ({ data, context }): Promise<SavedBooking> => {
    const { supabase, userId } = context;

    // Price and duration are always recomputed server-side from the service row.
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, shop_id, duration_minutes, price_cents, is_active")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (svcErr) throw new Error(svcErr.message);
    if (!service || service.shop_id !== data.shopId || !service.is_active) {
      throw new Error("That service is not available at this shop");
    }

    const startsAt = toInstant(data.date, data.time, data.tzOffsetMinutes);
    if (startsAt.getTime() <= Date.now()) throw new Error("Pick a time in the future");
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

    const { data: saved, error } = await supabase
      .from("bookings")
      .insert({
        shop_id: data.shopId,
        service_id: data.serviceId,
        provider_id: data.providerId ?? null,
        customer_id: userId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_cents: service.price_cents,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        notes: data.notes || null,
        status: "pending",
      })
      .select(
        `id, starts_at, ends_at, status, price_cents, customer_name, customer_phone, notes,
         service:services(id, name, duration_minutes),
         provider:providers(id, display_name),
         shop:shops(id, name, slug)`,
      )
      .single();
    if (error) throw new Error(error.message);
    return saved as unknown as SavedBooking;
  });
