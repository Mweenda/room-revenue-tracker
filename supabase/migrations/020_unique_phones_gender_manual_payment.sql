-- Unique tenant phones, gender on landlord tenant edits, and cash/manual receipts.

alter type public.payment_method add value if not exists 'Cash';

update public.tenants
set phone = null
where phone is not null and btrim(phone) in ('', '-');

with ranked as (
  select
    id,
    bed_space_id,
    phone,
    row_number() over (
      partition by regexp_replace(btrim(phone), '[^0-9]', '', 'g')
      order by move_in_date nulls last, id
    ) as rn
  from public.tenants
  where status = 'active'
    and phone is not null
    and regexp_replace(btrim(phone), '[^0-9]', '', 'g') <> ''
),
dups as (
  select
    ranked.*,
    row_number() over (order by bed_space_id, id) as seq
  from ranked
  where rn > 1
)
update public.tenants t
set phone = '260769' || lpad(d.seq::text, 6, '0')
from dups d
where t.id = d.id;

update public.billing_records br
set phone_number = coalesce(t.phone, '-')
from public.tenants t
where t.bed_space_id = br.billing_id
  and t.status = 'active';

drop index if exists public.tenants_active_phone_idx;

create unique index tenants_active_phone_idx
  on public.tenants (regexp_replace(btrim(phone), '[^0-9]', '', 'g'))
  where status = 'active'
    and phone is not null
    and btrim(phone) not in ('', '-');

drop function if exists public.update_tenant(uuid, text, text, text, text, date, text, numeric);

create or replace function public.update_tenant(
  p_tenant_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_nrc text,
  p_move_in_date date,
  p_bed_space_id text,
  p_rent_amount numeric,
  p_gender public.room_gender default null
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
  v_gender public.room_gender;
  v_phone_digits text;
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
  if v_phone in ('-') then
    v_phone := null;
  end if;
  v_phone_digits := regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g');

  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  if v_tenant.status <> 'active' then
    raise exception 'Only active tenants can be edited';
  end if;

  v_old_bed_id := v_tenant.bed_space_id;

  select * into v_new_bed from public.bed_spaces where id = p_bed_space_id for update;
  if not found then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  v_gender := coalesce(p_gender, v_tenant.gender, v_new_bed.room_gender);
  if v_gender is distinct from v_new_bed.room_gender then
    raise exception 'Student gender must match the bed space (%)', v_new_bed.room_gender;
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

  if v_phone_digits <> '' then
    if exists (
      select 1 from public.tenants t
      where t.status = 'active'
        and t.id <> p_tenant_id
        and t.phone is not null
        and regexp_replace(btrim(t.phone), '[^0-9]', '', 'g') = v_phone_digits
    ) then
      raise exception 'Phone % is already assigned to another active tenant', v_phone;
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
      'gender', v_tenant.gender,
      'move_in_date', v_tenant.move_in_date,
      'bed_space_id', v_tenant.bed_space_id,
      'rent_amount', (select bs.rent_amount from public.bed_spaces bs where bs.id = v_old_bed_id)
    ),
    jsonb_build_object(
      'full_name', btrim(p_full_name),
      'email', v_email,
      'phone', v_phone,
      'nrc', coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
      'gender', v_gender,
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
    gender = v_gender,
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

revoke execute on function public.update_tenant(uuid, text, text, text, text, date, text, numeric, public.room_gender) from anon;
grant execute on function public.update_tenant(uuid, text, text, text, text, date, text, numeric, public.room_gender) to authenticated;

create or replace function public.record_manual_payment(
  p_bed_space_id text,
  p_student_name text,
  p_amount numeric,
  p_method public.payment_method,
  p_transaction_ref text,
  p_submitted_at date
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_row public.payments%rowtype;
  v_bed public.bed_spaces%rowtype;
begin
  perform public.assert_landlord('record a payment');

  if p_bed_space_id is null or btrim(p_bed_space_id) = '' then
    raise exception 'A bed space is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_student_name is null or btrim(p_student_name) = '' then
    raise exception 'A student name is required';
  end if;

  select * into v_bed from public.bed_spaces where id = p_bed_space_id;
  if not found then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  v_id := 'p-manual-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.payments (
    id, student_name, bed_space_id, amount, method, transaction_ref, submitted_at, status
  ) values (
    v_id,
    btrim(p_student_name),
    p_bed_space_id,
    round(p_amount, 2),
    p_method,
    coalesce(nullif(btrim(coalesce(p_transaction_ref, '')), ''), 'CASH-' || to_char(coalesce(p_submitted_at, (timezone('Africa/Lusaka', now()))::date), 'YYYYMMDD')),
    coalesce(p_submitted_at, (timezone('Africa/Lusaka', now()))::date),
    'pending'
  )
  returning * into v_row;

  update public.payments
  set status = 'verified', rejection_reason = null
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.record_manual_payment(text, text, numeric, public.payment_method, text, date) from anon;
grant execute on function public.record_manual_payment(text, text, numeric, public.payment_method, text, date) to authenticated;
