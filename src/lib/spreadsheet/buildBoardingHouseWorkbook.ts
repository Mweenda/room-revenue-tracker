import type { Worksheet } from "exceljs";
import { occupancyReport, vacantBedRows } from "../paymentTracking";
import { isVacantName } from "../occupancy";
import type { BillingRecord, BillingStatus, Payment } from "../types";
import { BOARDING_HOUSE_SHEET_NAMES } from "./types";
import type { BoardingHouseExportInput } from "./types";

const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const STATUS_LABEL: Record<BillingStatus, string> = {
  "Open Window": "🟢 Open Window",
  "Paid / Secured": "✅ Paid / Secured",
  "Grace Period": "⏳ Grace Period",
  "OVERDUE / UNPAID": "❌ OVERDUE / UNPAID",
  Vacant: "Vacant",
};

function occupiedRecords(records: BillingRecord[]): BillingRecord[] {
  return records.filter((record) => record.billing_status !== "Vacant" && !isVacantName(record.tenant_name));
}

function writeRow(sheet: Worksheet, rowNumber: number, values: Array<string | number | boolean | Date | null | undefined>, startCol = 1) {
  values.forEach((value, index) => {
    if (value == null || value === "") return;
    sheet.getCell(rowNumber, startCol + index).value = value;
  });
}

function verifiedPayments(payments: Payment[]): Payment[] {
  return payments
    .filter((payment) => payment.status === "verified")
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.bedSpaceId.localeCompare(b.bedSpaceId));
}

function monthIndex(isoDate: string): number {
  const month = Number(isoDate.slice(5, 7));
  return Number.isFinite(month) ? month - 1 : -1;
}

