## Diagnosis

The owner dashboard IS loading (session replay shows "Mikes Cuts" + KPI cards rendered). The real gap is that it's read-only — no way to edit anything. This plan adds the management surface you asked for.

## Scope

Turn `/owner` into a working management dashboard with three editable sections:

1. **Shop details** — name, address, description, cover image URL
2. **Services** — add, edit (name/price/duration/description), toggle active, delete
3. **Weekly hours** — per-shop schedule (open/close time per weekday, or closed)

Barbers (which require linking real user accounts) come in a follow-up; noting this because the `barbers.user_id` column is `NOT NULL` and we haven't built the "invite barber" flow yet.

## Implementation

### Database (one migration)
- New table `public.shop_hours` — `shop_id`, `weekday` (0-6), `open_time`, `close_time`, `is_closed`, standard timestamps, unique `(shop_id, weekday)`.
- GRANTs + RLS: owners of the parent shop can select/insert/update/delete their rows; anon can select (so the public shop page can show hours later).

### Server functions (`src/lib/owner.functions.ts`, extend existing file)
All use `requireSupabaseAuth`; RLS already scopes writes to the shop owner.
- `updateShop({ shopId, patch })` — updates name/address/description/cover_image_url with zod validation.
- `createService`, `updateService`, `deleteService`, `toggleServiceActive` — services CRUD.
- `getShopHours({ shopId })` and `upsertShopHours({ shopId, hours[] })` — read + bulk-write weekly hours.

### UI (`src/routes/_authenticated/owner.tsx`)
Refactor page into tabs (shadcn `Tabs`): **Overview** (existing KPIs), **Details**, **Services**, **Hours**.
- **Details tab** — form for name/address/description/cover URL with Save button (`useMutation` → invalidate `["owner","shops"]` + `["public","shops"]`).
- **Services tab** — table of services with inline "Edit" (dialog with price in dollars converted to cents, duration in minutes, description, active toggle), "Delete" (confirm dialog), and an "Add service" button. Uses `useMutation` + query invalidation.
- **Hours tab** — 7-row grid (Mon-Sun) with "Closed" checkbox + time pickers, single "Save schedule" button that upserts all seven.

All forms validated with zod; all mutations show toast success/error via `sonner`.

### Public surface
- Extend `getPublicShopBySlug` to also return hours so `/shop` can display them (small addition — not the primary goal but keeps public page in sync).

## Verification

Drive Playwright with the injected session: navigate `/owner`, edit a service price, save, reload, screenshot to confirm the new price persists. Repeat for adding hours.

## Out of scope (call out to user)

- Managing barbers / staff (needs a separate invite-by-email flow because `barbers.user_id` requires a real auth user).
- Booking list & calendar management for the owner (can be next phase).
