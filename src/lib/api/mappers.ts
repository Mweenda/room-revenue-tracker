import type {
  BedSpace,
  BillingRecord,
  BlockCode,
  MaintenanceIssue,
  Payment,
  RoomGender,
  Student,
  UtilityBlock,
} from "../types";

type BedRow = {
  id: string;
  block_code: BlockCode;
  room_number: number;
  bed_letter: string;
  room_gender: RoomGender;
  rent_amount: number;
  status: "occupied" | "vacant";
  tenants?: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    nrc: string | null;
    move_in_date: string | null;
    profile_image_url?: string | null;
  }> | null;
};

type BillingRow = {
  billing_id: string;
  house_block: BlockCode;
  room_number: string;
  bed_space: string;
  room_gender: RoomGender;
  tenant_name: string;
  phone_number: string;
  entry_date: string;
  current_rent: number;
  target_month: string;
  accumulated_total: number;
  total_balance: number;
  days_past_due: number;
  billing_status: BillingRecord["billing_status"];
};

type PaymentRow = {
  id: string;
  student_name: string;
  bed_space_id: string;
  amount: number;
  method: Payment["method"];
  transaction_ref: string;
  submitted_at: string;
  status: Payment["status"];
  rejection_reason: string | null;
  proof_url: string | null;
};

type IssueRow = {
  id: string;
  bed_space_id: string;
  student_name: string;
  category: MaintenanceIssue["category"];
  description: string;
  reported_date: string;
  status: MaintenanceIssue["status"];
  resolution_note: string | null;
  image_url: string | null;
};

type UtilityRow = {
  id: string;
  block_code: BlockCode;
  month: string;
  total_cost: number;
  active_students: number;
  owner_contribution: number;
  excess: number;
  students_settled: string[] | null;
};

function mapStudent(t: NonNullable<BedRow["tenants"]>[number]): Student {
  return {
    id: t.id,
    name: t.full_name,
    phone: t.phone ?? "-",
    nrc: t.nrc ?? "-",
    email: t.email ?? "",
    moveInDate: t.move_in_date ?? "-",
    profileImageUrl: t.profile_image_url ?? undefined,
  };
}

export function mapBed(row: BedRow): BedSpace {
  const tenant = row.tenants?.[0];
  const hasTenant = Boolean(tenant);
  return {
    id: row.id,
    blockCode: row.block_code,
    roomNumber: row.room_number,
    bedLetter: row.bed_letter,
    identifier: row.id,
    status: hasTenant ? "occupied" : "vacant",
    student: tenant ? mapStudent(tenant) : undefined,
    rentAmount: Number(row.rent_amount),
  };
}

export function mapBilling(row: BillingRow): BillingRecord {
  return {
    billing_id: row.billing_id,
    house_block: row.house_block,
    room_number: row.room_number,
    bed_space: row.bed_space,
    room_gender: row.room_gender,
    tenant_name: row.tenant_name,
    phone_number: row.phone_number,
    entry_date: row.entry_date,
    current_rent: Number(row.current_rent),
    target_month: row.target_month,
    accumulated_total: Number(row.accumulated_total),
    total_balance: Number(row.total_balance),
    days_past_due: row.days_past_due,
    billing_status: row.billing_status,
  };
}

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    studentName: row.student_name,
    bedSpaceId: row.bed_space_id,
    amount: Number(row.amount),
    method: row.method,
    transactionRef: row.transaction_ref,
    submittedAt: row.submitted_at,
    status: row.status,
    rejectionReason: row.rejection_reason ?? undefined,
    proofUrl: row.proof_url ?? undefined,
  };
}

export function mapIssue(row: IssueRow): MaintenanceIssue {
  return {
    id: row.id,
    bedSpaceId: row.bed_space_id,
    studentName: row.student_name,
    category: row.category,
    description: row.description,
    reportedDate: row.reported_date,
    status: row.status,
    resolutionNote: row.resolution_note ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

export function mapUtility(row: UtilityRow): UtilityBlock {
  return {
    id: row.id,
    blockCode: row.block_code,
    month: row.month,
    totalCost: Number(row.total_cost),
    activeStudents: row.active_students,
    ownerContribution: Number(row.owner_contribution),
    excess: Number(row.excess),
    studentsSettled: row.students_settled ?? [],
  };
}
