# Room Revenue Tracker (Community)

Figma frontend for managing boarding-house occupancy, billing, payments, utilities, and maintenance — wired to a **Supabase** data backend.

Original design: https://www.figma.com/design/5ORrUrQ99tis3gxfkkAzts/Room-Revenue-Tracker--Community-.

## Quick start (local / offline)

```bash
npm i
npm run dev
```

Without Supabase env vars the app runs on the built-in 54-bed seed dataset.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Push migrations with the Supabase CLI. The CLI is a local devDependency, so it is not on your `PATH` — use `npx supabase`, or an `npm run` script (npm adds `node_modules/.bin` for you).

   **Option A — link to the project** (interactive; opens a browser to authorise):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npm run deploy:db
   ```

   **Option B — push straight to the database** (no login needed):
   ```bash
   # Dashboard → Project Settings → Database → Connection string → URI
   # Use the Session pooler (port 5432). The direct db.<ref>.supabase.co host is
   # IPv6-only on newer projects, and the Transaction pooler (6543) cannot run
   # migrations. Percent-encode any special characters in the password.
   export SUPABASE_DB_URL='postgresql://postgres.YOUR_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'

   npm run deploy:db:dry-run   # review what would be applied
   npm run deploy:db:direct
   npx supabase functions deploy send-email --project-ref knxsnccrkqkosjbgzckv
   ```

   > **Check the migration history first.** `db push` only knows about migrations recorded in `supabase_migrations.schema_migrations`, which is populated exclusively by the CLI. If this schema was originally created by pasting SQL into the dashboard, that table is empty and `db push` will try to re-run `001_initial_schema.sql` and fail on `relation already exists`. `--dry-run` reveals this. To reconcile, mark the already-applied versions without executing them:
   > ```bash
   > npx supabase migration repair --status applied 001 002 003 --db-url "$SUPABASE_DB_URL"
   > ```

   Or run the SQL files manually in **SQL Editor** (in order):
   - [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
   - [`supabase/seed.sql`](supabase/seed.sql)
   - [`supabase/migrations/002_tenant_media.sql`](supabase/migrations/002_tenant_media.sql)
   - [`supabase/migrations/003_tenant_auth_link.sql`](supabase/migrations/003_tenant_auth_link.sql)
   - [`supabase/migrations/004_occupancy_audit.sql`](supabase/migrations/004_occupancy_audit.sql)
   - [`supabase/migrations/005_tenant_status_and_audit.sql`](supabase/migrations/005_tenant_status_and_audit.sql)
   - [`supabase/migrations/006_server_authz_and_notifications.sql`](supabase/migrations/006_server_authz_and_notifications.sql)
   - [`supabase/migrations/007_rls_and_snapshots.sql`](supabase/migrations/007_rls_and_snapshots.sql)
   - [`supabase/migrations/008_cast_bed_status_in_tenant_sync.sql`](supabase/migrations/008_cast_bed_status_in_tenant_sync.sql)
   - [`supabase/migrations/009_update_tenant.sql`](supabase/migrations/009_update_tenant.sql)

   Migrations 004–007 are written to be re-runnable (`if not exists` / `or replace` / `drop policy if exists`), but the **order matters**: 005 replaces 004's email uniqueness with an active-only partial index. After 007, the publishable (`anon`) key cannot read or write application tables.
3. Copy credentials from **Project Settings → API**:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
4. Restart the dev server: `npm run dev`.

### Student email verification codes

Student accounts only work when the landlord has **already onboarded** the bed space with the same email. The app links Supabase Auth users to rows in the `tenants` table by email.

**Student signup flow**

1. Landlord onboards a tenant with their email.
2. The student receives an invite to **create a password** (not a one-time login code).
3. They click the link, choose a password, and are taken straight into their student portal.

OTP registration on the student login screen is still available for tenants who already have a bed assigned. Add these to **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:5173/?auth=student-confirm`
- `http://localhost:5173/?auth=student-reset`
- Your Firebase preview/production URL equivalents

If login says the tenant profile is missing, the landlord must re-onboard using the **exact same email** the student uses for auth.

The UI will load beds, billing, payments, utilities, and maintenance from Supabase. Mutations (onboard, verify/reject payments, utility entries, issues) persist to the database.

## Landlord features

### Students page

`Students` in the sidebar lists every tenant with search (name, email, phone, NRC, bed) and filters for block, billing status, and tenant status.

Landlords can **add** a student to a vacant bed, **edit** name, email, phone, NRC, move-in date, bed allocation, and monthly rent, or **remove** them. Edits go through the `update_tenant` RPC (migration 009): a bed move carries outstanding balance onto the new bed and frees the old one; a rent change updates `bed_spaces.rent_amount` and the live `current_rent` without rewriting historical arrears.

**Removing a student is a soft delete.** Migration 005 adds `tenants.status` (`active` | `evicted` | `moved_out`); the row is retained for history while the bed is released. Removal goes through the `evict_tenant` RPC, which in one transaction:

1. snapshots the tenant and their outstanding balance into `audit_log.before`,
2. sets the new status plus `status_changed_at` / `status_reason`,
3. clears `auth_user_id` so the student loses portal access and the email can be re-onboarded,
4. calls `reconcile_bed_space` so the bed goes vacant and its billing record resets.

