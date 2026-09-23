import {
  BILLING_MONTHS,
  computeBillingStatus,
  getCurrentBillingMonth,
  getCurrentYear,
  getDaysPastDue,
  type BillingMonth,
} from "./billing";
import { isVacantName, vacantBillingPatch } from "./occupancy";
import type { BillingRecord } from "./types";

export type PaymentWindow = "days-1-5" | "days-20-30" | "mid-month";

export type PaymentWindowRow = {
  billingId: string;
  tenantName: string;
  amount: number;
  balance: number;
  entryDate: string;
  targetMonth: string;
  billingStatus: BillingRecord["billing_status"];
};

export type PaymentWindowGroup = {
  window: PaymentWindow;
  label: string;
  rows: PaymentWindowRow[];
  expected: number;
  outstanding: number;
};

function monthIndex(month: string): number {
  return BILLING_MONTHS.indexOf(month as BillingMonth);
}

export function addBillingMonths(month: string, count: number): BillingMonth {
  const idx = monthIndex(month);
  const start = idx >= 0 ? idx : 0;
  const next = ((start + count) % 12 + 12) % 12;
  return BILLING_MONTHS[next];
}

/** Forward month distance, 0–11. Jul → Sep is 2. */
export function monthsFromTo(fromMonth: string, toMonth: string): number {
  const from = monthIndex(fromMonth);
  const to = monthIndex(toMonth);
  if (from < 0 || to < 0) return 0;
  return (to - from + 12) % 12;
}

/**
 * Month names have no year, so 7+ months ahead is the same encoding as
 * 5 or fewer months behind. `months_to_charge` then treats prepaid April
 * (from September) as five missed months and the live roll adds that rent.
 */
export const MAX_PREPAID_AHEAD_MONTHS = 6;

export const PREPAID_HORIZON_ERROR =
  "Prepaid coverage cannot extend more than 6 months ahead. Month names wrap, so 7+ months prepaid is billed as arrears on the next roll.";

/**
 * Refuse an intentional advance that would land more than 6 months ahead of
 * the live month. A target already in the past (paid through August while it
 * is September) is not prepaid and must stay writable.
 */
export function assertPrepaidAdvanceAllowed(
  extraMonths: number,
  fromMonth: string,
  currentMonth: string,
): void {
  if (extraMonths > MAX_PREPAID_AHEAD_MONTHS) {
    throw new Error(PREPAID_HORIZON_ERROR);
  }
  const ahead = monthsFromTo(currentMonth, fromMonth);
  const behind = monthsFromTo(fromMonth, currentMonth);
  const fromIsCurrentOrFuture = ahead === 0 || (ahead > 0 && ahead <= behind);
  if (fromIsCurrentOrFuture && ahead + extraMonths > MAX_PREPAID_AHEAD_MONTHS) {
    throw new Error(PREPAID_HORIZON_ERROR);
  }
}

