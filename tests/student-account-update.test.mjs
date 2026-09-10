import test from 'node:test';
import assert from 'node:assert/strict';

const { applyStudentAccountUpdate, applyManualVerifiedPayment, deriveStudentAccounts } =
  await import('../src/lib/students.ts');

function student(id, name, email) {
  return { id, name, email, phone: '0970000000', nrc: '123456/78/9', moveInDate: '2026-02-01' };
}

const BEDS = [
  { id: 'BBH-1-A', blockCode: 'BBH', roomNumber: 1, bedLetter: 'A', identifier: 'BBH-1-A', status: 'occupied', rentAmount: 900, roomGender: 'Female', student: student('t1', 'Ada Lovelace', 'ada@example.com') },
  { id: 'BBH-1-B', blockCode: 'BBH', roomNumber: 1, bedLetter: 'B', identifier: 'BBH-1-B', status: 'vacant', rentAmount: 850, roomGender: 'Female' },
];

const BILLING = [
  { billing_id: 'BBH-1-A', house_block: 'BBH', room_number: '1', bed_space: 'A', room_gender: 'Female', tenant_name: 'Ada Lovelace', phone_number: '0970000000', entry_date: '2026-02-01', current_rent: 900, target_month: 'Aug', accumulated_total: 1800, total_balance: 450, days_past_due: 12, billing_status: 'OVERDUE / UNPAID' },
  { billing_id: 'BBH-1-B', house_block: 'BBH', room_number: '1', bed_space: 'B', room_gender: 'Female', tenant_name: 'Vacant', phone_number: '-', entry_date: '-', current_rent: 850, target_month: '-', accumulated_total: 0, total_balance: 0, days_past_due: 0, billing_status: 'Vacant' },
];

test('editing contact details and rent keeps the student on the same bed', () => {
  const next = applyStudentAccountUpdate(BEDS, BILLING, {
    tenantId: 't1',
    name: 'Ada L.',
    phone: '0971111111',
    email: 'ada.l@example.com',
    nrc: '111111/11/1',
    moveInDate: '2026-02-01',
    bedSpaceId: 'BBH-1-A',
    rentAmount: 1000,
  });

  const [row] = deriveStudentAccounts(next.beds, next.billingRecords);
  assert.equal(row.full_name, 'Ada L.');
  assert.equal(row.email, 'ada.l@example.com');
  assert.equal(row.phone, '0971111111');
  assert.equal(row.bed_space_id, 'BBH-1-A');
  assert.equal(row.rent_amount, 1000);
  assert.equal(row.total_balance, 450);
});

test('moving a student carries outstanding balance onto the new bed', () => {
  const next = applyStudentAccountUpdate(BEDS, BILLING, {
    tenantId: 't1',
    name: 'Ada Lovelace',
    phone: '0970000000',
    email: 'ada@example.com',
    moveInDate: '2026-02-01',
    bedSpaceId: 'BBH-1-B',
    rentAmount: 850,
  });

  const oldBed = next.beds.find((bed) => bed.id === 'BBH-1-A');
  const newBed = next.beds.find((bed) => bed.id === 'BBH-1-B');
  assert.equal(oldBed?.status, 'vacant');
  assert.equal(oldBed?.student, undefined);
  assert.equal(newBed?.status, 'occupied');
  assert.equal(newBed?.student?.id, 't1');

  const oldBilling = next.billingRecords.find((record) => record.billing_id === 'BBH-1-A');
  const newBilling = next.billingRecords.find((record) => record.billing_id === 'BBH-1-B');
  assert.equal(oldBilling?.billing_status, 'Vacant');
  assert.equal(oldBilling?.total_balance, 0);
  assert.equal(newBilling?.tenant_name, 'Ada Lovelace');
  assert.equal(newBilling?.total_balance, 450);
  assert.equal(newBilling?.current_rent, 850);
});

test('cannot move onto a bed that already has a tenant', () => {
  const occupied = [
    BEDS[0],
    { ...BEDS[1], status: 'occupied', student: student('t2', 'Grace Hopper', 'grace@example.com') },
  ];
  assert.throws(
    () => applyStudentAccountUpdate(occupied, BILLING, {
      tenantId: 't1',
      name: 'Ada Lovelace',
      phone: '0970000000',
      email: 'ada@example.com',
      moveInDate: '2026-02-01',
      bedSpaceId: 'BBH-1-B',
      rentAmount: 850,
    }),
    /already occupied/,
  );
});

test('cannot move a student onto a bed of the opposite gender', () => {
  const mixed = [
    BEDS[0],
    { ...BEDS[1], roomGender: 'Male' },
  ];
  assert.throws(
    () => applyStudentAccountUpdate(mixed, BILLING, {
      tenantId: 't1',
      name: 'Ada Lovelace',
      phone: '0970000000',
      email: 'ada@example.com',
      moveInDate: '2026-02-01',
      bedSpaceId: 'BBH-1-B',
      rentAmount: 850,
      gender: 'Female',
    }),
    /match the bed space/,
  );
});

test('cannot reuse another active student phone', () => {
  const occupied = [
    BEDS[0],
    { ...BEDS[1], status: 'occupied', student: student('t2', 'Grace Hopper', 'grace@example.com') },
  ];
  occupied[1].student.phone = '0971111111';
  assert.throws(
    () => applyStudentAccountUpdate(occupied, BILLING, {
      tenantId: 't1',
      name: 'Ada Lovelace',
      phone: '0971111111',
      email: 'ada@example.com',
      moveInDate: '2026-02-01',
      bedSpaceId: 'BBH-1-A',
      rentAmount: 900,
    }),
    /already assigned/,
  );
});

test('a landlord cash receipt applies to the billing ledger', () => {
  const paid = applyManualVerifiedPayment(BILLING, [], {
    bedSpaceId: 'BBH-1-A',
    studentName: 'Ada Lovelace',
    payment: { amount: 450, submittedAt: '2026-09-07', method: 'Cash', transactionRef: 'RCPT-1' },
  });
  const billing = paid.billingRecords.find((row) => row.billing_id === 'BBH-1-A');
  assert.equal(billing?.total_balance, 0);
  assert.equal(paid.payments[0].status, 'verified');
  assert.equal(paid.payments[0].method, 'Cash');
  assert.equal(paid.payments[0].amount, 450);
});

test('editing billing status to paid clears the outstanding balance', () => {
  const next = applyStudentAccountUpdate(BEDS, BILLING, {
    tenantId: 't1',
    name: 'Ada Lovelace',
    phone: '0970000000',
    email: 'ada@example.com',
    moveInDate: '2026-02-01',
    bedSpaceId: 'BBH-1-A',
    rentAmount: 900,
    billingStatus: 'Paid / Secured',
  });
  const billing = next.billingRecords.find((record) => record.billing_id === 'BBH-1-A');
  assert.equal(billing?.billing_status, 'Paid / Secured');
  assert.equal(billing?.total_balance, 0);
});
