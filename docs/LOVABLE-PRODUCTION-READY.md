# Lovable workstation — production-ready playbook

**Who this is for:** the Lovable AI (and the human sitting in the Lovable editor).

**How to use:** paste this entire file into a new Lovable chat as the working brief. Complete the sections **in order**. Do not skip a section because a later one looks more interesting. Check a box only after you have **evidence** (SQL result, HTTP status, screenshot, or dashboard confirmation).

**Product:** The Standing Chair — a booking marketplace (auth, Supabase, Stripe via Lovable connectors, surveys, Google Calendar). Canonical public origin is `https://thestandingchair.com`.

---

## 0. Hard rules (read first)

1. **Do not rewrite published Git history.** No force-push, rebase, amend, or squash of commits that are already on the remote. Lovable syncs the connected branch; rewriting history loses project history. If a bad change is already pushed, create a **new** commit (`git revert` or a forward fix).
2. **Code phases 1–10 are already done in Git.** Do not re-implement job auth, webhook idempotency, return-URL checks, RLS, retries, tests, health endpoints, or a repo-wide reformat. Your job is **host configuration, live integrations, and verification**.
3. **Do not edit generated files** unless Lovable Cloud itself regenerates them: `src/integrations/supabase/auth-middleware.ts`, `auth-attacher.ts`, `previewAuthStorage.ts`, `src/routeTree.gen.ts`. Do not touch the untracked `n8n workflow/` folder.
4. **Never commit secrets.** Do not put `JOB_SECRET`, Stripe secrets, `LOVABLE_API_KEY`, service-role keys, or Vault values into Git, chat logs, or markdown files.
5. **Stay on sandbox payments until Section 11 (staging) is fully green.** `PAYMENTS_ENV=live` is a deliberate last step, not a default.
6. **Keep the branch deployable.** Every change you make must leave preview booting. If `/api/public/ready` is 503, fix env before adding features.
7. **Do not upgrade** `@react-email/*` or `recharts`. See `docs/UPGRADES.md`. Those need visual regression, not a drive-by bump.

If a requested change would violate a rule above, stop and tell the human instead of improvising.

---

## 1. Confirm you are on the right code

The GitHub repo `MWPerrineJr/wonder-wardrobe` (Lovable-connected) should include the deployment-fix work through **Phase 10**.

**You (Lovable AI) must:**

1. Confirm the editor is on the connected production/preview branch that GitHub just received (look for recent commits such as job auth, webhook ledger, health/ready routes, `docs/OPERATIONS.md`).
2. If the Lovable editor is behind GitHub, **pull / sync** until the tree matches. Do not cherry-pick with history rewrites.
3. Confirm these files exist and are not empty:
   - `src/routes/api/public/health.ts`
   - `src/routes/api/public/ready.ts`
   - `src/routes/api/public/jobs/booking-maintenance.ts`
   - `supabase/migrations/20260901190000_secure_job_scheduler.sql`
   - `supabase/migrations/20260901203000_booking_holds_and_calendar_outbox.sql`
   - `supabase/migrations/20260901210000_validate_booking_security_definer.sql`
   - `docs/OPERATIONS.md`, `docs/SETUP-BILLING.md`, `docs/SETUP-FEEDBACK.md`, `docs/SETUP-CALENDAR.md`, `docs/SETUP-MAPS.md`
4. Open `/owner/diagnostics` in preview **after** env is set (Section 3). It should render, not 500.

**Do not** start a new “security rewrite” of job routes or Stripe webhooks. That work is in the repo.

---

## 2. Apply all database migrations

The app will look “up” and still be wrong if Cloud SQL is missing the 2026-09-01 migrations.

**You (Lovable AI) must:**

1. In Lovable Cloud / Supabase, apply **every** file in `supabase/migrations/` in filename order. Do not skip, rename, or edit a migration that already ran in another environment.
2. After apply, run this in the SQL editor and paste the result (redact nothing except secrets — there should be none in this output):

```sql
SELECT jobname, schedule
FROM cron.job
ORDER BY jobname;
```

Expected job names include:

| jobname                  | schedule      | calls                                        |
| ------------------------ | ------------- | -------------------------------------------- |
| `feedback-send-surveys`  | `0 * * * *`   | `invoke_feedback_job('send-surveys')`        |
| `feedback-enrich`        | `*/5 * * * *` | `invoke_feedback_job('enrich-feedback')`     |
| `feedback-build-reports` | `30 6 * * *`  | `invoke_feedback_job('build-reports')`       |
| `booking-maintenance`    | `*/5 * * * *` | `invoke_feedback_job('booking-maintenance')` |

