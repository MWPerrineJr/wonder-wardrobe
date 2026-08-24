# Activate Google Calendar sync + fix the map

## Google Maps: confirmed broken at the key level

I tested your key against the Maps Embed API just now. Google returns:

```text
403 — This IP, site or mobile application is not authorized to use this API key.
```

The key exists and the app already handles the rejection gracefully (it shows the
"View on Google Maps" card instead of a broken frame). Nothing in the code is wrong —
the key itself is restricted.

Two things to change in Google Cloud Console (same project the key belongs to):

1. APIs & Services → Library → enable **Maps Embed API**.
2. APIs & Services → Credentials → your key → Application restrictions.
   The embed URL is requested **server-side**, so a "Websites"/referrer restriction
   blocks it (Google reports "empty referer"). Set restrictions to **None**, or
   restrict by **API** only (Maps Embed API). Also confirm billing is enabled.

Code change in this plan: none needed for maps, but I'll make the fallback card
state the reason for the shop owner (not the customer) and refresh
`docs/SETUP-MAPS.md` with the server-side/referrer caveat above.

## Google Calendar for providers (part 2)

I'll reopen the App User Connector setup card so you can register a Google OAuth
web client for this workspace. What you do once:

1. In Google Cloud Console → Credentials → Create OAuth client ID → Web application.
2. Add authorized redirect URI exactly:
   `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`
3. Enable the **Google Calendar API** in the same project.
4. Paste the client ID and secret into the card, with offline access enabled.

Then I build:

- New **Calendar** tab on the owner/provider dashboard with **Connect Google
  Calendar**, connected-account email, "Last synced", and **Disconnect**.
  Until the client is linked it shows a "setup needed" state.
- Each provider connects their own Google account (separate from Sign in with Google).
- New bookings are written to that provider's calendar; cancellations delete the
  event; reschedules move it.
- Busy events already on the provider's calendar block those slots in the public
  booking grid.
- If Google is unreachable, bookings still work — availability falls back to shop
  hours plus existing bookings, and a Google failure never fails a booking.

## Technical notes

- App User Connector `google_calendar`, scopes: `calendar.events`,
  `calendar.readonly`, plus userinfo email/profile.
- Consent start + callback code exchange per the App User Connector flow; the
  `lovack_*` connection key is AES-256-GCM encrypted with
  `APP_USER_CONNECTION_KEY_SECRET` and stored in a new
  `public.app_user_connections` table (service-role grants only, RLS enabled,
  no anon/authenticated access).
- Server functions in `src/lib/calendar.functions.ts`: `connectCalendar`,
  `disconnectCalendar`, `getCalendarStatus`, `syncBookingToCalendar`, `listBusy`,
  all calling Google through `callAsAppUser` from server-only code.
- Migration adds `bookings.google_event_id` plus the connections table and grants.
- `booking.functions.ts` and `account.functions.ts` call the sync helper after the
  database write, wrapped so Google errors are logged and swallowed.
- `getBookingContext` merges Google busy windows for the selected provider.
- Docs updated: `docs/data-mapping.md` and `docs/SETUP-MAPS.md`.
- Part 1 ("Add to calendar" for clients) is already live and unchanged.
