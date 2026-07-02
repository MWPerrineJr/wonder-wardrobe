## Verify `/onboarding/owner` end-to-end

### What exists today
- `createOwnerShop` server fn: grants `owner` role (idempotent), checks slug uniqueness, inserts a `shops` row. **Does not create any services.**
- `/onboarding/owner` form: collects name, slug, address, description; on success toasts and navigates to `/owner`.
- Route sits under `_authenticated/`, so unauthenticated users get redirected to `/auth`.

### Gap vs. your ask
You mentioned "creates my first shop **and services**". The current flow does not create services — only the shop + owner role. Two options:

- **A. Verify as-built** (shop + role + redirect only). Services get added later from the owner dashboard.
- **B. Extend onboarding** to also capture 1–3 starter services (name, duration, price) and insert them into `services` in the same server fn, then verify the full flow.

### Verification steps (same for A or B)
1. Drive Playwright headless against `http://localhost:8080`, restoring the injected Supabase session.
2. Navigate to `/onboarding/owner`, screenshot the form.
3. Fill name / slug / address / description (option B: also fill service rows), submit.
4. Assert redirect to `/owner` and screenshot.
5. Query the DB via `psql` to confirm:
   - `shops` row exists with the expected `owner_id` and `slug`
   - `user_roles` has `(user_id, 'owner')`
   - (option B) `services` rows exist for the new shop
6. Report results + screenshots; clean up the test rows.

### Which option should I take?
Default is **B** (extend to also seed services), since that matches what you asked to verify. Reply "A" to just verify the current shop-only flow instead.
