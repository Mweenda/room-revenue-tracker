-- Tenant lifecycle status (soft delete), audit log, and privileged landlord RPCs.
--
-- Source of truth stays the tenants table, but occupancy now means
-- "an ACTIVE tenant row exists for the bed". Evicted/moved-out rows are
-- retained for history and no longer hold the bed.

-- ─── Tenant status ───────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tenant_status') then
    create type public.tenant_status as enum ('active', 'evicted', 'moved_out');
  end if;
end;
$$;

alter table public.tenants
  add column if not exists status public.tenant_status not null default 'active',
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_reason text;

create index if not exists tenants_status_idx on public.tenants (status);

-- bed_space_id was `not null unique`; a retained evicted row would block re-letting.
alter table public.tenants drop constraint if exists tenants_bed_space_id_key;

create unique index if not exists tenants_active_bed_idx
  on public.tenants (bed_space_id)
  where status = 'active';

-- Same for email: an evicted student must not block re-onboarding.
drop index if exists public.tenants_email_unique_idx;

create unique index if not exists tenants_active_email_idx
  on public.tenants (lower(email))
  where status = 'active' and email is not null and trim(email) <> '';

-- Keep the legacy is_active flag consistent so nothing depending on it regresses.
create or replace function public.sync_tenant_is_active()
returns trigger
language plpgsql
as $$
begin
  new.is_active := (new.status = 'active');
  if new.status <> 'active' and new.status_changed_at is null then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tenant_sync_is_active on public.tenants;
create trigger trg_tenant_sync_is_active
  before insert or update of status on public.tenants
  for each row
  execute function public.sync_tenant_is_active();

update public.tenants set is_active = (status = 'active') where is_active <> (status = 'active');

-- ─── Occupancy sync must respect status ──────────────────────────────────────

create or replace function public.sync_bed_occupied_on_tenant()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> old.id
        ) then 'occupied'
        else 'vacant'
      end
      where id = old.bed_space_id;
    return old;
  end if;

  -- A tenant leaving a bed (status change or reassignment) frees the old bed.
  if tg_op = 'UPDATE' and old.bed_space_id is distinct from new.bed_space_id then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> new.id
        ) then 'occupied'
        else 'vacant'
      end
      where id = old.bed_space_id;
  end if;

  update public.bed_spaces
    set status = case when new.status = 'active' then 'occupied' else 'vacant' end
    where id = new.bed_space_id
      and not (
        new.status <> 'active'
        and exists (
          select 1 from public.tenants
          where bed_space_id = new.bed_space_id and status = 'active' and id <> new.id
        )
      );

  return new;
end;
$$;

drop trigger if exists trg_tenant_sync_bed on public.tenants;
create trigger trg_tenant_sync_bed
  after insert or update or delete on public.tenants
  for each row
  execute function public.sync_bed_occupied_on_tenant();

-- ─── Reconcile / audit now count only active tenants ─────────────────────────

create or replace function public.reconcile_bed_space(p_bed_id text)
returns void
language plpgsql
as $$
declare
  v_tenant public.tenants%rowtype;
  v_bed public.bed_spaces%rowtype;
  v_has_tenant boolean;
begin
  select * into v_bed from public.bed_spaces where id = p_bed_id;
  if not found then
    raise exception 'Bed space % not found', p_bed_id;
  end if;

  select * into v_tenant
  from public.tenants
  where bed_space_id = p_bed_id and status = 'active'
  limit 1;
  v_has_tenant := found;

  if v_has_tenant then
    update public.bed_spaces set status = 'occupied' where id = p_bed_id;

    update public.billing_records
    set
      tenant_name = v_tenant.full_name,
      phone_number = coalesce(nullif(v_tenant.phone, ''), '-'),
      entry_date = coalesce(v_tenant.move_in_date::text, '-'),
      house_block = v_bed.block_code,
      room_number = v_bed.room_number::text,
      bed_space = v_bed.bed_letter,
      room_gender = v_bed.room_gender,
      current_rent = v_bed.rent_amount
    where billing_id = p_bed_id;

    if not found then
      insert into public.billing_records (
        billing_id, house_block, room_number, bed_space, room_gender,
        tenant_name, phone_number, entry_date, current_rent,
        target_month, accumulated_total, total_balance, days_past_due
      ) values (
        p_bed_id, v_bed.block_code, v_bed.room_number::text, v_bed.bed_letter, v_bed.room_gender,
        v_tenant.full_name, coalesce(nullif(v_tenant.phone, ''), '-'),
        coalesce(v_tenant.move_in_date::text, '-'), v_bed.rent_amount,
        to_char(now(), 'Mon'), v_bed.rent_amount, v_bed.rent_amount, 0
      );
    end if;
  else
    update public.bed_spaces set status = 'vacant' where id = p_bed_id;

    update public.billing_records
    set
      tenant_name = 'Vacant',
      phone_number = '-',
      entry_date = '-',
      total_balance = 0,
      accumulated_total = 0,
      days_past_due = 0,
      target_month = '-'
    where billing_id = p_bed_id;
  end if;
