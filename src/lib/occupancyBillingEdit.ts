import {
  BILLING_MONTHS,
  GRACE_PERIOD_DAYS,
  computeBillingStatus,
  getCurrentBillingMonth,
  getCurrentYear,
  getDaysPastDue,
  type BillingMonth,
} from "./billing";
import { lastVerifiedPayment } from "./paymentsEdit";
import { addBillingMonths, monthsFromTo } from "./paymentTracking";
import type {
  BedSpace,
  BillingRecord,
  BillingStatus,
  Payment,
  PaymentMethod,
  RoomGender,
} from "./types";

export type OccupancyAdminEditInput = {
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  moveInDate: string;
  gender?: RoomGender;
  bedId: string;
  rentAmount: number;
  billingStatus: Exclude<BillingStatus, "Vacant">;
  targetMonth: BillingMonth;
  monthsCovered: number;
  totalBalance?: number;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
};

export type OccupancyEditClock = {
  today?: Date;
  currentMonth?: BillingMonth;
};

export function occupancyCoverageFromBilling(
  record: BillingRecord,
  currentMonth: BillingMonth = getCurrentBillingMonth(),
): { monthsCovered: number; startMonth: BillingMonth } {
  const target = (BILLING_MONTHS as readonly string[]).includes(record.target_month)
    ? (record.target_month as BillingMonth)
    : currentMonth;
  if (record.total_balance > 0 || record.billing_status !== "Paid / Secured") {
    return { monthsCovered: 1, startMonth: target };
  }
  const ahead = monthsFromTo(currentMonth, target);
  const behind = monthsFromTo(target, currentMonth);
  const monthsCovered = ahead > 0 && ahead < behind ? ahead + 1 : 1;
  return {
    monthsCovered,
    startMonth: addBillingMonths(target, -(monthsCovered - 1)),
  };
}

export function occupancyEditDefaults(
  bed: BedSpace,
  billing: BillingRecord | undefined,
  lastPay: Payment | null,
  currentMonth: BillingMonth = getCurrentBillingMonth(),
): OccupancyAdminEditInput {
  const coverage = billing ? occupancyCoverageFromBilling(billing, currentMonth) : { monthsCovered: 1, startMonth: currentMonth };
  const status = billing?.billing_status === "Vacant" || !billing?.billing_status
    ? "Open Window"
    : billing.billing_status;
  const receipt = lastPay?.bedSpaceId === bed.id ? lastPay : null;
  return {
    tenantId: bed.student?.id ?? "",
    name: bed.student?.name ?? "",
    phone: bed.student?.phone ?? "",
    email: bed.student?.email ?? "",
    moveInDate: bed.student?.moveInDate ?? "",
    gender: bed.student?.gender ?? bed.roomGender,
    bedId: bed.id,
    rentAmount: bed.rentAmount,
    billingStatus: status,
    targetMonth: coverage.startMonth,
    monthsCovered: coverage.monthsCovered,
    totalBalance: billing?.total_balance,
    paymentDate: receipt?.submittedAt ?? "",
    paymentAmount: receipt?.amount ?? 0,
    paymentMethod: receipt?.method ?? "Cash",
    paymentRef: receipt?.transactionRef,
  };
}

function monthsCoveredValue(raw: number): number {
  const months = Math.floor(Number(raw));
  if (!Number.isFinite(months) || months < 1) throw new Error("Covered months must be at least 1");
  if (months > 12) throw new Error("Covered months cannot exceed 12");
  return months;
}

export function occupancyBillingPatch(
  record: BillingRecord,
  input: OccupancyAdminEditInput,
  clock: OccupancyEditClock = {},
): BillingRecord {
  const today = clock.today ?? new Date();
  const currentMonth = clock.currentMonth ?? getCurrentBillingMonth();
  const monthsCovered = monthsCoveredValue(input.monthsCovered);
  const rent = Number(input.rentAmount);
  if (!(rent > 0)) throw new Error("Monthly rent must be greater than zero");
  if (!(BILLING_MONTHS as readonly string[]).includes(input.targetMonth)) {
    throw new Error("Choose a valid target month");
  }

  let totalBalance = record.total_balance;
  let targetMonth: BillingMonth = input.targetMonth;

  if (input.billingStatus === "Paid / Secured") {
    totalBalance = 0;
    targetMonth = addBillingMonths(input.targetMonth, monthsCovered - 1);
  } else if (input.billingStatus === "OVERDUE / UNPAID") {
    const requested = input.totalBalance;
    totalBalance = requested != null && requested > 0 ? requested : Math.max(record.total_balance, rent);
    targetMonth = input.targetMonth;
  } else {
    totalBalance = input.totalBalance != null && input.totalBalance > 0 ? input.totalBalance : rent;
    targetMonth = input.targetMonth;
  }

  let daysPastDue = getDaysPastDue(targetMonth, getCurrentYear(), today, totalBalance > 0);
  if (input.billingStatus === "Paid / Secured") daysPastDue = 0;
  if (input.billingStatus === "OVERDUE / UNPAID") daysPastDue = Math.max(daysPastDue, GRACE_PERIOD_DAYS + 1);
  if (input.billingStatus === "Grace Period") {
    daysPastDue = Math.min(Math.max(daysPastDue, 1), GRACE_PERIOD_DAYS);
  }
  if (input.billingStatus === "Open Window") daysPastDue = 0;

  const billingStatus = computeBillingStatus(
    input.name.trim() || record.tenant_name,
    totalBalance,
    rent,
    daysPastDue,
    targetMonth,
    currentMonth,
  );

  return {
    ...record,
    tenant_name: input.name.trim() || record.tenant_name,
    phone_number: input.phone,
    entry_date: input.moveInDate || record.entry_date,
    current_rent: rent,
    total_balance: totalBalance,
    target_month: targetMonth,
    days_past_due: daysPastDue,
    billing_status: billingStatus,
  };
}

