-- Stamp new occupancy ledgers with the Lusaka billing month.
--
-- onboard_student / complete_student_onboarding used to_char(UTC), while
-- roll_billing_cycle uses current_billing_month() in Africa/Lusaka. From
-- midnight to 02:00 Lusaka on the 1st, UTC is still the previous month, so
-- application approval wrote last month as target_month. The next dashboard
-- load rolls that ledger and charges a second month of rent.

create or replace function public.complete_student_onboarding(
  p_gender public.room_gender,
  p_bed_space_id text,
  p_full_name text,
  p_phone text default null,
  p_nrc text default '-',
  p_move_in_date date default current_date
)
returns table (
  tenant_id uuid,
  full_name text,
  phone text,
  email text,
  nrc text,
  move_in_date date,
  bed_space_id text,
  gender public.room_gender,
  rent_amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_bed public.bed_spaces%rowtype;
  v_tenant public.tenants%rowtype;
  v_invite public.student_invites%rowtype;
  v_landlord uuid;
  v_month text := public.current_billing_month();
  v_occupant public.tenants%rowtype;
  v_old_bed text;
begin
  if v_email = '' or v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'A full name is required';
  end if;
  if p_gender is null then
    raise exception 'Select your gender';
  end if;
  if p_bed_space_id is null or btrim(p_bed_space_id) = '' then
    raise exception 'Choose a vacant bed space';
  end if;

  select * into v_invite
  from public.student_invites
  where lower(email) = v_email
    and used_at is null
  order by created_at desc
  limit 1;

  if found then
    v_landlord := v_invite.landlord_id;
  end if;

  select * into v_tenant
  from public.tenants
  where status = 'active'
    and email is not null
    and lower(email) = v_email
  limit 1;

  if v_tenant.id is null and v_invite.id is null then
    raise exception 'No active invite was found for this email';
  end if;

  if v_tenant.id is null and v_invite.expires_at is not null and v_invite.expires_at <= timezone('utc', now()) then
    raise exception 'This invite link has expired. Ask your landlord to send a new one.';
  end if;

  select * into v_bed from public.bed_spaces where id = p_bed_space_id for update;
  if not found then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  if v_bed.room_gender is distinct from p_gender then
    raise exception 'Choose a bed that matches your gender';
  end if;

  if v_landlord is not null and not exists (
    select 1 from public.blocks bl
    where bl.code = v_bed.block_code and bl.landlord_id = v_landlord
  ) then
    raise exception 'That bed is not on your landlord''s property';
  end if;

  select * into v_occupant
  from public.tenants t
  where t.bed_space_id = p_bed_space_id
    and t.status = 'active'
    and (v_tenant.id is null or t.id <> v_tenant.id)
  limit 1;
  if found then
    raise exception 'Bed space is already occupied by %', v_occupant.full_name;
  end if;

  if v_tenant.id is null then
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, status, gender, auth_user_id
    ) values (
      p_bed_space_id,
      v_name,
      v_phone,
      v_email,
      coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
      coalesce(p_move_in_date, current_date),
      'active',
      p_gender,
      v_uid
    )
    returning * into v_tenant;

    insert into public.billing_records (
      billing_id, house_block, room_number, bed_space, room_gender,
      tenant_name, phone_number, entry_date, current_rent, target_month,
      accumulated_total, total_balance, days_past_due, billing_status
    )
    values (
      v_bed.id, v_bed.block_code, v_bed.room_number::text, v_bed.bed_letter, v_bed.room_gender,
      v_name, coalesce(v_phone, '-'), coalesce(p_move_in_date, current_date)::text,
      v_bed.rent_amount, v_month, v_bed.rent_amount, v_bed.rent_amount, 0, 'Open Window'
    )
    on conflict (billing_id) do update set
      tenant_name = excluded.tenant_name,
      phone_number = excluded.phone_number,
      entry_date = excluded.entry_date,
      current_rent = excluded.current_rent,
      target_month = excluded.target_month,
      accumulated_total = excluded.accumulated_total,
      total_balance = excluded.total_balance,
      days_past_due = 0,
      room_gender = excluded.room_gender,
      billing_status = 'Open Window';
  else
    v_old_bed := v_tenant.bed_space_id;
    update public.tenants
    set
      full_name = v_name,
      phone = coalesce(v_phone, phone),
      nrc = coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), nrc),
      move_in_date = coalesce(p_move_in_date, move_in_date),
      gender = p_gender,
      auth_user_id = v_uid,
      bed_space_id = p_bed_space_id
    where id = v_tenant.id
    returning * into v_tenant;

    if p_bed_space_id is distinct from v_old_bed then
      perform public.reconcile_bed_space(v_old_bed);
    end if;
    perform public.reconcile_bed_space(p_bed_space_id);

    update public.billing_records
    set
      tenant_name = v_name,
      phone_number = coalesce(v_phone, phone_number),
      entry_date = coalesce(p_move_in_date, current_date)::text,
      room_gender = v_bed.room_gender
    where billing_id = p_bed_space_id;
  end if;

  update public.bed_spaces set status = 'occupied' where id = p_bed_space_id;

  update public.student_invites
  set used_at = timezone('utc', now()), tenant_id = v_tenant.id
  where lower(email) = v_email
    and used_at is null;

  return query
  select v_tenant.id, v_tenant.full_name, v_tenant.phone, v_tenant.email, v_tenant.nrc,
         v_tenant.move_in_date, v_tenant.bed_space_id, v_tenant.gender, v_bed.rent_amount;
