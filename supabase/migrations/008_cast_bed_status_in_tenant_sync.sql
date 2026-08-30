-- CASE branches without an explicit enum cast were inferred as text, so any
-- tenants UPDATE failed with: column "status" is of type bed_status but
-- expression is of type text.

create or replace function public.sync_bed_occupied_on_tenant()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> old.id
        ) then 'occupied'::public.bed_status
        else 'vacant'::public.bed_status
      end
      where id = old.bed_space_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.bed_space_id is distinct from new.bed_space_id then
    update public.bed_spaces
      set status = case
        when exists (
          select 1 from public.tenants
          where bed_space_id = old.bed_space_id and status = 'active' and id <> new.id
        ) then 'occupied'::public.bed_status
        else 'vacant'::public.bed_status
      end
      where id = old.bed_space_id;
  end if;

  update public.bed_spaces
    set status = case
      when new.status = 'active' then 'occupied'::public.bed_status
      else 'vacant'::public.bed_status
    end
    where id = new.bed_space_id
      and not (
        new.status <> 'active'
        and exists (
          select 1 from public.tenants
          where bed_space_id = new.bed_space_id and status = 'active' and id <> new.id
        )
      );

  return new;
end;
$$;
