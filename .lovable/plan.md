# "How did you hear about us?" on owner onboarding

Add a single self-reported attribution question to the shop setup form, store it with the owner signup record, and show the breakdown on the admin owners page.

## What the owner sees

On `/onboarding/owner`, below Address (before Description), a new optional question:

- Label: "How did you hear about us?" with a "Optional" hint
- Choices rendered as the same pill buttons already used for Categories, single-select: LinkedIn, Instagram, Facebook, TikTok, Google search, Referral, Other
- Picking "Other" or "Referral" reveals a short free-text box ("Tell us more — optional", max 120 chars)
- Leaving it blank never blocks submission

## What you see

On `/admin/owners`:

- A new "How they heard" summary strip above the table: count per source, highest first, with a blank/unknown bucket
- A new "Source" column in the table showing the chosen source, with the free-text detail as hover title when present
- The existing state filters stay as they are

## Technical notes

- Migration: add `heard_about` text and `heard_about_detail` text to `public.owner_signups`, both nullable, with a CHECK constraint limiting `heard_about` to `linkedin | instagram | facebook | tiktok | google | referral | other`. No new table, no policy changes (existing owner-read + admin-read SELECT policies and the client-write denials already cover the new columns).
- `src/lib/attribution.ts` (new): the `HEARD_ABOUT_SOURCES` list (value + label) shared by the form and the admin page, so the options can never drift from the DB constraint.
- `src/lib/owner.functions.ts`: extend `CreateShopInput` with optional `heard_about` (Zod enum from that list) and `heard_about_detail` (trimmed string, max 120, nullable); pass both into the existing non-blocking `owner_signups` insert. Shop creation still succeeds if tracking fails.
- `src/routes/_authenticated/onboarding.owner.tsx`: two pieces of local state, the pill group + conditional detail input, and both values added to the `createOwnerShop` call.
- `src/lib/admin.functions.ts`: select the two new columns, return `heardAbout`/`heardAboutDetail` on each row plus a `sources` array (`{ value, label, count }`, sorted desc, unknown last) in the DTO so the browser gets finished numbers.
- `src/routes/_authenticated/admin_.owners.tsx`: render the summary strip and the Source column using semantic tokens already in use.
- Verification: typecheck, existing tests, build, and a quick check that the onboarding form submits with and without the field set.
