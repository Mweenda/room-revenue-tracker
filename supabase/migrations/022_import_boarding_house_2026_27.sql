-- Import Boarding House 2026/27 workbook into Mr. Mwamba's property.
-- Source: Documents/Sponsored-Projects/Boarding House 2026_27 (1).xlsx
-- Occupancy, rents, balances, and 2026 cash receipts. Does not rotate test logins.

insert into public.blocks (code, name, owner_utility_cap, landlord_id)
select 'UPV', 'UPV Block', 70, p.id
from public.profiles p
where p.role = 'landlord' and lower(p.email) = 'mwamba.property@gmail.com'
on conflict (code) do update
  set landlord_id = coalesce(public.blocks.landlord_id, excluded.landlord_id),
      name = excluded.name;

insert into public.bed_spaces (id, block_code, room_number, bed_letter, room_gender, rent_amount, status) values
  ('BBH-1-A', 'BBH'::public.block_code, 1, 'A', 'Male'::public.room_gender, 950, 'occupied'::public.bed_status),
  ('BBH-2-A', 'BBH'::public.block_code, 2, 'A', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-2-B', 'BBH'::public.block_code, 2, 'B', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-3-A', 'BBH'::public.block_code, 3, 'A', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-3-B', 'BBH'::public.block_code, 3, 'B', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-3-C', 'BBH'::public.block_code, 3, 'C', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-4-A', 'BBH'::public.block_code, 4, 'A', 'Male'::public.room_gender, 950, 'occupied'::public.bed_status),
  ('BBH-5-A', 'BBH'::public.block_code, 5, 'A', 'Female'::public.room_gender, 0, 'occupied'::public.bed_status),
  ('BBH-6-A', 'BBH'::public.block_code, 6, 'A', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-6-B', 'BBH'::public.block_code, 6, 'B', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-6-C', 'BBH'::public.block_code, 6, 'C', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-7-A', 'BBH'::public.block_code, 7, 'A', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-7-B', 'BBH'::public.block_code, 7, 'B', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-7-C', 'BBH'::public.block_code, 7, 'C', 'Female'::public.room_gender, 900, 'vacant'::public.bed_status),
  ('BBH-8-A', 'BBH'::public.block_code, 8, 'A', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-8-B', 'BBH'::public.block_code, 8, 'B', 'Male'::public.room_gender, 900, 'vacant'::public.bed_status),
  ('BBH-9-A', 'BBH'::public.block_code, 9, 'A', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-9-B', 'BBH'::public.block_code, 9, 'B', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('BBH-9-C', 'BBH'::public.block_code, 9, 'C', 'Female'::public.room_gender, 900, 'vacant'::public.bed_status),
  ('UPV-10-A', 'UPV'::public.block_code, 10, 'A', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('UPV-10-B', 'UPV'::public.block_code, 10, 'B', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('UPV-10-C', 'UPV'::public.block_code, 10, 'C', 'Female'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('UPV-10-D', 'UPV'::public.block_code, 10, 'D', 'Female'::public.room_gender, 900, 'vacant'::public.bed_status),
  ('UPV-11-A', 'UPV'::public.block_code, 11, 'A', 'Female'::public.room_gender, 1000, 'occupied'::public.bed_status),
  ('UPV-12-A', 'UPV'::public.block_code, 12, 'A', 'Male'::public.room_gender, 1600, 'occupied'::public.bed_status),
  ('UPV-13-A', 'UPV'::public.block_code, 13, 'A', 'Male'::public.room_gender, 1800, 'occupied'::public.bed_status),
  ('UPV-14-A', 'UPV'::public.block_code, 14, 'A', 'Male'::public.room_gender, 950, 'occupied'::public.bed_status),
  ('UPV-15-A', 'UPV'::public.block_code, 15, 'A', 'Female'::public.room_gender, 1100, 'occupied'::public.bed_status),
  ('CRV-16-A', 'CRV'::public.block_code, 16, 'A', 'Male'::public.room_gender, 1200, 'vacant'::public.bed_status),
  ('CRV-16-B', 'CRV'::public.block_code, 16, 'B', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('CRV-17-A', 'CRV'::public.block_code, 17, 'A', 'Male'::public.room_gender, 900, 'occupied'::public.bed_status),
  ('CRV-18-A', 'CRV'::public.block_code, 18, 'A', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('ANX-19-A', 'ANX'::public.block_code, 19, 'A', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('ANX-19-B', 'ANX'::public.block_code, 19, 'B', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('ANX-19-C', 'ANX'::public.block_code, 19, 'C', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('ANX-19-D', 'ANX'::public.block_code, 19, 'D', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('ANX-20-A', 'ANX'::public.block_code, 20, 'A', 'Male'::public.room_gender, 1400, 'occupied'::public.bed_status),
  ('NWG-21-A', 'NWG'::public.block_code, 21, 'A', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-21-B', 'NWG'::public.block_code, 21, 'B', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-21-C', 'NWG'::public.block_code, 21, 'C', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-21-D', 'NWG'::public.block_code, 21, 'D', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-22-A', 'NWG'::public.block_code, 22, 'A', 'Male'::public.room_gender, 1200, 'vacant'::public.bed_status),
  ('NWG-22-B', 'NWG'::public.block_code, 22, 'B', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-22-C', 'NWG'::public.block_code, 22, 'C', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-22-D', 'NWG'::public.block_code, 22, 'D', 'Male'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-23-A', 'NWG'::public.block_code, 23, 'A', 'Female'::public.room_gender, 1200, 'vacant'::public.bed_status),
  ('NWG-23-B', 'NWG'::public.block_code, 23, 'B', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-23-C', 'NWG'::public.block_code, 23, 'C', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-23-D', 'NWG'::public.block_code, 23, 'D', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-23-E', 'NWG'::public.block_code, 23, 'E', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-24-A', 'NWG'::public.block_code, 24, 'A', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-24-B', 'NWG'::public.block_code, 24, 'B', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-24-C', 'NWG'::public.block_code, 24, 'C', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status),
  ('NWG-24-D', 'NWG'::public.block_code, 24, 'D', 'Female'::public.room_gender, 1200, 'occupied'::public.bed_status)
on conflict (id) do update set
  block_code = excluded.block_code,
  room_number = excluded.room_number,
  bed_letter = excluded.bed_letter,
  room_gender = excluded.room_gender,
  rent_amount = excluded.rent_amount,
  status = excluded.status;

insert into public.billing_records (
  billing_id, house_block, room_number, bed_space, room_gender,
  tenant_name, phone_number, entry_date, current_rent, target_month,
  accumulated_total, total_balance, days_past_due
)
select
  bs.id, bs.block_code, bs.room_number::text, bs.bed_letter, bs.room_gender,
  'Vacant', '-', '-', bs.rent_amount, '-', 0, 0, 0
from public.bed_spaces bs
on conflict (billing_id) do nothing;

-- Free unique active bed/phone/email so the roster can be remapped.
update public.tenants
set status = 'moved_out',
    status_reason = coalesce(nullif(status_reason, ''), 'Replaced by 2026/27 boarding-house workbook'),
    status_changed_at = coalesce(status_changed_at, now())
where status = 'active';

-- Reactivate or insert the workbook occupants. Keep Chanda's portal email and auth user.
do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Adrian mulale'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-1-A',
      full_name = 'Adrian mulale',
      phone = '260977146630',
      email = coalesce(nullif(btrim(v_email), ''), 'adrian.mulale@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-30',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-1-A', 'Adrian mulale', '260977146630',
      'adrian.mulale@boarder.ac.zm', '-', '2026-06-30',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Wisdom Bwani'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-2-A',
      full_name = 'Wisdom Bwani',
      phone = '260776960320',
      email = coalesce(nullif(btrim(v_email), ''), 'wisdom.bwani@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-2-A', 'Wisdom Bwani', '260776960320',
      'wisdom.bwani@boarder.ac.zm', '-', '2026-06-05',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Jackson Mwanza'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-2-B',
      full_name = 'Jackson Mwanza',
      phone = '260976625656',
      email = coalesce(nullif(btrim(v_email), ''), 'jackson.mwanza@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-08',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-2-B', 'Jackson Mwanza', '260976625656',
      'jackson.mwanza@boarder.ac.zm', '-', '2026-06-08',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Prosper Kalayi'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-3-A',
      full_name = 'Prosper Kalayi',
      phone = '260970522913',
      email = coalesce(nullif(btrim(v_email), ''), 'prosper.kalayi@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-13',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-3-A', 'Prosper Kalayi', '260970522913',
      'prosper.kalayi@boarder.ac.zm', '-', '2026-06-13',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Shadrach Munganini'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-3-B',
      full_name = 'Shadrach Munganini',
      phone = '260979567550',
      email = coalesce(nullif(btrim(v_email), ''), 'shadrach.munganini@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-07-25',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-3-B', 'Shadrach Munganini', '260979567550',
      'shadrach.munganini@boarder.ac.zm', '-', '2026-07-25',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Collins Mubanga'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-3-C',
      full_name = 'Collins Mubanga',
      phone = '260777237029',
      email = coalesce(nullif(btrim(v_email), ''), 'collins.mubanga@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-03',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-3-C', 'Collins Mubanga', '260777237029',
      'collins.mubanga@boarder.ac.zm', '-', '2026-06-03',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Himalikiti Saviour'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-4-A',
      full_name = 'Himalikiti Saviour',
      phone = '260975547126',
      email = coalesce(nullif(btrim(v_email), ''), 'himalikiti.saviour@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-22',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-4-A', 'Himalikiti Saviour', '260975547126',
      'himalikiti.saviour@boarder.ac.zm', '-', '2026-06-22',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Wampa'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-5-A',
      full_name = 'Wampa',
      phone = '260971071877',
      email = coalesce(nullif(btrim(v_email), ''), 'wampa@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-07-22',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-5-A', 'Wampa', '260971071877',
      'wampa@boarder.ac.zm', '-', '2026-07-22',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('McDonald'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-6-A',
      full_name = 'McDonald',
      phone = '260773456119',
      email = coalesce(nullif(btrim(v_email), ''), 'mcdonald@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-01',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-6-A', 'McDonald', '260773456119',
      'mcdonald@boarder.ac.zm', '-', '2026-06-01',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Nanga Obrien'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-6-B',
      full_name = 'Nanga Obrien',
      phone = '260770838758',
      email = coalesce(nullif(btrim(v_email), ''), 'nanga.obrien@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-01-26',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-6-B', 'Nanga Obrien', '260770838758',
      'nanga.obrien@boarder.ac.zm', '-', '2026-01-26',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Zick Phiri'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-6-C',
      full_name = 'Zick Phiri',
      phone = '260973072762',
      email = coalesce(nullif(btrim(v_email), ''), 'zick.phiri@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-11',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-6-C', 'Zick Phiri', '260973072762',
      'zick.phiri@boarder.ac.zm', '-', '2026-06-11',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Funny Muyamina'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-7-A',
      full_name = 'Funny Muyamina',
      phone = '260771096585',
      email = coalesce(nullif(btrim(v_email), ''), 'funny.muyamina@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-7-A', 'Funny Muyamina', '260771096585',
      'funny.muyamina@boarder.ac.zm', '-', '2026-06-05',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Treasure Simeenda'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-7-B',
      full_name = 'Treasure Simeenda',
      phone = '260772393278',
      email = coalesce(nullif(btrim(v_email), ''), 'treasure.simeenda@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-7-B', 'Treasure Simeenda', '260772393278',
      'treasure.simeenda@boarder.ac.zm', '-', '2026-06-05',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Kangwa Kunda'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-8-A',
      full_name = 'Kangwa Kunda',
      phone = '260972024337',
      email = coalesce(nullif(btrim(v_email), ''), 'kangwa.kunda@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-25',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-8-A', 'Kangwa Kunda', '260972024337',
      'kangwa.kunda@boarder.ac.zm', '-', '2026-06-25',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Felistus Mweemba'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-9-A',
      full_name = 'Felistus Mweemba',
      phone = '260764785030',
      email = coalesce(nullif(btrim(v_email), ''), 'felistus.mweemba@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-09',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-9-A', 'Felistus Mweemba', '260764785030',
      'felistus.mweemba@boarder.ac.zm', '-', '2026-06-09',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Wendy Mpakise'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'BBH-9-B',
      full_name = 'Wendy Mpakise',
      phone = '260971977845',
      email = coalesce(nullif(btrim(v_email), ''), 'wendy.mpakise@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-27',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'BBH-9-B', 'Wendy Mpakise', '260971977845',
      'wendy.mpakise@boarder.ac.zm', '-', '2026-06-27',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Emely Mwale'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-10-A',
      full_name = 'Emely Mwale',
      phone = '260777238633',
      email = coalesce(nullif(btrim(v_email), ''), 'emely.mwale@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-10-A', 'Emely Mwale', '260777238633',
      'emely.mwale@boarder.ac.zm', '-', '2026-06-05',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Melody Mumba'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-10-B',
      full_name = 'Melody Mumba',
      phone = '260973551911',
      email = coalesce(nullif(btrim(v_email), ''), 'melody.mumba@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-13',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-10-B', 'Melody Mumba', '260973551911',
      'melody.mumba@boarder.ac.zm', '-', '2026-06-13',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Sara Matakala'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-10-C',
      full_name = 'Sara Matakala',
      phone = '260970522825',
      email = coalesce(nullif(btrim(v_email), ''), 'sara.matakala@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-25',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-10-C', 'Sara Matakala', '260970522825',
      'sara.matakala@boarder.ac.zm', '-', '2026-06-25',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Gift Nankamba'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-11-A',
      full_name = 'Gift Nankamba',
      phone = '260970956759',
      email = coalesce(nullif(btrim(v_email), ''), 'gift.nankamba@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-11-A', 'Gift Nankamba', '260970956759',
      'gift.nankamba@boarder.ac.zm', '-', '2026-06-05',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('chilulu chiliulu'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-12-A',
      full_name = 'chilulu chiliulu',
      phone = '260975185330',
      email = coalesce(nullif(btrim(v_email), ''), 'chilulu.chiliulu@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-09',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-12-A', 'chilulu chiliulu', '260975185330',
      'chilulu.chiliulu@boarder.ac.zm', '-', '2026-06-09',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Chibesa Chisembe'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-13-A',
      full_name = 'Chibesa Chisembe',
      phone = '260970270037',
      email = coalesce(nullif(btrim(v_email), ''), 'chibesa.chisembe@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-02',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-13-A', 'Chibesa Chisembe', '260970270037',
      'chibesa.chisembe@boarder.ac.zm', '-', '2026-06-02',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Reuben Ngusulu'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-14-A',
      full_name = 'Reuben Ngusulu',
      phone = '260763503053',
      email = coalesce(nullif(btrim(v_email), ''), 'reuben.ngusulu@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-11',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-14-A', 'Reuben Ngusulu', '260763503053',
      'reuben.ngusulu@boarder.ac.zm', '-', '2026-06-11',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Harriet nanyangwe'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'UPV-15-A',
      full_name = 'Harriet nanyangwe',
      phone = '260974130584',
      email = coalesce(nullif(btrim(v_email), ''), 'harriet.nanyangwe@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-03',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'UPV-15-A', 'Harriet nanyangwe', '260974130584',
      'harriet.nanyangwe@boarder.ac.zm', '-', '2026-06-03',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Ackim Siamafuko'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'CRV-16-B',
      full_name = 'Ackim Siamafuko',
      phone = '20772046008',
      email = coalesce(nullif(btrim(v_email), ''), 'ackim.siamafuko@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-07-20',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'CRV-16-B', 'Ackim Siamafuko', '20772046008',
      'ackim.siamafuko@boarder.ac.zm', '-', '2026-07-20',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Kwitu Khalu'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'CRV-17-A',
      full_name = 'Kwitu Khalu',
      phone = '260960785114',
      email = coalesce(nullif(btrim(v_email), ''), 'kwitu.khalu@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-02',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'CRV-17-A', 'Kwitu Khalu', '260960785114',
      'kwitu.khalu@boarder.ac.zm', '-', '2026-06-02',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Christopher Tambule'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'CRV-18-A',
      full_name = 'Christopher Tambule',
      phone = '260972108866',
      email = coalesce(nullif(btrim(v_email), ''), 'christopher.tambule@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-17',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'CRV-18-A', 'Christopher Tambule', '260972108866',
      'christopher.tambule@boarder.ac.zm', '-', '2026-06-17',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Samantha Musako (Kakompe)'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'ANX-19-A',
      full_name = 'Samantha Musako (Kakompe)',
      phone = '260977227794',
      email = coalesce(nullif(btrim(v_email), ''), 'samantha.musako.kakompe@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-26',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'ANX-19-A', 'Samantha Musako (Kakompe)', '260977227794',
      'samantha.musako.kakompe@boarder.ac.zm', '-', '2026-06-26',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Chanda Lutashima'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'ANX-19-B',
      full_name = 'Chanda Lutashima',
      phone = '260977951894',
      email = 'chanda.student@gmail.com',
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-07',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'ANX-19-B', 'Chanda Lutashima', '260977951894',
      'chanda.student@gmail.com', '-', '2026-06-07',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Josephine Nyirenda'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'ANX-19-C',
      full_name = 'Josephine Nyirenda',
      phone = '260779841908',
      email = coalesce(nullif(btrim(v_email), ''), 'josephine.nyirenda@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-05-06',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'ANX-19-C', 'Josephine Nyirenda', '260779841908',
      'josephine.nyirenda@boarder.ac.zm', '-', '2026-05-06',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Lubono Ruthendo'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'ANX-19-D',
      full_name = 'Lubono Ruthendo',
      phone = '260953618278',
      email = coalesce(nullif(btrim(v_email), ''), 'lubono.ruthendo@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-07-04',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'ANX-19-D', 'Lubono Ruthendo', '260953618278',
      'lubono.ruthendo@boarder.ac.zm', '-', '2026-07-04',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Steven Musonda'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'ANX-20-A',
      full_name = 'Steven Musonda',
      phone = '260975303236',
      email = coalesce(nullif(btrim(v_email), ''), 'steven.musonda@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-05',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'ANX-20-A', 'Steven Musonda', '260975303236',
      'steven.musonda@boarder.ac.zm', '-', '2026-06-05',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Lukundo Siame'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-21-A',
      full_name = 'Lukundo Siame',
      phone = '260760833629',
      email = coalesce(nullif(btrim(v_email), ''), 'lukundo.siame@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-18',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-21-A', 'Lukundo Siame', '260760833629',
      'lukundo.siame@boarder.ac.zm', '-', '2026-06-18',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Gabirel Kabwe'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-21-B',
      full_name = 'Gabirel Kabwe',
      phone = '260968723095',
      email = coalesce(nullif(btrim(v_email), ''), 'gabirel.kabwe@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-05-01',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-21-B', 'Gabirel Kabwe', '260968723095',
      'gabirel.kabwe@boarder.ac.zm', '-', '2026-05-01',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Chama Kampamba'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-21-C',
      full_name = 'Chama Kampamba',
      phone = '260770055753',
      email = coalesce(nullif(btrim(v_email), ''), 'chama.kampamba@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-06',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-21-C', 'Chama Kampamba', '260770055753',
      'chama.kampamba@boarder.ac.zm', '-', '2026-06-06',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Jairos Banda'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-21-D',
      full_name = 'Jairos Banda',
      phone = '260776136398',
      email = coalesce(nullif(btrim(v_email), ''), 'jairos.banda@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-01',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-21-D', 'Jairos Banda', '260776136398',
      'jairos.banda@boarder.ac.zm', '-', '2026-06-01',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('David Mulila'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-22-B',
      full_name = 'David Mulila',
      phone = '260775161085',
      email = coalesce(nullif(btrim(v_email), ''), 'david.mulila@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-18',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-22-B', 'David Mulila', '260775161085',
      'david.mulila@boarder.ac.zm', '-', '2026-06-18',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Ongani Madaliso Gabriel'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-22-C',
      full_name = 'Ongani Madaliso Gabriel',
      phone = '260771736585',
      email = coalesce(nullif(btrim(v_email), ''), 'ongani.madaliso.gabriel@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-01',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-22-C', 'Ongani Madaliso Gabriel', '260771736585',
      'ongani.madaliso.gabriel@boarder.ac.zm', '-', '2026-06-01',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Christopher Phiri'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-22-D',
      full_name = 'Christopher Phiri',
      phone = '260772109688',
      email = coalesce(nullif(btrim(v_email), ''), 'christopher.phiri@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-03',
      gender = 'Male'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-22-D', 'Christopher Phiri', '260772109688',
      'christopher.phiri@boarder.ac.zm', '-', '2026-06-03',
      'Male'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Catherine Mphande'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-23-B',
      full_name = 'Catherine Mphande',
      phone = '260963575803',
      email = coalesce(nullif(btrim(v_email), ''), 'catherine.mphande@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-14',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-23-B', 'Catherine Mphande', '260963575803',
      'catherine.mphande@boarder.ac.zm', '-', '2026-06-14',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Grace Mwamba'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-23-C',
      full_name = 'Grace Mwamba',
      phone = '260957144512',
      email = coalesce(nullif(btrim(v_email), ''), 'grace.mwamba@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-11',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-23-C', 'Grace Mwamba', '260957144512',
      'grace.mwamba@boarder.ac.zm', '-', '2026-06-11',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Lushomo gambwe'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-23-D',
      full_name = 'Lushomo gambwe',
      phone = '260970183545',
      email = coalesce(nullif(btrim(v_email), ''), 'lushomo.gambwe@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-02-25',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-23-D', 'Lushomo gambwe', '260970183545',
      'lushomo.gambwe@boarder.ac.zm', '-', '2026-02-25',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Jacqueline Mwape'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-23-E',
      full_name = 'Jacqueline Mwape',
      phone = '260761423674',
      email = coalesce(nullif(btrim(v_email), ''), 'jacqueline.mwape@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-17',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-23-E', 'Jacqueline Mwape', '260761423674',
      'jacqueline.mwape@boarder.ac.zm', '-', '2026-06-17',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Chami Soneka'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-24-A',
      full_name = 'Chami Soneka',
      phone = '260969410900',
      email = coalesce(nullif(btrim(v_email), ''), 'chami.soneka@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-08-01',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-24-A', 'Chami Soneka', '260969410900',
      'chami.soneka@boarder.ac.zm', '-', '2026-08-01',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Kuwunda Makondo'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-24-B',
      full_name = 'Kuwunda Makondo',
      phone = '260774614576',
      email = coalesce(nullif(btrim(v_email), ''), 'kuwunda.makondo@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-08-29',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-24-B', 'Kuwunda Makondo', '260774614576',
      'kuwunda.makondo@boarder.ac.zm', '-', '2026-08-29',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Chansa Chinyama'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-24-C',
      full_name = 'Chansa Chinyama',
      phone = '260974051468',
      email = coalesce(nullif(btrim(v_email), ''), 'chansa.chinyama@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-16',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-24-C', 'Chansa Chinyama', '260974051468',
      'chansa.chinyama@boarder.ac.zm', '-', '2026-06-16',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

do $$
declare
  v_id uuid;
  v_email text;
  v_auth uuid;
begin
  select id, email, auth_user_id into v_id, v_email, v_auth
  from public.tenants
  where lower(btrim(full_name)) = lower(btrim('Kawina Florence'))
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.tenants set
      bed_space_id = 'NWG-24-D',
      full_name = 'Kawina Florence',
      phone = '260976534878',
      email = coalesce(nullif(btrim(v_email), ''), 'kawina.florence@boarder.ac.zm'),
      nrc = coalesce(nullif(nrc, ''), '-'),
      move_in_date = '2026-06-07',
      gender = 'Female'::public.room_gender,
      status = 'active',
      status_reason = null,
      status_changed_at = null,
      is_active = true
    where id = v_id;
  else
    insert into public.tenants (
      bed_space_id, full_name, phone, email, nrc, move_in_date, gender, status
    ) values (
      'NWG-24-D', 'Kawina Florence', '260976534878',
      'kawina.florence@boarder.ac.zm', '-', '2026-06-07',
      'Female'::public.room_gender, 'active'
    );
  end if;
end $$;

update public.maintenance_issues i
set bed_space_id = t.bed_space_id,
    student_name = t.full_name
from public.tenants t
where t.status = 'active'
  and lower(btrim(i.student_name)) = lower(btrim(t.full_name));

delete from public.payments p
where p.bed_space_id not in ('BBH-1-A', 'BBH-2-A', 'BBH-2-B', 'BBH-3-A', 'BBH-3-B', 'BBH-3-C', 'BBH-4-A', 'BBH-5-A', 'BBH-6-A', 'BBH-6-B', 'BBH-6-C', 'BBH-7-A', 'BBH-7-B', 'BBH-7-C', 'BBH-8-A', 'BBH-8-B', 'BBH-9-A', 'BBH-9-B', 'BBH-9-C', 'UPV-10-A', 'UPV-10-B', 'UPV-10-C', 'UPV-10-D', 'UPV-11-A', 'UPV-12-A', 'UPV-13-A', 'UPV-14-A', 'UPV-15-A', 'CRV-16-A', 'CRV-16-B', 'CRV-17-A', 'CRV-18-A', 'ANX-19-A', 'ANX-19-B', 'ANX-19-C', 'ANX-19-D', 'ANX-20-A', 'NWG-21-A', 'NWG-21-B', 'NWG-21-C', 'NWG-21-D', 'NWG-22-A', 'NWG-22-B', 'NWG-22-C', 'NWG-22-D', 'NWG-23-A', 'NWG-23-B', 'NWG-23-C', 'NWG-23-D', 'NWG-23-E', 'NWG-24-A', 'NWG-24-B', 'NWG-24-C', 'NWG-24-D');

delete from public.billing_records
where billing_id not in ('BBH-1-A', 'BBH-2-A', 'BBH-2-B', 'BBH-3-A', 'BBH-3-B', 'BBH-3-C', 'BBH-4-A', 'BBH-5-A', 'BBH-6-A', 'BBH-6-B', 'BBH-6-C', 'BBH-7-A', 'BBH-7-B', 'BBH-7-C', 'BBH-8-A', 'BBH-8-B', 'BBH-9-A', 'BBH-9-B', 'BBH-9-C', 'UPV-10-A', 'UPV-10-B', 'UPV-10-C', 'UPV-10-D', 'UPV-11-A', 'UPV-12-A', 'UPV-13-A', 'UPV-14-A', 'UPV-15-A', 'CRV-16-A', 'CRV-16-B', 'CRV-17-A', 'CRV-18-A', 'ANX-19-A', 'ANX-19-B', 'ANX-19-C', 'ANX-19-D', 'ANX-20-A', 'NWG-21-A', 'NWG-21-B', 'NWG-21-C', 'NWG-21-D', 'NWG-22-A', 'NWG-22-B', 'NWG-22-C', 'NWG-22-D', 'NWG-23-A', 'NWG-23-B', 'NWG-23-C', 'NWG-23-D', 'NWG-23-E', 'NWG-24-A', 'NWG-24-B', 'NWG-24-C', 'NWG-24-D');

delete from public.bed_spaces
where id not in ('BBH-1-A', 'BBH-2-A', 'BBH-2-B', 'BBH-3-A', 'BBH-3-B', 'BBH-3-C', 'BBH-4-A', 'BBH-5-A', 'BBH-6-A', 'BBH-6-B', 'BBH-6-C', 'BBH-7-A', 'BBH-7-B', 'BBH-7-C', 'BBH-8-A', 'BBH-8-B', 'BBH-9-A', 'BBH-9-B', 'BBH-9-C', 'UPV-10-A', 'UPV-10-B', 'UPV-10-C', 'UPV-10-D', 'UPV-11-A', 'UPV-12-A', 'UPV-13-A', 'UPV-14-A', 'UPV-15-A', 'CRV-16-A', 'CRV-16-B', 'CRV-17-A', 'CRV-18-A', 'ANX-19-A', 'ANX-19-B', 'ANX-19-C', 'ANX-19-D', 'ANX-20-A', 'NWG-21-A', 'NWG-21-B', 'NWG-21-C', 'NWG-21-D', 'NWG-22-A', 'NWG-22-B', 'NWG-22-C', 'NWG-22-D', 'NWG-23-A', 'NWG-23-B', 'NWG-23-C', 'NWG-23-D', 'NWG-23-E', 'NWG-24-A', 'NWG-24-B', 'NWG-24-C', 'NWG-24-D');

-- Workbook billing snapshot (balances and target months).
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '1',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Adrian mulale',
  phone_number = '260977146630',
  entry_date = '2026-06-30',
  current_rent = 950,
  target_month = 'Aug',
  accumulated_total = 7600,
  total_balance = 950
where billing_id = 'BBH-1-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '2',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Wisdom Bwani',
  phone_number = '260776960320',
  entry_date = '2026-06-05',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-2-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '2',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Jackson Mwanza',
  phone_number = '260976625656',
  entry_date = '2026-06-08',
  current_rent = 900,
  target_month = 'Jul',
  accumulated_total = 6300,
  total_balance = 1200
where billing_id = 'BBH-2-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '3',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Prosper Kalayi',
  phone_number = '260970522913',
  entry_date = '2026-06-13',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-3-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '3',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Shadrach Munganini',
  phone_number = '260979567550',
  entry_date = '2026-07-25',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-3-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '3',
  bed_space = 'C',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Collins Mubanga',
  phone_number = '260777237029',
  entry_date = '2026-06-03',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-3-C';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '4',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Himalikiti Saviour',
  phone_number = '260975547126',
  entry_date = '2026-06-22',
  current_rent = 950,
  target_month = 'Jul',
  accumulated_total = 6650,
  total_balance = 1900
where billing_id = 'BBH-4-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '5',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Wampa',
  phone_number = '260971071877',
  entry_date = '2026-07-22',
  current_rent = 0,
  target_month = 'Jul',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'BBH-5-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '6',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'McDonald',
  phone_number = '260773456119',
  entry_date = '2026-06-01',
  current_rent = 900,
  target_month = 'May',
  accumulated_total = 4500,
  total_balance = 2600
where billing_id = 'BBH-6-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '6',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Nanga Obrien',
  phone_number = '260770838758',
  entry_date = '2026-01-26',
  current_rent = 900,
  target_month = 'May',
  accumulated_total = 4500,
  total_balance = 3600
where billing_id = 'BBH-6-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '6',
  bed_space = 'C',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Zick Phiri',
  phone_number = '260973072762',
  entry_date = '2026-06-11',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-6-C';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '7',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Funny Muyamina',
  phone_number = '260771096585',
  entry_date = '2026-06-05',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-7-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '7',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Treasure Simeenda',
  phone_number = '260772393278',
  entry_date = '2026-06-05',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-7-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '7',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 900,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'BBH-7-C';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '8',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Kangwa Kunda',
  phone_number = '260972024337',
  entry_date = '2026-06-25',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-8-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '8',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 900,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'BBH-8-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '9',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Felistus Mweemba',
  phone_number = '260764785030',
  entry_date = '2026-06-09',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'BBH-9-A';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '9',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Wendy Mpakise',
  phone_number = '260971977845',
  entry_date = '2026-06-27',
  current_rent = 900,
  target_month = 'Jul',
  accumulated_total = 6300,
  total_balance = 1800
where billing_id = 'BBH-9-B';
update public.billing_records set
  house_block = 'BBH'::public.block_code,
  room_number = '9',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 900,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'BBH-9-C';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '10',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Emely Mwale',
  phone_number = '260777238633',
  entry_date = '2026-06-05',
  current_rent = 900,
  target_month = 'Sep',
  accumulated_total = 8100,
  total_balance = 0
where billing_id = 'UPV-10-A';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '10',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Melody Mumba',
  phone_number = '260973551911',
  entry_date = '2026-06-13',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'UPV-10-B';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '10',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Sara Matakala',
  phone_number = '260970522825',
  entry_date = '2026-06-25',
  current_rent = 900,
  target_month = 'Aug',
  accumulated_total = 7200,
  total_balance = 900
where billing_id = 'UPV-10-C';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '10',
  bed_space = 'D',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 900,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'UPV-10-D';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '11',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Gift Nankamba',
  phone_number = '260970956759',
  entry_date = '2026-06-05',
  current_rent = 1000,
  target_month = 'Sep',
  accumulated_total = 9000,
  total_balance = 0
where billing_id = 'UPV-11-A';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '12',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'chilulu chiliulu',
  phone_number = '260975185330',
  entry_date = '2026-06-09',
  current_rent = 1600,
  target_month = 'Aug',
  accumulated_total = 12800,
  total_balance = 1600
where billing_id = 'UPV-12-A';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '13',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Chibesa Chisembe',
  phone_number = '260970270037',
  entry_date = '2026-06-02',
  current_rent = 1800,
  target_month = 'Sep',
  accumulated_total = 16200,
  total_balance = 0
where billing_id = 'UPV-13-A';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '14',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Reuben Ngusulu',
  phone_number = '260763503053',
  entry_date = '2026-06-11',
  current_rent = 950,
  target_month = 'Aug',
  accumulated_total = 7600,
  total_balance = 950
where billing_id = 'UPV-14-A';
update public.billing_records set
  house_block = 'UPV'::public.block_code,
  room_number = '15',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Harriet nanyangwe',
  phone_number = '260974130584',
  entry_date = '2026-06-03',
  current_rent = 1100,
  target_month = 'Aug',
  accumulated_total = 8800,
  total_balance = 700
where billing_id = 'UPV-15-A';
update public.billing_records set
  house_block = 'CRV'::public.block_code,
  room_number = '16',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 1200,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'CRV-16-A';
update public.billing_records set
  house_block = 'CRV'::public.block_code,
  room_number = '16',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Ackim Siamafuko',
  phone_number = '20772046008',
  entry_date = '2026-07-20',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'CRV-16-B';
update public.billing_records set
  house_block = 'CRV'::public.block_code,
  room_number = '17',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Kwitu Khalu',
  phone_number = '260960785114',
  entry_date = '2026-06-02',
  current_rent = 900,
  target_month = 'Sep',
  accumulated_total = 8100,
  total_balance = 0
where billing_id = 'CRV-17-A';
update public.billing_records set
  house_block = 'CRV'::public.block_code,
  room_number = '18',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Christopher Tambule',
  phone_number = '260972108866',
  entry_date = '2026-06-17',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'CRV-18-A';
update public.billing_records set
  house_block = 'ANX'::public.block_code,
  room_number = '19',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Samantha Musako (Kakompe)',
  phone_number = '260977227794',
  entry_date = '2026-06-26',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'ANX-19-A';
update public.billing_records set
  house_block = 'ANX'::public.block_code,
  room_number = '19',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Chanda Lutashima',
  phone_number = '260977951894',
  entry_date = '2026-06-07',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'ANX-19-B';
update public.billing_records set
  house_block = 'ANX'::public.block_code,
  room_number = '19',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Josephine Nyirenda',
  phone_number = '260779841908',
  entry_date = '2026-05-06',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'ANX-19-C';
update public.billing_records set
  house_block = 'ANX'::public.block_code,
  room_number = '19',
  bed_space = 'D',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Lubono Ruthendo',
  phone_number = '260953618278',
  entry_date = '2026-07-04',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'ANX-19-D';
update public.billing_records set
  house_block = 'ANX'::public.block_code,
  room_number = '20',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Steven Musonda',
  phone_number = '260975303236',
  entry_date = '2026-06-05',
  current_rent = 1400,
  target_month = 'Sep',
  accumulated_total = 12600,
  total_balance = 0
where billing_id = 'ANX-20-A';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '21',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Lukundo Siame',
  phone_number = '260760833629',
  entry_date = '2026-06-18',
  current_rent = 1200,
  target_month = 'Jul',
  accumulated_total = 8400,
  total_balance = 1250
where billing_id = 'NWG-21-A';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '21',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Gabirel Kabwe',
  phone_number = '260968723095',
  entry_date = '2026-05-01',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-21-B';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '21',
  bed_space = 'C',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Chama Kampamba',
  phone_number = '260770055753',
  entry_date = '2026-06-06',
  current_rent = 1200,
  target_month = 'Jul',
  accumulated_total = 8400,
  total_balance = 2400
where billing_id = 'NWG-21-C';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '21',
  bed_space = 'D',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Jairos Banda',
  phone_number = '260776136398',
  entry_date = '2026-06-01',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'NWG-21-D';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '22',
  bed_space = 'A',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 1200,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'NWG-22-A';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '22',
  bed_space = 'B',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'David Mulila',
  phone_number = '260775161085',
  entry_date = '2026-06-18',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-22-B';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '22',
  bed_space = 'C',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Ongani Madaliso Gabriel',
  phone_number = '260771736585',
  entry_date = '2026-06-01',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'NWG-22-C';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '22',
  bed_space = 'D',
  room_gender = 'Male'::public.room_gender,
  tenant_name = 'Christopher Phiri',
  phone_number = '260772109688',
  entry_date = '2026-06-03',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'NWG-22-D';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '23',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Vacant',
  phone_number = '-',
  entry_date = '-',
  current_rent = 1200,
  target_month = '-',
  accumulated_total = 0,
  total_balance = 0
where billing_id = 'NWG-23-A';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '23',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Catherine Mphande',
  phone_number = '260963575803',
  entry_date = '2026-06-14',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-23-B';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '23',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Grace Mwamba',
  phone_number = '260957144512',
  entry_date = '2026-06-11',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-23-C';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '23',
  bed_space = 'D',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Lushomo gambwe',
  phone_number = '260970183545',
  entry_date = '2026-02-25',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-23-D';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '23',
  bed_space = 'E',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Jacqueline Mwape',
  phone_number = '260761423674',
  entry_date = '2026-06-17',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-23-E';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '24',
  bed_space = 'A',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Chami Soneka',
  phone_number = '260969410900',
  entry_date = '2026-08-01',
  current_rent = 1200,
  target_month = 'Sep',
  accumulated_total = 10800,
  total_balance = 0
where billing_id = 'NWG-24-A';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '24',
  bed_space = 'B',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Kuwunda Makondo',
  phone_number = '260774614576',
  entry_date = '2026-08-29',
  current_rent = 1200,
  target_month = 'Aug',
  accumulated_total = 9600,
  total_balance = 1200
where billing_id = 'NWG-24-B';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '24',
  bed_space = 'C',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Chansa Chinyama',
  phone_number = '260974051468',
  entry_date = '2026-06-16',
  current_rent = 1200,
  target_month = 'Jul',
  accumulated_total = 8400,
  total_balance = 2400
where billing_id = 'NWG-24-C';
update public.billing_records set
  house_block = 'NWG'::public.block_code,
  room_number = '24',
  bed_space = 'D',
  room_gender = 'Female'::public.room_gender,
  tenant_name = 'Kawina Florence',
  phone_number = '260976534878',
  entry_date = '2026-06-07',
  current_rent = 1200,
  target_month = 'Jun',
  accumulated_total = 7200,
  total_balance = 3600
where billing_id = 'NWG-24-D';

-- Keep the imported balances when the landlord next opens the dashboard.
-- Paid rows already sit on the current month; unpaid rows would otherwise
-- pick up an extra live-month charge on top of the spreadsheet.
do $$
declare
  v_month text := public.current_billing_month();
  r public.billing_records%rowtype;
  v_owed integer;
  v_next text;
begin
  for r in select * from public.billing_records loop
    if r.tenant_name is null or lower(btrim(r.tenant_name)) = 'vacant' then
      continue;
    end if;
    if r.total_balance <= 0 then
      update public.billing_records
      set target_month = v_month
      where billing_id = r.billing_id and r.target_month is distinct from v_month;
      continue;
    end if;
    if public.months_to_charge(r.target_month, v_month, r.total_balance, r.current_rent) <= 0 then
      continue;
    end if;
    v_owed := greatest(1, public.months_owed(r.total_balance, r.current_rent));
    v_next := public.add_billing_months(v_month, 1 - v_owed);
    update public.billing_records
    set target_month = v_next
    where billing_id = r.billing_id;
  end loop;
end $$;

update public.billing_records
set days_past_due = public.days_past_due_for_month(target_month, (timezone('Africa/Lusaka', now()))::date, total_balance > 0)
where tenant_name is distinct from 'Vacant';

update public.billing_records
set days_past_due = 0, target_month = '-', accumulated_total = 0, total_balance = 0
where lower(btrim(tenant_name)) = 'vacant';

delete from public.payments
where bed_space_id in ('BBH-1-A', 'BBH-2-A', 'BBH-2-B', 'BBH-3-A', 'BBH-3-B', 'BBH-3-C', 'BBH-4-A', 'BBH-5-A', 'BBH-6-A', 'BBH-6-B', 'BBH-6-C', 'BBH-7-A', 'BBH-7-B', 'BBH-7-C', 'BBH-8-A', 'BBH-8-B', 'BBH-9-A', 'BBH-9-B', 'BBH-9-C', 'UPV-10-A', 'UPV-10-B', 'UPV-10-C', 'UPV-10-D', 'UPV-11-A', 'UPV-12-A', 'UPV-13-A', 'UPV-14-A', 'UPV-15-A', 'CRV-16-A', 'CRV-16-B', 'CRV-17-A', 'CRV-18-A', 'ANX-19-A', 'ANX-19-B', 'ANX-19-C', 'ANX-19-D', 'ANX-20-A', 'NWG-21-A', 'NWG-21-B', 'NWG-21-C', 'NWG-21-D', 'NWG-22-A', 'NWG-22-B', 'NWG-22-C', 'NWG-22-D', 'NWG-23-A', 'NWG-23-B', 'NWG-23-C', 'NWG-23-D', 'NWG-23-E', 'NWG-24-A', 'NWG-24-B', 'NWG-24-C', 'NWG-24-D');

alter table public.payments disable trigger trg_payment_verified;

insert into public.payments (id, student_name, bed_space_id, amount, method, transaction_ref, submitted_at, status)
values
  ('xlsx-2026-01-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-1-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-1-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-1-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-1-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-1-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-1-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-1-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-1-A', 'Adrian mulale', 'BBH-1-A', 950, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-1-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-2-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-2-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-2-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-2-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-2-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-2-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-2-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-2-A', 'Wisdom Bwani', 'BBH-2-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-2-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-2-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-2-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-2-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-2-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-2-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-2-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-2-B', 'Jackson Mwanza', 'BBH-2-B', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-2-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-3-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-3-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-3-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-3-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-3-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-3-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-3-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-3-A', 'Prosper Kalayi', 'BBH-3-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-3-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-3-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-3-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-3-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-3-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-3-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-3-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-3-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-3-B', 'Shadrach Munganini', 'BBH-3-B', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-3-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-3-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-3-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-3-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-3-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-3-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-3-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-3-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-3-C', 'Collins Mubanga', 'BBH-3-C', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-3-C', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-4-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-4-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-4-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-4-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-4-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-4-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-4-A', 'Himalikiti Saviour', 'BBH-4-A', 950, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-4-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-6-A', 'McDonald', 'BBH-6-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-6-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-6-A', 'McDonald', 'BBH-6-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-6-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-6-A', 'McDonald', 'BBH-6-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-6-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-6-A', 'McDonald', 'BBH-6-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-6-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-6-A', 'McDonald', 'BBH-6-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-6-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-6-B', 'Nanga Obrien', 'BBH-6-B', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-6-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-6-B', 'Nanga Obrien', 'BBH-6-B', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-6-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-6-B', 'Nanga Obrien', 'BBH-6-B', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-6-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-6-B', 'Nanga Obrien', 'BBH-6-B', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-6-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-6-B', 'Nanga Obrien', 'BBH-6-B', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-6-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-6-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-6-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-6-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-6-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-6-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-6-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-6-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-6-C', 'Zick Phiri', 'BBH-6-C', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-6-C', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-7-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-7-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-7-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-7-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-7-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-7-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-7-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-7-A', 'Funny Muyamina', 'BBH-7-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-7-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-7-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-7-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-7-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-7-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-7-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-7-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-7-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-7-B', 'Treasure Simeenda', 'BBH-7-B', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-7-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-8-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-8-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-8-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-8-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-8-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-8-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-8-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-8-A', 'Kangwa Kunda', 'BBH-8-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-8-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-9-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-9-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-9-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-9-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-9-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-9-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-9-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-BBH-9-A', 'Felistus Mweemba', 'BBH-9-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-BBH-9-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260131-BBH-9-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260228-BBH-9-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260331-BBH-9-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260430-BBH-9-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260531-BBH-9-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260630-BBH-9-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-BBH-9-B', 'Wendy Mpakise', 'BBH-9-B', 900, 'Cash'::public.payment_method, 'XLSX-20260731-BBH-9-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-CRV-16-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-CRV-16-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-CRV-16-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-CRV-16-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-CRV-16-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-CRV-16-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-CRV-16-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-CRV-16-B', 'Ackim Siamafuko', 'CRV-16-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-CRV-16-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260131-CRV-17-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260228-CRV-17-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260331-CRV-17-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260430-CRV-17-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260531-CRV-17-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260630-CRV-17-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260731-CRV-17-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260831-CRV-17-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-CRV-17-A', 'Kwitu Khalu', 'CRV-17-A', 900, 'Cash'::public.payment_method, 'XLSX-20260907-CRV-17-A', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-CRV-18-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-CRV-18-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-CRV-18-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-CRV-18-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-CRV-18-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-CRV-18-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-CRV-18-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-CRV-18-A', 'Christopher Tambule', 'CRV-18-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-CRV-18-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-ANX-19-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-ANX-19-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-ANX-19-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-ANX-19-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-ANX-19-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-ANX-19-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-ANX-19-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-ANX-19-A', 'Samantha Musako (Kakompe)', 'ANX-19-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-ANX-19-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-ANX-19-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-ANX-19-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-ANX-19-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-ANX-19-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-ANX-19-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-ANX-19-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-ANX-19-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-ANX-19-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-ANX-19-B', 'Chanda Lutashima', 'ANX-19-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-ANX-19-B', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-ANX-19-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-ANX-19-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-ANX-19-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-ANX-19-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-ANX-19-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-ANX-19-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-ANX-19-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-ANX-19-C', 'Josephine Nyirenda', 'ANX-19-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-ANX-19-C', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-ANX-19-D', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-ANX-19-D', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-ANX-19-D', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-ANX-19-D', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-ANX-19-D', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-ANX-19-D', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-ANX-19-D', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-ANX-19-D', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-ANX-19-D', 'Lubono Ruthendo', 'ANX-19-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-ANX-19-D', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260131-ANX-20-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260228-ANX-20-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260331-ANX-20-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260430-ANX-20-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260531-ANX-20-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260630-ANX-20-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260731-ANX-20-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260831-ANX-20-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-ANX-20-A', 'Steven Musonda', 'ANX-20-A', 1400, 'Cash'::public.payment_method, 'XLSX-20260907-ANX-20-A', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-21-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-21-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-21-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-21-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-21-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-21-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-21-A', 'Lukundo Siame', 'NWG-21-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-21-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-21-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-21-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-21-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-21-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-21-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-21-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-21-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-21-B', 'Gabirel Kabwe', 'NWG-21-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-21-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-21-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-21-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-21-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-21-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-21-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-21-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-21-C', 'Chama Kampamba', 'NWG-21-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-21-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-21-D', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-21-D', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-21-D', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-21-D', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-21-D', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-21-D', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-21-D', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-21-D', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-NWG-21-D', 'Jairos Banda', 'NWG-21-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-NWG-21-D', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-22-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-22-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-22-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-22-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-22-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-22-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-22-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-22-B', 'David Mulila', 'NWG-22-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-22-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-22-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-22-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-22-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-22-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-22-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-22-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-22-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-22-C', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-NWG-22-C', 'Ongani Madaliso Gabriel', 'NWG-22-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-NWG-22-C', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-22-D', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-22-D', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-22-D', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-22-D', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-22-D', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-22-D', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-22-D', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-22-D', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-NWG-22-D', 'Christopher Phiri', 'NWG-22-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-NWG-22-D', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-23-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-23-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-23-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-23-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-23-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-23-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-23-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-23-B', 'Catherine Mphande', 'NWG-23-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-23-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-23-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-23-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-23-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-23-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-23-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-23-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-23-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-23-C', 'Grace Mwamba', 'NWG-23-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-23-C', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-23-D', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-23-D', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-23-D', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-23-D', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-23-D', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-23-D', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-23-D', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-23-D', 'Lushomo gambwe', 'NWG-23-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-23-D', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-23-E', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-23-E', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-23-E', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-23-E', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-23-E', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-23-E', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-23-E', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-23-E', 'Jacqueline Mwape', 'NWG-23-E', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-23-E', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-24-A', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-24-A', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-24-A', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-24-A', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-24-A', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-24-A', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-24-A', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-24-A', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-09-NWG-24-A', 'Chami Soneka', 'NWG-24-A', 1200, 'Cash'::public.payment_method, 'XLSX-20260907-NWG-24-A', '2026-09-07', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-24-B', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-24-B', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-24-B', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-24-B', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-24-B', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-24-B', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-24-B', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-08-NWG-24-B', 'Kuwunda Makondo', 'NWG-24-B', 1200, 'Cash'::public.payment_method, 'XLSX-20260831-NWG-24-B', '2026-08-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-24-C', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-24-C', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-24-C', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-24-C', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-24-C', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-24-C', '2026-06-30', 'pending'::public.pay_status),
  ('xlsx-2026-07-NWG-24-C', 'Chansa Chinyama', 'NWG-24-C', 1200, 'Cash'::public.payment_method, 'XLSX-20260731-NWG-24-C', '2026-07-31', 'pending'::public.pay_status),
  ('xlsx-2026-01-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260131-NWG-24-D', '2026-01-31', 'pending'::public.pay_status),
  ('xlsx-2026-02-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260228-NWG-24-D', '2026-02-28', 'pending'::public.pay_status),
  ('xlsx-2026-03-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260331-NWG-24-D', '2026-03-31', 'pending'::public.pay_status),
  ('xlsx-2026-04-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260430-NWG-24-D', '2026-04-30', 'pending'::public.pay_status),
  ('xlsx-2026-05-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260531-NWG-24-D', '2026-05-31', 'pending'::public.pay_status),
  ('xlsx-2026-06-NWG-24-D', 'Kawina Florence', 'NWG-24-D', 1200, 'Cash'::public.payment_method, 'XLSX-20260630-NWG-24-D', '2026-06-30', 'pending'::public.pay_status)
on conflict (id) do update set
  student_name = excluded.student_name,
  bed_space_id = excluded.bed_space_id,
  amount = excluded.amount,
  method = excluded.method,
  transaction_ref = excluded.transaction_ref,
  submitted_at = excluded.submitted_at,
  status = 'pending';

update public.payments set status = 'verified', rejection_reason = null
where id like 'xlsx-2026-%';

alter table public.payments enable trigger trg_payment_verified;

update public.bed_spaces bs
set status = case
  when exists (select 1 from public.tenants t where t.bed_space_id = bs.id and t.status = 'active')
  then 'occupied'::public.bed_status
  else 'vacant'::public.bed_status
end;

