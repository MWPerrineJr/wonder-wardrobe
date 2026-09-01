# Add Esthetician to service categories

Shops and services can currently be tagged with eight categories (Hair & Barber, Nails, Waxing, Makeup, Massage, Skincare & Facials, Brows & Lashes, Spa & Wellness). This adds a ninth: **Esthetician**.

## What changes

- Owners can pick "Esthetician" as a shop category during onboarding and in Shop Details.
- Owners can assign "Esthetician" to individual services when creating or editing them.
- The marketplace category filter and shop pages show and filter by Esthetician, with its own icon.

## Technical notes

1. Database migration: add `esthetician` to the `service_category` enum.
2. `src/lib/categories.ts`: add the value to `SERVICE_CATEGORY_VALUES`, add a `SERVICE_CATEGORIES` entry (label "Esthetician", icon `face_retouching_natural`), and add it to the `categorySchema` enum list.
3. `src/lib/owner.functions.ts`: add `esthetician` to the two inline `z.enum([...])` category lists (create-shop services and `ServiceFields`).
4. `src/routes/_authenticated/owner.tsx` and `src/routes/_authenticated/onboarding.owner.tsx`: add the value to the inline category lists used by the pickers.
5. Regenerated database types will include the new enum value; no data backfill is required and existing categories are unaffected.
