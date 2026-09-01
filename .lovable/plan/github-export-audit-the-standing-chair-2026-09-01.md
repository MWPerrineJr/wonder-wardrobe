# GitHub export audit — The Standing Chair

Read-only audit. Nothing was modified. Below is the full inventory of what the app depends on, plus a migration checklist and the list of things that will NOT travel with the Git repo.

## 1. Runtime services the app talks to

| Service | Used for | Where |
|---|---|---|
| Supabase (Lovable Cloud) | Database, auth, RLS, cron + pg_net jobs | `src/integrations/supabase/*`, `supabase/migrations` |
| Lovable AI Gateway (`ai.gateway.lovable.dev`) | Feedback sentiment analysis, daily reports | `src/lib/ai.server.ts`, `feedback-analysis.server.ts` |
| Lovable Connector Gateway (`connector-gateway.lovable.dev`) | Stripe API proxy, Google Calendar per-user OAuth | `src/lib/stripe.server.ts`, `src/integrations/lovable/appUserConnector.ts` |
| Stripe (via gateway) | Subscriptions, deposits, Connect payouts, webhooks | `src/lib/billing.functions.ts`, `payouts.functions.ts`, `routes/api/public/payments/webhook.ts` |
| Lovable Email (`@lovable.dev/email-js`) | Auth emails + owner welcome + survey invites | `src/routes/lovable/email/**`, `src/lib/email-templates/**` |
| Google Maps (Embed + optional Places) | Shop map, address autocomplete | `src/lib/maps.functions.ts`, `src/components/shop-map.tsx` |
| Google Calendar API | Provider calendar sync | `src/server/googleCalendar.server.ts` |
| Google OAuth (Supabase provider) | Customer/owner sign-in | `src/routes/auth.tsx` |
| Google Fonts | Outfit / Figtree | `src/routes/__root.tsx` |

## 2. Environment variables

**Client-visible (must exist at build time, in `.env*`, currently not committed):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `VITE_PAYMENTS_CLIENT_TOKEN` (separate test/live values in `.env.development` / `.env.production`)
- `VITE_GOOGLE_MAPS_BROWSER_KEY` (optional; enables Places autocomplete — never set in this project)

**Server-only, non-secret:**
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`
- `APP_URL` (used to build survey links in the cron jobs)
- `LOVABLE_SEND_URL` (optional email dispatch override)

**Secrets (8 configured today, values not retrievable):**
- `LOVABLE_API_KEY` — platform-managed; gateway auth for AI, email, connectors. **No equivalent outside Lovable.**
- `STRIPE_LIVE_API_KEY`, `STRIPE_SANDBOX_API_KEY` — gateway connection ids, *not* Stripe secret keys
- `PAYMENTS_LIVE_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- `GOOGLE_MAPS_API_KEY` (server-side, map embed)
- `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` — connector-managed
- `APP_USER_CONNECTION_KEY_SECRET` — AES-256-GCM key encrypting stored per-user calendar tokens. **If lost, every provider must reconnect Google Calendar.**
- `SUPABASE_SERVICE_ROLE_KEY` — referenced by the generated admin client; injected by Lovable and not readable here

## 3. Database

- 31 migrations in `supabase/migrations/` (2026-07-02 → 2026-09-01) — committed, replayable.
- 16 public tables: `profiles`, `user_roles`, `shops`, `shop_hours`, `services`, `providers`, `bookings`, `customer_feedback`, `feedback_reports`, `survey_invites`, `subscriptions`, `comp_codes`, `comp_grants`, `shop_payout_accounts`, `app_user_connections`, `ai_job_state`.
- Extensions: `pg_cron`, `pg_net`.
- Enum `service_category` (incl. `esthetician`), `app_role`, `has_role()` security-definer fn, `validate_booking()` trigger, and hardened SECURITY DEFINER RPCs for survey tokens / comp grants.
- **Supabase Edge Functions: none.** All server logic is TanStack `createServerFn` + `src/routes/api/public/*`.
- **Storage buckets: none** (verified — `storage.buckets` is empty).

## 4. Scheduled jobs (live in the database, not in code)

Three `pg_cron` jobs POST to the app with the publishable key as `apikey`:
- `feedback-send-surveys` — hourly → `/api/public/jobs/send-surveys`
- `feedback-enrich` — every 5 min → `/api/public/jobs/enrich-feedback`
- `feedback-build-reports` — daily 06:30 → `/api/public/jobs/build-reports`

They target `project--cb8ddcf9-…lovable.app`. **These URLs must be repointed after export** or the jobs silently stop.

## 5. Webhooks and public endpoints

