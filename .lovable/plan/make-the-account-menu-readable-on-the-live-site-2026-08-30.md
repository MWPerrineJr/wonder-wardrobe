# Make the account menu readable on the live site

Your screenshot is from thestandingchair.com, where the account menu still shows faded, hard-to-read options ("Owner dashboard", "Become a shop owner", "Test Google sign-in", "Sign out").

## What's going on

The readability fix is already in the project but not on your live site. I checked the published stylesheet at thestandingchair.com: it does not contain the opaque menu color values (`--color-popover` and friends) that the current code defines. The live site is still serving the older build from before that fix.

## What I'll do

1. Publish the app so the live site picks up the current build, which includes:
   - opaque menu background and solid border
   - full-contrast text for every menu option
2. After publishing, re-check the live page and confirm the menu renders solid and legible.

No new code changes are needed for this — the fix exists; it just needs to ship. If the menu still looks faded after publishing, I'll dig into the menu component's open/close transition as the next suspect.

## Technical details

- Verified: `src/styles.css` defines `--color-popover`, `--color-popover-foreground`, `--color-accent`, `--color-accent-foreground`; `src/components/account-nav.tsx` applies `bg-popover text-popover-foreground border-border` to both dropdown panels.
- Verified: the published CSS bundle served from thestandingchair.com has no `--color-popover` declaration, so `bg-popover` resolves to nothing there.
- Action: publish; the custom domain serves the new deployment a couple of minutes after the Lovable URL.
