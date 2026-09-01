import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { canReserveSlot, DEFAULT_HOLD_MINUTES, holdExpiryIso } from "@/lib/booking-hold";
import { dbError } from "@/lib/db-error";
import { RETURN_PATHS, resolveAppReturnUrl, withSearchParams } from "@/lib/return-url";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { CancellationPolicy } from "@/lib/cancellation";

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
  shop: { id: string; slug: string; name: string; address: string | null };
  providers: Array<{ id: string; display_name: string; avatar_url: string | null; specialties: string[] }>;
  services: Array<{ id: string; name: string; description: string | null; duration_minutes: number; price_cents: number; category: string | null }>;
  hours: Array<{ weekday: number; open_time: string; close_time: string; is_closed: boolean }>;
  prepay: { mode: "off" | "deposit" | "full"; depositPercent: number; enabled: boolean };
  cancellation: CancellationPolicy;
};

/** Which payments environment this deployment charges in. */
function paymentEnv(): "sandbox" | "live" {
  return process.env["STRIPE_LIVE_API_KEY"] ? "live" : "sandbox";
}

/** Amount the client must pay up front, in cents (0 when prepay is off). */
export function amountDueCents(
  priceCents: number,
  mode: "off" | "deposit" | "full",
  depositPercent: number,
): number {
  if (mode === "full") return priceCents;
  if (mode === "deposit") return Math.max(50, Math.round((priceCents * depositPercent) / 100));
  return 0;
}


