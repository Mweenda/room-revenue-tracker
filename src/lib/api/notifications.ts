import { getSupabase } from "../supabase";
import {
  isNotificationKind,
  type NotificationDetails,
  type StudentNotification,
  type StudentNotificationKind,
} from "../studentNotifications";

type NotificationRow = {
  id: string;
  tenant_id: string;
  kind: string;
  title: string;
  preview: string;
  body: string;
  metadata: NotificationDetails | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): StudentNotification {
  const kind: StudentNotificationKind = isNotificationKind(row.kind) ? row.kind : "house";
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind,
    title: row.title,
    preview: row.preview,
    body: row.body,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function fetchStudentNotifications(): Promise<StudentNotification[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("student_notifications")
    .select("id, tenant_id, kind, title, preview, body, metadata, read_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markStudentNotificationRead(id: string): Promise<StudentNotification> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("mark_student_notification_read", { p_id: id });
  if (error) throw error;
  return mapNotification(data as NotificationRow);
}

export async function ensureRentDueNotification(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc("ensure_my_rent_due_notification");
  if (error) throw error;
  return true;
}
