-- Lock down SECURITY DEFINER RPCs from migrations 017–020.
--
-- roll_billing_cycle / sync_billing_due_dates were granted to every
-- authenticated role, updated every landlord's ledger, and accepted a client
-- date. Month names wrap (Sep → Aug = 11), so a student (or any JWT) could
-- POST roll_billing_cycle with p_as_of in another month and add up to 11
-- months of rent to every occupied bed. The landlord dashboard already calls
-- the RPC on load with no date; keep that path, but use the server clock and
-- the caller's property only.
--
-- record_manual_payment verified cash against any bed id (BBH-1-A is public
-- in seed). apply_verified_payment then wrote the other landlord's balance.
--
-- ensure_student_invite had no landlord check, so a JWT could mint an invite
-- for their own email with another landlord_id (the seed profile id is public).
-- complete_student_onboarding then skipped the property check when landlord_id
-- was null, letting an already-onboarded student take any vacant bed.

-- ─── Monthly roll: landlord-only, own property, server date ──────────────────

create or replace function public.roll_billing_cycle(
  p_as_of date default (timezone('Africa/Lusaka', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ignore p_as_of: callers can pass any date via PostgREST. Month-name math
  -- has no year, so a forged "current" month wraps and over-charges.
  v_as_of date := (timezone('Africa/Lusaka', now()))::date;
  v_month text := public.current_billing_month(v_as_of);
  v_landlord uuid;
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
  perform public.assert_landlord('roll billing');
  v_landlord := public.current_landlord_id();
  if v_landlord is null then
    raise exception 'Landlord access required to roll billing'
      using errcode = '42501';
  end if;

  for r in
    select br.*
    from public.billing_records br
    join public.bed_spaces bs on bs.id = br.billing_id
    join public.blocks b on b.code = bs.block_code
    where b.landlord_id = v_landlord
    for update of br
  loop
    if r.tenant_name is null or lower(btrim(r.tenant_name)) = 'vacant' then
      update public.billing_records
      set
        target_month = '-',
        accumulated_total = 0,
        total_balance = 0,
        days_past_due = 0
      where billing_id = r.billing_id
        and (
          target_month is distinct from '-'
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
    v_days := public.days_past_due_for_month(v_next, v_as_of, v_balance > 0);

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

comment on function public.roll_billing_cycle(date) is
  'Landlord-only monthly charge for the caller''s beds. p_as_of is accepted for signature stability and ignored; the Africa/Lusaka clock is the source of truth.';

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
  v_landlord uuid;
begin
  perform public.assert_landlord('sync billing due dates');
  v_landlord := public.current_landlord_id();
  if v_landlord is null then
    raise exception 'Landlord access required to sync billing due dates'
      using errcode = '42501';
  end if;

  update public.billing_records br
  set days_past_due = public.days_past_due_for_month(
    br.target_month,
    (timezone('Africa/Lusaka', now()))::date,
    br.total_balance > 0
  )
  where br.tenant_name is distinct from 'Vacant'
    and lower(trim(br.tenant_name)) is distinct from 'vacant'
    and exists (
      select 1
      from public.bed_spaces bs
      join public.blocks b on b.code = bs.block_code
      where bs.id = br.billing_id
        and b.landlord_id = v_landlord
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.sync_billing_due_dates() from anon;
grant execute on function public.sync_billing_due_dates() to authenticated;

-- ─── Cash receipts stay on the caller's beds ─────────────────────────────────

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
  if not found or not public.landlord_owns_bed(p_bed_space_id) then
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

-- ─── Invites cannot name another landlord ────────────────────────────────────

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
  v_landlord uuid;
  v_id uuid;
begin
  if v_email = '' then
    raise exception 'An email is required';
  end if;

  if public.is_landlord() then
    v_landlord := public.current_landlord_id();
  elsif auth.uid() is null then
    -- Service-role / SQL: send-email and migrations pass the tenant's landlord.
    v_landlord := p_landlord_id;
  else
    raise exception 'Landlord access required to create a student invite'
      using errcode = '42501';
  end if;

  if v_landlord is null then
    raise exception 'A landlord is required';
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

-- ─── Onboarding stays on the invite / current landlord ───────────────────────

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
  v_chosen_bed text := p_bed_space_id;
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
    and expires_at > timezone('utc', now())
  order by created_at desc
  limit 1;

  select * into v_tenant
  from public.tenants
  where status = 'active'
    and email is not null
    and lower(email) = v_email
  limit 1;

  if v_invite.id is not null then
    v_landlord := v_invite.landlord_id;
  elsif v_tenant.id is not null then
    select b.landlord_id into v_landlord
    from public.bed_spaces bs
    join public.blocks b on b.code = bs.block_code
    where bs.id = v_tenant.bed_space_id;
  end if;

  if v_landlord is null then
    raise exception 'No active invite was found for this email';
  end if;

  -- Already onboarded and the invite is spent: keep the assigned bed.
  if v_invite.id is null then
    if v_tenant.bed_space_id is distinct from p_bed_space_id then
      raise exception 'Students cannot reassign their bed space'
        using errcode = '42501';
    end if;
    v_chosen_bed := v_tenant.bed_space_id;
  end if;

  select * into v_bed from public.bed_spaces where id = v_chosen_bed for update;
  if not found then
    raise exception 'Bed space % not found', v_chosen_bed;
  end if;

  if v_bed.room_gender is distinct from p_gender then
    raise exception 'Choose a bed that matches your gender';
  end if;

  if not exists (
    select 1 from public.blocks bl
    where bl.code = v_bed.block_code and bl.landlord_id = v_landlord
  ) then
    raise exception 'That bed is not on your landlord''s property';
  end if;

  select * into v_occupant
  from public.tenants t
  where t.bed_space_id = v_chosen_bed
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
      v_chosen_bed,
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
      bed_space_id = v_chosen_bed
    where id = v_tenant.id
    returning * into v_tenant;

    if v_chosen_bed is distinct from v_old_bed then
      perform public.reconcile_bed_space(v_old_bed);
    end if;
    perform public.reconcile_bed_space(v_chosen_bed);

    update public.billing_records
    set
      tenant_name = v_name,
      phone_number = coalesce(v_phone, phone_number),
      entry_date = coalesce(p_move_in_date, current_date)::text,
      room_gender = v_bed.room_gender
    where billing_id = v_chosen_bed;
  end if;

  update public.bed_spaces set status = 'occupied' where id = v_chosen_bed;

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
