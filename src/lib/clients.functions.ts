import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";
import { summarizeClients, type ClientSummary } from "@/lib/clients";

export type { ClientSummary } from "@/lib/clients";

async function assertShopOwner(
  supabase: { from: (t: "shops") => any },
  shopId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("shops")
    .select("id, name, slug")
    .eq("id", shopId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw dbError(error, "clients");
  if (!data) throw new Error("Shop not found");
  return data as { id: string; name: string; slug: string };
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shopId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertShopOwner(context.supabase, data.shopId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("bookings")
      .select("customer_id, customer_name, customer_phone, starts_at, status, price_cents")
      .eq("shop_id", data.shopId)
      .order("starts_at", { ascending: false })
      .limit(5000);
    if (error) throw dbError(error, "clients");

    const clients = summarizeClients(rows ?? [], new Date());
    // Emails live on the sign-in account; fetched only after ownership is verified.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      clients.slice(0, 500).map(async (c) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(c.customer_id);
        c.email = u?.user?.email ?? null;
      }),
    );
    return clients as ClientSummary[];
  });

export const getClientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ shopId: z.string().uuid(), customerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertShopOwner(context.supabase, data.shopId, context.userId);
    const [bookings, notes] = await Promise.all([
      context.supabase
        .from("bookings")
        .select(
          "id, starts_at, status, price_cents, notes, service:services(name), provider:providers(display_name)",
        )
        .eq("shop_id", data.shopId)
        .eq("customer_id", data.customerId)
        .order("starts_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("client_notes")
        .select("id, body, created_at")
        .eq("shop_id", data.shopId)
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false }),
    ]);
    if (bookings.error) throw dbError(bookings.error, "clients");
    if (notes.error) throw dbError(notes.error, "clients");
    return {
      bookings: (bookings.data ?? []).map((b: any) => ({
        id: b.id as string,
        starts_at: b.starts_at as string,
        status: b.status as string,
        price_cents: b.price_cents as number,
        notes: b.notes as string | null,
        service: (b.service?.name ?? null) as string | null,
        provider: (b.provider?.display_name ?? null) as string | null,
      })),
      notes: notes.data ?? [],
    };
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        customerId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_notes")
      .insert({
        shop_id: data.shopId,
        customer_id: data.customerId,
        author_id: context.userId,
        body: data.body,
      })
      .select("id, body, created_at")
      .single();
    if (error) throw dbError(error, "clients");
    return row;
  });

export const deleteClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes").delete().eq("id", data.noteId);
    if (error) throw dbError(error, "clients");
    return { ok: true };
  });

export const setFeedbackQuarantine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), quarantined: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customer_feedback")
      .update({ is_quarantined: data.quarantined })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw dbError(error, "feedback");
    if (!row) throw new Error("Feedback not found");
    return row;
  });