3. Confirm **old** cron that POSTed with the public `apikey` is gone. The live command body must be `SELECT public.invoke_feedback_job(...)`, **not** `net.http_post` with a publishable key.
4. Confirm these tables exist: `app_runtime_settings`, `stripe_webhook_events`, `booking_calendar_outbox`, `ai_job_state`.
5. Confirm `validate_booking` is `SECURITY DEFINER` (occupancy trigger). If advisors later warn about it, do **not** drop `SECURITY DEFINER` — it exists so two customers cannot double-book; search path is fixed in the migration.

If a migration fails, stop. Do not hand-edit a published migration file. Add a **new** forward migration only if the human asks, and keep it additive.

---

## 3. Deployment environment (Lovable Cloud secrets + public env)

The process **fail-closes**: incomplete payments config returns **503** on almost every route except `/api/public/health` and `/api/public/ready`. Preview will look “down” until this section is complete.

Use `.env.example` as the name list. Values come from Lovable Cloud, Stripe connector cards, and generated secrets — **never from Git**.

### 3.1 Required for the app to boot (sandbox first)

Set **both** of these to `sandbox` until Section 12:

- `PAYMENTS_ENV=sandbox`
- `VITE_PAYMENTS_ENV=sandbox`

Then set:

| Name                              | Where                | Notes                                                                                                                                               |
| --------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                         | Server secret / env  | Public origin with no trailing slash. Preview: the current `*.lovable.app` URL. Production: `https://thestandingchair.com`.                         |
| `APP_URL_ALLOWLIST`               | Server, optional     | Comma-separated extra **HTTPS** origins (other Lovable preview URLs). Required if Stripe return URLs must hit a preview host that is not `APP_URL`. |
| `JOB_SECRET`                      | Server secret        | `openssl rand -base64 32` (or equivalent). **≥ 32 characters.** Must **not** equal the Supabase publishable key.                                    |
| `LOVABLE_API_KEY`                 | Platform-managed     | Required for Stripe connector, email, AI. Confirm it is present; do not print it.                                                                   |
| `STRIPE_SANDBOX_API_KEY`          | Payments / connector | Lovable **connection id**, not a raw `sk_test_` key.                                                                                                |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Payments / webhook   | Signing secret for the sandbox webhook endpoint.                                                                                                    |
| `VITE_PAYMENTS_CLIENT_TOKEN`      | Client env           | Sandbox publishable / client token. If it is not a `pk_test_` / `pk_live_` key, `VITE_PAYMENTS_ENV` **must** be set (already required above).       |
| `VITE_SUPABASE_URL`               | Client               | Same project as the Cloud database.                                                                                                                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | Client               | Publishable only. Never the service role.                                                                                                           |
| `VITE_SUPABASE_PROJECT_ID`        | Client               |                                                                                                                                                     |
| `SUPABASE_URL`                    | Server               | Same project.                                                                                                                                       |
| `SUPABASE_PUBLISHABLE_KEY`        | Server               | Same publishable key.                                                                                                                               |
| `SUPABASE_PROJECT_ID`             | Server               |                                                                                                                                                     |

Lovable injects `SUPABASE_SERVICE_ROLE_KEY` for the generated admin client. Do not paste it into Git or this chat.

### 3.2 Live Stripe names (do not fill until Section 12)

Leave empty or unused while `PAYMENTS_ENV=sandbox`:

- `STRIPE_LIVE_API_KEY`
- `PAYMENTS_LIVE_WEBHOOK_SECRET`

A live key sitting in the environment **does not** turn on live mode. Only `PAYMENTS_ENV=live` does. Still do not set live mode until staging is green.

### 3.3 Other secrets (configure when the matching feature is enabled)

