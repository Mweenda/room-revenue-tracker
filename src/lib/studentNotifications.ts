import type { BillingRecord, BlockCode, MaintenanceIssue, Payment, UtilityBlock } from "./types";

export const STUDENT_NOTIFICATION_KINDS = [
  "welcome",
  "payment_approved",
  "payment_rejected",
  "rent_due",
  "maintenance_update",
  "rent_increase",
  "house",
] as const;

export type StudentNotificationKind = (typeof STUDENT_NOTIFICATION_KINDS)[number];

export const NOTIFICATION_SENDER = "Property Management";

export interface NotificationDetails {
  amount?: number;
  dueDate?: string;
  reason?: string;
  bedSpace?: string;
  oldAmount?: number;
  newAmount?: number;
  effectiveDate?: string;
  category?: string;
  status?: string;
  resolutionNote?: string;
  description?: string;
  month?: string;
  blockCode?: string;
  targetMonth?: string;
  balance?: number;
  daysPastDue?: number;
}

export interface StudentNotification {
  id: string;
  tenantId: string;
  kind: StudentNotificationKind;
  title: string;
  preview: string;
  body: string;
  metadata: NotificationDetails;
  readAt: string | null;
  createdAt: string;
}

export function isNotificationKind(value: string): value is StudentNotificationKind {
  return (STUDENT_NOTIFICATION_KINDS as readonly string[]).includes(value);
}

function kwacha(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `K${n.toLocaleString("en-US")}` : "K0";
}

function statusLabel(status?: string): string {
  if (status === "in_progress") return "in progress";
  if (status === "resolved") return "resolved";
  if (status === "open") return "open";
  return status?.replace(/_/g, " ") || "updated";
}

export function buildNotificationCopy(
  kind: StudentNotificationKind,
  details: NotificationDetails = {},
): { title: string; preview: string; body: string } {
  const bed = details.bedSpace ? ` for ${details.bedSpace}` : "";

  switch (kind) {
    case "welcome":
      return {
        title: "Welcome to your student portal",
        preview: details.bedSpace
          ? `Your bed space ${details.bedSpace} is ready.`
          : "Your landlord has assigned your room.",
        body: [
          `Your landlord has assigned you a bed space${details.bedSpace ? `: ${details.bedSpace}` : ""}.`,
          "Use this portal to check rent, submit payment proof, and report maintenance issues.",
          "Open Home any time you need your current balance or to send a receipt.",
        ].join("\n\n"),
      };

    case "payment_approved":
      return {
        title: "Payment approved",
        preview: `Your payment of ${kwacha(details.amount)} has been verified.`,
        body: [
          `Great news — your payment of ${kwacha(details.amount)} has been approved by your landlord.`,
          "Your account has been updated. Thank you for paying on time.",
        ].join("\n\n"),
      };

    case "payment_rejected":
      return {
        title: "Payment needs attention",
        preview: details.reason || "Your payment proof was rejected. Please resubmit.",
        body: [
          "Your landlord could not verify the payment you submitted.",
          `Reason: ${details.reason || "Please contact your landlord for more details."}`,
          "Please submit a new receipt from Home with the correct reference.",
        ].join("\n\n"),
      };

    case "rent_due": {
      const overdue = (details.daysPastDue ?? 0) > 5 || details.status === "OVERDUE / UNPAID";
      const balance = kwacha(details.balance ?? details.amount);
      const period = details.targetMonth || details.dueDate || "this billing cycle";
      if (overdue) {
        return {
          title: "Rent is overdue",
          preview: `${balance} is still outstanding for ${period}.`,
          body: [
            `This is a personal reminder that your rent is overdue.`,
            `Outstanding balance: ${balance}.`,
            `Billing period: ${period}.`,
            details.daysPastDue
              ? `It has been ${details.daysPastDue} day${details.daysPastDue === 1 ? "" : "s"} past the due date.`
              : "Please pay as soon as you can to avoid further arrears.",
            "Submit payment proof from Home once you have transferred the rent.",
          ].filter(Boolean).join("\n\n"),
        };
      }
      return {
        title: "Rent payment reminder",
        preview: `${balance} is due for ${period}.`,
        body: [
          `This is a friendly reminder that your rent payment is due${details.dueDate ? ` on ${details.dueDate}` : ""}.`,
          `Amount due: ${balance}.`,
          `Billing period: ${period}.`,
          "Please submit your payment before the due date so your account stays in good standing.",
        ].join("\n\n"),
      };
    }

    case "maintenance_update":
      return {
        title: "Maintenance update",
        preview: details.category
          ? `Your ${details.category.toLowerCase()} request is now ${statusLabel(details.status)}.`
          : "There is an update on your maintenance request.",
        body: [
          `There is an update on your maintenance request${bed}.`,
          details.category ? `Category: ${details.category}.` : "",
          `Status: ${statusLabel(details.status)}.`,
          details.description ? `Your report: ${details.description}` : "",
          details.resolutionNote ? `Landlord note: ${details.resolutionNote}` : "Open Home if you need to add more detail.",
        ].filter(Boolean).join("\n\n"),
      };

    case "rent_increase": {
      const oldAmount = Number(details.oldAmount ?? 0);
      const newAmount = Number(details.newAmount ?? 0);
      return {
        title: "Notice of rent adjustment",
        preview: `Monthly rent changes from ${kwacha(oldAmount)} to ${kwacha(newAmount)}.`,
        body: [
          `The monthly rent for your bed space${bed} is changing.`,
          `Current rent: ${kwacha(oldAmount)}`,
          `New rent: ${kwacha(newAmount)}`,
          `Increase: ${kwacha(newAmount - oldAmount)}`,
          `Effective from: ${details.effectiveDate || "the next billing cycle"}`,
          "Your current billing cycle is not affected — the new amount applies from the effective date onwards.",
        ].join("\n\n"),
      };
    }

    case "house":
      return {
        title: details.month ? `House update · ${details.month}` : "Boarding house update",
        preview: details.month
          ? `Utility charges were posted for ${details.blockCode || "your block"} (${details.month}).`
          : "Your landlord posted an update for your boarding house.",
        body: [
          `Your landlord posted an update for ${details.blockCode || "your"} block.`,
          details.month ? `Utility charges for ${details.month} are now on record.` : "",
          details.amount != null ? `Total house utility cost: ${kwacha(details.amount)}.` : "",
          "This applies to every active student in that boarding house. Check Home if you have questions about your share.",
        ].filter(Boolean).join("\n\n"),
      };
  }
}

