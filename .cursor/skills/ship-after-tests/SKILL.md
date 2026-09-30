---
name: ship-after-tests
description: >-
  After implementing a new feature, run tests; if they pass, commit, push to
  GitHub, push to Supabase when the backend changed, then deploy to the live
  site. Use whenever a feature, enhancement, or user-facing fix is implemented
  in this repo — do not wait to be asked to ship.
---

# Ship after tests

whenever we implement a new feature, and the tests pass, always push to github, and supabase if it involves the backend, then deploy to the live site.

Do this automatically. Do not stop after a green test run and wait for “commit / push / deploy.”

## 1. Verify

```bash
npm run typecheck && npm test
```

If either fails, fix and re-run. Do not push or deploy red tests.

## 2. Commit

Commit only files for this feature. Do not add Flutter/gradle noise, `guidelines/` media, or secrets.

Push GitHub `dev` over HTTPS (origin may still be SSH and hang):

```bash
git push https://github.com/Mweenda/room-revenue-tracker.git HEAD:dev
```

## 3. Supabase (backend only)

Push when the change includes migrations, RPCs, RLS, or Edge Functions.

- Schema: `npm run deploy:db` (`supabase db push --linked`)
- Functions: `npx supabase functions deploy <name> --project-ref knxsnccrkqkosjbgzckv --no-verify-jwt`

If Auto-review blocks `db push`, retry with native approval. If there are no pending migrations, skip.

## 4. Live site

```bash
npm run deploy:hosting
```

Live URL: https://room-revenue-tracker.web.app

Firebase hosting must use the project-owner Google account.

## Skip

UI-only / frontend-only work: GitHub + hosting, no Supabase.
Do not ship unrelated dirty files.
