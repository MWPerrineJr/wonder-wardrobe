# Final readiness check before deploy

## What I already verified (read-only, just now)

| Check | State |
|---|---|
| Build | `build OK`, no errors |
| Git working tree | Clean — no uncommitted changes; latest commit `f43a843 Completed ops layer docs` |
| `/api/public/health` | 200 `{"status":"ok"}` |
| `/api/public/ready` | 200, `payments:"ok"`, `environment:"live"`, `issues: []` |
| Cron jobs | 4 jobs, all active, all via `public.invoke_feedback_job(...)` — no keys in SQL |
| `app_runtime_settings.app_url` | `https://thestandingchair.com` |
| Stripe go-live | All 5 steps completed; live account `acct_1U5SYo…` ready |
| Email sender `notify.pandagentic.ai` | Verified, auth emails enabled |
| Security scans | No open findings, but every scanner is marked out-of-date (last runs Aug 18 – Sep 1) |

So nothing is currently blocking. The remaining work is fresh verification plus the deploy itself.

## Plan

1. **Fresh security scan** — re-run the scanners (they are stale) and report any finding, with the RLS-no-policy warnings on the intentionally locked internal tables explained rather than "fixed".
2. **Database advisors** — run the Supabase linter and account for each remaining item (locked internal tables, intentional `SECURITY DEFINER` functions).
3. **Live smoke tests against the running app**
   - All four job routes: publishable key or no token → 401; real `JOB_SECRET` → 2xx.
   - `select public.invoke_feedback_job('booking-maintenance')` returns a request id.
   - Home, `/auth`, `/shop`, a shop page, `/owner` render without console or runtime errors.
   - Response headers on the published origin: `x-request-id`, CSP, `referrer-policy`, `x-content-type-options`, HSTS.
4. **Head metadata sweep** — confirm every content route has its own title/description/OG tags and none carry template defaults.
5. **Tests + typecheck** — run the existing unit tests (`jobs.auth`, `return-path`) and a TypeScript check.
6. **Publish** — deploy the current commit and confirm the published origin serves the new build (health + ready green on the live domain, not just locally).
7. **GitHub sync report** — the workspace tree is clean and committed, so there is nothing local left to push. Repo mirroring to your GitHub account is done by the Lovable GitHub integration; I will confirm the latest commit here and tell you exactly what to check on GitHub's side if the newest commit isn't visible there.

## What stays as-is unless you say otherwise

- `PAYMENTS_ENV` remains `live` (live keys and webhook secret are fully configured, go-live is complete). No real charge will be made during testing.
- No schema changes, no changes to generated backend files, no credential rotation.

## Human items I cannot do

Any Google Cloud console changes (Maps referrer list, OAuth consent publish), Stripe dashboard identity items, external uptime monitor setup, and backup/PITR confirmation. If any of these are still open after the checks, you get them as a short punch list with exact values.
