import { dbFn } from "../../server/dbFn";
import { getSupabase } from "../supabase";
import {
  isLandlordNotificationKind,
  type LandlordNotification,
  type LandlordNotificationDetails,
  type LandlordNotificationKind,
} from "../landlordNotifications";
import type { LandlordView } from "../types";

type NotificationRow = {
  id: string;
  landlord_id: string;
  tenant_id: string | null;
  bed_space_id: string | null;
  payment_id: string | null;
  issue_id: string | null;
  kind: string;
  title: string;
  preview: string;
  body: string;
  metadata: LandlordNotificationDetails | null;
  read_at: string | null;
  created_at: string;
};

const LANDLORD_VIEWS: LandlordView[] = [
  "portal",
  "revenue",
  "pay",
  "utilities",
  "students",
  "reports",
  "profile",
  "settings",
];

function mapMetadata(raw: LandlordNotificationDetails | null): LandlordNotificationDetails {
  if (!raw || typeof raw !== "object") return {};
  const hrefView = LANDLORD_VIEWS.includes(raw.hrefView as LandlordView)
    ? (raw.hrefView as LandlordView)
    : undefined;
  return { ...raw, hrefView };
}

export function mapLandlordNotification(row: NotificationRow): LandlordNotification {
  const kind: LandlordNotificationKind = isLandlordNotificationKind(row.kind)
    ? row.kind
    : "rent_overdue";
  return {
    id: row.id,
    landlordId: row.landlord_id,
    tenantId: row.tenant_id,
    bedSpaceId: row.bed_space_id,
    paymentId: row.payment_id,
    issueId: row.issue_id,
    kind,
    title: row.title,
    preview: row.preview,
    body: row.body,
    metadata: mapMetadata(row.metadata),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function fetchLandlordNotifications(): Promise<LandlordNotification[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("landlord_notifications")
    .select("id, landlord_id, tenant_id, bed_space_id, payment_id, issue_id, kind, title, preview, body, metadata, read_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapLandlordNotification(row as NotificationRow));
}

export async function markLandlordNotificationReadRemote(id: string): Promise<LandlordNotification> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn(sb, "mark_landlord_notification_read", { p_id: id });
  if (error) throw error;
  return mapLandlordNotification(data as NotificationRow);
}

export async function markAllLandlordNotificationsReadRemote(): Promise<number> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn(sb, "mark_all_landlord_notifications_read");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function ensureLandlordInbox(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await dbFn(sb, "ensure_landlord_inbox");
  if (error) throw error;
  return true;
}
