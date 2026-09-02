# Restore preview and published website

## Verified diagnosis

- The current code builds successfully.
- The local preview homepage, health endpoint, and readiness endpoint all return HTTP 200.
- The published site and custom domain return HTTP 503 with: `Set VITE_PAYMENTS_ENV=live so the client matches PAYMENTS_ENV`.
- The production build configuration includes the live publishable payment token but does not declare the matching public payment mode.
- Payment go-live setup is complete, so no payment-account setup is blocking launch.

## Repair

1. Add the missing production build setting so `VITE_PAYMENTS_ENV` is explicitly `live`, matching the server-side `PAYMENTS_ENV` and live publishable token.
2. Preserve the existing fail-closed payment checks and sandbox preview configuration; do not weaken payment validation or expose secrets.
3. Verify the app builds, the embedded preview renders, and `/api/public/ready` reports healthy.
4. Publish the corrected frontend build, then verify the published URL and both custom-domain variants return the website instead of HTTP 503.

## Technical scope

- Production environment/build configuration only.
- No database, authentication, booking, pricing, or payment-account changes.