function occupancyPaymentOverride(
  lastPayment: Payment | null,
  input: OccupancyAdminEditInput,
): { action: "none" | "update" | "insert"; payment: Payment | null } {
  const date = input.paymentDate.trim();
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const amount = Number(input.paymentAmount);
  const method = input.paymentMethod;
  if (method !== "Airtel" && method !== "MTN" && method !== "Cash") {
    throw new Error("Choose Airtel, MTN, or Cash");
  }

  const existing = lastPayment?.bedSpaceId === input.bedId ? lastPayment : null;
  if (existing) {
    if (!hasDate) return { action: "none", payment: null };
    const nextAmount = amount > 0 ? amount : existing.amount;
    if (!(nextAmount > 0)) throw new Error("Payment amount must be greater than zero");
    return {
      action: "update",
      payment: {
        ...existing,
        amount: nextAmount,
        method,
        transactionRef: input.paymentRef?.trim() || existing.transactionRef,
        submittedAt: date,
        studentName: input.name.trim() || existing.studentName,
        bedSpaceId: input.bedId,
      },
    };
  }

  if (!hasDate || !(amount > 0)) return { action: "none", payment: null };
  return {
    action: "insert",
    payment: {
      id: `p-manual-${Date.now()}`,
      studentName: input.name.trim(),
      bedSpaceId: input.bedId,
      amount,
      method,
      transactionRef: input.paymentRef?.trim() || `CASH-${date.replace(/-/g, "")}`,
      submittedAt: date,
      status: "verified",
    },
  };
}

export function applyOccupancyAdminEdit(
  beds: BedSpace[],
  billingRecords: BillingRecord[],
  payments: Payment[],
  input: OccupancyAdminEditInput,
  clock: OccupancyEditClock = {},
): {
  beds: BedSpace[];
  billingRecords: BillingRecord[];
  payments: Payment[];
  paymentAction: "none" | "update" | "insert";
  payment: Payment | null;
} {
  const name = input.name.trim();
  if (!name) throw new Error("A student name is required");
  if (!input.bedId) throw new Error("A bed space is required");
  if (!input.tenantId) throw new Error("A student is required");

  const bed = beds.find((row) => row.id === input.bedId);
  if (!bed) throw new Error("Bed space not found");
  const record = billingRecords.find((row) => row.billing_id === input.bedId);
  if (!record) throw new Error("Billing record not found");

  const nextBillingRow = occupancyBillingPatch(record, input, clock);
  const lastPay = lastVerifiedPayment(payments, input.bedId, name);
  const pay = occupancyPaymentOverride(lastPay, input);

  const nextBeds = beds.map((row) => {
    if (row.id !== input.bedId) return row;
    return {
      ...row,
      rentAmount: nextBillingRow.current_rent,
      student: row.student
        ? {
            ...row.student,
            name,
            phone: input.phone,
            email: input.email,
            moveInDate: input.moveInDate || row.student.moveInDate,
            gender: input.gender ?? row.student.gender,
          }
        : row.student,
    };
  });

  const nextBilling = billingRecords.map((row) => (row.billing_id === input.bedId ? nextBillingRow : row));
  let nextPayments = payments;
  if (pay.action === "update" && pay.payment) {
    nextPayments = payments.map((row) => (row.id === pay.payment?.id ? pay.payment : row));
  } else if (pay.action === "insert" && pay.payment) {
    nextPayments = [pay.payment, ...payments];
  }

  return {
    beds: nextBeds,
    billingRecords: nextBilling,
    payments: nextPayments,
    paymentAction: pay.action,
    payment: pay.payment,
  };
}
