# Planned dependency upgrades

These upgrades are **not** part of the current release. They need visual
checks before the versions move.

## Current pins

| Package                                        | Current range | Why it is deferred                                                   |
| ---------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `@react-email/components`                      | `^1.0.12`     | Renders every transactional email. Layout, dark-mode CSS, and button |
| hrefs can shift between minor versions.        |
| `@react-email/render`                          | `^2.0.10`     | Controls HTML and plaintext output sent through Lovable email.       |
| `recharts`                                     | `^2.15.4`     | Powers Feedback Intelligence charts. Axis ticks, tooltips, and       |
| responsive containers often change appearance. |

`esbuild` is upgraded separately via `package.json` `overrides` (`0.28.1`) to
clear GHSA-g7r4-m6w7-qqqr. That change does not affect email or chart pixels.

## React Email plan

1. Snapshot the current HTML for each registered template:
   - `owner-welcome` (`src/lib/email-templates/`)
   - Auth templates used by `/lovable/email/auth/preview` (signup, invite,
     magic link, recovery, email change, reauthentication)
2. Upgrade `@react-email/components` and `@react-email/render` together.
3. Re-render the same `previewData` / sample props and diff HTML (and
   plaintext from `render(..., { plainText: true })`).
4. Send one sandbox message per template to a real inbox and check Gmail,
   Apple Mail, and Outlook web: heading, button, and footer wrapping.
5. Only then merge. If the HTML diff is more than whitespace, treat it as a
   product change and attach screenshots to the PR.

Do not bump these packages in the same PR as an unrelated feature.

## Recharts plan

1. Capture screenshots of `/owner/feedback` (and any other analytics route
   that mounts a chart) at desktop and a 390px viewport, with a known fixture
   shop.
2. Upgrade `recharts` one minor at a time toward v3 only after reading the
   [migration notes](https://github.com/recharts/recharts/releases).
3. Re-screenshot the same pages with the same data. Fail the upgrade if axis
   labels, legend, or empty states moved.
4. Keep unit tests on any pure data mappers; they will not catch visual
   regressions.

Until that pass exists, leave `recharts` on the 2.x line already in the
lockfile.
