-- Persistent tenant profile media.
alter table public.tenants add column if not exists profile_image_url text;

insert into storage.buckets (id, name, public)
values ('tenant-media', 'tenant-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Tenant media is publicly readable" on storage.objects;
create policy "Tenant media is publicly readable"
on storage.objects for select
using (bucket_id = 'tenant-media');

drop policy if exists "Authenticated tenants can upload profile media" on storage.objects;
create policy "Authenticated tenants can upload profile media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-media'
  and exists (
    select 1 from public.tenants
    where id::text = (storage.foldername(name))[1]
      and lower(email) = lower(auth.jwt() ->> 'email')
  )
);

drop policy if exists "Authenticated tenants can update profile media" on storage.objects;
create policy "Authenticated tenants can update profile media"
on storage.objects for update to authenticated
using (
  bucket_id = 'tenant-media'
  and exists (
    select 1 from public.tenants
    where id::text = (storage.foldername(name))[1]
      and lower(email) = lower(auth.jwt() ->> 'email')
  )
);
