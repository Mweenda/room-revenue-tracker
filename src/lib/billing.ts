import type { BillingRecord, BillingStatus, BlockCode, UtilityBlock } from "./types";

export const OWNER_UTILITY_CAP = 70;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const BILLING_MONTHS = [...MONTH_ABBR];
export type BillingMonth = (typeof MONTH_ABBR)[number];

export const BLOCKS: BlockCode[] = ["BBH", "NWG", "ANX", "CRV"];

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentBillingMonth(): BillingMonth {
  return MONTH_ABBR[new Date().getMonth()];
}

/** Rent is due on the 1st of the target month. */
export function getDaysPastDue(targetMonth: string, year = getCurrentYear()): number {
  if (!targetMonth || targetMonth === "-") return 0;
  const idx = MONTH_ABBR.indexOf(targetMonth as BillingMonth);
  if (idx < 0) return 0;

  const due = new Date(year, idx, 1);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

export function formatMonthYear(month: BillingMonth, year = getCurrentYear()): string {
  const idx = MONTH_ABBR.indexOf(month);
  return new Date(year, idx, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function formatMonthYearShort(month: BillingMonth, year = getCurrentYear()): string {
  return `${month} ${year}`;
}

export function billingMonthOptions(year = getCurrentYear()) {
  return BILLING_MONTHS.map((month) => ({ month, label: formatMonthYear(month, year) }));
}

export function formatBillingPeriodLabel(targetMonth?: string, year = getCurrentYear()): string {
  if (!targetMonth || targetMonth === "-") return formatMonthYear(getCurrentBillingMonth(), year);
  if ((MONTH_ABBR as readonly string[]).includes(targetMonth)) {
    return formatMonthYearShort(targetMonth as BillingMonth, year);
  }
  return targetMonth;
}

export function refreshBillingRecord(record: BillingRecord): BillingRecord {
  if (record.billing_status === "Vacant" || record.tenant_name.trim().toLowerCase() === "vacant") {
    return record;
  }

  const targetMonth = record.target_month === "-" ? getCurrentBillingMonth() : record.target_month;
  const daysPastDue = getDaysPastDue(targetMonth);
  const billing_status = computeBillingStatus(
    record.tenant_name,
    record.total_balance,
    record.current_rent,
    daysPastDue,
    targetMonth,
    getCurrentBillingMonth(),
  );

  return { ...record, target_month: targetMonth, days_past_due: daysPastDue, billing_status };
}

export function refreshBillingRecords(records: BillingRecord[]): BillingRecord[] {
  return records.map(refreshBillingRecord);
}

/**
 * Returns the live billing roster labelled for `month`.
 *
 * Historical months are not fabricated: `billing_records` stores the current
 * cycle only. Callers that need a past period should load `financial_snapshots`.
 */
export function billingRecordsForMonth(records: BillingRecord[], month: BillingMonth): BillingRecord[] {
  const refreshed = refreshBillingRecords(records);
  const currentMonth = getCurrentBillingMonth();

  return refreshed.map((record) => {
    if (record.billing_status === "Vacant" || record.tenant_name.trim().toLowerCase() === "vacant") {
      return { ...record, target_month: "-" };
    }
    if (month === currentMonth) return { ...record, target_month: month };
    return { ...record, target_month: record.target_month === "-" ? month : record.target_month };
  });
}

/** Client-side mirror of SQL compute_billing_status */
export function computeBillingStatus(
  tenantName: string,
  totalBalance: number,
  currentRent: number,
  daysPastDue: number,
  targetMonth: string,
  currentMonth: string = getCurrentBillingMonth(),
): BillingStatus {
  if (!tenantName || tenantName.trim().toLowerCase() === "vacant") return "Vacant";
  if (totalBalance === 0) return "Paid / Secured";
  if (totalBalance > 0 && (daysPastDue > 5 || ["Mar", "Jun"].includes(targetMonth))) {
    return "OVERDUE / UNPAID";
  }
  if (totalBalance > 0 && daysPastDue >= 1 && daysPastDue <= 5) return "Grace Period";
  if (totalBalance === currentRent && targetMonth === currentMonth) return "Open Window";
  if (totalBalance > 0) return "Open Window";
  return "Vacant";
}

export function calcUtilitySplit(totalCost: number, activeStudents: number, ownerCap = OWNER_UTILITY_CAP) {
  const ownerContribution = Math.min(ownerCap * activeStudents, totalCost);
  const excess = Math.max(0, totalCost - ownerContribution);
  const studentShare = activeStudents > 0 ? excess / activeStudents : 0;
  return { ownerContribution, excess, studentShare };
}

export function summarizeBillingByStatus(records: BillingRecord[]) {
  const statuses: BillingStatus[] = [
    "Open Window",
    "Paid / Secured",
    "OVERDUE / UNPAID",
    "Vacant",
    "Grace Period",
  ];
  return statuses.map((status) => {
    const rows = records.filter((r) => r.billing_status === status);
    return {
      status,
      bedCount: rows.length,
      capacityValue: rows.reduce((s, r) => s + r.current_rent, 0),
    };
  });
}

export function fmtKwacha(n: number) {
  return `K${n.toLocaleString()}`;
}

export type UtilityCalcPreview = ReturnType<typeof calcUtilitySplit> & {
  cost: number;
  n: number;
};

export function previewUtilityEntry(
  totalCost: number,
  activeStudents: number,
): UtilityCalcPreview {
  const split = calcUtilitySplit(totalCost, activeStudents);
  return { cost: totalCost, n: activeStudents, ...split };
}

export function mergeUtilityEntry(
  existing: UtilityBlock[],
  entry: UtilityBlock,
): UtilityBlock[] {
  return [
    ...existing.filter((u) => !(u.blockCode === entry.blockCode && u.month === entry.month)),
    entry,
  ];
}
