# Owner contact page + Pandagentic footer

Add a direct business contact email for shop owners and surface Pandagentic branding in the site footer.

## 1. Contact constants

Extend `src/lib/support.ts` with the owner-facing business email:

- `OWNER_CONTACT_EMAIL = "michael@pandagentic.ai"`
- `OWNER_CONTACT_MAILTO = "mailto:michael@pandagentic.ai"`

## 2. Owner contact page

Create `src/routes/_authenticated/owner_.contact.tsx`:

- Head metadata: title/description/og tags for "Contact — Shop Owner Dashboard — The Standing Chair".
- Reuse the owner dashboard header from `src/routes/_authenticated/owner.tsx` (Dashboard, Analytics, Feedback, Plans, Contact) so the page feels like part of the owner area.
- Centered card layout:
  - Heading: "Questions about owning a shop?"
  - Body text explaining owners can reach Michael directly for partnership, billing, or platform questions.
  - Primary CTA button: "Email michael@pandagentic.ai" linking to `OWNER_CONTACT_MAILTO`.
  - Secondary note: replies go to the same address.
- Authenticated-only route (inherits `_authenticated` layout).

## 3. Footer update

Update the existing footer in `src/routes/index.tsx`:

- Replace the current "© 2024 The Standing Chair SaaS. All rights reserved." line with:
  - "The Standing Chair is a product of Pandagentic"
  - "Pandagentic" is a link to `https://pandagentic.ai` opening in a new tab with `rel="noopener noreferrer"`.
- Keep the existing Privacy Policy, Terms of Service, Demo, and Contact support links.

## 4. Optional shared footer

If other public routes (shop, demo, provider) should also display the Pandagentic footer, extract the footer markup into `src/components/site-footer.tsx` and import it on each public page. Otherwise, the change stays scoped to the home page footer only.

## Out of scope

- No backend/schema changes.
- No email sending configuration changes; this only adds a `mailto` contact link.