export const getBookingContext = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<BookingContext | null> => {
    const supabase = publicClient();
    const { data: shop, error } = await supabase
      .from("shops")
      .select(
        "id, slug, name, address, prepay_mode, deposit_percent, cancel_free_hours, late_cancel_fee_percent, reschedule_allowed, reschedule_min_hours",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw dbError(error, "booking");
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
    if (providersRes.error) throw dbError(providersRes.error, "booking");
    if (servicesRes.error) throw dbError(servicesRes.error, "booking");
    if (hoursRes.error) throw dbError(hoursRes.error, "booking");

    const mode = (shop.prepay_mode ?? "off") as "off" | "deposit" | "full";
    let chargesEnabled = false;
    if (mode !== "off") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: acct } = await supabaseAdmin
        .from("shop_payout_accounts")
        .select("charges_enabled")
        .eq("shop_id", shop.id)
        .eq("environment", paymentEnv())
        .maybeSingle();
      chargesEnabled = acct?.charges_enabled ?? false;
    }

    return {
      shop: { id: shop.id, slug: shop.slug, name: shop.name, address: shop.address ?? null },
      providers: providersRes.data ?? [],
      services: servicesRes.data ?? [],
      hours: hoursRes.data ?? [],
      prepay: {
        mode,
        depositPercent: shop.deposit_percent ?? 25,
        enabled: mode !== "off" && chargesEnabled,
      },
      cancellation: {
        freeHours: shop.cancel_free_hours ?? 24,
        lateFeePercent: shop.late_cancel_fee_percent ?? 50,
        rescheduleAllowed: shop.reschedule_allowed ?? true,
        rescheduleMinHours: shop.reschedule_min_hours ?? 24,
      },
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
    if (svcErr) throw dbError(svcErr, "booking");
    if (!service || service.shop_id !== data.shopId) throw new Error("Service not found for this shop");

    const [y, m, d] = data.date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();

    const { data: hours, error: hoursErr } = await pub
      .from("shop_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("shop_id", data.shopId)
      .eq("weekday", weekday)
      .maybeSingle();
    if (hoursErr) throw dbError(hoursErr, "booking");
    if (hours?.is_closed) return { slots: [], closed: true };

    const open = (hours?.open_time ?? DEFAULT_OPEN).slice(0, 5);
    const close = (hours?.close_time ?? DEFAULT_CLOSE).slice(0, 5);
    const toMinutes = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return (hh ?? 0) * 60 + (mm ?? 0);
    };
    const openM = toMinutes(open);
    const closeM = toMinutes(close);

    const { data: providerRows, error: provErr } = await pub
      .from("providers")
      .select("id")
      .eq("shop_id", data.shopId)
      .eq("is_active", true);
    if (provErr) throw dbError(provErr, "booking");
    const activeProviderCount = (providerRows ?? []).length;

    const dayStart = toInstant(data.date, "00:00", data.tzOffsetMinutes);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    // Occupying bookings for any customer require the privileged client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select("starts_at, ends_at, provider_id, status, hold_expires_at")
      .eq("shop_id", data.shopId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString());
    if (error) throw dbError(error, "booking");
    const occupying = (rows ?? []).map((row) => ({
      providerId: row.provider_id,
      start: new Date(row.starts_at).getTime(),
      end: new Date(row.ends_at).getTime(),
      status: row.status,
      holdExpiresAt: row.hold_expires_at,
    }));

    let googleBusy: Array<{ start: number; end: number }> = [];
    if (data.providerId) {
      // Personal commitments already on the provider's own Google Calendar also
      // block slots. Returns [] when Google is unreachable or not connected.
      const { listGoogleBusy } = await import("@/server/googleCalendar.server");
      googleBusy = await listGoogleBusy(
        data.providerId,
        dayStart.toISOString(),
        dayEnd.toISOString(),
      );
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
      const reservation = canReserveSlot({
        existing: occupying,
        activeProviderCount,
        providerId: data.providerId ?? null,
        start,
        end,
        nowMs: now,
      });
      if (!reservation.ok) continue;
      if (googleBusy.some((b) => start < b.end && end > b.start)) continue;
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
  returnUrl: z.string().max(2048).optional(),
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
  provider: { id: string; display_name: string } | null;
  shop: { id: string; name: string; slug: string } | null;
};

export type CreateBookingResult = {
  booking: SavedBooking;
  checkoutUrl: string | null;
  amountDueCents: number;
};


export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateBookingInput.parse(input))
  .handler(async ({ data, context }): Promise<CreateBookingResult> => {
    const { supabase, userId } = context;

    // Price and duration are always recomputed server-side from the service row.
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, shop_id, duration_minutes, price_cents, is_active")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (svcErr) throw dbError(svcErr, "booking");
    if (!service || service.shop_id !== data.shopId || !service.is_active) {
      throw new Error("That service is not available at this shop");
    }

    const { data: shopRow, error: shopErr } = await supabase
      .from("shops")
      .select("id, name, prepay_mode, deposit_percent")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopErr) throw dbError(shopErr, "booking");
    if (!shopRow) throw new Error("Shop not found");

    const env = paymentEnv();
    const mode = (shopRow.prepay_mode ?? "off") as "off" | "deposit" | "full";
    let payoutAccountId: string | null = null;
    if (mode !== "off") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: acct } = await supabaseAdmin
        .from("shop_payout_accounts")
        .select("stripe_account_id, charges_enabled")
        .eq("shop_id", shopRow.id)
        .eq("environment", env)
        .maybeSingle();
      if (acct?.charges_enabled) payoutAccountId = acct.stripe_account_id;
    }
    const due = payoutAccountId
      ? amountDueCents(service.price_cents, mode, shopRow.deposit_percent ?? 25)
      : 0;
    const returnTo =
      due > 0
        ? resolveAppReturnUrl(data.returnUrl, { fallbackPath: RETURN_PATHS.booking })
        : null;

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
        payment_status: due > 0 ? "awaiting_payment" : "not_required",
        amount_due_cents: due > 0 ? due : null,
        payment_environment: due > 0 ? env : null,
        hold_expires_at: due > 0 ? holdExpiryIso(new Date(), bookingHoldMinutes()) : null,
      })
      .select(
        `id, starts_at, ends_at, status, price_cents, customer_name, customer_phone, notes,
         service:services(id, name, duration_minutes),
         provider:providers(id, display_name),
         shop:shops(id, name, slug)`,
      )
      .single();
    if (error) throw dbError(error, "booking");
    const booking = saved as unknown as SavedBooking;

    // Calendar sync waits until the booking is confirmed (paid, or the
    // provider confirms a no-prepay visit). See booking-calendar.server.ts.

    if (due <= 0 || !payoutAccountId || !returnTo) {
      return { booking, checkoutUrl: null, amountDueCents: 0 };
    }

    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    try {
      const stripe = createStripeClient(env);
      const label = mode === "deposit" ? "Booking deposit" : "Appointment";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: due,
              product_data: { name: `${label} — ${shopRow.name}` },
            },
          },
        ],
        payment_intent_data: {
          transfer_data: { destination: payoutAccountId },
          metadata: { booking_id: booking.id, shop_id: shopRow.id },
        },
        metadata: { booking_id: booking.id, shop_id: shopRow.id },
        success_url: withSearchParams(returnTo, { paid: "1", booking: booking.id }),
        cancel_url: withSearchParams(returnTo, { paid: "0", booking: booking.id }),
      } as any);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const attached = await supabaseAdmin
        .from("bookings")
        .update({
          stripe_checkout_session_id: session.id,
          amount_due_cents: due,
          payment_environment: env,
        })
        .eq("id", booking.id)
        .eq("status", "pending")
        .eq("payment_status", "awaiting_payment")
        .select("id");
      if (attached.error) throw dbError(attached.error, "booking");
      if (!attached.data?.length) throw new Error("Could not attach checkout session to booking");

      return { booking, checkoutUrl: session.url ?? null, amountDueCents: due };
    } catch (e) {
      await cancelUnpaidHold(booking.id);
      throw new Error(getStripeErrorMessage(e));
    }
  });

function bookingHoldMinutes(): number {
  const n = Number(process.env["BOOKING_HOLD_MINUTES"]);
  return Number.isFinite(n) && n >= 5 && n <= 120 ? n : DEFAULT_HOLD_MINUTES;
}

async function cancelUnpaidHold(bookingId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const released = await supabaseAdmin
    .from("bookings")
    .update({
      status: "cancelled",
      payment_status: "failed",
      hold_expires_at: null,
    })
    .eq("id", bookingId)
    .eq("status", "pending")
    .eq("payment_status", "awaiting_payment")
    .select("id");
  if (released.error) {
    console.error("[booking] hold release failed", released.error);
    return;
  }
  if (!released.data?.length) {
    console.error("[booking] hold release matched zero rows", bookingId);
  }
}
