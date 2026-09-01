# Google Calendar sync setup (one time)

Providers connect their **own** Google account from the owner dashboard →
**Calendar** tab. That is separate from "Sign in with Google". It needs a single
Google OAuth client registered for this app.

## 1. Create the Google OAuth client

1. Google Cloud Console → **APIs & Services → Library** → enable **Google Calendar API**.
2. **APIs & Services → Credentials** → *Create credentials* → **OAuth client ID** →
   application type **Web application**.
3. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
   ```

   Do not add the app URL or a custom domain here — the connector gateway is the
   only callback Google ever sees in this flow.
4. Copy the client ID and client secret into the Lovable connector setup card
   (Settings → Connectors → App User Connectors → Google Calendar), with
   **offline access** enabled.

## 2. OAuth consent screen

Add these scopes (the app requests them; Google must allow them):

- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.readonly`

While the consent screen is in *Testing*, add each provider's Google address
under **Test users**, or publish the app.

## What providers get once connected

- Confirmed bookings are written to their primary Google Calendar (after
  payment, or when the provider confirms a no-prepay visit). Unpaid checkout
  holds are not synced.
- Cancelling a booking deletes that event; rescheduling moves it.
- Busy events already on their calendar block those times in the public booking
  grid, so clients can't book over personal commitments.
- "Last synced" and a **Disconnect** button in the Calendar tab. Disconnecting
  revokes access and deletes the stored connection.

If Google is unreachable, bookings still work — availability falls back to shop
hours plus existing bookings, and a Google error never fails a booking. Failed
syncs retry from `booking_calendar_outbox` via `/api/public/jobs/booking-maintenance`.

## Client-side "Add to calendar"

Separate feature, no setup required: booking confirmations and each upcoming
appointment in `/account` offer Google, Outlook and Apple/.ics downloads.
