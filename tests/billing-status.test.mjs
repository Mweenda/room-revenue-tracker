import test from 'node:test';
import assert from 'node:assert/strict';

const {
  GRACE_PERIOD_DAYS,
  computeBillingStatus,
  getDaysPastDue,
  isOverdueAfterGrace,
  BILLING_STATUS_OVERVIEW,
} = await import('../src/lib/billing.ts');

test('grace period is five days', () => {
  assert.equal(GRACE_PERIOD_DAYS, 5);
});

test('students are not overdue until the grace period has elapsed', () => {
  assert.equal(computeBillingStatus('Ada', 900, 900, 0, 'Sep', 'Sep'), 'Open Window');
  assert.equal(computeBillingStatus('Ada', 900, 900, 1, 'Sep', 'Sep'), 'Grace Period');
  assert.equal(computeBillingStatus('Ada', 900, 900, 5, 'Sep', 'Sep'), 'Grace Period');
  assert.equal(computeBillingStatus('Ada', 900, 900, 6, 'Sep', 'Sep'), 'OVERDUE / UNPAID');
  assert.equal(isOverdueAfterGrace(5, 900), false);
  assert.equal(isOverdueAfterGrace(6, 900), true);
});

test('a prior cycle month is not treated as overdue on day zero', () => {
  assert.equal(computeBillingStatus('Ada', 900, 900, 0, 'Mar', 'Sep'), 'Open Window');
  assert.equal(computeBillingStatus('Ada', 900, 900, 0, 'Jun', 'Sep'), 'Open Window');
  assert.equal(computeBillingStatus('Ada', 900, 900, 6, 'Mar', 'Sep'), 'OVERDUE / UNPAID');
});

test('a settled balance is never overdue', () => {
  assert.equal(computeBillingStatus('Ada', 0, 900, 40, 'Sep', 'Sep'), 'Paid / Secured');
  assert.equal(isOverdueAfterGrace(40, 0), false);
});

test('days past due is counted from the first of the target month', () => {
  const due = getDaysPastDue('Jan', 2026, new Date('2026-01-06T12:00:00Z'));
  assert.equal(due, 5);
  const sameDay = getDaysPastDue('Jan', 2026, new Date('2026-01-01T12:00:00Z'));
  assert.equal(sameDay, 0);
});

test('each billing status has a short landlord overview', () => {
  assert.match(BILLING_STATUS_OVERVIEW['Open Window'], /payment window/i);
  assert.match(BILLING_STATUS_OVERVIEW['Paid / Secured'], /settled/i);
  assert.match(BILLING_STATUS_OVERVIEW['OVERDUE / UNPAID'], /grace/i);
  assert.match(BILLING_STATUS_OVERVIEW.Vacant, /empty/i);
  assert.match(BILLING_STATUS_OVERVIEW['Grace Period'], /5-day/i);
});
