import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFinancialReport } = await import('../src/lib/export/financialWorkbook.ts');
const { getCurrentBillingMonth, getCurrentYear } = await import('../src/lib/billing.ts');

const MONTH = getCurrentBillingMonth();
const YEAR = getCurrentYear();

function record(overrides) {
  return {
    billing_id: 'BBH-1A',
    house_block: 'BBH',
    room_number: '1',
    bed_space: 'A',
    room_gender: 'Male',
    tenant_name: 'Ada',
    phone_number: '0970000000',
    entry_date: '2026-01-15',
    current_rent: 900,
    target_month: MONTH,
    accumulated_total: 900,
    total_balance: 900,
    days_past_due: 0,
    billing_status: 'Open Window',
    ...overrides,
  };
}

const BILLING = [
  record({}),
  record({ billing_id: 'BBH-1B', bed_space: 'B', tenant_name: 'Ben', total_balance: 0, billing_status: 'Paid / Secured' }),
  record({
    billing_id: 'NWG-2A', house_block: 'NWG', room_number: '2', tenant_name: 'Vacant',
    phone_number: '-', entry_date: '-', target_month: '-',
    accumulated_total: 0, total_balance: 0, billing_status: 'Vacant',
  }),
];

const BEDS = BILLING.map((r) => ({
  id: r.billing_id, blockCode: r.house_block, roomNumber: Number(r.room_number),
  bedLetter: r.bed_space, identifier: r.billing_id,
  status: r.billing_status === 'Vacant' ? 'vacant' : 'occupied', rentAmount: r.current_rent,
}));

const PAYMENTS = [
  { id: 'p1', studentName: 'Ada', bedSpaceId: 'BBH-1A', amount: 900, method: 'Airtel', transactionRef: 'A1', submittedAt: '2026-08-02', status: 'verified' },
  { id: 'p2', studentName: 'Ben', bedSpaceId: 'BBH-1B', amount: 450, method: 'MTN', transactionRef: 'B1', submittedAt: '2026-08-03', status: 'pending' },
  { id: 'p3', studentName: 'Ben', bedSpaceId: 'BBH-1B', amount: 100, method: 'MTN', transactionRef: 'B2', submittedAt: '2026-08-04', status: 'rejected' },
];

const UTILITIES = [
  { blockCode: 'BBH', month: MONTH, totalCost: 500, activeStudents: 2, ownerContribution: 140, excess: 360, studentsSettled: ['Ada'] },
  { blockCode: 'NWG', month: 'Jan', totalCost: 800, activeStudents: 4, ownerContribution: 280, excess: 520, studentsSettled: [] },
];

function build() {
  return buildFinancialReport({
    billingRecords: BILLING, beds: BEDS, payments: PAYMENTS, utilities: UTILITIES, month: MONTH, year: YEAR,
  });
}

test('report exposes the four expected sheets', () => {
  assert.deepEqual(build().sheets.map((s) => s.name), ['Summary', 'Billing Roster', 'Payments', 'Utilities']);
});

test('summary derives occupancy and collection from occupied beds only', () => {
  const { summary } = build();

  assert.equal(summary.totalBeds, 3);
  assert.equal(summary.occupiedBeds, 2);
  assert.equal(summary.vacantBeds, 1);
  assert.equal(summary.occupancyRate, 66.67);

  // Expected counts only the two occupied beds; the vacant bed contributes nothing.
  assert.equal(summary.expectedRevenue, 1800);
  assert.equal(summary.outstandingRevenue, 900);
  assert.equal(summary.collectedRevenue, 900);
  assert.equal(summary.collectionRate, 50);
});

test('payment totals split verified from pending and drop rejected rows', () => {
  const report = build();
  const payments = report.sheets.find((s) => s.name === 'Payments');

  assert.equal(report.summary.verifiedPayments, 900);
  assert.equal(report.summary.pendingPayments, 450);
  assert.equal(payments.rows.length, 2, 'rejected payments are excluded');
  assert.equal(payments.totals.at(-1), 1350);
});

test('billing roster includes every bed and totals the money columns', () => {
  const roster = build().sheets.find((s) => s.name === 'Billing Roster');

  assert.equal(roster.rows.length, 3);
  assert.equal(roster.columns.length, roster.totals.length);
  assert.equal(roster.totals[0], 'Totals');
  // Rent column totals all three beds; outstanding only the unpaid one.
  assert.equal(roster.totals[7], 2700);
  assert.equal(roster.totals[9], 900);
});

test('utilities sheet is scoped to the selected month', () => {
  const report = build();
  const utilities = report.sheets.find((s) => s.name === 'Utilities');

  assert.equal(utilities.rows.length, 1, 'only the selected month is included');
  assert.equal(utilities.rows[0][0], 'BBH');
  assert.equal(report.summary.utilityOwnerContribution, 140);
  assert.equal(report.summary.utilityStudentExcess, 360);
});

test('other months do not fabricate paid/overdue balances', async () => {
  const { billingRecordsForMonth } = await import('../src/lib/billing.ts');
  const other = MONTH === 'Jan' ? 'Feb' : 'Jan';
  const rows = billingRecordsForMonth(BILLING, other);
  const ada = rows.find((r) => r.billing_id === 'BBH-1A');
  const current = billingRecordsForMonth(BILLING, MONTH).find((r) => r.billing_id === 'BBH-1A');
  assert.equal(ada.total_balance, current.total_balance, 'live outstanding must not be rewritten');
  assert.equal(ada.accumulated_total, current.accumulated_total);
});

test('empty data produces a report with zeroed totals rather than throwing', () => {
  const report = buildFinancialReport({
    billingRecords: [], beds: [], payments: [], utilities: [], month: MONTH, year: YEAR,
  });

  assert.equal(report.summary.occupancyRate, 0);
  assert.equal(report.summary.collectionRate, 0);
  assert.equal(report.summary.expectedRevenue, 0);
  assert.equal(report.sheets.find((s) => s.name === 'Payments').rows.length, 0);
});
