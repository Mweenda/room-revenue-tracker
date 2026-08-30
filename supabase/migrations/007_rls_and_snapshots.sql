-- Row-level security + financial snapshots + audited payment RPCs.
--
-- Replaces the temporary `anon_all_*` policies from migration 001. After this
-- file, the publishable (anon) key cannot read or write application data.
-- Privileged writes go through security-definer RPCs that call assert_landlord().

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.current_tenant_bed_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.bed_space_id
  from public.tenants t
  where t.id = public.current_tenant_id();
$$;

grant execute on function public.current_tenant_bed_id() to authenticated;

-- ─── Financial snapshots ─────────────────────────────────────────────────────
--
-- Captures the report the landlord exported so a month/year is not reconstructed
-- from the live billing row (which only stores the current cycle).

create table if not exists public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_month text not null,
  period_year integer not null,
  title text,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists financial_snapshots_period_idx
  on public.financial_snapshots (period_year, period_month, created_at desc);

alter table public.financial_snapshots enable row level security;

-- ─── Drop permissive policies ────────────────────────────────────────────────

drop policy if exists "anon_all_blocks" on public.blocks;
drop policy if exists "anon_all_bed_spaces" on public.bed_spaces;
drop policy if exists "anon_all_profiles" on public.profiles;
drop policy if exists "anon_all_tenants" on public.tenants;
drop policy if exists "anon_all_billing" on public.billing_records;
drop policy if exists "anon_all_payments" on public.payments;
drop policy if exists "anon_all_issues" on public.maintenance_issues;
drop policy if exists "anon_all_utilities" on public.utility_entries;
drop policy if exists "anon_all_audit_log" on public.audit_log;

drop policy if exists "anon_read_payment_proofs" on storage.objects;
drop policy if exists "anon_write_payment_proofs" on storage.objects;
drop policy if exists "anon_update_payment_proofs" on storage.objects;
drop policy if exists "anon_read_maintenance_photos" on storage.objects;
drop policy if exists "anon_write_maintenance_photos" on storage.objects;
drop policy if exists "anon_update_maintenance_photos" on storage.objects;

-- ─── Table policies ──────────────────────────────────────────────────────────

-- blocks
drop policy if exists "landlord_write_blocks" on public.blocks;
drop policy if exists "auth_read_blocks" on public.blocks;
create policy "auth_read_blocks" on public.blocks
  for select to authenticated using (true);
create policy "landlord_write_blocks" on public.blocks
  for all to authenticated using (public.is_landlord()) with check (public.is_landlord());

-- bed_spaces
drop policy if exists "auth_read_beds" on public.bed_spaces;
drop policy if exists "landlord_write_beds" on public.bed_spaces;
create policy "auth_read_beds" on public.bed_spaces
  for select to authenticated using (true);
create policy "landlord_write_beds" on public.bed_spaces
  for all to authenticated using (public.is_landlord()) with check (public.is_landlord());

-- profiles: landlords manage landlord rows; students never see them
drop policy if exists "landlord_profiles" on public.profiles;
create policy "landlord_profiles" on public.profiles
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());

-- tenants
drop policy if exists "landlord_all_tenants" on public.tenants;
drop policy if exists "student_read_own_tenant" on public.tenants;
drop policy if exists "student_update_own_tenant" on public.tenants;
create policy "landlord_all_tenants" on public.tenants
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());
create policy "student_read_own_tenant" on public.tenants
  for select to authenticated
  using (id = public.current_tenant_id());
create policy "student_update_own_tenant" on public.tenants
  for update to authenticated
  using (id = public.current_tenant_id() and status = 'active')
  with check (id = public.current_tenant_id() and status = 'active');

-- billing_records
drop policy if exists "landlord_all_billing" on public.billing_records;
drop policy if exists "student_read_own_billing" on public.billing_records;
create policy "landlord_all_billing" on public.billing_records
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());
create policy "student_read_own_billing" on public.billing_records
  for select to authenticated
  using (billing_id = public.current_tenant_bed_id());

-- payments
drop policy if exists "landlord_all_payments" on public.payments;
drop policy if exists "student_read_own_payments" on public.payments;
drop policy if exists "student_insert_own_payments" on public.payments;
create policy "landlord_all_payments" on public.payments
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());
create policy "student_read_own_payments" on public.payments
  for select to authenticated
  using (bed_space_id = public.current_tenant_bed_id());
