# Google Maps setup

Public shop pages show a map of the shop address using the **Maps Embed API**.
The key is read server-side from the `GOOGLE_MAPS_API_KEY` secret and never
reaches the browser (`src/lib/maps.functions.ts`).

## If the map shows the "View on Google Maps" card instead of a map

That card is the graceful fallback — it appears whenever Google refuses the
embed (the request comes back `403`). Two settings on the key cause this:

1. **Maps Embed API not enabled.** In Google Cloud Console → APIs & Services →
   Library, enable **Maps Embed API** for the same project the key belongs to.
   (Maps JavaScript API being enabled is not enough.)
2. **HTTP referrer restrictions.** If the key is restricted to specific
   websites, the embed request must be allowed. Add:
   - `https://*.lovable.app/*`
   - `https://*.lovableproject.com/*`
   - your custom domain, e.g. `https://thestandingchair.app/*`

   Note: the embed URL is built server-side, so a key restricted by IP address
   will not work — use "Websites" restrictions or leave the key unrestricted
   while testing.

Also confirm billing is enabled on the Google Cloud project; Maps APIs return
`403` without it.

No code change is needed once the key is fixed — the page starts rendering the
live map on the next load.
