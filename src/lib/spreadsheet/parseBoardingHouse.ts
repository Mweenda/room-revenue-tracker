import type { CellValue, Worksheet } from "exceljs";
import { BLOCKS, type BillingMonth } from "../billing";
import { isVacantName } from "../occupancy";
import type { BillingStatus, BlockCode, RoomGender } from "../types";
import type {
  ParsedBillingRow,
  ParsedBoardingHouse,
  ParsedPaymentRow,
  ParsedRosterRow,
} from "./types";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function cellText(value: CellValue | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return toIsoDate(value) ?? "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("result" in value) return cellText(value.result as CellValue);
    if ("formula" in value && "result" in value) return cellText((value as { result?: CellValue }).result);
  }
  return String(value).trim();
}

function toIsoDate(value: CellValue | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const useUtc = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0;
    const year = useUtc ? value.getUTCFullYear() : value.getFullYear();
    const month = String((useUtc ? value.getUTCMonth() : value.getMonth()) + 1).padStart(2, "0");
    const day = String(useUtc ? value.getUTCDate() : value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = cellText(value);
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function toNumber(value: CellValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseMonth(raw: string): BillingMonth | "" {
  const text = raw.trim();
  if (!text) return "";
  const iso = text.match(/(\d{4})-(\d{2})/);
  if (iso) return MONTH_ABBR[Number(iso[2]) - 1] ?? "";
  const abbr = text.slice(0, 3).toLowerCase();
  const match = MONTH_ABBR.find((month) => month.toLowerCase() === abbr);
  return match ?? "";
}

function parseBlock(raw: string): BlockCode | null {
  const code = raw.trim().toUpperCase();
  return (BLOCKS as string[]).includes(code) ? (code as BlockCode) : null;
}

function parseGender(raw: string): RoomGender | null {
  const text = raw.trim().toLowerCase();
  if (text === "male") return "Male";
  if (text === "female") return "Female";
  return null;
}

export function parseBillingStatus(raw: string): BillingStatus {
  const text = raw.toLowerCase();
  if (text.includes("vacant")) return "Vacant";
  if (text.includes("overdue")) return "OVERDUE / UNPAID";
  if (text.includes("grace")) return "Grace Period";
  if (text.includes("paid")) return "Paid / Secured";
  if (text.includes("open")) return "Open Window";
  return "Open Window";
}

function findHeaderMap(
  sheet: Worksheet,
  aliases: Record<string, string[]>,
): { rowNumber: number; columns: Record<string, number> } | null {
  const wanted = Object.entries(aliases).map(([key, names]) => ({
    key,
    names: names.map(normalizeHeader),
  }));

  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount || 12, 12); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columns: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = normalizeHeader(cellText(cell.value));
      if (!header) return;
      for (const item of wanted) {
        if (item.names.includes(header)) columns[item.key] = colNumber;
      }
    });
    const found = Object.keys(columns).length;
    if (found >= Math.min(3, wanted.length)) return { rowNumber, columns };
  }
  return null;
}

function valueAt(row: import("exceljs").Row, columns: Record<string, number>, key: string): CellValue | undefined {
  const col = columns[key];
  return col ? row.getCell(col).value : undefined;
}

function parseRosterSheet(sheet: Worksheet | undefined): ParsedRosterRow[] {
  if (!sheet) return [];
  const header = findHeaderMap(sheet, {
    uniqueId: ["unique id"],
    roomNumber: ["room number", "room no"],
    houseBlock: ["house block", "house"],
    bedSpace: ["bed space"],
    tenantName: ["tenant name"],
    phoneNumber: ["phone number"],
    entryDate: ["entry date"],
    monthlyRent: ["monthly rent"],
    roomGender: ["room gender"],
  });
  if (!header?.columns.uniqueId) return [];

  const rows: ParsedRosterRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const uniqueId = cellText(valueAt(row, header.columns, "uniqueId"));
    const tenantName = cellText(valueAt(row, header.columns, "tenantName"));
    if (!uniqueId || isVacantName(tenantName)) return;
    const houseBlock = parseBlock(cellText(valueAt(row, header.columns, "houseBlock")) || uniqueId.split("-")[0] || "");
    const roomGender = parseGender(cellText(valueAt(row, header.columns, "roomGender"))) ?? "Male";
    const monthlyRent = toNumber(valueAt(row, header.columns, "monthlyRent"));
    if (!houseBlock || monthlyRent == null) return;
    rows.push({
      uniqueId,
      roomNumber: toNumber(valueAt(row, header.columns, "roomNumber")) ?? Number(uniqueId.split("-")[1]) ?? 0,
      houseBlock,
      bedSpace: cellText(valueAt(row, header.columns, "bedSpace")) || uniqueId.split("-")[2] || "",
      tenantName,
      phoneNumber: cellText(valueAt(row, header.columns, "phoneNumber")),
      entryDate: toIsoDate(valueAt(row, header.columns, "entryDate")) ?? "",
      monthlyRent,
      roomGender,
    });
  });
  return rows;
}

