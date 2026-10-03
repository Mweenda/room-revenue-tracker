import test from "node:test";
import assert from "node:assert/strict";

const {
  addBillingMonths,
  applyPaymentToLedger,
  monthsToCharge,
  occupancyReport,
  paymentWindowForEntry,
  paymentWindowGroups,
  rollBillingRecord,
  vacantBedRows,
} = await import("../src/lib/paymentTracking.ts");
const { BILLING_RECORDS } = await import("../src/data/seed.ts");

test("entry dates map to the spreadsheet payment windows", () => {
  assert.equal(paymentWindowForEntry("2026-06-01"), "days-1-5");
  assert.equal(paymentWindowForEntry("2026-06-05"), "days-1-5");
  assert.equal(paymentWindowForEntry("2026-06-12"), "mid-month");
  assert.equal(paymentWindowForEntry("2026-06-21"), "days-20-30");
  assert.equal(paymentWindowForEntry("2026-07-31"), "days-20-30");
  assert.equal(paymentWindowForEntry("-"), null);
});

test("paid July accounts are charged for August and September", () => {
  assert.equal(monthsToCharge("Jul", "Sep", 0, 900), 2);
  assert.equal(addBillingMonths("Jul", 2), "Sep");
});

test("unpaid July of one month still charges the missed later months", () => {
  assert.equal(monthsToCharge("Jul", "Sep", 900, 900), 2);
  assert.equal(monthsToCharge("Jul", "Sep", 1800, 900), 1);
  assert.equal(monthsToCharge("Sep", "Sep", 900, 900), 0);
});

test("prepaid future months are not charged again", () => {
  assert.equal(monthsToCharge("Oct", "Sep", 0, 900), 0);
  assert.equal(monthsToCharge("Oct", "Oct", 0, 900), 0);
});

test("a paid-up student is billed again when the next month starts", () => {
  assert.equal(monthsToCharge("Sep", "Oct", 0, 900), 1);
  const rolled = rollBillingRecord(
    {
      billing_id: "BBH-2-A",
      house_block: "BBH",
      room_number: "2",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "Wisdom Bwani",
      phone_number: "260776960320",
      entry_date: "2026-06-05",
      current_rent: 900,
      target_month: "Sep",
      accumulated_total: 2700,
      total_balance: 0,
      days_past_due: 0,
      billing_status: "Paid / Secured",
    },
    "Oct",
    new Date("2026-10-01T08:00:00+02:00"),
  );
  assert.equal(rolled.total_balance, 900);
  assert.equal(rolled.target_month, "Oct");
  assert.equal(rolled.billing_status, "Open Window");
  assert.equal(rolled.days_past_due, 0);
});

test("advance payment covers future months instead of billing them again", () => {
  const prepaid = applyPaymentToLedger({
    totalBalance: 900,
    currentRent: 900,
    targetMonth: "Sep",
    amount: 1800,
    currentMonth: "Sep",
  });
  assert.equal(prepaid.totalBalance, 0);
  assert.equal(prepaid.targetMonth, "Oct");
  assert.equal(monthsToCharge(prepaid.targetMonth, "Sep", 0, 900), 0);
  assert.equal(monthsToCharge(prepaid.targetMonth, "Oct", 0, 900), 0);
  assert.equal(monthsToCharge(prepaid.targetMonth, "Nov", 0, 900), 1);

  const extraOnPaid = applyPaymentToLedger({
    totalBalance: 0,
    currentRent: 900,
    targetMonth: "Oct",
    amount: 900,
    currentMonth: "Sep",
  });
  assert.equal(extraOnPaid.totalBalance, 0);
  assert.equal(extraOnPaid.targetMonth, "Nov");
});

test("rolling a paid July bed in September adds two months of rent", () => {
  const rolled = rollBillingRecord(
    {
      billing_id: "BBH-2-A",
      house_block: "BBH",
      room_number: "2",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "Wisdom Bwani",
      phone_number: "260776960320",
      entry_date: "2026-06-05",
      current_rent: 900,
      target_month: "Jul",
      accumulated_total: 900,
      total_balance: 0,
      days_past_due: 0,
      billing_status: "Paid / Secured",
    },
    "Sep",
    new Date("2026-09-07T08:00:00Z"),
  );
  assert.equal(rolled.total_balance, 1800);
  assert.equal(rolled.accumulated_total, 2700);
  assert.equal(rolled.target_month, "Aug");
  assert.equal(rolled.billing_status, "OVERDUE / UNPAID");
  assert.ok(rolled.days_past_due > 5);
});

test("vacant beds stay at a zero balance", () => {
  const rolled = rollBillingRecord(
    {
      billing_id: "BBH-7-C",
      house_block: "BBH",
      room_number: "7",
      bed_space: "C",
      room_gender: "Female",
      tenant_name: "Vacant",
      phone_number: "-",
      entry_date: "-",
      current_rent: 900,
      target_month: "Jul",
      accumulated_total: 0,
      total_balance: 0,
      days_past_due: 0,
      billing_status: "Vacant",
    },
    "Sep",
    new Date("2026-09-07T08:00:00Z"),
  );
  assert.equal(rolled.total_balance, 0);
  assert.equal(rolled.target_month, "");
  assert.equal(rolled.tenant_name, "");
  assert.equal(rolled.phone_number, "");
  assert.equal(rolled.entry_date, "");
  assert.equal(rolled.billing_status, "Vacant");
});

