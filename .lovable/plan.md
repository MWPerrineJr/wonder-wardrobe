
## Overview
Add a Feedback Intelligence page at `/owner/feedback` (owner-only) that reads and manages a new `customer_feedback` table scoped per shop.

## 1. Database migration
Create `public.customer_feedback` with the columns you provided, plus RLS and grants:

- Columns: `id uuid pk`, `shop_id uuid → shops(id)`, `customer_name`, `customer_email`, `source`, `message`, `rating int2`, `sentiment_label`, `sentiment_score numeric(3,2)`, `emotion`, `urgency`, `summary`, `explanation`, `key_phrases text[]`, `recommended_response`, `status varchar(25) default 'new'`, `created_at`, `updated_at`.
- Indexes on `shop_id`, `status`, `created_at desc`.
- `updated_at` trigger.
- RLS: shop owners can SELECT/UPDATE rows where `shop_id` belongs to them (via `shops.owner_id = auth.uid()`); service_role full access; INSERT restricted to service_role (feedback comes from your ingestion pipeline, not the app UI).
- GRANTs: `SELECT, UPDATE ON public.customer_feedback TO authenticated`, `ALL TO service_role`.
- Seed a handful of sample rows against your existing shops so the dashboard has data on first load.

## 2. Server functions (`src/lib/feedback.functions.ts`)
All protected with `requireSupabaseAuth`, filtered by owner-scoped shops:
- `listFeedback({ shopId, source?, sentiment?, urgency?, status? })` — returns rows + aggregates (total, avg sentiment, negative count, high-urgency count).
- `updateFeedbackStatus({ id, status })` — sets `status` to `reviewed`, `responded`, or `archived`.

## 3. UI route (`src/routes/_authenticated/owner.feedback.tsx`)
Layout matching the existing owner dashboard style:
- Shop switcher (reuse the pattern from `/owner`).
- 4 KPI cards: Total, Avg sentiment, Negative/Very negative count, High-urgency count.
- Filter bar: Source, Sentiment, Urgency, Status (Select components).
- Feedback list (cards, not a dense table — better on mobile):
  - Header row: customer_name · source badge · rating stars · created_at.
  - Sentiment badge (color-coded by label) + score, emotion, urgency chip.
  - Summary text, expandable to show full message + explanation + key_phrases chips.
  - Recommended response block with copy button.
  - Status badge + action buttons: **Mark reviewed**, **Mark responded**, **Archive** (uses `useMutation` + invalidate).
- Empty and loading states.

## 4. Navigation
Add a "Feedback" tab/link in the owner dashboard header so owners can jump between `/owner` and `/owner/feedback`.

## Notes
- The table is created in this project's backend (Lovable Cloud). The Supabase URL you linked is a different project — if the real feedback data lives there and needs to sync, we'd need to either (a) mirror it here via a scheduled job, or (b) point the app at that project via a service-role secret. Say the word if you want either path; otherwise I'll build against this project's `customer_feedback` with seeded rows so you can iterate on the UI immediately.
