import test from 'node:test';
import assert from 'node:assert/strict';

const { deriveStudentAccounts, matchesStudentSearch, bedLabel } =
  await import('../src/lib/students.ts');
const { isBedAssignable, auditOccupancyLocal } = await import('../src/lib/occupancy.ts');

function student(id, name, email) {
  return { id, name, email, phone: '0970000000', nrc: '123456/78/9', moveInDate: '2026-02-01' };
}

const BEDS = [
  { id: 'BBH-1A', blockCode: 'BBH', roomNumber: 1, bedLetter: 'A', identifier: 'BBH-1A', status: 'occupied', rentAmount: 900, student: student('t1', 'Ada Lovelace', 'ada@example.com') },
  { id: 'BBH-1B', blockCode: 'BBH', roomNumber: 1, bedLetter: 'B', identifier: 'BBH-1B', status: 'vacant', rentAmount: 900 },
];

const BILLING = [
  { billing_id: 'BBH-1A', house_block: 'BBH', room_number: '1', bed_space: 'A', room_gender: 'Female', tenant_name: 'Ada Lovelace', phone_number: '0970000000', entry_date: '2026-02-01', current_rent: 900, target_month: 'Aug', accumulated_total: 900, total_balance: 900, days_past_due: 0, billing_status: 'Open Window' },
  { billing_id: 'BBH-1B', house_block: 'BBH', room_number: '1', bed_space: 'B', room_gender: 'Female', tenant_name: 'Vacant', phone_number: '-', entry_date: '-', current_rent: 900, target_month: '-', accumulated_total: 0, total_balance: 0, days_past_due: 0, billing_status: 'Vacant' },
];

test('only beds with a tenant become student rows', () => {
  const rows = deriveStudentAccounts(BEDS, BILLING);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 't1');
  assert.equal(rows[0].tenant_status, 'active');
  assert.equal(rows[0].bed_space_id, 'BBH-1A');
  assert.equal(rows[0].total_balance, 900);
  assert.equal(rows[0].billing_status, 'Open Window');
});

test('a bed freed by a soft delete is assignable again', () => {
  const billingByBed = new Map(BILLING.map((r) => [r.billing_id, r]));

  // While the tenant is active the bed is held.
  assert.equal(isBedAssignable(BEDS[0], billingByBed.get('BBH-1A')), false);

  // Eviction drops the tenant from the bed and resets billing; the bed frees up.
  const freed = { ...BEDS[0], status: 'vacant', student: undefined };
  const freedBilling = { ...billingByBed.get('BBH-1A'), tenant_name: 'Vacant', total_balance: 0, accumulated_total: 0, target_month: '-', billing_status: 'Vacant' };

  assert.equal(isBedAssignable(freed, freedBilling), true);
  assert.equal(deriveStudentAccounts([freed], [freedBilling]).length, 0);
});

test('an evicted student no longer counts as an occupancy conflict', () => {
  const freed = { ...BEDS[0], status: 'vacant', student: undefined };
  const freedBilling = { ...BILLING[0], tenant_name: 'Vacant', total_balance: 0, accumulated_total: 0, target_month: '-', billing_status: 'Vacant' };

  const issues = auditOccupancyLocal([freed, BEDS[1]], [freedBilling, BILLING[1]]);
  assert.deepEqual(issues, []);
});

test('search matches name, email, phone, NRC and bed label', () => {
  const [row] = deriveStudentAccounts(BEDS, BILLING);

  assert.equal(bedLabel(row), 'BBH 1A');
  for (const term of ['ada', 'ADA LOVELACE', 'example.com', '0970', '123456', 'BBH 1A', 'bbh-1a', '']) {
    assert.equal(matchesStudentSearch(row, term), true, `expected "${term}" to match`);
  }
  assert.equal(matchesStudentSearch(row, 'zzz'), false);
});
