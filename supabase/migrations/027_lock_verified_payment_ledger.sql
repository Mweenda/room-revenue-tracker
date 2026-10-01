-- Payment Queue edits of verified receipts only updated the payments row.
-- apply_verified_payment runs on status→verified, not on amount/bed changes, so
-- a typo fix (K900 → K500) or a bed reassignment left billing_records credited
-- for the old values. Occupancy billing remains the path that writes both.

create or replace function public.update_payment(
  p_payment_id text,
  p_student_name text,
  p_bed_space_id text,
  p_amount numeric,
  p_method public.payment_method,
  p_transaction_ref text,
  p_submitted_at date
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payments%rowtype;
  v_row public.payments%rowtype;
begin
  perform public.assert_landlord('edit a payment');

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_transaction_ref is null or btrim(p_transaction_ref) = '' then
    raise exception 'A transaction reference is required';
  end if;
  if p_student_name is null or btrim(p_student_name) = '' then
    raise exception 'A student name is required';
  end if;
  if not public.landlord_owns_bed(p_bed_space_id) then
    raise exception 'Bed space % not found', p_bed_space_id;
  end if;

  select * into v_existing
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  if v_existing.status = 'verified'
     and (
       v_existing.bed_space_id is distinct from p_bed_space_id
       or v_existing.amount is distinct from round(p_amount, 2)
     ) then
    raise exception 'Changing the amount or bed on a verified receipt would leave the rent ledger wrong. Edit occupancy billing instead.';
  end if;

  update public.payments
  set
    student_name = btrim(p_student_name),
    bed_space_id = p_bed_space_id,
    amount = round(p_amount, 2),
    method = p_method,
    transaction_ref = btrim(p_transaction_ref),
    submitted_at = coalesce(p_submitted_at, submitted_at)
  where id = p_payment_id
  returning * into v_row;

  if not found then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.update_payment(text, text, text, numeric, public.payment_method, text, date) from anon;
grant execute on function public.update_payment(text, text, text, numeric, public.payment_method, text, date) to authenticated;
