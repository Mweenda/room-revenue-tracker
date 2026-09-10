import { isVacantName } from "./occupancy";
import { composeRentReminder } from "./whatsapp";
import { fmtKwacha } from "./billing";
import type {
  BedSpace,
  BillingRecord,
  LandlordView,
  MaintenanceIssue,
  Payment,
} from "./types";

export const LANDLORD_NOTIFICATION_KINDS = [
  "rent_overdue",
  "payment_submitted",
  "payment_verified",
  "maintenance_submitted",
] as const;

export type LandlordNotificationKind = (typeof LANDLORD_NOTIFICATION_KINDS)[number];

export interface LandlordNotificationDetails {
  studentName?: string;
  bedSpace?: string;
  amount?: number;
  balance?: number;
  targetMonth?: string;
  daysPastDue?: number;
  status?: string;
  paymentMethod?: string;
  category?: string;
  description?: string;
  hrefView?: LandlordView;
}

export interface LandlordNotification {
  id: string;
  landlordId: string;
  tenantId: string | null;
  bedSpaceId: string | null;
  paymentId: string | null;
  issueId: string | null;
  kind: LandlordNotificationKind;
  title: string;
  preview: string;
  body: string;
  metadata: LandlordNotificationDetails;
  readAt: string | null;
  createdAt: string;
}

export function isLandlordNotificationKind(value: string): value is LandlordNotificationKind {
  return (LANDLORD_NOTIFICATION_KINDS as readonly string[]).includes(value);
}

function kwacha(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `K${n.toLocaleString("en-US")}` : "K0";
}

function studentName(details: LandlordNotificationDetails): string {
  const name = details.studentName?.trim();
  return name && !isVacantName(name) ? name : "A student";
}

function atBed(details: LandlordNotificationDetails): string {
  return details.bedSpace ? ` at ${details.bedSpace}` : "";
}

function forBed(details: LandlordNotificationDetails): string {
  return details.bedSpace ? ` for ${details.bedSpace}` : "";
}

export function landlordNotificationView(item: Pick<LandlordNotification, "kind" | "metadata">): LandlordView {
  const href = item.metadata.hrefView;
  if (
    href === "portal" ||
    href === "revenue" ||
    href === "pay" ||
    href === "utilities" ||
    href === "students" ||
    href === "reports" ||
    href === "profile" ||
    href === "settings"
  ) {
    return href;
  }
  switch (item.kind) {
    case "rent_overdue":
      return "revenue";
    case "payment_submitted":
    case "payment_verified":
      return "pay";
    case "maintenance_submitted":
      return "reports";
  }
}

export function buildLandlordNotificationCopy(
  kind: LandlordNotificationKind,
  details: LandlordNotificationDetails = {},
): { title: string; preview: string; body: string } {
  const name = studentName(details);
  const amount = kwacha(details.amount ?? details.balance);
  const month = details.targetMonth?.trim() || "this billing cycle";
  const method = details.paymentMethod?.trim() || "";
  const category = details.category?.trim() || "maintenance";
  const days = Number(details.daysPastDue) || 0;

  switch (kind) {
    case "rent_overdue":
      return {
        title: `Rent overdue · ${name}`,
        preview: `${name}${atBed(details)} owes ${amount} for ${month}.`,
        body: [
          `${name}${atBed(details)} has an overdue rent balance of ${amount}.`,
          `Billing period: ${month}.`,
          days > 0 ? `It has been ${days} day${days === 1 ? "" : "s"} past the due date.` : "",
          "Open Revenue to review this account.",
        ].filter(Boolean).join("\n\n"),
      };
    case "payment_submitted":
      return {
        title: `Payment submitted · ${name}`,
        preview: `${name} submitted ${amount}${forBed(details)}.`,
        body: [
          `${name} submitted a payment of ${amount}${forBed(details)}${method ? ` via ${method}` : ""}.`,
          "Status: awaiting verification.",
          "Open Pay to review the receipt.",
        ].join("\n\n"),
      };
    case "payment_verified":
      return {
        title: `Payment received · ${name}`,
        preview: `${name} paid ${amount}${method ? ` (${method})` : ""}${forBed(details)}.`,
        body: [
          `${name} paid ${amount}${forBed(details)}${method ? ` via ${method}` : ""}.`,
          "The payment is verified and the ledger has been updated.",
          "Open Pay to see the receipt.",
        ].join("\n\n"),
      };
    case "maintenance_submitted":
      return {
        title: `Maintenance complaint · ${name}`,
        preview: `${name} reported ${category.toLowerCase()}${atBed(details)}.`,
        body: [
          `${name} submitted a ${category.toLowerCase()} complaint${atBed(details)}.`,
          details.description?.trim() || "",
          "Open Reports to update the request.",
        ].filter(Boolean).join("\n\n"),
      };
  }
}

