## Wire `/owner` and `/` to real shop data

### 1. Owner dashboard (`/owner`)
Move under `_authenticated/` so it requires sign-in, then:
- New server fn `getMyShops` (uses `requireSupabaseAuth`) → returns each shop owned by the user with counts of services, barbers, and today's bookings.
- New server fn `getShopDetail({ shopId })` → returns shop + its services list (verifies ownership via RLS).
- UI:
  - If the user owns zero shops → empty state with a link to `/onboarding/owner`.
  - Otherwise render a shop switcher at the top (or a single-shop header). Selected shop shows the KPI cards (bookings today, services count, barbers count) and a "Services" list with name / duration / price.
  - Keep the existing dashboard visual style; just swap the mocked numbers/list for real data via TanStack Query (`ensureQueryData` + `useSuspenseQuery`).
- Redirect `/owner` old path → new `_authenticated/owner` route so existing links keep working.

### 2. Marketplace (`/`) — Featured shops
- New public server fn `listPublicShops` using the server-side publishable client (respects the existing `Shops are viewable by everyone` policy), returning `id, slug, name, description, address, cover_image_url` for up to ~12 shops.
- Replace the mocked "Featured shops" grid in `src/routes/index.tsx` with real data via loader + `useSuspenseQuery`. Each card links to `/shop/$slug` (the existing `/shop` page becomes the shop detail — we'll adapt it in a follow-up; for now the link just points to `/shop` with the slug in the URL).
- Empty state: friendly message + CTA to become a shop owner if none exist.

### Out of scope (next phase)
- Turning `/shop` into a real per-shop page (`/shop/$slug` reading services/barbers from DB) and wiring the booking form to insert into `bookings`.
- Editing services/barbers from the owner dashboard.

### Verification
- Typecheck.
- Playwright: sign in with the injected session, visit `/owner`, confirm "Mike's Dudes" and "Mikes Cuts" appear with their real service counts.
- Visit `/` and confirm both shops render in the Featured grid. Screenshot both.
