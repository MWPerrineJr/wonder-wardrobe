# Fix translucent top-right account/settings menu

## What changes

Make the account/settings dropdown in the top-right header opaque and easy to read on the published site.

1. Add missing shadcn popover tokens to `src/styles.css`
   - `--color-popover`: solid warm surface white (`#ffffff`)
   - `--color-popover-foreground`: ink (`#1c1917`)
   - Also add related tokens that dropdowns/hover states rely on: `--color-accent`, `--color-accent-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-border`, `--color-input`, `--color-ring`
   - Values drawn from the existing Warm Stone palette so the menu matches the rest of the app.

2. Harden `src/components/account-nav.tsx`
   - Add explicit `bg-popover text-popover-foreground` (or `bg-surface text-on-surface`) to both signed-in and signed-out `DropdownMenuContent` instances.
   - Ensure dropdown items have readable hover/focus states using the new accent tokens.

3. Verify
   - Open the account menu in the preview and confirm the background is fully opaque and text is legible.
   - Run typecheck/build to confirm no regressions.

## Out of scope

- No changes to menu options, navigation, or functionality.
- No changes to other components unless they share the same popover-token gap.
