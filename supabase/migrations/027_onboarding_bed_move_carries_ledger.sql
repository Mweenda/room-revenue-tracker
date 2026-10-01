-- complete_student_onboarding used to reconcile the old bed (zeroing its
-- outstanding balance) and then copy only tenant metadata onto the new bed.
-- Students who pick a different vacant bed during invite setup therefore
-- vanished from the ledger. Carry the same occupancy totals update_tenant
-- already preserves on a landlord-initiated move.

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
  v_balance numeric := 0;
  v_accumulated numeric := 0;
  v_days integer := 0;
  v_target text := '-';
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

    if p_bed_space_id is distinct from v_old_bed then
      select
        coalesce(br.total_balance, 0),
        coalesce(br.accumulated_total, 0),
        coalesce(br.days_past_due, 0),
        coalesce(nullif(br.target_month, ''), '-')
      into v_balance, v_accumulated, v_days, v_target
      from public.billing_records br
      where br.billing_id = v_old_bed;
    end if;

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

    if p_bed_space_id is distinct from v_old_bed then
      update public.billing_records
      set
        total_balance = coalesce(v_balance, 0),
        accumulated_total = coalesce(v_accumulated, 0),
        days_past_due = coalesce(v_days, 0),
        target_month = coalesce(v_target, '-')
      where billing_id = p_bed_space_id;
    end if;
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