export async function buildBoardingHouseWorkbookBytes(input: BoardingHouseExportInput): Promise<Uint8Array> {
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Room Revenue Tracker";
  workbook.created = new Date();

  const occupied = occupiedRecords(input.billingRecords);
  const occ = occupancyReport(input.billingRecords);
  const vacant = vacantBedRows(input.billingRecords);
  const archive = verifiedPayments(input.payments);

  const dashboard = workbook.addWorksheet("Dashboard");
  dashboard.getCell("A1").value = "Executive Dashboard";
  writeRow(dashboard, 3, ["Monthly Billing Tab", null, null, "Receipt Template", null, null, "Available Bed Spaces", null, null, "Arrears Report"]);

  const roster = workbook.addWorksheet("Master Roster");
  roster.getCell("A1").value = "Master Roster";
  writeRow(roster, 3, [
    "Unique ID",
    "Room Number",
    "House/ Block",
    "Bed Space",
    "Tenant Name",
    "Phone Number",
    "Entry Date",
    "Monthly Rent",
    "ID & Name",
    "Room Gender",
  ]);
  occupied.forEach((record, index) => {
    writeRow(roster, 4 + index, [
      record.billing_id,
      Number(record.room_number) || record.room_number,
      record.house_block,
      record.bed_space,
      record.tenant_name,
      record.phone_number,
      record.entry_date,
      record.current_rent,
      `${record.billing_id} - ${record.tenant_name}`,
      record.room_gender,
    ]);
  });

  const arrears = workbook.addWorksheet("Arrears Report");
  arrears.getCell("A1").value = "Arrears Report";
  const overdue = occupied.filter((record) => record.billing_status === "OVERDUE / UNPAID");
  arrears.getCell("F2").value = overdue.reduce((sum, record) => sum + record.total_balance, 0);
  writeRow(arrears, 3, ["Tenant Name", "Phone Number", "Unique ID", "Due Date", "Days Overdue", "Total Balance"]);
  overdue.forEach((record, index) => {
    writeRow(arrears, 4 + index, [
      record.tenant_name,
      record.phone_number,
      record.billing_id,
      record.target_month,
      record.days_past_due,
      record.total_balance,
    ]);
  });

  const available = workbook.addWorksheet("Available Bed Spaces");
  available.getCell("A1").value = "Available Bed Spaces";
  available.getCell("H1").value = "Occupancy Report";
  writeRow(available, 3, ["House/ Block", "Room No.", "Bed Space", "Monthly Rent", "Status", "Room Gender"]);
  writeRow(available, 3, ["Gender", "Vacant", "Reserved", "Total"], 8);
  vacant.forEach((row, index) => {
    writeRow(available, 4 + index, [row.block, Number(row.room) || row.room, row.space, row.rent, "Vacant", row.gender]);
  });
  writeRow(available, 4, ["Male", occ.maleVacant, 0, occ.maleBeds], 8);
  writeRow(available, 5, ["Female", occ.femaleVacant, 0, occ.femaleBeds], 8);
  writeRow(available, 6, ["Total", occ.vacantBeds, 0, occ.totalBeds], 8);

  const billing = workbook.addWorksheet("Monthly Billing Tab");
  billing.getCell("A1").value = "Monthly Billing Tab";
  writeRow(billing, 3, [
    "No.",
    "Billing ID",
    "House/Block",
    "Tenant Name",
    "Phone Number",
    "Current Rent",
    "Entry Date",
    "Adjustments / Fees",
    "Adjustment Notes",
    "Target Month",
    "Accumulated Total",
    "Total Balance",
    "Billing Status",
  ]);
  occupied.forEach((record, index) => {
    writeRow(billing, 4 + index, [
      index + 1,
      record.billing_id,
      record.house_block,
      record.tenant_name,
      record.phone_number,
      record.current_rent,
      record.entry_date,
      null,
      null,
      record.target_month,
      record.accumulated_total,
      record.total_balance,
      STATUS_LABEL[record.billing_status],
    ]);
  });

  const receipt = workbook.addWorksheet("Receipt Template");
  const latest = archive.at(-1);
  receipt.getCell("B1").value = "OFFICIAL RECEIPT";
  receipt.getCell("C1").value = "Receipt No:";
  receipt.getCell("D1").value = latest?.transactionRef ?? "";
  receipt.getCell("B4").value = "Tenant ID:";
  receipt.getCell("C4").value = latest?.bedSpaceId ?? "";
  receipt.getCell("B5").value = "Date:";
  receipt.getCell("C5").value = latest?.submittedAt ?? "";

  const archiveSheet = workbook.addWorksheet("Payments Log Archive");
  archiveSheet.getCell("A1").value = "Payments Log Archive";
  writeRow(archiveSheet, 3, [
    "Unique ID",
    "Tenant Name",
    "Payment Date",
    "Month Covered",
    "Year",
    "Amount Paid",
    "Status",
    "Send Receipt",
    "Print Receipt",
    "Balance",
    "Cumulative Payments",
    "Receipt Issued",
    "Pending Receipts",
    "Receipt Number",
    "WhatsApp Receipt",
  ]);
  archive.forEach((payment, index) => {
    const monthIdx = monthIndex(payment.submittedAt);
    writeRow(archiveSheet, 4 + index, [
      payment.bedSpaceId,
      payment.studentName,
      payment.submittedAt,
      monthIdx >= 0 ? MONTH_FULL[monthIdx] : "",
      Number(payment.submittedAt.slice(0, 4)) || "",
      payment.amount,
      "Paid",
      "Send Receipt",
      "Print Receipt",
      0,
      payment.amount,
      Boolean(payment.transactionRef),
      "",
      payment.transactionRef,
      "Send Receipt",
    ]);
  });

  const calc = workbook.addWorksheet("Calc_Data");
  calc.getCell("A1").value = "Calc_Data";
  writeRow(calc, 2, ["Total Expected Revenue", occ.expectedRevenue]);
  writeRow(calc, 3, ["Active Tenants", occ.activeTenants]);
  writeRow(calc, 4, ["Total Beds", occ.totalBeds]);
  writeRow(calc, 5, ["Occupancy Rate", occ.totalBeds ? occ.activeTenants / occ.totalBeds : 0]);
  writeRow(calc, 1, ["Status", "Count"], 7);
  writeRow(calc, 2, ["Active Tenants", occ.activeTenants], 7);
  writeRow(calc, 3, ["Vacant", occ.vacantBeds], 7);

  const log = workbook.addWorksheet("Payments Log");
  log.getCell("A1").value = "Payments Log";
  writeRow(log, 3, ["Unique ID", "Tenant Name", ...MONTH_FULL, "Yearly Total"]);
  const monthlyTotals = Array(12).fill(0);
  occupied.forEach((record, index) => {
    const amounts = Array(12).fill(null as number | null);
    for (const payment of archive.filter((row) => row.bedSpaceId === record.billing_id)) {
      const idx = monthIndex(payment.submittedAt);
      if (idx < 0) continue;
      amounts[idx] = (amounts[idx] ?? 0) + payment.amount;
      monthlyTotals[idx] += payment.amount;
    }
    const yearly = amounts.reduce((sum: number, value) => sum + (value ?? 0), 0);
    writeRow(log, 5 + index, [record.billing_id, record.tenant_name, ...amounts, yearly]);
  });
  writeRow(log, 4, ["Monthly Total", "", ...monthlyTotals, monthlyTotals.reduce((sum, value) => sum + value, 0)]);

  const tracking = workbook.addWorksheet("Receipt Tracking");
  tracking.getCell("A1").value = "Receipt Tracking";
  writeRow(tracking, 3, ["Receipt Number", "Payment Date", "Room", "Tenant Name", "Amount Paid"]);
  archive.forEach((payment, index) => {
    writeRow(tracking, 4 + index, [
      payment.transactionRef,
      payment.submittedAt,
      payment.bedSpaceId,
      payment.studentName,
      payment.amount,
    ]);
  });

  const names = workbook.worksheets.map((sheet) => sheet.name);
  if (JSON.stringify(names) !== JSON.stringify(BOARDING_HOUSE_SHEET_NAMES as unknown as string[])) {
    throw new Error(`Workbook sheets drifted: ${names.join(", ")}`);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
