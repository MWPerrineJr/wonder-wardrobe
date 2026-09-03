# AI insights on the Analytics tab

Add an AI-written briefing at the top of `/owner/analytics` that reads the same
numbers the charts show and tells the owner what is actually driving them and
what to do next — not a restatement of the KPIs.

## What the owner sees

A card titled "What's driving your numbers", above the KPI row:

1. **Headline** — one sentence on the state of the business for the selected
   range (e.g. "Revenue is up 18% on 12 more appointments, but no-shows
   doubled and are costing about $340").
2. **Key drivers** — 3 to 5 items, each naming the metric that moved, the
   direction and size of the move, and the specific cause found in the data
   (a service, a provider, a weekday/hour block, cancellations, repeat-customer
   share). Each driver is labelled positive / negative / watch.
3. **Recommended actions** — 3 to 4 concrete steps ranked by expected impact,
   each with the reason and the number behind it ("Open Saturday 10am–1pm:
   it's your busiest block and already at 92% capacity").
4. **Risks & watch-outs** — short list: falling ratings, a provider with a
   weak completion rate, revenue concentrated in one service, unpaid deposits.

Footer of the card: the range it was written for, when it was generated, and a
**Refresh insights** button. Empty state when there's too little data: "Need at
least a handful of appointments in this range before insights are useful."

## How it behaves

- The briefing is generated per shop + range and cached, so switching ranges or
  reloading doesn't spend a model call each time.
- It regenerates automatically when the underlying numbers have changed since
  the cached version, or immediately when the owner hits Refresh.
- Locked (unsubscribed) owners keep seeing the existing upgrade panel — insights
  are part of the paid Analytics plan.

## Technical notes

- New `src/lib/analytics-insights.server.ts`: takes the existing
  `ShopAnalytics` DTO (KPIs, series, per-service, per-provider, surveys,
  utilization, retention) plus derived deltas, and asks the Lovable AI Gateway
  for a structured object via `streamText` + `Output.object` with a Zod schema
  (`headline`, `drivers[]`, `actions[]`, `risks[]`) — same pattern and model
  constant as `feedback-analysis.server.ts`. No raw customer PII in the prompt;
  names of services/providers only.
- Deterministic pre-computation stays in code: period-over-period deltas,
  top movers per service and provider, no-show cost estimate, capacity peaks,
  concentration share. The model explains and prioritises; it does not do math.
- New migration: `analytics_insights` table (`shop_id`, `range_days`,
  `window_start/end`, `payload jsonb`, `input_fingerprint`, `model`,
  `created_at`), with GRANTs and RLS so an owner reads only their own shop's
  rows and writes go through the server function.
- New `src/lib/analytics-insights.functions.ts`: `getAnalyticsInsights` and
  `refreshAnalyticsInsights`, both `requireSupabaseAuth`, both re-checking shop
  ownership and `shop_has_active_analytics` exactly like `getShopAnalytics`.
  `LOVABLE_API_KEY` read inside the handler; gateway errors classified with the
  existing `classifyGatewayError`.
- New `src/components/analytics/insights.tsx` rendering the card with semantic
  design tokens only; mounted in `src/routes/_authenticated/owner_.analytics.tsx`
  above the KPI grid, with its own loading skeleton so charts never wait on it.
