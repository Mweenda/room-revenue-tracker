import type { BedSpace, BillingRecord } from "./types";

export type OccupancyIssueCode =
  | "bed_occupied_no_tenant"
  | "bed_vacant_has_tenant"
  | "billing_vacant_has_tenant"
  | "billing_occupied_no_tenant"
  | "duplicate_email"
  | "duplicate_auth_user"
  | "duplicate_phone";

export interface OccupancyIssue {
  issue_code: OccupancyIssueCode;
  severity: "error" | "warning";
  bed_space_id: string;
  details: string;
}

/** True when a billing/tenant name is missing — not a real occupant. */
export function isVacantName(name?: string | null): boolean {
  const value = (name ?? "").trim().toLowerCase();
  return value === "" || value === "vacant" || value === "-";
}

/** Blank UI value for missing contact/date fields. Hides "-" and "Vacant". */
export function displayOptional(value?: string | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "vacant") return "";
  return trimmed;
}

/** Fields written when a bed has no tenant. Status stays Vacant; names stay empty. */
export function vacantBillingPatch(): Pick<
  BillingRecord,
  | "tenant_name"
  | "phone_number"
  | "entry_date"
  | "target_month"
  | "accumulated_total"
  | "total_balance"
  | "days_past_due"
  | "billing_status"
> {
  return {
    tenant_name: "",
    phone_number: "",
    entry_date: "",
    target_month: "",
    accumulated_total: 0,
    total_balance: 0,
    days_past_due: 0,
    billing_status: "Vacant",
  };
}

export type OccupancyBillingCarry = Pick<
  BillingRecord,
  "total_balance" | "accumulated_total" | "days_past_due" | "target_month"
>;

/**
 * Outstanding ledger that must follow a tenant onto a new bed.
 * Mirrors `update_tenant` / `complete_student_onboarding` so a bed change
 * cannot zero the old occupancy row and leave the new bed at a vacant 0 balance.
 */
export function occupancyBillingCarry(
  record?: OccupancyBillingCarry | null,
): OccupancyBillingCarry {
  const target = (record?.target_month ?? "").trim();
  return {
    total_balance: Number(record?.total_balance ?? 0),
    accumulated_total: Number(record?.accumulated_total ?? 0),
    days_past_due: Number(record?.days_past_due ?? 0),
    target_month: target === "" ? "-" : target,
  };
}

/**
 * Client counterpart of `complete_student_onboarding` when an already-assigned
 * student picks a different vacant bed during invite setup.
 */
export function applyOnboardingBedMove(
  oldBilling: BillingRecord,
  newBilling: BillingRecord,
  tenant: { name: string; phone: string; moveInDate: string },
  newBed: Pick<BedSpace, "blockCode" | "roomNumber" | "bedLetter" | "rentAmount" | "roomGender">,
): { vacated: BillingRecord; occupied: BillingRecord } {
  return {
    vacated: {
      ...oldBilling,
      ...vacantBillingPatch(),
    },
    occupied: {
      ...newBilling,
      house_block: newBed.blockCode,
      room_number: String(newBed.roomNumber),
      bed_space: newBed.bedLetter,
      room_gender: newBed.roomGender ?? newBilling.room_gender,
      tenant_name: tenant.name,
      phone_number: tenant.phone,
      entry_date: tenant.moveInDate,
      current_rent: newBed.rentAmount,
      ...occupancyBillingCarry(oldBilling),
    },
  };
}

export function bedHasTenant(bed: BedSpace): boolean {
  return Boolean(bed.student?.id && !isVacantName(bed.student.name));
}

/** Digits-only form of a tenant phone. Empty / "-" is treated as missing. */
export function normalizeTenantPhone(phone?: string | null): string {
  return (phone ?? "").replace(/[^\d]/g, "");
}

export function findBedsSharingPhone(
  beds: BedSpace[],
  phone: string,
  exceptTenantId?: string,
): BedSpace[] {
  const normalized = normalizeTenantPhone(phone);
  if (!normalized) return [];
  return beds.filter((bed) => {
    if (!bedHasTenant(bed)) return false;
    if (exceptTenantId && bed.student?.id === exceptTenantId) return false;
    return normalizeTenantPhone(bed.student?.phone) === normalized;
  });
}

export function assertUniqueActivePhone(
  beds: BedSpace[],
  phone: string,
  exceptTenantId?: string,
): void {
  const clash = findBedsSharingPhone(beds, phone, exceptTenantId)[0];
  if (clash) {
    throw new Error(`Phone ${phone.trim()} is already assigned to bed ${clash.id}`);
  }
}

export function isBillingVacant(record?: BillingRecord): boolean {
  if (!record) return true;
  return record.billing_status === "Vacant" || isVacantName(record.tenant_name);
}