export function landlordNotificationDedupeKey(
  kind: LandlordNotificationKind,
  details: LandlordNotificationDetails & { paymentId?: string; issueId?: string },
): string {
  switch (kind) {
    case "rent_overdue":
      return `rent_overdue:${details.bedSpace ?? ""}:${details.targetMonth?.trim() || "current"}`;
    case "payment_submitted":
      return `payment_submitted:${details.paymentId ?? ""}`;
    case "payment_verified":
      return `payment_verified:${details.paymentId ?? ""}`;
    case "maintenance_submitted":
      return `maintenance_submitted:${details.issueId ?? ""}`;
  }
}

export function sortLandlordInbox(items: LandlordNotification[]): LandlordNotification[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.readAt) !== Boolean(b.readAt)) return a.readAt ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function unreadLandlordCount(items: LandlordNotification[]): number {
  return items.filter((item) => !item.readAt).length;
}

export function markLandlordNotificationRead(
  items: LandlordNotification[],
  id: string,
  readAt = new Date().toISOString(),
): LandlordNotification[] {
  return items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt } : item));
}

export function markAllLandlordNotificationsRead(
  items: LandlordNotification[],
  readAt = new Date().toISOString(),
): LandlordNotification[] {
  return items.map((item) => (item.readAt ? item : { ...item, readAt }));
}

export function applySeenLandlordInbox(
  items: LandlordNotification[],
  seenIds: Iterable<string>,
  seenAt = new Date().toISOString(),
): LandlordNotification[] {
  const seen = new Set(seenIds);
  return items.map((item) => {
    if (item.readAt) return item;
    if (seen.has(item.id)) return { ...item, readAt: seenAt };
    return item;
  });
}

