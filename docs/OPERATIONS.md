# Operations

Production failures should be detectable from logs, diagnosable with a request
id, and recoverable without rewriting Git history.

## Health and readiness

| Endpoint                 | Meaning                                             | Success                                                         |
| ------------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/public/health` | Process is up. Does **not** check Stripe or env.    | `200` `{ "status": "ok" }`                                      |
| `GET /api/public/ready`  | Payments config is complete enough to take traffic. | `200` `{ "status": "ok" }` or `503` `{ "status": "not_ready" }` |

Health always returns 200 even when Stripe keys are missing. Point uptime
probes at **health**. Point "can we charge money" probes at **ready**.

Both paths bypass the payments fail-closed 503 in `src/server.ts` and
`src/start.ts`. Production responses also include `x-request-id` and the
security headers listed below.

## Structured logs and correlation

Server logs are one JSON object per line (`src/lib/log.ts`). Secrets (Stripe
keys, webhook secrets, bearer tokens) are redacted before write.

Correlate a user report with:

1. The `x-request-id` response header (or Cloudflare `cf-ray`, which is reused
   when `x-request-id` is absent).
2. The same `request_id` field on `level: "error"` lines.

Background jobs log `component: "jobs"` with `event` values such as
`job.auth`, `job.skipped`, `job.alert`. Job errors are redacted the same way.
Never log `Authorization`, `JOB_SECRET`, or raw webhook bodies.

## Error tracking and alerts

There is no third-party APM in this repo. Treat stdout/stderr JSON as the
source of truth (Cloudflare Workers / Lovable log drain).

Alert on:

- Any log line with `"level":"error"`.
- `"event":"job.alert"` (paused circuit breaker or repeated failures).
- `GET /api/public/ready` leaving 200 for more than a few minutes.
- Owner diagnostics showing webhook rows stuck in `processing` or `failed`,
  or `calendarOutboxPending` growing.

SSR crashes that h3 would otherwise swallow as `{"unhandled":true}` are
rewritten to the HTML error page in `src/server.ts`.

## Webhook and job dashboard

Shop owners can open `/owner/diagnostics` to see:

- Payments environment and missing config.
- Stripe webhook counts: processing, failed, completed in the last 24 hours.
- Pending Google Calendar outbox rows.
- Background job state (`ai_job_state`): status, last run, last error,
  consecutive failures.

Use Stripe Dashboard → Developers → Webhooks for delivery retries. Use this
page to see whether our app accepted and finished those events.

## Uptime monitoring

Configure an external checker (Better Stack, Checkly, Cloudflare, etc.):

1. `GET https://thestandingchair.com/api/public/health` every 60s. Fail on
   non-200 or body `status` not `ok`.
2. `GET https://thestandingchair.com/api/public/ready` every 5 minutes. Fail on
   non-200. Page the on-call if this stays down — the site will 503 other
   routes when payments config is incomplete.

Do not use `/` alone as the only probe: a payments misconfig still serves
health, so `/` 503s while health stays green.

## Backups and restore verification

Supabase is the system of record.

1. Confirm the project has **daily backups** (or PITR on a paid plan) in the
   Supabase dashboard.
2. Once per quarter, restore a backup into a **separate** project or branch,
   run `npm run test:db` against it (or replay `supabase/tests/`), and confirm
   a shop, booking, and webhook event row still exist.
3. After restore, rotate any credentials that were copied with the dump.
4. Application deploys do not replace database backups. Rolling back code does
   not undo Stripe charges or booking rows.

## Deployment rollback

This project is connected to Lovable. **Do not force-push, rebase, or amend
commits that are already on the remote** — that rewrites history on Lovable's
side.

To roll back a bad production deploy:

1. In Lovable / the Cloudflare project, promote the previous successful
   deployment.
2. If the bad change is already on the connected Git branch, revert it with a
   **new** commit (`git revert`) and push. Do not rewrite the branch.
3. If a migration went out with the release, do **not** edit published
   migration files. Add a new forward migration that restores the previous
   behavior, then deploy that.
4. Confirm `/api/public/ready` is 200 and run the smoke checklist below.

## Post-deployment smoke checklist

Run against the live origin after every production deploy:

- [ ] `GET /api/public/health` returns 200.
- [ ] `GET /api/public/ready` returns 200.
- [ ] `/` and `/auth` render (not the HTML 500 page).
- [ ] Owner diagnostics (`/owner/diagnostics`) shows the expected
      `PAYMENTS_ENV` (sandbox vs live).
- [ ] Create a sandbox Checkout session from a test shop (or confirm the last
      webhook in Stripe Dashboard is `completed` on diagnostics).
- [ ] Sign-in with Google still reaches `/account` or `/owner`.
- [ ] A test booking hold still appears on the shop calendar.
- [ ] Response headers include `x-request-id`, CSP, HSTS, and referrer-policy
      (see below).

## CSP, HSTS, referrer policy, TLS, DNS, canonical origin

Production `src/server.ts` sets these on every response (HTTPS only for HSTS):

- `content-security-policy` — `src/lib/security-headers.ts`
- `strict-transport-security` — `max-age=63072000; includeSubDomains; preload`
- `referrer-policy` — `strict-origin-when-cross-origin`
- `x-content-type-options` — `nosniff`
- `x-frame-options` — `SAMEORIGIN`

Verify on the live host (not `vite` / Playwright on port 4173 — that path does
not use `src/server.ts`):

```bash
curl -sI https://thestandingchair.com/api/public/health
```

Expect `strict-transport-security`, `content-security-policy`,
`referrer-policy`, and `x-request-id`. Confirm the certificate is valid and
the chain is complete (`curl -v` or SSL Labs).

DNS:

- Apex `thestandingchair.com` and `www` should both reach this app.
- Share links, QR codes, and calendar UIDs use
  `https://thestandingchair.com` (`src/lib/site-origin.ts`). If that host
  changes, update `CANONICAL_ORIGIN` in the same commit as DNS.
- `APP_URL` must be that same canonical origin in production. Return URLs and
  survey links are built from it (`docs/SETUP-BILLING.md`).
- Mail sender domain `notify.pandagentic.ai` must stay delegated as documented
  in the email templates.

TLS: HTTPS only in production. HTTP should redirect to HTTPS at the edge.
HSTS is not set on local `http://` so development is not pinned.
