import test from "node:test";
import assert from "node:assert/strict";

const students = await import("../src/lib/students.ts");

function row(overrides = {}) {
  return {
    id: "t1",
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "0970000001",
    nrc: "111111/11/1",
    move_in_date: "2026-02-01",
    profile_image_url: null,
    gender: "Female",
    bed_space_id: "BBH-1-A",
    tenant_status: "active",
    status_changed_at: null,
    status_reason: null,
    bed_status: "occupied",
    block_code: "BBH",
    room_number: 1,
    bed_letter: "A",
    rent_amount: 900,
    total_balance: 0,
    billing_status: "Paid / Secured",
    days_past_due: 0,
    last_payment_at: "2026-09-01",
    last_payment_amount: 900,
    due_date: "2026-10-01",
    room_gender: "Female",
    ...overrides,
  };
}

const roster = [
  row(),
  row({
    id: "t2",
    full_name: "Nanga Obrien",
    bed_space_id: "ANX-19-B",
    block_code: "ANX",
    gender: "Male",
    room_gender: "Male",
    billing_status: "OVERDUE / UNPAID",
    total_balance: 3600,
    days_past_due: 31,
  }),
  row({
    id: "t3",
    full_name: "Chanda Grace",
    bed_space_id: "CRV-4-A",
    block_code: "CRV",
    billing_status: "Grace Period",
    total_balance: 900,
    days_past_due: 3,
  }),
  row({
    id: "t4",
    full_name: "Former Tenant",
    tenant_status: "evicted",
    billing_status: "Vacant",
    total_balance: 0,
    bed_status: "vacant",
  }),
];

test("Paid and Overdue billing chips keep only those student accounts", () => {
  const paid = students.filterStudentAccounts(roster, { status: "active", billing: "Paid / Secured" });
  const overdue = students.filterStudentAccounts(roster, { status: "active", billing: "OVERDUE / UNPAID" });
  const grace = students.filterStudentAccounts(roster, { status: "active", billing: "Grace Period" });

  assert.deepEqual(paid.map((item) => item.id), ["t1"]);
  assert.deepEqual(overdue.map((item) => item.id), ["t2"]);
  assert.deepEqual(grace.map((item) => item.id), ["t3"]);
});

test("Removed status includes evicted and moved-out students", () => {
  const moved = row({ id: "t5", full_name: "Moved Out", tenant_status: "moved_out" });
  const removed = students.filterStudentAccounts([...roster, moved], { status: "removed" });
  assert.deepEqual(removed.map((item) => item.id).sort(), ["t4", "t5"]);
});

test("search, block, and gender compose with billing status", () => {
  const rows = students.filterStudentAccounts(roster, {
    status: "active",
    billing: "all",
    search: "nanga",
    block: "ANX",
    gender: "Male",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "t2");
});

test("the Students page uses the shared billing filter chips", () => {
  assert.deepEqual(
    students.STUDENT_BILLING_FILTERS.map((chip) => chip.label),
    ["All", "Open Window", "Paid", "Grace", "Overdue"],
  );
});
