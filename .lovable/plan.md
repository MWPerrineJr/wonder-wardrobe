The project already reads `VITE_GOOGLE_MAPS_API_KEY` from `.env` via `import.meta.env`. The work is to make the setup and restart steps explicit for both developers and the in-app preview state.

## Changes

1. **`.env`**  
   Add a clear comment above the empty `VITE_GOOGLE_MAPS_API_KEY` line explaining:
   - This is the Google Maps Embed API key (browser-safe, referrer-restricted).
   - Paste the key between the quotes.
   - Restart the dev server after saving the file so Vite picks up the new variable.

2. **`src/components/shop-map.tsx`**  
   Update the placeholder card shown when the key is missing to include:
   - The exact variable name and `.env` location.
   - A reminder that the dev server must be restarted after setting the key.
   - Keep the existing friendly styling and layout.

## Verification

- Confirm the `.env` file still contains `VITE_GOOGLE_MAPS_API_KEY=""` with the new comment.
- Confirm the placeholder card renders the updated instructions when the key is empty.
- No functional changes to the map rendering path.