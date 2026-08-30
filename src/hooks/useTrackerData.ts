import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BILLING_RECORDS,
  SEED_BEDS,
  SEED_ISSUES,
  SEED_PAYMENTS,
  SEED_UTILITIES,
} from "../data/seed";
import * as api from "../lib/api";
import { calcUtilitySplit, getCurrentBillingMonth } from "../lib/billing";
import {
  auditOccupancyLocal,
  deriveBedFromTenantAndBilling,
  isBedAssignable,
  reconcileBedsLocal,
  type OccupancyIssue,
} from "../lib/occupancy";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { inviteStudentToPortal, sendTenantNotification, sendWelcomeEmail } from "../lib/auth";
import { deriveStudentAccounts, applyStudentAccountUpdate } from "../lib/students";
import { buildRentPreview, type RentIncreaseMode, type RentScope } from "../lib/rent";
import type { RentIncrementRow } from "../lib/api/rent";
import type { StudentAccountRow } from "../lib/api/students";
import type {
  BedSpace,
  BillingRecord,
  BlockCode,
  IssueStatus,
  MaintenanceIssue,
  OnboardStudentInput,
  Payment,
  PaymentMethod,
  SubmitIssueInput,
  TenantStatus,
  UpdateStudentAccountInput,
  UtilityBlock,
} from "../lib/types";

export type TrackerDataSource = "supabase" | "local";

function reconcileBedsWithBilling(beds: BedSpace[], billingRecords: BillingRecord[]): BedSpace[] {
  const billingByBed = new Map(billingRecords.map((record) => [record.billing_id, record]));
  return beds.map((bed) => deriveBedFromTenantAndBilling(bed, billingByBed.get(bed.id)));
}

// The seed fixtures are a demo dataset for builds with no Supabase credentials.
// When Supabase is configured the server is the only source of truth, so we
// start empty rather than rendering fixtures that look like real records.
const OFFLINE_DEMO = !isSupabaseConfigured;

