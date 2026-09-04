# Dead code cleanup

Remove code and files that nothing in the app uses, without changing any behaviour. Every item below was confirmed unreferenced outside its own file (and its own test).

## 1. Stale root/asset files

- `n8n workflow/survey-sender.workflow.json` — the survey sender is the internal job at `src/routes/api/public/jobs/send-surveys.ts`; this export is unused.
- `DEPLOYMENT_FIX_PLAN.md`, `SESSION_LOG_2026-09-02.md` — completed one-off session notes.
- `design/carbon-rust-theme.css` — duplicate of the live tokens in `src/styles.css`, imported by nothing.
- `package-lock.json` — the project uses `bun.lock`; keeping both invites drift.
- `tsconfig.tsbuildinfo` — build cache checked into the tree; also add it to `.gitignore`.
- `src/assets/pandagentic-mark.png.asset.json` — leftover asset stub referenced only in a doc.

## 2. Dead module

- `src/lib/return-path.ts` + `src/lib/return-path.test.ts` — fully superseded by `src/lib/return-url.ts`, which is what `booking.functions.ts` and `billing.functions.ts` actually import.

## 3. Unused exported helpers (delete the function, keep the file)

- `src/lib/provider.functions.ts`: `getMyProviderDay`, `updateMyProviderProfile`
- `src/lib/owner.functions.ts`: `listSurveyInvites`
- `src/lib/shops.functions.ts`: `updateShopCategories`
- `src/lib/booking-hold.ts`: `providerHasConflict`, `shopHasCapacity`
- `src/lib/jobs.server.ts`: `acquireLease`, `releaseLease`
- `src/lib/stripe.server.ts`: `getConnectionApiKey`
- `src/lib/support-inbox.server.ts`: `headerValue`, `extractBody`
- `src/lib/survey-email.server.ts`: `surveyUrl`
- `src/lib/calendar.ts`: `toUtcStamp`; `src/lib/cancellation.ts`: `hoursUntil`
- `src/lib/categories.ts`: `categoryIcon`, `SERVICE_CATEGORY_VALUES`
- `src/lib/stripe.ts`: `ANALYTICS_PLAN`
- `src/components/analytics/shared.tsx`: `changePct`
- `src/components/demo-tour.tsx`: `DEMO_STEPS`
- `src/components/analytics-upgrade-panel.tsx`: `CompCodeForm`, `CheckoutForm` stay but lose their `export` (used only inside the file)

Unused exported _types_ stay as they are — they cost nothing and removing them churns public shapes.

## 4. Unused UI kit files

30 shadcn components in `src/components/ui/` are imported nowhere (accordion, alert, aspect-ratio, avatar, breadcrumb, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, sidebar, slider, switch, table, textarea, toggle-group). Default: leave them in place, since they are the design-system kit and are cheap to reuse later (tree-shaking keeps them out of the bundle). Say the word and I delete them in the same pass.

## Verification

Typecheck, run the unit test suite and the migration check script, confirm the build log is clean, and load `/`, `/shop`, `/owner`, `/owner/analytics`, `/admin/owners` locally before finishing. No database migrations and no behaviour changes are part of this.
