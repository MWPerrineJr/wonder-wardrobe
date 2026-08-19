# Business analytics for shop owners

A new **Analytics** page for shop owners at `/owner/analytics`, with charts built
from real booking, service, provider, and survey data. It sits behind the paid
Analytics plan, exactly like Feedback Intelligence: owners without an active
subscription see the plan comparison panel instead.

## What the page shows

Header controls: shop selector (for owners with several shops) and a range
switcher — 7 / 30 / 90 / 365 days, defaulting to **last 30 days**. Granularity
auto-scales: daily up to 90 days, weekly to 180, monthly beyond that. Every
KPI shows the % change against the previous equal-length period.

1. **KPI row** — revenue booked, revenue collected, appointments, average
   ticket, completion rate, average survey rating. Each with trend vs the
   previous period.
2. **Revenue trend** — line/area chart with two series side by side: booked
   value (price of completed + confirmed bookings) and collected (prepayments
   actually paid through the app). The gap between the lines is the point.
3. **Bookings per day** — bar chart of appointment counts over the range,
   stacked by status (completed, confirmed, cancelled, no-show).
4. **Sales per service** — horizontal bar chart plus a table: bookings count,
   revenue, average price, share of total. Sorted by revenue.
5. **Sales per provider** — horizontal bar chart plus a table: appointments,
   revenue, average ticket, average survey rating for that provider.
6. **Surveys & ratings** — invites sent, responses, completion rate, plus a
   rating distribution bar chart (1–5 stars) and a sentiment split
   (positive / neutral / negative) from the AI enrichment already stored.
7. **Cancellations & no-shows** — rate over time with the counts, so bad
   slots and repeat offenders are visible.
8. **Utilization & peak hours** — weekday × hour heatmap of appointments
   measured against the shop's configured open hours, with a "capacity used"
   percentage.
9. **Repeat vs new customers** — donut of new vs returning in the period, a
   returning-share trend, and a short list of top repeat customers.

Empty states are explicit ("No appointments in this range yet") rather than
blank charts, and every currency value is formatted from cents.

## Technical notes

- New `src/lib/analytics.functions.ts` with `getShopAnalytics`, an
  authenticated server function (`requireSupabaseAuth`) that verifies shop
  ownership through RLS, then aggregates in one pass over the range:
  bookings joined to services and providers, `survey_invites`,
  `customer_feedback`, and `shop_hours`. It returns plain serializable DTOs
  (series arrays, per-service rows, per-provider rows, heatmap buckets,
  retention counts) — no aggregation logic in the browser.
  Revenue booked = `price_cents` of completed/confirmed bookings; collected =
  `amount_paid_cents` where `payment_status = 'paid'`.
- Gating reuses `shop_has_active_analytics` via the existing
  `getBillingStatus`; unsubscribed owners get `AnalyticsUpgradePanel`.
- Charts use the already-installed `recharts` through
  `src/components/ui/chart.tsx`, with semantic design tokens only — no
  hardcoded colors. Y axes scale to the data with sensible ticks; currency
  axes are formatted compactly ($1.2k), and low-volume shops fall back to
  integer ticks instead of fractional ones.
- New route `src/routes/_authenticated/owner_.analytics.tsx`, loader priming
  the query cache and `useSuspenseQuery` in the component, with
  `errorComponent` / `notFoundComponent` and its own `head()` metadata.
  Range and shop live in the URL search params so views are shareable.
- Chart sections split into small components under
  `src/components/analytics/` to keep the route file thin.
- "Analytics" link added to the owner dashboard nav next to Feedback and Plans.
- No schema changes needed — all metrics come from existing tables.
