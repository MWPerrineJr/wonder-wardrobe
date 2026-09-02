# Fix the site-wide 503 on thestandingchair.com

## What is actually happening

The site is down, but not because of a broken page. Every request to the published site is being rejected before the app runs, with the text you saw:

`Set VITE_PAYMENTS_ENV=live so the client matches PAYMENTS_ENV`

Confirmed by checking the live site now: `https://thestandingchair.com/` returns HTTP 503 with exactly that body, while local preview is healthy.

The cause: the payment safety gate runs on the live server on every request and demands two build-time browser variables (`VITE_PAYMENTS_ENV`, `VITE_PAYMENTS_CLIENT_TOKEN`). Those values only exist while the app is being built and compiled into the browser bundle — they are not present in the live server's environment at request time. So the gate always sees them as missing, decides payments are misconfigured, and blocks the entire site. Adding them to `.env.production` last turn could not fix this, because the server never reads that file at runtime.

## The fix

Make the request-blocking check depend only on real server configuration, and check the browser-side payment mode where it actually lives — in the browser bundle.

1. Split the payments config check into two parts:
   - Server requirements (payment mode, secret keys, webhook secret, API key). Only these may block a request with a 503.
   - Browser bundle requirements (payment mode / publishable token match). These are evaluated at build time and reported, never used to take the whole site down.
2. Keep the compile-time safety net: if the browser bundle's payment mode does not match the server's mode, checkout is disabled with a clear message and the diagnostics page reports it — but browsing, booking pages and account pages keep working.
3. Keep `/api/public/ready` reporting both sets of issues so monitoring still surfaces a mismatch.
4. Verify locally (home page, health, readiness, payments tests, typecheck), then republish and confirm the published URL plus `thestandingchair.com` and `www.thestandingchair.com` all return 200.

## Technical notes

- `src/lib/payments-env.ts`: `inspectPaymentsConfig` gains a separation between blocking server issues and non-blocking client-bundle issues; the `VITE_*` checks move out of the blocking set.
- `src/server.ts`: the 503 gate uses only the blocking server issues; readiness continues to report everything.
- `src/lib/stripe.ts` already reads `import.meta.env.VITE_PAYMENTS_ENV` / `VITE_PAYMENTS_CLIENT_TOKEN` at build time — that stays the authority for whether checkout is allowed in the browser.
- `.env.production` keeps `VITE_PAYMENTS_ENV="live"` and the live publishable token so checkout stays live-mode.
- Update `src/lib/payments-env.test.ts` for the new shape.
