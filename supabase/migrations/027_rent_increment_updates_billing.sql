-- Rent increment must update the live billing rate. bed_spaces.rent_amount
-- alone is not enough: roll_billing_cycle charges billing_records.current_rent,
-- so leaving that column on the old figure undercharges every later month.

create or replace function public.apply_rent_increment(
  p_bed_ids text[],
  p_mode text,
  p_value numeric,
  p_effective_date date,
  p_actor text default null
)
returns table (
  bed_space_id text,
  tenant_id uuid,
  tenant_name text,
  tenant_email text,
  old_rent numeric,
  new_rent numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_new numeric;
  v_actor text;
begin
  perform public.assert_landlord('apply a rent increment');
  v_actor := coalesce(public.current_landlord_email(), p_actor);

  if p_mode not in ('percentage', 'fixed') then
    raise exception 'Unsupported mode %, expected percentage or fixed', p_mode;
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'Increase value must be greater than zero';
  end if;

  if p_mode = 'percentage' and p_value > 100 then
    raise exception 'Percentage increase of % exceeds the 100 percent safety limit', p_value;
  end if;

  if p_bed_ids is null or array_length(p_bed_ids, 1) is null then
    raise exception 'At least one bed space is required';
  end if;

  if p_effective_date is null then
    raise exception 'An effective date is required';
  end if;

  if exists (
    select 1
    from unnest(p_bed_ids) as u(bed_id)
    where not public.landlord_owns_bed(u.bed_id)
  ) then
    raise exception 'One or more bed spaces are not part of your property'
      using errcode = '42501';
  end if;

  for v_row in
    select b.id, b.rent_amount, t.id as tenant_id, t.full_name, t.email
    from public.bed_spaces b
    left join public.tenants t on t.bed_space_id = b.id and t.status = 'active'
    where b.id = any(p_bed_ids)
    order by b.id
    for update of b
  loop
    if p_mode = 'percentage' then
      v_new := round(v_row.rent_amount * (1 + p_value / 100.0), 2);
    else
      v_new := round(v_row.rent_amount + p_value, 2);
    end if;

    update public.bed_spaces set rent_amount = v_new where id = v_row.id;

    -- Keep the live ledger rate in lockstep. Do not touch balance or target
    -- month: arrears stay at the amount already charged.
    update public.billing_records
    set current_rent = v_new
    where billing_id = v_row.id
      and current_rent is distinct from v_new;

    insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
    values (
      v_actor,
      'rent_increment',
      'bed_space',
      v_row.id,
      jsonb_build_object('rent_amount', v_row.rent_amount),
      jsonb_build_object(
        'rent_amount', v_new,
        'mode', p_mode,
        'value', p_value,
        'effective_date', p_effective_date
      ),
      case
        when v_row.tenant_id is null then 'Vacant bed'
        else 'Tenant: ' || v_row.full_name
      end
    );

    if v_row.tenant_id is not null and v_new <> v_row.rent_amount then
      perform public.notify_tenant(
        v_row.tenant_id,
        'rent_increase',
        jsonb_build_object(
          'bedSpace', v_row.id,
          'oldAmount', v_row.rent_amount,
          'newAmount', v_new,
          'effectiveDate', p_effective_date::text
        ),
        'rent_increase:' || v_row.id || ':' || p_effective_date::text
      );
    end if;

    return query
    select v_row.id, v_row.tenant_id, v_row.full_name, v_row.email, v_row.rent_amount, v_new;
  end loop;
end;
$$;
