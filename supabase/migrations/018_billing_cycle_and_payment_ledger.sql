-- Monthly billing roll, payment ledger, and live current-month status.
-- Mirrors src/lib/paymentTracking.ts so the landlord dashboard can replace
-- the Boarding House spreadsheet.

create or replace function public.current_billing_month(
  p_as_of date default (timezone('Africa/Lusaka', now()))::date
)
returns text
language sql
immutable
as $$
  select (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])
    [extract(month from p_as_of)::integer];
$$;

create or replace function public.billing_month_index(p_month text)
returns integer
language sql
immutable
as $$
  select array_position(
    array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    initcap(btrim(coalesce(p_month, '')))
  );
$$;

create or replace function public.add_billing_months(p_month text, p_count integer)
returns text
language plpgsql
immutable
as $$
declare
  v_idx integer := public.billing_month_index(p_month);
  v_next integer;
begin
  if v_idx is null then
    v_idx := 1;
  end if;
  v_next := ((v_idx - 1 + coalesce(p_count, 0)) % 12 + 12) % 12;
  return (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[v_next + 1];
end;
$$;

create or replace function public.months_from_to(p_from text, p_to text)
returns integer
language plpgsql
immutable
as $$
declare
  v_from integer := public.billing_month_index(p_from);
  v_to integer := public.billing_month_index(p_to);
begin
  if v_from is null or v_to is null then
    return 0;
  end if;
  return (v_to - v_from + 12) % 12;
end;
$$;

create or replace function public.months_owed(p_total_balance numeric, p_current_rent numeric)
returns integer
language sql
immutable
as $$
  select case
    when p_total_balance <= 0 or p_current_rent <= 0 then 0
    else greatest(1, ceil(round(p_total_balance * 100) / round(p_current_rent * 100))::integer)
  end;
$$;

create or replace function public.last_charged_month(
  p_target_month text,
  p_total_balance numeric,
  p_current_rent numeric
)
returns text
language plpgsql
immutable
as $$
declare
  v_owed integer := public.months_owed(p_total_balance, p_current_rent);
begin
  if public.billing_month_index(p_target_month) is null then
    return null;
  end if;
  if v_owed <= 0 then
    return initcap(btrim(p_target_month));
  end if;
  return public.add_billing_months(p_target_month, v_owed - 1);
end;
$$;

create or replace function public.months_to_charge(
  p_target_month text,
  p_current_month text,
  p_total_balance numeric,
  p_current_rent numeric
)
returns integer
language plpgsql
immutable
as $$
declare
  v_last text := public.last_charged_month(p_target_month, p_total_balance, p_current_rent);
  v_steps integer;
begin
  if v_last is null then
    return 0;
  end if;
  v_steps := public.months_from_to(v_last, p_current_month);
  if v_steps = 0 then
    return 0;
  end if;
  if p_total_balance <= 0 and v_steps > 6 then
    return 0;
  end if;
  return v_steps;
end;
$$;

create or replace function public.apply_payment_to_ledger(
  p_total_balance numeric,
  p_current_rent numeric,
  p_target_month text,
  p_amount numeric,
  p_current_month text default public.current_billing_month()
)
returns table (total_balance numeric, target_month text)
language plpgsql
immutable
as $$
declare
  v_old numeric := greatest(0, coalesce(p_total_balance, 0));
  v_new numeric := greatest(0, round((v_old - greatest(0, coalesce(p_amount, 0))) * 100) / 100);
  v_start text := case
    when public.billing_month_index(p_target_month) is null then p_current_month
    else initcap(btrim(p_target_month))
  end;
  v_cleared integer;
begin
  if v_new = 0 then
    total_balance := 0;
    target_month := p_current_month;
    return next;
    return;
  end if;

  v_cleared := greatest(
    0,
    public.months_owed(v_old, p_current_rent) - public.months_owed(v_new, p_current_rent)
  );
  total_balance := v_new;
  target_month := public.add_billing_months(v_start, v_cleared);
  return next;
end;
$$;

drop function if exists public.days_past_due_for_month(text, date);

create or replace function public.days_past_due_for_month(
  p_target_month text,
  p_as_of date default (timezone('Africa/Lusaka', now()))::date,
  p_unpaid boolean default true
)
returns integer
language plpgsql
immutable
as $$
declare
  v_idx integer;
  v_year integer := extract(year from p_as_of)::integer;
  v_due date;
begin
  if p_target_month is null or btrim(p_target_month) in ('', '-') then
    return 0;
  end if;

  v_idx := public.billing_month_index(p_target_month);
  if v_idx is null then
    return 0;
  end if;

  if v_idx > extract(month from p_as_of)::integer then
    if not coalesce(p_unpaid, true) then
      return 0;
    end if;
    v_year := v_year - 1;
  end if;

  v_due := make_date(v_year, v_idx, 1);
  return greatest(0, p_as_of - v_due);
end;
$$;

create or replace function public.compute_billing_status(
  p_tenant_name text,
  p_total_balance numeric,
  p_current_rent numeric,
  p_days_past_due integer,
  p_target_month text,
  p_current_month text default public.current_billing_month()
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

  if p_total_balance > 0 and p_days_past_due > 5 then
    return 'OVERDUE / UNPAID';
  end if;

  if p_total_balance > 0 and p_days_past_due >= 1 and p_days_past_due <= 5 then
    return 'Grace Period';
  end if;

  if p_total_balance = p_current_rent and p_target_month = p_current_month then
    return 'Open Window';
  end if;

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
declare
  v_month text := public.current_billing_month();
begin
  new.billing_status := public.compute_billing_status(
    new.tenant_name,
    new.total_balance,
    new.current_rent,
    new.days_past_due,
    new.target_month,
    v_month
  );
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.roll_billing_cycle(
  p_as_of date default (timezone('Africa/Lusaka', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_month text := public.current_billing_month(p_as_of);
  v_count integer := 0;
  r public.billing_records%rowtype;
  v_target text;
  v_last text;
  v_charge integer;
  v_extra numeric;
  v_balance numeric;
  v_accum numeric;
  v_next text;
  v_days integer;
begin
  for r in
    select * from public.billing_records
    for update
  loop
    if r.tenant_name is null or lower(btrim(r.tenant_name)) = 'vacant' then
      update public.billing_records
      set
        target_month = '-',
        accumulated_total = 0,
        total_balance = 0,
        days_past_due = 0
      where billing_id = r.billing_id
        and (
          target_month is distinct from '-'
          or accumulated_total is distinct from 0
          or total_balance is distinct from 0
          or days_past_due is distinct from 0
        );
      continue;
    end if;

    v_target := case
      when r.target_month is null or btrim(r.target_month) in ('', '-') then v_month
      else r.target_month
    end;
    v_last := public.last_charged_month(v_target, r.total_balance, r.current_rent);
    v_charge := least(24, public.months_to_charge(v_target, v_month, r.total_balance, r.current_rent));
    v_extra := v_charge * r.current_rent;
    v_balance := round((r.total_balance + v_extra) * 100) / 100;
    v_accum := round((r.accumulated_total + v_extra) * 100) / 100;
    v_next := case
      when v_charge > 0 and r.total_balance <= 0 and v_last is not null
        then public.add_billing_months(v_last, 1)
      else v_target
    end;
    v_days := public.days_past_due_for_month(v_next, p_as_of, v_balance > 0);

    update public.billing_records
    set
      target_month = v_next,
      accumulated_total = v_accum,
      total_balance = v_balance,
      days_past_due = v_days
    where billing_id = r.billing_id
      and (
        target_month is distinct from v_next
        or accumulated_total is distinct from v_accum
        or total_balance is distinct from v_balance
        or days_past_due is distinct from v_days
      );

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.roll_billing_cycle(date) from anon;
grant execute on function public.roll_billing_cycle(date) to authenticated;

create or replace function public.apply_verified_payment()
returns trigger
language plpgsql
as $$
declare
  v_row public.billing_records%rowtype;
  v_ledger record;
  v_days integer;
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    select * into v_row
    from public.billing_records
    where billing_id = new.bed_space_id
    for update;

    if found then
      select * into v_ledger
      from public.apply_payment_to_ledger(
        v_row.total_balance,
        v_row.current_rent,
        v_row.target_month,
        new.amount,
        public.current_billing_month()
      );
      v_days := public.days_past_due_for_month(v_ledger.target_month, (timezone('Africa/Lusaka', now()))::date, v_ledger.total_balance > 0);
      update public.billing_records
      set
        total_balance = v_ledger.total_balance,
        target_month = v_ledger.target_month,
        days_past_due = v_days
      where billing_id = v_row.billing_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_billing_due_dates()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  update public.billing_records
  set days_past_due = public.days_past_due_for_month(target_month, (timezone('Africa/Lusaka', now()))::date, total_balance > 0)
  where tenant_name is distinct from 'Vacant'
    and lower(trim(tenant_name)) is distinct from 'vacant';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select public.roll_billing_cycle();
select public.sync_billing_due_dates();