| Name                                                | Feature             | Rule                                                                                                      |
| --------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY`                               | Shop map embed      | Server-only. See Section 8 and `docs/SETUP-MAPS.md`.                                                      |
| `VITE_GOOGLE_MAPS_BROWSER_KEY`                      | Places autocomplete | Optional. Do not set unless Places is intentionally enabled.                                              |
| `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` | Calendar sync       | From the App User Connector card.                                                                         |
| `APP_USER_CONNECTION_KEY_SECRET`                    | Calendar tokens     | AES key for stored Google tokens. **If rotated, every provider must reconnect Calendar.** Do not lose it. |
| `LOVABLE_SEND_URL`                                  | Email override      | Optional. Leave unset unless Lovable support told you to set it.                                          |
| `AI_MAX_ENRICH_PER_DAY` / `AI_MAX_REPORTS_PER_DAY`  | Job caps            | Optional (defaults 200 / 40).                                                                             |
| `BOOKING_HOLD_MINUTES`                              | Unpaid holds        | Optional, 5–120, default 30.                                                                              |

### 3.4 Proof the process can run

After a **redeploy** (env changes do not apply until the worker restarts):

1. `GET {APP_URL}/api/public/health` → **200**, JSON `"status":"ok"`.
2. `GET {APP_URL}/api/public/ready` → **200**, JSON `"status":"ok"`, `"payments":"ok"`. If 503, read `issues` in the JSON (and `/owner/diagnostics` once signed in as an owner) and fix those names. Do not guess.
3. `GET {APP_URL}/` and `GET {APP_URL}/auth` must **not** be the HTML 500 page.

---

## 4. Job scheduler (Vault + app_url)

Cron no longer uses the public Supabase key. If Vault or `app_url` is empty, jobs throw inside Postgres and **surveys, AI, and hold expiry silently stop**.

**You (Lovable AI) must** run the following in the Cloud SQL editor. The human supplies `JOB_SECRET` and the public origin; you must **not** echo the secret back in full.

1. Put the **same** `JOB_SECRET` value into Supabase Vault under the exact name `job_secret`:

```sql
-- First time only. If it already exists, use update_secret instead (see docs/SETUP-FEEDBACK.md).
select vault.create_secret('PASTE_JOB_SECRET_HERE', 'job_secret');
```

If `job_secret` already exists:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'job_secret'),
  'PASTE_NEW_JOB_SECRET_HERE'
);
```

2. Point cron at the **currently published** origin (preview URL now; `https://thestandingchair.com` after custom domain):

```sql
insert into public.app_runtime_settings (key, value)
values ('app_url', 'https://YOUR-PUBLISHED-ORIGIN')
on conflict (key) do update
  set value = excluded.value, updated_at = now();
```

No trailing slash. Must be the origin the worker actually serves.

3. Prove the function can run (expect a `bigint` request id from `pg_net`, not an exception about missing secret or empty `app_url`):

```sql
select public.invoke_feedback_job('booking-maintenance');
```

4. From the **server** (or a curl the human runs), prove the HTTP path rejects the publishable key and accepts the scheduler secret:

```bash
# Must be 401
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
  "$APP_URL/api/public/jobs/booking-maintenance"

# Must be 200 (or 2xx) with the real JOB_SECRET
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $JOB_SECRET" \
  "$APP_URL/api/public/jobs/booking-maintenance"
```

If the second call is 503, `JOB_SECRET` is missing or shorter than 32 characters on the **worker**, not only in Vault. Both must match.

5. After rotating `JOB_SECRET`, update **both** the worker env **and** Vault in the same change window, then repeat step 4.

---

## 5. Stripe (sandbox) — connector, webhook, catalog

Follow `docs/SETUP-BILLING.md`. Stripe talks through the **Lovable connector gateway**. Do not put raw `sk_` keys in this project.

**You (Lovable AI) must:**

1. Open **Payments** in the Lovable workspace. Complete sandbox connection so `STRIPE_SANDBOX_API_KEY` is the connection id already in env.
2. Register a Stripe **sandbox** webhook (Stripe Dashboard or the Payments tab) pointing at:

   ```text
   {APP_URL}/api/public/payments/webhook?env=sandbox
   ```

   Copy the signing secret into `PAYMENTS_SANDBOX_WEBHOOK_SECRET`. Redeploy.

3. Confirm catalog prices exist with lookup keys:
   - `analytics_monthly`, `analytics_yearly`
   - `analytics_team_monthly`, `analytics_team_yearly`
   - `analytics_enterprise_monthly`, `analytics_enterprise_yearly`
4. Confirm webhook events include Checkout, subscription, and Connect account updates that this app handles (do not disable events the Payments tab lists as required).
5. Sign in as a **shop owner** on preview → `/owner/diagnostics`:
   - `PAYMENTS_ENV` is `sandbox`
   - Status **Ready**
   - Stripe connection and webhook secret **Configured**
