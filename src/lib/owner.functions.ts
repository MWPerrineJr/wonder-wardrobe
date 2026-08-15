import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { categorySchema, type ServiceCategory } from "@/lib/categories";

const CreateShopInput = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  categories: categorySchema.optional().default([]),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        duration_minutes: z.number().int().positive().max(600),
        price_cents: z.number().int().nonnegative().max(1_000_000),
        category: z.enum(["hair_barber", "nails", "waxing", "makeup", "massage", "skincare_facials", "brows_lashes", "spa_wellness"] as const).default("hair_barber"),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});



export const createOwnerShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateShopInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Grant owner role (idempotent — unique on user_id+role)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "owner" });
    if (roleError && !roleError.message.includes("duplicate")) {
      throw new Error(`Could not grant owner role: ${roleError.message}`);
    }

    // Ensure slug is unique
    const { data: existing } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) {
      throw new Error("That shop URL is already taken. Try another.");
    }

    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .insert({
        owner_id: context.userId,
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        address: data.address ?? null,
        categories: data.categories,
      })
      .select("id, slug, name")
      .single();
    if (shopError) throw new Error(shopError.message);

    if (data.services && data.services.length > 0) {
      const { data: savedServices, error: servicesError } = await supabaseAdmin
        .from("services")
        .insert(
          data.services.map((s) => ({
            shop_id: shop.id,
            name: s.name,
            duration_minutes: s.duration_minutes,
            price_cents: s.price_cents,
            category: s.category as ServiceCategory,
          })),
        )
        .select("id, name, duration_minutes, price_cents, category");
      if (servicesError) throw new Error(`Shop created but services failed: ${servicesError.message}`);
      return { ...shop, services: savedServices ?? [] };
    }

    return { ...shop, services: [] as Array<{ id: string; name: string; duration_minutes: number; price_cents: number; category: string | null }> };



  });

// ---------- Shop details ----------

const UpdateShopInput = z.object({
  shopId: z.string().uuid(),
  patch: z.object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(1000).nullable().optional(),
    address: z.string().max(200).nullable().optional(),
    cover_image_url: z.string().url().max(500).nullable().optional(),
    categories: categorySchema.optional(),
  }),
});


export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateShopInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: saved, error } = await supabase
      .from("shops")
      .update(data.patch)
      .eq("id", data.shopId)
      .select("id, name, description, address, cover_image_url, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

// ---------- Services CRUD ----------

const ServiceFields = z.object({
  name: z.string().trim().min(2, "Service name is required").max(80),
  description: z.string().max(500).nullable().optional(),
  duration_minutes: z.number().int().min(5, "Duration must be at least 5 minutes").max(600),
  price_cents: z.number().int().nonnegative().max(1_000_000),
  is_active: z.boolean().optional(),
});

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ shopId: z.string().uuid(), fields: ServiceFields }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("services")
      .insert({ shop_id: data.shopId, ...data.fields })
      .select("id, name, description, duration_minutes, price_cents, is_active")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ serviceId: z.string().uuid(), fields: ServiceFields.partial() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("services")
      .update(data.fields)
      .eq("id", data.serviceId)
      .select("id, name, description, duration_minutes, price_cents, is_active")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ serviceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("services")
      .delete()
      .eq("id", data.serviceId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Service could not be deleted");
    return deleted;
  });

// ---------- Weekly hours ----------

const HourRow = z
  .object({
    weekday: z.number().int().min(0).max(6),
    open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    is_closed: z.boolean(),
  })
  .refine((h) => h.is_closed || h.close_time > h.open_time, {
    message: "Closing time must be after opening time",
  });

export const getShopHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ shopId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("shop_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertShopHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ shopId: z.string().uuid(), hours: z.array(HourRow).length(7) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = data.hours.map((h) => ({ shop_id: data.shopId, ...h }));
    const { data: saved, error } = await context.supabase
      .from("shop_hours")
      .upsert(payload, { onConflict: "shop_id,weekday" })
      .select("weekday, open_time, close_time, is_closed");
    if (error) throw new Error(error.message);
    return saved ?? [];
  });