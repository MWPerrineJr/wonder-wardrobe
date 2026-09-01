# Pandagentic logo + welcome email for new shop owners

## 1. Company mark (tab icon + byline)

- Generate a clean, flat panda mark inspired by the uploaded matrix panda: simple green/black silhouette, square, legible at 16px.
- Use it as the browser tab icon, replacing the Lovable favicon (and remove the old `favicon.ico` so nothing stale is served).
- Show the same mark as a small icon next to "built by pandagentic.ai" in the byline under "The Standing Chair", so every page header carries it (the byline component is shared across the marketplace, shop, and demo pages).

## 2. Welcome email to new shop owners

- One friendly, welcoming thank-you email, sent automatically the moment someone finishes creating their first shop.
- From the Pandagentic sender with replies going to michael@pandagentic.ai, signed by Michael.
- Content: thanks for joining The Standing Chair, what they can do next (add services, set hours, share their booking link), and an invitation to reply with questions.
- Sent once per owner; a delivery failure never blocks shop creation.

### Needs your action first

This project has no sender domain configured yet, so no email can leave the app. After the code is in place I'll open the email setup dialog so you can connect **pandagentic.ai** as the sender domain here (a live Lovable site on that domain isn't the same as email being set up). Once DNS verifies, welcome emails start sending automatically; until then they are queued/logged rather than lost.

## Technical notes

- New asset: generated panda mark saved to `public/` for the favicon plus a CDN asset pointer for the in-app byline; favicon `<link>` updated in `src/routes/__root.tsx`; icon added to `src/components/site-brand.tsx`.
- Email: after the domain is connected, run email infrastructure setup, then scaffold app-email support and add an `owner-welcome` React Email template in `src/lib/email-templates/` registered in the template registry.
- Trigger: `createOwnerShop` in `src/lib/owner.functions.ts` sends the welcome email after the shop row is created, keyed by shop id for idempotency, wrapped so send errors are logged only.
- Reply-to and sender label come from `src/lib/support.ts` (`OWNER_CONTACT_EMAIL`, `SENDER_LABEL`).
