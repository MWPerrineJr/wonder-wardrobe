import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BarberBooking = {
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

export type BarberDay = {
  barber: { id: string; display_name: string; shop_id: string; shop_name: string } | null;
  bookings: BarberBooking[];
};

const DayInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tzOffsetMinutes: z.number().int().min(-900).max(900),
});

export const getMyBarberDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DayInput.parse(input))
  .handler(async ({ data, context }): Promise<BarberDay> => {
    const { supabase, userId } = context;
    const { data: barber, error: bErr } = await supabase
      .from("barbers")
      .select("id, display_name, shop_id, shop:shops(name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!barber) return { barber: null, bookings: [] };

    const [y, m, d] = data.date.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + data.tzOffsetMinutes * 60_000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, customer_name, customer_phone, notes,
         service:services(id, name, duration_minutes)`,
      )
      .eq("barber_id", barber.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at");
    if (error) throw new Error(error.message);

    return {
      barber: {
        id: barber.id,
        display_name: barber.display_name,
        shop_id: barber.shop_id,
        shop_name: (barber as unknown as { shop?: { name?: string } }).shop?.name ?? "",
      },
      bookings: (bookings ?? []) as unknown as BarberBooking[],
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
    if (error) throw new Error(error.message);
    return saved;
  });
