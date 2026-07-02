Move the Google Maps key off the client. Read `GOOGLE_MAPS_API_KEY` (server secret) inside a server function that returns a ready-to-use Maps Embed URL for a given address, and have `ShopMap` fetch that URL instead of building it from `import.meta.env`.

## Changes

1. **New `src/lib/maps.functions.ts`**
   - `getMapEmbedUrl` — `createServerFn({ method: "GET" })` with a Zod `inputValidator` for `{ address: string }` (non-empty, max ~500 chars).
   - Handler reads `process.env.GOOGLE_MAPS_API_KEY` inside the handler body.
     - If missing → return `{ ok: false, reason: "missing" as const }`.
     - Otherwise → return `{ ok: true, url: "https://www.google.com/maps/embed/v1/place?key=...&q=..." }` with the address URL-encoded.
   - Key is never returned to the client; only the composed embed URL is.

2. **`src/components/shop-map.tsx`**
   - Remove `VITE_GOOGLE_MAPS_API_KEY` usage and the `validateGoogleMapsApiKey` browser check.
   - Use TanStack Query: `useQuery({ queryKey: ["map-embed-url", address], queryFn: () => getMapEmbedUrl({ data: { address } }), enabled: !!address })`.
   - Render states with existing semantic tokens:
     - loading → subtle skeleton card
     - `ok: false, reason: "missing"` → error card telling the developer to set the `GOOGLE_MAPS_API_KEY` secret (no `.env` / `VITE_` instructions)
     - query error → generic error card
     - success → existing iframe using the server-provided `url`
   - Keep the "no address" early return.

3. **`.env`**
   - Remove the now-unused `VITE_GOOGLE_MAPS_API_KEY` line to avoid confusion. `GOOGLE_MAPS_API_KEY` stays as a managed secret (already configured), not in `.env`.

## Technical notes

- Server function file lives in `src/lib/` (client-safe path); the handler body is stripped from the client bundle, so `process.env.GOOGLE_MAPS_API_KEY` is only read server-side.
- Public route (`/shop`) — call the server function from the component via `useQuery`, not from a route `loader`, so SSR/prerender doesn't need the secret and unauth users don't break it. The function is unauthenticated (no `requireSupabaseAuth`) because the embed URL is safe to hand to any visitor of the shop page.
- No changes to auth, DB, or other routes.

## Verification

- `bun run build` succeeds.
- With the secret set, `/shop` renders the map iframe as before.
- With the secret temporarily unset, `/shop` shows the "missing key" error card and no key appears in the page source or network payload (only the embed URL does).
