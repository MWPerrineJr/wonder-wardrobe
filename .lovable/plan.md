# Why the GitHub check failed, and how to fix it

## What the email says

The email is from the GitHub repo `MWPerrineJr/wonder-wardrobe` (the repo this project is synced to), for commit `20139b9` on `main`. Only one job actually ran:

- "Frozen install" — failed after 5 seconds
- The other four jobs (build, tests, migration replay, browser smoke) were skipped because they all wait on that first job

So nothing was broken in the app itself — the very first setup step stopped the run before anything got tested.

## The cause

The automated check installs dependencies with npm's strict mode, which requires a file named `package-lock.json` in the repo, and then verifies that file did not change. During the earlier "clean up stale dead code" pass, `package-lock.json` was deleted; the project now only carries `bun.lock`. With no lock file present, the strict install exits immediately — which matches the 5-second failure and the two annotations.

Verified just now: the project root contains `bun.lock` and no `package-lock.json`, while `.github/workflows/ci.yml` runs `npm ci` followed by `git diff --exit-code package-lock.json`.

## Fix options

**Option A — switch the checks to the lock file the project actually uses (recommended)**
Update the workflow so every job installs with Bun and a frozen `bun.lock`, instead of npm's lock file. One lock file stays in the repo, matching how the project is built here.

**Option B — restore the npm lock file**
Regenerate `package-lock.json`, commit it, and keep the workflow as-is. This means two lock files to keep in sync, which is what caused the drift in the first place.

## Work for Option A

- Edit `.github/workflows/ci.yml`: in all five jobs replace the npm setup/install steps with Bun setup + `bun install --frozen-lockfile`, and change the drift check to `git diff --exit-code bun.lock`.
- Keep the existing script names (`format:check`, `lint`, `typecheck`, `test`, `audit`, `migrations:check`, `test:db`, `build`, `test:e2e`) and run them through Bun.
- Leave the environment variables, Supabase CLI step, and Playwright step unchanged.
- No app code or database changes.

## Note

The failing check has no effect on your live site — the published app and preview are unaffected. This only fixes the red mark on GitHub.
