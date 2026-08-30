-- Student inbox: persist landlord / billing / maintenance updates for the portal.

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  landlord_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'welcome',
    'payment_approved',
    'payment_rejected',
    'rent_due',
    'maintenance_update',
    'rent_increase',
    'house'
  )),
  title text not null,
  preview text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists student_notifications_dedupe_idx
  on public.student_notifications (tenant_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists student_notifications_tenant_created_idx
  on public.student_notifications (tenant_id, created_at desc);

create index if not exists student_notifications_landlord_idx
  on public.student_notifications (landlord_id);

alter table public.student_notifications enable row level security;

create or replace function public.tenant_landlord_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.landlord_id
  from public.tenants t
  join public.bed_spaces bs on bs.id = t.bed_space_id
  join public.blocks b on b.code = bs.block_code
  where t.id = p_tenant_id
  limit 1;
$$;

create or replace function public.active_tenant_on_bed(p_bed_id text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id
  from public.tenants t
  where t.bed_space_id = p_bed_id
    and t.status = 'active'
  limit 1;
$$;

create or replace function public.fmt_kwacha(p_amount numeric)
returns text
language sql
immutable
as $$
  select 'K' || trim(to_char(coalesce(p_amount, 0), 'FM999,999,999,990'));
$$;

create or replace function public.notify_tenant(
  p_tenant_id uuid,
  p_kind text,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_title text;
  v_preview text;
  v_body text;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_bed text := coalesce(v_meta ->> 'bedSpace', '');
  v_status text := coalesce(v_meta ->> 'status', '');
  v_days integer := coalesce(nullif(v_meta ->> 'daysPastDue', '')::integer, 0);
  v_old numeric := coalesce(nullif(v_meta ->> 'oldAmount', '')::numeric, 0);
  v_new numeric := coalesce(nullif(v_meta ->> 'newAmount', '')::numeric, 0);
  v_amount numeric := coalesce(
    nullif(v_meta ->> 'balance', '')::numeric,
    nullif(v_meta ->> 'amount', '')::numeric,
    0
  );
  v_overdue boolean;
begin
  if p_tenant_id is null then
    return null;
  end if;

  if p_dedupe_key is not null then
    select id into v_id
    from public.student_notifications
    where tenant_id = p_tenant_id and dedupe_key = p_dedupe_key
    limit 1;
    if found then
      return v_id;
    end if;
  end if;

  if p_kind = 'welcome' then
    v_title := 'Welcome to your student portal';
    v_preview := case when v_bed <> '' then 'Your bed space ' || v_bed || ' is ready.' else 'Your landlord has assigned your room.' end;
    v_body := 'Your landlord has assigned you a bed space'
      || case when v_bed <> '' then ': ' || v_bed else '' end
      || E'.\n\nUse this portal to check rent, submit payment proof, and report maintenance issues.\n\nOpen Home any time you need your current balance or to send a receipt.';

  elsif p_kind = 'payment_approved' then
    v_title := 'Payment approved';
    v_preview := 'Your payment of ' || public.fmt_kwacha(v_amount) || ' has been verified.';
    v_body := 'Great news — your payment of ' || public.fmt_kwacha(v_amount)
      || E' has been approved by your landlord.\n\nYour account has been updated. Thank you for paying on time.';

  elsif p_kind = 'payment_rejected' then
    v_title := 'Payment needs attention';
    v_preview := coalesce(nullif(v_meta ->> 'reason', ''), 'Your payment proof was rejected. Please resubmit.');
    v_body := E'Your landlord could not verify the payment you submitted.\n\nReason: '
      || coalesce(nullif(v_meta ->> 'reason', ''), 'Please contact your landlord for more details.')
      || E'\n\nPlease submit a new receipt from Home with the correct reference.';

  elsif p_kind = 'rent_due' then
    v_overdue := v_days > 5 or v_status = 'OVERDUE / UNPAID';
    if v_overdue then
      v_title := 'Rent is overdue';
      v_preview := public.fmt_kwacha(v_amount) || ' is still outstanding for '
        || coalesce(nullif(v_meta ->> 'targetMonth', ''), 'this billing cycle') || '.';
      v_body := E'This is a personal reminder that your rent is overdue.\n\nOutstanding balance: '
        || public.fmt_kwacha(v_amount)
        || E'.\n\nBilling period: ' || coalesce(nullif(v_meta ->> 'targetMonth', ''), 'this billing cycle') || '.'
        || case when v_days > 0 then E'\n\nIt has been ' || v_days || ' day' || case when v_days = 1 then '' else 's' end || ' past the due date.' else '' end
        || E'\n\nSubmit payment proof from Home once you have transferred the rent.';
    else
      v_title := 'Rent payment reminder';
      v_preview := public.fmt_kwacha(v_amount) || ' is due for '
        || coalesce(nullif(v_meta ->> 'targetMonth', ''), 'this billing cycle') || '.';
      v_body := 'This is a friendly reminder that your rent payment is due'
        || case when coalesce(v_meta ->> 'dueDate', '') <> '' then ' on ' || (v_meta ->> 'dueDate') else '' end
        || E'.\n\nAmount due: ' || public.fmt_kwacha(v_amount)
        || E'.\n\nBilling period: ' || coalesce(nullif(v_meta ->> 'targetMonth', ''), 'this billing cycle')
        || E'.\n\nPlease submit your payment before the due date so your account stays in good standing.';
    end if;

  elsif p_kind = 'maintenance_update' then
    v_title := 'Maintenance update';
    v_preview := case
      when coalesce(v_meta ->> 'category', '') <> '' then
        'Your ' || lower(v_meta ->> 'category') || ' request is now '
        || replace(coalesce(nullif(v_status, ''), 'updated'), '_', ' ') || '.'
      else 'There is an update on your maintenance request.'
    end;
    v_body := 'There is an update on your maintenance request'
      || case when v_bed <> '' then ' for ' || v_bed else '' end || '.'
      || case when coalesce(v_meta ->> 'category', '') <> '' then E'\n\nCategory: ' || (v_meta ->> 'category') || '.' else '' end
      || E'\n\nStatus: ' || replace(coalesce(nullif(v_status, ''), 'updated'), '_', ' ') || '.'
      || case when coalesce(v_meta ->> 'description', '') <> '' then E'\n\nYour report: ' || (v_meta ->> 'description') else '' end
      || case
        when coalesce(v_meta ->> 'resolutionNote', '') <> '' then E'\n\nLandlord note: ' || (v_meta ->> 'resolutionNote')
        else E'\n\nOpen Home if you need to add more detail.'
      end;

  elsif p_kind = 'rent_increase' then
    v_title := 'Notice of rent adjustment';
    v_preview := 'Monthly rent changes from ' || public.fmt_kwacha(v_old) || ' to ' || public.fmt_kwacha(v_new) || '.';
    v_body := 'The monthly rent for your bed space'
      || case when v_bed <> '' then ' ' || v_bed else '' end
      || E' is changing.\n\nCurrent rent: ' || public.fmt_kwacha(v_old)
      || E'\n\nNew rent: ' || public.fmt_kwacha(v_new)
      || E'\n\nIncrease: ' || public.fmt_kwacha(v_new - v_old)
      || E'\n\nEffective from: ' || coalesce(nullif(v_meta ->> 'effectiveDate', ''), 'the next billing cycle')
      || E'\n\nYour current billing cycle is not affected — the new amount applies from the effective date onwards.';

  elsif p_kind = 'house' then
    v_title := case when coalesce(v_meta ->> 'month', '') <> '' then 'House update · ' || (v_meta ->> 'month') else 'Boarding house update' end;
    v_preview := case
      when coalesce(v_meta ->> 'month', '') <> '' then
        'Utility charges were posted for ' || coalesce(nullif(v_meta ->> 'blockCode', ''), 'your block') || ' (' || (v_meta ->> 'month') || ').'
      else 'Your landlord posted an update for your boarding house.'
    end;
    v_body := 'Your landlord posted an update for ' || coalesce(nullif(v_meta ->> 'blockCode', ''), 'your') || E' block.'
      || case when coalesce(v_meta ->> 'month', '') <> '' then E'\n\nUtility charges for ' || (v_meta ->> 'month') || ' are now on record.' else '' end
      || case when v_amount > 0 then E'\n\nTotal house utility cost: ' || public.fmt_kwacha(v_amount) || '.' else '' end
      || E'\n\nThis applies to every active student in that boarding house. Check Home if you have questions about your share.';
  else
    raise exception 'Unknown notification kind %', p_kind;
  end if;

  insert into public.student_notifications (
    tenant_id, landlord_id, kind, title, preview, body, metadata, dedupe_key
  )
  values (
    p_tenant_id,
    public.tenant_landlord_id(p_tenant_id),
    p_kind,
    v_title,
    v_preview,
    v_body,
    v_meta,
    p_dedupe_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop policy if exists "student_read_own_notifications" on public.student_notifications;
create policy "student_read_own_notifications" on public.student_notifications
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "landlord_read_own_notifications" on public.student_notifications;
create policy "landlord_read_own_notifications" on public.student_notifications
  for select to authenticated
  using (landlord_id = public.current_landlord_id());

create or replace function public.mark_student_notification_read(p_id uuid)
returns public.student_notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_notifications%rowtype;
begin
  update public.student_notifications
  set read_at = coalesce(read_at, now())
  where id = p_id
    and tenant_id = public.current_tenant_id()
  returning * into v_row;

  if not found then
    raise exception 'Notification not found' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

create or replace function public.ensure_my_rent_due_notification()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_billing public.billing_records%rowtype;
  v_meta jsonb;
begin
  if v_tenant_id is null then
    return false;
  end if;

  select br.*
  into v_billing
  from public.tenants t
  join public.billing_records br on br.billing_id = t.bed_space_id
  where t.id = v_tenant_id;

  if not found then
    return false;
  end if;

  if v_billing.total_balance <= 0 or v_billing.billing_status in ('Vacant', 'Paid / Secured') then
    return false;
  end if;

  v_meta := jsonb_build_object(
    'bedSpace', v_billing.billing_id,
    'balance', v_billing.total_balance,
    'amount', v_billing.total_balance,
    'targetMonth', v_billing.target_month,
    'dueDate', v_billing.target_month,
    'daysPastDue', v_billing.days_past_due,
    'status', v_billing.billing_status::text
  );

  perform public.notify_tenant(
    v_tenant_id,
    'rent_due',
    v_meta,
    'rent_due:' || coalesce(v_billing.target_month, 'current') || ':' || v_billing.billing_status::text
  );
  return true;
end;
$$;

-- ─── Event hooks ─────────────────────────────────────────────────────────────

create or replace function public.tg_notify_welcome()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.status = 'active' then
    perform public.notify_tenant(
      NEW.id,
      'welcome',
      jsonb_build_object('bedSpace', NEW.bed_space_id),
      'welcome:' || NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_welcome on public.tenants;
create trigger trg_notify_welcome
  after insert on public.tenants
  for each row
  execute function public.tg_notify_welcome();

create or replace function public.tg_notify_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
begin
  if NEW.status is not distinct from OLD.status
     and NEW.resolution_note is not distinct from OLD.resolution_note then
    return NEW;
  end if;

  v_tenant := public.active_tenant_on_bed(NEW.bed_space_id);
  if v_tenant is null then
    return NEW;
  end if;

  perform public.notify_tenant(
    v_tenant,
    'maintenance_update',
    jsonb_build_object(
      'bedSpace', NEW.bed_space_id,
      'category', NEW.category::text,
      'status', NEW.status::text,
      'description', NEW.description,
      'resolutionNote', NEW.resolution_note,
      'dueDate', NEW.reported_date::text
    ),
    'maintenance:' || NEW.id || ':' || NEW.status::text
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_maintenance on public.maintenance_issues;
create trigger trg_notify_maintenance
  after update of status, resolution_note on public.maintenance_issues
  for each row
  execute function public.tg_notify_maintenance();

create or replace function public.tg_notify_house_utility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant record;
begin
  for v_tenant in
    select t.id
    from public.tenants t
    join public.bed_spaces bs on bs.id = t.bed_space_id
    where t.status = 'active'
      and bs.block_code = NEW.block_code
  loop
    perform public.notify_tenant(
      v_tenant.id,
      'house',
      jsonb_build_object(
        'blockCode', NEW.block_code::text,
        'month', NEW.month,
        'amount', NEW.total_cost
      ),
      'house:' || NEW.block_code::text || ':' || NEW.month
    );
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_house_utility on public.utility_entries;
create trigger trg_notify_house_utility
  after insert or update of total_cost, month on public.utility_entries
  for each row
  execute function public.tg_notify_house_utility();

create or replace function public.verify_payment(p_payment_id text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.payments%rowtype;
  v_after public.payments%rowtype;
  v_tenant uuid;
begin
  perform public.assert_landlord('verify a payment');

  select * into v_before from public.payments where id = p_payment_id;
  if not found or not public.landlord_owns_bed(v_before.bed_space_id) then
    raise exception 'Payment % not found', p_payment_id;
  end if;
  if v_before.status = 'verified' then
    return v_before;
  end if;

  update public.payments
  set status = 'verified', rejection_reason = null
  where id = p_payment_id
  returning * into v_after;

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    public.current_landlord_email(),
    'payment_verified',
    'payment',
    p_payment_id,
    jsonb_build_object('status', v_before.status, 'amount', v_before.amount, 'bed_space_id', v_before.bed_space_id),
    jsonb_build_object('status', v_after.status, 'amount', v_after.amount),
    null
  );

  v_tenant := public.active_tenant_on_bed(v_after.bed_space_id);
  perform public.notify_tenant(
    v_tenant,
    'payment_approved',
    jsonb_build_object('amount', v_after.amount, 'bedSpace', v_after.bed_space_id, 'dueDate', v_after.submitted_at::text),
    'payment_approved:' || v_after.id
  );

  return v_after;
end;
$$;

create or replace function public.reject_payment(p_payment_id text, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.payments%rowtype;
  v_after public.payments%rowtype;
  v_tenant uuid;
begin
  perform public.assert_landlord('reject a payment');

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A rejection reason is required';
  end if;

  select * into v_before from public.payments where id = p_payment_id;
  if not found or not public.landlord_owns_bed(v_before.bed_space_id) then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  update public.payments
  set status = 'rejected', rejection_reason = btrim(p_reason)
  where id = p_payment_id
  returning * into v_after;

  insert into public.audit_log (actor_email, action, entity_type, entity_id, before, after, note)
  values (
    public.current_landlord_email(),
    'payment_rejected',
    'payment',
    p_payment_id,
    jsonb_build_object('status', v_before.status, 'amount', v_before.amount),
    jsonb_build_object('status', v_after.status, 'reason', p_reason),
    p_reason
  );

  v_tenant := public.active_tenant_on_bed(v_after.bed_space_id);
  perform public.notify_tenant(
    v_tenant,
    'payment_rejected',
    jsonb_build_object(
      'amount', v_after.amount,
      'bedSpace', v_after.bed_space_id,
      'dueDate', v_after.submitted_at::text,
      'reason', v_after.rejection_reason
    ),
    'payment_rejected:' || v_after.id
  );

  return v_after;
end;
$$;

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

revoke all on function public.notify_tenant(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.tenant_landlord_id(uuid) from public, anon, authenticated;
revoke all on function public.active_tenant_on_bed(text) from public, anon, authenticated;
revoke all on function public.fmt_kwacha(numeric) from public, anon, authenticated;

grant select on public.student_notifications to authenticated;
grant execute on function public.mark_student_notification_read(uuid) to authenticated;
grant execute on function public.ensure_my_rent_due_notification() to authenticated;
