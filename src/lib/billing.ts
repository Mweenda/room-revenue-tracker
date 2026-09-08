import { isVacantName } from "./occupancy";
import type { BillingRecord, BillingStatus, BlockCode, UtilityBlock } from "./types";

export const OWNER_UTILITY_CAP = 70;
/** Rent due on the 1st; overdue only after this many days have elapsed. */
export const GRACE_PERIOD_DAYS = 5;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const BILLING_MONTHS = [...MONTH_ABBR];
export type BillingMonth = (typeof MONTH_ABBR)[number];

export const BLOCKS: BlockCode[] = ["BBH", "UPV", "CRV", "ANX", "NWG"];

/** Blocks actually present on the property, in house order, then any extras. */
export function blocksInData(
  items: Array<{ blockCode?: string; house_block?: string }>,
): BlockCode[] {
  const seen = new Set<string>();
  for (const item of items) {
    const code = item.blockCode ?? item.house_block;
    if (code) seen.add(code);
  }
  if (seen.size === 0) return [...BLOCKS];
  const extras = [...seen].filter((code) => !(BLOCKS as string[]).includes(code)).sort();
  return [...BLOCKS.filter((code) => seen.has(code)), ...extras] as BlockCode[];
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentBillingMonth(): BillingMonth {
  return MONTH_ABBR[new Date().getMonth()];
}

/** Rent is due on the 1st of the target month. */
export function getDaysPastDue(
  targetMonth: string,
  year = getCurrentYear(),
  today = new Date(),
  unpaid = true,
): number {
  if (!targetMonth || targetMonth === "-") return 0;
  const idx = MONTH_ABBR.indexOf(targetMonth as BillingMonth);
  if (idx < 0) return 0;

  let dueYear = year;
  if (idx > today.getMonth()) {
    if (!unpaid) return 0;
    dueYear = year - 1;
  }

  const due = new Date(dueYear, idx, 1);
  const now = new Date(today);
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

export function isOverdueAfterGrace(
  daysPastDue: number,
  totalBalance: number,
  graceDays = GRACE_PERIOD_DAYS,
): boolean {
  return totalBalance > 0 && daysPastDue > graceDays;
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
  if (record.billing_status === "Vacant" || isVacantName(record.tenant_name)) {
    return record;
  }

  const targetMonth = record.target_month === "-" ? getCurrentBillingMonth() : record.target_month;
  const daysPastDue = getDaysPastDue(targetMonth, getCurrentYear(), new Date(), record.total_balance > 0);
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
export function billingRecordsForMonth(records: BillingRecord[], _month: BillingMonth): BillingRecord[] {
  return refreshBillingRecords(records);
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
  if (isVacantName(tenantName)) return "Vacant";
  if (totalBalance === 0) return "Paid / Secured";
  if (isOverdueAfterGrace(daysPastDue, totalBalance)) return "OVERDUE / UNPAID";
  if (totalBalance > 0 && daysPastDue >= 1 && daysPastDue <= GRACE_PERIOD_DAYS) return "Grace Period";
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
