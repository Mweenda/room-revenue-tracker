import test from "node:test";
import assert from "node:assert/strict";

const inbox = await import("../src/lib/studentNotifications.ts");

test("rent due copy is personal and names the balance", () => {
  const copy = inbox.buildNotificationCopy("rent_due", {
    balance: 1200,
    targetMonth: "Aug",
    daysPastDue: 0,
    status: "Open Window",
  });

  assert.match(copy.title, /reminder/i);
  assert.match(copy.preview, /K1,200/);
  assert.match(copy.body, /Aug/);
  assert.doesNotMatch(copy.body, /overdue/i);
});

test("overdue rent due uses a stronger title", () => {
  const copy = inbox.buildNotificationCopy("rent_due", {
    balance: 1800,
    targetMonth: "Jun",
    daysPastDue: 31,
    status: "OVERDUE / UNPAID",
  });

  assert.equal(copy.title, "Rent is overdue");
  assert.match(copy.body, /31 days/);
});

test("rent increase copy includes old, new, and effective date", () => {
  const copy = inbox.buildNotificationCopy("rent_increase", {
    bedSpace: "BBH-1-A",
    oldAmount: 950,
    newAmount: 1100,
    effectiveDate: "2026-09-01",
  });

  assert.match(copy.preview, /K950/);
  assert.match(copy.preview, /K1,100/);
  assert.match(copy.body, /2026-09-01/);
  assert.match(copy.body, /BBH-1-A/);
});

test("maintenance update mentions the new status and landlord note", () => {
  const copy = inbox.buildNotificationCopy("maintenance_update", {
    category: "Plumbing",
    status: "in_progress",
    description: "Tap dripping",
    resolutionNote: "Plumber booked for Tuesday.",
  });

  assert.match(copy.preview, /plumbing/i);
  assert.match(copy.preview, /in progress/);
  assert.match(copy.body, /Plumber booked/);
});

test("dedupe keys keep one rent reminder per cycle and status", () => {
  const a = inbox.notificationDedupeKey("rent_due", { targetMonth: "Aug", status: "Open Window" });
  const b = inbox.notificationDedupeKey("rent_due", { targetMonth: "Aug", status: "Open Window" });
  const c = inbox.notificationDedupeKey("rent_due", { targetMonth: "Aug", status: "OVERDUE / UNPAID" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("unread messages sort above older read ones", () => {
  const items = inbox.sortInbox([
    { id: "1", tenantId: "t", kind: "welcome", title: "a", preview: "a", body: "a", metadata: {}, readAt: "2026-08-01T00:00:00Z", createdAt: "2026-08-20T00:00:00Z" },
    { id: "2", tenantId: "t", kind: "rent_due", title: "b", preview: "b", body: "b", metadata: {}, readAt: null, createdAt: "2026-08-10T00:00:00Z" },
  ]);

  assert.equal(items[0].id, "2");
  assert.equal(inbox.unreadCount(items), 1);
});

test("opening a message marks only that row read", () => {
  const before = [
    { id: "1", tenantId: "t", kind: "rent_due", title: "a", preview: "a", body: "a", metadata: {}, readAt: null, createdAt: "2026-08-10T00:00:00Z" },
    { id: "2", tenantId: "t", kind: "house", title: "b", preview: "b", body: "b", metadata: {}, readAt: null, createdAt: "2026-08-11T00:00:00Z" },
  ];
  const after = inbox.markNotificationRead(before, "1", "2026-08-30T10:00:00Z");
  assert.equal(after[0].readAt, "2026-08-30T10:00:00Z");
  assert.equal(after[1].readAt, null);
});

test("local inbox includes rent due, payment outcomes, maintenance, and house notices", () => {
  const items = inbox.deriveLocalInbox({
    tenantId: "s-1",
    bedId: "BBH-6-A",
    blockCode: "BBH",
    billing: {
      billing_id: "BBH-6-A",
      house_block: "BBH",
      room_number: "6",
      bed_space: "A",
      room_gender: "Male",
      tenant_name: "Nanga Obrien",
      phone_number: "260770838758",
      entry_date: "2026-03-01",
      current_rent: 900,
      target_month: "Jun",
      accumulated_total: 3600,
      total_balance: 1800,
      days_past_due: 31,
      billing_status: "OVERDUE / UNPAID",
    },
    payments: [
      { id: "p14", studentName: "Nanga Obrien", bedSpaceId: "BBH-6-A", amount: 900, method: "MTN", transactionRef: "TXN", submittedAt: "2026-07-10", status: "rejected", rejectionReason: "Reference mismatch" },
    ],
    issues: [
      { id: "i1", bedSpaceId: "BBH-6-A", studentName: "Nanga Obrien", category: "Plumbing", description: "Tap", reportedDate: "2026-07-01", status: "in_progress" },
    ],
    utilities: [
      { blockCode: "BBH", month: "July 2026", totalCost: 1240, activeStudents: 16, ownerContribution: 490, excess: 750, studentsSettled: [] },
      { blockCode: "NWG", month: "July 2026", totalCost: 1680, activeStudents: 9, ownerContribution: 560, excess: 1120, studentsSettled: [] },
    ],
  });

  const kinds = new Set(items.map((item) => item.kind));
  assert.ok(kinds.has("rent_due"));
  assert.ok(kinds.has("payment_rejected"));
  assert.ok(kinds.has("maintenance_update"));
  assert.ok(kinds.has("house"));
  assert.equal(items.filter((item) => item.kind === "house").length, 1);
  assert.match(items.find((item) => item.kind === "rent_due").title, /overdue/i);
});

test("same-day inbox timestamps stay as a clock time", () => {
  const label = inbox.formatInboxTime("2026-08-30T14:05:00.000Z", new Date("2026-08-30T18:00:00.000Z"));
  assert.match(label, /\d/);
  assert.doesNotMatch(label, /Yesterday|Aug/);
});
