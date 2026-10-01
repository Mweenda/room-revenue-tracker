import { GRACE_PERIOD_DAYS, fmtKwacha } from "./billing";
import type { BillingStatus, TenantStatus } from "./types";

export type WhatsAppReminderFilter = "unpaid" | "past_grace" | "selected";

export type WhatsAppStudent = {
  id: string;
  full_name: string;
  phone: string | null;
  tenant_status?: TenantStatus | string | null;
  billing_status?: BillingStatus | string | null;
  total_balance?: number | null;
  days_past_due?: number | null;
};

export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `260${digits.slice(1)}`;
  if (digits.length === 9) return `260${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export type WhatsAppClient = "auto" | "app" | "web";

export const WHATSAPP_CLIENT_STORAGE_KEY = "rrt.whatsapp.client";

let memoryClient: WhatsAppClient = "auto";

export function readWhatsAppClient(): WhatsAppClient {
  try {
    const stored = globalThis.localStorage?.getItem(WHATSAPP_CLIENT_STORAGE_KEY);
    if (stored === "app" || stored === "web" || stored === "auto") {
      memoryClient = stored;
      return stored;
    }
  } catch {
    // localStorage is missing in some test runners.
  }
  return memoryClient;
}

export function writeWhatsAppClient(client: WhatsAppClient): void {
  memoryClient = client;
  try {
    globalThis.localStorage?.setItem(WHATSAPP_CLIENT_STORAGE_KEY, client);
  } catch {
    // Keep the in-memory preference when storage is blocked.
  }
}

function encodeWhatsAppQuery(input: { phone?: string | null; text: string }): string {
  const text = input.text.trim();
  if (!text) throw new Error("Write a reminder before sending");
  const params = new URLSearchParams();
  if (input.phone !== undefined && input.phone !== null) {
    const intl = normalizeWhatsAppPhone(input.phone);
    if (!intl) throw new Error("This student has no valid WhatsApp number");
    params.set("phone", intl);
  }
  params.set("text", text);
  return params.toString();
}

export function whatsappChatUrl(phone: string, text: string): string {
  const intl = normalizeWhatsAppPhone(phone);
  if (!intl) throw new Error("This student has no valid WhatsApp number");
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp with a pre-filled message so the landlord can pick many contacts at once. */
export function whatsappBroadcastUrl(text: string): string {
  return whatsappWebUrl({ text });
}

/** Desktop/mobile WhatsApp registered as an OS protocol handler. */
export function whatsappNativeUrl(input: { phone?: string | null; text: string }): string {
  return `whatsapp://send?${encodeWhatsAppQuery(input)}`;
}

/** WhatsApp Web compose URL — used when the landlord works in the browser. */
export function whatsappWebUrl(input: { phone?: string | null; text: string }): string {
  return `https://web.whatsapp.com/send?${encodeWhatsAppQuery(input)}`;
}

export function resolveWhatsAppLaunch(
  client: WhatsAppClient,
  input: { phone?: string | null; text: string },
): { mode: "app" | "web"; nativeUrl: string; webUrl: string } {
  const nativeUrl = whatsappNativeUrl(input);
  const webUrl = whatsappWebUrl(input);
  if (client === "web") return { mode: "web", nativeUrl, webUrl };
  return { mode: "app", nativeUrl, webUrl };
}

export function formatWhatsAppNumberList(phones: Array<string | null | undefined>): string {
  return phones
    .map((phone) => normalizeWhatsAppPhone(phone))
    .filter((phone): phone is string => Boolean(phone))
    .join(", ");
}

export function composeBulkRentReminder(input?: { dueDate?: string | null }): string {
  return [
    "Hi,",
    "",
    "This is a rent reminder from your landlord. Your account still has an outstanding balance.",
    `Due date: ${input?.dueDate?.trim() || "the 1st of the month"}`,
    "",
    "Please submit payment proof in the student portal or reply here once paid.",
    "— Room Revenue Tracker",
  ].join("\n");
}

export function resolveBulkReminderText(customMessage: string, dueDate?: string | null): string {
  const custom = customMessage.trim();
  if (!custom) return composeBulkRentReminder({ dueDate });
  return custom
    .replaceAll("{name}", "there")
    .replaceAll("{bed}", "your bed space");
}

export function composeRentReminder(input: {
  name: string;
  bedLabel: string;
  balance: number;
  dueDate: string;
  daysPastDue: number;
  status?: string | null;
}): string {
  const overdue = input.daysPastDue > GRACE_PERIOD_DAYS || input.status === "OVERDUE / UNPAID";
  const tone = overdue
    ? `Your rent is overdue (${input.daysPastDue} days past due, including the ${GRACE_PERIOD_DAYS}-day grace period).`
    : input.daysPastDue > 0
      ? `Your rent is in the ${GRACE_PERIOD_DAYS}-day grace period (${input.daysPastDue} day${input.daysPastDue === 1 ? "" : "s"} past due).`
      : "This is a reminder that your rent is due.";
  return [
    `Hi ${input.name},`,
    "",
    tone,
    `Bed space: ${input.bedLabel}`,
    `Outstanding balance: ${fmtKwacha(input.balance)}`,
    `Due date: ${input.dueDate}`,
    "",
    "Please submit payment proof in the student portal or reply here once paid.",
    "— Room Revenue Tracker",
  ].join("\n");
}

function hasOutstanding(row: WhatsAppStudent): boolean {
  return (row.total_balance ?? 0) > 0 && row.tenant_status !== "evicted" && row.tenant_status !== "moved_out";
}

export function studentsForWhatsAppReminder<T extends WhatsAppStudent>(
  rows: T[],
  filter: WhatsAppReminderFilter,
  selectedIds?: Set<string>,
): T[] {
  return rows.filter((row) => {
    if (!normalizeWhatsAppPhone(row.phone)) return false;
    if (row.tenant_status && row.tenant_status !== "active") return false;
    if (filter === "selected") return Boolean(selectedIds?.has(row.id)) && hasOutstanding(row);
    if (!hasOutstanding(row)) return false;
    if (filter === "past_grace") {
      return (row.days_past_due ?? 0) > GRACE_PERIOD_DAYS || row.billing_status === "OVERDUE / UNPAID";
    }
    return true;
  });
}
