import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dismissStudentNotification,
  ensureRentDueNotification,
  fetchStudentNotifications,
  markStudentNotificationRead,
} from "../lib/api";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import {
  sortInbox,
  unreadCount,
  type StudentNotification,
} from "../lib/studentNotifications";
import type { BillingRecord, BlockCode, MaintenanceIssue, Payment, UtilityBlock } from "../lib/types";

function studentInboxSignature(input: {
  tenantId?: string;
  bedId?: string;
  blockCode?: BlockCode;
  billing?: BillingRecord;
  payments: Payment[];
  issues: MaintenanceIssue[];
  utilities: UtilityBlock[];
}): string {
  const billing = input.billing
    ? `${input.billing.billing_id}:${input.billing.target_month}:${input.billing.total_balance}:${input.billing.billing_status}`
    : "";
  const pay = input.payments.map((row) => `${row.id}:${row.status}`).sort().join("|");
  const maint = input.issues.map((row) => `${row.id}:${row.status}`).sort().join("|");
  const util = input.utilities.map((row) => `${row.blockCode}:${row.month}:${row.totalCost}`).sort().join("|");
  return `${input.tenantId ?? ""}#${input.bedId ?? ""}#${input.blockCode ?? ""}#${billing}#${pay}#${maint}#${util}`;
}

export function useStudentInbox(input: {
  tenantId?: string;
  bedId?: string;
  blockCode?: BlockCode;
  billing?: BillingRecord;
  payments: Payment[];
  issues: MaintenanceIssue[];
  utilities: UtilityBlock[];
}) {
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signature = useMemo(() => studentInboxSignature(input), [
    input.tenantId,
    input.bedId,
    input.blockCode,
    input.billing,
    input.payments,
    input.issues,
    input.utilities,
  ]);

  const refresh = useCallback(async () => {
    if (!input.tenantId || !isSupabaseConfigured) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      await ensureRentDueNotification();
      setItems(sortInbox(await fetchStudentNotifications()));
    } catch {
      // Keep the last successful inbox rather than inventing local rows.
    } finally {
      setLoading(false);
    }
  }, [input.tenantId, signature]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!input.tenantId || !isSupabaseConfigured) return;
    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel("student-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_notifications" },
        () => {
          void fetchStudentNotifications()
            .then((rows) => setItems(sortInbox(rows)))
            .catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [input.tenantId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const open = useCallback(async (id: string) => {
    setSelectedId(id);
    const current = items.find((item) => item.id === id);
    if (!current || current.readAt || !isSupabaseConfigured) return;

    try {
      const updated = await markStudentNotificationRead(id);
      setItems((prev) => sortInbox(prev.map((item) => (item.id === id ? updated : item))));
    } catch {
      // Leave unread until the next successful fetch.
    }
  }, [items]);

  const dismiss = useCallback(async (id: string) => {
    if (selectedId === id) setSelectedId(null);
    if (!isSupabaseConfigured) return;

    try {
      await dismissStudentNotification(id);
      setItems((prev) => sortInbox(prev.filter((item) => item.id !== id)));
    } catch {
      // Keep the row until the database confirms the dismiss.
    }
  }, [selectedId]);

  const close = useCallback(() => setSelectedId(null), []);

  return {
    items,
    selected,
    loading,
    unread: unreadCount(items),
    open,
    dismiss,
    close,
    refresh,
  };
}
