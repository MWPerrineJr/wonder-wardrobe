import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "@/lib/db-error";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  notes: string | null;
  shop: { id: string; name: string; slug: string | null } | null;
  service: { id: string; name: string; duration_minutes: number | null } | null;
  provider: { id: string; display_name: string | null } | null;
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
    return saved;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBooking[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, payment_status, amount_paid_cents, notes,
         shop:shops(id, name, slug),
         service:services(id, name, duration_minutes),
         provider:providers(id, display_name)`,
      )
      .eq("customer_id", userId)
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MyBooking[];
  });
