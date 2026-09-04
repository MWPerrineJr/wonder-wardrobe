# Health check: what I verified and what's left

## Verified just now (no fixes needed)

- Code check: zero errors.
- Test suite: 107 of 107 passing.
- Every public page loads on the live site and in preview: home, owners campaign page, shop list, sign in, provider, demo, password reset. A made-up address correctly shows the 404 page.
- Health and readiness checks both report healthy.
- Every in-app link points at a page that exists — no dead links.
- No build errors, no page errors, no error messages in the browser log.

## What has not been checked

Everything behind sign-in was skipped because the preview is currently signed out: the owner dashboard and its tabs, analytics, feedback, subscribe, support, contact, diagnostics, the account page, the admin owners page, provider schedule, and the shop setup form. Signed-out visits to those correctly bounce to sign in, which is all that can be confirmed without a session.

## Proposed verification sweep

1. You sign in once in the preview so a session is available.
2. Walk each signed-in page and confirm it renders with real data and no errors: owner dashboard (details, categories, services, hours, payments, links, share), analytics with charts and AI insights, feedback, subscribe tiers, support, contact, diagnostics, account, admin owners, provider schedule.
3. Walk one full booking on a real shop page, plus the map area and the add-to-calendar action.
4. Click through every campaign link end to end and confirm the "How did you hear about us?" answer is pre-selected.
5. Report anything broken before changing it, then fix only what is confirmed broken.

## Technical notes

- Checks run: `tsgo --noEmit`, `npm test`, HTTP status sweep on preview and both custom domains, link-target audit against the route files, and a scan of build/runtime/console logs.
- No code changes are part of this plan; fixes would be proposed separately once a signed-in pass turns up an actual defect.
