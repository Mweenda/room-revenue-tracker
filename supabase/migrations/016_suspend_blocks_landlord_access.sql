-- Suspended landlords must not keep platform access.
--
-- Migration 015 added profiles.status and the admin console can mark a landlord
-- suspended, but is_landlord() / current_landlord_id() / link_landlord_profile()
-- still treated any landlord-role row as authorized. A suspended landlord with
-- a live JWT (or whose GoTrue ban failed — the edge function previously
-- swallowed that error) could keep evicting tenants, changing rent, and
-- verifying payments. These helpers now require status = 'active'.

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
      and p.status = 'active'
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
  'True when the current JWT belongs to an active landlord profile (matched by auth_user_id, or by email for profiles not yet linked). Suspended landlords are excluded.';

create or replace function public.current_landlord_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.role = 'landlord'
    and p.status = 'active'
    and (
      p.auth_user_id = auth.uid()
      or (
        p.auth_user_id is null
        and p.email is not null
        and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  limit 1;
$$;

comment on function public.current_landlord_id() is
  'profiles.id of the signed-in active landlord, or null.';

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
    and p.status = 'active'
    and p.auth_user_id is null
    and p.email is not null
    and lower(p.email) = v_email;

  return query
  select p.id, p.role, p.full_name, p.email, p.phone, p.address, p.bio
  from public.profiles p
  where p.role = 'landlord'
    and p.status = 'active'
    and p.auth_user_id = v_uid
  limit 1;
end;
$$;
