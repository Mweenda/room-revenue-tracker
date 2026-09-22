import type { BedSpace, Payment } from "../types";
import type { BedPatch, BillingPatch, ParsedBillingRow, ParsedPaymentRow, ParsedRosterRow } from "./types";

function spreadsheetIdToken(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Stable id for an imported spreadsheet receipt. Date + bed alone collides when
 * a student pays twice on the same day (partial cash + remainder, or two
 * receipts), so amount and receipt number are part of the key.
 */
export function xlsxPaymentId(
  uniqueId: string,
  paymentDate: string,
  amount?: number,
  receiptNumber?: string,
): string {
  const receipt = spreadsheetIdToken(receiptNumber ?? "");
  const amountPart = amount != null && Number.isFinite(amount) ? String(amount) : "";
  const extras = [receipt, amountPart].filter(Boolean).join("-");
  return extras ? `xlsx-${paymentDate}-${uniqueId}-${extras}` : `xlsx-${paymentDate}-${uniqueId}`;
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
      id: xlsxPaymentId(row.uniqueId, row.paymentDate, row.amountPaid, row.receiptNumber),
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
  const fresh: Payment[] = [];
  for (const payment of incoming) {
    if (ids.has(payment.id)) continue;
    if (exact.has(paymentDedupeKey(payment))) continue;
    if (monthly.has(paymentMonthDedupeKey(payment))) continue;
    ids.add(payment.id);
    fresh.push(payment);
  }
  return fresh;
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