end;
$$;

create or replace function public.onboard_student(
  p_bed_space_id text,
  p_full_name text,
  p_phone text,
  p_email text,
  p_nrc text default '-',
  p_move_in_date date default current_date,
  p_rent_amount numeric default null,
  p_target_month text default null,
  p_gender public.room_gender default null
)
returns table (
  tenant_id uuid,
  full_name text,
  phone text,
  email text,
  nrc text,
  move_in_date date,
  bed_space_id text,
  rent_amount numeric,
  block_code public.block_code,
  room_number integer,
  bed_letter text,
  room_gender public.room_gender
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bed public.bed_spaces%rowtype;
  v_tenant public.tenants%rowtype;
  v_actor text;
  v_email text;
  v_phone text;
  v_rent numeric;
  v_month text;
  v_name text;
  v_occupant public.tenants%rowtype;
  v_gender public.room_gender;
begin
  perform public.assert_landlord('onboard a student');
  v_actor := public.current_landlord_email();

  v_name := btrim(coalesce(p_full_name, ''));
  if v_name = '' then
    raise exception 'A full name is required';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if v_email is null then
    raise exception 'An email is required so we can send the password invite';
  end if;

  if p_bed_space_id is null or btrim(p_bed_space_id) = '' then
    raise exception 'A bed space is required';
  end if;

  select * into v_bed from public.bed_spaces where id = p_bed_space_id for update;
  if not found or not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  v_gender := coalesce(p_gender, v_bed.room_gender);
  if v_gender is distinct from v_bed.room_gender then
    raise exception 'Student gender must match the bed space (%)', v_bed.room_gender;
  end if;

  v_rent := round(coalesce(p_rent_amount, v_bed.rent_amount), 2);
  if v_rent is null or v_rent <= 0 then
    raise exception 'Monthly rent must be greater than zero';
  end if;

  v_phone := nullif(btrim(coalesce(p_phone, '')), '');
  v_month := coalesce(nullif(btrim(coalesce(p_target_month, '')), ''), public.current_billing_month());

  select * into v_occupant
  from public.tenants t
  where t.bed_space_id = p_bed_space_id
    and t.status = 'active'
  limit 1;
  if found then
    raise exception 'Bed space is already occupied by %', v_occupant.full_name;
  end if;

  if exists (
    select 1 from public.tenants t
    where t.status = 'active'
      and t.email is not null
      and lower(t.email) = v_email
  ) then
    select t.bed_space_id into v_occupant.bed_space_id
    from public.tenants t
    where t.status = 'active'
      and t.email is not null
      and lower(t.email) = v_email
    limit 1;
    raise exception 'This email is already assigned to bed %', v_occupant.bed_space_id;
  end if;

  update public.bed_spaces
  set rent_amount = v_rent
  where id = p_bed_space_id;

  insert into public.tenants (
    bed_space_id, full_name, phone, email, nrc, move_in_date, status, gender
  )
  values (
    p_bed_space_id,
    v_name,
    v_phone,
    v_email,
    coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
    coalesce(p_move_in_date, current_date),
    'active',
    v_gender
  )
  returning * into v_tenant;

  insert into public.billing_records (
    billing_id, house_block, room_number, bed_space, room_gender,
    tenant_name, phone_number, entry_date, current_rent, target_month,
    accumulated_total, total_balance, days_past_due, billing_status
  )
  values (
    v_bed.id,
    v_bed.block_code,
    v_bed.room_number::text,
    v_bed.bed_letter,
    v_bed.room_gender,
    v_name,
    coalesce(v_phone, '-'),
    coalesce(p_move_in_date, current_date)::text,
    v_rent,
    v_month,
    v_rent,
    v_rent,
    0,
    'Open Window'
  )
  on conflict (billing_id) do update set
    house_block = excluded.house_block,
    room_number = excluded.room_number,
    bed_space = excluded.bed_space,
    room_gender = excluded.room_gender,
    tenant_name = excluded.tenant_name,
    phone_number = excluded.phone_number,
    entry_date = excluded.entry_date,
    current_rent = excluded.current_rent,
    target_month = excluded.target_month,
    accumulated_total = excluded.accumulated_total,
    total_balance = excluded.total_balance,
    days_past_due = excluded.days_past_due,
    billing_status = excluded.billing_status;

  update public.bed_spaces
  set status = 'occupied'
  where id = p_bed_space_id;

  perform public.ensure_student_invite(v_email, v_name, v_tenant.id, public.current_landlord_id());

  insert into public.audit_log (actor_email, action, entity_type, entity_id, after)
  values (
    v_actor,
    'tenant_onboard',
    'tenant',
    v_tenant.id::text,
    jsonb_build_object(
      'full_name', v_name,
      'email', v_email,
      'bed_space_id', p_bed_space_id,
      'gender', v_gender
    )
  );

  return query
  select
    v_tenant.id,
    v_tenant.full_name,
    v_tenant.phone,
    v_tenant.email,
    v_tenant.nrc,
    v_tenant.move_in_date,
    v_tenant.bed_space_id,
    v_rent,
    v_bed.block_code,
    v_bed.room_number,
    v_bed.bed_letter,
    v_bed.room_gender;
end;
$$;

create or replace function public.approve_student_application(
  p_application_id uuid,
  p_bed_space_id text,
  p_rent_amount numeric default null,
  p_move_in_date date default null
)
returns table (
  tenant_id uuid,
  bed_space_id text,
  full_name text,
  email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.student_applications%rowtype;
  v_move date;
  v_result record;
begin
  perform public.assert_landlord('approve a student application');

  select * into v_app from public.student_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'This application has already been %', v_app.status;
  end if;

  if not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'That bed space is not part of your property';
  end if;

  v_move := coalesce(p_move_in_date, v_app.preferred_move_in_date, current_date);

  select t.tenant_id, t.bed_space_id, t.full_name, t.email
    into v_result
  from public.onboard_student(
    p_bed_space_id,
    v_app.full_name,
    coalesce(v_app.phone, ''),
    v_app.email,
    coalesce(v_app.nrc, '-'),
    v_move,
    p_rent_amount,
    public.current_billing_month(),
    v_app.gender
  ) as t;

  update public.student_applications
  set status = 'approved',
      reviewed_by = public.current_landlord_id(),
      reviewed_at = now(),
      assigned_bed_space_id = p_bed_space_id,
      created_tenant_id = v_result.tenant_id,
      updated_at = now()
  where id = p_application_id;

  update public.landlord_notifications
  set read_at = coalesce(read_at, now())
  where dedupe_key = 'student_application:' || p_application_id::text;

  return query
  select v_result.tenant_id, v_result.bed_space_id, v_result.full_name, v_result.email;
end;
$$;
