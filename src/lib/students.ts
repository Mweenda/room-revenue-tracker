import type { StudentAccountRow } from "./api/students";
import type { BedSpace, BillingRecord, TenantStatus, UpdateStudentAccountInput } from "./types";
import { bedHasTenant } from "./occupancy";

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
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Active",
  evicted: "Evicted",
  moved_out: "Moved Out",
};

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

  const student = {
    ...currentBed.student,
    name,
    phone: input.phone.trim() || "-",
    email: input.email.trim() || "-",
    nrc: input.nrc?.trim() || currentBed.student.nrc,
    moveInDate: input.moveInDate || currentBed.student.moveInDate,
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
        tenant_name: "Vacant",
        phone_number: "-",
        entry_date: "-",
        total_balance: 0,
        accumulated_total: 0,
        days_past_due: 0,
        target_month: "-",
        billing_status: "Vacant" as const,
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
  });

  return { beds: nextBeds, billingRecords: nextBilling };
}
