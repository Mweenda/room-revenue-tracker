-- Student self-onboarding.
--
-- A prospective student submits an application from the public portal (no
-- account needed yet). Every landlord is notified in their inbox. The landlord
-- either assigns a vacant bed space — which onboards the student through the
-- existing onboard_student() path and emails a password invite — or rejects the
-- request. Applications are insert-only for the public through
-- submit_student_application(); all reads and state changes flow through
-- security-definer RPCs, so there are deliberately no direct write policies.

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.student_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  nrc text,
  gender public.room_gender,
  preferred_move_in_date date,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  assigned_bed_space_id text references public.bed_spaces (id) on delete set null,
  created_tenant_id uuid references public.tenants (id) on delete set null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_applications_status_idx
  on public.student_applications (status, created_at desc);

-- At most one open application per email.
create unique index if not exists student_applications_pending_email_idx
  on public.student_applications (lower(email))
  where status = 'pending';

alter table public.student_applications enable row level security;

-- Landlords and admins can read applications; applicants are notified by email,
-- so no anonymous read policy is exposed.
drop policy if exists "staff_read_applications" on public.student_applications;
create policy "staff_read_applications" on public.student_applications
  for select to authenticated
  using (public.current_landlord_id() is not null or public.is_admin());

-- ─── Landlord notification kind ──────────────────────────────────────────────

alter table public.landlord_notifications
  drop constraint if exists landlord_notifications_kind_check;
alter table public.landlord_notifications
  add constraint landlord_notifications_kind_check
  check (kind in (
    'rent_overdue',
    'payment_submitted',
    'payment_verified',
    'maintenance_submitted',
    'student_application'
  ));

-- ─── submit_student_application (public) ─────────────────────────────────────

