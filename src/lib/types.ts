export type BlockCode = "BBH" | "NWG" | "ANX" | "CRV";
export type BedStatus = "occupied" | "vacant";
export type PayStatus = "pending" | "verified" | "rejected";
export type IssueStatus = "open" | "in_progress" | "resolved";
export type IssueCategory = "Plumbing" | "Electrical" | "Structural" | "Appliance";
export type LandlordView = "portal" | "revenue" | "pay" | "utilities" | "students" | "reports" | "profile" | "settings";
export type TenantStatus = "active" | "evicted" | "moved_out";
export type StudentView = "home" | "notifications" | "profile" | "settings";
export type Role = "landlord" | "student";
export type BillingStatus = "Open Window" | "Paid / Secured" | "OVERDUE / UNPAID" | "Vacant" | "Grace Period";
export type PaymentMethod = "Airtel" | "MTN";
export type RoomGender = "Male" | "Female";

export interface Student {
  id: string;
  name: string;
  phone: string;
  nrc: string;
  email: string;
  moveInDate: string;
  profileImageUrl?: string;
}

export interface BedSpace {
  id: string;
  blockCode: BlockCode;
  roomNumber: number;
  bedLetter: string;
  identifier: string;
  status: BedStatus;
  student?: Student;
  rentAmount: number;
}

export interface BillingRecord {
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
  billing_status: BillingStatus;
}

export interface Payment {
  id: string;
  studentName: string;
  bedSpaceId: string;
  amount: number;
  method: PaymentMethod;
  transactionRef: string;
  submittedAt: string;
  status: PayStatus;
  rejectionReason?: string;
  proofUrl?: string;
}

export interface MaintenanceIssue {
  id: string;
  bedSpaceId: string;
  studentName: string;
  category: IssueCategory;
  description: string;
  reportedDate: string;
  status: IssueStatus;
  resolutionNote?: string;
  imageUrl?: string;
}

export interface UtilityBlock {
  id?: string;
  blockCode: BlockCode;
  month: string;
  totalCost: number;
  activeStudents: number;
  ownerContribution: number;
  excess: number;
  studentsSettled: string[];
}

export interface OnboardStudentInput {
  bedId: string;
  name: string;
  phone: string;
  email: string;
  moveInDate: string;
  nrc?: string;
  rentAmount?: number;
}

export interface UpdateStudentAccountInput {
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  nrc?: string;
  moveInDate: string;
  bedSpaceId: string;
  rentAmount: number;
}

export interface SubmitPaymentInput {
  studentName: string;
  bedSpaceId: string;
  amount: number;
  method: PaymentMethod;
  transactionRef: string;
  proofUrl?: string;
}

export interface SubmitIssueInput {
  bedSpaceId: string;
  studentName: string;
  category: IssueCategory;
  description: string;
  imageUrl?: string;
}
