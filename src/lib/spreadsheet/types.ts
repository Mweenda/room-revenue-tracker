import type { BedSpace, BillingRecord, BillingStatus, BlockCode, Payment, RoomGender } from "../types";
import type { BillingMonth } from "../billing";

export const BOARDING_HOUSE_SHEET_NAMES = [
  "Dashboard",
  "Master Roster",
  "Arrears Report",
  "Available Bed Spaces",
  "Monthly Billing Tab",
  "Receipt Template",
  "Payments Log Archive",
  "Calc_Data",
  "Payments Log",
  "Receipt Tracking",
] as const;

export type BoardingHouseSheetName = (typeof BOARDING_HOUSE_SHEET_NAMES)[number];

export type ParsedRosterRow = {
  uniqueId: string;
  roomNumber: number;
  houseBlock: BlockCode;
  bedSpace: string;
  tenantName: string;
  phoneNumber: string;
  entryDate: string;
  monthlyRent: number;
  roomGender: RoomGender;
};

export type ParsedBillingRow = {
  billingId: string;
  houseBlock: BlockCode;
  tenantName: string;
  phoneNumber: string;
  currentRent: number;
  entryDate: string;
  targetMonth: BillingMonth | "";
  accumulatedTotal: number;
  totalBalance: number;
  billingStatus: BillingStatus;
};

export type ParsedPaymentRow = {
  uniqueId: string;
  tenantName: string;
  paymentDate: string;
  monthCovered: BillingMonth | "";
  year: number;
  amountPaid: number;
  status: string;
  receiptNumber: string;
};

export type ParsedBoardingHouse = {
  roster: ParsedRosterRow[];
  billing: ParsedBillingRow[];
  payments: ParsedPaymentRow[];
};

export type BillingPatch = Partial<BillingRecord> & { billing_id: string };
export type BedPatch = Partial<BedSpace> & { id: string };

export type SpreadsheetUploadLog = {
  storagePath: string;
  filename: string;
  paymentsUpserted: number;
  paymentsSkipped: number;
  rosterUpdated: number;
  billingUpdated: number;
};

export type SpreadsheetRepository = {
  getLandlordId(): Promise<string | null>;
  listPayments(): Promise<Payment[]>;
  listBilling(): Promise<BillingRecord[]>;
  listBeds(): Promise<BedSpace[]>;
  upsertPayments(rows: Payment[]): Promise<number>;
  updateBilling(patches: BillingPatch[]): Promise<number>;
  updateBeds(patches: BedPatch[]): Promise<number>;
  uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  logUpload(row: SpreadsheetUploadLog): Promise<void>;
};

export type SpreadsheetSyncResult = {
  status: "success";
  storagePath: string;
  recordsSynced: {
    payments: number;
    paymentsSkipped: number;
    roster: number;
    billing: number;
  };
};

export type BoardingHouseExportInput = {
  billingRecords: BillingRecord[];
  beds: BedSpace[];
  payments: Payment[];
};