- `POST /api/public/payments/webhook` — Stripe; HMAC-verified against `PAYMENTS_*_WEBHOOK_SECRET`. Endpoint must be re-registered in Stripe with the new host.
- `POST /lovable/email/auth/webhook` — Supabase Auth "send email" hook, hardcoded to `notify.pandagentic.ai` / `noreply@pandagentic.ai`.
- `GET /api/public/calendar-event`, `/api/public/emails/survey-invite`, and the three job endpoints.
- `/mcp`, `/.mcp/*`, `/.well-known/oauth-protected-resource`, `/.lovable/oauth/consent` — MCP agent surface.

## 6. Auth, redirects, domains

- Providers: **Email/password** (confirmation required, auto-confirm off) and **Google** (via the Lovable broker, `prompt=select_account`).
- Redirect URLs that must be re-registered: site origin, `/auth`, `/auth/callback`, `/reset-password`, and the Google Calendar connector callback `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.
- Google Cloud OAuth client scopes: `userinfo.email`, `userinfo.profile`, `calendar.events`, `calendar.readonly`.
- Domains: `thestandingchair.com` + `www` (custom), `cheerful-code-cottage.lovable.app` (published), `notify.pandagentic.ai` (email sender, DNS still pending), `pandagentic.ai` (brand link).
- `src/lib/site-origin.ts` hardcodes `https://thestandingchair.com` as the canonical origin for share links and QR codes.

## 7. Not in the Git repository

1. **`.env`, `.env.development`, `.env.production`** — `*.local` is ignored but these three are plain `.env*` files; confirm your export actually includes or excludes them, and never publish the live Stripe token in a public repo.
2. **All 8 secrets** — stored in Lovable's secret store, never on disk. Must be recreated in the new host.
3. **`src/assets/pandagentic-mark.png`** — only the `.asset.json` pointer is in the repo; the PNG itself is served from Lovable's CDN (`/__l5e/assets-v1/…`). The byline logo breaks outside Lovable hosting. `public/favicon.png` *is* a real committed file.
4. **Lovable-generated integration files** — `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,previewAuthStorage,types}.ts` are on disk but auto-generated; there is no generator outside Lovable, so treat them as hand-maintained after export.
5. **Cron job definitions and the current `net.http_post` schedule** — live database state; the last migration is the source of truth but must be re-run with new URLs.
6. **Connector configuration** — the Stripe connection and Google Calendar App User Connector client live in the Lovable workspace, not in code.
7. **Encrypted per-user calendar tokens** in `app_user_connections` — undecryptable without `APP_USER_CONNECTION_KEY_SECRET`.
8. `node_modules`, `dist`, `.output`, `.nitro`, `.wrangler`, `.tanstack`, logs (standard ignores).

## 8. Migration checklist

1. Export the repo; verify `.env*` handling and that `bun.lock` / `package-lock.json` are both present (pick one).
2. Stand up a Supabase project; run all 31 migrations in order; enable `pg_cron` + `pg_net`.
3. Recreate the 8 secrets and all `VITE_*` values in the new host's env.
4. **Replace the Lovable-only pieces** — this is the hard part:
   - `LOVABLE_API_KEY` + AI Gateway → a direct OpenAI-compatible provider in `src/lib/ai.server.ts`.
   - Stripe via connector gateway → a real Stripe secret key in `src/lib/stripe.server.ts` (drop the gateway `httpClient` rewrite).
   - Lovable Email → your own provider (Resend/Postmark) in `src/lib/email-templates/send-email.ts` and the auth webhook.
   - Google Calendar App User Connector → your own per-user OAuth flow.
   - `pandagentic-mark.png` → commit a real image file.
5. Configure auth: email confirmation on, Google provider with your own client, redirect URLs above.
6. Re-register the Stripe webhook and the Supabase auth email hook against the new host.
7. Re-schedule the three cron jobs with the new base URL.
8. Point DNS for `thestandingchair.com`; finish `notify.pandagentic.ai` verification; update `src/lib/site-origin.ts` if the canonical host changes.
9. Restrict the Google Maps key to the new referrers.
10. Smoke test: sign-up + confirm email, Google sign-in, booking with 50% deposit, Stripe webhook receipt, survey email, calendar sync, owner analytics gating, MCP `/mcp`.

## Biggest risks

- Four features (AI feedback, Stripe, email, calendar sync) route through Lovable gateways and **will not work in a plain GitHub/Vercel deploy without code changes**.
- Losing `APP_USER_CONNECTION_KEY_SECRET` orphans all stored calendar connections.
- The cron jobs embed the old project URL and fail silently.