6. Run a **test-card** Checkout (analytics trial or a deposit booking) with `4242 4242 4242 4242`. Confirm:
   - Stripe Dashboard shows the event delivered.
   - Diagnostics “Completed (24h)” increases, **Processing** and **Failed** stay at 0 (or failed is explained and retried).
   - For a booking: the row becomes paid/confirmed only after `payment_status=paid` (or async success). Unpaid Checkout must **not** confirm the appointment.

**Reject** a webhook URL for `env=live` while `PAYMENTS_ENV=sandbox`. The app returns an error if the query env does not match the process.

---

## 6. Auth (email confirmation + Google)

**You (Lovable AI) must:**

1. In Supabase Auth settings for this Lovable Cloud project:
   - Email confirmations **on** (auto-confirm **off**).
   - Confirm the Auth **send email** hook still posts to this app’s `/lovable/email/auth/webhook` (or the Lovable-managed equivalent). Do not point it at a dead preview URL.
2. Add **Redirect URLs** for every origin that will serve the app:
   - `{origin}/`
   - `{origin}/auth`
   - `{origin}/auth/callback` (if used)
   - `{origin}/reset-password`
   - `{origin}/oauth/google-calendar/return` (calendar OAuth return page in this repo)
     Include both `https://thestandingchair.com` and `https://www.thestandingchair.com` when the custom domain is live, plus the current `*.lovable.app` preview.
3. Enable **Google** as an Auth provider (Lovable broker). Authorized JavaScript origins and redirect URIs in Google Cloud must include the same origins. Sign-in uses `prompt=select_account`.
4. Smoke:
   - Email sign-up → confirmation mail arrives from the branded sender (Section 7) → link lands on this app, not an error page.
   - Google sign-in reaches `/account` or `/owner` as appropriate.
   - Forgot password → `/reset-password` works with a valid recovery session.

---

## 7. Email domain

Transactional mail uses Lovable Email:

- Sender subdomain (DNS): `notify.pandagentic.ai` — **must** stay the delegated Lovable nameserver subdomain. Never send from the root domain as `SENDER_DOMAIN`.
- From header domain: `pandagentic.ai`
- Code: `src/lib/email-templates/send-email.ts`

**You (Lovable AI) must:**

1. In Lovable Email / DNS instructions, confirm `notify.pandagentic.ai` is **verified**. If it is still pending, stop feature work and give the human the exact DNS records to add. Surveys will 501 / `email_status=blocked` until this is live (`docs/SETUP-FEEDBACK.md`).
2. Send a test:
   - Auth confirmation or magic link
   - Owner welcome (new shop)
   - One survey invite (after a completed booking old enough for the job, or by invoking `send-surveys` with `JOB_SECRET`)
3. If `/api/public/emails/survey-invite` returns 501, email is not ready — do not “fix” that by bypassing `JOB_SECRET`.

---

## 8. Google Maps

Follow `docs/SETUP-MAPS.md`.

**You (Lovable AI) must:**

1. Confirm `GOOGLE_MAPS_API_KEY` is set on the **server**.
2. In Google Cloud, enable **Maps Embed API** (JavaScript API alone is not enough).
3. Website referrer list must include:
   - `https://*.lovable.app/*`
   - `https://thestandingchair.com/*`
   - `https://www.thestandingchair.com/*`
4. Do **not** use IP restrictions; the embed probe is server-side with a browser Referer.
5. Open a public shop page with an address. Expect an embed, not only the “View on Google Maps” fallback card. If you see the card, it is almost always 403 from key restrictions — fix the key, not the React component.

---

## 9. Google Calendar (App User Connector)

This is **not** “Sign in with Google”. Follow `docs/SETUP-CALENDAR.md`.

**You (Lovable AI) must:**

1. Confirm Google Cloud: Calendar API on; OAuth **Web application** client; **Authorized redirect URI** exactly:

   ```text
   https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
   ```

   Do not put the shop origin here.

2. In Lovable: **Settings → Connectors → App User Connectors → Google Calendar**, client id/secret, **offline access**.
3. Confirm `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` and `APP_USER_CONNECTION_KEY_SECRET` are set. Do not rotate the encryption secret on production without a reconnect plan.
4. OAuth consent scopes:
   - `userinfo.email`, `userinfo.profile`
   - `calendar.events`, `calendar.readonly`
     While the consent screen is Testing, add each provider Gmail as a test user, or publish the app.
