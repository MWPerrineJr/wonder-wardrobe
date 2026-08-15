import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];

export const SERVICE_CATEGORY_VALUES: ServiceCategory[] = [
  "hair_barber",
  "nails",
  "waxing",
  "makeup",
  "massage",
  "skincare_facials",
  "brows_lashes",
  "spa_wellness",
];

export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string; icon: string }[] = [
  { value: "hair_barber", label: "Hair & Barber", icon: "content_cut" },
  { value: "nails", label: "Nails", icon: "nails" },
  { value: "waxing", label: "Waxing", icon: "spa" },
  { value: "makeup", label: "Makeup", icon: "palette" },
  { value: "massage", label: "Massage", icon: "self_care" },
  { value: "skincare_facials", label: "Skincare & Facials", icon: "face_3" },
  { value: "brows_lashes", label: "Brows & Lashes", icon: "visibility" },
  { value: "spa_wellness", label: "Spa & Wellness", icon: "hot_tub" },
];

export const categorySchema = z.array(
  z.enum(["hair_barber", "nails", "waxing", "makeup", "massage", "skincare_facials", "brows_lashes", "spa_wellness"] as const),
);


export const CATEGORY_LABELS: Record<ServiceCategory, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ServiceCategory, string>;

export const CATEGORY_ICONS: Record<ServiceCategory, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.value, c.icon]),
) as Record<ServiceCategory, string>;

export function categoryLabel(value: string) {
  return CATEGORY_LABELS[value as ServiceCategory] ?? value;
}

export function categoryIcon(value: string) {
  return CATEGORY_ICONS[value as ServiceCategory] ?? "category";
}


