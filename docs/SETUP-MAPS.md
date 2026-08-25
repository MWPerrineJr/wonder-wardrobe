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
2. **Application restrictions on the key.** The server probes the embed URL
   with the same `Referer` the browser iframe will send, so a "Websites"/
   HTTP-referrer restriction works — but the key must allow every domain the
   app is served from. Add each of these to the key's website list:

   ```text
   https://*.lovable.app/*
   https://your-custom-domain.com/*   (once you publish to a custom domain)
   ```

   If any served domain is missing, Google rejects the embed with:

   ```text
   403 — This IP, site or mobile application is not authorized to use this API
   key …
   ```

   IP-address restrictions won't work — the request originates from the
   server, whose IP is not stable. Setting restrictions to **None** also works.

Also confirm billing is enabled on the Google Cloud project; Maps APIs return
`403` without it.

No code change is needed once the key is fixed — the page starts rendering the
live map on the next load.