function parseBillingSheet(sheet: Worksheet | undefined): ParsedBillingRow[] {
  if (!sheet) return [];
  const header = findHeaderMap(sheet, {
    billingId: ["billing id", "unique id"],
    houseBlock: ["house block", "house"],
    tenantName: ["tenant name"],
    phoneNumber: ["phone number"],
    currentRent: ["current rent", "monthly rent"],
    entryDate: ["entry date"],
    targetMonth: ["target month"],
    accumulatedTotal: ["accumulated total"],
    totalBalance: ["total balance"],
    billingStatus: ["billing status"],
  });
  if (!header?.columns.billingId) return [];

  const rows: ParsedBillingRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const billingId = cellText(valueAt(row, header.columns, "billingId"));
    const tenantName = cellText(valueAt(row, header.columns, "tenantName"));
    if (!billingId || isVacantName(tenantName)) return;
    const houseBlock = parseBlock(cellText(valueAt(row, header.columns, "houseBlock")) || billingId.split("-")[0] || "");
    const currentRent = toNumber(valueAt(row, header.columns, "currentRent"));
    if (!houseBlock || currentRent == null) return;
    rows.push({
      billingId,
      houseBlock,
      tenantName,
      phoneNumber: cellText(valueAt(row, header.columns, "phoneNumber")),
      currentRent,
      entryDate: toIsoDate(valueAt(row, header.columns, "entryDate")) ?? "",
      targetMonth: parseMonth(cellText(valueAt(row, header.columns, "targetMonth"))),
      accumulatedTotal: toNumber(valueAt(row, header.columns, "accumulatedTotal")) ?? 0,
      totalBalance: toNumber(valueAt(row, header.columns, "totalBalance")) ?? 0,
      billingStatus: parseBillingStatus(cellText(valueAt(row, header.columns, "billingStatus"))),
    });
  });
  return rows;
}

function parsePaymentsSheet(sheet: Worksheet | undefined): ParsedPaymentRow[] {
  if (!sheet) return [];
  const header = findHeaderMap(sheet, {
    uniqueId: ["unique id", "billing id", "room"],
    tenantName: ["tenant name"],
    paymentDate: ["payment date"],
    monthCovered: ["month covered"],
    year: ["year"],
    amountPaid: ["amount paid"],
    status: ["status"],
    receiptNumber: ["receipt number"],
  });
  if (!header?.columns.uniqueId || !header.columns.amountPaid) return [];

  const rows: ParsedPaymentRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const uniqueId = cellText(valueAt(row, header.columns, "uniqueId"));
    const amountPaid = toNumber(valueAt(row, header.columns, "amountPaid"));
    const paymentDate = toIsoDate(valueAt(row, header.columns, "paymentDate"));
    if (!uniqueId || amountPaid == null || amountPaid <= 0 || !paymentDate) return;
    const year = toNumber(valueAt(row, header.columns, "year")) ?? Number(paymentDate.slice(0, 4));
    rows.push({
      uniqueId,
      tenantName: cellText(valueAt(row, header.columns, "tenantName")),
      paymentDate,
      monthCovered: parseMonth(cellText(valueAt(row, header.columns, "monthCovered")) || paymentDate),
      year,
      amountPaid,
      status: cellText(valueAt(row, header.columns, "status")) || "Paid",
      receiptNumber: cellText(valueAt(row, header.columns, "receiptNumber")),
    });
  });
  return rows;
}

export async function parseBoardingHouseWorkbook(
  bytes: ArrayBuffer | Uint8Array | Buffer,
): Promise<ParsedBoardingHouse> {
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as ArrayBuffer);

  return {
    roster: parseRosterSheet(workbook.getWorksheet("Master Roster")),
    billing: parseBillingSheet(workbook.getWorksheet("Monthly Billing Tab")),
    payments: parsePaymentsSheet(workbook.getWorksheet("Payments Log Archive")),
  };
}
