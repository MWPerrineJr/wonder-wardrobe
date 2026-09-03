import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "@/lib/db-error";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HEARD_ABOUT_VALUES } from "@/lib/attribution";
import { categorySchema, type ServiceCategory } from "@/lib/categories";
import {
  normalizeCustomLinks,
  normalizePhone,
  normalizeSocial,
  normalizeWhatsapp,
} from "@/lib/social-links";

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
  heard_about: z.enum(HEARD_ABOUT_VALUES).optional().nullable(),
  heard_about_detail: z.string().trim().max(120).optional().nullable(),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        duration_minutes: z.number().int().positive().max(600),
        price_cents: z.number().int().nonnegative().max(1_000_000),
        category: z
          .enum([
            "hair_barber",
            "nails",
            "waxing",
            "makeup",
            "massage",
            "skincare_facials",
            "brows_lashes",
            "spa_wellness",
            "esthetician",
          ] as const)
          .default("hair_barber"),
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
      throw dbError(roleError, "owner");
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
    if (shopError) throw dbError(shopError, "owner");

    // Owner signup registry — tracking must never block shop creation.
    try {
      const { error: signupError } = await supabaseAdmin.from("owner_signups").insert({
        shop_id: shop.id,
        owner_id: context.userId,
        owner_email: (context.claims?.email as string | undefined) ?? null,
        owner_name: (context.claims?.["name"] as string | undefined) ?? null,
        shop_name: shop.name,
        shop_slug: shop.slug,
        heard_about: data.heard_about ?? null,
        heard_about_detail: data.heard_about_detail?.trim() || null,
      });
      if (signupError) console.error("owner_signups insert failed", signupError.message);
    } catch (err) {
      console.error("owner_signups insert failed", err);
    }

    // Friendly welcome email — never block shop creation on delivery problems.
    try {
      const email = context.claims?.email as string | undefined;
      if (email) {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { CANONICAL_ORIGIN } = await import("@/lib/site-origin");
        const { OWNER_CONTACT_EMAIL } = await import("@/lib/support");
        await sendTemplateEmail("owner-welcome", email, {
          idempotencyKey: `owner-welcome-${shop.id}`,
          replyTo: OWNER_CONTACT_EMAIL,
          templateData: {
            ownerName: (context.claims?.["name"] as string | undefined) ?? null,
            shopName: shop.name,
            shopUrl: `${CANONICAL_ORIGIN}/shop/${shop.slug}`,
          },
        });
      }
    } catch (err) {
      console.error("owner-welcome email failed", err);
    }

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
      if (servicesError) throw dbError(servicesError, "owner");
      return { ...shop, services: savedServices ?? [] };
    }

    return {
      ...shop,
      services: [] as Array<{
        id: string;
        name: string;
        duration_minutes: number;
        price_cents: number;
        category: string | null;
      }>,
    };
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
    prepay_mode: z.enum(["off", "deposit", "full"]).optional(),
    deposit_percent: z.number().int().min(5).max(100).optional(),
    cancel_free_hours: z.number().int().min(0).max(168).optional(),
    late_cancel_fee_percent: z.number().int().min(0).max(100).optional(),
    reschedule_allowed: z.boolean().optional(),
    reschedule_min_hours: z.number().int().min(0).max(168).optional(),
    google_review_url: z
      .string()
      .trim()
      .url("Enter a full link starting with https://")
      .startsWith("https://", "The review link must start with https://")
      .max(500)
      .nullable()
      .optional()
      .or(z.literal("")),
  }),
});

const ShopLinksInput = z.object({
  shopId: z.string().uuid(),
  links: z.object({
    instagram: z.string().max(300).default(""),
    facebook: z.string().max(300).default(""),
    tiktok: z.string().max(300).default(""),
    x: z.string().max(300).default(""),
    youtube: z.string().max(300).default(""),
    website: z.string().max(300).default(""),
    contact_phone: z.string().max(30).default(""),
    whatsapp: z.string().max(30).default(""),
    custom: z
      .array(z.object({ label: z.string().max(30), url: z.string().max(300) }))
      .max(5)
      .default([]),
  }),
});

