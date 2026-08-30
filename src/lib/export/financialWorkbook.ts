import {
  billingRecordsForMonth,
  formatMonthYear,
  summarizeBillingByStatus,
  type BillingMonth,
} from "../billing";
import type { BedSpace, BillingRecord, Payment, UtilityBlock } from "../types";

export type FinancialReportInput = {
  billingRecords: BillingRecord[];
  beds: BedSpace[];
  payments: Payment[];
  utilities: UtilityBlock[];
  month: BillingMonth;
  year: number;
};

export type ReportSheet = {
  name: string;
  columns: { header: string; width: number; format?: "currency" | "integer" }[];
  rows: (string | number)[][];
  totals?: (string | number | null)[];
};

export type FinancialReport = {
  title: string;
  periodLabel: string;
  generatedAt: string;
  summary: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyRate: number;
    expectedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    collectionRate: number;
    verifiedPayments: number;
    pendingPayments: number;
    utilityOwnerContribution: number;
    utilityStudentExcess: number;
  };
  sheets: ReportSheet[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isVacant(record: BillingRecord): boolean {
  return record.billing_status === "Vacant" || record.tenant_name.trim().toLowerCase() === "vacant";
}

/**
 * Pure report construction — no ExcelJS, no DOM. `writeFinancialWorkbook`
 * applies formatting on top of this so the numbers stay unit testable.
 */
export function buildFinancialReport(input: FinancialReportInput): FinancialReport {
  const { beds, payments, utilities, month, year } = input;
  const periodLabel = formatMonthYear(month, year);
  const records = billingRecordsForMonth(input.billingRecords, month);

  const occupiedRecords = records.filter((record) => !isVacant(record));
  const expectedRevenue = occupiedRecords.reduce((sum, r) => sum + r.accumulated_total, 0);
  const outstandingRevenue = occupiedRecords.reduce((sum, r) => sum + r.total_balance, 0);
  const collectedRevenue = Math.max(0, expectedRevenue - outstandingRevenue);

  const monthPayments = payments.filter((payment) => payment.status !== "rejected");
  const verifiedPayments = payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPayments = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const monthUtilities = utilities.filter((utility) => utility.month === month);
  const utilityOwnerContribution = monthUtilities.reduce((sum, u) => sum + u.ownerContribution, 0);
  const utilityStudentExcess = monthUtilities.reduce((sum, u) => sum + u.excess, 0);

  const statusBreakdown = summarizeBillingByStatus(records);

  const summarySheet: ReportSheet = {
    name: "Summary",
    columns: [
      { header: "Metric", width: 34 },
      { header: "Value", width: 20 },
    ],
    rows: [
      ["Reporting period", periodLabel],
      ["Total bed spaces", beds.length],
      ["Occupied bed spaces", occupiedRecords.length],
      ["Vacant bed spaces", records.length - occupiedRecords.length],
      ["Occupancy rate", records.length ? `${round2((occupiedRecords.length / records.length) * 100)}%` : "0%"],
      ["Expected revenue (K)", round2(expectedRevenue)],
      ["Collected revenue (K)", round2(collectedRevenue)],
      ["Outstanding revenue (K)", round2(outstandingRevenue)],
      ["Collection rate", expectedRevenue ? `${round2((collectedRevenue / expectedRevenue) * 100)}%` : "0%"],
      ["Payments verified (K)", round2(verifiedPayments)],
      ["Payments pending verification (K)", round2(pendingPayments)],
      ["Utility owner contribution (K)", round2(utilityOwnerContribution)],
      ["Utility student excess (K)", round2(utilityStudentExcess)],
      ["", ""],
      ["Beds by billing status", "Bed count"],
      ...statusBreakdown.map((entry) => [entry.status, entry.bedCount] as (string | number)[]),
      ["", ""],
      ["Capacity value by status", "Value (K)"],
      ...statusBreakdown.map((entry) => [entry.status, round2(entry.capacityValue)] as (string | number)[]),
    ],
  };

  const rosterSheet: ReportSheet = {
    name: "Billing Roster",
    columns: [
      { header: "Bed Space", width: 14 },
      { header: "Block", width: 10 },
      { header: "Room", width: 8 },
      { header: "Bed", width: 8 },
      { header: "Tenant", width: 26 },
      { header: "Phone", width: 16 },
      { header: "Entry Date", width: 14 },
      { header: "Monthly Rent", width: 15, format: "currency" },
      { header: "Accumulated", width: 15, format: "currency" },
      { header: "Outstanding", width: 15, format: "currency" },
      { header: "Days Past Due", width: 15, format: "integer" },
      { header: "Status", width: 20 },
    ],
    rows: records.map((record) => [
      record.billing_id,
      record.house_block,
      record.room_number,
      record.bed_space,
      record.tenant_name,
      record.phone_number,
      record.entry_date,
      round2(record.current_rent),
      round2(record.accumulated_total),
      round2(record.total_balance),
      record.days_past_due,
      record.billing_status,
    ]),
    totals: [
      "Totals",
      null, null, null, null, null, null,
      round2(records.reduce((sum, r) => sum + r.current_rent, 0)),
      round2(records.reduce((sum, r) => sum + r.accumulated_total, 0)),
      round2(records.reduce((sum, r) => sum + r.total_balance, 0)),
      null,
      null,
    ],
  };

  const paymentsSheet: ReportSheet = {
    name: "Payments",
    columns: [
      { header: "Submitted", width: 14 },
      { header: "Student", width: 26 },
      { header: "Bed Space", width: 14 },
      { header: "Method", width: 12 },
      { header: "Reference", width: 22 },
      { header: "Status", width: 12 },
      { header: "Amount", width: 15, format: "currency" },
    ],
    rows: monthPayments.map((payment) => [
      payment.submittedAt,
      payment.studentName,
      payment.bedSpaceId,
      payment.method,
      payment.transactionRef,
      payment.status,
      round2(payment.amount),
    ]),
    totals: [
      "Totals",
      null, null, null, null, null,
      round2(monthPayments.reduce((sum, payment) => sum + payment.amount, 0)),
    ],
  };

  const utilitiesSheet: ReportSheet = {
    name: "Utilities",
    columns: [
      { header: "Block", width: 12 },
      { header: "Month", width: 10 },
      { header: "Active Students", width: 16, format: "integer" },
      { header: "Total Cost", width: 15, format: "currency" },
      { header: "Owner Contribution", width: 19, format: "currency" },
      { header: "Student Excess", width: 16, format: "currency" },
      { header: "Settled Count", width: 15, format: "integer" },
    ],
    rows: monthUtilities.map((utility) => [
      utility.blockCode,
      utility.month,
      utility.activeStudents,
      round2(utility.totalCost),
      round2(utility.ownerContribution),
      round2(utility.excess),
      utility.studentsSettled.length,
    ]),
    totals: [
      "Totals",
      null,
      monthUtilities.reduce((sum, u) => sum + u.activeStudents, 0),
      round2(monthUtilities.reduce((sum, u) => sum + u.totalCost, 0)),
      round2(utilityOwnerContribution),
      round2(utilityStudentExcess),
      monthUtilities.reduce((sum, u) => sum + u.studentsSettled.length, 0),
    ],
  };

  return {
    title: "Room Revenue Tracker — Financial Report",
    periodLabel,
    generatedAt: new Date().toISOString(),
    summary: {
      totalBeds: beds.length,
      occupiedBeds: occupiedRecords.length,
      vacantBeds: records.length - occupiedRecords.length,
      occupancyRate: records.length ? round2((occupiedRecords.length / records.length) * 100) : 0,
      expectedRevenue: round2(expectedRevenue),
      collectedRevenue: round2(collectedRevenue),
      outstandingRevenue: round2(outstandingRevenue),
      collectionRate: expectedRevenue ? round2((collectedRevenue / expectedRevenue) * 100) : 0,
      verifiedPayments: round2(verifiedPayments),
      pendingPayments: round2(pendingPayments),
      utilityOwnerContribution: round2(utilityOwnerContribution),
      utilityStudentExcess: round2(utilityStudentExcess),
    },
    sheets: [summarySheet, rosterSheet, paymentsSheet, utilitiesSheet],
  };
}

const CURRENCY_FORMAT = '"K"#,##0.00';
const HEADER_FILL = "FF0F172A";
const TOTALS_FILL = "FFF1F5F9";

/** Applies formatting to a built report and returns the .xlsx bytes. */
export async function writeFinancialWorkbook(report: FinancialReport): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Room Revenue Tracker";
  workbook.created = new Date(report.generatedAt);

  for (const sheet of report.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    worksheet.mergeCells(1, 1, 1, Math.max(sheet.columns.length, 2));
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `${report.title} — ${report.periodLabel}`;
    titleCell.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
    worksheet.getRow(1).height = 22;

    const headerRow = worksheet.addRow(sheet.columns.map((column) => column.header));
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle" };
    headerRow.eachCell((cell, index) => {
      if (index > sheet.columns.length) return;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });

    sheet.columns.forEach((column, index) => {
      const worksheetColumn = worksheet.getColumn(index + 1);
      worksheetColumn.width = column.width;
      if (column.format === "currency") worksheetColumn.numFmt = CURRENCY_FORMAT;
      if (column.format === "integer") worksheetColumn.numFmt = "#,##0";
    });

    for (const row of sheet.rows) worksheet.addRow(row);

    if (sheet.totals) {
      const totalsRow = worksheet.addRow(sheet.totals.map((value) => value ?? ""));
      totalsRow.font = { bold: true };
      totalsRow.eachCell((cell, index) => {
        if (index > sheet.columns.length) return;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTALS_FILL } };
        cell.border = { top: { style: "thin", color: { argb: "FFCBD5E1" } } };
      });
    }

    // Freeze the title and header so long rosters stay readable.
    worksheet.views = [{ state: "frozen", ySplit: 2 }];
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: sheet.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function financialWorkbookFilename(month: BillingMonth, year: number): string {
  return `financial-report-${month}-${year}.xlsx`;
}

/** Builds, formats, and triggers the browser download in one step. */
export async function exportFinancialWorkbook(input: FinancialReportInput): Promise<FinancialReport> {
  const report = buildFinancialReport(input);
  const blob = await writeFinancialWorkbook(report);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = financialWorkbookFilename(input.month, input.year);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  try {
    const { persistFinancialSnapshot } = await import("../api/snapshots");
    await persistFinancialSnapshot({
      month: input.month,
      year: input.year,
      report,
    });
  } catch {
    // Persistence is best-effort; the download already succeeded.
  }

  return report;
}
