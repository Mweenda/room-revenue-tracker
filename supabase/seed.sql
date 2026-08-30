-- Room Revenue Tracker — seed data (54 beds + sample payments/issues/utilities)
-- Run AFTER 001_initial_schema.sql
--
-- All property rows belong to Mr. S. Mwamba. Migration 010 enforces that
-- ownership; this seed stamps the same landlord_id so a fresh database matches.

insert into public.profiles (id, role, full_name, email, phone, address, bio)
select
  '7e2a9c41-0b18-4f6d-9e3a-2c5b8d1f4a70',
  'landlord',
  'Mr. S. Mwamba',
  'mwamba.property@gmail.com',
  '+260 977 001 234',
  'Plot 45, Lusaka, Zambia',
  'Property owner and manager of 4 residential blocks housing 54 students in Lusaka.'
where not exists (
  select 1 from public.profiles where lower(email) = 'mwamba.property@gmail.com'
);

-- ─── Blocks ──────────────────────────────────────────────────────────────────

insert into public.blocks (code, name, owner_utility_cap, landlord_id)
select v.code, v.name, v.cap, p.id
from (
  values
    ('BBH', 'BBH Block', 70),
    ('NWG', 'NWG Block', 70),
    ('ANX', 'ANX Block', 70),
    ('CRV', 'CRV Block', 70)
) as v(code, name, cap)
join public.profiles p
  on p.role = 'landlord' and lower(p.email) = 'mwamba.property@gmail.com'
on conflict (code) do update
  set landlord_id = coalesce(public.blocks.landlord_id, excluded.landlord_id);

-- ─── Bed spaces (54) ─────────────────────────────────────────────────────────

