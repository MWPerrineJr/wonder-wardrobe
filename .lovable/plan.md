# Test results: Google Calendar & Google Maps

Both integrations were tested end-to-end in the live preview with the signed-in owner account.

## Test findings

### Google Maps — 1 code bug found (fix included below)

- The embed URL probe in `getMapEmbedUrl` calls Google **without** a `Referer` header.
- Google's API key has website restrictions: it rejects empty-referer requests (403) but **accepts** requests from `*.lovable.app` (verified: the preview domain as referer returns 200).
- Result: the real browser iframe would load the map fine, but the server probe fails first, so every shop page shows the fallback "View on Google Maps" card instead of the live map.

### Google Calendar — wiring works, blocked by a Google Cloud setting (your action needed)

Verified working: Calendar tab renders, connection status check passes, the Connect button calls the gateway and opens Google's consent page in a popup.

Blocked at the last step: Google shows **Error 400: redirect_uri_mismatch**. The new OAuth client (from when you changed credentials) does not have the Lovable gateway callback in its authorized redirect URIs. No code change can fix this — it must be added in Google Cloud Console:

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit the OAuth 2.0 client used for the calendar connector
3. Under **Authorized redirect URIs**, add exactly:
   ```text
   https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
   ```
4. Save, then retry **Connect Google Calendar** in the owner dashboard (Calendar tab)

## Code changes (this plan)

**`src/lib/maps.functions.ts`** — make the server probe match what the browser sends:

- Read the request origin via `getRequest()` (using the sandboxed `x-forwarded-host` when on localhost, same pattern as the calendar OAuth return URL)
- Send `Referer: <app origin>` on the probe request so Google's website restriction evaluates the same way it will for the real iframe
- Keep the existing graceful fallback for genuine failures

**`docs/SETUP-MAPS.md`** — one-line update noting the key must allow the app's hosting domain as a referrer (already true for `*.lovable.app`; relevant when you publish to a custom domain).

## Verification after the fix

- Re-run the in-browser test: a shop page (e.g. Mikes Cuts) shows the live embedded map instead of the fallback card
- Re-run the Calendar connect test after you add the redirect URI in Google Cloud Console: the popup should show the Google account picker instead of Error 400
