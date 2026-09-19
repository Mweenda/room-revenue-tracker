import type { BedSpace, BillingRecord, Payment } from "../types";
import type { BedPatch, BillingPatch, ParsedBillingRow, ParsedPaymentRow, ParsedRosterRow } from "./types";

export function xlsxPaymentId(uniqueId: string, paymentDate: string): string {
  return `xlsx-${paymentDate}-${uniqueId}`;
}

export function paymentDedupeKey(payment: Pick<Payment, "bedSpaceId" | "submittedAt" | "amount">): string {
  return `${payment.bedSpaceId}|${payment.submittedAt.slice(0, 10)}|${payment.amount}`;
}

export function paymentMonthDedupeKey(payment: Pick<Payment, "bedSpaceId" | "submittedAt" | "amount">): string {
  return `${payment.bedSpaceId}|${payment.submittedAt.slice(0, 7)}|${payment.amount}`;
}

export function mapParsedPayments(rows: ParsedPaymentRow[], knownBedIds: Set<string>): Payment[] {
  const mapped: Payment[] = [];
  for (const row of rows) {
    if (!knownBedIds.has(row.uniqueId)) continue;
    mapped.push({
      id: xlsxPaymentId(row.uniqueId, row.paymentDate),
      studentName: row.tenantName,
      bedSpaceId: row.uniqueId,
      amount: row.amountPaid,
      method: "Cash",
      transactionRef: row.receiptNumber || `XLSX-${row.paymentDate.replace(/-/g, "")}-${row.uniqueId}`,
      submittedAt: row.paymentDate,
      status: "verified",
    });
  }
  return mapped;
}

export function filterNewPayments(incoming: Payment[], existing: Payment[]): Payment[] {
  const exact = new Set(existing.map(paymentDedupeKey));
  const monthly = new Set(existing.map(paymentMonthDedupeKey));
  const ids = new Set(existing.map((payment) => payment.id));
  return incoming.filter((payment) => {
    if (ids.has(payment.id)) return false;
    if (exact.has(paymentDedupeKey(payment))) return false;
    if (monthly.has(paymentMonthDedupeKey(payment))) return false;
    return true;
  });
}

export function mapParsedBillingPatches(rows: ParsedBillingRow[], knownBillingIds: Set<string>): BillingPatch[] {
  return rows
    .filter((row) => knownBillingIds.has(row.billingId))
    .map((row) => ({
      billing_id: row.billingId,
      tenant_name: row.tenantName,
      phone_number: row.phoneNumber,
      current_rent: row.currentRent,
      entry_date: row.entryDate,
      target_month: row.targetMonth,
      accumulated_total: row.accumulatedTotal,
      total_balance: row.totalBalance,
    }));
}

/**
 * Spreadsheet billing is often a stale export. New verified payments must still
 * hit the live ledger (via apply_verified_payment). If we wrote the sheet's
 * balances after inserting those payments, the trigger's credit would be undone.
 */
export function preserveLiveLedgerForNewPayments(
  patches: BillingPatch[],
  liveBilling: Array<Pick<BillingRecord, "billing_id" | "total_balance" | "target_month" | "accumulated_total">>,
  newPayments: Array<Pick<Payment, "bedSpaceId">>,
): BillingPatch[] {
  const bedsWithNewPayments = new Set(newPayments.map((payment) => payment.bedSpaceId));
  if (bedsWithNewPayments.size === 0) return patches;
  const liveById = new Map(liveBilling.map((row) => [row.billing_id, row]));
  return patches.map((patch) => {
    if (!bedsWithNewPayments.has(patch.billing_id)) return patch;
    const live = liveById.get(patch.billing_id);
    if (!live) return patch;
    return {
      ...patch,
      total_balance: live.total_balance,
      target_month: live.target_month,
      accumulated_total: live.accumulated_total,
    };
  });
}

export function mapParsedRosterPatches(rows: ParsedRosterRow[], knownBedIds: Set<string>): BedPatch[] {
  return rows
    .filter((row) => knownBedIds.has(row.uniqueId))
    .map((row) => ({
      id: row.uniqueId,
      rentAmount: row.monthlyRent,
      roomGender: row.roomGender,
    }));
}

export function knownIds(beds: BedSpace[]): Set<string> {
  return new Set(beds.map((bed) => bed.id));
}
