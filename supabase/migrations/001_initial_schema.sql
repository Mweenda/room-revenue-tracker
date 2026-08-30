-- Room Revenue Tracker — initial schema (data-only / permissive anon RLS)
-- Run this in the Supabase SQL Editor before seed.sql

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.block_code as enum ('BBH', 'NWG', 'ANX', 'CRV');
create type public.room_gender as enum ('Male', 'Female');
create type public.bed_status as enum ('occupied', 'vacant');
create type public.billing_status as enum (
  'Open Window',
  'Paid / Secured',
  'OVERDUE / UNPAID',
  'Vacant',
  'Grace Period'
);
create type public.pay_status as enum ('pending', 'verified', 'rejected');
create type public.payment_method as enum ('Airtel', 'MTN');
create type public.issue_status as enum ('open', 'in_progress', 'resolved');
create type public.issue_category as enum ('Plumbing', 'Electrical', 'Structural', 'Appliance');

-- ─── Blocks ──────────────────────────────────────────────────────────────────

create table public.blocks (
  code public.block_code primary key,
  name text not null,
  owner_utility_cap numeric(10, 2) not null default 70,
  created_at timestamptz not null default now()
);

-- ─── Bed spaces ──────────────────────────────────────────────────────────────

create table public.bed_spaces (
  id text primary key,                       -- e.g. BBH-1-A
  block_code public.block_code not null references public.blocks (code) on delete cascade,
  room_number integer not null,
  bed_letter text not null,
  room_gender public.room_gender not null,
  rent_amount numeric(10, 2) not null,
  status public.bed_status not null default 'vacant',
  created_at timestamptz not null default now(),
  unique (block_code, room_number, bed_letter)
);

create index bed_spaces_block_idx on public.bed_spaces (block_code);
create index bed_spaces_status_idx on public.bed_spaces (status);

-- ─── Profiles (optional display; no auth required for data-only mode) ───────

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('landlord', 'student')),
  full_name text not null,
  email text,
  phone text,
  address text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Tenants ─────────────────────────────────────────────────────────────────

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  bed_space_id text not null unique references public.bed_spaces (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  nrc text default '-',
  move_in_date date,
  is_active boolean not null default true,
  profile_image_url text,
  created_at timestamptz not null default now()
);

create index tenants_bed_idx on public.tenants (bed_space_id);

-- ─── Billing records ─────────────────────────────────────────────────────────

create table public.billing_records (
  billing_id text primary key references public.bed_spaces (id) on delete cascade,
  house_block public.block_code not null,
  room_number text not null,
  bed_space text not null,
  room_gender public.room_gender not null,
  tenant_name text not null default 'Vacant',
  phone_number text not null default '-',
  entry_date text not null default '-',
  current_rent numeric(10, 2) not null,
  target_month text not null default '-',
  accumulated_total numeric(12, 2) not null default 0,
  total_balance numeric(12, 2) not null default 0,
  days_past_due integer not null default 0,
  billing_status public.billing_status not null default 'Vacant',
  adjustments_fees numeric(10, 2) not null default 0,
  adjustment_notes text not null default '',
  updated_at timestamptz not null default now()
);

create index billing_status_idx on public.billing_records (billing_status);
create index billing_block_idx on public.billing_records (house_block);

-- ─── Payments ────────────────────────────────────────────────────────────────

create table public.payments (
  id text primary key,
  student_name text not null,
  bed_space_id text not null references public.bed_spaces (id) on delete cascade,
  amount numeric(10, 2) not null,
  method public.payment_method not null,
  transaction_ref text not null,
  submitted_at date not null default current_date,
  status public.pay_status not null default 'pending',
  rejection_reason text,
  proof_url text,
  created_at timestamptz not null default now()
);

create index payments_status_idx on public.payments (status);
create index payments_bed_idx on public.payments (bed_space_id);

-- ─── Maintenance issues ──────────────────────────────────────────────────────

create table public.maintenance_issues (
  id text primary key,
  bed_space_id text not null references public.bed_spaces (id) on delete cascade,
  student_name text not null,
  category public.issue_category not null,
  description text not null,
  reported_date date not null default current_date,
  status public.issue_status not null default 'open',
  resolution_note text,
  image_url text,
  created_at timestamptz not null default now()
);

create index issues_status_idx on public.maintenance_issues (status);

-- ─── Utility entries ─────────────────────────────────────────────────────────

create table public.utility_entries (
  id uuid primary key default gen_random_uuid(),
  block_code public.block_code not null references public.blocks (code) on delete cascade,
  month text not null,
  total_cost numeric(12, 2) not null,
  active_students integer not null default 0,
  owner_contribution numeric(12, 2) not null default 0,
  excess numeric(12, 2) not null default 0,
  students_settled text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (block_code, month)
);

