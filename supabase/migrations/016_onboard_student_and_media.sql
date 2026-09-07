-- Atomic landlord onboarding + occupancy trigger that cannot be blocked by RLS.
--
-- Client-side tenant/billing/bed inserts were a multi-step transaction that
-- could fail part-way (or on the occupancy trigger, which ran as the caller).
-- onboard_student() mirrors update_tenant() / evict_tenant(): landlord-only,
-- security definer, one round trip. The occupancy trigger is also definer so
-- assigning a tenant always marks the bed occupied.

-- ─── Occupancy trigger must not be subject to the caller's RLS ───────────────

create or replace function public.sync_bed_occupied_on_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> old.id
        ) then 'occupied'::public.bed_status
        else 'vacant'::public.bed_status
      end
      where id = old.bed_space_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.bed_space_id is distinct from new.bed_space_id then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> new.id
        ) then 'occupied'::public.bed_status
        else 'vacant'::public.bed_status
      end
      where id = old.bed_space_id;
  end if;

  update public.bed_spaces
    set status = case
      when new.status = 'active' then 'occupied'::public.bed_status
      else 'vacant'::public.bed_status
    end
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

-- ─── Tenant media: keep student uploads working even if email casing / auth ──
-- link is lagging. Folder name must still equal current_tenant_id().

drop policy if exists "Tenants manage their own media" on storage.objects;
create policy "Tenants manage their own media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-media'
  and public.current_tenant_id() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists "Tenants update their own media" on storage.objects;
create policy "Tenants update their own media"
on storage.objects for update to authenticated
using (
  bucket_id = 'tenant-media'
  and public.current_tenant_id() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
)
with check (
  bucket_id = 'tenant-media'
  and public.current_tenant_id() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

-- ─── onboard_student ─────────────────────────────────────────────────────────

create or replace function public.onboard_student(
  p_bed_space_id text,
  p_full_name text,
  p_phone text,
  p_email text,
  p_nrc text default '-',
  p_move_in_date date default current_date,
  p_rent_amount numeric default null,
  p_target_month text default null
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
    bed_space_id, full_name, phone, email, nrc, move_in_date, status
  )
  values (
    p_bed_space_id,
    v_name,
    v_phone,
    v_email,
    coalesce(nullif(btrim(coalesce(p_nrc, '')), ''), '-'),
    coalesce(p_move_in_date, current_date),
    'active'
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
  on conflict (billing_id) do update
  set
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
    billing_status = excluded.billing_status,
    updated_at = now();

  perform public.reconcile_bed_space(p_bed_space_id);

  insert into public.audit_log (actor_email, action, entity_type, entity_id, after, note)
  values (
    v_actor,
    'tenant_onboard',
    'tenant',
    v_tenant.id::text,
    jsonb_build_object(
      'full_name', v_tenant.full_name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'bed_space_id', v_tenant.bed_space_id,
      'move_in_date', v_tenant.move_in_date,
      'rent_amount', v_rent
    ),
    'Onboarded student ' || v_name
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

revoke all on function public.onboard_student(text, text, text, text, text, date, numeric, text) from public, anon;
grant execute on function public.onboard_student(text, text, text, text, text, date, numeric, text) to authenticated;
