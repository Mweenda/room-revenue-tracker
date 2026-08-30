-- Link Supabase Auth users to tenant profiles and normalize tenant emails.

alter table public.tenants
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists tenants_email_lower_idx
  on public.tenants (lower(email))
  where email is not null;

create index if not exists tenants_auth_user_idx
  on public.tenants (auth_user_id)
  where auth_user_id is not null;

create or replace function public.normalize_tenant_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_tenant_email on public.tenants;
create trigger trg_normalize_tenant_email
  before insert or update of email on public.tenants
  for each row
  execute function public.normalize_tenant_email();

-- Backfill existing emails to lowercase for consistent lookups.
update public.tenants
set email = lower(trim(email))
where email is not null and email <> lower(trim(email));
