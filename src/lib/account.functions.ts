import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "@/lib/db-error";
import { configuredPaymentsEnv } from "@/lib/payments-env";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refundForCancellation, type CancellationPolicy } from "@/lib/cancellation";

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

export type MyBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number | null;
  payment_status: string | null;
  amount_paid_cents: number | null;
  refunded_cents?: number | null;
  notes: string | null;
  shop: { id: string; name: string; slug: string | null; address?: string | null } | null;
  service: { id: string; name: string; duration_minutes: number | null } | null;
  provider: { id: string; display_name: string | null } | null;
  cancellation?: CancellationPolicy | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      id: userId,
      email: (claims as { email?: string } | null)?.email ?? null,
      full_name: data?.full_name ?? null,
      avatar_url: data?.avatar_url ?? null,
      phone: data?.phone ?? null,
    };
  });

const UpdateProfileInput = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+()\d\s.-]*$/, "Phone can only contain digits and + ( ) - . spaces")
    .nullable()
    .optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { full_name?: string | null; avatar_url?: string | null; phone?: string | null } =
      {};
    if (data.full_name !== undefined) patch.full_name = data.full_name || null;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url ? data.avatar_url : null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    const { data: saved, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id, full_name, avatar_url, phone, updated_at")
      .single();
    if (error) throw error;
    return saved;
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Read the booking (RLS scopes this to the caller) plus the shop's policy
    // so the refund is computed from stored values, never from client input.
    const { data: before, error: readErr } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, amount_paid_cents, payment_status, stripe_payment_intent_id,
         payment_environment, provider_id, google_event_id,
         shop:shops(cancel_free_hours, late_cancel_fee_percent)`,
      )
      .eq("id", data.bookingId)
      .single();
    if (readErr) throw dbError(readErr, "account");

    // Only status is sent; the DB trigger (restrict_customer_booking_update)
    // enforces that a customer can only move their own booking to
    // "cancelled" from "pending"/"confirmed" and cannot touch any other
    // column, regardless of what a client sends.
    const { data: saved, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId)
      .select("id, status")
      .single();
    if (error) throw dbError(error, "account");

    // Pull the mirrored event off the provider's Google Calendar, best-effort.
    try {
      const { removeBookingFromCalendar } = await import("@/server/googleCalendar.server");
      await removeBookingFromCalendar(before.provider_id, before.google_event_id);
    } catch (e) {
      console.error("[account] calendar cleanup skipped", e);
    }


    const shopPolicy = (before as unknown as {
      shop?: { cancel_free_hours?: number; late_cancel_fee_percent?: number } | null;
    }).shop;
    const policy: CancellationPolicy = {
      freeHours: shopPolicy?.cancel_free_hours ?? 24,
      lateFeePercent: shopPolicy?.late_cancel_fee_percent ?? 50,
      rescheduleAllowed: true,
      rescheduleMinHours: 24,
    };
    const outcome = refundForCancellation(
      before.amount_paid_cents ?? 0,
      before.starts_at,
      policy,
    );

    const paid = before.payment_status === "paid" && (before.amount_paid_cents ?? 0) > 0;
    if (!paid || outcome.refundCents <= 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", before.id);
      return { ...saved, refundCents: 0, feeCents: outcome.feeCents, refundError: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const configured = configuredPaymentsEnv();
    const chargedIn =
      before.payment_environment === "live" || before.payment_environment === "sandbox"
        ? before.payment_environment
        : configured;
    const env = chargedIn;
    let refundError: string | null = null;
    let refunded = 0;
    if (env !== configured) {
      refundError = `This booking was charged in ${env} mode; this deployment is ${configured}`;
    } else if (before.stripe_payment_intent_id) {
      const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
      try {
        const stripe = createStripeClient(env);
        await stripe.refunds.create({
          payment_intent: before.stripe_payment_intent_id,
          amount: outcome.refundCents,
        });
        refunded = outcome.refundCents;
      } catch (e) {
        refundError = getStripeErrorMessage(e);
      }
    } else {
      refundError = "No payment on file to refund";
    }

    await supabaseAdmin
      .from("bookings")
      .update({
        cancelled_at: new Date().toISOString(),
        refunded_cents: refunded,
        payment_status: refundError
          ? "refund_failed"
          : outcome.feeCents > 0
            ? "partially_refunded"
            : "refunded",
      })
      .eq("id", before.id);

    return { ...saved, refundCents: refunded, feeCents: outcome.feeCents, refundError };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBooking[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, payment_status, amount_paid_cents, refunded_cents, notes,
         shop:shops(id, name, slug, address, cancel_free_hours, late_cancel_fee_percent, reschedule_allowed, reschedule_min_hours),
         service:services(id, name, duration_minutes),
         provider:providers(id, display_name)`,
      )
      .eq("customer_id", userId)
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const shop = (row as unknown as {
        shop?: {
          id: string;
          name: string;
          slug: string | null;
          address?: string | null;
          cancel_free_hours?: number;
          late_cancel_fee_percent?: number;
          reschedule_allowed?: boolean;
          reschedule_min_hours?: number;
        } | null;
      }).shop;
      return {
        ...(row as unknown as MyBooking),
        shop: shop
          ? { id: shop.id, name: shop.name, slug: shop.slug, address: shop.address ?? null }
          : null,
        cancellation: shop
          ? {
              freeHours: shop.cancel_free_hours ?? 24,
              lateFeePercent: shop.late_cancel_fee_percent ?? 50,
              rescheduleAllowed: shop.reschedule_allowed ?? true,
              rescheduleMinHours: shop.reschedule_min_hours ?? 24,
            }
          : null,
      } as MyBooking;
    });
  });