insert into public.bed_spaces (id, block_code, room_number, bed_letter, room_gender, rent_amount, status) values
  ('BBH-1-A',  'BBH', 1,  'A', 'Male',   950,  'occupied'),
  ('BBH-2-A',  'BBH', 2,  'A', 'Male',   900,  'occupied'),
  ('BBH-2-B',  'BBH', 2,  'B', 'Male',   900,  'occupied'),
  ('BBH-3-A',  'BBH', 3,  'A', 'Male',   900,  'occupied'),
  ('BBH-3-B',  'BBH', 3,  'B', 'Male',   900,  'occupied'),
  ('BBH-4-A',  'BBH', 4,  'A', 'Male',   900,  'occupied'),
  ('BBH-4-B',  'BBH', 4,  'B', 'Male',   900,  'occupied'),
  ('BBH-5-A',  'BBH', 5,  'A', 'Male',   900,  'occupied'),
  ('BBH-5-B',  'BBH', 5,  'B', 'Male',   900,  'occupied'),
  ('BBH-6-A',  'BBH', 6,  'A', 'Male',   900,  'occupied'),
  ('BBH-6-B',  'BBH', 6,  'B', 'Male',   900,  'occupied'),
  ('BBH-7-A',  'BBH', 7,  'A', 'Female', 900,  'occupied'),
  ('BBH-7-B',  'BBH', 7,  'B', 'Female', 900,  'occupied'),
  ('BBH-7-C',  'BBH', 7,  'C', 'Female', 900,  'vacant'),
  ('BBH-8-A',  'BBH', 8,  'A', 'Male',   900,  'occupied'),
  ('BBH-8-B',  'BBH', 8,  'B', 'Male',   850,  'vacant'),
  ('BBH-9-A',  'BBH', 9,  'A', 'Female', 900,  'occupied'),
  ('BBH-9-B',  'BBH', 9,  'B', 'Female', 900,  'occupied'),
  ('BBH-9-C',  'BBH', 9,  'C', 'Female', 900,  'vacant'),
  ('NWG-10-A', 'NWG', 10, 'A', 'Male',   1100, 'occupied'),
  ('NWG-10-B', 'NWG', 10, 'B', 'Male',   1100, 'occupied'),
  ('NWG-11-A', 'NWG', 11, 'A', 'Female', 1100, 'occupied'),
  ('NWG-11-B', 'NWG', 11, 'B', 'Female', 1100, 'vacant'),
  ('NWG-12-A', 'NWG', 12, 'A', 'Male',   1050, 'occupied'),
  ('NWG-12-B', 'NWG', 12, 'B', 'Male',   1050, 'occupied'),
  ('NWG-13-A', 'NWG', 13, 'A', 'Female', 1100, 'occupied'),
  ('NWG-13-B', 'NWG', 13, 'B', 'Female', 1100, 'vacant'),
  ('NWG-14-A', 'NWG', 14, 'A', 'Male',   1000, 'occupied'),
  ('NWG-14-B', 'NWG', 14, 'B', 'Male',   1000, 'occupied'),
  ('ANX-15-A', 'ANX', 15, 'A', 'Female', 1200, 'occupied'),
  ('ANX-15-B', 'ANX', 15, 'B', 'Female', 1200, 'occupied'),
  ('ANX-16-A', 'ANX', 16, 'A', 'Male',   1150, 'occupied'),
  ('ANX-16-B', 'ANX', 16, 'B', 'Male',   1150, 'occupied'),
  ('ANX-17-A', 'ANX', 17, 'A', 'Female', 1200, 'occupied'),
  ('ANX-17-B', 'ANX', 17, 'B', 'Female', 1150, 'vacant'),
  ('ANX-18-A', 'ANX', 18, 'A', 'Male',   1200, 'occupied'),
  ('ANX-18-B', 'ANX', 18, 'B', 'Male',   1200, 'occupied'),
  ('ANX-19-A', 'ANX', 19, 'A', 'Female', 1200, 'occupied'),
  ('ANX-19-B', 'ANX', 19, 'B', 'Female', 1200, 'occupied'),
  ('ANX-19-C', 'ANX', 19, 'C', 'Female', 1200, 'occupied'),
  ('CRV-20-A', 'CRV', 20, 'A', 'Male',   1000, 'occupied'),
  ('CRV-20-B', 'CRV', 20, 'B', 'Male',   1000, 'occupied'),
  ('CRV-21-A', 'CRV', 21, 'A', 'Female', 1000, 'occupied'),
  ('CRV-21-B', 'CRV', 21, 'B', 'Female', 1000, 'occupied'),
  ('CRV-22-A', 'CRV', 22, 'A', 'Male',   1000, 'occupied'),
  ('CRV-22-B', 'CRV', 22, 'B', 'Male',   1000, 'occupied'),
  ('CRV-23-A', 'CRV', 23, 'A', 'Female', 1000, 'occupied'),
  ('CRV-23-B', 'CRV', 23, 'B', 'Female', 1000, 'occupied'),
  ('CRV-24-A', 'CRV', 24, 'A', 'Male',   1000, 'occupied'),
  ('CRV-24-B', 'CRV', 24, 'B', 'Male',   1000, 'occupied'),
  ('CRV-25-A', 'CRV', 25, 'A', 'Female', 1000, 'occupied'),
  ('CRV-25-B', 'CRV', 25, 'B', 'Female', 1000, 'occupied'),
  ('CRV-26-A', 'CRV', 26, 'A', 'Male',   1000, 'occupied'),
  ('CRV-26-B', 'CRV', 26, 'B', 'Male',   1000, 'occupied')
on conflict (id) do nothing;

-- ─── Tenants (occupied beds only) ────────────────────────────────────────────