5. Smoke as a provider/owner: Calendar tab → connect → a **confirmed/paid** booking appears on Google Calendar. Unpaid Checkout holds must **not** sync. Diagnostics **Calendar outbox pending** should not grow without bound (the `booking-maintenance` job drains it).

---

## 10. Supabase advisors (security)

**You (Lovable AI) must:**

1. Run **Supabase Advisors** (security + performance) on the Cloud project.
2. Resolve every **security** finding that is still valid. Do not “fix” advisors by weakening RLS on `bookings`, `comp_codes`, `app_runtime_settings`, or `stripe_webhook_events`.
3. Expected locked-down objects (RLS on, no client policies): `comp_codes`, `app_runtime_settings`, `booking_calendar_outbox` (service_role only). Client access would be a regression — revert it.
4. `SECURITY DEFINER` on `validate_booking` and tokenized survey RPCs is intentional. If an advisor flags them, confirm `search_path` is set and grants are not to `anon`/`authenticated` except where the migration grants them on purpose.
5. Paste a summary: open findings (if any) and why each remaining one is accepted. Do not leave unexplained WARN/ERROR advisors.

---

## 11. Staging validation (must pass before live money)

Use the **published preview or custom-domain staging** with `PAYMENTS_ENV=sandbox`.

Work through this list as a real user. Fix bugs with **new commits**, not history rewrites.

- [ ] `/api/public/health` 200 and `/api/public/ready` 200
- [ ] `/` and `/auth` render
- [ ] Email sign-up + confirm + sign-in
- [ ] Google sign-in
- [ ] Owner onboarding creates a shop; public `/shop/{slug}` loads
- [ ] Customer books a slot; second overlapping book for the **same** provider is rejected
- [ ] Deposit or full prepay: sandbox Checkout completes; calendar shows confirmed; unpaid hold expires (wait or invoke `booking-maintenance`)
- [ ] Owner cancel/reschedule respects shop policy
- [ ] Analytics subscribe trial with test card; `/owner/feedback` unlocks; webhook row `completed`
- [ ] Connect Express onboarding (sandbox) from Payments panel
- [ ] Survey email after a completed visit (or job invoke); `/survey/{token}` submits once; reuse is rejected
- [ ] Google Calendar connect + one confirmed booking synced
- [ ] Map embed on the public shop page
- [ ] `/owner/diagnostics`: jobs not all `paused`; webhook failed count explained
- [ ] Response headers on the **published** origin (not only local Vite): `x-request-id`, `content-security-policy`, `referrer-policy`, `x-content-type-options`. `strict-transport-security` appears only on **HTTPS**.

```bash
curl -sI "$APP_URL/api/public/health"
```

If staging fails, **do not** set `PAYMENTS_ENV=live`.

---

## 12. Production payments switch (live)

Only after Section 11 is green and the human explicitly asks for live charges.

**You (Lovable AI) must:**

1. Complete Lovable Payments **go-live** (live Stripe connection, live webhook secret).
2. Register live webhook:

   ```text
   https://thestandingchair.com/api/public/payments/webhook?env=live
   ```

   Query `env=live` must match `PAYMENTS_ENV`.

3. Set **together**, then redeploy:
   - `PAYMENTS_ENV=live`
   - `VITE_PAYMENTS_ENV=live`
   - `STRIPE_LIVE_API_KEY` (connection id)
   - `PAYMENTS_LIVE_WEBHOOK_SECRET`
   - `VITE_PAYMENTS_CLIENT_TOKEN` (live client token)
   - `APP_URL=https://thestandingchair.com`
4. Update Vault cron target if it still points at a preview host:

```sql
update public.app_runtime_settings
set value = 'https://thestandingchair.com', updated_at = now()
where key = 'app_url';
```

5. Confirm `/owner/diagnostics` shows **live** and Ready. Do a **$1 or lowest** live smoke only if the human authorizes it; otherwise confirm webhook ping + diagnostics without charging a real customer.

---

## 13. Custom domain, TLS, DNS, canonical origin

Canonical share/QR origin is hardcoded in `src/lib/site-origin.ts` as `https://thestandingchair.com`. **If the live host is not that name, you must change `CANONICAL_ORIGIN` in a new commit in the same change as DNS.** Do not leave QR codes pointing at the wrong TLD.

