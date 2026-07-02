import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateShopInput = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        duration_minutes: z.number().int().positive().max(600),
        price_cents: z.number().int().nonnegative().max(1_000_000),
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
      })
      .select("id, slug, name")
      .single();
    if (shopError) throw new Error(shopError.message);

    if (data.services && data.services.length > 0) {
      const { error: servicesError } = await supabaseAdmin.from("services").insert(
        data.services.map((s) => ({
          shop_id: shop.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price_cents: s.price_cents,
        })),
      );
      if (servicesError) throw new Error(`Shop created but services failed: ${servicesError.message}`);
    }

    return shop;
  });