/** A bed is assignable when it has no tenant (tenants table is source of truth). */
export function isBedAssignable(bed: BedSpace, billing?: BillingRecord): boolean {
  return !bedHasTenant(bed) && isBillingVacant(billing);
}

export function deriveBedFromTenantAndBilling(
  bed: BedSpace,
  billing?: BillingRecord,
): BedSpace {
  if (!bedHasTenant(bed)) {
    return { ...bed, status: "vacant", student: undefined };
  }

  const student = bed.student!;
  if (!billing || isBillingVacant(billing)) {
    return { ...bed, status: "occupied", student };
  }

  if (student.name.trim().toLowerCase() === billing.tenant_name.trim().toLowerCase()) {
    return { ...bed, status: "occupied", student };
  }

  return {
    ...bed,
    status: "occupied",
    student: {
      ...student,
      name: billing.tenant_name,
      phone: billing.phone_number,
      moveInDate: billing.entry_date,
    },
  };
}

/** Offline audit mirroring SQL audit_occupancy(). */
export function auditOccupancyLocal(
  beds: BedSpace[],
  billingRecords: BillingRecord[],
): OccupancyIssue[] {
  const issues: OccupancyIssue[] = [];
  const billingByBed = new Map(billingRecords.map((r) => [r.billing_id, r]));
  const emailBeds = new Map<string, string[]>();
  const phoneBeds = new Map<string, string[]>();

  for (const bed of beds) {
    const billing = billingByBed.get(bed.id);
    const hasTenant = bedHasTenant(bed);
    const billingVacant = isBillingVacant(billing);

    if (bed.status === "occupied" && !hasTenant) {
      issues.push({
        issue_code: "bed_occupied_no_tenant",
        severity: "error",
        bed_space_id: bed.id,
        details: "Bed status is occupied but no tenant is linked",
      });
    }

    if (bed.status === "vacant" && hasTenant) {
      issues.push({
        issue_code: "bed_vacant_has_tenant",
        severity: "error",
        bed_space_id: bed.id,
        details: `Bed status is vacant but ${bed.student!.name} is assigned`,
      });
    }

    if (hasTenant && billingVacant) {
      issues.push({
        issue_code: "billing_vacant_has_tenant",
        severity: "error",
        bed_space_id: bed.id,
        details: `Billing is Vacant but ${bed.student!.name} is assigned`,
      });
    }

    if (!hasTenant && billing && !billingVacant) {
      issues.push({
        issue_code: "billing_occupied_no_tenant",
        severity: "error",
        bed_space_id: bed.id,
        details: `Billing shows ${billing.tenant_name} but no tenant row exists`,
      });
    }

    const email = bed.student?.email?.trim().toLowerCase();
    if (email) {
      const list = emailBeds.get(email) ?? [];
      list.push(bed.id);
      emailBeds.set(email, list);
    }

    const phone = bed.student?.phone?.trim();
    if (phone && phone !== "-") {
      const list = phoneBeds.get(phone) ?? [];
      list.push(bed.id);
      phoneBeds.set(phone, list);
    }
  }

  for (const [email, bedIds] of emailBeds) {
    if (bedIds.length > 1) {
      issues.push({
        issue_code: "duplicate_email",
        severity: "error",
        bed_space_id: bedIds.join(", "),
        details: `Email ${email} assigned to multiple beds`,
      });
    }
  }

  for (const [phone, bedIds] of phoneBeds) {
    if (bedIds.length > 1) {
      issues.push({
        issue_code: "duplicate_phone",
        severity: "warning",
        bed_space_id: bedIds.join(", "),
        details: `Phone ${phone} used on multiple beds`,
      });
    }
  }

  return issues;
}

export function reconcileBedsLocal(
  beds: BedSpace[],
  billingRecords: BillingRecord[],
): { beds: BedSpace[]; billingRecords: BillingRecord[] } {
  const billingByBed = new Map(billingRecords.map((r) => [r.billing_id, r]));
  const nextBilling = [...billingRecords];

  const nextBeds = beds.map((bed) => {
    const billing = billingByBed.get(bed.id);
    const reconciled = deriveBedFromTenantAndBilling(bed, billing);

    if (!bedHasTenant(reconciled)) {
      const idx = nextBilling.findIndex((r) => r.billing_id === bed.id);
      const vacantRecord: BillingRecord = {
        billing_id: bed.id,
        house_block: billing?.house_block ?? bed.blockCode,
        room_number: billing?.room_number ?? String(bed.roomNumber),
        bed_space: billing?.bed_space ?? bed.bedLetter,
        room_gender: billing?.room_gender ?? bed.roomGender ?? "Male",
        current_rent: billing?.current_rent ?? bed.rentAmount,
        ...vacantBillingPatch(),
      };
      if (idx >= 0) nextBilling[idx] = vacantRecord;
      else nextBilling.push(vacantRecord);
    }

    return reconciled;
  });

  return { beds: nextBeds, billingRecords: nextBilling };
}
