-- RRT admin role, is_admin() helper, and robust tenant media upload policies.
--
-- Two concerns:
--   1. Introduce an 'admin' profile role so a Room Revenue Tracker operator can
--      onboard landlords (the actual account creation happens in the
--      `admin` Edge Function, which runs with the service role).
--   2. Make sure a signed-in student can always upload receipts and maintenance
--      photos into their own tenant-media folder. Migration 002 only matched on
--      email; this keys on current_tenant_id() so it also works when the tenant
--      is linked by auth_user_id or when the email casing differs.

-- ─── 1. Admin role ───────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('landlord', 'student', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.role = 'admin'
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

comment on function public.is_admin() is
  'True when the current JWT belongs to an RRT admin profile.';

grant execute on function public.is_admin() to anon, authenticated;

-- ─── 2. Tenant media uploads ─────────────────────────────────────────────────

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
