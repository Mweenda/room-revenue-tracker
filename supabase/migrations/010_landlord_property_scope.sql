-- Scope boarding-house data to a landlord profile.
--
-- Until now `is_landlord()` granted every landlord the entire dataset. Mr. S.
-- Mwamba's blocks, beds, students, billing, payments, and issues now belong to
-- his profile. Other landlord accounts cannot read or write those rows.
-- Students still see only their own tenant / billing / payments / issues.

-- ─── Ownership column ────────────────────────────────────────────────────────

alter table public.blocks
  add column if not exists landlord_id uuid references public.profiles (id) on delete restrict;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.current_landlord_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.role = 'landlord'
    and (
      p.auth_user_id = auth.uid()
      or (
        p.auth_user_id is null
        and p.email is not null
        and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  limit 1;
$$;

comment on function public.current_landlord_id() is
  'profiles.id of the signed-in landlord, or null.';

create or replace function public.current_tenant_block_code()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bs.block_code::text
  from public.tenants t
  join public.bed_spaces bs on bs.id = t.bed_space_id
  where t.id = public.current_tenant_id();
$$;

create or replace function public.landlord_owns_block(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.blocks b
    where b.code::text = p_code
      and b.landlord_id = public.current_landlord_id()
  );
$$;

create or replace function public.landlord_owns_bed(p_bed_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bed_spaces bs
    join public.blocks b on b.code = bs.block_code
    where bs.id = p_bed_id
      and b.landlord_id = public.current_landlord_id()
  );
$$;

create or replace function public.landlord_owns_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenants t
    join public.bed_spaces bs on bs.id = t.bed_space_id
    join public.blocks b on b.code = bs.block_code
    where t.id = p_tenant_id
      and b.landlord_id = public.current_landlord_id()
  );
$$;

create or replace function public.current_tenant_landlord_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.landlord_id
  from public.tenants t
  join public.bed_spaces bs on bs.id = t.bed_space_id
  join public.blocks b on b.code = bs.block_code
  where t.id = public.current_tenant_id();
$$;

grant execute on function public.current_landlord_id() to authenticated;
grant execute on function public.current_tenant_block_code() to authenticated;
grant execute on function public.current_tenant_landlord_id() to authenticated;
grant execute on function public.landlord_owns_block(text) to authenticated;
grant execute on function public.landlord_owns_bed(text) to authenticated;
grant execute on function public.landlord_owns_tenant(uuid) to authenticated;

-- ─── Assign existing property data to Mr. S. Mwamba ──────────────────────────

do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.profiles
  where role = 'landlord'
    and lower(email) = 'mwamba.property@gmail.com'
  limit 1;

  if v_id is null then
    insert into public.profiles (id, role, full_name, email, phone, address, bio)
    values (
      '7e2a9c41-0b18-4f6d-9e3a-2c5b8d1f4a70',
      'landlord',
      'Mr. S. Mwamba',
      'mwamba.property@gmail.com',
      '+260 977 001 234',
      'Plot 45, Lusaka, Zambia',
      'Property owner and manager of 4 residential blocks housing 54 students in Lusaka.'
    )
    returning id into v_id;
  end if;

  update public.blocks
  set landlord_id = v_id
  where landlord_id is null;
end $$;

alter table public.blocks
  alter column landlord_id set not null;

create index if not exists blocks_landlord_idx on public.blocks (landlord_id);

-- Stamp historical audit / snapshot / notification rows so they stay private.
alter table public.audit_log
  add column if not exists landlord_id uuid references public.profiles (id) on delete set null;

alter table public.financial_snapshots
  add column if not exists landlord_id uuid references public.profiles (id) on delete set null;

alter table public.notification_log
  add column if not exists landlord_id uuid references public.profiles (id) on delete set null;

update public.audit_log a
set landlord_id = p.id
from public.profiles p
where a.landlord_id is null
  and p.role = 'landlord'
  and lower(p.email) = 'mwamba.property@gmail.com';

update public.financial_snapshots s
set landlord_id = p.id
from public.profiles p
where s.landlord_id is null
  and p.role = 'landlord'
  and lower(p.email) = 'mwamba.property@gmail.com';

update public.notification_log n
set landlord_id = p.id
from public.profiles p
where n.landlord_id is null
  and p.role = 'landlord'
  and lower(p.email) = 'mwamba.property@gmail.com';

create index if not exists audit_log_landlord_idx on public.audit_log (landlord_id);
create index if not exists financial_snapshots_landlord_idx on public.financial_snapshots (landlord_id);
create index if not exists notification_log_landlord_idx on public.notification_log (landlord_id);

-- Fill landlord_id on insert when the caller is a landlord.
create or replace function public.tg_set_landlord_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.landlord_id is null then
    NEW.landlord_id := public.current_landlord_id();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_blocks_set_landlord on public.blocks;
create trigger trg_blocks_set_landlord
  before insert on public.blocks
  for each row
  execute function public.tg_set_landlord_id();

drop trigger if exists trg_audit_set_landlord on public.audit_log;
create trigger trg_audit_set_landlord
  before insert on public.audit_log
  for each row
  execute function public.tg_set_landlord_id();

drop trigger if exists trg_snapshots_set_landlord on public.financial_snapshots;
create trigger trg_snapshots_set_landlord
  before insert on public.financial_snapshots
  for each row
  execute function public.tg_set_landlord_id();

drop trigger if exists trg_notifications_set_landlord on public.notification_log;
create trigger trg_notifications_set_landlord
  before insert on public.notification_log
  for each row
  execute function public.tg_set_landlord_id();

-- ─── RLS: landlord sees only their property ──────────────────────────────────

-- blocks
drop policy if exists "auth_read_blocks" on public.blocks;
drop policy if exists "landlord_write_blocks" on public.blocks;
create policy "landlord_read_own_blocks" on public.blocks
  for select to authenticated
  using (landlord_id = public.current_landlord_id());
create policy "student_read_own_property_blocks" on public.blocks
  for select to authenticated
  using (landlord_id = public.current_tenant_landlord_id());
create policy "landlord_write_own_blocks" on public.blocks
  for all to authenticated
  using (landlord_id = public.current_landlord_id())
  with check (landlord_id = public.current_landlord_id());

-- bed_spaces
drop policy if exists "auth_read_beds" on public.bed_spaces;
drop policy if exists "landlord_write_beds" on public.bed_spaces;
create policy "landlord_read_own_beds" on public.bed_spaces
  for select to authenticated
  using (public.landlord_owns_bed(id));
create policy "student_read_own_property_beds" on public.bed_spaces
  for select to authenticated
  using (
    exists (
      select 1
      from public.blocks b
      where b.code = block_code
        and b.landlord_id = public.current_tenant_landlord_id()
    )
  );
create policy "landlord_write_own_beds" on public.bed_spaces
  for all to authenticated
  using (public.landlord_owns_bed(id))
  with check (public.landlord_owns_block(block_code::text));

-- profiles: a landlord may see and edit only their own row
drop policy if exists "landlord_profiles" on public.profiles;
create policy "landlord_own_profile" on public.profiles
  for all to authenticated
  using (id = public.current_landlord_id())
  with check (id = public.current_landlord_id());

-- tenants
drop policy if exists "landlord_all_tenants" on public.tenants;
create policy "landlord_own_tenants" on public.tenants
  for all to authenticated
  using (public.landlord_owns_tenant(id))
  with check (public.landlord_owns_bed(bed_space_id));

-- billing_records
drop policy if exists "landlord_all_billing" on public.billing_records;
create policy "landlord_own_billing" on public.billing_records
  for all to authenticated
  using (public.landlord_owns_bed(billing_id))
  with check (public.landlord_owns_bed(billing_id));

-- payments
drop policy if exists "landlord_all_payments" on public.payments;
create policy "landlord_own_payments" on public.payments
  for all to authenticated
  using (public.landlord_owns_bed(bed_space_id))
  with check (public.landlord_owns_bed(bed_space_id));

-- maintenance_issues
drop policy if exists "landlord_all_issues" on public.maintenance_issues;
create policy "landlord_own_issues" on public.maintenance_issues
  for all to authenticated
  using (public.landlord_owns_bed(bed_space_id))
  with check (public.landlord_owns_bed(bed_space_id));

-- utility_entries
drop policy if exists "auth_read_utilities" on public.utility_entries;
drop policy if exists "landlord_all_utilities" on public.utility_entries;
create policy "landlord_own_utilities" on public.utility_entries
  for all to authenticated
  using (public.landlord_owns_block(block_code::text))
  with check (public.landlord_owns_block(block_code::text));
create policy "student_read_own_block_utilities" on public.utility_entries
  for select to authenticated
  using (block_code::text = public.current_tenant_block_code());

-- audit_log
drop policy if exists "landlord_read_audit_log" on public.audit_log;
create policy "landlord_read_own_audit_log" on public.audit_log
  for select to authenticated
  using (landlord_id = public.current_landlord_id());

-- financial_snapshots
drop policy if exists "landlord_all_snapshots" on public.financial_snapshots;
create policy "landlord_own_snapshots" on public.financial_snapshots
  for all to authenticated
  using (landlord_id = public.current_landlord_id())
  with check (landlord_id = public.current_landlord_id());

-- notification_log
drop policy if exists "landlord_read_notification_log" on public.notification_log;
create policy "landlord_read_own_notification_log" on public.notification_log
  for select to authenticated
  using (landlord_id = public.current_landlord_id());
create policy "landlord_insert_own_notification_log" on public.notification_log
  for insert to authenticated
  with check (landlord_id = public.current_landlord_id());

-- ─── Privileged RPCs must not touch another landlord's rows ──────────────────

create or replace function public.reconcile_all_occupancy()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bed_id text;
  v_count integer := 0;
begin
  perform public.assert_landlord('reconcile occupancy');

  for v_bed_id in
    select bs.id
    from public.bed_spaces bs
    join public.blocks b on b.code = bs.block_code
    where b.landlord_id = public.current_landlord_id()
    order by bs.id
  loop
    perform public.reconcile_bed_space(v_bed_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

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
  if not found or not public.landlord_owns_bed(v_before.bed_space_id) then
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
  if not found or not public.landlord_owns_bed(v_before.bed_space_id) then
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

create or replace function public.evict_tenant(
  p_tenant_id uuid,
  p_reason text,
  p_actor text default null,
  p_status public.tenant_status default 'evicted'
)
returns table (
  tenant_id uuid,
  full_name text,
  email text,
  bed_space_id text,
  outstanding_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant public.tenants%rowtype;
  v_outstanding numeric := 0;
  v_actor text;
begin
  perform public.assert_landlord('evict a tenant');
  v_actor := coalesce(public.current_landlord_email(), p_actor);

  if p_status = 'active' then
    raise exception 'evict_tenant cannot be used to set status back to active';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found or not public.landlord_owns_tenant(p_tenant_id) then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  if v_tenant.status <> 'active' then
    raise exception 'Tenant % is already %', v_tenant.full_name, v_tenant.status;
  end if;

  select br.total_balance into v_outstanding
  from public.billing_records br
  where br.billing_id = v_tenant.bed_space_id;
  v_outstanding := coalesce(v_outstanding, 0);

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    v_actor,
    'tenant_' || p_status::text,
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'full_name', v_tenant.full_name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'bed_space_id', v_tenant.bed_space_id,
      'move_in_date', v_tenant.move_in_date,
      'status', v_tenant.status,
      'auth_user_id', v_tenant.auth_user_id,
      'outstanding_balance', v_outstanding
    ),
    jsonb_build_object('status', p_status::text),
    p_reason
  );

  update public.tenants
  set
    status = p_status,
    status_changed_at = now(),
    status_reason = p_reason,
    auth_user_id = null
  where id = p_tenant_id;

  perform public.reconcile_bed_space(v_tenant.bed_space_id);

  return query
  select
    v_tenant.id,
    v_tenant.full_name,
    v_tenant.email,
    v_tenant.bed_space_id,
    v_outstanding;
end;
$$;

create or replace function public.apply_rent_increment(
  p_bed_ids text[],
  p_mode text,
  p_value numeric,
  p_effective_date date,
  p_actor text default null
)
returns table (
  bed_space_id text,
  tenant_id uuid,
  tenant_name text,
  tenant_email text,
  old_rent numeric,
  new_rent numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_new numeric;
  v_actor text;
begin
  perform public.assert_landlord('apply a rent increment');
  v_actor := coalesce(public.current_landlord_email(), p_actor);

  if p_mode not in ('percentage', 'fixed') then
    raise exception 'Unsupported mode %, expected percentage or fixed', p_mode;
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Increase value must be greater than zero';
  end if;

  if p_mode = 'percentage' and p_value > 100 then
    raise exception 'Percentage increase of % exceeds the 100 percent safety limit', p_value;
  end if;

  if p_bed_ids is null or array_length(p_bed_ids, 1) is null then
    raise exception 'At least one bed space is required';
  end if;

  if p_effective_date is null then
    raise exception 'An effective date is required';
  end if;

  if exists (
    select 1
    from unnest(p_bed_ids) as u(bed_id)
    where not public.landlord_owns_bed(u.bed_id)
  ) then
    raise exception 'One or more bed spaces are not part of your property'
      using errcode = '42501';
  end if;

  for v_row in
    select b.id, b.rent_amount, t.id as tenant_id, t.full_name, t.email
    from public.bed_spaces b
    left join public.tenants t on t.bed_space_id = b.id and t.status = 'active'
    where b.id = any(p_bed_ids)
    order by b.id
    for update of b
  loop
    if p_mode = 'percentage' then
      v_new := round(v_row.rent_amount * (1 + p_value / 100.0), 2);
    else
      v_new := round(v_row.rent_amount + p_value, 2);
    end if;

    update public.bed_spaces set rent_amount = v_new where id = v_row.id;

    insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
    values (
      v_actor,
      'rent_increment',
      'bed_space',
      v_row.id,
      jsonb_build_object('rent_amount', v_row.rent_amount),
      jsonb_build_object(
        'rent_amount', v_new,
        'mode', p_mode,
        'value', p_value,
        'effective_date', p_effective_date
      ),
      case
        when v_row.tenant_id is null then 'Vacant bed'
        else 'Tenant: ' || v_row.full_name
      end
    );

    return query
    select v_row.id, v_row.tenant_id, v_row.full_name, v_row.email, v_row.rent_amount, v_new;
  end loop;
end;
$$;

-- update_tenant: ownership of the current tenant and of the destination bed.
create or replace function public.update_tenant(
  p_tenant_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_nrc text,
  p_move_in_date date,
  p_bed_space_id text,
  p_rent_amount numeric
)
returns table (
  tenant_id uuid,
  full_name text,
  bed_space_id text,
  rent_amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant public.tenants%rowtype;
  v_new_bed public.bed_spaces%rowtype;
  v_actor text;
  v_email text;
  v_phone text;
  v_rent numeric;
  v_old_bed_id text;
  v_balance numeric := 0;
  v_accumulated numeric := 0;
  v_days integer := 0;
  v_target text := '-';
  v_occupant uuid;
begin
  perform public.assert_landlord('update a tenant');
  v_actor := public.current_landlord_email();

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'A full name is required';
  end if;

  if p_bed_space_id is null or btrim(p_bed_space_id) = '' then
    raise exception 'A bed space is required';
  end if;

  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'Monthly rent must be greater than zero';
  end if;

  v_rent := round(p_rent_amount, 2);
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone := nullif(btrim(coalesce(p_phone, '')), '');

  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if not found or not public.landlord_owns_tenant(p_tenant_id) then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  if v_tenant.status <> 'active' then
    raise exception 'Only active tenants can be edited';
  end if;

  v_old_bed_id := v_tenant.bed_space_id;

  select * into v_new_bed from public.bed_spaces where id = p_bed_space_id for update;
  if not found or not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  if p_bed_space_id is distinct from v_old_bed_id then
    select t.id into v_occupant
    from public.tenants t
    where t.bed_space_id = p_bed_space_id
      and t.status = 'active'
      and t.id <> p_tenant_id
    limit 1;
    if found then
      raise exception 'Bed space % is already occupied', p_bed_space_id;
    end if;
  end if;

  if v_email is not null then
    if exists (
      select 1 from public.tenants t
      where t.status = 'active'
        and t.id <> p_tenant_id
        and t.email is not null
        and lower(t.email) = v_email
    ) then
      raise exception 'Email % is already assigned to another active tenant', v_email;
    end if;
  end if;

  select
    coalesce(br.total_balance, 0),
    coalesce(br.accumulated_total, 0),
    coalesce(br.days_past_due, 0),
    coalesce(nullif(br.target_month, ''), '-')
  into v_balance, v_accumulated, v_days, v_target
  from public.billing_records br
  where br.billing_id = v_old_bed_id;

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after)
  values (
    v_actor,
    'tenant_update',
    'tenant',
    p_tenant_id::text,
    jsonb_build_object(
      'full_name', v_tenant.full_name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'nrc', v_tenant.nrc,
      'move_in_date', v_tenant.move_in_date,
      'bed_space_id', v_tenant.bed_space_id,
      'rent_amount', (select bs.rent_amount from public.bed_spaces bs where bs.id = v_old_bed_id)
    ),
    jsonb_build_object(
      'full_name', btrim(p_full_name),
      'email', v_email,
      'phone', v_phone,
      'nrc', coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
      'move_in_date', p_move_in_date,
      'bed_space_id', p_bed_space_id,
      'rent_amount', v_rent
    )
  );

  update public.tenants
  set
    full_name = btrim(p_full_name),
    phone = v_phone,
    email = v_email,
    nrc = coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
    move_in_date = coalesce(p_move_in_date, v_tenant.move_in_date::date),
    bed_space_id = p_bed_space_id
  where id = p_tenant_id;

  update public.bed_spaces
  set rent_amount = v_rent
  where id = p_bed_space_id;

  if p_bed_space_id is distinct from v_old_bed_id then
    perform public.reconcile_bed_space(v_old_bed_id);
  end if;

  perform public.reconcile_bed_space(p_bed_space_id);

  if p_bed_space_id is distinct from v_old_bed_id then
    update public.billing_records
    set
      total_balance = v_balance,
      accumulated_total = v_accumulated,
      days_past_due = v_days,
      target_month = v_target
    where billing_id = p_bed_space_id;
  end if;

  return query
  select p_tenant_id, btrim(p_full_name), p_bed_space_id, v_rent;
end;
$$;