export const updateShopLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ShopLinksInput.parse(data))
  .handler(async ({ data, context }) => {
    const l = data.links;
    const patch = {
      instagram_url: normalizeSocial("instagram", l.instagram),
      facebook_url: normalizeSocial("facebook", l.facebook),
      tiktok_url: normalizeSocial("tiktok", l.tiktok),
      x_url: normalizeSocial("x", l.x),
      youtube_url: normalizeSocial("youtube", l.youtube),
      website_url: normalizeSocial("website", l.website),
      contact_phone: normalizePhone(l.contact_phone),
      whatsapp: normalizeWhatsapp(l.whatsapp),
      social_links: normalizeCustomLinks(l.custom.filter((c) => c.label.trim() || c.url.trim())),
    };
    const { data: saved, error } = await context.supabase
      .from("shops")
      .update(patch)
      .eq("id", data.shopId)
      .eq("owner_id", context.userId)
      .select(
        "id, instagram_url, facebook_url, tiktok_url, x_url, youtube_url, website_url, contact_phone, whatsapp, social_links, updated_at",
      )
      .single();
    if (error) throw dbError(error, "owner");
    return saved;
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateShopInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      ...data.patch,
      ...(data.patch.google_review_url !== undefined
        ? { google_review_url: data.patch.google_review_url || null }
        : {}),
    };
    const { data: saved, error } = await supabase
      .from("shops")
      .update(patch)
      .eq("id", data.shopId)
      .eq("owner_id", context.userId)
      .select("id, name, description, address, cover_image_url, google_review_url, updated_at")
      .single();
    if (error) throw dbError(error, "owner");
    return saved;
  });

// ---------- Survey invite delivery log ----------

export const listSurveyInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ shopId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_invites")
      .select(
        "id, customer_name, customer_email, sent_at, emailed_at, email_status, email_error, email_attempts, email_next_attempt_at, responded_at, expires_at",
      )
      .eq("shop_id", data.shopId)
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) throw dbError(error, "owner");
    return rows ?? [];
  });

// ---------- Services CRUD ----------

const ServiceFields = z.object({
  name: z.string().trim().min(2, "Service name is required").max(80),
  description: z.string().max(500).nullable().optional(),
  duration_minutes: z.number().int().min(5, "Duration must be at least 5 minutes").max(600),
  price_cents: z.number().int().nonnegative().max(1_000_000),
  is_active: z.boolean().optional(),
  category: z
    .enum([
      "hair_barber",
      "nails",
      "waxing",
      "makeup",
      "massage",
      "skincare_facials",
      "brows_lashes",
      "spa_wellness",
      "esthetician",
    ] as const)
    .default("hair_barber"),
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
      .select("id, name, description, duration_minutes, price_cents, is_active, category")
      .single();
    if (error) throw dbError(error, "owner");
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
      .select("id, name, description, duration_minutes, price_cents, is_active, category")
      .single();
    if (error) throw dbError(error, "owner");
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
    if (error) throw dbError(error, "owner");
    if (!deleted) throw new Error("Service could not be deleted");
    return deleted;
  });

// ---------- Shop deletion ----------

export const deleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ shopId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership through the authenticated client (RLS as the user)
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("id", data.shopId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (shopError) throw dbError(shopError, "owner");
    if (!shop) throw new Error("Shop not found or you don't have permission to delete it.");

    // Privileged cascade delete for all child records
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("survey_invites").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("bookings").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("providers").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("services").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("customer_feedback").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("feedback_reports").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("comp_grants").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("shop_hours").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("shop_payout_accounts").delete().eq("shop_id", data.shopId);
    await supabaseAdmin.from("subscriptions").delete().eq("shop_id", data.shopId);

    const { error: deleteError } = await supabaseAdmin.from("shops").delete().eq("id", data.shopId);
    if (deleteError) throw dbError(deleteError, "owner");

    return { deleted: true };
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
    if (error) throw dbError(error, "owner");
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
    if (error) throw dbError(error, "owner");
    return saved ?? [];
  });
