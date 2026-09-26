-- Pending receipts are keyed by bed, not tenant. After eviction or a bed move
-- they used to stay pending, so Verify credited whoever currently occupies
-- that bed. Match the active occupant before applying the ledger, reject
-- leftovers on evict, and keep unfinished receipts with a student who moves.

create or replace function public.payment_matches_bed_occupant(
  p_student_name text,
  p_bed_space_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenants t
    where t.bed_space_id = p_bed_space_id
      and t.status = 'active'
      and btrim(coalesce(p_student_name, '')) <> ''
      and lower(btrim(t.full_name)) = lower(btrim(p_student_name))
  );
$$;

revoke all on function public.payment_matches_bed_occupant(text, text) from public, anon, authenticated;

create or replace function public.apply_verified_payment()
returns trigger
language plpgsql
as $$
declare
  v_row public.billing_records%rowtype;
  v_ledger record;
  v_days integer;
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    if not public.payment_matches_bed_occupant(new.student_name, new.bed_space_id) then
      raise exception 'Payment no longer belongs to the current occupant of %', new.bed_space_id;
    end if;

    select * into v_row
    from public.billing_records
    where billing_id = new.bed_space_id
    for update;

    if found then
      select * into v_ledger
      from public.apply_payment_to_ledger(
        v_row.total_balance,
        v_row.current_rent,
        v_row.target_month,
        new.amount,
        public.current_billing_month()
      );
      v_days := public.days_past_due_for_month(v_ledger.target_month, (timezone('Africa/Lusaka', now()))::date, v_ledger.total_balance > 0);
      update public.billing_records
      set
        total_balance = v_ledger.total_balance,
        target_month = v_ledger.target_month,
        days_past_due = v_days
      where billing_id = v_row.billing_id;
    end if;
  end if;
  return new;
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
  v_tenant uuid;
begin
  perform public.assert_landlord('verify a payment');

  select * into v_before from public.payments where id = p_payment_id;
  if not found or not public.landlord_owns_bed(v_before.bed_space_id) then
    raise exception 'Payment % not found', p_payment_id;
  end if;
  if v_before.status = 'verified' then
    return v_before;
  end if;
  if not public.payment_matches_bed_occupant(v_before.student_name, v_before.bed_space_id) then
    raise exception 'Payment % no longer belongs to the current occupant of %', p_payment_id, v_before.bed_space_id;
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

  v_tenant := public.active_tenant_on_bed(v_after.bed_space_id);
  perform public.notify_tenant(
    v_tenant,
    'payment_approved',
    jsonb_build_object('amount', v_after.amount, 'bedSpace', v_after.bed_space_id, 'dueDate', v_after.submitted_at::text),
    'payment_approved:' || v_after.id
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

  update public.payments
  set
    status = 'rejected',
    rejection_reason = 'Tenant vacated'
  where status = 'pending'
    and bed_space_id = v_tenant.bed_space_id;

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

  update public.payments
  set
    student_name = btrim(p_full_name),
    bed_space_id = p_bed_space_id
  where status = 'pending'
    and bed_space_id = v_old_bed_id
    and lower(btrim(student_name)) = lower(btrim(v_tenant.full_name));

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
