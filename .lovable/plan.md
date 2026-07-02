## Switch Crown & Cut to a light theme

### Goal
Move the whole app from the current near-black dark theme to a clean light theme, keeping all components readable and the gold/primary accent intact.

### What will change

1. **Global design tokens (`src/styles.css`)**
   - Flip background/surface colors to light values (`#f5f5f5` background, `#ffffff` elevated cards).
   - Flip text colors to dark values (`#1a1a1a` primary text, muted grays for secondary).
   - Keep borders subtle (`#e0e0e0`).
   - Update base `html/body` and helper classes (`.glass-panel`, `.calendar-grid`, `.time-slot`) so they work on light backgrounds.

2. **Route files**
   - Replace hardcoded dark colors (`text-white`, `bg-[#0b0b0b]`, `bg-[#0F0F0F]`, `text-[#e2e2e2]`, `bg-surface-deep`) with semantic tokens (`text-on-surface`, `bg-surface-container-*`, `bg-background`).
   - Update hero overlays, gradients, and input backgrounds so they remain legible on light surfaces.
   - Keep the primary gold accent (`#D4AF37`) unchanged.

3. **Routes affected**
   - `/` — Marketplace
   - `/shop` — Booking page
   - `/barber` — Barber schedule
   - `/owner` — Owner dashboard

### Verification
- Run a type check / build to confirm no broken classes or imports.
- Open the preview to confirm text, cards, inputs, and calendar remain readable on the light background.

### Notes
- No backend or route changes; purely a visual/theme refactor.
- The mobile bottom nav and desktop top/side nav will also be lightened to match.