-- Account preferences that must survive a new browser: WhatsApp client,
-- color mode, and whether the student welcome ad has been dismissed.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  whatsapp_client text not null default 'auto'
    check (whatsapp_client in ('auto', 'app', 'web')),
  color_mode text
    check (color_mode is null or color_mode in ('light', 'dark')),
  welcome_ad_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
  on public.user_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row
  execute function public.touch_user_preferences_updated_at();

grant select, insert, update on public.user_preferences to authenticated;
