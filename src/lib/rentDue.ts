import { BILLING_MONTHS, GRACE_PERIOD_DAYS, getCurrentYear, getDaysPastDue, type BillingMonth } from "./billing";
import type { BillingRecord } from "./types";

export type DueEventKind = "due" | "grace" | "overdue";

export type CalendarDueEvent = {
  date: string;
  billingId: string;
  tenantName: string;
  daysPastDue: number;
  kind: DueEventKind;
  balance: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function rentDueDateIso(targetMonth: string, year = getCurrentYear()): string | null {
  if (!targetMonth || targetMonth === "-") return null;
  const idx = BILLING_MONTHS.indexOf(targetMonth as BillingMonth);
  if (idx < 0) return null;
  return `${year}-${pad(idx + 1)}-01`;
}

export function daysPastDueFromCalendar(
  targetMonth: string,
  year = getCurrentYear(),
  today = new Date(),
): number {
  return getDaysPastDue(targetMonth, year, today);
}

export function dueEventKind(daysPastDue: number, totalBalance: number): DueEventKind | null {
  if (totalBalance <= 0) return null;
  if (daysPastDue > GRACE_PERIOD_DAYS) return "overdue";
  if (daysPastDue >= 1) return "grace";
  return "due";
}

export function calendarDueEvents(
  records: Array<Pick<BillingRecord, "billing_id" | "tenant_name" | "target_month" | "total_balance" | "billing_status">>,
  year = getCurrentYear(),
  today = new Date(),
): CalendarDueEvent[] {
  const events: CalendarDueEvent[] = [];
  for (const record of records) {
    if (record.billing_status === "Vacant" || record.tenant_name.trim().toLowerCase() === "vacant") continue;
    const date = rentDueDateIso(record.target_month, year);
    if (!date) continue;
    const daysPastDue = daysPastDueFromCalendar(record.target_month, year, today);
    const kind = dueEventKind(daysPastDue, record.total_balance);
    if (!kind) continue;
    events.push({
      date,
      billingId: record.billing_id,
      tenantName: record.tenant_name,
      daysPastDue,
      kind,
      balance: record.total_balance,
    });
  }
  return events;
}
