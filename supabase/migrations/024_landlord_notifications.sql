-- Landlord inbox: persist overdue rent, payment activity, and maintenance
-- complaints against the live occupancy / billing / payment / issue rows.
-- Spreadsheet import receipts (xlsx-%) are not backfilled as "just paid".

create table if not exists public.landlord_notifications (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  bed_space_id text references public.bed_spaces (id) on delete set null,
  payment_id text references public.payments (id) on delete set null,
  issue_id text references public.maintenance_issues (id) on delete set null,
  kind text not null check (kind in (
    'rent_overdue',
    'payment_submitted',
    'payment_verified',
    'maintenance_submitted'
  )),
  title text not null,
  preview text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists landlord_notifications_dedupe_idx
  on public.landlord_notifications (landlord_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists landlord_notifications_landlord_created_idx
  on public.landlord_notifications (landlord_id, created_at desc);

create index if not exists landlord_notifications_unread_idx
  on public.landlord_notifications (landlord_id, created_at desc)
  where read_at is null;

create index if not exists landlord_notifications_tenant_idx
  on public.landlord_notifications (tenant_id)
  where tenant_id is not null;

create index if not exists landlord_notifications_bed_idx
  on public.landlord_notifications (bed_space_id)
  where bed_space_id is not null;

alter table public.landlord_notifications enable row level security;

create or replace function public.bed_landlord_id(p_bed_id text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.landlord_id
  from public.bed_spaces bs
  join public.blocks b on b.code = bs.block_code
  where bs.id = p_bed_id
  limit 1;
$$;

create or replace function public.notify_landlord(
  p_landlord_id uuid,
  p_kind text,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_tenant_id uuid default null,
  p_bed_space_id text default null,
  p_payment_id text default null,
  p_issue_id text default null,
  p_created_at timestamptz default now()
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
  v_name text := coalesce(nullif(btrim(v_meta ->> 'studentName'), ''), 'A student');
  v_bed text := coalesce(nullif(btrim(v_meta ->> 'bedSpace'), ''), '');
  v_at_bed text := case when v_bed <> '' then ' at ' || v_bed else '' end;
  v_for_bed text := case when v_bed <> '' then ' for ' || v_bed else '' end;
  v_amount numeric := coalesce(
    nullif(v_meta ->> 'amount', '')::numeric,
    nullif(v_meta ->> 'balance', '')::numeric,
    0
  );
  v_days integer := coalesce(nullif(v_meta ->> 'daysPastDue', '')::integer, 0);
  v_month text := coalesce(nullif(btrim(v_meta ->> 'targetMonth'), ''), 'this billing cycle');
  v_method text := coalesce(nullif(btrim(v_meta ->> 'paymentMethod'), ''), '');
  v_category text := coalesce(nullif(btrim(v_meta ->> 'category'), ''), 'maintenance');
  v_href text;
begin
  if p_landlord_id is null then
    return null;
  end if;

  if p_kind not in (
    'rent_overdue',
    'payment_submitted',
    'payment_verified',
    'maintenance_submitted'
  ) then
    raise exception 'Unknown landlord notification kind %', p_kind;
  end if;

  v_href := case p_kind
    when 'rent_overdue' then 'revenue'
    when 'payment_submitted' then 'pay'
    when 'payment_verified' then 'pay'
    else 'reports'
  end;
  v_meta := v_meta || jsonb_build_object('hrefView', coalesce(nullif(v_meta ->> 'hrefView', ''), v_href));

  if p_dedupe_key is not null then
    select id into v_id
    from public.landlord_notifications
    where landlord_id = p_landlord_id and dedupe_key = p_dedupe_key
    limit 1;
    if found then
      return v_id;
    end if;
  end if;

  if p_kind = 'rent_overdue' then
    v_title := 'Rent overdue · ' || v_name;
    v_preview := v_name || v_at_bed || ' owes ' || public.fmt_kwacha(v_amount) || ' for ' || v_month || '.';
    v_body := v_name || v_at_bed || ' has an overdue rent balance of '
      || public.fmt_kwacha(v_amount)
      || E'.\n\nBilling period: ' || v_month || '.'
      || case when v_days > 0 then E'\n\nIt has been ' || v_days || ' day' || case when v_days = 1 then '' else 's' end || ' past the due date.' else '' end
      || E'\n\nOpen Revenue to review this account.';

  elsif p_kind = 'payment_submitted' then
    v_title := 'Payment submitted · ' || v_name;
    v_preview := v_name || ' submitted ' || public.fmt_kwacha(v_amount) || v_for_bed || '.';
    v_body := v_name || ' submitted a payment of ' || public.fmt_kwacha(v_amount)
      || v_for_bed
      || case when v_method <> '' then ' via ' || v_method else '' end
      || E'.\n\nStatus: awaiting verification.\n\nOpen Pay to review the receipt.';

  elsif p_kind = 'payment_verified' then
    v_title := 'Payment received · ' || v_name;
    v_preview := v_name || ' paid ' || public.fmt_kwacha(v_amount)
      || case when v_method <> '' then ' (' || v_method || ')' else '' end
      || v_for_bed || '.';
    v_body := v_name || ' paid ' || public.fmt_kwacha(v_amount)
      || v_for_bed
      || case when v_method <> '' then ' via ' || v_method else '' end
      || E'.\n\nThe payment is verified and the ledger has been updated.\n\nOpen Pay to see the receipt.';

  else
    v_title := 'Maintenance complaint · ' || v_name;
    v_preview := v_name || ' reported ' || lower(v_category) || v_at_bed || '.';
    v_body := v_name || ' submitted a ' || lower(v_category) || ' complaint'
      || v_at_bed || '.'
      || case when coalesce(nullif(v_meta ->> 'description', ''), '') <> ''
        then E'\n\n' || (v_meta ->> 'description')
        else ''
      end
      || E'\n\nOpen Reports to update the request.';
  end if;

  insert into public.landlord_notifications (
    landlord_id, tenant_id, bed_space_id, payment_id, issue_id,
    kind, title, preview, body, metadata, dedupe_key, created_at
  )
  values (
    p_landlord_id,
    p_tenant_id,
    p_bed_space_id,
    p_payment_id,
    p_issue_id,
    p_kind,
    v_title,
    v_preview,
    v_body,
    v_meta,
    p_dedupe_key,
    coalesce(p_created_at, now())
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    select id into v_id
    from public.landlord_notifications
    where landlord_id = p_landlord_id and dedupe_key = p_dedupe_key
    limit 1;
    return v_id;
end;
$$;

create or replace function public.notify_landlord_for_bed(
  p_bed_id text,
  p_kind text,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_payment_id text default null,
  p_issue_id text default null,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_landlord uuid;
  v_tenant uuid;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  v_landlord := public.bed_landlord_id(p_bed_id);
  if v_landlord is null then
    return null;
  end if;

  v_tenant := public.active_tenant_on_bed(p_bed_id);
  if coalesce(v_meta ->> 'bedSpace', '') = '' then
    v_meta := v_meta || jsonb_build_object('bedSpace', p_bed_id);
  end if;

  return public.notify_landlord(
    v_landlord,
    p_kind,
    v_meta,
    p_dedupe_key,
    v_tenant,
    p_bed_id,
    p_payment_id,
    p_issue_id,
    p_created_at
  );
end;
$$;

drop policy if exists "landlord_read_own_inbox" on public.landlord_notifications;
create policy "landlord_read_own_inbox" on public.landlord_notifications
  for select to authenticated
  using (landlord_id = public.current_landlord_id());

create or replace function public.mark_landlord_notification_read(p_id uuid)
returns public.landlord_notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.landlord_notifications%rowtype;
begin
  update public.landlord_notifications
  set read_at = coalesce(read_at, now())
  where id = p_id
    and landlord_id = public.current_landlord_id()
  returning * into v_row;

  if not found then
    raise exception 'Notification not found' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

create or replace function public.mark_all_landlord_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if public.current_landlord_id() is null then
    raise exception 'Notification not found' using errcode = '42501';
  end if;

  update public.landlord_notifications
  set read_at = coalesce(read_at, now())
  where landlord_id = public.current_landlord_id()
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.sync_landlord_inbox(p_landlord_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_id uuid;
  r record;
begin
  if p_landlord_id is null then
    return 0;
  end if;

  for r in
    select
      br.billing_id,
      br.tenant_name,
      br.total_balance,
      br.target_month,
      br.days_past_due,
      br.billing_status,
      br.updated_at
    from public.billing_records br
    join public.bed_spaces bs on bs.id = br.billing_id
    join public.blocks b on b.code = bs.block_code
    where b.landlord_id = p_landlord_id
      and br.billing_status = 'OVERDUE / UNPAID'
      and not public.is_vacant_tenant_name(br.tenant_name)
  loop
    v_id := public.notify_landlord_for_bed(
      r.billing_id,
      'rent_overdue',
      jsonb_build_object(
        'studentName', r.tenant_name,
        'bedSpace', r.billing_id,
        'balance', r.total_balance,
        'amount', r.total_balance,
        'targetMonth', r.target_month,
        'daysPastDue', r.days_past_due,
        'status', r.billing_status::text,
        'hrefView', 'revenue'
      ),
      'rent_overdue:' || r.billing_id || ':' || coalesce(nullif(btrim(r.target_month), ''), 'current'),
      null,
      null,
      r.updated_at
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  for r in
    select p.id, p.student_name, p.bed_space_id, p.amount, p.method, p.created_at
    from public.payments p
    join public.bed_spaces bs on bs.id = p.bed_space_id
    join public.blocks b on b.code = bs.block_code
    where b.landlord_id = p_landlord_id
      and p.status = 'pending'
      and p.id not like 'xlsx-%'
  loop
    v_id := public.notify_landlord_for_bed(
      r.bed_space_id,
      'payment_submitted',
      jsonb_build_object(
        'studentName', r.student_name,
        'bedSpace', r.bed_space_id,
        'amount', r.amount,
        'paymentMethod', r.method::text,
        'status', 'pending',
        'hrefView', 'pay'
      ),
      'payment_submitted:' || r.id,
      r.id,
      null,
      r.created_at
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  for r in
    select i.id, i.student_name, i.bed_space_id, i.category, i.description, i.status, i.created_at
    from public.maintenance_issues i
    join public.bed_spaces bs on bs.id = i.bed_space_id
    join public.blocks b on b.code = bs.block_code
    where b.landlord_id = p_landlord_id
      and i.status = 'open'
  loop
    v_id := public.notify_landlord_for_bed(
      r.bed_space_id,
      'maintenance_submitted',
      jsonb_build_object(
        'studentName', r.student_name,
        'bedSpace', r.bed_space_id,
        'category', r.category::text,
        'description', r.description,
        'status', r.status::text,
        'hrefView', 'reports'
      ),
      'maintenance_submitted:' || r.id,
      null,
      r.id,
      r.created_at
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.ensure_landlord_inbox()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_landlord uuid := public.current_landlord_id();
begin
  if v_landlord is null then
    return false;
  end if;

  begin
    perform public.roll_billing_cycle();
  exception when others then
    null;
  end;

  begin
    perform public.sync_billing_due_dates();
  exception when others then
    null;
  end;

  perform public.sync_landlord_inbox(v_landlord);
  return true;
end;
$$;

-- ─── Event hooks ─────────────────────────────────────────────────────────────

create or replace function public.tg_landlord_notify_billing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_vacant_tenant_name(NEW.tenant_name) then
    return NEW;
  end if;

  if NEW.billing_status is distinct from 'OVERDUE / UNPAID'::public.billing_status then
    return NEW;
  end if;

  if TG_OP = 'UPDATE'
     and OLD.billing_status is not distinct from NEW.billing_status
     and OLD.target_month is not distinct from NEW.target_month
     and OLD.total_balance is not distinct from NEW.total_balance then
    return NEW;
  end if;

  perform public.notify_landlord_for_bed(
    NEW.billing_id,
    'rent_overdue',
    jsonb_build_object(
      'studentName', NEW.tenant_name,
      'bedSpace', NEW.billing_id,
      'balance', NEW.total_balance,
      'amount', NEW.total_balance,
      'targetMonth', NEW.target_month,
      'daysPastDue', NEW.days_past_due,
      'status', NEW.billing_status::text,
      'hrefView', 'revenue'
    ),
    'rent_overdue:' || NEW.billing_id || ':' || coalesce(nullif(btrim(NEW.target_month), ''), 'current')
  );

  return NEW;
end;
$$;

drop trigger if exists trg_landlord_notify_billing on public.billing_records;
create trigger trg_landlord_notify_billing
  after insert or update of billing_status, total_balance, target_month, days_past_due, tenant_name
  on public.billing_records
  for each row
  execute function public.tg_landlord_notify_billing();

create or replace function public.tg_landlord_notify_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.id like 'xlsx-%' then
    return NEW;
  end if;

  if TG_OP = 'INSERT' and NEW.status = 'pending' then
    -- Landlord-recorded cash goes pending then verified in one RPC; skip the
    -- submitted ping so the owner is not notified of their own receipt.
    if public.current_landlord_id() is not null then
      return NEW;
    end if;

    perform public.notify_landlord_for_bed(
      NEW.bed_space_id,
      'payment_submitted',
      jsonb_build_object(
        'studentName', NEW.student_name,
        'bedSpace', NEW.bed_space_id,
        'amount', NEW.amount,
        'paymentMethod', NEW.method::text,
        'status', NEW.status::text,
        'hrefView', 'pay'
      ),
      'payment_submitted:' || NEW.id,
      NEW.id
    );
    return NEW;
  end if;

  if NEW.status = 'verified' and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status) then
    perform public.notify_landlord_for_bed(
      NEW.bed_space_id,
      'payment_verified',
      jsonb_build_object(
        'studentName', NEW.student_name,
        'bedSpace', NEW.bed_space_id,
        'amount', NEW.amount,
        'paymentMethod', NEW.method::text,
        'status', NEW.status::text,
        'hrefView', 'pay'
      ),
      'payment_verified:' || NEW.id,
      NEW.id
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_landlord_notify_payment on public.payments;
create trigger trg_landlord_notify_payment
  after insert or update of status on public.payments
  for each row
  execute function public.tg_landlord_notify_payment();

create or replace function public.tg_landlord_notify_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify_landlord_for_bed(
    NEW.bed_space_id,
    'maintenance_submitted',
    jsonb_build_object(
      'studentName', NEW.student_name,
      'bedSpace', NEW.bed_space_id,
      'category', NEW.category::text,
      'description', NEW.description,
      'status', NEW.status::text,
      'hrefView', 'reports'
    ),
    'maintenance_submitted:' || NEW.id,
    null,
    NEW.id
  );
  return NEW;
end;
$$;

drop trigger if exists trg_landlord_notify_maintenance on public.maintenance_issues;
create trigger trg_landlord_notify_maintenance
  after insert on public.maintenance_issues
  for each row
  execute function public.tg_landlord_notify_maintenance();

revoke all on function public.notify_landlord(uuid, text, jsonb, text, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.notify_landlord_for_bed(text, text, jsonb, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.bed_landlord_id(text) from public, anon, authenticated;
revoke all on function public.sync_landlord_inbox(uuid) from public, anon, authenticated;

grant select on public.landlord_notifications to authenticated;
grant execute on function public.mark_landlord_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_landlord_notifications_read() to authenticated;
grant execute on function public.ensure_landlord_inbox() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.landlord_notifications';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;

-- Seed the current live overdue / pending / open-issue rows. Do not insert the
-- historical spreadsheet cash receipts as payment-received events.
do $$
declare
  v_profile uuid;
begin
  begin
    perform public.roll_billing_cycle();
  exception when others then
    null;
  end;

  begin
    perform public.sync_billing_due_dates();
  exception when others then
    null;
  end;

  for v_profile in
    select id from public.profiles where role = 'landlord'
  loop
    perform public.sync_landlord_inbox(v_profile);
  end loop;
end $$;
