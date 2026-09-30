-- Instant Firebase → Supabase updates for occupancy, billing, and applications.
-- Landlord / student notification tables were added to the publication earlier.

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'bed_spaces',
      'tenants',
      'billing_records',
      'payments',
      'maintenance_issues',
      'utility_entries',
      'student_notifications'
    ]
    loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception
        when duplicate_object then
          null;
      end;
    end loop;
  end if;
end $$;