**You (Lovable AI) plus the human (DNS registrar):**

1. Attach `thestandingchair.com` and `www` in Lovable / Cloudflare. HTTP must redirect to HTTPS at the edge.
2. `APP_URL` must be `https://thestandingchair.com` (not www) unless you also change code and Stripe return URL construction — pick one canonical host and stick to it. Prefer apex as in `CANONICAL_ORIGIN`; 301 www → apex or the reverse, but `APP_URL` and `CANONICAL_ORIGIN` must agree.
3. Auth redirect allowlist includes both www and apex if both answer.
4. Verify TLS (valid cert, full chain). Then:

```bash
curl -sI https://thestandingchair.com/api/public/health
```

Expect HSTS, CSP, referrer-policy, nosniff, `x-request-id`.

5. Finish `notify.pandagentic.ai` DNS if still pending (Section 7).

---

## 14. Monitoring, backups, rollback (ops)

Follow `docs/OPERATIONS.md`. Lovable AI should **configure what the platform allows** and give the human the rest as a punch list.

### Uptime

Point an external checker (Cloudflare, Better Stack, Checkly, etc.) at:

1. `GET https://thestandingchair.com/api/public/health` every 60s — fail if not 200 or `status` ≠ `ok`.
2. `GET https://thestandingchair.com/api/public/ready` every 5 minutes — fail if not 200. Page a human; other routes 503 when payments env is incomplete.

Do **not** use `/` as the only probe.

### Logs and alerts

Worker logs are JSON lines from `src/lib/log.ts`. Configure the Lovable/Cloudflare log drain to alert on:

- `"level":"error"`
- `"event":"job.alert"`

Never log `Authorization`, `JOB_SECRET`, or raw webhook bodies (the code already redacts common secrets; do not add debug prints that dump env).

### Backups

In Supabase/Lovable Cloud: confirm **daily backups** (or PITR). Tell the human to restore into a **separate** project once per quarter — do not restore over production as a test.

### Rollback

If a publish is bad:

1. Promote the previous successful Lovable/Cloudflare deployment.
2. Fix Git with a **new** commit. No force-push.
3. Never edit old files in `supabase/migrations/`. Add a new migration if SQL must change.
4. Re-check `/api/public/ready` and the smoke list in `docs/OPERATIONS.md`.

---

## 15. Assets and leftover host-only pieces

1. Confirm the Pandagentic byline image actually renders on the live site. The repo may only contain `src/assets/pandagentic-mark.png.asset.json`; Lovable CDN must still serve `/__l5e/assets-v1/…` **or** commit a real PNG in a new commit if the byline is broken outside the editor.
2. Do not delete MCP routes (`/mcp`, `/.mcp/*`) unless the human asks; they are part of the shipped surface.
3. Leave `n8n workflow/` alone; in-app jobs replaced n8n.

---

## 16. Definition of done

The app is **production ready** only when **all** of the following are true:

| Gate                         | Evidence                                             |
| ---------------------------- | ---------------------------------------------------- |
| Git is Phase 10+             | Health/ready routes, job Bearer auth, webhook ledger |
| Migrations applied           | Four cron jobs via `invoke_feedback_job`             |
| Jobs authenticated           | Publishable key → 401; `JOB_SECRET` → 2xx            |
| Vault + `app_url`            | `invoke_feedback_job` does not raise                 |
| Sandbox payments ready       | `/api/public/ready` 200; diagnostics Ready           |
| Staging smoke                | Section 11 all checked                               |
| Advisors                     | No unexplained security findings                     |
| Email verified               | Auth + survey mail delivered                         |
| Auth redirects               | Email confirm + Google work on the live origin       |
| Calendar + maps              | One sync + embed (or explicitly deferred by human)   |
| Live switch (if charging)    | `PAYMENTS_ENV=live` only after staging               |
| DNS/TLS/headers              | curl on `thestandingchair.com`                       |
| `APP_URL` = canonical origin | Matches `CANONICAL_ORIGIN`                           |
| Uptime + backups             | Probes and backup setting confirmed                  |
| No secret in Git             | `.env` / Vault values not committed                  |

When you finish, reply with a short status: each section number, **done / blocked / skipped (reason)**, and any human actions still required (DNS records, Stripe identity, Google consent publish, uptime account).

Do not mark the product production-ready if `/api/public/ready` is 503 or jobs still accept the publishable key.
