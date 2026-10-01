-- Occupancy / student-account saves can set unpaid target_month to a month
-- that is still in the future (the Target Month dropdown has no year).
-- months_to_charge used circular month distance, so "Oct" unpaid in September
-- looked 11 months behind and roll_billing_cycle added 11 months of rent.
--
-- Last-charged months closer forward than backward are the next cycle, not
-- last year's arrears. Genuine overdue still accumulates one month per roll.

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
  v_ahead := public.months_from_to(p_current_month, v_last);
  if v_ahead > 0 and v_ahead <= v_behind then
    return 0;
  end if;
  return v_behind;
end;
$$;

comment on function public.months_to_charge(text, text, numeric, numeric) is
  'Months of rent to add for a live roll. Future month names do not wrap into 11 months of arrears.';
