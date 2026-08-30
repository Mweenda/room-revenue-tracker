-- Server-side authorization + notification history.
--
-- Before this migration the privileged RPCs (evict_tenant, apply_rent_increment,
-- reconcile_*, audit_occupancy) were granted to `anon`, so anyone holding the
-- publishable key could evict every tenant or raise every rent. Landlord checks
-- existed only in the browser. This migration moves those checks into the
-- database and gives the notification path an audit trail.
--
-- Re-runnable: every statement is guarded with `if not exists` / `or replace`.

-- ─── Link profiles to Supabase Auth users ────────────────────────────────────
--
-- `profiles.id` defaults to a random uuid and was never tied to auth.users, so
-- the database had no way to tell whether a caller was a landlord. Mirror the
-- `tenants.auth_user_id` pattern rather than repointing the primary key.

alter table public.profiles
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists profiles_auth_user_idx
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

create index if not exists profiles_role_idx on public.profiles (role);

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

-- ─── Authorization helpers ───────────────────────────────────────────────────
--
-- security definer so they can read profiles/tenants without tripping the
-- row-level policies that reference them (see migration 007).

create or replace function public.is_landlord()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.role = 'landlord'
      and (
        p.auth_user_id = auth.uid()
        or (
          p.auth_user_id is null
          and p.email is not null
          and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;

comment on function public.is_landlord() is
  'True when the current JWT belongs to a landlord profile (matched by auth_user_id, or by email for profiles not yet linked).';

create or replace function public.current_landlord_email()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() ->> 'email', null);
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id
  from public.tenants t
  where t.status = 'active'
    and (
      t.auth_user_id = auth.uid()
      or (
        t.auth_user_id is null
        and t.email is not null
        and lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  limit 1;
$$;

comment on function public.current_tenant_id() is
  'Active tenant row belonging to the current JWT, or null.';

-- Raises unless the caller is a landlord. Used by every privileged RPC.
create or replace function public.assert_landlord(p_action text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_landlord() then
    raise exception 'Landlord access required to %', p_action
      using errcode = '42501';
  end if;
end;
$$;

-- Links the signed-in auth user to their landlord profile by email. Lets an
-- existing (seeded) landlord profile adopt a newly created auth user without a
-- manual SQL step.
create or replace function public.link_landlord_profile()
returns table (
  profile_id uuid,
  role text,
  full_name text,
  email text,
  phone text,
  address text,
  bio text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email = '' then
    raise exception 'A signed-in session is required' using errcode = '42501';
  end if;

  update public.profiles p
  set auth_user_id = v_uid
  where p.role = 'landlord'
    and p.auth_user_id is null
    and p.email is not null
    and lower(p.email) = v_email;

  return query
  select p.id, p.role, p.full_name, p.email, p.phone, p.address, p.bio
  from public.profiles p
  where p.role = 'landlord'
    and p.auth_user_id = v_uid
  limit 1;
end;
$$;

-- Pre-auth existence check for the student login flow. Returns a bare boolean
-- so the locked-down tenants policies never need to expose PII to `anon`.
create or replace function public.tenant_exists_for_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenants t
    where t.status = 'active'
      and t.email is not null
      and lower(t.email) = lower(coalesce(p_email, ''))
  );
$$;

-- ─── Notification history ────────────────────────────────────────────────────
--
-- Written by the send-email Edge Function on every dispatch attempt so failed
-- deliveries are visible instead of vanishing into a console log.

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  recipient_email text not null,
  notification_type text not null,
  subject text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error_message text,
  actor_email text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_log_tenant_idx
  on public.notification_log (tenant_id, created_at desc);
create index if not exists notification_log_status_idx
  on public.notification_log (status, created_at desc);
create index if not exists notification_log_type_idx
  on public.notification_log (notification_type, created_at desc);

alter table public.notification_log enable row level security;

-- The Edge Function writes with the secret key (bypasses RLS). Landlords read.
drop policy if exists "anon_all_notification_log" on public.notification_log;
drop policy if exists "landlord_read_notification_log" on public.notification_log;
create policy "landlord_read_notification_log" on public.notification_log
  for select to authenticated using (public.is_landlord());

-- ─── Re-create privileged RPCs with server-side authorization ─────────────────
--
-- The actor is now taken from the JWT instead of a client-supplied argument, so
-- audit entries cannot be forged. The p_actor parameter is retained for
-- signature compatibility but ignored.

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
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_new numeric;
  v_actor text;
begin
  perform public.assert_landlord('apply a rent increment');
  v_actor := coalesce(public.current_landlord_email(), p_actor);

  if p_mode not in ('percentage', 'fixed') then
    raise exception 'Unsupported mode %, expected percentage or fixed', p_mode;
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Increase value must be greater than zero';
  end if;

  -- Guard against a fat-fingered bulk increase.
  if p_mode = 'percentage' and p_value > 100 then
    raise exception 'Percentage increase of % exceeds the 100 percent safety limit', p_value;
  end if;

  if p_bed_ids is null or array_length(p_bed_ids, 1) is null then
    raise exception 'At least one bed space is required';
  end if;

  if p_effective_date is null then
    raise exception 'An effective date is required';
  end if;

  for v_row in
    select b.id, b.rent_amount, t.id as tenant_id, t.full_name, t.email
    from public.bed_spaces b
    left join public.tenants t on t.bed_space_id = b.id and t.status = 'active'
    where b.id = any(p_bed_ids)
    order by b.id
    -- Serialise concurrent increments so two landlords cannot compound each
    -- other's increase on the same bed.
    for update of b
  loop
    if p_mode = 'percentage' then
      v_new := round(v_row.rent_amount * (1 + p_value / 100.0), 2);
    else
      v_new := round(v_row.rent_amount + p_value, 2);
    end if;

    update public.bed_spaces set rent_amount = v_new where id = v_row.id;

    insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
    values (
      v_actor,
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

-- Occupancy maintenance is a landlord operation too.
-- Signature must stay `returns integer` — create or replace cannot change it.
create or replace function public.reconcile_all_occupancy()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bed_id text;
  v_count integer := 0;
begin
  perform public.assert_landlord('reconcile occupancy');

  for v_bed_id in select id from public.bed_spaces order by id loop
    perform public.reconcile_bed_space(v_bed_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
--
-- `anon` loses execute on every privileged RPC. Authenticated callers are still
-- checked inside each function via assert_landlord().

revoke execute on function public.evict_tenant(uuid, text, text, public.tenant_status) from anon;
revoke execute on function public.apply_rent_increment(text[], text, numeric, date, text) from anon;
revoke execute on function public.reconcile_bed_space(text) from anon;
revoke execute on function public.reconcile_all_occupancy() from anon;
revoke execute on function public.audit_occupancy() from anon;

grant execute on function public.evict_tenant(uuid, text, text, public.tenant_status) to authenticated;
grant execute on function public.apply_rent_increment(text[], text, numeric, date, text) to authenticated;
grant execute on function public.reconcile_bed_space(text) to authenticated;
grant execute on function public.reconcile_all_occupancy() to authenticated;
grant execute on function public.audit_occupancy() to authenticated;

grant execute on function public.is_landlord() to anon, authenticated;
grant execute on function public.current_tenant_id() to anon, authenticated;
grant execute on function public.current_landlord_email() to authenticated;
grant execute on function public.assert_landlord(text) to authenticated;
grant execute on function public.link_landlord_profile() to authenticated;

-- Needed before login, hence anon. Returns only a boolean.
grant execute on function public.tenant_exists_for_email(text) to anon, authenticated;
