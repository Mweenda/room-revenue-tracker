import type { StudentAccountRow } from "./api/students";
import type { BedSpace, BillingRecord, BlockCode, ManualPaymentInput, Payment, RoomGender, TenantStatus, UpdateStudentAccountInput } from "./types";
import { assertUniqueActivePhone, bedHasTenant, vacantBillingPatch } from "./occupancy";
import { occupancyBillingPatch, occupancyCoverageFromBilling } from "./occupancyBillingEdit";
import { lastVerifiedPayment } from "./paymentsEdit";
import { applyPaymentToLedger } from "./paymentTracking";
import { rentDueDateIso } from "./rentDue";
import { BILLING_MONTHS, getCurrentBillingMonth, getCurrentYear, refreshBillingRecord, type BillingMonth } from "./billing";

/**
 * Builds the Students page rows from in-memory beds and billing, so the page
 * behaves identically when Supabase is not configured and the seed data is used.
 */
export function deriveStudentAccounts(
  beds: BedSpace[],
  billingRecords: BillingRecord[],
): StudentAccountRow[] {
  const billingByBed = new Map(billingRecords.map((record) => [record.billing_id, record]));

  return beds
    .filter((bed) => Boolean(bed.student))
    .map((bed) => {
      const billing = billingByBed.get(bed.id);
      const student = bed.student!;
      return {
        id: student.id,
        full_name: student.name,
        email: student.email || null,
        phone: student.phone || null,
        nrc: student.nrc || null,
        move_in_date: student.moveInDate || null,
        profile_image_url: student.profileImageUrl ?? null,
        gender: student.gender ?? billing?.room_gender ?? bed.roomGender ?? null,
        bed_space_id: bed.id,
        tenant_status: "active" as TenantStatus,
        status_changed_at: null,
        status_reason: null,
        bed_status: bed.status,
        block_code: bed.blockCode,
        room_number: bed.roomNumber,
        bed_letter: bed.bedLetter,
        rent_amount: bed.rentAmount,
        total_balance: billing?.total_balance ?? null,
        billing_status: billing?.billing_status ?? null,
        days_past_due: billing?.days_past_due ?? null,
        last_payment_at: null,
        last_payment_amount: null,
        due_date: rentDueDateIso(billing?.target_month ?? "-", getCurrentYear()),
        room_gender: billing?.room_gender ?? bed.roomGender ?? null,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  evicted: "Evicted",
  moved_out: "Moved Out",
};

export const STUDENT_BILLING_FILTERS = [
  { id: "all", label: "All" },
  { id: "Open Window", label: "Open Window" },
  { id: "Paid / Secured", label: "Paid" },
  { id: "Grace Period", label: "Grace" },
  { id: "OVERDUE / UNPAID", label: "Overdue" },
] as const;

export type StudentBillingFilter = (typeof STUDENT_BILLING_FILTERS)[number]["id"];
export type StudentTenantFilter = TenantStatus | "all" | "removed";

export const STUDENT_TENANT_FILTERS: { id: StudentTenantFilter; label: string }[] = [
  { id: "active", label: TENANT_STATUS_LABEL.active },
  { id: "evicted", label: TENANT_STATUS_LABEL.evicted },
  { id: "moved_out", label: TENANT_STATUS_LABEL.moved_out },
  { id: "removed", label: "Removed" },
  { id: "all", label: "All" },
];

export function matchesStudentBillingStatus(
  row: Pick<StudentAccountRow, "billing_status">,
  filter: StudentBillingFilter,
): boolean {
  if (filter === "all") return true;
  return row.billing_status === filter;
}

export function matchesStudentTenantStatus(
  row: Pick<StudentAccountRow, "tenant_status">,
  filter: StudentTenantFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "removed") return row.tenant_status === "evicted" || row.tenant_status === "moved_out";
  return row.tenant_status === filter;
}

export function filterStudentAccounts(
  students: StudentAccountRow[],
  filters: {
    search?: string;
    block?: BlockCode | "all";
    billing?: StudentBillingFilter;
    status?: StudentTenantFilter;
    gender?: RoomGender | "all";
  } = {},
): StudentAccountRow[] {
  const search = filters.search ?? "";
  const block = filters.block ?? "all";
  const billing = filters.billing ?? "all";
  const status = filters.status ?? "all";
  const gender = filters.gender ?? "all";
  return students.filter((row) =>
    matchesStudentSearch(row, search) &&
    (block === "all" || row.block_code === block) &&
    matchesStudentBillingStatus(row, billing) &&
    matchesStudentTenantStatus(row, status) &&
    (gender === "all" || row.gender === gender || row.room_gender === gender),
  );
}

export function bedLabel(row: StudentAccountRow): string {
  if (!row.block_code || row.room_number == null) return row.bed_space_id ?? "-";
  return `${row.block_code} ${row.room_number}${row.bed_letter ?? ""}`;
}

/** Case-insensitive match across the fields a landlord is likely to type. */
export function matchesStudentSearch(row: StudentAccountRow, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return [row.full_name, row.email, row.phone, row.nrc, row.bed_space_id, bedLabel(row)]
    .some((field) => (field ?? "").toLowerCase().includes(needle));
}

export function formatBedOption(bed: BedSpace): string {
  return `${bed.blockCode} ${bed.roomNumber}${bed.bedLetter}`;
}

/**
 * The student edit form always posts the Status dropdown, even when the landlord
 * is only recording a cash receipt. Occupancy status patches treat a zero
 * balance as "charge a month of rent" for Overdue / Open Window / Grace, so
 * applying that stale status after `record_manual_payment` has already zeroed
 * the ledger would silently reopen the debt.
 */
export function shouldApplyStudentBillingStatus(
  input: Pick<UpdateStudentAccountInput, "billingStatus" | "manualPayment">,
): boolean {
  if (!input.billingStatus) return false;
  return !(Number(input.manualPayment?.amount) > 0);
}

export function applyStudentAccountBillingStatus(
  record: BillingRecord,
  input: UpdateStudentAccountInput,
  extras: {
    name: string;
    phone: string;
    email: string;
    moveInDate: string;
    gender?: UpdateStudentAccountInput["gender"];
    rentAmount: number;
    bedId: string;
  },
): BillingRecord {
  if (!input.billingStatus) return record;
  const coverage = occupancyCoverageFromBilling(record);
  const targetMonth = (BILLING_MONTHS as readonly string[]).includes(record.target_month)
    ? (record.target_month as BillingMonth)
    : getCurrentBillingMonth();
  return occupancyBillingPatch(record, {
    tenantId: input.tenantId,
    name: extras.name,
    phone: extras.phone,
    email: extras.email,
    moveInDate: extras.moveInDate,
    gender: extras.gender,
    bedId: extras.bedId,
    rentAmount: extras.rentAmount,
    billingStatus: input.billingStatus,
    targetMonth: input.billingStatus === "Paid / Secured" ? coverage.startMonth : targetMonth,
    monthsCovered: input.billingStatus === "Paid / Secured" ? coverage.monthsCovered : 1,
    totalBalance: record.total_balance,
    paymentDate: "",
    paymentAmount: 0,
    paymentMethod: "Cash",
  });
}

/**
 * Offline counterpart of `update_tenant`: moves the student, updates rent, and
 * carries outstanding billing onto the new bed.
 */
export function applyStudentAccountUpdate(
  beds: BedSpace[],
  billingRecords: BillingRecord[],
  input: UpdateStudentAccountInput,
): { beds: BedSpace[]; billingRecords: BillingRecord[] } {
  const name = input.name.trim();
  if (!name) throw new Error("A full name is required");
  if (!(input.rentAmount > 0)) throw new Error("Monthly rent must be greater than zero");

  const currentBed = beds.find((bed) => bed.student?.id === input.tenantId);
  if (!currentBed?.student) throw new Error("Student not found");

  const targetBed = beds.find((bed) => bed.id === input.bedSpaceId);
  if (!targetBed) throw new Error(`Bed space ${input.bedSpaceId} not found`);

  if (targetBed.id !== currentBed.id && bedHasTenant(targetBed)) {
    throw new Error(`Bed space is already occupied by ${targetBed.student!.name}`);
  }

  const email = input.email.trim().toLowerCase();
  if (email) {
    const clash = beds.find(
      (bed) => bed.student?.id !== input.tenantId && bed.student?.email?.trim().toLowerCase() === email,
    );
    if (clash) throw new Error(`This email is already assigned to bed ${clash.id}`);
  }

  assertUniqueActivePhone(beds, input.phone, input.tenantId);

  const gender = input.gender ?? currentBed.student.gender ?? targetBed.roomGender;
  if (gender && targetBed.roomGender && gender !== targetBed.roomGender) {
    throw new Error(`Student gender must match the bed space (${targetBed.roomGender})`);
  }

  const student = {
    ...currentBed.student,
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    nrc: input.nrc?.trim() || currentBed.student.nrc,
    moveInDate: input.moveInDate || currentBed.student.moveInDate,
    gender,
  };

  const oldBilling = billingRecords.find((record) => record.billing_id === currentBed.id);

  const nextBeds = beds.map((bed) => {
    if (bed.id === currentBed.id && currentBed.id !== targetBed.id) {
      return { ...bed, status: "vacant" as const, student: undefined };
    }
    if (bed.id === targetBed.id) {
      return { ...bed, status: "occupied" as const, rentAmount: input.rentAmount, student };
    }
    return bed;
  });

  const nextBilling = billingRecords.map((record) => {
    if (currentBed.id !== targetBed.id && record.billing_id === currentBed.id) {
      return {
        ...record,
        ...vacantBillingPatch(),
      };
    }
    if (record.billing_id === targetBed.id) {
      return {
        ...record,
        house_block: targetBed.blockCode,
        room_number: String(targetBed.roomNumber),
        bed_space: targetBed.bedLetter,
        tenant_name: student.name,
        phone_number: student.phone,
        entry_date: student.moveInDate,
        current_rent: input.rentAmount,
        total_balance: currentBed.id === targetBed.id ? record.total_balance : (oldBilling?.total_balance ?? record.total_balance),
        accumulated_total: currentBed.id === targetBed.id ? record.accumulated_total : (oldBilling?.accumulated_total ?? record.accumulated_total),
        days_past_due: currentBed.id === targetBed.id ? record.days_past_due : (oldBilling?.days_past_due ?? record.days_past_due),
        target_month: currentBed.id === targetBed.id ? record.target_month : (oldBilling?.target_month ?? record.target_month),
        billing_status: currentBed.id === targetBed.id ? record.billing_status : (oldBilling?.billing_status ?? "Open Window"),
      };
    }
    return record;
  }).map((record) => {
    if (!shouldApplyStudentBillingStatus(input) || record.billing_id !== targetBed.id) return record;
    return applyStudentAccountBillingStatus(record, input, {
      name,
      phone: student.phone,
      email: student.email,
      moveInDate: student.moveInDate,
      gender,
      rentAmount: input.rentAmount,
      bedId: targetBed.id,
    });
  });

  return { beds: nextBeds, billingRecords: nextBilling };
}

export function applyManualVerifiedPayment(
  billingRecords: BillingRecord[],
  payments: Payment[],
  input: {
    bedSpaceId: string;
    studentName: string;
    payment: ManualPaymentInput;
  },
): { billingRecords: BillingRecord[]; payments: Payment[] } {
  const amount = Number(input.payment.amount);
  if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
  const submittedAt = input.payment.submittedAt || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedAt)) throw new Error("Use a valid payment date");
  const method = input.payment.method;
  if (method !== "Airtel" && method !== "MTN" && method !== "Cash") {
    throw new Error("Choose Airtel, MTN, or Cash");
  }

  const payment: Payment = {
    id: `p-manual-${Date.now()}`,
    studentName: input.studentName.trim(),
    bedSpaceId: input.bedSpaceId,
    amount,
    method,
    transactionRef: input.payment.transactionRef?.trim() || `CASH-${submittedAt.replace(/-/g, "")}`,
    submittedAt,
    status: "verified",
  };

  const nextBilling = billingRecords.map((record) => {
    if (record.billing_id !== input.bedSpaceId) return record;
    const ledger = applyPaymentToLedger({
      totalBalance: record.total_balance,
      currentRent: record.current_rent,
      targetMonth: record.target_month,
      amount,
    });
    return refreshBillingRecord({
      ...record,
      total_balance: ledger.totalBalance,
      target_month: ledger.targetMonth,
    });
  });

  return { billingRecords: nextBilling, payments: [payment, ...payments] };
}

export function enrichStudentAccounts(
  rows: StudentAccountRow[],
  payments: Payment[],
  billingRecords: BillingRecord[] = [],
  year = getCurrentYear(),
): StudentAccountRow[] {
  const billingByBed = new Map(billingRecords.map((record) => [record.billing_id, record]));
  return rows.map((row) => {
    const billing = row.bed_space_id ? billingByBed.get(row.bed_space_id) : undefined;
    const last = lastVerifiedPayment(payments, row.bed_space_id ?? "", row.full_name);
    const targetMonth = billing?.target_month ?? null;
    return {
      ...row,
      gender: row.gender ?? billing?.room_gender ?? row.room_gender ?? null,
      total_balance: billing?.total_balance ?? row.total_balance ?? null,
      billing_status: billing?.billing_status ?? row.billing_status ?? null,
      days_past_due: billing?.days_past_due ?? row.days_past_due ?? null,
      last_payment_at: last?.submittedAt ?? row.last_payment_at ?? null,
      last_payment_amount: last?.amount ?? row.last_payment_amount ?? null,
      due_date: rentDueDateIso(targetMonth ?? "-", year) ?? row.due_date,
      room_gender: row.room_gender ?? billing?.room_gender ?? null,
    };
  });
}