test("blank tenant names are treated as vacant and stay empty", () => {
  const rolled = rollBillingRecord(
    {
      billing_id: "UPV-10-A",
      house_block: "UPV",
      room_number: "10",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "",
      phone_number: "",
      entry_date: "",
      current_rent: 900,
      target_month: "",
      accumulated_total: 0,
      total_balance: 0,
      days_past_due: 0,
      billing_status: "Vacant",
    },
    "Sep",
    new Date("2026-09-07T08:00:00Z"),
  );
  assert.equal(rolled.tenant_name, "");
  assert.equal(rolled.target_month, "");
  assert.equal(rolled.billing_status, "Vacant");
});

test("a fresh onboard stamped with last month is charged again on the 1st", () => {
  // Application approval used to_char(UTC). At 00:30 Lusaka on 1 Oct, UTC is
  // still 30 Sep, so the new ledger was target=Sep / balance=one month of rent.
  // roll_billing_cycle then treats September as arrears and adds October.
  const stampedLastMonth = rollBillingRecord(
    {
      billing_id: "BBH-1-A",
      house_block: "BBH",
      room_number: "1",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "Gift Nankamba",
      phone_number: "260977000000",
      entry_date: "2026-10-01",
      current_rent: 950,
      target_month: "Sep",
      accumulated_total: 950,
      total_balance: 950,
      days_past_due: 0,
      billing_status: "Open Window",
    },
    "Oct",
    new Date("2026-10-01T00:30:00+02:00"),
  );
  assert.equal(stampedLastMonth.total_balance, 1900);
  assert.equal(stampedLastMonth.accumulated_total, 1900);
  assert.equal(stampedLastMonth.target_month, "Sep");

  const stampedLiveMonth = rollBillingRecord(
    {
      billing_id: "BBH-1-A",
      house_block: "BBH",
      room_number: "1",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "Gift Nankamba",
      phone_number: "260977000000",
      entry_date: "2026-10-01",
      current_rent: 950,
      target_month: "Oct",
      accumulated_total: 950,
      total_balance: 950,
      days_past_due: 0,
      billing_status: "Open Window",
    },
    "Oct",
    new Date("2026-10-01T12:00:00+02:00"),
  );
  assert.equal(stampedLiveMonth.total_balance, 950);
  assert.equal(stampedLiveMonth.accumulated_total, 950);
  assert.equal(stampedLiveMonth.target_month, "Oct");
});

test("a verified payment clears the oldest unpaid month first", () => {
  const half = applyPaymentToLedger({
    totalBalance: 1800,
    currentRent: 900,
    targetMonth: "Jul",
    amount: 900,
    currentMonth: "Sep",
  });
  assert.equal(half.totalBalance, 900);
  assert.equal(half.targetMonth, "Aug");

  const settled = applyPaymentToLedger({
    totalBalance: 900,
    currentRent: 900,
    targetMonth: "Aug",
    amount: 900,
    currentMonth: "Sep",
  });
  assert.equal(settled.totalBalance, 0);
  assert.equal(settled.targetMonth, "Sep");
});

test("occupancy report totals include occupied and vacant beds by gender", () => {
  const report = occupancyReport(BILLING_RECORDS);
  assert.equal(report.totalBeds, 54);
  assert.equal(report.activeTenants, 48);
  assert.equal(report.vacantBeds, 6);
  assert.equal(report.maleOccupied + report.maleVacant, report.maleBeds);
  assert.equal(report.femaleOccupied + report.femaleVacant, report.femaleBeds);
  assert.equal(report.maleBeds + report.femaleBeds, report.totalBeds);
  assert.equal(report.activeTenants + report.vacantBeds, report.totalBeds);
  assert.ok(report.maleBeds > report.maleVacant);
  assert.ok(report.femaleBeds > report.femaleVacant);
  assert.equal(report.expectedRevenue + vacantBedRows(BILLING_RECORDS).reduce((sum, row) => sum + row.rent, 0), report.fullCapacityRevenue);
});

test("payment windows split occupied students by entry day", () => {
  const [early, late, mid] = paymentWindowGroups(BILLING_RECORDS);
  assert.equal(early.window, "days-1-5");
  assert.equal(late.window, "days-20-30");
  assert.equal(mid.window, "mid-month");
  assert.ok(early.rows.length > 0);
  assert.equal(early.expected, early.rows.reduce((sum, row) => sum + row.amount, 0));
  const occupiedRent = occupancyReport(BILLING_RECORDS).expectedRevenue;
  assert.equal(early.expected + late.expected + mid.expected, occupiedRent);
});