export function entryDayOfMonth(entryDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(entryDate.trim());
  if (!match) return null;
  const day = Number(match[3]);
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * Spreadsheet collection windows are based on the student's entry day, not a
 * due-date calendar: days 1–5 and days 20–31 of the month.
 */
export function paymentWindowForEntry(entryDate: string): PaymentWindow | null {
  const day = entryDayOfMonth(entryDate);
  if (day == null) return null;
  if (day <= 5) return "days-1-5";
  if (day >= 20) return "days-20-30";
  return "mid-month";
}

export function monthsOwed(totalBalance: number, currentRent: number): number {
  if (totalBalance <= 0 || currentRent <= 0) return 0;
  return Math.max(1, Math.ceil(Math.round(totalBalance * 100) / Math.round(currentRent * 100)));
}

/**
 * Last calendar month that already has rent on the ledger.
 * Paid accounts: `target_month` is the last settled/prepaid month.
 * Unpaid accounts: `target_month` is the oldest unpaid month.
 */
export function lastChargedMonth(
  targetMonth: string,
  totalBalance: number,
  currentRent: number,
): BillingMonth | null {
  const idx = monthIndex(targetMonth);
  if (idx < 0) return null;
  const owed = monthsOwed(totalBalance, currentRent);
  if (owed <= 0) return targetMonth as BillingMonth;
  return addBillingMonths(targetMonth, owed - 1);
}

export function monthsToCharge(
  targetMonth: string,
  currentMonth: string,
  totalBalance: number,
  currentRent: number,
): number {
  const last = lastChargedMonth(targetMonth, totalBalance, currentRent);
  if (!last) return 0;
  const behind = monthsFromTo(last, currentMonth);
  if (behind === 0) return 0;
  if (totalBalance <= 0) {
    const ahead = monthsFromTo(currentMonth, last);
    // Paid in advance: last charged month is current or still in the future.
    if (ahead <= behind) return 0;
  }
  return behind;
}

function prepaidBaseMonth(targetMonth: string, currentMonth: string, oldBalance: number): string {
  if (oldBalance > 0) return currentMonth;
  if (monthIndex(targetMonth) < 0) return currentMonth;
  const ahead = monthsFromTo(currentMonth, targetMonth);
  const behind = monthsFromTo(targetMonth, currentMonth);
  if (ahead === 0 || ahead <= behind) return targetMonth;
  return currentMonth;
}

export function applyPaymentToLedger(input: {
  totalBalance: number;
  currentRent: number;
  targetMonth: string;
  amount: number;
  currentMonth?: string;
}): { totalBalance: number; targetMonth: string } {
  const currentMonth = input.currentMonth ?? getCurrentBillingMonth();
  const amount = Math.max(0, input.amount);
  const rent = input.currentRent;
  const oldBalance = Math.max(0, input.totalBalance);
  const newBalance = Math.max(0, Math.round((oldBalance - amount) * 100) / 100);
  const startMonth = monthIndex(input.targetMonth) >= 0 ? input.targetMonth : currentMonth;

  if (newBalance === 0) {
    const overpay = Math.max(0, amount - oldBalance);
    const extraMonths = rent > 0 ? Math.floor(overpay / rent) : 0;
    const baseMonth = prepaidBaseMonth(startMonth, currentMonth, oldBalance);
    assertPrepaidAdvanceAllowed(extraMonths, baseMonth, currentMonth);
    return {
      totalBalance: 0,
      targetMonth: addBillingMonths(baseMonth, extraMonths),
    };
  }

  const oldOwed = monthsOwed(oldBalance, rent);
  const newOwed = monthsOwed(newBalance, rent);
  const cleared = Math.max(0, oldOwed - newOwed);
  return {
    totalBalance: newBalance,
    targetMonth: addBillingMonths(startMonth, cleared),
  };
}

export function rollBillingRecord(
  record: BillingRecord,
  currentMonth: BillingMonth = getCurrentBillingMonth(),
  today = new Date(),
): BillingRecord {
  const vacant = record.billing_status === "Vacant" || isVacantName(record.tenant_name);
  if (vacant) {
    return { ...record, ...vacantBillingPatch() };
  }

  const targetMonth =
    record.target_month === "-" || monthIndex(record.target_month) < 0
      ? currentMonth
      : record.target_month;
  const last = lastChargedMonth(targetMonth, record.total_balance, record.current_rent);
  const charge = monthsToCharge(targetMonth, currentMonth, record.total_balance, record.current_rent);
  const charged = Math.min(24, charge);
  const extra = charged * record.current_rent;
  const total_balance = Math.round((record.total_balance + extra) * 100) / 100;
  const accumulated_total = Math.round((record.accumulated_total + extra) * 100) / 100;
  const nextTarget =
    charged > 0 && record.total_balance <= 0 && last
      ? addBillingMonths(last, 1)
      : targetMonth;
  const unpaid = total_balance > 0;
  const days_past_due = getDaysPastDue(nextTarget, getCurrentYear(), today, unpaid);
  const billing_status = computeBillingStatus(
    record.tenant_name,
    total_balance,
    record.current_rent,
    days_past_due,
    nextTarget,
    currentMonth,
  );

  return {
    ...record,
    target_month: nextTarget,
    accumulated_total,
    total_balance,
    days_past_due,
    billing_status,
  };
}

export function rollBillingRecords(
  records: BillingRecord[],
  currentMonth: BillingMonth = getCurrentBillingMonth(),
  today = new Date(),
): BillingRecord[] {
  return records.map((record) => rollBillingRecord(record, currentMonth, today));
}

export function occupancyReport(records: BillingRecord[]) {
  const occupied = records.filter((r) => r.billing_status !== "Vacant" && !isVacantName(r.tenant_name));
  const vacant = records.filter((r) => r.billing_status === "Vacant" || isVacantName(r.tenant_name));
  const maleVacant = vacant.filter((r) => r.room_gender === "Male").length;
  const femaleVacant = vacant.filter((r) => r.room_gender === "Female").length;
  return {
    activeTenants: occupied.length,
    vacantBeds: vacant.length,
    totalBeds: records.length,
    expectedRevenue: occupied.reduce((sum, r) => sum + r.current_rent, 0),
    fullCapacityRevenue: records.reduce((sum, r) => sum + r.current_rent, 0),
    maleVacant,
    femaleVacant,
    maleOccupied: occupied.filter((r) => r.room_gender === "Male").length,
    femaleOccupied: occupied.filter((r) => r.room_gender === "Female").length,
    maleBeds: records.filter((r) => r.room_gender === "Male").length,
    femaleBeds: records.filter((r) => r.room_gender === "Female").length,
  };
}

export function vacantBedRows(records: BillingRecord[]) {
  return records
    .filter((r) => r.billing_status === "Vacant" || isVacantName(r.tenant_name))
    .map((r) => ({
      billingId: r.billing_id,
      block: r.house_block,
      room: r.room_number,
      space: r.bed_space,
      rent: r.current_rent,
      gender: r.room_gender,
    }));
}

function windowLabel(window: PaymentWindow): string {
  if (window === "days-1-5") return "Days 1–5";
  if (window === "days-20-30") return "Days 20–30";
  return "Days 6–19";
}

export function paymentWindowGroups(records: BillingRecord[]): PaymentWindowGroup[] {
  const buckets: Record<PaymentWindow, PaymentWindowRow[]> = {
    "days-1-5": [],
    "days-20-30": [],
    "mid-month": [],
  };

  for (const record of records) {
    if (record.billing_status === "Vacant" || isVacantName(record.tenant_name)) continue;
    const window = paymentWindowForEntry(record.entry_date);
    if (!window) continue;
    buckets[window].push({
      billingId: record.billing_id,
      tenantName: record.tenant_name,
      amount: record.current_rent,
      balance: record.total_balance,
      entryDate: record.entry_date,
      targetMonth: record.target_month,
      billingStatus: record.billing_status,
    });
  }

  return (Object.keys(buckets) as PaymentWindow[]).map((window) => {
    const rows = buckets[window].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.tenantName.localeCompare(b.tenantName));
    return {
      window,
      label: windowLabel(window),
      rows,
      expected: rows.reduce((sum, row) => sum + row.amount, 0),
      outstanding: rows.reduce((sum, row) => sum + row.balance, 0),
    };
  });
}
