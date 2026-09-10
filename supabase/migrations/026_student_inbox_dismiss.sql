-- Students can hide inbox messages they have already dealt with.
-- Seen messages keep their read_at so a later sync cannot resurrect the unread badge.

alter table public.student_notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists student_notifications_tenant_active_idx
  on public.student_notifications (tenant_id, created_at desc)
  where dismissed_at is null;

create or replace function public.dismiss_student_notification(p_id uuid)
returns public.student_notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_notifications%rowtype;
begin
  update public.student_notifications
  set
    dismissed_at = coalesce(dismissed_at, now()),
    read_at = coalesce(read_at, now())
  where id = p_id
    and tenant_id = public.current_tenant_id()
  returning * into v_row;

  if not found then
    raise exception 'Notification not found' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

grant execute on function public.dismiss_student_notification(uuid) to authenticated;
