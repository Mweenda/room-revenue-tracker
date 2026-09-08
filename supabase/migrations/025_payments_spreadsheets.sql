-- Private landlord spreadsheet originals. Parsed rows land in payments /
-- billing_records / bed_spaces — this bucket is the audit copy, not a second ledger.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payments-spreadsheets',
  'payments-spreadsheets',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.spreadsheet_uploads (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  payments_upserted integer not null default 0,
  payments_skipped integer not null default 0,
  roster_updated integer not null default 0,
  billing_updated integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists spreadsheet_uploads_landlord_idx
  on public.spreadsheet_uploads (landlord_id, created_at desc);

alter table public.spreadsheet_uploads enable row level security;

drop trigger if exists trg_spreadsheet_uploads_set_landlord on public.spreadsheet_uploads;
create trigger trg_spreadsheet_uploads_set_landlord
  before insert on public.spreadsheet_uploads
  for each row
  execute function public.tg_set_landlord_id();

drop policy if exists "landlord_own_spreadsheet_uploads" on public.spreadsheet_uploads;
create policy "landlord_own_spreadsheet_uploads" on public.spreadsheet_uploads
  for all to authenticated
  using (landlord_id = public.current_landlord_id())
  with check (landlord_id = public.current_landlord_id());

drop policy if exists "landlord_read_spreadsheets" on storage.objects;
create policy "landlord_read_spreadsheets" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payments-spreadsheets'
    and public.is_landlord()
    and (storage.foldername(name))[1] = public.current_landlord_id()::text
  );

drop policy if exists "landlord_write_spreadsheets" on storage.objects;
create policy "landlord_write_spreadsheets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payments-spreadsheets'
    and public.is_landlord()
    and (storage.foldername(name))[1] = public.current_landlord_id()::text
  );

drop policy if exists "landlord_update_spreadsheets" on storage.objects;
create policy "landlord_update_spreadsheets" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payments-spreadsheets'
    and public.is_landlord()
    and (storage.foldername(name))[1] = public.current_landlord_id()::text
  )
  with check (
    bucket_id = 'payments-spreadsheets'
    and public.is_landlord()
    and (storage.foldername(name))[1] = public.current_landlord_id()::text
  );

drop policy if exists "landlord_delete_spreadsheets" on storage.objects;
create policy "landlord_delete_spreadsheets" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payments-spreadsheets'
    and public.is_landlord()
    and (storage.foldername(name))[1] = public.current_landlord_id()::text
  );
