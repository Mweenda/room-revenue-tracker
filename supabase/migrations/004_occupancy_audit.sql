-- Occupancy audit & reconciliation
-- Source of truth: tenants table (one tenant row per bed_space_id)

-- Prevent the same email from occupying two beds
create unique index if not exists tenants_email_unique_idx
  on public.tenants (lower(email))
  where email is not null and trim(email) <> '';

-- Prevent the same auth user from being linked to two tenants
-- (auth_user_id unique already added in 003)

-- Reconcile a single bed from tenant truth
create or replace function public.reconcile_bed_space(p_bed_id text)
returns void
language plpgsql
as $$
declare
  v_tenant public.tenants%rowtype;
  v_bed public.bed_spaces%rowtype;
begin
  select * into v_bed from public.bed_spaces where id = p_bed_id;
  if not found then
    raise exception 'Bed space % not found', p_bed_id;
  end if;

  select * into v_tenant from public.tenants where bed_space_id = p_bed_id;

  if found then
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
        'Jul', v_bed.rent_amount, v_bed.rent_amount, 0
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

create or replace function public.reconcile_all_occupancy()
returns integer
language plpgsql
as $$
declare
  v_bed_id text;
  v_count integer := 0;
begin
  for v_bed_id in select id from public.bed_spaces order by id loop
    perform public.reconcile_bed_space(v_bed_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Returns one row per integrity violation
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
  -- Bed marked occupied but no tenant
  select
    'bed_occupied_no_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is occupied but tenants has no row'::text
  from public.bed_spaces b
  left join public.tenants t on t.bed_space_id = b.id
  where b.status = 'occupied' and t.id is null

  union all

  -- Bed marked vacant but tenant exists
  select
    'bed_vacant_has_tenant'::text,
    'error'::text,
    b.id,
    'bed_spaces.status is vacant but tenant ' || t.full_name || ' is assigned'::text
  from public.bed_spaces b
  inner join public.tenants t on t.bed_space_id = b.id
  where b.status = 'vacant'

  union all

  -- Billing says Vacant but tenant exists
  select
    'billing_vacant_has_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing is Vacant but tenant ' || t.full_name || ' exists'::text
  from public.billing_records b
  inner join public.tenants t on t.bed_space_id = b.billing_id
  where b.billing_status = 'Vacant'
     or lower(trim(b.tenant_name)) = 'vacant'

  union all

  -- Billing shows occupant but no tenant
  select
    'billing_occupied_no_tenant'::text,
    'error'::text,
    b.billing_id,
    'billing shows ' || b.tenant_name || ' but no tenant row exists'::text
  from public.billing_records b
  left join public.tenants t on t.bed_space_id = b.billing_id
  where t.id is null
    and b.billing_status <> 'Vacant'
    and lower(trim(b.tenant_name)) <> 'vacant'

  union all

  -- Same email on multiple beds
  select
    'duplicate_email'::text,
    'error'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'email ' || min(t.email) || ' assigned to multiple beds'::text
  from public.tenants t
  where t.email is not null and trim(t.email) <> ''
  group by lower(t.email)
  having count(*) > 1

  union all

  -- Same auth user on multiple beds (should be impossible with unique constraint)
  select
    'duplicate_auth_user'::text,
    'error'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'auth_user_id linked to multiple beds'::text
  from public.tenants t
  where t.auth_user_id is not null
  group by t.auth_user_id
  having count(*) > 1

  union all

  -- Same phone on multiple beds (likely same person)
  select
    'duplicate_phone'::text,
    'warning'::text,
    string_agg(t.bed_space_id, ', ' order by t.bed_space_id),
    'phone ' || t.phone || ' used on multiple beds'::text
  from public.tenants t
  where t.phone is not null and trim(t.phone) not in ('', '-')
  group by t.phone
  having count(*) > 1;
$$;

grant execute on function public.reconcile_bed_space(text) to anon, authenticated;
grant execute on function public.reconcile_all_occupancy() to anon, authenticated;
grant execute on function public.audit_occupancy() to anon, authenticated;
