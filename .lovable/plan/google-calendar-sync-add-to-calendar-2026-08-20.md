# Google Calendar sync + add-to-calendar

## What's actually wrong today

- Instagram, Website and Gift cards on Mike's Cuts do render and are clickable. They point to placeholder values saved on the shop (`instagram.com/mikescuts`, `mikescuts.example.com`), which don't exist, so they look broken. You'll replace them in the owner dashboard Links tab — no code change needed.
- Google Calendar was never built. There is no calendar integration anywhere in the app.

## 1. Add to calendar (clients, no sign-in)

- On booking confirmation and on each upcoming appointment in `/account`, add an "Add to calendar" control with Google Calendar, Apple/Outlook (.ics download) options.
- Event contents: shop name + service as title, provider name, shop address as location, correct start/end times, the shop's cancellation policy text in the description, and a link back to `/shop/<slug>`.
- The .ics is generated server-side so times and time zone are correct; the Google link is a plain template URL.

## 2. Providers sync their own Google Calendar

- New "Calendar" tab on the owner/provider dashboard with a **Connect Google Calendar** button. Each provider connects their own Google account — this is separate from Sign in with Google.
- Once connected:
  - Every new booking is written to that provider's Google Calendar; cancellations delete the event, reschedules move it.
  - Busy events already on their Google Calendar block those slots in the public booking grid, so clients can't book over personal commitments.
  - A "Last synced" line plus a **Disconnect** button; disconnecting stops writes and removes stored access.
- Availability stays working if Google is unreachable — the app falls back to shop hours and existing bookings rather than blocking bookings.

## Setup you'll need to do once

Google Calendar per-user access needs a Google OAuth client registered for this workspace. I'll open the connector setup card; you'll create a Google OAuth web client in Google Cloud Console and add
`https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` as an authorized redirect URI. Until that's linked, the Calendar tab shows a "setup needed" state and part 1 (add to calendar) still works on its own.

## Technical notes

- Part 1: `src/lib/calendar.ts` builds the Google template URL and an RFC 5545 .ics string; served through a server route so the download has correct headers. New `src/components/add-to-calendar.tsx` used by `booking-panel.tsx` and `_authenticated/account.tsx`.
- Part 2: App User Connector `google_calendar` with scopes `calendar.events` and `calendar.readonly` plus userinfo email/profile. Follows the `tanstack-app-user-connector` flow: consent start, code exchange in a callback route, connection key encrypted with `APP_USER_CONNECTION_KEY_SECRET` and stored in a new `public.app_user_connections` table (service-role only, RLS enabled, no anon/authenticated grants).
- Provider calls go through `callAsAppUser` from server functions in `src/lib/calendar.functions.ts` (`connectCalendar`, `disconnectCalendar`, `getCalendarStatus`, `syncBookingToCalendar`, `listBusy`).
- New `bookings.google_event_id` column so cancel/reschedule can update the right event; migration also creates `app_user_connections` with grants.
- Booking creation (`booking.functions.ts`) and cancel (`account.functions.ts`) call the sync helper after the database write succeeds, wrapped so a Google failure never fails the booking.
- Availability in `getBookingContext` merges Google busy windows for the selected provider when that provider is connected.
- `docs/data-mapping.md` updated with the new column and table.
