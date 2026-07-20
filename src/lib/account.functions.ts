import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  notes: string | null;
  shop: { id: string; name: string; slug: string | null } | null;
  service: { id: string; name: string; duration_minutes: number | null } | null;
  barber: { id: string; display_name: string | null } | null;
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
  full_name: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(30).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { full_name?: string | null; avatar_url?: string | null; phone?: string | null } = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name || null;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url ? data.avatar_url : null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBooking[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, price_cents, notes,
         shop:shops(id, name, slug),
         service:services(id, name, duration_minutes),
         barber:barbers(id, display_name)`,
      )
      .eq("customer_id", userId)
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MyBooking[];
  });