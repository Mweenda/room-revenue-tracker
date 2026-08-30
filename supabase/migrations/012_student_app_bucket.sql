-- Private bucket for the student Android APK. Authenticated students may
-- download; only landlords may upload or replace the package.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-apps',
  'student-apps',
  false,
  104857600,
  array['application/vnd.android.package-archive', 'application/octet-stream']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student_read_apps" on storage.objects;
create policy "student_read_apps" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-apps'
    and public.current_tenant_id() is not null
  );

drop policy if exists "landlord_write_apps" on storage.objects;
create policy "landlord_write_apps" on storage.objects
  for all to authenticated
  using (bucket_id = 'student-apps' and public.is_landlord())
  with check (bucket_id = 'student-apps' and public.is_landlord());
