# Add Google Maps API key

Store the user's Google Maps API key as a Lovable project secret so the Maps Embed API works on published shop pages.

## Steps

1. Add `GOOGLE_MAPS_API_KEY` as a project secret via the secure secrets form.
2. Verify the key is picked up by the server function (`src/lib/maps.functions.ts`).
3. Smoke-test a shop page in the preview to confirm the embedded map renders instead of the fallback "View on Google Maps" card.

## Notes

- The key is only used server-side; it is never sent to the browser.
- For local development the key can also live in `.env`, but production must use the Lovable secret store.
- If the map still shows the fallback after adding the key, the likely causes are: Maps Embed API not enabled for that key, or the key's HTTP referrer restrictions don't include the app's domains (`*.lovable.app` and `https://thestandingchair.com`).
