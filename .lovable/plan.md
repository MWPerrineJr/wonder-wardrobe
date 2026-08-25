# Plan: Day / Week / Month views for the provider schedule

## Goal
Let providers switch their schedule page (`/provider`) between **Day**, **Week**, and **Month** calendar views, instead of the current day-only list.

## Current state (verified)
- `src/routes/provider.tsx` renders `<ProviderSchedule />`.
- `src/components/provider-schedule.tsx` shows a single day: a date picker, "Day pulse" stats, and a list of that day's bookings with status actions.
- `src/lib/provider.functions.ts` exposes `getMyProviderDay` (fetches one day's bookings) and `setBookingStatus`.

## What changes

### 1. Data: range-based fetching
- Add `getMyProviderRange({ startDate, endDate, tzOffsetMinutes })` server function in `src/lib/provider.functions.ts`, reusing the existing provider lookup and booking query but over a date range. Keep `getMyProviderDay` as-is (used elsewhere / backwards compatible).

### 2. UI: view switcher + navigation
In `src/components/provider-schedule.tsx`:
- Segmented **Day | Week | Month** control in the schedule header, plus **‹ ›** prev/next arrows and a **Today** button. Navigation steps by day, week, or month depending on the active view.
- The existing date picker stays as a quick jump-to-date.

### 3. Three views
- **Day** — the current detailed list (stats, time ranges, status action buttons). Unchanged behavior.
- **Week** — 7-column grid (Mon–Sun), each column showing that day's bookings as compact cards (time, service, customer, status color). Clicking a card switches to that Day view for full details/actions.
- **Month** — calendar grid of the month with per-day booking count chips and status-colored dots; days with bookings are clickable and jump to the Day view. Prev/next days from adjacent months shown muted.

### 4. Consistency
- All views use the existing design tokens (surface, primary, status colors) and Material Symbols icons.
- Stats panel ("Day pulse") adapts to the visible range: appointments + expected revenue for the day/week/month shown.
- Mobile responsive: week grid scrolls horizontally on small screens; month grid collapses to a compact list-style layout.

## Technical notes
- No new dependencies — custom grid views matching the existing design system (avoids pulling in a heavy calendar library that clashes with the token styling).
- Query keys include view + anchor date so React Query caches each range separately; `setBookingStatus` invalidation broadened to refresh all schedule ranges.
- Week starts Monday; all date math in local time using the existing `isoDate` helper pattern.

## Verification
- Typecheck + build pass.
- Playwright check on `/provider`: switch between the three views, navigate prev/next, click a booking from week/month into day view, and change a booking status.
