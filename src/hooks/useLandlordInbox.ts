import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureLandlordInbox,
  fetchLandlordNotifications,
  markAllLandlordNotificationsReadRemote,
  markLandlordNotificationReadRemote,
} from "../lib/api";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { isVacantName } from "../lib/occupancy";
import {
  deriveLocalLandlordInbox,
  markAllLandlordNotificationsRead,
  markLandlordNotificationRead,
  sortLandlordInbox,
  unreadLandlordCount,
  type LandlordNotification,
} from "../lib/landlordNotifications";
import type { BillingRecord, MaintenanceIssue, Payment } from "../lib/types";

function inboxSignature(
  billingRecords: BillingRecord[],
  payments: Payment[],
  issues: MaintenanceIssue[],
): string {
  const overdue = billingRecords
    .filter((row) => row.billing_status === "OVERDUE / UNPAID" && !isVacantName(row.tenant_name))
    .map((row) => `${row.billing_id}:${row.target_month}:${row.total_balance}:${row.days_past_due}`)
    .sort()
    .join("|");
  const pay = payments.map((row) => `${row.id}:${row.status}`).sort().join("|");
  const maint = issues.map((row) => `${row.id}:${row.status}`).sort().join("|");
  return `${overdue}#${pay}#${maint}`;
}

export function useLandlordInbox(input: {
  enabled: boolean;
  billingRecords: BillingRecord[];
  payments: Payment[];
  issues: MaintenanceIssue[];
}) {
  const [items, setItems] = useState<LandlordNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const signature = useMemo(
    () => inboxSignature(input.billingRecords, input.payments, input.issues),
    [input.billingRecords, input.payments, input.issues],
  );

  const refresh = useCallback(async () => {
    if (!input.enabled) {
      setItems([]);
      return;
    }
    if (!isSupabaseConfigured) {
      setItems(deriveLocalLandlordInbox({
        billingRecords: input.billingRecords,
        payments: input.payments,
        issues: input.issues,
      }));
      return;
    }

    setLoading(true);
    try {
      await ensureLandlordInbox();
      const rows = await fetchLandlordNotifications();
      setItems(sortLandlordInbox(rows));
    } catch {
      // Keep the last successful inbox rather than inventing rows.
    } finally {
      setLoading(false);
    }
    // signature stands in for billing/payment/issue identity so the clock tick
    // from live billing refresh does not refetch the inbox every second.
  }, [input.enabled, signature]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!input.enabled || !isSupabaseConfigured) return;
    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel("landlord-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "landlord_notifications" },
        () => {
          void fetchLandlordNotifications()
            .then((rows) => setItems(sortLandlordInbox(rows)))
            .catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [input.enabled]);

  const open = useCallback(async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current || current.readAt) return current ?? null;

    if (isSupabaseConfigured && !id.startsWith("local:")) {
      try {
        const updated = await markLandlordNotificationReadRemote(id);
        setItems((prev) => sortLandlordInbox(prev.map((item) => (item.id === id ? updated : item))));
        return updated;
      } catch {
        // Fall through so the unread badge still clears.
      }
    }

    setItems((prev) => sortLandlordInbox(markLandlordNotificationRead(prev, id)));
    return { ...current, readAt: new Date().toISOString() };
  }, [items]);

  const markAllRead = useCallback(async () => {
    if (unreadLandlordCount(items) === 0) return;
    if (isSupabaseConfigured && items.some((item) => !item.id.startsWith("local:"))) {
      try {
        await markAllLandlordNotificationsReadRemote();
        setItems((prev) => sortLandlordInbox(markAllLandlordNotificationsRead(prev)));
        return;
      } catch {
        // Fall through.
      }
    }
    setItems((prev) => sortLandlordInbox(markAllLandlordNotificationsRead(prev)));
  }, [items]);

  return {
    items,
    loading,
    unread: unreadLandlordCount(items),
    open,
    markAllRead,
    refresh,
  };
}
