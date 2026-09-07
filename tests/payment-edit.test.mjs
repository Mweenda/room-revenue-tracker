import test from 'node:test';
import assert from 'node:assert/strict';

const { applyPaymentEdit, lastVerifiedPayment } = await import('../src/lib/paymentsEdit.ts');
const { enrichStudentAccounts, deriveStudentAccounts } = await import('../src/lib/students.ts');

const payments = [
  { id: 'p1', studentName: 'Ada Lovelace', bedSpaceId: 'BBH-1-A', amount: 400, method: 'Airtel', transactionRef: 'old', submittedAt: '2026-08-01', status: 'verified' },
  { id: 'p2', studentName: 'Ada Lovelace', bedSpaceId: 'BBH-1-A', amount: 900, method: 'MTN', transactionRef: 'NEW', submittedAt: '2026-09-02', status: 'pending' },
  { id: 'p3', studentName: 'Ada Lovelace', bedSpaceId: 'BBH-1-A', amount: 500, method: 'Airtel', transactionRef: 'mid', submittedAt: '2026-09-01', status: 'verified' },
];

test('landlords can manually edit a payment record', () => {
  const next = applyPaymentEdit(payments[1], {
    amount: 950,
    method: 'Airtel',
    transactionRef: 'AIR-9',
    submittedAt: '2026-09-03',
    studentName: 'Ada Lovelace',
    bedSpaceId: 'BBH-1-A',
  });
  assert.equal(next.amount, 950);
  assert.equal(next.method, 'Airtel');
  assert.equal(next.transactionRef, 'AIR-9');
  assert.equal(next.submittedAt, '2026-09-03');
  assert.equal(next.status, 'pending');
});

test('payment edits reject empty refs and non-positive amounts', () => {
  assert.throws(() => applyPaymentEdit(payments[1], { amount: 0, method: 'MTN', transactionRef: 'x', submittedAt: '2026-09-02', studentName: 'Ada', bedSpaceId: 'BBH-1-A' }), /greater than zero/i);
  assert.throws(() => applyPaymentEdit(payments[1], { amount: 10, method: 'MTN', transactionRef: '  ', submittedAt: '2026-09-02', studentName: 'Ada', bedSpaceId: 'BBH-1-A' }), /reference/i);
});

test('last verified payment is the most recent successful one', () => {
  const last = lastVerifiedPayment(payments, 'BBH-1-A', 'Ada Lovelace');
  assert.equal(last?.id, 'p3');
  assert.equal(last?.amount, 500);
  assert.equal(last?.submittedAt, '2026-09-01');
});

test('student rows expose days past due, last payment and gender', () => {
  const beds = [{
    id: 'BBH-1-A', blockCode: 'BBH', roomNumber: 1, bedLetter: 'A', identifier: 'BBH-1-A',
    status: 'occupied', rentAmount: 900, roomGender: 'Female',
    student: { id: 't1', name: 'Ada Lovelace', phone: '0977', nrc: '1', email: 'ada@x.com', moveInDate: '2026-02-01', gender: 'Female' },
  }];
  const billing = [{
    billing_id: 'BBH-1-A', house_block: 'BBH', room_number: '1', bed_space: 'A', room_gender: 'Female',
    tenant_name: 'Ada Lovelace', phone_number: '0977', entry_date: '2026-02-01', current_rent: 900,
    target_month: 'Sep', accumulated_total: 900, total_balance: 900, days_past_due: 6, billing_status: 'OVERDUE / UNPAID',
  }];
  const [row] = enrichStudentAccounts(deriveStudentAccounts(beds, billing), payments, billing, 2026);
  assert.equal(row.gender, 'Female');
  assert.equal(row.days_past_due, 6);
  assert.equal(row.last_payment_at, '2026-09-01');
  assert.equal(row.last_payment_amount, 500);
  assert.equal(row.due_date, '2026-09-01');
});
