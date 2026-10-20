import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { dbError } from "@/lib/db-error";
import { toInstant } from "@/lib/booking-time";

const DateTz = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tzOffsetMinutes: z.number().int().min(-900).max(900),
};

/** Public: open walk-in times for a shop. Only free times are returned. */
export const getWalkInSlots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        serviceId: z.string().uuid(),
        providerId: z.string().uuid().nullable().optional(),
        ...DateTz,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { computeSlots } = await import("@/lib/slots.server");
    return computeSlots(data);
  });

const WalkInInput = z.object({
  shopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid().nullable().optional(),
  ...DateTz,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2, "Enter your name").max(80),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(30)
    .regex(/^[+()\d\s.-]+$/, "Phone can only contain digits and + ( ) - . spaces"),
});

/** Public: front-desk sign-in. Creates a confirmed walk-in appointment on the shop calendar. */
export const createWalkInBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WalkInInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeSlots } = await import("@/lib/slots.server");

    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("id, owner_id, name")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopErr) throw dbError(shopErr, "booking");
    if (!shop) throw new Error("Shop not found");

    // Abuse guard: cap walk-in sign-ins per shop in a short window.
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("source", "walk_in")
      .gte("created_at", since);
    if ((count ?? 0) >= 15) throw new Error("Too many sign-ins right now. Please ask the front desk.");

    const { slots } = await computeSlots(data);
    if (!slots.includes(data.time)) throw new Error("That time was just taken. Please pick another.");

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("duration_minutes, price_cents")
      .eq("id", data.serviceId)
      .single();
    if (!service) throw new Error("Service not found");

    const startsAt = toInstant(data.date, data.time, data.tzOffsetMinutes);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

    // Walk-ins have no account; the shop owner holds the record, tagged as a walk-in.
    const { data: saved, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        shop_id: shop.id,
        service_id: data.serviceId,
        provider_id: data.providerId ?? null,
        customer_id: shop.owner_id,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_cents: service.price_cents,
        status: "confirmed",
        payment_status: "not_required",
        source: "walk_in",
        notes: "Walk-in sign-in",
      })
      .select("id, starts_at, provider:providers(display_name), service:services(name)")
      .single();
    if (error) throw dbError(error, "booking");

    try {
      const { enqueueCalendarSync } = await import("@/lib/booking-calendar-outbox");
      await enqueueCalendarSync(supabaseAdmin, saved.id);
    } catch (e) {
      console.error("[walk-in] calendar enqueue skipped", e);
    }

    const prov = saved.provider as unknown as { display_name?: string } | null;
    const svc = saved.service as unknown as { name?: string } | null;
    return {
      id: saved.id,
      startsAt: saved.starts_at,
      providerName: prov?.display_name ?? null,
      serviceName: svc?.name ?? "",
    };
  });
