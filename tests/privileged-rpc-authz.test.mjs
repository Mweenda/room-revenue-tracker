import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { monthsToCharge } = await import('../src/lib/paymentTracking.ts');

const migration = readFileSync(
  resolve('supabase/migrations/021_lock_down_billing_and_onboarding_rpcs.sql'),
  'utf8',
);

test('a forged current month can wrap and charge 11 extra months on the ledger math', () => {
  // Sep already billed → attacker sets "current" to Aug via roll_billing_cycle(p_as_of).
  assert.equal(monthsToCharge('Sep', 'Aug', 900, 900), 11);
  assert.equal(monthsToCharge('Sep', 'Sep', 900, 900), 0);
});

test('roll_billing_cycle requires a landlord and ignores the client date', () => {
  assert.match(migration, /perform public\.assert_landlord\('roll billing'\)/);
  assert.match(migration, /p_as_of is accepted for signature stability and ignored/);
  assert.match(migration, /v_as_of date := \(timezone\('Africa\/Lusaka', now\(\)\)\)::date/);
  assert.match(migration, /where b\.landlord_id = v_landlord/);
  assert.doesNotMatch(
    migration,
    /v_month text := public\.current_billing_month\(p_as_of\)/,
  );
});

test('sync_billing_due_dates cannot rewrite another landlord ledger', () => {
  assert.match(migration, /perform public\.assert_landlord\('sync billing due dates'\)/);
  assert.match(migration, /b\.landlord_id = v_landlord/);
});

test('cash receipts must target a bed the landlord owns', () => {
  assert.match(migration, /not public\.landlord_owns_bed\(p_bed_space_id\)/);
  assert.match(migration, /create or replace function public\.record_manual_payment/);
});

test('students cannot mint invites for another landlord', () => {
  assert.match(migration, /if public\.is_landlord\(\) then/);
  assert.match(migration, /v_landlord := public\.current_landlord_id\(\)/);
  assert.match(migration, /Landlord access required to create a student invite/);
  assert.match(migration, /elsif auth\.uid\(\) is null then/);
});

test('complete_student_onboarding binds a landlord and blocks spent-invite bed moves', () => {
  assert.match(migration, /expires_at > timezone\('utc', now\(\)\)/);
  assert.match(migration, /Students cannot reassign their bed space/);
  assert.match(migration, /if v_landlord is null then/);
  assert.match(migration, /bl\.code = v_bed\.block_code and bl\.landlord_id = v_landlord/);
});