export function notificationDedupeKey(
  kind: StudentNotificationKind,
  details: NotificationDetails = {},
): string {
  switch (kind) {
    case "welcome":
      return `welcome:${details.bedSpace ?? "assigned"}`;
    case "payment_approved":
      return `payment_approved:${details.bedSpace ?? ""}:${details.amount ?? 0}:${details.dueDate ?? ""}`;
    case "payment_rejected":
      return `payment_rejected:${details.bedSpace ?? ""}:${details.dueDate ?? ""}:${details.reason ?? ""}`;
    case "rent_due":
      return `rent_due:${details.targetMonth ?? details.dueDate ?? "current"}:${details.status ?? "due"}`;
    case "maintenance_update":
      return `maintenance:${details.bedSpace ?? ""}:${details.category ?? ""}:${details.status ?? ""}:${details.dueDate ?? ""}`;
    case "rent_increase":
      return `rent_increase:${details.bedSpace ?? ""}:${details.effectiveDate ?? ""}:${details.newAmount ?? ""}`;
    case "house":
      return `house:${details.blockCode ?? ""}:${details.month ?? ""}`;
  }
}

export function sortInbox(items: StudentNotification[]): StudentNotification[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.readAt) !== Boolean(b.readAt)) return a.readAt ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function unreadCount(items: StudentNotification[]): number {
  return items.filter((item) => !item.readAt).length;
}

export function markNotificationRead(
  items: StudentNotification[],
  id: string,
  readAt = new Date().toISOString(),
): StudentNotification[] {
  return items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt } : item));
}

export function formatInboxTime(iso: string, now = new Date()): string {
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

export function formatMessageTimestamp(iso: string): string {
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

function localId(kind: StudentNotificationKind, details: NotificationDetails, createdAt: string): string {
  return `local:${notificationDedupeKey(kind, details)}:${createdAt}`;
}

function localMessage(
  tenantId: string,
  kind: StudentNotificationKind,
  details: NotificationDetails,
  createdAt: string,
  readAt: string | null = null,
): StudentNotification {
  const copy = buildNotificationCopy(kind, details);
  return {
    id: localId(kind, details, createdAt),
    tenantId,
    kind,
    ...copy,
    metadata: details,
    readAt,
    createdAt,
  };
}

/** Builds an inbox from live student records when the notifications table is unavailable. */
export function deriveLocalInbox(input: {
  tenantId: string;
  bedId?: string;
  blockCode?: BlockCode;
  billing?: BillingRecord;
  payments: Payment[];
  issues: MaintenanceIssue[];
  utilities?: UtilityBlock[];
}): StudentNotification[] {
  const items: StudentNotification[] = [];
  const bed = input.bedId;

  if (input.billing && input.billing.total_balance > 0 && input.billing.billing_status !== "Vacant") {
    const due: NotificationDetails = {
      bedSpace: bed,
      balance: input.billing.total_balance,
      amount: input.billing.total_balance,
      targetMonth: input.billing.target_month,
      dueDate: input.billing.target_month,
      daysPastDue: input.billing.days_past_due,
      status: input.billing.billing_status,
    };
    items.push(localMessage(input.tenantId, "rent_due", due, `${input.billing.target_month}-01T08:00:00.000Z`));
  }

  for (const payment of input.payments) {
    if (payment.status === "verified") {
      items.push(localMessage(
        input.tenantId,
        "payment_approved",
        { amount: payment.amount, bedSpace: payment.bedSpaceId, dueDate: payment.submittedAt },
        `${payment.submittedAt}T12:00:00.000Z`,
      ));
    }
    if (payment.status === "rejected") {
      items.push(localMessage(
        input.tenantId,
        "payment_rejected",
        { amount: payment.amount, bedSpace: payment.bedSpaceId, dueDate: payment.submittedAt, reason: payment.rejectionReason },
        `${payment.submittedAt}T12:30:00.000Z`,
      ));
    }
  }

  for (const issue of input.issues) {
    if (issue.status === "open" && !issue.resolutionNote) continue;
    items.push(localMessage(
      input.tenantId,
      "maintenance_update",
      {
        bedSpace: issue.bedSpaceId,
        category: issue.category,
        status: issue.status,
        description: issue.description,
        resolutionNote: issue.resolutionNote,
        dueDate: issue.reportedDate,
      },
      `${issue.reportedDate}T15:00:00.000Z`,
    ));
  }

  for (const utility of input.utilities ?? []) {
    if (input.blockCode && utility.blockCode !== input.blockCode) continue;
    items.push(localMessage(
      input.tenantId,
      "house",
      { blockCode: utility.blockCode, month: utility.month, amount: utility.totalCost },
      `${utility.month}-01T09:00:00.000Z`.replace(/\s+/g, "-"),
    ));
  }

  return sortInbox(items);
}
