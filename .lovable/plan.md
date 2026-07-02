Add a runtime validation helper to `ShopMap` that surfaces a clear error when `VITE_GOOGLE_MAPS_API_KEY` is missing or fails a basic format check.

## Changes

1. **`src/components/shop-map.tsx`**
   - Add a `validateGoogleMapsApiKey(key: string | undefined)` helper that returns a discriminated result:
     - `ok: true` when the key is a non-empty string that looks like a Google API key (39 characters, alphanumeric with dashes/underscores).
     - `ok: false` with `reason: "missing" | "invalid"` otherwise.
   - In the component, call the validator before building the iframe `src`.
   - When validation fails, render a distinct error card using semantic error tokens (`bg-error-container`, `text-on-error-container`, `border-error`) with:
     - A clear headline such as "Google Maps API key missing" or "Google Maps API key looks invalid".
     - The exact variable name (`VITE_GOOGLE_MAPS_API_KEY`) and `.env` location.
     - A reminder to restart the dev server after updating `.env`.
   - Keep the existing successful map rendering path unchanged.

## Verification

- Build the project and confirm no TypeScript or Vite errors.
- With `VITE_GOOGLE_MAPS_API_KEY=""`, the component should render the missing-key error card.
- With a deliberately wrong-format key (e.g., `VITE_GOOGLE_MAPS_API_KEY="short"`), the component should render the invalid-key error card.
- With a valid-format key, the map iframe should still render as before.