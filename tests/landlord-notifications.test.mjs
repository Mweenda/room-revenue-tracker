import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const inbox = await import("../src/lib/landlordNotifications.ts");

test("overdue copy names the student, bed, and balance", () => {
  const copy = inbox.buildLandlordNotificationCopy("rent_overdue", {
    studentName: "Nanga Obrien",
    bedSpace: "ANX-19-B",
    balance: 3600,
    targetMonth: "Jun",
    daysPastDue: 31,
  });

  assert.equal(copy.title, "Rent overdue · Nanga Obrien");
  assert.match(copy.preview, /ANX-19-B/);
  assert.match(copy.preview, /K3,600/);
  assert.match(copy.body, /31 days/);
  assert.match(copy.body, /student account/i);
  assert.equal(
    inbox.landlordNotificationView({ kind: "rent_overdue", metadata: { hrefView: "revenue" } }),
    "students",
  );
});

test("vacant names are not treated as a real tenant", () => {
  const copy = inbox.buildLandlordNotificationCopy("rent_overdue", {
    studentName: "Vacant",
    bedSpace: "BBH-1-A",
    balance: 900,
  });
  assert.match(copy.title, /A student/);
});

test("payment submitted and verified copy stay distinct", () => {
  const submitted = inbox.buildLandlordNotificationCopy("payment_submitted", {
    studentName: "Chanda",
    bedSpace: "ANX-19-B",
    amount: 900,
    paymentMethod: "MTN",
  });
  const verified = inbox.buildLandlordNotificationCopy("payment_verified", {
    studentName: "Chanda",
    bedSpace: "ANX-19-B",
    amount: 900,
    paymentMethod: "Cash",
  });

  assert.match(submitted.preview, /submitted/);
  assert.match(verified.preview, /paid/);
  assert.match(verified.preview, /Cash/);
  assert.match(submitted.body, /awaiting verification/);
});

test("maintenance complaints include the category and report", () => {
  const copy = inbox.buildLandlordNotificationCopy("maintenance_submitted", {
    studentName: "Emely",
    bedSpace: "CRV-4-A",
    category: "Plumbing",
    description: "Tap dripping in the shower.",
  });
  assert.match(copy.preview, /plumbing/);
  assert.match(copy.body, /Tap dripping/);
});

