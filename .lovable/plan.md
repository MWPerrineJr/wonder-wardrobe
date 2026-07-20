## Goal
Give signed-in customers an account page at `/account` that shows their profile and their booking/service history.

## New route: `/_authenticated/account.tsx`
Sits behind the managed auth gate. Two sections:

1. **Profile**
   - Read-only display of email + full name + avatar (from `profiles` + `auth.users`).
   - Inline "Edit" toggles a form to update `full_name` and `avatar_url` (existing `profiles` table, RLS already scoped to self).

2. **Service history**
   - Lists this user's bookings, newest first, filtered by `bookings.customer_id = auth.uid()`.
   - Tabs: **Upcoming** (`status in (pending, confirmed)` AND `starts_at >= now()`) and **Past** (everything else).
   - Each row shows: date/time, shop name, service name + duration, barber name, price, status pill.
   - Empty state with a "Find a shop" CTA linking to `/`.

## Server functions (new file `src/lib/account.functions.ts`)
All use `requireSupabaseAuth`:
- `getMyProfile()` → returns `{ email, full_name, avatar_url }`.
- `updateMyProfile({ full_name, avatar_url })` → updates `profiles` where `id = auth.uid()`.
- `listMyBookings()` → selects from `bookings` joined with `shops(name, slug)`, `services(name, duration_minutes)`, `barbers(display_name)`, filtered by `customer_id = context.userId`, ordered by `starts_at desc`.

Data shape returned as plain DTOs (SSR-serializable). Uses TanStack Query pattern: loader calls `ensureQueryData`, component uses `useSuspenseQuery`.

## RLS check
`bookings` already has policies; will verify a customer-self SELECT policy exists. If missing, add one in a small migration:
```sql
CREATE POLICY "Customers view own bookings" ON public.bookings
FOR SELECT TO authenticated USING (auth.uid() = customer_id);
```
(Only added if not already present.)

## Header entry point
Add "My account" link to the signed-in dropdown in `src/components/account-nav.tsx`, pointing to `/account`.

## Files
- New: `src/routes/_authenticated/account.tsx`
- New: `src/lib/account.functions.ts`
- Edit: `src/components/account-nav.tsx` (add link)
- Migration only if a customer-self SELECT policy on `bookings` is missing.

## Out of scope
Cancelling/rescheduling bookings, reviews/feedback submission, payment history — those can follow in a later phase.