create policy "student_insert_own_payments" on public.payments
  for insert to authenticated
  with check (
    bed_space_id = public.current_tenant_bed_id()
    and status = 'pending'
  );

-- maintenance_issues
drop policy if exists "landlord_all_issues" on public.maintenance_issues;
drop policy if exists "student_read_own_issues" on public.maintenance_issues;
drop policy if exists "student_insert_own_issues" on public.maintenance_issues;
create policy "landlord_all_issues" on public.maintenance_issues
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());
create policy "student_read_own_issues" on public.maintenance_issues
  for select to authenticated
  using (bed_space_id = public.current_tenant_bed_id());
create policy "student_insert_own_issues" on public.maintenance_issues
  for insert to authenticated
  with check (bed_space_id = public.current_tenant_bed_id() and status = 'open');

-- utility_entries
drop policy if exists "landlord_all_utilities" on public.utility_entries;
drop policy if exists "auth_read_utilities" on public.utility_entries;
create policy "auth_read_utilities" on public.utility_entries
  for select to authenticated using (true);
create policy "landlord_all_utilities" on public.utility_entries
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());

-- audit_log
drop policy if exists "landlord_read_audit_log" on public.audit_log;
create policy "landlord_read_audit_log" on public.audit_log
  for select to authenticated using (public.is_landlord());

-- financial_snapshots
drop policy if exists "landlord_all_snapshots" on public.financial_snapshots;
create policy "landlord_all_snapshots" on public.financial_snapshots
  for all to authenticated
  using (public.is_landlord())
  with check (public.is_landlord());

-- ─── Storage ─────────────────────────────────────────────────────────────────

drop policy if exists "auth_read_payment_proofs" on storage.objects;
drop policy if exists "auth_write_payment_proofs" on storage.objects;
drop policy if exists "auth_read_maintenance_photos" on storage.objects;
drop policy if exists "auth_write_maintenance_photos" on storage.objects;
drop policy if exists "landlord_write_tenant_media" on storage.objects;

create policy "auth_read_payment_proofs" on storage.objects
  for select to authenticated using (bucket_id = 'payment-proofs');
create policy "auth_write_payment_proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (public.is_landlord() or public.current_tenant_id() is not null));

create policy "auth_read_maintenance_photos" on storage.objects
  for select to authenticated using (bucket_id = 'maintenance-photos');
create policy "auth_write_maintenance_photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'maintenance-photos' and (public.is_landlord() or public.current_tenant_id() is not null));

create policy "landlord_write_tenant_media" on storage.objects
  for all to authenticated
  using (bucket_id = 'tenant-media' and public.is_landlord())
  with check (bucket_id = 'tenant-media' and public.is_landlord());

-- ─── Audited payment RPCs ────────────────────────────────────────────────────

create or replace function public.verify_payment(p_payment_id text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.payments%rowtype;
  v_after public.payments%rowtype;
begin
  perform public.assert_landlord('verify a payment');

  select * into v_before from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment % not found', p_payment_id;
  end if;
  if v_before.status = 'verified' then
    return v_before;
  end if;

  update public.payments
  set status = 'verified', rejection_reason = null
  where id = p_payment_id
  returning * into v_after;

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    public.current_landlord_email(),
    'payment_verified',
    'payment',
    p_payment_id,
    jsonb_build_object('status', v_before.status, 'amount', v_before.amount, 'bed_space_id', v_before.bed_space_id),
    jsonb_build_object('status', v_after.status, 'amount', v_after.amount),
    null
  );

  return v_after;
end;
$$;

create or replace function public.reject_payment(p_payment_id text, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.payments%rowtype;
  v_after public.payments%rowtype;
begin
  perform public.assert_landlord('reject a payment');

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A rejection reason is required';
  end if;

  select * into v_before from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  update public.payments
  set status = 'rejected', rejection_reason = btrim(p_reason)
  where id = p_payment_id
  returning * into v_after;

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    public.current_landlord_email(),
    'payment_rejected',
    'payment',
    p_payment_id,
    jsonb_build_object('status', v_before.status, 'amount', v_before.amount),
    jsonb_build_object('status', v_after.status, 'reason', p_reason),
    p_reason
  );

  return v_after;
end;
$$;

revoke execute on function public.verify_payment(text) from anon;
revoke execute on function public.reject_payment(text, text) from anon;
grant execute on function public.verify_payment(text) to authenticated;
grant execute on function public.reject_payment(text, text) to authenticated;
