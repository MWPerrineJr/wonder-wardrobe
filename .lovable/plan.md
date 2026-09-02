# Switch support email to support@pandagentic.ai

Replace `support@thestandingchair.com` with `support@pandagentic.ai` everywhere the app shows or uses a support address.

## What changes

- The support address shown in the site footer, account menu, and public shop pages.
- The Reply-To address on outgoing client emails, so replies land in the Pandagentic mailbox.
- The support address referenced in the email templates' brand footer.
- The Support inbox page copy in the owner dashboard, which names the mailbox to connect.

Your direct owner contact (`michael@pandagentic.ai`) and the "product of Pandagentic" footer stay as they are.

## Technical details

- `src/lib/support.ts`: `SUPPORT_EMAIL = "support@pandagentic.ai"` (the derived `SUPPORT_MAILTO` follows automatically).
- `src/lib/email-templates/brand.ts`: `supportEmail` updated to match.
- No other code hardcodes the old address; everything else reads these two constants.

## Follow-up on your side

Because the Gmail connection currently authorized is `michael@pandagentic.ai`, either add `support@pandagentic.ai` as an alias or group that delivers into that mailbox, or reconnect the Support inbox with the support account — otherwise the Support page will keep showing the michael@ inbox.
