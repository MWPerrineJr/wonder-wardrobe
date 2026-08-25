# Add shop deletion to the owner dashboard

Give shop owners a self-service way to permanently remove a shop and all of its data from the owner dashboard.

## What changes

- A **Delete shop** button is added to the owner dashboard (likely on the Overview tab near the shop selector, or inside Shop details).
- Clicking it opens a confirmation dialog that explains the action is permanent and lists what will be removed.
- A server function verifies the current user owns the shop, then deletes related records and the shop itself.
- The dashboard refreshes and, if the deleted shop was the only one, redirects to the empty-state “Set up your shop” screen.

## Technical details

- New server function in `src/lib/owner.functions.ts`:
  - `deleteShop({ shopId })` protected by `requireSupabaseAuth`.
  - Verifies ownership via `shops.owner_id = auth.uid()`.
  - Deletes child rows in dependency order to respect foreign keys:
    - `bookings`
    - `services`
    - `providers`
    - `shop_hours`
    - `survey_invites`
    - `customer_feedback`
    - `feedback_reports`
    - `subscriptions`
    - `comp_grants`
    - `shop_payout_accounts`
    - finally the `shop` row.
  - Uses `supabaseAdmin` only if RLS policies make cascade deletion difficult; otherwise uses the authenticated `context.supabase` client so the operation respects owner-scoped policies.
- New migration (if needed):
  - Adds `ON DELETE CASCADE` to child tables that currently lack it, OR
  - Adds a DELETE policy on `shops` scoped to the owner, so the server function can delete using the authenticated client.
  - Existing test data and production data must remain safe; the migration only changes constraints/policies, not data.
- UI in `src/routes/_authenticated/owner.tsx`:
  - Import an `AlertDialog` confirmation (the page already imports `AlertDialog` components).
  - Add a destructive-style **Delete shop** button inside the Overview tab, visible only when at least one shop exists.
  - On confirmation, call the delete mutation, show a toast, invalidate `owner/shops` and public queries, and clear the selection.
- Edge cases:
  - Deleting the currently selected shop falls back to the first remaining shop.
  - Deleting the last shop shows the empty state and the Create-shop CTA.
  - A shop with active future bookings can still be deleted by the owner; this is treated as the owner’s explicit decision (same as closing the business). The confirmation dialog warns that pending bookings will be removed.
