-- Students can UPDATE their own tenant row (contact details, profile photo).
-- Migration 016 made sync_bed_occupied_on_tenant() SECURITY DEFINER so a
-- landlord onboard cannot be blocked by RLS. That also means a student who
-- changes bed_space_id would have the occupancy trigger mark beds occupied /
-- vacant as the table owner, bypassing landlord_write_own_beds.
--
-- Concrete trigger: a signed-in student PATCHes
--   tenants.bed_space_id = '<any vacant bed>'
-- RLS student_update_own_tenant allows it (same row, still active). The
-- definer trigger then vacates their old bed and occupies the new one, including
-- another landlord's vacant bed if the id is guessed. Billing and payments
-- follow current_tenant_bed_id(), so the student would see the stolen bed.
--
-- Landlords keep using update_tenant() / evict_tenant() (JWT still identifies
-- them). Service-role / migration writes have no auth.uid() and are allowed.

create or replace function public.protect_tenant_self_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_landlord() or auth.uid() is null then
    return new;
  end if;

  if new.bed_space_id is distinct from old.bed_space_id then
    raise exception 'Students cannot reassign their bed space'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Students cannot change occupancy status'
      using errcode = '42501';
  end if;

  -- First login may stamp auth_user_id; swapping it to another account is not allowed.
  if new.auth_user_id is distinct from old.auth_user_id
     and not (old.auth_user_id is null and new.auth_user_id = auth.uid()) then
    raise exception 'Students cannot reassign the linked login'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.protect_tenant_self_update() is
  'Blocks student self-updates of occupancy and auth linkage; landlords and service-role writes pass through.';

drop trigger if exists trg_protect_tenant_self_update on public.tenants;
create trigger trg_protect_tenant_self_update
  before update on public.tenants
  for each row
  execute function public.protect_tenant_self_update();