Because occupancy now means *an active tenant exists*, the old `tenants_bed_space_id_key` and `tenants_email_unique_idx` constraints are replaced by partial indexes scoped to `status = 'active'`. Every tenant read in the app filters on `status = 'active'`.

### Rent increments

`Increase Rent` on the Students page takes a percentage or flat kwacha amount, a scope (all beds / one block / hand-picked students), and an effective date, then shows an old-versus-new preview before applying.

Increments are **forward-only**: the `apply_rent_increment` RPC updates `bed_spaces.rent_amount` and writes one `audit_log` row per bed, but leaves `accumulated_total` and `total_balance` alone so nobody is pushed into arrears retroactively. Affected students are then emailed a `rent_increase` notice (old amount, new amount, effective date) through the existing `send-email` function. Emails are dispatched with `Promise.allSettled`, so one bad address cannot abort the batch; the result toast reports how many notices failed.

`computeRentIncrease` in [`src/lib/rent.ts`](src/lib/rent.ts) mirrors the RPC's rounding exactly, so the approved preview is what gets written.

### Financial reports

`Reports` is a hub with two cards — **Financial Reports** and **Maintenance Reports**.

Financial Reports exports a formatted `.xlsx` for any month/year via [`exceljs`](https://www.npmjs.com/package/exceljs), with four sheets (Summary, Billing Roster, Payments, Utilities), frozen headers, kwacha number formats, and totals rows. Figures come from the **live** billing cycle (the table stores one current snapshot, not a month-by-month ledger). Each export also writes a row to `financial_snapshots` so that period can be retrieved later.

The module is split so the numbers are testable without a spreadsheet engine: `buildFinancialReport` is pure, and `writeFinancialWorkbook` only applies formatting. ExcelJS is loaded through a dynamic `import()`, so it stays in its own lazy chunk.

## Authorization

Landlord-only actions are gated twice:

1. **Browser** — `isLandlord` / `assertLandlord` in [`src/lib/authz.ts`](src/lib/authz.ts) hide and refuse export, rent increment, and eviction.
2. **Database** — `public.is_landlord()` (migration 006) is called inside `evict_tenant`, `apply_rent_increment`, `reconcile_all_occupancy`, `verify_payment`, and `reject_payment`. Migration 007 replaces the temporary `anon_all_*` policies: `anon` has no table access; students see only their own tenant, billing, payments, and issues; landlords have full access.

`send-email` requires a user JWT and then calls `is_landlord()`. The client sends a `type` and `tenantId` only — the recipient address and HTML are resolved on the server and every attempt is written to `notification_log`.

**Residual risk:** `is_landlord()` matches a profile by `auth_user_id` or by email for legacy rows. A landlord must sign in once after 006 so `link_landlord_profile()` stamps `auth_user_id`. Until that happens, JWT-email matching is the fallback. Offline demo login is opt-in via `VITE_ENABLE_DEMO_LOGIN=true` and is disabled whenever Supabase is configured.

## Tests

```bash
npm test        # node --test with tsx, covers the pure helpers
npm run typecheck
```

- [`tests/rent-increment.test.mjs`](tests/rent-increment.test.mjs) — percentage/fixed maths, rounding, scope resolution, preview totals.
- [`tests/financial-report.test.mjs`](tests/financial-report.test.mjs) — sheet construction, occupancy/collection derivation, totals rows.
- [`tests/occupancy-status.test.mjs`](tests/occupancy-status.test.mjs) — active-only filtering after a soft delete, search matching.
- [`tests/secure-login-link.test.mjs`](tests/secure-login-link.test.mjs) — signed student portal links.

## Deploy (Firebase Hosting)

Hosting is configured in [`firebase.json`](firebase.json) for the `room-revenue-tracker` site.

```bash
firebase login
npm run deploy:preview   # preview channel (30-day URL)
npm run deploy:hosting   # production
```

Set `VITE_*` env vars before building so the deployed bundle includes Supabase and Firebase config. Vite inlines env at build time.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/App.tsx` | Shell, landlord dashboard, student portal |
| `src/app/views/` | Larger landlord views (`StudentsView`, `ReportsView`) |
| `src/app/components/primitives.tsx` | Shared `Card`-based `SectionCard` / `KpiCard` / `Badge` and button/input styles |
| `src/app/components/ui/` | shadcn/ui components |
| `src/hooks/useTrackerData.ts` | Data loading + mutations (Supabase or local fallback) |
| `src/lib/api/` | Supabase CRUD helpers and RPC wrappers |
| `src/lib/authz.ts` | Landlord gating helpers |
| `src/lib/billing.ts` | Billing status + utility split helpers |
| `src/lib/occupancy.ts` | Occupancy audit + reconcile helpers |
| `src/lib/rent.ts` | Pure rent-increment maths and scope resolution |
| `src/lib/students.ts` | Student row derivation + search for the Students page |
| `src/lib/export/financialWorkbook.ts` | Financial report construction + `.xlsx` writer |
| `src/data/seed.ts` | Offline seed matching the SQL seed |
| `supabase/` | Schema migrations + seed SQL |
| `tests/` | `node --test` suites for the pure helpers |
