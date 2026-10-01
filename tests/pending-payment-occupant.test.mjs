import test from "node:test";
import assert from "node:assert/strict";

const {
  assertPaymentMatchesOccupant,
  paymentMatchesOccupant,
  rejectPendingPaymentsForBed,
  retargetPendingPayments,
} = await import("../src/lib/paymentsEdit.ts");

const alicePending = {
  id: "p-alice",
  studentName: "Alice Banda",
  bedSpaceId: "BBH-1-A",
  amount: 950,
  method: "Airtel",
  transactionRef: "TXN-1",
  submittedAt: "2026-09-20",
  status: "pending",
};

const aliceVerified = {
  ...alicePending,
  id: "p-alice-paid",
  status: "verified",
};

const bobPending = {
  id: "p-bob",
  studentName: "Bob Phiri",
  bedSpaceId: "BBH-2-A",
  amount: 900,
  method: "MTN",
  transactionRef: "TXN-2",
  submittedAt: "2026-09-21",
  status: "pending",
};

test("a receipt only credits the student who still occupies the bed", () => {
  assert.equal(paymentMatchesOccupant("Alice Banda", "Alice Banda"), true);
  assert.equal(paymentMatchesOccupant("  alice banda  ", "Alice Banda"), true);
  assert.equal(paymentMatchesOccupant("Alice Banda", "Bob Phiri"), false);
  assert.equal(paymentMatchesOccupant("Alice Banda", ""), false);
  assert.equal(paymentMatchesOccupant("Alice Banda", null), false);
  assert.equal(paymentMatchesOccupant("", "Alice Banda"), false);
});

test("verifying after turnover does not apply the previous tenant's receipt", () => {
  assert.throws(
    () => assertPaymentMatchesOccupant("Alice Banda", "Bob Phiri", "BBH-1-A"),
    /no longer belongs to the current occupant of BBH-1-A/,
  );
  assert.throws(
    () => assertPaymentMatchesOccupant("Alice Banda", undefined, "BBH-1-A"),
    /current occupant/,
  );
  assert.doesNotThrow(() => assertPaymentMatchesOccupant("Alice Banda", "Alice Banda", "BBH-1-A"));
});

test("vacating a bed rejects leftover pending receipts on that bed only", () => {
  const next = rejectPendingPaymentsForBed(
    [alicePending, aliceVerified, bobPending],
    "BBH-1-A",
    "Tenant vacated",
  );
  assert.equal(next[0].status, "rejected");
  assert.equal(next[0].rejectionReason, "Tenant vacated");
  assert.equal(next[1].status, "verified");
  assert.equal(next[2].status, "pending");
  assert.equal(next[2].bedSpaceId, "BBH-2-A");
});

test("moving a student takes their pending receipt to the new bed", () => {
  const next = retargetPendingPayments([alicePending, aliceVerified, bobPending], {
    fromBedId: "BBH-1-A",
    toBedId: "BBH-1-B",
    fromName: "Alice Banda",
    toName: "Alice Banda",
  });
  assert.equal(next[0].bedSpaceId, "BBH-1-B");
  assert.equal(next[0].status, "pending");
  assert.equal(next[1].bedSpaceId, "BBH-1-A");
  assert.equal(next[2].bedSpaceId, "BBH-2-A");
});

test("renaming a student keeps the pending receipt matched to them", () => {
  const next = retargetPendingPayments([alicePending], {
    fromBedId: "BBH-1-A",
    toBedId: "BBH-1-A",
    fromName: "Alice Banda",
    toName: "Alice Mulenga",
  });
  assert.equal(next[0].studentName, "Alice Mulenga");
  assert.equal(next[0].bedSpaceId, "BBH-1-A");
  assert.equal(next[0].status, "pending");
});
