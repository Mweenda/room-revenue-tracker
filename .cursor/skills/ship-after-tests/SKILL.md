---
name: ship-after-tests
description: >-
  After implementing a new feature, run typecheck, tests, and a production
  build. Ship only when every test passes, the build succeeds, and the build
  log has no chunk-size warning or chunk-load error. Optimize chunks first,
  then commit, push GitHub, push Supabase if the backend changed, and deploy
  Firebase hosting. Use whenever a feature, enhancement, or user-facing fix
  is implemented in this repo — do not wait to be asked to ship.
---

# Ship after tests

whenever we implement a new feature, and the tests pass, always push to github, and supabase if it involves the backend, then deploy to the live site.

Do this automatically. Do not stop after a green test run and wait for “commit / push / deploy.”

**Do not push GitHub, Supabase, or Firebase until all of these are true:**

1. Every test passed.
2. The production build succeeded (`vite build` exit 0).
3. The build log has **no chunking notice or error**. A chunk warning is a ship blocker — large chunks delay first load on the live site.

If the build prints a chunk notice, **optimize first**, re-run verify, then ship.

## 1. Verify

```bash
npm run verify
```

That is:

```bash
npm run typecheck && npm test && node scripts/verify-build.mjs
```

`verify-build.mjs` runs `vite build` and **fails** if the log contains any of:

- `Some chunks are larger than` (Vite chunk-size warning)
- `dynamic import will not move module into another chunk` (mixed static + dynamic import)
- chunk load / dynamic-import failures
- circular chunk / invalid chunk graph errors

If typecheck, tests, or the build fail: fix and re-run. Do not commit, push, or deploy a red verify.

### Chunking (must be clean before ship)

A successful build with a chunk warning is **not** ready to ship. Those notices mean a bundle is large enough to stall the Firebase-hosted SPA.

When a chunk notice appears:

1. Split or lazy-load the heavy module (`manualChunks` in `vite.config.ts`, or `React.lazy` / dynamic `import()` for routes and export tools).
2. Keep on-demand libraries (exceljs, charts, admin) off the main entry chunk.
3. If Vite says a dynamic import will not move a module into another chunk, stop mixing static and dynamic imports of that module. Use a static import, or break the cycle so the dynamic import can actually split.
4. **Do not** raise `chunkSizeWarningLimit` just to hide the notice.
5. Re-run `npm run verify` until the build is successful **and** the log has no chunking notice or error.

Only after that verify is green: commit, then GitHub, then Supabase (if backend), then Firebase.

## 2. Commit

Commit only files for this feature. Do not add Flutter/gradle noise, `guidelines/` media, or secrets.

## 3. GitHub

Push `dev` over HTTPS (origin may still be SSH and hang):

```bash
git push https://github.com/Mweenda/room-revenue-tracker.git HEAD:dev
```

## 4. Supabase (backend only)

Push when the change includes migrations, RPCs, RLS, or Edge Functions.

- Schema: `npm run deploy:db` (`supabase db push --linked`)
- Functions: `npx supabase functions deploy <name> --project-ref knxsnccrkqkosjbgzckv --no-verify-jwt`

If Auto-review blocks `db push`, retry with native approval. If there are no pending migrations, skip.

## 5. Firebase (live site)

```bash
npm run deploy:hosting
```

Live URL: https://room-revenue-tracker.web.app

Firebase hosting must use the project-owner Google account.

`deploy:hosting` builds again. If that build prints a chunk notice, stop, optimize, re-verify, and only then re-deploy. Do not release a chunk-warning build.

## Skip

UI-only / frontend-only work: GitHub + hosting, no Supabase.
Do not ship unrelated dirty files.
Do not skip the production-build + chunk-clean gate.
