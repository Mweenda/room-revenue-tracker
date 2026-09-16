import test from "node:test";
import assert from "node:assert/strict";

const {
  applyOccupancyAdminEdit,
  occupancyCoverageFromBilling,
  occupancyEditDefaults,
} = await import("../src/lib/occupancyBillingEdit.ts");
const { lastVerifiedPayment } = await import("../src/lib/paymentsEdit.ts");

const TODAY = new Date("2026-09-09T12:00:00.000Z");

function maika() {
  return {
    id: "t-maika",
    name: "Maika Nengo",
    email: "maika@example.com",
    phone: "0977000000",
    nrc: "123456/78/9",
    moveInDate: "2026-02-01",
    gender: "Female",
  };
}

const BEDS = [
  {
    id: "UPV-1-A",
    blockCode: "UPV",
    roomNumber: 1,
    bedLetter: "A",
    identifier: "UPV-1-A",
    status: "occupied",
    rentAmount: 900,
    roomGender: "Female",
    student: maika(),
  },
];

const BILLING = [
  {
    billing_id: "UPV-1-A",
    house_block: "UPV",
    room_number: "1",
    bed_space: "A",
    room_gender: "Female",
    tenant_name: "Maika Nengo",
    phone_number: "0977000000",
    entry_date: "2026-02-01",
    current_rent: 900,
    target_month: "Sep",
    accumulated_total: 900,
    total_balance: 0,
    days_past_due: 0,
    billing_status: "Paid / Secured",
  },
];

const PAYMENTS = [
  {
    id: "p-maika-1",
    studentName: "Maika Nengo",
    bedSpaceId: "UPV-1-A",
    amount: 900,
    method: "Cash",
    transactionRef: "CASH-20260909",
    submittedAt: "2026-09-09",
    status: "verified",
  },
];

function save(overrides = {}, payments = PAYMENTS, billing = BILLING) {
  return applyOccupancyAdminEdit(BEDS, billing, payments, {
    tenantId: "t-maika",
    name: "Maika Nengo",
    phone: "0977000000",
    email: "maika@example.com",
    moveInDate: "2026-02-01",
    gender: "Female",
    bedId: "UPV-1-A",
    rentAmount: 900,
    billingStatus: "Paid / Secured",
    targetMonth: "Sep",
    monthsCovered: 1,
    paymentDate: "2026-09-05",
    paymentAmount: 900,
    paymentMethod: "Cash",
    paymentRef: "CASH-20260909",
    ...overrides,
  }, { today: TODAY, currentMonth: "Sep" });
}

test("correcting Maika's payment date overwrites the existing receipt instead of adding another", () => {
  const next = save();
  const forBed = next.payments.filter((row) => row.bedSpaceId === "UPV-1-A" && row.status === "verified");
  assert.equal(forBed.length, 1);
  assert.equal(forBed[0].id, "p-maika-1");
  assert.equal(forBed[0].submittedAt, "2026-09-05");
  assert.equal(next.paymentAction, "update");
  const billing = next.billingRecords.find((row) => row.billing_id === "UPV-1-A");
  assert.equal(billing?.billing_status, "Paid / Secured");
  assert.equal(billing?.total_balance, 0);
});

test("occupancy paid/secured with multiple months prepaids through the last covered month", () => {
  const next = save({ monthsCovered: 3, paymentAmount: 2700 });
  const billing = next.billingRecords.find((row) => row.billing_id === "UPV-1-A");
  assert.equal(billing?.billing_status, "Paid / Secured");
  assert.equal(billing?.total_balance, 0);
  assert.equal(billing?.target_month, "Nov");
  assert.equal(next.payments.filter((row) => row.bedSpaceId === "UPV-1-A").length, 1);
  assert.equal(next.payments[0].amount, 2700);
});

test("marking overdue sets an outstanding balance and does not insert a second payment", () => {
  const next = save({
    billingStatus: "OVERDUE / UNPAID",
    totalBalance: 900,
    paymentDate: "2026-09-05",
    paymentAmount: 900,
  });
  const billing = next.billingRecords.find((row) => row.billing_id === "UPV-1-A");
  assert.equal(billing?.billing_status, "OVERDUE / UNPAID");
  assert.equal(billing?.total_balance, 900);
  assert.ok((billing?.days_past_due ?? 0) > 5);
  assert.equal(next.payments.filter((row) => row.bedSpaceId === "UPV-1-A").length, 1);
});

test("a bed with no receipt can record one verified payment without duplicating later edits", () => {
  const created = save({ paymentDate: "2026-09-05", paymentAmount: 900 }, []);
  assert.equal(created.paymentAction, "insert");
  assert.equal(created.payments.length, 1);
  assert.equal(created.payments[0].status, "verified");
  assert.equal(created.payments[0].submittedAt, "2026-09-05");

  const corrected = applyOccupancyAdminEdit(BEDS, created.billingRecords, created.payments, {
    tenantId: "t-maika",
    name: "Maika Nengo",
    phone: "0977000000",
    email: "maika@example.com",
    moveInDate: "2026-02-01",
    gender: "Female",
    bedId: "UPV-1-A",
    rentAmount: 900,
    billingStatus: "Paid / Secured",
    targetMonth: "Sep",
    monthsCovered: 1,
    paymentDate: "2026-09-03",
    paymentAmount: 900,
    paymentMethod: "Cash",
  }, { today: TODAY, currentMonth: "Sep" });
  assert.equal(corrected.paymentAction, "update");
  assert.equal(corrected.payments.length, 1);
  assert.equal(corrected.payments[0].id, created.payments[0].id);
  assert.equal(corrected.payments[0].submittedAt, "2026-09-03");
});

test("prepaid coverage infers how many months are secured from the last prepaid month", () => {
  const coverage = occupancyCoverageFromBilling(
    { ...BILLING[0], target_month: "Nov", total_balance: 0, billing_status: "Paid / Secured" },
    "Sep",
  );
  assert.equal(coverage.monthsCovered, 3);
  assert.equal(coverage.startMonth, "Sep");
});

test("moving a student does not treat their previous bed's receipt as this bed's occupancy payment", () => {
  const previousReceipt = {
    id: "p-maika-upv-old",
    studentName: "Maika Nengo",
    bedSpaceId: "UPV-2-C",
    amount: 900,
    method: "Cash",
    transactionRef: "CASH-20260801",
    submittedAt: "2026-08-01",
    status: "verified",
  };
  const allPayments = [previousReceipt];
  assert.equal(lastVerifiedPayment(allPayments, "UPV-1-A", "Maika Nengo"), null);

  const defaults = occupancyEditDefaults(BEDS[0], BILLING[0], previousReceipt, "Sep");
  assert.equal(defaults.paymentDate, "");
  assert.equal(defaults.paymentAmount, 0);

  const next = applyOccupancyAdminEdit(BEDS, BILLING, allPayments, {
    ...defaults,
    tenantId: "t-maika",
    monthsCovered: 1,
  }, { today: TODAY, currentMonth: "Sep" });

  assert.equal(next.paymentAction, "none");
  assert.equal(next.payments.length, 1);
  assert.equal(next.payments[0].id, "p-maika-upv-old");
  assert.equal(next.payments[0].bedSpaceId, "UPV-2-C");
  assert.equal(next.payments[0].submittedAt, "2026-08-01");
  assert.equal(next.payments[0].amount, 900);
});