insert into public.tenants (bed_space_id, full_name, phone, email, nrc, move_in_date) values
  ('BBH-1-A',  'Adrian mulale',              '260977146630', 'adrian@boarder.ac.zm',      '-', '2026-06-30'),
  ('BBH-2-A',  'Wisdom Bwani',               '260776960320', 'wisdom@boarder.ac.zm',      '-', '2026-06-05'),
  ('BBH-2-B',  'Jackson Mwanza',             '260976625656', 'jackson@boarder.ac.zm',     '-', '2026-06-08'),
  ('BBH-3-A',  'Bright Muleya',              '260979313175', 'bright@boarder.ac.zm',      '-', '2026-06-18'),
  ('BBH-3-B',  'Mwila Kalusopa',             '260971842880', 'mwila@boarder.ac.zm',       '-', '2026-06-16'),
  ('BBH-4-A',  'Zick Phiri',                 '260977161706', 'zick@boarder.ac.zm',        '-', '2026-06-05'),
  ('BBH-4-B',  'Jairos Banda',               '260979482810', 'jairos@boarder.ac.zm',      '-', '2026-06-12'),
  ('BBH-5-A',  'David Banda',                '260972134512', 'david@boarder.ac.zm',       '-', '2026-06-10'),
  ('BBH-5-B',  'McDonald',                   '260978112233', 'mcdonald@boarder.ac.zm',    '-', '2026-06-01'),
  ('BBH-6-A',  'Nanga Obrien',               '260770838758', 'nanga@boarder.ac.zm',       '-', '2026-03-01'),
  ('BBH-6-B',  'Christopher Phiri',          '260973445566', 'christopher@boarder.ac.zm', '-', '2026-06-02'),
  ('BBH-7-A',  'Funny Muyamina',             '260975112244', 'funny@boarder.ac.zm',       '-', '2026-01-05'),
  ('BBH-7-B',  'Angela Katema',              '260976554433', 'angela@boarder.ac.zm',      '-', '2026-06-04'),
  ('BBH-8-A',  'Kangwa Kunda',               '260977889900', 'kangwa@boarder.ac.zm',      '-', '2026-06-05'),
  ('BBH-9-A',  'Felistus Mweemba',           '260764785030', 'felistus@boarder.ac.zm',    '-', '2026-06-01'),
  ('BBH-9-B',  'Chama Kampamba',             '260979112233', 'chama@boarder.ac.zm',       '-', '2026-06-15'),
  ('NWG-10-A', 'Ackim Siamafuko',            '260971223344', 'ackim@boarder.ac.zm',       '-', '2026-06-01'),
  ('NWG-10-B', 'Collins Mubanga',            '260972334455', 'collins@boarder.ac.zm',     '-', '2026-06-03'),
  ('NWG-11-A', 'Catherine Mphande',          '260973445566', 'catherine@boarder.ac.zm',   '-', '2026-06-02'),
  ('NWG-12-A', 'Joseph Chanda',              '260974556677', 'joseph@boarder.ac.zm',      '-', '2026-06-11'),
  ('NWG-12-B', 'Peter Lungu',                '260975667788', 'peter@boarder.ac.zm',       '-', '2026-06-14'),
  ('NWG-13-A', 'Mary Tembo',                 '260976778899', 'mary@boarder.ac.zm',        '-', '2026-06-07'),
  ('NWG-14-A', 'Kelvin Zulu',                '260977889900', 'kelvin@boarder.ac.zm',      '-', '2026-06-09'),
  ('NWG-14-B', 'Patrick Mwansa',             '260978990011', 'patrick@boarder.ac.zm',     '-', '2026-06-13'),
  ('ANX-15-A', 'Grace Bwalya',               '260979001122', 'grace@boarder.ac.zm',       '-', '2026-06-01'),
  ('ANX-15-B', 'Mercy Chilufya',             '260970112233', 'mercy@boarder.ac.zm',       '-', '2026-06-02'),
  ('ANX-16-A', 'Brian Kunda',                '260971223344', 'brian@boarder.ac.zm',       '-', '2026-06-15'),
  ('ANX-16-B', 'Emmanuel Phiri',             '260972334455', 'emmanuel@boarder.ac.zm',    '-', '2026-06-18'),
  ('ANX-17-A', 'Mutinta Hachambo',           '260973445566', 'mutinta@boarder.ac.zm',     '-', '2026-06-20'),
  ('ANX-18-A', 'Samuel Musonda',             '260974556677', 'samuel@boarder.ac.zm',      '-', '2026-06-04'),
  ('ANX-18-B', 'Isaac Zimba',                '260975667788', 'isaac@boarder.ac.zm',       '-', '2026-06-06'),
  ('ANX-19-A', 'Samantha Musako (Kakompe)',  '260977227794', 'samantha@boarder.ac.zm',    '-', '2026-06-26'),
  ('ANX-19-B', 'Chanda Lutashima',           '260977951894', 'chanda.student@gmail.com',  '-', '2026-06-07'),
  ('ANX-19-C', 'Josephine Nyirenda',         '260779841908', 'josephine@boarder.ac.zm',   '-', '2026-05-06'),
  ('CRV-20-A', 'Moses Mulenga',              '260976778899', 'moses@boarder.ac.zm',       '-', '2026-06-10'),
  ('CRV-20-B', 'Aaron Sakala',               '260977889900', 'aaron@boarder.ac.zm',       '-', '2026-06-12'),
  ('CRV-21-A', 'Naomi Banda',                '260978990011', 'naomi@boarder.ac.zm',       '-', '2026-06-01'),
  ('CRV-21-B', 'Ruth Chileshe',              '260979001122', 'ruth@boarder.ac.zm',        '-', '2026-06-03'),
  ('CRV-22-A', 'Andrew Kaunda',              '260970112233', 'andrew@boarder.ac.zm',      '-', '2026-06-08'),
  ('CRV-22-B', 'Simon Soko',                 '260971223344', 'simon@boarder.ac.zm',       '-', '2026-06-09'),
  ('CRV-23-A', 'Deborah Mbewe',              '260972334455', 'deborah@boarder.ac.zm',     '-', '2026-06-14'),
  ('CRV-23-B', 'Esther Mubanga',             '260973445566', 'esther@boarder.ac.zm',      '-', '2026-06-16'),
  ('CRV-24-A', 'James Nyoni',                '260974556677', 'james@boarder.ac.zm',       '-', '2026-06-02'),
  ('CRV-24-B', 'Frank Kasoma',               '260975667788', 'frank@boarder.ac.zm',       '-', '2026-06-05'),
  ('CRV-25-A', 'Chileshe Mwape',             '260976778899', 'chileshe@boarder.ac.zm',    '-', '2026-06-11'),
  ('CRV-25-B', 'Memory Kasonde',             '260977889900', 'memory@boarder.ac.zm',      '-', '2026-06-13'),
  ('CRV-26-A', 'Daniel Kalumba',             '260978990011', 'daniel@boarder.ac.zm',      '-', '2026-06-04'),
  ('CRV-26-B', 'Elijah Mumba',               '260979001122', 'elijah@boarder.ac.zm',      '-', '2026-06-06')
