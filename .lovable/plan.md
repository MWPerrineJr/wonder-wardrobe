# Broaden The Standing Chair beyond barbers

Turn the app from a barbershop marketplace into a multi-category beauty and wellness booking platform, with neutral wording and visuals throughout.

## Categories at launch

Hair & Barber, Nails, Waxing, Makeup, Massage, Skincare & Facials, Brows & Lashes, Spa & Wellness.

## What changes for customers

- Home and browse pages get a row of category filter chips next to the existing fuzzy search. Chips combine with search (e.g. "Nails" + "downtown").
- Each business card shows its category badges, derived from the categories of the services it offers.
- Business pages show category badges, and services are grouped by category.
- Copy and imagery become neutral: "Book beauty and wellness services near you" instead of haircut-specific language; the hero visual and alt text stop being barber-specific.

## What changes for business owners

- Onboarding asks for the business's primary categories, and each service they add gets a category.
- Owner dashboard: categories editable in Shop details; each service row gains a category selector.
- "Barbers" becomes "Team" / "Providers" everywhere — staff list, staff schedule page, booking step labels.

## Technical section

### Database migration
- New enum `service_category` with the nine values above.
- `services`: add `category service_category NOT NULL DEFAULT 'hair_barber'`; backfill existing rows to `hair_barber`.
- `shops`: add `categories service_category[] NOT NULL DEFAULT '{}'`; backfill from each shop's existing services.
- Rename `public.barbers` to `public.providers`; rename `bookings.barber_id` to `provider_id`. Postgres carries constraints, indexes and policies over, but policy bodies and the `validate_booking()` trigger reference the old names, so recreate the affected policies and the trigger function with the new identifiers in the same migration.
- Rename `app_role` enum value `barber` to `provider` (`ALTER TYPE ... RENAME VALUE`).
- Keep GRANTs intact for the renamed table (`authenticated`, `anon` select, `service_role`).

### Code
- Regenerate Supabase types after the migration, then rename across the codebase:
  - `src/lib/barber.functions.ts` -> `provider.functions.ts` (`getMyProviderDay`, etc.)
  - `src/components/barber-schedule.tsx` -> `provider-schedule.tsx`
  - `src/routes/barber.tsx` -> `src/routes/provider.tsx` (old `/barber` path redirects to `/provider`)
  - `booking.functions.ts`, `booking-panel.tsx`, `shops.functions.ts`, `account.functions.ts`, `owner.functions.ts`: `barberId` -> `providerId`.
  - MCP tools and `.lovable/mcp/manifest.json` descriptions updated to neutral wording.
- New `src/lib/categories.ts`: single source of truth mapping each enum value to a label and an icon, used by chips, badges, and selectors.
- `shops.functions.ts` returns each shop's categories; category filtering happens client-side alongside the existing fuzzy search in `src/routes/index.tsx` and `src/routes/shop.index.tsx`.
- Zod validation extended so service create/update and shop create require a valid category, matching the new DB constraints.
- `docs/data-mapping.md` updated with the new columns and renames.

### Neutral appearance
- Keep the approved Warm Stone palette and Outfit/Figtree type — no color or font changes.
- Replace barber-specific hero imagery and icons with a category-agnostic visual; category chips carry the visual variety instead.
- Route `head()` titles and descriptions updated to multi-service wording on every page.
