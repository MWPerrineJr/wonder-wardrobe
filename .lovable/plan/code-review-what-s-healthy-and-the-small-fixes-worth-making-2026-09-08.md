# Code review: what's healthy, and the small fixes worth making

## What I verified just now (read-only)

| Check | Result |
| --- | --- |
| Build | `build OK`, no errors |
| Type check | Clean |
| Code warnings (lint) | None |
| Tests | 111 pass, 0 fail (44 suites) |
| Public pages | Home, sign-in, shop list, owners landing, provider, demo, password reset, survey all load (200) |
| Old `/barber` address | Correctly forwards to `/provider` |
| Health + readiness checks | Both green, payments `ok`, no issues |
| Links & navigation | Every in-app link/redirect points at a page that exists |
| Database names | Every table, column, and function the code calls exists |
| Staff-only pages | Admin list and diagnostics correctly check staff status server-side and show a friendly message otherwise |

No broken code, no broken links, no failing pages. The findings below are small,
real, and none of them break the app today.

## Findings and proposed fixes

### 1. A shop's hidden services are readable by anyone (medium)

Confirmed by querying the live security rules: the `services` table allows
everyone to read every row, including services an owner has switched off
(`is_active = false`), plus their prices. The public shop page filters those out
for display, but the data itself is still fetchable directly.

Separately, the owner-facing `getShopDetail` (`src/lib/shops.functions.ts:108`)
looks a shop up by id only, with no check that the signed-in person owns it —
every other owner query in the project filters on the owner. Today that leaks
nothing beyond what is already public, but it breaks the pattern and would leak
as soon as the read rules are tightened.

Fix:
- Tighten the public read rule on `services` to active services only, and add a
  separate rule letting a shop's owner read all of their own services.
- Add the missing owner check to `getShopDetail` so it only ever returns a shop
  the caller owns.

### 2. Date computed during render can mismatch on first paint (low)

`src/components/booking-panel.tsx:275` builds the date picker's earliest allowed
day with `new Date()` inside the markup, on a page rendered on the server first.
Around local midnight the server and browser can disagree, producing a
first-paint mismatch. `src/routes/owners.tsx:166` has the same shape for the
footer year (harmless).

Fix: compute both once after load, the same way the timezone offset is already
handled a few lines above in the same file.

### 3. Internal consent screen has no page title (low)

`src/routes/[.]lovable.oauth.consent.tsx` renders real content but has no title
or description, and no instruction to keep it out of search results — unlike its
siblings.

Fix: add a title, description, and a no-index instruction.

### 4. One confusing thing that is not a bug

Running the `vitest` command reports all 22 test files failing with "no test
suite found". That is because this project's tests use Node's built-in test
runner (`npm test`), not vitest. Under the correct command everything passes.
Optional cleanup: remove the unused vitest dependency, or add a tiny vitest
config that points at the real runner, so nobody is misled again. I'd suggest
leaving it alone unless you want it tidied.

## Technical notes

- Security-rule change is a migration on `public.services`: replace the
  `Services are viewable by everyone` SELECT policy with one scoped to
  `is_active = true`, and add an owner SELECT policy via
  `exists (select 1 from shops s where s.id = services.shop_id and s.owner_id = auth.uid())`.
  Grants on `services` stay as they are.
- Before shipping the policy change I'll grep every `.from("services")` read
  path (public shop page, booking flow, demo, analytics, owner dashboard) and
  confirm none of them depends on reading inactive services as an anonymous
  visitor; owner-side reads are covered by the new owner policy.
- `getShopDetail`: add `.eq("owner_id", context.userId)` on the shop query and
  keep the existing "Shop not found" error so a non-owner learns nothing.
- Verification: `npm test`, `bunx tsgo --noEmit`, `bunx eslint .`, then reload
  the shop page, the booking flow, and the owner dashboard and confirm services
  still list correctly for owners and visitors.

## Not included

No redesign, no dependency upgrades, no changes to payments, email, or the
90-day trial logic.