end;
$$;

create or replace function public.audit_occupancy()
returns table (
  issue_code text,
  severity text,
  bed_space_id text,
  details text
)
language sql
stable
as $$
  with active_tenants as (
    select * from public.tenants where status = 'active'
  )

  -- Bed marked occupied but no active tenant
  select
    'bed_occupied_no_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is occupied but no active tenant is assigned'::text
  from public.bed_spaces b
  left join active_tenants t on t.bed_space_id = b.id
  where b.status = 'occupied' and t.id is null

  union all

  -- Bed marked vacant but an active tenant exists
  select
    'bed_vacant_has_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is vacant but tenant ' || t.full_name || ' is assigned'::text
  from public.bed_spaces b
  inner join active_tenants t on t.bed_space_id = b.id
  where b.status = 'vacant'

  union all

  -- Billing says Vacant but an active tenant exists
  select
    'billing_vacant_has_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing is Vacant but tenant ' || t.full_name || ' exists'::text
  from public.billing_records b
  inner join active_tenants t on t.bed_space_id = b.billing_id
  where b.billing_status = 'Vacant'
     or lower(trim(b.tenant_name)) = 'vacant'

  union all

  -- Billing shows occupant but no active tenant
  select
    'billing_occupied_no_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing shows ' || b.tenant_name || ' but no active tenant exists'::text
  from public.billing_records b
  left join active_tenants t on t.bed_space_id = b.billing_id
  where t.id is null
    and b.billing_status <> 'Vacant'
    and lower(trim(b.tenant_name)) <> 'vacant'

  union all

  -- Same email on multiple active beds
  select
    'duplicate_email'::text,
    'error'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'email ' || min(t.email) || ' assigned to multiple beds'::text
  from active_tenants t
  where t.email is not null and trim(t.email) <> ''
  group by lower(t.email)
  having count(*) > 1

  union all

  -- Same auth user on multiple active beds
  select
    'duplicate_auth_user'::text,
    'error'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'auth_user_id linked to multiple beds'::text
  from active_tenants t
  where t.auth_user_id is not null
  group by t.auth_user_id
  having count(*) > 1

  union all

  -- Same phone on multiple active beds
  select
    'duplicate_phone'::text,
    'warning'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'phone ' || t.phone || ' used on multiple beds'::text
  from active_tenants t
  where t.phone is not null and trim(t.phone) not in ('', '-')
  group by t.phone
  having count(*) > 1;
$$;

-- ─── Audit log ───────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

drop policy if exists "anon_all_audit_log" on public.audit_log;
create policy "anon_all_audit_log" on public.audit_log
  for all to anon, authenticated using (true) with check (true);

-- ─── Evict tenant (soft delete) ──────────────────────────────────────────────

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
as $$
declare
  v_tenant public.tenants%rowtype;
  v_outstanding numeric := 0;
begin
  if p_status = 'active' then
    raise exception 'evict_tenant cannot be used to set status back to active';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  if v_tenant.status <> 'active' then
    raise exception 'Tenant % is already %', v_tenant.full_name, v_tenant.status;
  end if;

  -- SELECT INTO leaves the variable null when the bed has no billing row.
  select br.total_balance into v_outstanding
  from public.billing_records br
  where br.billing_id = v_tenant.bed_space_id;
  v_outstanding := coalesce(v_outstanding, 0);

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    p_actor,
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

  -- Release the auth link so the bed/email can be re-onboarded cleanly.
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

-- ─── Rent increment (forward-only) ───────────────────────────────────────────
--
-- Updates the lease rate on bed_spaces only. Outstanding amounts
-- (accumulated_total / total_balance) are deliberately left untouched so nobody
-- is retroactively pushed into arrears; the new rate bills from the next cycle.

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
as $$
declare
  v_row record;
  v_new numeric;
begin
  if p_mode not in ('percentage', 'fixed') then
    raise exception 'Unsupported mode %, expected percentage or fixed', p_mode;
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Increase value must be greater than zero';
  end if;

  if p_bed_ids is null or array_length(p_bed_ids, 1) is null then
    raise exception 'At least one bed space is required';
  end if;

  for v_row in
    select b.id, b.rent_amount, t.id as tenant_id, t.full_name, t.email
    from public.bed_spaces b
    left join public.tenants t on t.bed_space_id = b.id and t.status = 'active'
    where b.id = any(p_bed_ids)
    order by b.id
  loop
    if p_mode = 'percentage' then
      v_new := round(v_row.rent_amount * (1 + p_value / 100.0), 2);
    else
      v_new := round(v_row.rent_amount + p_value, 2);
    end if;

    update public.bed_spaces set rent_amount = v_new where id = v_row.id;

    insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
    values (
      p_actor,
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

grant execute on function public.reconcile_bed_space(text) to anon, authenticated;
grant execute on function public.audit_occupancy() to anon, authenticated;
grant execute on function public.evict_tenant(uuid, text, text, public.tenant_status) to anon, authenticated;
grant execute on function public.apply_rent_increment(text[], text, numeric, date, text) to anon, authenticated;