test("dedupe keys keep one overdue notice per bed and cycle", () => {
  const a = inbox.landlordNotificationDedupeKey("rent_overdue", { bedSpace: "BBH-6-A", targetMonth: "Jun" });
  const b = inbox.landlordNotificationDedupeKey("rent_overdue", { bedSpace: "BBH-6-A", targetMonth: "Jun" });
  const c = inbox.landlordNotificationDedupeKey("rent_overdue", { bedSpace: "BBH-6-A", targetMonth: "Jul" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("WhatsApp copy follows the notification kind", () => {
  const contact = {
    name: "Nanga Obrien",
    phone: "260770838758",
    bedId: "BBH-6-B",
    balance: 3600,
    daysPastDue: 31,
    dueDate: "Jun",
  };
  const overdue = inbox.composeLandlordWhatsApp("rent_overdue", contact, { status: "OVERDUE / UNPAID" });
  assert.match(overdue, /overdue/i);
  assert.match(overdue, /BBH-6-B/);
  assert.match(overdue, /K3,?600/);

  const submitted = inbox.composeLandlordWhatsApp("payment_submitted", contact, { amount: 900, paymentMethod: "MTN" });
  assert.match(submitted, /payment proof/);
  assert.match(submitted, /MTN/);

  const verified = inbox.composeLandlordWhatsApp("payment_verified", contact, { amount: 900, paymentMethod: "Cash" });
  assert.match(verified, /verified/);
  assert.match(verified, /Thank you/);

  const maintenance = inbox.composeLandlordWhatsApp("maintenance_submitted", contact, {
    category: "Plumbing",
    description: "Tap dripping",
  });
  assert.match(maintenance, /plumbing/);
  assert.match(maintenance, /Tap dripping/);
});

test("student applications notify the landlord and open the Students review flow", () => {
  const copy = inbox.buildLandlordNotificationCopy("student_application", {
    studentName: "Gift Nankamba",
    email: "gift@example.com",
    phone: "0977000000",
    gender: "Female",
    applicationId: "app-1",
  });
  assert.equal(copy.title, "New bed space request · Gift Nankamba");
  assert.match(copy.preview, /Female/);
  assert.match(copy.body, /gift@example.com/);
  assert.equal(
    inbox.landlordNotificationDedupeKey("student_application", { applicationId: "app-1" }),
    "student_application:app-1",
  );
  assert.equal(
    inbox.landlordNotificationView({ kind: "student_application", metadata: { hrefView: "students" } }),
    "students",
  );
  assert.equal(
    inbox.pageActionLabel({ kind: "student_application", metadata: {} }),
    "Review application",
  );
});

test("contact lookup uses the billing phone for the related bed", () => {
  const item = {
    id: "n1",
    landlordId: "l",
    tenantId: null,
    bedSpaceId: "BBH-6-B",
    paymentId: null,
    issueId: null,
    kind: "rent_overdue",
    title: "Rent overdue · Nanga Obrien",
    preview: "x",
    body: "x",
    metadata: { studentName: "Nanga Obrien", bedSpace: "BBH-6-B", balance: 3600 },
    readAt: null,
    createdAt: "2026-09-08T00:00:00Z",
  };
  const contact = inbox.resolveNotificationContact(item, {
    billingRecords: [{
      billing_id: "BBH-6-B",
      house_block: "BBH",
      room_number: "6",
      bed_space: "B",
      room_gender: "Male",
      tenant_name: "Nanga Obrien",
      phone_number: "260770838758",
      entry_date: "2026-03-01",
      current_rent: 900,
      target_month: "Jun",
      accumulated_total: 3600,
      total_balance: 3600,
      days_past_due: 31,
      billing_status: "OVERDUE / UNPAID",
    }],
    beds: [],
    students: [],
  });
  assert.equal(contact.phone, "260770838758");
  assert.equal(contact.name, "Nanga Obrien");
  assert.equal(inbox.pageActionLabel(item), "View account");
  assert.equal(inbox.landlordNotificationView(item), "students");
  assert.equal(inbox.inboxOpensStudentAccount(item.kind), true);
  assert.equal(inbox.inboxOpensStudentAccount("payment_submitted"), false);
  const account = inbox.findStudentAccountForNotification(
    [{ id: "t1", bed_space_id: "BBH-6-B", full_name: "Nanga Obrien" }],
    item,
  );
  assert.equal(account?.id, "t1");
});

test("local inbox uses current overdue, pending, and open issues only", () => {
  const items = inbox.deriveLocalLandlordInbox({
    billingRecords: [
      {
        billing_id: "ANX-19-B",
        house_block: "ANX",
        room_number: "19",
        bed_space: "B",
        room_gender: "Male",
        tenant_name: "Nanga Obrien",
        phone_number: "260770000000",
        entry_date: "2026-03-01",
        current_rent: 900,
        target_month: "Jun",
        accumulated_total: 3600,
        total_balance: 3600,
        days_past_due: 31,
        billing_status: "OVERDUE / UNPAID",
      },
      {
        billing_id: "BBH-1-A",
        house_block: "BBH",
        room_number: "1",
        bed_space: "A",
        room_gender: "Male",
        tenant_name: "",
        phone_number: "",
        entry_date: "",
        current_rent: 950,
        target_month: "",
        accumulated_total: 0,
        total_balance: 0,
        days_past_due: 0,
        billing_status: "Vacant",
      },
    ],
    payments: [
      { id: "p-live", studentName: "Chanda", bedSpaceId: "ANX-19-B", amount: 900, method: "MTN", transactionRef: "TXN", submittedAt: "2026-09-08", status: "pending" },
      { id: "xlsx-2026-01-BBH-1-A", studentName: "Adrian mulale", bedSpaceId: "BBH-1-A", amount: 950, method: "Cash", transactionRef: "XLSX", submittedAt: "2026-01-31", status: "verified" },
    ],
    issues: [
      { id: "i1", bedSpaceId: "CRV-4-A", studentName: "Emely", category: "Plumbing", description: "Tap", reportedDate: "2026-09-01", status: "open" },
      { id: "i2", bedSpaceId: "CRV-4-B", studentName: "Wisdom", category: "Electrical", description: "Light", reportedDate: "2026-08-01", status: "resolved" },
    ],
  });

  const kinds = new Set(items.map((item) => item.kind));
  assert.ok(kinds.has("rent_overdue"));
  assert.ok(kinds.has("payment_submitted"));
  assert.ok(kinds.has("maintenance_submitted"));
  assert.equal(items.filter((item) => item.kind === "payment_verified").length, 0);
  assert.equal(items.find((item) => item.kind === "rent_overdue")?.metadata.studentName, "Nanga Obrien");
  assert.equal(items.filter((item) => item.metadata.studentName === "Adrian mulale").length, 0);
});

test("View account stays on Students and does not remount the dashboard after the first load", async () => {
  const { shouldShowTrackerSplash } = await import("../src/lib/trackerSync.ts");
  assert.equal(shouldShowTrackerSplash(true, false), true);
  assert.equal(shouldShowTrackerSplash(true, true), false);
  assert.equal(shouldShowTrackerSplash(false, true), false);

  const app = readFileSync(join(process.cwd(), "src/app/App.tsx"), "utf8");
  const goTo = app.slice(app.indexOf("function goToInboxItem"), app.indexOf("const viewTitles"));
  assert.doesNotMatch(goTo, /refreshData/);
  assert.match(goTo, /inboxOpensStudentAccount/);

  const studentsView = readFileSync(join(process.cwd(), "src/app/views/StudentsView.tsx"), "utf8");
  assert.match(studentsView, /setFormMode\("edit"\)/);
  assert.match(studentsView, /setFormOpen\(true\)/);
});

test("unread rows sort above older read ones", () => {
  const items = inbox.sortLandlordInbox([
    {
      id: "1", landlordId: "l", tenantId: null, bedSpaceId: "A", paymentId: null, issueId: null,
      kind: "rent_overdue", title: "a", preview: "a", body: "a", metadata: {},
      readAt: "2026-09-01T00:00:00Z", createdAt: "2026-09-07T00:00:00Z",
    },
    {
      id: "2", landlordId: "l", tenantId: null, bedSpaceId: "B", paymentId: null, issueId: null,
      kind: "payment_submitted", title: "b", preview: "b", body: "b", metadata: {},
      readAt: null, createdAt: "2026-09-01T00:00:00Z",
    },
  ]);
  assert.equal(items[0].id, "2");
  assert.equal(inbox.unreadLandlordCount(items), 1);
});

test("opened landlord notifications stay read after a later fetch", () => {
  const fetched = [
    {
      id: "1", landlordId: "l", tenantId: null, bedSpaceId: "A", paymentId: null, issueId: null,
      kind: "rent_overdue", title: "a", preview: "a", body: "a", metadata: {},
      readAt: null, createdAt: "2026-09-07T00:00:00Z",
    },
  ];
  const merged = inbox.applySeenLandlordInbox(fetched, ["1"], "2026-09-10T10:00:00Z");
  assert.equal(merged[0].readAt, "2026-09-10T10:00:00Z");
  assert.equal(inbox.unreadLandlordCount(merged), 0);
});