-- ─── Billing status state machine ────────────────────────────────────────────
-- Matches rules in src/imports/pasted_text/room-revenue-schema.json

create or replace function public.compute_billing_status(
  p_tenant_name text,
  p_total_balance numeric,
  p_current_rent numeric,
  p_days_past_due integer,
  p_target_month text,
  p_current_month text default 'Jul'
)
returns public.billing_status
language plpgsql
immutable
as $$
begin
  if p_tenant_name is null or lower(trim(p_tenant_name)) = 'vacant' then
    return 'Vacant';
  end if;

  if p_total_balance = 0 then
    return 'Paid / Secured';
  end if;

  -- Overdue: past 5-day grace or billed against a prior cycle month
  if p_total_balance > 0 and (
    p_days_past_due > 5
    or p_target_month in ('Mar', 'Jun')
  ) then
    return 'OVERDUE / UNPAID';
  end if;

  -- Grace: 1–5 days past due within the current cycle
  if p_total_balance > 0 and p_days_past_due >= 1 and p_days_past_due <= 5 then
    return 'Grace Period';
  end if;

  if p_total_balance = p_current_rent and p_target_month = p_current_month then
    return 'Open Window';
  end if;

  -- Fallback: outstanding balance in current cycle (on time)
  if p_total_balance > 0 then
    return 'Open Window';
  end if;

  return 'Vacant';
end;
$$;

create or replace function public.billing_records_recompute_status()
returns trigger
language plpgsql
as $$
begin
  new.billing_status := public.compute_billing_status(
    new.tenant_name,
    new.total_balance,
    new.current_rent,
    new.days_past_due,
    new.target_month,
    'Jul'
  );
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_billing_recompute_status
  before insert or update of tenant_name, total_balance, current_rent, days_past_due, target_month
  on public.billing_records
  for each row
  execute function public.billing_records_recompute_status();

-- Keep bed_spaces.status in sync when a tenant is inserted/deleted

create or replace function public.sync_bed_occupied_on_tenant()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    update public.bed_spaces
      set status = 'occupied'
      where id = new.bed_space_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.bed_spaces
      set status = 'vacant'
      where id = old.bed_space_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_tenant_sync_bed
  after insert or update or delete on public.tenants
  for each row
  execute function public.sync_bed_occupied_on_tenant();

-- Deduct balance when a payment is verified

create or replace function public.apply_verified_payment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    update public.billing_records
      set total_balance = greatest(0, total_balance - new.amount)
      where billing_id = new.bed_space_id;
  end if;
  return new;
end;
$$;

create trigger trg_payment_verified
  after update of status on public.payments
  for each row
  execute function public.apply_verified_payment();

-- ─── Storage buckets ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values
  ('payment-proofs', 'payment-proofs', true),
  ('maintenance-photos', 'maintenance-photos', true)
on conflict (id) do nothing;

-- ─── Permissive RLS (temporary — data-only / no auth) ────────────────────────
-- WARNING: Allows anonymous read/write. Tighten before production.

alter table public.blocks enable row level security;
alter table public.bed_spaces enable row level security;
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.billing_records enable row level security;
alter table public.payments enable row level security;
alter table public.maintenance_issues enable row level security;
alter table public.utility_entries enable row level security;

create policy "anon_all_blocks" on public.blocks for all to anon, authenticated using (true) with check (true);
create policy "anon_all_bed_spaces" on public.bed_spaces for all to anon, authenticated using (true) with check (true);
create policy "anon_all_profiles" on public.profiles for all to anon, authenticated using (true) with check (true);
create policy "anon_all_tenants" on public.tenants for all to anon, authenticated using (true) with check (true);
create policy "anon_all_billing" on public.billing_records for all to anon, authenticated using (true) with check (true);
create policy "anon_all_payments" on public.payments for all to anon, authenticated using (true) with check (true);
create policy "anon_all_issues" on public.maintenance_issues for all to anon, authenticated using (true) with check (true);
create policy "anon_all_utilities" on public.utility_entries for all to anon, authenticated using (true) with check (true);

create policy "anon_read_payment_proofs" on storage.objects
  for select to anon, authenticated using (bucket_id = 'payment-proofs');
create policy "anon_write_payment_proofs" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'payment-proofs');
create policy "anon_update_payment_proofs" on storage.objects
  for update to anon, authenticated using (bucket_id = 'payment-proofs');

create policy "anon_read_maintenance_photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'maintenance-photos');
create policy "anon_write_maintenance_photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'maintenance-photos');
create policy "anon_update_maintenance_photos" on storage.objects
  for update to anon, authenticated using (bucket_id = 'maintenance-photos');
