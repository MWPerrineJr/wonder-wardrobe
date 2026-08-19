# App health review — findings and fixes

I loaded every route in a real browser and typechecked the project. Types pass with zero errors, and all public pages render live content. Three real issues surfaced, plus one thing I could not verify.

## What is healthy

- `/` marketplace, `/shop`, `/shop/mike-s-dudes`, `/auth`, `/provider` all return 200 and render real database content (Mike's Dudes, Mikes Cuts).
- Owner routes (`/owner`, `/owner/analytics`, `/owner/feedback`, `/owner/subscribe`, `/account`) correctly redirect to sign-in when signed out — the auth gate works.
- Typecheck: clean. No console errors on the marketplace, shop list, shop detail, auth or provider pages.

## Issue 1: shop map tile fails to load (403)

The public shop page requests a Google Maps embed and Google rejects it with 403, so the map area shows Google's error frame instead of the shop location. The key is present; Google is refusing it (Maps Embed API not enabled for that key, or an HTTP-referrer restriction that excludes the preview/published domains).

Fix: keep the request but handle rejection gracefully — render a styled "View on Google Maps" card with a static address link when the embed cannot load, so no broken frame is ever shown. Also document the exact key setting to change.

## Issue 2: hydration warning when redirecting to sign-in

Opening a protected owner route while signed out logs a React hydration mismatch on the sign-in page. Functionally the redirect works, but it forces React to throw away and re-render the tree.

Fix: make the sign-in page render a single stable shell during the first paint and only swap in auth-state-dependent content after hydration, so server and client markup agree.

## Issue 3: no verification coverage for the paid/owner surfaces

The three new feature areas you called out — the analytics dashboard, the social-links tab, and the three subscription tiers — all live behind sign-in, and the preview session is signed out, so nothing there has been exercised end to end. Database state also shows zero subscription rows and zero comp grants, so the paid paths have never been run against real data.

Fix (after you sign in to the preview once):
- Walk the owner dashboard tab by tab: details, categories, services, hours, payments, links, share/QR, and the setup tour.
- Save real social links and confirm they persist and appear on the public shop page.
- Load `/owner/analytics` both without a plan (should show the upgrade panel) and with access, checking every chart renders with real bookings and does not break on empty ranges.
- Load `/owner/subscribe` and confirm Free, Solo ($120/mo, $1,000/yr), Team ($200/mo, $2,000/yr) and Enterprise ($250/mo, $2,500/yr) all appear with the right recommendation for the shop's provider count, the 1-month trial copy is present, and the comp-code form redeems.

## Technical notes

- Files touched by the fixes: `src/components/shop-map.tsx` (embed failure fallback) and `src/routes/auth.tsx` (hydration-safe first paint). No database or business-logic changes.
- Analytics/subscription/social-links code is unchanged by this plan unless the signed-in pass turns up a defect; anything found there gets reported before it is changed.
