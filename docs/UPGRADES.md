# Upgrades and dependency policy

## Cadence

- **Weekly:** `bun update --dry-run` review; apply patch-level updates.
- **Monthly:** minor versions for non-framework packages; run the security
  dependency scan.
- **Quarterly:** major versions, one package family per pull request.
- **Immediately:** anything with a known high/critical advisory.

## Runtime constraints that gate every upgrade

The server runs on a Cloudflare-style worker, not Node. Before adding or
upgrading a dependency that runs server-side, confirm it does not need native
addons, `child_process`, `fs.watch`, or runtime module resolution. Symptoms of
a bad pick: `[unenv] X is not implemented yet!`, `__dirname is not defined`, or
"works in dev, fails in production".

## Pinned families — upgrade deliberately

| Family | Why it is sensitive |
|---|---|
| `@tanstack/react-start`, `@tanstack/react-router` | Route tree and server-function APIs change together; upgrade both, then re-check every `createFileRoute` path. |
| `react`, `react-dom` | Must move together; watch for hydration regressions on `/` and `/shop/$slug`. |
| `stripe` | `apiVersion` in `src/lib/stripe.server.ts` is pinned; bump it only after reading the Stripe changelog for checkout and Connect. |
| `@supabase/supabase-js` | Auth/claims behaviour is relied on by `auth-middleware.ts`. |
| `tailwindcss` v4 | Theme tokens live in `src/styles.css`; no `tailwind.config.js`. |
| `recharts` | Analytics charts; check responsive scaling after upgrades. |

Generated files are never edited by hand: `src/routeTree.gen.ts`,
`src/integrations/supabase/types.ts`, and the other generated Supabase
integration modules.

## Procedure

1. Branch, upgrade one family, `bun install`.
2. Typecheck and run tests (`bunx vitest run`).
3. Smoke the critical paths: sign in, browse a shop, book with a deposit,
   cancel, owner dashboard, analytics, feedback, calendar sync.
4. Confirm `/api/public/ready` still returns `200`.
5. Run the security dependency scan.
6. Deploy to preview, verify `/owner/diagnostics`, then publish.

## Database migrations

Migrations are additive and forward-only. Never edit an applied migration; add
a new one. Any new `public` table needs `GRANT`s plus RLS policies in the same
migration, and time-dependent rules use triggers rather than `CHECK`
constraints.

## Rollback

Redeploy the previous build. Because migrations are additive, an older build
runs against the newer schema. If a release must be stopped mid-incident,
pause the jobs in `public.ai_job_state` and set `PAYMENTS_ENV=sandbox`.
