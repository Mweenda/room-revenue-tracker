-- Gender-aware student self-onboarding, 5-day grace overdue, invite TTL,
-- payment edits, and calendar-synced days past due.

-- ─── Tenant gender ───────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists gender public.room_gender;

comment on column public.tenants.gender is
  'Student gender; bed assignment must match bed_spaces.room_gender.';

-- ─── Invite tokens (24h, always longer than the 15-minute minimum) ───────────

create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  landlord_id uuid references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists student_invites_email_idx
  on public.student_invites (lower(email), created_at desc);

alter table public.student_invites enable row level security;

drop policy if exists "landlord_own_student_invites" on public.student_invites;
create policy "landlord_own_student_invites" on public.student_invites
  for all to authenticated
  using (landlord_id = public.current_landlord_id())
  with check (landlord_id = public.current_landlord_id());

drop policy if exists "student_read_own_invite" on public.student_invites;
create policy "student_read_own_invite" on public.student_invites
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ─── Overdue only after the 5-day grace period ───────────────────────────────

create or replace function public.compute_billing_status(
  p_tenant_name text,
  p_total_balance numeric,
  p_current_rent numeric,
  p_days_past_due integer,
  p_target_month text,
  p_current_month text default 'Jul'
)
returns public.billing_status
language plpgsql
immutable
as $$
begin
  if p_tenant_name is null or lower(trim(p_tenant_name)) = 'vacant' then
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

create or replace function public.days_past_due_for_month(
  p_target_month text,
  p_as_of date default (timezone('utc', now()))::date
)
returns integer
language plpgsql
immutable
as $$
declare
  v_idx integer;
  v_due date;
begin
  if p_target_month is null or btrim(p_target_month) in ('', '-') then
    return 0;
  end if;

  v_idx := array_position(
    array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    initcap(btrim(p_target_month))
  );
  if v_idx is null then
    return 0;
  end if;

  v_due := make_date(extract(year from p_as_of)::integer, v_idx, 1);
  return greatest(0, p_as_of - v_due);
end;
$$;

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
  set days_past_due = public.days_past_due_for_month(target_month)
  where tenant_name is distinct from 'Vacant'
    and lower(trim(tenant_name)) is distinct from 'vacant';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.sync_billing_due_dates() from anon;
grant execute on function public.sync_billing_due_dates() to authenticated;

-- ─── Record / refresh a portal invite ────────────────────────────────────────

create or replace function public.ensure_student_invite(
  p_email text,
  p_full_name text default null,
  p_tenant_id uuid default null,
  p_landlord_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_landlord uuid := coalesce(p_landlord_id, public.current_landlord_id());
  v_id uuid;
begin
  if v_email = '' then
    raise exception 'An email is required';
  end if;

  insert into public.student_invites (email, full_name, landlord_id, tenant_id, expires_at)
  values (
    v_email,
    nullif(btrim(coalesce(p_full_name, '')), ''),
    v_landlord,
    p_tenant_id,
    timezone('utc', now()) + interval '24 hours'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.ensure_student_invite(text, text, uuid, uuid) from anon;
grant execute on function public.ensure_student_invite(text, text, uuid, uuid) to authenticated;

-- ─── Vacant beds for the invited student ─────────────────────────────────────

create or replace function public.vacant_beds_for_onboarding(p_gender public.room_gender)
returns table (
  id text,
  block_code public.block_code,
  room_number integer,
  bed_letter text,
  room_gender public.room_gender,
  rent_amount numeric,
  status public.bed_status,
  assigned boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_landlord uuid;
  v_assigned text;
begin
  if v_email = '' then
    raise exception 'Not authenticated';
  end if;

  select t.bed_space_id,
         coalesce(b.landlord_id, public.current_tenant_landlord_id())
  into v_assigned, v_landlord
  from public.tenants t
  left join public.bed_spaces bs on bs.id = t.bed_space_id
  left join public.blocks b on b.code = bs.block_code
  where t.status = 'active'
    and t.email is not null
    and lower(t.email) = v_email
  limit 1;

  if v_landlord is null then
    select si.landlord_id, si.tenant_id
    into v_landlord, v_assigned
    from public.student_invites si
    where lower(si.email) = v_email
      and si.used_at is null
      and si.expires_at > timezone('utc', now())
    order by si.created_at desc
    limit 1;
  end if;

  if v_landlord is null then
    v_landlord := public.current_tenant_landlord_id();
  end if;

  if v_landlord is null then
    raise exception 'No active invite was found for this email';
  end if;

  return query
  select
    bs.id,
    bs.block_code,
    bs.room_number,
    bs.bed_letter,
    bs.room_gender,
    bs.rent_amount,
    bs.status,
    (v_assigned is not null and bs.id = v_assigned)
  from public.bed_spaces bs
  join public.blocks bl on bl.code = bs.block_code
  where bl.landlord_id = v_landlord
    and bs.room_gender = p_gender
    and (
      bs.status = 'vacant'
      or not exists (
        select 1 from public.tenants t
        where t.bed_space_id = bs.id and t.status = 'active'
      )
      or (v_assigned is not null and bs.id = v_assigned)
    );
end;
$$;

revoke execute on function public.vacant_beds_for_onboarding(public.room_gender) from anon;
grant execute on function public.vacant_beds_for_onboarding(public.room_gender) to authenticated;

-- ─── Student completes onboarding after the invite link ──────────────────────

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
  v_month text := to_char(timezone('UTC', now()), 'Mon');
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

revoke execute on function public.complete_student_onboarding(public.room_gender, text, text, text, text, date) from anon;
grant execute on function public.complete_student_onboarding(public.room_gender, text, text, text, text, date) to authenticated;

-- ─── Landlord payment edit ───────────────────────────────────────────────────

create or replace function public.update_payment(
  p_payment_id text,
  p_student_name text,
  p_bed_space_id text,
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
  v_row public.payments%rowtype;
begin
  perform public.assert_landlord('edit a payment');

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_transaction_ref is null or btrim(p_transaction_ref) = '' then
    raise exception 'A transaction reference is required';
  end if;
  if p_student_name is null or btrim(p_student_name) = '' then
    raise exception 'A student name is required';
  end if;
  if not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  update public.payments
  set
    student_name = btrim(p_student_name),
    bed_space_id = p_bed_space_id,
    amount = round(p_amount, 2),
    method = p_method,
    transaction_ref = btrim(p_transaction_ref),
    submitted_at = coalesce(p_submitted_at, submitted_at)
  where id = p_payment_id
  returning * into v_row;

  if not found then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.update_payment(text, text, text, numeric, public.payment_method, text, date) from anon;
grant execute on function public.update_payment(text, text, text, numeric, public.payment_method, text, date) to authenticated;

-- ─── Persist gender on landlord onboarding ───────────────────────────────────

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
  v_month := coalesce(nullif(btrim(coalesce(p_target_month, '')), ''), to_char(timezone('UTC', now()), 'Mon'));

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

-- Keep PostgREST from seeing two onboard_student overloads.
drop function if exists public.onboard_student(text, text, text, text, text, date, numeric, text);

revoke execute on function public.onboard_student(text, text, text, text, text, date, numeric, text, public.room_gender) from anon;
grant execute on function public.onboard_student(text, text, text, text, text, date, numeric, text, public.room_gender) to authenticated;

-- Recompute stored due counters now that the calendar rule is the source of truth.
select public.sync_billing_due_dates();
