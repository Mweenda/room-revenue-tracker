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

export function bedHasTenant(bed: BedSpace): boolean {
  return Boolean(bed.student?.id && bed.student.name.trim().toLowerCase() !== "vacant");
}

export function isBillingVacant(record?: BillingRecord): boolean {
  if (!record) return true;
  return record.billing_status === "Vacant" || record.tenant_name.trim().toLowerCase() === "vacant";
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
        room_gender: billing?.room_gender ?? "Male",
        tenant_name: "Vacant",
        phone_number: "-",
        entry_date: "-",
        current_rent: billing?.current_rent ?? bed.rentAmount,
        target_month: "-",
        accumulated_total: 0,
        total_balance: 0,
        days_past_due: 0,
        billing_status: "Vacant",
      };
      if (idx >= 0) nextBilling[idx] = vacantRecord;
      else nextBilling.push(vacantRecord);
    }

    return reconciled;
  });

  return { beds: nextBeds, billingRecords: nextBilling };
}