export function formatLandlordInboxTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThatDay = new Date(date);
  startOfThatDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);

  if (dayDiff <= 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatLandlordMessageTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type NotificationDirectoryRow = {
  id: string;
  full_name: string;
  phone: string | null;
  bed_space_id: string | null;
};

export type NotificationContact = {
  name: string;
  phone: string | null;
  bedId: string | null;
  balance: number;
  daysPastDue: number;
  dueDate: string;
};

export function resolveNotificationContact(
  item: LandlordNotification,
  input: {
    billingRecords: BillingRecord[];
    beds: BedSpace[];
    students: NotificationDirectoryRow[];
  },
): NotificationContact {
  const bedId = item.bedSpaceId ?? item.metadata.bedSpace ?? null;
  const student = input.students.find((row) =>
    (item.tenantId && row.id === item.tenantId) ||
    (bedId && row.bed_space_id === bedId) ||
    (!!item.metadata.studentName && row.full_name.trim().toLowerCase() === item.metadata.studentName.trim().toLowerCase())
  );
  const billing = bedId ? input.billingRecords.find((row) => row.billing_id === bedId) : undefined;
  const bed = bedId ? input.beds.find((row) => row.id === bedId) : undefined;
  const name = studentName({
    studentName: item.metadata.studentName || student?.full_name || billing?.tenant_name || bed?.student?.name,
  });
  const phone = student?.phone || billing?.phone_number || bed?.student?.phone || null;
  return {
    name,
    phone: phone?.trim() ? phone : null,
    bedId,
    balance: billing?.total_balance ?? Number(item.metadata.balance ?? item.metadata.amount ?? 0),
    daysPastDue: billing?.days_past_due ?? Number(item.metadata.daysPastDue ?? 0),
    dueDate: billing?.target_month || item.metadata.targetMonth || "the 1st of the month",
  };
}

export function composeLandlordWhatsApp(
  kind: LandlordNotificationKind,
  contact: NotificationContact,
  details: LandlordNotificationDetails = {},
): string {
  const bed = contact.bedId || details.bedSpace || "your bed space";
  const amount = Number(details.amount ?? details.balance ?? contact.balance ?? 0);
  const method = details.paymentMethod?.trim();
  const category = (details.category ?? "maintenance").toLowerCase();

  switch (kind) {
    case "rent_overdue":
      return composeRentReminder({
        name: contact.name,
        bedLabel: bed,
        balance: contact.balance || amount,
        dueDate: contact.dueDate,
        daysPastDue: contact.daysPastDue,
        status: details.status ?? "OVERDUE / UNPAID",
      });
    case "payment_submitted":
      return [
        `Hi ${contact.name},`,
        "",
        `We received your payment proof of ${fmtKwacha(amount)} for ${bed}${method ? ` via ${method}` : ""}.`,
        "We will verify it shortly. Reply here if the reference has changed.",
        "",
        "— Room Revenue Tracker",
      ].join("\n");
    case "payment_verified":
      return [
        `Hi ${contact.name},`,
        "",
        `Your payment of ${fmtKwacha(amount)} for ${bed}${method ? ` via ${method}` : ""} has been verified. Thank you.`,
        "",
        "— Room Revenue Tracker",
      ].join("\n");
    case "maintenance_submitted": {
      const report = details.description?.trim();
      return [
        `Hi ${contact.name},`,
        "",
        `We received your ${category} complaint for ${bed}.`,
        report || null,
        "We will follow up. Reply here if anything has changed.",
        "",
        "— Room Revenue Tracker",
      ].filter((line) => line !== null).join("\n");
    }
  }
}

export function pageActionLabel(item: Pick<LandlordNotification, "kind" | "metadata">): string {
  switch (landlordNotificationView(item)) {
    case "revenue":
      return "View account";
    case "pay":
      return item.kind === "payment_verified" ? "View receipt" : "Review payment";
    case "reports":
      return "Open maintenance";
    default:
      return "Open related page";
  }
}

function isHistoricalImportPayment(id: string): boolean {
  return id.startsWith("xlsx-");
}

function localMessage(
  kind: LandlordNotificationKind,
  details: LandlordNotificationDetails,
  createdAt: string,
  ids: Partial<Pick<LandlordNotification, "tenantId" | "bedSpaceId" | "paymentId" | "issueId">> = {},
): LandlordNotification {
  const copy = buildLandlordNotificationCopy(kind, details);
  return {
    id: `local:${landlordNotificationDedupeKey(kind, {
      ...details,
      paymentId: ids.paymentId ?? undefined,
      issueId: ids.issueId ?? undefined,
    })}`,
    landlordId: "local",
    tenantId: ids.tenantId ?? null,
    bedSpaceId: ids.bedSpaceId ?? details.bedSpace ?? null,
    paymentId: ids.paymentId ?? null,
    issueId: ids.issueId ?? null,
    kind,
    ...copy,
    metadata: { ...details, hrefView: landlordNotificationView({ kind, metadata: details }) },
    readAt: null,
    createdAt,
  };
}

/** Offline-only inbox from the records already loaded in the dashboard. */
export function deriveLocalLandlordInbox(input: {
  billingRecords: BillingRecord[];
  payments: Payment[];
  issues: MaintenanceIssue[];
}): LandlordNotification[] {
  const overdue = input.billingRecords
    .filter((row) => row.billing_status === "OVERDUE / UNPAID" && !isVacantName(row.tenant_name))
    .map((row) => localMessage(
      "rent_overdue",
      {
        studentName: row.tenant_name,
        bedSpace: row.billing_id,
        balance: row.total_balance,
        amount: row.total_balance,
        targetMonth: row.target_month,
        daysPastDue: row.days_past_due,
        status: row.billing_status,
      },
      new Date().toISOString(),
      { bedSpaceId: row.billing_id },
    ));

  const submitted = input.payments
    .filter((row) => row.status === "pending" && !isHistoricalImportPayment(row.id))
    .map((row) => localMessage(
      "payment_submitted",
      {
        studentName: row.studentName,
        bedSpace: row.bedSpaceId,
        amount: row.amount,
        paymentMethod: row.method,
        status: row.status,
      },
      `${row.submittedAt}T00:00:00.000Z`,
      { bedSpaceId: row.bedSpaceId, paymentId: row.id },
    ));

  const complaints = input.issues
    .filter((row) => row.status === "open")
    .map((row) => localMessage(
      "maintenance_submitted",
      {
        studentName: row.studentName,
        bedSpace: row.bedSpaceId,
        category: row.category,
        description: row.description,
        status: row.status,
      },
      `${row.reportedDate}T00:00:00.000Z`,
      { bedSpaceId: row.bedSpaceId, issueId: row.id },
    ));

  return sortLandlordInbox([...overdue, ...submitted, ...complaints]);
}