export function useTrackerData() {
  const [beds, setBeds] = useState<BedSpace[]>(OFFLINE_DEMO ? SEED_BEDS : []);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>(
    OFFLINE_DEMO ? BILLING_RECORDS : [],
  );
  const [payments, setPayments] = useState<Payment[]>(OFFLINE_DEMO ? SEED_PAYMENTS : []);
  const [issues, setIssues] = useState<MaintenanceIssue[]>(OFFLINE_DEMO ? SEED_ISSUES : []);
  const [utilities, setUtilities] = useState<UtilityBlock[]>(OFFLINE_DEMO ? SEED_UTILITIES : []);
  // null means "derive from beds/billing" — used in local mode and whenever the
  // tenant-status columns are not deployed yet.
  const [remoteStudents, setRemoteStudents] = useState<StudentAccountRow[] | null>(null);
  const [localInactiveStudents, setLocalInactiveStudents] = useState<StudentAccountRow[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TrackerDataSource>(
    isSupabaseConfigured ? "supabase" : "local",
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSource("local");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      try {
        await api.reconcileAllOccupancy();
      } catch {
        // RPC may not be deployed yet; continue with fetch
      }

      const [bedsData, billingData, paymentsData, issuesData, utilitiesData] =
        await Promise.all([
          api.fetchBeds(),
          api.fetchBillingRecords(),
          api.fetchPayments(),
          api.fetchIssues(),
          api.fetchUtilities(),
        ]);
      setBeds(reconcileBedsWithBilling(bedsData, billingData));
      setBillingRecords(billingData);
      setPayments(paymentsData);
      setIssues(issuesData);
      setUtilities(utilitiesData);
      setSource("supabase");

      try {
        setRemoteStudents(await api.fetchStudentAccounts({ includeInactive: true }));
      } catch {
        // Tenant status columns may not be deployed yet; fall back to derived rows
        setRemoteStudents(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load tracker data";
      setError(message);
      setRemoteStudents(null);
      // No seed-data fallback here on purpose. Swapping `source` to "local" on a
      // transient fetch failure routed every subsequent write into React state
      // only, so the UI reported success while nothing reached the database.
    } finally {
      setLoading(false);
    }
  }, []);

  // Data is fetched only for a signed-in session: every table is behind RLS, so
  // an anonymous fetch is a guaranteed failure rather than a useful request.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      if (session) {
        const auth = new URLSearchParams(window.location.search).get("auth");
        if (auth === "student-confirm" || auth === "student-reset") {
          setLoading(false);
          return;
        }
        void refresh();
        return;
      }
      setLoading(false);
      setBeds([]);
      setBillingRecords([]);
      setPayments([]);
      setIssues([]);
      setUtilities([]);
      setRemoteStudents(null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  const billingMap = useMemo(
    () => new Map(billingRecords.map((r) => [r.billing_id, r])),
    [billingRecords],
  );

  const students = useMemo<StudentAccountRow[]>(() => {
    if (remoteStudents) return remoteStudents;
    return [...deriveStudentAccounts(beds, billingRecords), ...localInactiveStudents];
  }, [remoteStudents, beds, billingRecords, localInactiveStudents]);

  const onboard = useCallback(
    async (input: OnboardStudentInput) => {
      if (source === "supabase") {
        const result = await api.onboardStudent(input);
        setBeds((prev) =>
          prev.map((b) =>
            b.id === input.bedId
              ? {
                  ...b,
                  status: "occupied" as const,
                  student: result.student,
                  rentAmount: input.rentAmount ?? b.rentAmount,
                }
              : b,
          ),
        );
        const billing = await api.fetchBillingRecords();
        setBillingRecords(billing);
        try {
          setRemoteStudents(await api.fetchStudentAccounts({ includeInactive: true }));
        } catch {
          setRemoteStudents(null);
        }
        // Best-effort: a failed welcome email must not fail the onboarding.
        await sendWelcomeEmail(result.student.id, input.bedId);
        return { student: result.student };
      }

      const billingByBed = new Map(billingRecords.map((r) => [r.billing_id, r]));
      const targetBed = beds.find((b) => b.id === input.bedId);
      if (!targetBed || !isBedAssignable(targetBed, billingByBed.get(input.bedId))) {
        throw new Error("Bed space is already occupied");
      }

      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail && beds.some((b) => b.student?.email?.trim().toLowerCase() === normalizedEmail)) {
        throw new Error("This email is already assigned to another bed");
      }

      const student = {
        id: `s-${Date.now()}`,
        name: input.name,
        phone: input.phone,
        nrc: input.nrc ?? "-",
        email: input.email,
        moveInDate: input.moveInDate || new Date().toISOString().slice(0, 10),
      };
      const rent = input.rentAmount ?? targetBed.rentAmount;
      setBeds((prev) =>
        prev.map((b) =>
          b.id === input.bedId ? { ...b, status: "occupied" as const, rentAmount: rent, student } : b,
        ),
      );
      setBillingRecords((prev) =>
        prev.map((r) => {
          if (r.billing_id !== input.bedId) return r;
          return {
            ...r,
            tenant_name: input.name,
            phone_number: input.phone || "-",
            entry_date: student.moveInDate,
            target_month: getCurrentBillingMonth(),
            current_rent: rent,
            accumulated_total: rent,
            total_balance: rent,
            days_past_due: 0,
            billing_status: "Open Window",
          };
        }),
      );
      // Offline demo dataset: there is no mail transport to notify through.
      return { student };
    },
    [beds, billingRecords, source],
  );

  const runOccupancyAudit = useCallback(async (): Promise<OccupancyIssue[]> => {
    if (source === "supabase") {
      return api.auditOccupancy();
    }
    return auditOccupancyLocal(beds, billingRecords);
  }, [beds, billingRecords, source]);

  const reconcileOccupancy = useCallback(async () => {
    if (source === "supabase") {
      await api.reconcileAllOccupancy();
      await refresh();
      return;
    }

    const reconciled = reconcileBedsLocal(beds, billingRecords);
    setBeds(reconciled.beds);
    setBillingRecords(reconciled.billingRecords);
  }, [beds, billingRecords, refresh, source]);

  const updateStudent = useCallback(
    async (input: {
      tenantId: string;
      name: string;
      phone: string;
      email: string;
      nrc?: string;
      moveInDate: string;
      sendLoginLink?: boolean;
    }) => {
      if (source === "supabase") {
        const saved = await api.updateStudent(input);
        setBeds((prev) =>
          prev.map((bed) =>
            bed.student?.id === input.tenantId
              ? { ...bed, student: { ...(bed.student ?? {}), ...saved } }
              : bed,
          ),
        );
        const billing = await api.fetchBillingRecords();
        setBillingRecords(billing);
        return saved;
      }

      const student = {
        id: input.tenantId,
        name: input.name,
        phone: input.phone,
        nrc: input.nrc ?? "-",
        email: input.email,
        moveInDate: input.moveInDate,
      };

      setBeds((prev) =>
        prev.map((bed) =>
          bed.student?.id === input.tenantId ? { ...bed, student } : bed,
        ),
      );
      setBillingRecords((prev) => {
        const match = beds.find((bed) => bed.student?.id === input.tenantId);
        if (!match) return prev;

        return prev.map((r) =>
          r.billing_id === match.id
            ? {
                ...r,
                tenant_name: input.name,
                phone_number: input.phone || "-",
                entry_date: input.moveInDate,
              }
            : r,
        );
      });

      if (input.email && input.sendLoginLink) {
        // Real Supabase magic link. The previous implementation emailed an
        // unsigned, self-describing token to a route that did not exist.
        await inviteStudentToPortal(input.email, input.name);
      }
      return student;
    },
    [beds, source],
  );

  const updateStudentAccount = useCallback(
    async (input: UpdateStudentAccountInput) => {
      if (source === "supabase") {
        const saved = await api.updateStudentAccount(input);
        await refresh();
        return saved;
      }

      const next = applyStudentAccountUpdate(beds, billingRecords, input);
      setBeds(next.beds);
      setBillingRecords(next.billingRecords);
      return {
        tenantId: input.tenantId,
        fullName: input.name.trim(),
        bedSpaceId: input.bedSpaceId,
        rentAmount: input.rentAmount,
      };
    },
    [beds, billingRecords, refresh, source],
  );

  const vacateBed = useCallback(
    async (bedId: string) => {
      if (source === "supabase") {
        await api.vacateBedSpace(bedId);
        const [bedsData, billingData] = await Promise.all([
          api.fetchBeds(),
          api.fetchBillingRecords(),
        ]);
        setBeds(reconcileBedsWithBilling(bedsData, billingData));
        setBillingRecords(billingData);
        return;
      }

      setBeds((prev) =>
        prev.map((bed) =>
          bed.id === bedId ? { ...bed, status: "vacant" as const, student: undefined } : bed,
        ),
      );
      setBillingRecords((prev) =>
        prev.map((r) =>
          r.billing_id === bedId
            ? {
                ...r,
                tenant_name: "Vacant",
                phone_number: "-",
                entry_date: "-",
                target_month: "-",
                accumulated_total: 0,
                total_balance: 0,
                days_past_due: 0,
                billing_status: "Vacant" as const,
              }
            : r,
        ),
      );
    },
    [source],
  );

  /**
   * Soft-delete: the tenant row is retained for history, the bed is released and
   * its billing reset. Returns the snapshot the caller needs for the toast.
   */
  const evictStudent = useCallback(
    async (input: {
      tenantId: string;
      reason: string;
      actor?: string | null;
      status?: Exclude<TenantStatus, "active">;
    }) => {
      const reason = input.reason.trim();
      if (!reason) throw new Error("A reason is required to remove a student");

      if (source === "supabase") {
        const result = await api.evictTenant({ ...input, reason });
        await refresh();
        return result;
      }

      const bed = beds.find((b) => b.student?.id === input.tenantId);
      if (!bed?.student) throw new Error("Student not found");

      const snapshot = deriveStudentAccounts([bed], billingRecords)[0];
      const outstandingBalance = snapshot?.total_balance ?? 0;

      setLocalInactiveStudents((prev) => [
        ...prev.filter((row) => row.id !== input.tenantId),
        {
          ...snapshot,
          tenant_status: input.status ?? "evicted",
          status_changed_at: new Date().toISOString(),
          status_reason: reason,
          bed_status: "vacant",
          total_balance: 0,
          billing_status: "Vacant",
        },
      ]);

      await vacateBed(bed.id);

      return {
        tenantId: input.tenantId,
        fullName: bed.student.name,
        email: bed.student.email || null,
        bedSpaceId: bed.id,
        outstandingBalance,
      };
    },
    [beds, billingRecords, refresh, source, vacateBed],
  );

  /**
   * Forward-only rent change. Applies the new rate, then emails every affected
   * student. Email failures are collected rather than aborting the batch, since
   * the rent change itself has already been committed.
   */
  const applyRentIncrement = useCallback(
    async (input: {
      scope: RentScope;
      mode: RentIncreaseMode;
      value: number;
      effectiveDate: string;
      actor?: string | null;
    }) => {
      const preview = buildRentPreview(beds, input.scope, input.mode, input.value);
      if (preview.length === 0) throw new Error("No bed spaces matched the selected scope");

      const bedIds = preview.map((row) => row.bedId);
      let applied: RentIncrementRow[] = preview.map((row) => ({
        bedSpaceId: row.bedId,
        tenantId: null,
        tenantName: row.studentName,
        tenantEmail: row.studentEmail,
        oldRent: row.oldRent,
        newRent: row.newRent,
      }));

      if (source === "supabase") {
        const rows = await api.applyRentIncrement({
          bedIds,
          mode: input.mode,
          value: input.value,
          effectiveDate: input.effectiveDate,
          actor: input.actor,
        });
        if (rows.length > 0) applied = rows;
      } else {
        const newRentByBed = new Map(preview.map((row) => [row.bedId, row.newRent]));
        setBeds((prev) =>
          prev.map((bed) =>
            newRentByBed.has(bed.id) ? { ...bed, rentAmount: newRentByBed.get(bed.id)! } : bed,
          ),
        );
      }

      // Only occupied beds with a resolved tenant can be notified. Settled
      // (not raced) so one bounced address cannot abort the rest of the batch.
      const recipients = applied.filter((row) => row.tenantId && row.newRent !== row.oldRent);
      const outcomes = await Promise.allSettled(
        recipients.map((row) =>
          sendTenantNotification({
            tenantId: row.tenantId!,
            type: "rent_increase",
            details: {
              bedSpace: row.bedSpaceId,
              oldAmount: row.oldRent,
              newAmount: row.newRent,
              effectiveDate: input.effectiveDate,
            },
          }),
        ),
      );

      const notified = outcomes.filter((o) => o.status === "fulfilled" && o.value === true).length;

      if (source === "supabase") await refresh();

      return {
        applied,
        bedCount: applied.length,
        notified,
        notifyFailed: recipients.length - notified,
        skipped: applied.length - recipients.length,
      };
    },
    [beds, refresh, source],
  );

  const uploadStudentProfilePhoto = useCallback(
    async (tenantId: string, file: File) => {
      if (source === "supabase") {
        const url = await api.uploadStudentProfilePhoto(tenantId, file);
        setBeds((prev) => prev.map((bed) => bed.student?.id === tenantId
          ? { ...bed, student: { ...bed.student, profileImageUrl: url } }
          : bed));
        return url;
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result);
          setBeds((prev) => prev.map((bed) => bed.student?.id === tenantId
            ? { ...bed, student: { ...bed.student, profileImageUrl: url } }
            : bed));
          resolve(url);
        };
        reader.onerror = () => reject(new Error("Unable to read profile image"));
        reader.readAsDataURL(file);
      });
    },
    [source],
  );

  const updateLandlordProfile = useCallback(async (input: Parameters<typeof api.updateLandlordProfile>[0]) => {
    if (source === "supabase") return api.updateLandlordProfile(input);
    return { ...input, role: "Property Owner" };
  }, [source]);

  const verifyPay = useCallback(
    async (id: string) => {
      if (source === "supabase") {
        const updated = await api.verifyPayment(id);
        setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
        // Re-fetch billing so trigger-updated balances are reflected
        const billing = await api.fetchBillingRecords();
        setBillingRecords(billing);
        const bed = beds.find(b => b.id === updated.bedSpaceId);
        if (bed?.student?.id) {
          await sendTenantNotification({
            tenantId: bed.student.id,
            type: 'payment_approved',
            details: { amount: updated.amount }
          });
        }
        return;
      }

      const payment = payments.find((p) => p.id === id);
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "verified" as const } : p)),
      );
      if (payment) {
        setBillingRecords((prev) =>
          prev.map((r) => {
            if (r.billing_id !== payment.bedSpaceId) return r;
            const total_balance = Math.max(0, r.total_balance - payment.amount);
            return {
              ...r,
              total_balance,
              billing_status: total_balance === 0 ? "Paid / Secured" : r.billing_status,
            };
          }),
        );
      }
    },
    [payments, source],
  );

  const rejectPay = useCallback(
    async (id: string, reason: string) => {
      if (source === "supabase") {
        const updated = await api.rejectPayment(id, reason);
        setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
        const bed = beds.find(b => b.id === updated.bedSpaceId);
        if (bed?.student?.id) {
          await sendTenantNotification({
            tenantId: bed.student.id,
            type: 'payment_rejected',
            details: { reason }
          });
        }
        return;
      }
      setPayments((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "rejected" as const, rejectionReason: reason } : p,
        ),
      );
    },
    [source, beds],
  );

  const submitPay = useCallback(
    async (input: {
      studentName: string;
      bedSpaceId: string;
      amount: number;
      method: PaymentMethod;
      transactionRef: string;
      proofUrl?: string;
    }) => {
      if (source === "supabase") {
        const created = await api.submitPayment(input);
        setPayments((prev) => [created, ...prev]);
        return created;
      }
      const local: Payment = {
        id: `p-${Date.now()}`,
        studentName: input.studentName,
        bedSpaceId: input.bedSpaceId,
        amount: input.amount,
        method: input.method,
        transactionRef: input.transactionRef,
        proofUrl: input.proofUrl,
        submittedAt: new Date().toISOString().slice(0, 10),
        status: "pending",
      };
      setPayments((prev) => [local, ...prev]);
      return local;
    },
    [source],
  );

  const uploadStudentMedia = useCallback(
    async (tenantId: string, file: File, category: "receipts" | "maintenance") => {
      if (source === "supabase") return api.uploadTenantMedia(tenantId, file, category);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read upload"));
        reader.readAsDataURL(file);
      });
    },
    [source],
  );

  const submitMaint = useCallback(
    async (input: SubmitIssueInput) => {
      if (source === "supabase") {
        const created = await api.submitIssue(input);
        setIssues((prev) => [created, ...prev]);
        return created;
      }
      const local: MaintenanceIssue = {
        id: `i-${Date.now()}`,
        bedSpaceId: input.bedSpaceId,
        studentName: input.studentName,
        category: input.category,
        description: input.description,
        reportedDate: new Date().toISOString().slice(0, 10),
        status: "open",
        imageUrl: input.imageUrl,
      };
      setIssues((prev) => [local, ...prev]);
      return local;
    },
    [source],
  );

  const updateIssue = useCallback(
    async (id: string, status: IssueStatus, resolutionNote?: string) => {
      if (source === "supabase") {
        const updated = await api.updateIssueStatus(id, status, resolutionNote);
        setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
        const bed = beds.find((item) => item.id === updated.bedSpaceId);
        if (bed?.student?.id) {
          await sendTenantNotification({
            tenantId: bed.student.id,
            type: "maintenance_update",
            details: { bedSpace: updated.bedSpaceId },
          });
        }
        return;
      }
      setIssues((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status, resolutionNote: resolutionNote ?? i.resolutionNote } : i,
        ),
      );
    },
    [source, beds],
  );

  const saveUtility = useCallback(
    async (blockCode: BlockCode, month: string, totalCost: number) => {
      const n = beds.filter((b) => b.blockCode === blockCode && b.status === "occupied").length;
      const { ownerContribution, excess } = calcUtilitySplit(totalCost, n);
      const entry: UtilityBlock = {
        blockCode,
        month,
        totalCost,
        activeStudents: n,
        ownerContribution,
        excess,
        studentsSettled: [],
      };

      if (source === "supabase") {
        const saved = await api.upsertUtility(entry);
        setUtilities((prev) => [
          ...prev.filter((u) => !(u.blockCode === blockCode && u.month === month)),
          saved,
        ]);
        return saved;
      }

      setUtilities((prev) => [
        ...prev.filter((u) => !(u.blockCode === blockCode && u.month === month)),
        entry,
      ]);
      return entry;
    },
    [beds, source],
  );

  const toggleSettled = useCallback(
    async (blockCode: BlockCode, month: string, name: string) => {
      if (source === "supabase") {
        const updated = await api.toggleUtilitySettled(blockCode, month, name);
        setUtilities((prev) =>
          prev.map((u) => (u.blockCode === blockCode && u.month === month ? updated : u)),
        );
        return;
      }
      setUtilities((prev) =>
        prev.map((u) => {
          if (u.blockCode !== blockCode || u.month !== month) return u;
          const settled = u.studentsSettled.includes(name)
            ? u.studentsSettled.filter((s) => s !== name)
            : [...u.studentsSettled, name];
          return { ...u, studentsSettled: settled };
        }),
      );
    },
    [source],
  );

  return {
    beds,
    setBeds,
    billingRecords,
    billingMap,
    payments,
    setPayments,
    issues,
    setIssues,
    utilities,
    setUtilities,
    students,
    loading,
    error,
    source,
    configured: isSupabaseConfigured,
    refresh,
    onboard,
    vacateBed,
    evictStudent,
    applyRentIncrement,
    runOccupancyAudit,
    reconcileOccupancy,
    updateStudent,
    updateStudentAccount,
    uploadStudentProfilePhoto,
    uploadStudentMedia,
    updateLandlordProfile,
    verifyPay,
    rejectPay,
    submitPay,
    submitMaint,
    updateIssue,
    saveUtility,
    toggleSettled,
  };
}
