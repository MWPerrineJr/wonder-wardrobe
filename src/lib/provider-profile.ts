import { z } from "zod";

export const PROVIDER_FROZEN_FIELDS = [
  "shop_id",
  "user_id",
  "is_active",
  "id",
  "created_at",
] as const;

/** Fields a provider may change on their own row. Identity columns stay frozen in SQL. */
export const ProviderSelfPatch = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    avatarUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
    specialties: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .strict();

export type ProviderSelfPatch = z.infer<typeof ProviderSelfPatch>;
