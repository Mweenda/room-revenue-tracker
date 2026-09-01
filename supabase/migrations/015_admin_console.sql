-- Admin console: platform-wide read access, landlord lifecycle status, and a
-- persisted platform settings row.
--
-- The RRT admin (see migration 014) needs to see every landlord's data for the
-- overview, landlord, student, and activity screens. Landlord/student RLS stays
-- landlord-scoped; these policies are additive (permissive policies are OR'd),
-- so a plain landlord still only sees their own rows. All admin *writes* to
-- landlords go through the `admin` Edge Function with the service role, so no
-- cross-landlord write policy is added here.

-- ─── 1. Landlord lifecycle status ────────────────────────────────────────────

alter table public.profiles
  add column if not exists status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'suspended'));

-- ─── 2. Platform settings (single row) ───────────────────────────────────────

create table if not exists public.platform_settings (
  id boolean primary key default true,
  billing_cycle_day integer not null default 1,
  grace_period_days integer not null default 5,
  currency text not null default 'ZMW',
  otp_enabled boolean not null default true,
  session_timeout_minutes integer not null default 60,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "admin_manage_platform_settings" on public.platform_settings;
create policy "admin_manage_platform_settings" on public.platform_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 3. Admin cross-landlord read access ─────────────────────────────────────

drop policy if exists "admin_read_profiles" on public.profiles;
create policy "admin_read_profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_blocks" on public.blocks;
create policy "admin_read_blocks" on public.blocks
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_beds" on public.bed_spaces;
create policy "admin_read_beds" on public.bed_spaces
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_tenants" on public.tenants;
create policy "admin_read_tenants" on public.tenants
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_billing" on public.billing_records;
create policy "admin_read_billing" on public.billing_records
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_payments" on public.payments;
create policy "admin_read_payments" on public.payments
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_read_audit_log" on public.audit_log;
create policy "admin_read_audit_log" on public.audit_log
  for select to authenticated
  using (public.is_admin());