on conflict (bed_space_id) do nothing;

-- ─── Billing records ─────────────────────────────────────────────────────────
-- billing_status is recomputed by trigger; values below match seed snapshot.

insert into public.billing_records (
  billing_id, house_block, room_number, bed_space, room_gender,
  tenant_name, phone_number, entry_date, current_rent, target_month,
  accumulated_total, total_balance, days_past_due, billing_status
) values
  ('BBH-1-A',  'BBH', '1',  'A', 'Male',   'Adrian mulale',              '260977146630', '2026-06-30', 950,  'Jul', 950,  950,  0,  'Open Window'),
  ('BBH-2-A',  'BBH', '2',  'A', 'Male',   'Wisdom Bwani',               '260776960320', '2026-06-05', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-2-B',  'BBH', '2',  'B', 'Male',   'Jackson Mwanza',             '260976625656', '2026-06-08', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-3-A',  'BBH', '3',  'A', 'Male',   'Bright Muleya',              '260979313175', '2026-06-18', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-3-B',  'BBH', '3',  'B', 'Male',   'Mwila Kalusopa',             '260971842880', '2026-06-16', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-4-A',  'BBH', '4',  'A', 'Male',   'Zick Phiri',                 '260977161706', '2026-06-05', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-4-B',  'BBH', '4',  'B', 'Male',   'Jairos Banda',               '260979482810', '2026-06-12', 900,  'Jul', 900,  900,  3,  'Grace Period'),
  ('BBH-5-A',  'BBH', '5',  'A', 'Male',   'David Banda',                '260972134512', '2026-06-10', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-5-B',  'BBH', '5',  'B', 'Male',   'McDonald',                   '260978112233', '2026-06-01', 900,  'Jul', 900,  900,  4,  'Grace Period'),
  ('BBH-6-A',  'BBH', '6',  'A', 'Male',   'Nanga Obrien',               '260770838758', '2026-03-01', 900,  'Jun', 3600, 1800, 31, 'OVERDUE / UNPAID'),
  ('BBH-6-B',  'BBH', '6',  'B', 'Male',   'Christopher Phiri',          '260973445566', '2026-06-02', 900,  'Jul', 900,  900,  2,  'Grace Period'),
  ('BBH-7-A',  'BBH', '7',  'A', 'Female', 'Funny Muyamina',             '260975112244', '2026-01-05', 900,  'Jun', 5400, 1800, 35, 'OVERDUE / UNPAID'),
  ('BBH-7-B',  'BBH', '7',  'B', 'Female', 'Angela Katema',              '260976554433', '2026-06-04', 900,  'Jun', 900,  900,  12, 'OVERDUE / UNPAID'),
  ('BBH-7-C',  'BBH', '7',  'C', 'Female', 'Vacant',                     '-',            '-',         900,  '-',   0,    0,    0,  'Vacant'),
  ('BBH-8-A',  'BBH', '8',  'A', 'Male',   'Kangwa Kunda',               '260977889900', '2026-06-05', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-8-B',  'BBH', '8',  'B', 'Male',   'Vacant',                     '-',            '-',         850,  '-',   0,    0,    0,  'Vacant'),
  ('BBH-9-A',  'BBH', '9',  'A', 'Female', 'Felistus Mweemba',           '260764785030', '2026-06-01', 900,  'Jun', 900,  900,  10, 'OVERDUE / UNPAID'),
  ('BBH-9-B',  'BBH', '9',  'B', 'Female', 'Chama Kampamba',             '260979112233', '2026-06-15', 900,  'Jul', 900,  900,  0,  'Open Window'),
  ('BBH-9-C',  'BBH', '9',  'C', 'Female', 'Vacant',                     '-',            '-',         900,  '-',   0,    0,    0,  'Vacant'),
  ('NWG-10-A', 'NWG', '10', 'A', 'Male',   'Ackim Siamafuko',            '260971223344', '2026-06-01', 1100, 'Jul', 1100, 1100, 0,  'Open Window'),
  ('NWG-10-B', 'NWG', '10', 'B', 'Male',   'Collins Mubanga',            '260972334455', '2026-06-03', 1100, 'Jul', 1100, 1100, 5,  'Grace Period'),
  ('NWG-11-A', 'NWG', '11', 'A', 'Female', 'Catherine Mphande',          '260973445566', '2026-06-02', 1100, 'Jun', 1100, 1100, 14, 'OVERDUE / UNPAID'),
  ('NWG-11-B', 'NWG', '11', 'B', 'Female', 'Vacant',                     '-',            '-',         1100, '-',   0,    0,    0,  'Vacant'),
  ('NWG-12-A', 'NWG', '12', 'A', 'Male',   'Joseph Chanda',              '260974556677', '2026-06-11', 1050, 'Jul', 1050, 1050, 0,  'Open Window'),
  ('NWG-12-B', 'NWG', '12', 'B', 'Male',   'Peter Lungu',                '260975667788', '2026-06-14', 1050, 'Jul', 1050, 1050, 0,  'Open Window'),
  ('NWG-13-A', 'NWG', '13', 'A', 'Female', 'Mary Tembo',                 '260976778899', '2026-06-07', 1100, 'Jun', 1100, 1100, 8,  'OVERDUE / UNPAID'),
  ('NWG-13-B', 'NWG', '13', 'B', 'Female', 'Vacant',                     '-',            '-',         1100, '-',   0,    0,    0,  'Vacant'),
  ('NWG-14-A', 'NWG', '14', 'A', 'Male',   'Kelvin Zulu',                '260977889900', '2026-06-09', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('NWG-14-B', 'NWG', '14', 'B', 'Male',   'Patrick Mwansa',             '260978990011', '2026-06-13', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('ANX-15-A', 'ANX', '15', 'A', 'Female', 'Grace Bwalya',               '260979001122', '2026-06-01', 1200, 'Jul', 1200, 0,    0,  'Paid / Secured'),
  ('ANX-15-B', 'ANX', '15', 'B', 'Female', 'Mercy Chilufya',             '260970112233', '2026-06-02', 1200, 'Jul', 1200, 0,    0,  'Paid / Secured'),
  ('ANX-16-A', 'ANX', '16', 'A', 'Male',   'Brian Kunda',                '260971223344', '2026-06-15', 1150, 'Jul', 1150, 0,    0,  'Paid / Secured'),
  ('ANX-16-B', 'ANX', '16', 'B', 'Male',   'Emmanuel Phiri',             '260972334455', '2026-06-18', 1150, 'Jul', 1150, 0,    0,  'Paid / Secured'),
  ('ANX-17-A', 'ANX', '17', 'A', 'Female', 'Mutinta Hachambo',           '260973445566', '2026-06-20', 1200, 'Jul', 1200, 1200, 0,  'Open Window'),
  ('ANX-17-B', 'ANX', '17', 'B', 'Female', 'Vacant',                     '-',            '-',         1150, '-',   0,    0,    0,  'Vacant'),
  ('ANX-18-A', 'ANX', '18', 'A', 'Male',   'Samuel Musonda',             '260974556677', '2026-06-04', 1200, 'Jul', 1200, 0,    0,  'Paid / Secured'),
  ('ANX-18-B', 'ANX', '18', 'B', 'Male',   'Isaac Zimba',                '260975667788', '2026-06-06', 1200, 'Jul', 1200, 0,    0,  'Paid / Secured'),
  ('ANX-19-A', 'ANX', '19', 'A', 'Female', 'Samantha Musako (Kakompe)',  '260977227794', '2026-06-26', 1200, 'Jul', 1200, 1200, 0,  'Open Window'),
  ('ANX-19-B', 'ANX', '19', 'B', 'Female', 'Chanda Lutashima',           '260977951894', '2026-06-07', 1200, 'Jul', 1200, 0,    0,  'Paid / Secured'),
  ('ANX-19-C', 'ANX', '19', 'C', 'Female', 'Josephine Nyirenda',         '260779841908', '2026-05-06', 1200, 'Jun', 2400, 1200, 20, 'OVERDUE / UNPAID'),
  ('CRV-20-A', 'CRV', '20', 'A', 'Male',   'Moses Mulenga',              '260976778899', '2026-06-10', 1000, 'Jul', 1000, 0,    0,  'Paid / Secured'),
  ('CRV-20-B', 'CRV', '20', 'B', 'Male',   'Aaron Sakala',               '260977889900', '2026-06-12', 1000, 'Jul', 1000, 0,    0,  'Paid / Secured'),
  ('CRV-21-A', 'CRV', '21', 'A', 'Female', 'Naomi Banda',                '260978990011', '2026-06-01', 1000, 'Jul', 1000, 0,    0,  'Paid / Secured'),
  ('CRV-21-B', 'CRV', '21', 'B', 'Female', 'Ruth Chileshe',              '260979001122', '2026-06-03', 1000, 'Jul', 1000, 0,    0,  'Paid / Secured'),
  ('CRV-22-A', 'CRV', '22', 'A', 'Male',   'Andrew Kaunda',              '260970112233', '2026-06-08', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-22-B', 'CRV', '22', 'B', 'Male',   'Simon Soko',                 '260971223344', '2026-06-09', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-23-A', 'CRV', '23', 'A', 'Female', 'Deborah Mbewe',              '260972334455', '2026-06-14', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-23-B', 'CRV', '23', 'B', 'Female', 'Esther Mubanga',             '260973445566', '2026-06-16', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-24-A', 'CRV', '24', 'A', 'Male',   'James Nyoni',                '260974556677', '2026-06-02', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-24-B', 'CRV', '24', 'B', 'Male',   'Frank Kasoma',               '260975667788', '2026-06-05', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-25-A', 'CRV', '25', 'A', 'Female', 'Chileshe Mwape',             '260976778899', '2026-06-11', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-25-B', 'CRV', '25', 'B', 'Female', 'Memory Kasonde',             '260977889900', '2026-06-13', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-26-A', 'CRV', '26', 'A', 'Male',   'Daniel Kalumba',             '260978990011', '2026-06-04', 1000, 'Jul', 1000, 1000, 0,  'Open Window'),
  ('CRV-26-B', 'CRV', '26', 'B', 'Male',   'Elijah Mumba',               '260979001122', '2026-06-06', 1000, 'Jul', 1000, 1000, 0,  'Open Window')
on conflict (billing_id) do nothing;

-- ─── Payments ────────────────────────────────────────────────────────────────
-- Insert verified payments first with status pending, then update to verified
-- so the apply_verified_payment trigger does not double-deduct seeded balances.

insert into public.payments (id, student_name, bed_space_id, amount, method, transaction_ref, submitted_at, status, rejection_reason) values
  ('p1',  'Grace Bwalya',    'ANX-15-A', 1200, 'Airtel', 'TXN-AIRTL-8842', '2026-07-02', 'pending', null),
  ('p2',  'Mercy Chilufya',  'ANX-15-B', 1200, 'MTN',    'TXN-MTN-2291',   '2026-07-03', 'pending', null),
  ('p3',  'Brian Kunda',     'ANX-16-A', 1150, 'Airtel', 'TXN-AIRTL-5571', '2026-07-01', 'pending', null),
  ('p4',  'Emmanuel Phiri',  'ANX-16-B', 1150, 'MTN',    'TXN-MTN-4412',   '2026-07-04', 'pending', null),
  ('p5',  'Moses Mulenga',   'CRV-20-A', 1000, 'Airtel', 'TXN-AIRTL-0093', '2026-07-02', 'pending', null),
  ('p6',  'Aaron Sakala',    'CRV-20-B', 1000, 'MTN',    'TXN-MTN-7731',   '2026-07-03', 'pending', null),
  ('p7',  'Naomi Banda',     'CRV-21-A', 1000, 'Airtel', 'TXN-AIRTL-3348', '2026-07-01', 'pending', null),
  ('p8',  'Ruth Chileshe',   'CRV-21-B', 1000, 'MTN',    'TXN-MTN-9921',   '2026-07-01', 'pending', null),
  ('p9',  'Samuel Musonda',  'ANX-18-A', 1200, 'Airtel', 'TXN-AIRTL-1120', '2026-07-02', 'pending', null),
  ('p10', 'Isaac Zimba',     'ANX-18-B', 1200, 'MTN',    'TXN-MTN-3340',   '2026-07-03', 'pending', null),
  ('p11', 'Wisdom Bwani',    'BBH-2-A',  900,  'Airtel', 'TXN-AIRTL-6614', '2026-07-05', 'pending', null),
  ('p12', 'Ackim Siamafuko', 'NWG-10-A', 1100, 'MTN',    'TXN-MTN-1123',   '2026-07-06', 'pending', null),
  ('p13', 'Adrian mulale',   'BBH-1-A',  950,  'Airtel', 'TXN-AIRTL-7782', '2026-07-07', 'pending', null),
  ('p14', 'Nanga Obrien',    'BBH-6-A',  900,  'MTN',    'TXN-MTN-4456',   '2026-07-10', 'rejected', 'Reference code does not match transaction records.'),
  ('p15', 'Kelvin Zulu',     'NWG-14-A', 1000, 'Airtel', 'TXN-AIRTL-5501', '2026-07-08', 'pending', null),
  ('p16', 'Andrew Kaunda',   'CRV-22-A', 1000, 'MTN',    'TXN-MTN-6612',   '2026-07-09', 'pending', null)
on conflict (id) do nothing;

-- Mark already-settled seed payments as verified WITHOUT firing balance deduction
-- by temporarily disabling the trigger.

alter table public.payments disable trigger trg_payment_verified;

update public.payments
set status = 'verified'
where id in ('p1','p2','p3','p4','p5','p6','p7','p8','p9','p10');

alter table public.payments enable trigger trg_payment_verified;

-- ─── Maintenance issues ──────────────────────────────────────────────────────

insert into public.maintenance_issues (id, bed_space_id, student_name, category, description, reported_date, status, resolution_note, image_url) values
  ('i1', 'BBH-2-A',  'Wisdom Bwani',     'Plumbing',   'Bathroom tap dripping continuously, water pooling on floor overnight.', '2026-07-01', 'in_progress', null, 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&h=400&fit=crop&auto=format'),
  ('i2', 'NWG-12-A', 'Joseph Chanda',    'Electrical', 'Wall socket sparking when phone charger is inserted. Visible scorch marks.', '2026-07-03', 'open', null, 'https://images.unsplash.com/photo-1621905251918-49bfe0bbf6e7?w=600&h=400&fit=crop&auto=format'),
  ('i3', 'ANX-17-A', 'Mutinta Hachambo', 'Structural', 'Crack in external wall near window frame, visibly widening over the past two weeks.', '2026-06-28', 'open', null, 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=600&h=400&fit=crop&auto=format'),
  ('i4', 'CRV-22-A', 'Andrew Kaunda',    'Appliance',  'Ceiling fan grinding noise and wobbling — unsafe to operate at any speed.', '2026-07-05', 'resolved', 'Fan motor replaced and blades rebalanced on 2026-07-07.', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&h=400&fit=crop&auto=format'),
  ('i5', 'BBH-3-A',  'Bright Muleya',    'Plumbing',   'Blocked drain in bathroom sink — water backing up completely.', '2026-07-08', 'open', null, 'https://images.unsplash.com/photo-1504195214-d6aa7e8ead8e?w=600&h=400&fit=crop&auto=format'),
  ('i6', 'NWG-14-A', 'Kelvin Zulu',      'Electrical', 'Main room ceiling light flickering intermittently. Bulb replaced but persists.', '2026-07-06', 'in_progress', null, 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=600&h=400&fit=crop&auto=format')
on conflict (id) do nothing;

-- ─── Utility entries (July 2026) ──────────────────────────────────────────────

insert into public.utility_entries (block_code, month, total_cost, active_students, owner_contribution, excess, students_settled) values
  ('BBH', 'July 2026', 1240, 16, 490, 750,  array['Wisdom Bwani', 'Jackson Mwanza']),
  ('NWG', 'July 2026', 1680, 9,  560, 1120, array['Ackim Siamafuko', 'Joseph Chanda', 'Kelvin Zulu']),
  ('ANX', 'July 2026', 1440, 9,  630, 810,  array['Grace Bwalya', 'Brian Kunda', 'Samuel Musonda']),
  ('CRV', 'July 2026', 980,  14, 490, 490,  array['Moses Mulenga', 'Aaron Sakala', 'Naomi Banda', 'Andrew Kaunda'])
on conflict (block_code, month) do nothing;

