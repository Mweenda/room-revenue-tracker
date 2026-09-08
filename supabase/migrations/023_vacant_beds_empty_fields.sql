-- Vacant bed spaces store empty tenant fields (not 'Vacant' / '-').
-- SQL status still treats blank / '-' / 'vacant' as Vacant so leftover rows stay unbilled.

create or replace function public.is_vacant_tenant_name(p_tenant_name text)
returns boolean
language sql
immutable
as $$
  select p_tenant_name is null
    or btrim(p_tenant_name) = ''
    or lower(btrim(p_tenant_name)) in ('vacant', '-');
$$;

alter table public.billing_records
  alter column tenant_name set default '';

create or replace function public.compute_billing_status(
  p_tenant_name text,
  p_total_balance numeric,
  p_current_rent numeric,
  p_days_past_due integer,
  p_target_month text,
  p_current_month text default public.current_billing_month()
)
returns public.billing_status
language plpgsql
immutable
as $$
begin
  if public.is_vacant_tenant_name(p_tenant_name) then
    return 'Vacant';
  end if;

  if p_total_balance = 0 then
    return 'Paid / Secured';
  end if;

  if p_total_balance > 0 and p_days_past_due > 5 then
    return 'OVERDUE / UNPAID';
  end if;

  if p_total_balance > 0 and p_days_past_due >= 1 and p_days_past_due <= 5 then
    return 'Grace Period';
  end if;

  if p_total_balance = p_current_rent and p_target_month = p_current_month then
    return 'Open Window';
  end if;

  if p_total_balance > 0 then
    return 'Open Window';
  end if;

  return 'Vacant';
end;
$$;

create or replace function public.roll_billing_cycle(
  p_as_of date default (timezone('Africa/Lusaka', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_month text := public.current_billing_month(p_as_of);
  v_count integer := 0;
  r public.billing_records%rowtype;
  v_target text;
  v_last text;
  v_charge integer;
  v_extra numeric;
  v_balance numeric;
  v_accum numeric;
  v_next text;
  v_days integer;
begin
  for r in
    select * from public.billing_records
    for update
  loop
    if public.is_vacant_tenant_name(r.tenant_name) then
      update public.billing_records
      set
        tenant_name = '',
        phone_number = '',
        entry_date = '',
        target_month = '',
        accumulated_total = 0,
        total_balance = 0,
        days_past_due = 0
      where billing_id = r.billing_id
        and (
          tenant_name is distinct from ''
          or phone_number is distinct from ''
          or entry_date is distinct from ''
          or target_month is distinct from ''
          or accumulated_total is distinct from 0
          or total_balance is distinct from 0
          or days_past_due is distinct from 0
        );
      continue;
    end if;

    v_target := case
      when r.target_month is null or btrim(r.target_month) in ('', '-') then v_month
      else r.target_month
    end;
    v_last := public.last_charged_month(v_target, r.total_balance, r.current_rent);
    v_charge := least(24, public.months_to_charge(v_target, v_month, r.total_balance, r.current_rent));
    v_extra := v_charge * r.current_rent;
    v_balance := round((r.total_balance + v_extra) * 100) / 100;
    v_accum := round((r.accumulated_total + v_extra) * 100) / 100;
    v_next := case
      when v_charge > 0 and r.total_balance <= 0 and v_last is not null
        then public.add_billing_months(v_last, 1)
      else v_target
    end;
    v_days := public.days_past_due_for_month(v_next, p_as_of, v_balance > 0);

    update public.billing_records
    set
      target_month = v_next,
      accumulated_total = v_accum,
      total_balance = v_balance,
      days_past_due = v_days
    where billing_id = r.billing_id
      and (
        target_month is distinct from v_next
        or accumulated_total is distinct from v_accum
        or total_balance is distinct from v_balance
        or days_past_due is distinct from v_days
      );

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.roll_billing_cycle(date) from anon;
grant execute on function public.roll_billing_cycle(date) to authenticated;

create or replace function public.sync_billing_due_dates()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  update public.billing_records
  set days_past_due = public.days_past_due_for_month(
    target_month,
    (timezone('Africa/Lusaka', now()))::date,
    total_balance > 0
  )
  where not public.is_vacant_tenant_name(tenant_name);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.sync_billing_due_dates() from anon;
grant execute on function public.sync_billing_due_dates() to authenticated;

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
      phone_number = coalesce(v_tenant.phone, ''),
      entry_date = coalesce(v_tenant.move_in_date::text, ''),
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
        v_tenant.full_name, coalesce(v_tenant.phone, ''),
        coalesce(v_tenant.move_in_date::text, ''), v_bed.rent_amount,
        to_char(now(), 'Mon'), v_bed.rent_amount, v_bed.rent_amount, 0
      );
    end if;
  else
    update public.bed_spaces set status = 'vacant' where id = p_bed_id;

    update public.billing_records
    set
      tenant_name = '',
      phone_number = '',
      entry_date = '',
      total_balance = 0,
      accumulated_total = 0,
      days_past_due = 0,
      target_month = ''
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

  select
    'bed_occupied_no_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is occupied but no active tenant is assigned'::text
  from public.bed_spaces b
  left join active_tenants t on t.bed_space_id = b.id
  where b.status = 'occupied' and t.id is null

  union all

  select
    'bed_vacant_has_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is vacant but tenant ' || t.full_name || ' is assigned'::text
  from public.bed_spaces b
  inner join active_tenants t on t.bed_space_id = b.id
  where b.status = 'vacant'

  union all

  select
    'billing_vacant_has_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing is Vacant but tenant ' || t.full_name || ' exists'::text
  from public.billing_records b
  inner join active_tenants t on t.bed_space_id = b.billing_id
  where b.billing_status = 'Vacant'
     or public.is_vacant_tenant_name(b.tenant_name)

  union all

  select
    'billing_occupied_no_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing shows ' || b.tenant_name || ' but no active tenant exists'::text
  from public.billing_records b
  left join active_tenants t on t.bed_space_id = b.billing_id
  where t.id is null
    and b.billing_status <> 'Vacant'
    and not public.is_vacant_tenant_name(b.tenant_name)

  union all

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

update public.billing_records
set
  tenant_name = '',
  phone_number = '',
  entry_date = '',
  target_month = '',
  accumulated_total = 0,
  total_balance = 0,
  days_past_due = 0
where billing_status = 'Vacant'
   or public.is_vacant_tenant_name(tenant_name);

update public.tenants
set nrc = null
where nrc is not null and btrim(nrc) in ('', '-');
