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
2. **Application restrictions on the key.** The embed URL is built and requested
   **server-side**, so Google sees an *empty referrer*. A "Websites"/HTTP-referrer
   restriction therefore always rejects it with:

   ```text
   403 — This IP, site or mobile application is not authorized to use this API
   key. Request received from IP address …, with empty referer
   ```

   Fix: on the key, set **Application restrictions → None** (or restrict by
   **API** only, limited to Maps Embed API). Because the request comes from the
   server, IP-address restrictions also won't work reliably — the server IP is
   not stable.


Also confirm billing is enabled on the Google Cloud project; Maps APIs return
`403` without it.

No code change is needed once the key is fixed — the page starts rendering the
live map on the next load.
