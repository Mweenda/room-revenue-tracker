import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dismissStudentNotification,
  ensureRentDueNotification,
  fetchStudentNotifications,
  markStudentNotificationRead,
} from "../lib/api";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  applyInboxMemory,
  deriveLocalInbox,
  dismissInboxItem,
  inboxIdentityKeys,
  markNotificationRead,
  sortInbox,
  unreadCount,
  type StudentNotification,
} from "../lib/studentNotifications";
import type { BillingRecord, BlockCode, MaintenanceIssue, Payment, UtilityBlock } from "../lib/types";

const READ_STORAGE_KEY = "rrt-student-inbox-read";
const DISMISS_STORAGE_KEY = "rrt-student-inbox-dismissed";

function readKeySet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function persistKeySet(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* private mode / quota */
  }
}

function rememberKeys(storageKey: string, keys: string[]) {
  const next = readKeySet(storageKey);
  for (const key of keys) next.add(key);
  persistKeySet(storageKey, next);
  return next;
}

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

  const localFallback = useMemo(() => {
    if (!input.tenantId) return [];
    return applyInboxMemory(
      deriveLocalInbox({
        tenantId: input.tenantId,
        bedId: input.bedId,
        blockCode: input.blockCode,
        billing: input.billing,
        payments: input.payments,
        issues: input.issues,
        utilities: input.utilities,
      }),
      readKeySet(READ_STORAGE_KEY),
      readKeySet(DISMISS_STORAGE_KEY),
    );
    // signature is the identity of billing/payments/issues — not object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, input.tenantId]);

  const rememberItem = useCallback((item: StudentNotification, kind: "read" | "dismiss") => {
    const keys = inboxIdentityKeys(item);
    if (kind === "dismiss") rememberKeys(DISMISS_STORAGE_KEY, keys);
    rememberKeys(READ_STORAGE_KEY, keys);
  }, []);

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
      const merged = applyInboxMemory(
        rows.length > 0 ? rows : localFallback,
        readKeySet(READ_STORAGE_KEY),
        readKeySet(DISMISS_STORAGE_KEY),
      );
      setItems(sortInbox(merged));
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
    if (!current) return;
    rememberItem(current, "read");
    if (current.readAt) return;

    if (isSupabaseConfigured && !id.startsWith("local:")) {
      try {
        const updated = await markStudentNotificationRead(id);
        setItems((prev) => sortInbox(applyInboxMemory(
          prev.map((item) => (item.id === id ? updated : item)),
          readKeySet(READ_STORAGE_KEY),
          readKeySet(DISMISS_STORAGE_KEY),
        )));
        return;
      } catch {
        // Fall through to local mark so the unread dot still clears.
      }
    }

    setItems((prev) => sortInbox(markNotificationRead(prev, id)));
  }, [items, rememberItem]);

  const dismiss = useCallback(async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (current) rememberItem(current, "dismiss");
    if (selectedId === id) setSelectedId(null);

    if (current && isSupabaseConfigured && !id.startsWith("local:")) {
      try {
        await dismissStudentNotification(id);
      } catch {
        // Local hide still applies.
      }
    }

    setItems((prev) => sortInbox(applyInboxMemory(
      dismissInboxItem(prev, id),
      readKeySet(READ_STORAGE_KEY),
      readKeySet(DISMISS_STORAGE_KEY),
    )));
  }, [items, rememberItem, selectedId]);

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
