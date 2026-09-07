-- Live monthly billing: charge the new month unless the student prepaid.

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
  v_behind integer;
  v_ahead integer;
begin
  if v_last is null then
    return 0;
  end if;
  v_behind := public.months_from_to(v_last, p_current_month);
  if v_behind = 0 then
    return 0;
  end if;
  if p_total_balance <= 0 then
    v_ahead := public.months_from_to(p_current_month, v_last);
    if v_ahead <= v_behind then
      return 0;
    end if;
  end if;
  return v_behind;
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
  v_amount numeric := greatest(0, coalesce(p_amount, 0));
  v_new numeric := greatest(0, round((v_old - v_amount) * 100) / 100);
  v_start text := case
    when public.billing_month_index(p_target_month) is null then p_current_month
    else initcap(btrim(p_target_month))
  end;
  v_base text := p_current_month;
  v_ahead integer;
  v_behind integer;
  v_extra integer := 0;
  v_cleared integer;
begin
  if v_new = 0 then
    if v_old = 0 and public.billing_month_index(v_start) is not null then
      v_ahead := public.months_from_to(p_current_month, v_start);
      v_behind := public.months_from_to(v_start, p_current_month);
      if v_ahead = 0 or v_ahead <= v_behind then
        v_base := v_start;
      end if;
    end if;
    if p_current_rent > 0 then
      v_extra := floor(greatest(0, v_amount - v_old) / p_current_rent)::integer;
    end if;
    total_balance := 0;
    target_month := public.add_billing_months(v_base, v_extra);
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