create or replace function public.submit_student_application(
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_nrc text default null,
  p_gender text default null,
  p_preferred_move_in_date date default null,
  p_note text default null
)
returns public.student_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_nrc text := nullif(btrim(coalesce(p_nrc, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_gender public.room_gender;
  v_row public.student_applications%rowtype;
  v_landlord uuid;
  v_meta jsonb;
  v_title text;
  v_preview text;
  v_body text;
begin
  if v_name = '' then
    raise exception 'Your full name is required';
  end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;

  if p_gender in ('Male', 'Female') then
    v_gender := p_gender::public.room_gender;
  else
    v_gender := null;
  end if;

  if exists (
    select 1 from public.tenants t
    where t.status = 'active' and t.email is not null and lower(t.email) = v_email
  ) then
    raise exception 'This email already has an active bed space. Please sign in instead.';
  end if;

  select * into v_row
  from public.student_applications
  where lower(email) = v_email and status = 'pending'
  limit 1;

  if found then
    update public.student_applications
    set full_name = v_name,
        phone = v_phone,
        nrc = v_nrc,
        gender = coalesce(v_gender, gender),
        preferred_move_in_date = coalesce(p_preferred_move_in_date, preferred_move_in_date),
        note = coalesce(v_note, note),
        updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.student_applications (
      full_name, email, phone, nrc, gender, preferred_move_in_date, note, auth_user_id
    )
    values (
      v_name, v_email, v_phone, v_nrc, v_gender, p_preferred_move_in_date, v_note, auth.uid()
    )
    returning * into v_row;
  end if;

  v_meta := jsonb_build_object(
    'studentName', v_name,
    'email', v_email,
    'phone', coalesce(v_phone, ''),
    'gender', coalesce(v_gender::text, ''),
    'note', coalesce(v_note, ''),
    'applicationId', v_row.id::text,
    'hrefView', 'students'
  );
  v_title := 'New bed space request · ' || v_name;
  v_preview := v_name || ' applied for a bed space'
    || case when v_gender is not null then ' (' || v_gender::text || ')' else '' end || '.';
  v_body := v_name || ' submitted a self-onboarding request.'
    || E'\n\nEmail: ' || v_email
    || case when v_phone is not null then E'\nPhone: ' || v_phone else '' end
    || case when v_gender is not null then E'\nGender: ' || v_gender::text else '' end
    || case when p_preferred_move_in_date is not null
         then E'\nPreferred move-in: ' || to_char(p_preferred_move_in_date, 'YYYY-MM-DD') else '' end
    || case when v_note is not null then E'\n\nNote: ' || v_note else '' end
    || E'\n\nOpen Students to assign a bed space or reject the request.';

  for v_landlord in select id from public.profiles where role = 'landlord'
  loop
    insert into public.landlord_notifications (
      landlord_id, kind, title, preview, body, metadata, dedupe_key
    )
    values (
      v_landlord, 'student_application', v_title, v_preview, v_body, v_meta,
      'student_application:' || v_row.id::text
    )
    on conflict (landlord_id, dedupe_key) where dedupe_key is not null do nothing;
  end loop;

  return v_row;
end;
$$;

-- ─── list_student_applications (landlord / admin) ────────────────────────────

create or replace function public.list_student_applications(p_status text default null)
returns setof public.student_applications
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.student_applications
  where (public.current_landlord_id() is not null or public.is_admin())
    and (p_status is null or status = p_status)
  order by
    case status when 'pending' then 0 when 'approved' then 1 else 2 end,
    created_at desc;
$$;

-- ─── approve_student_application (landlord) ──────────────────────────────────

create or replace function public.approve_student_application(
  p_application_id uuid,
  p_bed_space_id text,
  p_rent_amount numeric default null,
  p_move_in_date date default null
)
returns table (
  tenant_id uuid,
  bed_space_id text,
  full_name text,
  email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.student_applications%rowtype;
  v_move date;
  v_result record;
begin
  perform public.assert_landlord('approve a student application');

  select * into v_app from public.student_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'This application has already been %', v_app.status;
  end if;

  if not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'That bed space is not part of your property';
  end if;

  v_move := coalesce(p_move_in_date, v_app.preferred_move_in_date, current_date);

  select t.tenant_id, t.bed_space_id, t.full_name, t.email
    into v_result
  from public.onboard_student(
    p_bed_space_id,
    v_app.full_name,
    coalesce(v_app.phone, ''),
    v_app.email,
    coalesce(v_app.nrc, '-'),
    v_move,
    p_rent_amount,
    null,
    v_app.gender
  ) as t;

  update public.student_applications
  set status = 'approved',
      reviewed_by = public.current_landlord_id(),
      reviewed_at = now(),
      assigned_bed_space_id = p_bed_space_id,
      created_tenant_id = v_result.tenant_id,
      updated_at = now()
  where id = p_application_id;

  update public.landlord_notifications
  set read_at = coalesce(read_at, now())
  where dedupe_key = 'student_application:' || p_application_id::text;

  return query
  select v_result.tenant_id, v_result.bed_space_id, v_result.full_name, v_result.email;
end;
$$;

-- ─── reject_student_application (landlord) ───────────────────────────────────

create or replace function public.reject_student_application(
  p_application_id uuid,
  p_reason text
)
returns public.student_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.student_applications%rowtype;
begin
  perform public.assert_landlord('reject a student application');

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required';
  end if;

  select * into v_app from public.student_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'This application has already been %', v_app.status;
  end if;

  update public.student_applications
  set status = 'rejected',
      review_note = btrim(p_reason),
      reviewed_by = public.current_landlord_id(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_app;

  update public.landlord_notifications
  set read_at = coalesce(read_at, now())
  where dedupe_key = 'student_application:' || p_application_id::text;

  return v_app;
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

grant select on public.student_applications to authenticated;
grant execute on function public.submit_student_application(text, text, text, text, text, date, text) to anon, authenticated;
grant execute on function public.list_student_applications(text) to authenticated;
grant execute on function public.approve_student_application(uuid, text, numeric, date) to authenticated;
grant execute on function public.reject_student_application(uuid, text) to authenticated;

-- ─── Realtime ────────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.student_applications';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;
