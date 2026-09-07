import test from 'node:test';
import assert from 'node:assert/strict';

const {
  rentDueDateIso,
  calendarDueEvents,
  daysPastDueFromCalendar,
} = await import('../src/lib/rentDue.ts');

test('rent is due on the first of the billing month', () => {
  assert.equal(rentDueDateIso('Sep', 2026), '2026-09-01');
  assert.equal(rentDueDateIso('-', 2026), null);
});

test('calendar events mark due, grace and overdue from the same due date', () => {
  const today = new Date('2026-09-07T08:00:00Z');
  const records = [
    { billing_id: 'BBH-1-A', tenant_name: 'Ada', target_month: 'Sep', total_balance: 900, billing_status: 'Grace Period', days_past_due: 6, room_gender: 'Female' },
    { billing_id: 'BBH-2-A', tenant_name: 'Ben', target_month: 'Sep', total_balance: 0, billing_status: 'Paid / Secured', days_past_due: 6, room_gender: 'Male' },
  ];
  const events = calendarDueEvents(records, 2026, today);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, '2026-09-01');
  assert.equal(events[0].kind, 'overdue');
  assert.equal(events[0].daysPastDue, 6);
});

test('calendar days past due matches billing days past due', () => {
  const today = new Date('2026-09-07T08:00:00Z');
  assert.equal(daysPastDueFromCalendar('Sep', 2026, today), 6);
});
