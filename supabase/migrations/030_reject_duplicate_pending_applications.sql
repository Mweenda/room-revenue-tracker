-- A pending application is insert-only per email.
--
-- submit_student_application used to UPDATE the existing pending row when the
-- same email was submitted again. That silently replaced the original name,
-- NRC, gender, phone, and note. A second person who mistyped the first
-- applicant's email (or an attacker who knew it) could change who the landlord
-- thought they were approving, then onboard_student would create the tenant
-- from the overwritten fields while the invite still went to the original
-- address.
--
-- The unique pending-email index stays as the race-safety net. A second submit
-- now fails with a clear error instead of clobbering the first request.

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

  if exists (
    select 1 from public.student_applications
    where lower(email) = v_email and status = 'pending'
  ) then
    raise exception 'This email already has a pending bed space request. Please wait for the landlord to review it.';
  end if;

  begin
    insert into public.student_applications (
      full_name, email, phone, nrc, gender, preferred_move_in_date, note, auth_user_id
    )
    values (
      v_name, v_email, v_phone, v_nrc, v_gender, p_preferred_move_in_date, v_note, auth.uid()
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'This email already has a pending bed space request. Please wait for the landlord to review it.';
  end;

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

grant execute on function public.submit_student_application(text, text, text, text, text, date, text) to anon, authenticated;
