import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureRentDueNotification, fetchStudentNotifications, markStudentNotificationRead } from "../lib/api/notifications";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  deriveLocalInbox,
  markNotificationRead,
  sortInbox,
  unreadCount,
  type StudentNotification,
} from "../lib/studentNotifications";
import type { BillingRecord, BlockCode, MaintenanceIssue, Payment, UtilityBlock } from "../lib/types";

const READ_STORAGE_KEY = "rrt-student-inbox-read";

function readLocalReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function persistLocalReadIds(ids: Set<string>) {
  window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
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

  const localFallback = useMemo(() => {
    if (!input.tenantId) return [];
    const derived = deriveLocalInbox({
      tenantId: input.tenantId,
      bedId: input.bedId,
      blockCode: input.blockCode,
      billing: input.billing,
      payments: input.payments,
      issues: input.issues,
      utilities: input.utilities,
    });
    const readIds = readLocalReadIds();
    return derived.map((item) => (readIds.has(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
  }, [input.tenantId, input.bedId, input.blockCode, input.billing, input.payments, input.issues, input.utilities]);

  const refresh = useCallback(async () => {
    if (!input.tenantId) {
      setItems([]);
      return;
    }
    if (!isSupabaseConfigured) {
      setItems(sortInbox(localFallback));
      return;
    }

    setLoading(true);
    try {
      await ensureRentDueNotification();
      const rows = await fetchStudentNotifications();
      setItems(sortInbox(rows.length > 0 ? rows : localFallback));
    } catch {
      setItems(sortInbox(localFallback));
    } finally {
      setLoading(false);
    }
  }, [input.tenantId, localFallback]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const open = useCallback(async (id: string) => {
    setSelectedId(id);
    const current = items.find((item) => item.id === id);
    if (!current || current.readAt) return;

    if (isSupabaseConfigured && !id.startsWith("local:")) {
      try {
        const updated = await markStudentNotificationRead(id);
        setItems((prev) => sortInbox(prev.map((item) => (item.id === id ? updated : item))));
        return;
      } catch {
        // Fall through to local mark so the unread dot still clears.
      }
    }

    const readIds = readLocalReadIds();
    readIds.add(id);
    persistLocalReadIds(readIds);
    setItems((prev) => sortInbox(markNotificationRead(prev, id)));
  }, [items]);

  const close = useCallback(() => setSelectedId(null), []);

  return {
    items,
    selected,
    loading,
    unread: unreadCount(items),
    open,
    close,
    refresh,
  };
}
