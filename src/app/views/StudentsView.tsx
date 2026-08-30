import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  TrendingUp,
  UserMinus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Badge,
  KpiCard,
  SectionCard,
  buttonStyles,
  inputStyles,
  HOVER_ROW,
} from "../components/primitives";
import OccupancyAuditPanel from "../components/OccupancyAuditPanel";
import RentIncrementDialog, { type ApplyRentIncrementResult } from "../components/RentIncrementDialog";
import StudentAccountDialog from "../components/StudentAccountDialog";
import { BLOCKS, fmtKwacha } from "../../lib/billing";
import { bedLabel, matchesStudentSearch, TENANT_STATUS_LABEL } from "../../lib/students";
import type { StudentAccountRow } from "../../lib/api/students";
import type { OccupancyIssue } from "../../lib/occupancy";
import type { RentIncreaseMode, RentScope } from "../../lib/rent";
import type { BedSpace, BillingStatus, BlockCode, OnboardStudentInput, TenantStatus, UpdateStudentAccountInput } from "../../lib/types";

const billingBadge: Record<string, string> = {
  "Open Window": "bg-emerald-100 text-emerald-800",
  "Paid / Secured": "bg-blue-100 text-blue-800",
  "OVERDUE / UNPAID": "bg-red-100 text-red-800",
  "Grace Period": "bg-amber-100 text-amber-800",
  Vacant: "bg-slate-100 text-slate-600",
};

const tenantStatusBadge: Record<TenantStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  evicted: "bg-red-100 text-red-800",
  moved_out: "bg-slate-100 text-slate-600",
};

const BILLING_FILTERS: (BillingStatus | "all")[] = [
  "all",
  "Open Window",
  "Paid / Secured",
  "Grace Period",
  "OVERDUE / UNPAID",
];

export type EvictionResult = {
  fullName: string;
  outstandingBalance: number;
};

export default function StudentsView({
  students,
  beds,
  canManage,
  onboardStudent,
  updateStudentAccount,
  evictStudent,
  applyRentIncrement,
  runOccupancyAudit,
  reconcileOccupancy,
}: {
  students: StudentAccountRow[];
  beds: BedSpace[];
  canManage: boolean;
  onboardStudent: (input: OnboardStudentInput) => Promise<unknown>;
  updateStudentAccount: (input: UpdateStudentAccountInput) => Promise<unknown>;
  evictStudent: (input: {
    tenantId: string;
    reason: string;
    status?: Exclude<TenantStatus, "active">;
  }) => Promise<EvictionResult>;
  applyRentIncrement: (input: {
    scope: RentScope;
    mode: RentIncreaseMode;
    value: number;
    effectiveDate: string;
  }) => Promise<ApplyRentIncrementResult>;
  runOccupancyAudit: () => Promise<OccupancyIssue[]>;
  reconcileOccupancy: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<BlockCode | "all">("all");
  const [billingFilter, setBillingFilter] = useState<BillingStatus | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "all">("active");
  const [detail, setDetail] = useState<StudentAccountRow | null>(null);
  const [rentDialogOpen, setRentDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formOpen, setFormOpen] = useState(false);
  const [formStudent, setFormStudent] = useState<StudentAccountRow | null>(null);

  const [evictTarget, setEvictTarget] = useState<StudentAccountRow | null>(null);
  const [evictReason, setEvictReason] = useState("");
  const [evictStatus, setEvictStatus] = useState<Exclude<TenantStatus, "active">>("evicted");
  const [evicting, setEvicting] = useState(false);
  const [evictError, setEvictError] = useState<string | null>(null);

  const filtered = useMemo(
    () => students.filter((row) =>
      matchesStudentSearch(row, search) &&
      (blockFilter === "all" || row.block_code === blockFilter) &&
      (billingFilter === "all" || row.billing_status === billingFilter) &&
      (statusFilter === "all" || row.tenant_status === statusFilter),
    ),
    [students, search, blockFilter, billingFilter, statusFilter],
  );

  const activeStudents = students.filter((row) => row.tenant_status === "active");
  const overdue = activeStudents.filter((row) => row.billing_status === "OVERDUE / UNPAID");
  const totalOutstanding = activeStudents.reduce((sum, row) => sum + (row.total_balance ?? 0), 0);
  const removedCount = students.length - activeStudents.length;
  const filtersActive = search !== "" || blockFilter !== "all" || billingFilter !== "all" || statusFilter !== "active";

  function openCreate() {
    setFormMode("create");
    setFormStudent(null);
    setFormOpen(true);
  }

  function openEdit(row: StudentAccountRow) {
    setFormMode("edit");
    setFormStudent(row);
    setFormOpen(true);
    setDetail(null);
  }

  function openEvictDialog(row: StudentAccountRow) {
    setEvictTarget(row);
    setEvictReason("");
    setEvictStatus("evicted");
    setEvictError(null);
  }

  async function handleEvict() {
    if (!evictTarget) return;
    if (!evictReason.trim()) {
      setEvictError("A reason is required — it is stored in the audit trail.");
      return;
    }

    setEvicting(true);
    setEvictError(null);
    try {
      const result = await evictStudent({
        tenantId: evictTarget.id,
        reason: evictReason.trim(),
        status: evictStatus,
      });

      const label = evictStatus === "evicted" ? "evicted" : "marked as moved out";
      toast.success(`${result.fullName} ${label}`, {
        description: result.outstandingBalance > 0
          ? `Bed ${evictTarget.bed_space_id} released. Outstanding balance of ${fmtKwacha(result.outstandingBalance)} was written to the audit log.`
          : `Bed ${evictTarget.bed_space_id} released and billing reset.`,
      });
      setEvictTarget(null);
      setDetail(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not remove the student";
      setEvictError(message);
      toast.error("Removal failed", { description: message });
    } finally {
      setEvicting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Active Students" value={activeStudents.length} icon={Users} />
        <KpiCard label="Overdue" value={overdue.length} accent="text-red-600" icon={AlertTriangle} />
        <KpiCard label="Outstanding" value={fmtKwacha(Math.round(totalOutstanding))} accent="text-amber-600" />
        <KpiCard label="Removed" value={removedCount} accent="text-slate-500" icon={UserX} sub="Evicted or moved out" />
      </div>

      <SectionCard
        title="Students"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              disabled={!canManage}
              className={`${buttonStyles.outline} px-3 py-1.5 text-xs min-h-0`}
              title={canManage ? undefined : "Landlord access required"}
            >
              <Plus size={13} /> Add student
            </button>
            <button
              onClick={() => setRentDialogOpen(true)}
              disabled={!canManage}
              className={`${buttonStyles.primary} px-3 py-1.5 text-xs min-h-0`}
              title={canManage ? undefined : "Landlord access required"}
            >
              <TrendingUp size={13} /> Increase Rent
            </button>
          </div>
        }
      >
        <div className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, NRC or bed"
                className={`${inputStyles} pl-9`}
                aria-label="Search students"
              />
            </div>

            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value as BlockCode | "all")}
              className={inputStyles}
              aria-label="Filter by block"
            >
              <option value="all">All blocks</option>
              {BLOCKS.map((block) => <option key={block} value={block}>{block}</option>)}
            </select>

            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value as BillingStatus | "all")}
              className={inputStyles}
              aria-label="Filter by billing status"
            >
              {BILLING_FILTERS.map((status) => (
                <option key={status} value={status}>{status === "all" ? "All billing statuses" : status}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["active", "evicted", "moved_out", "all"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {status === "all" ? "All" : TENANT_STATUS_LABEL[status]}
              </button>
            ))}

            <span className="ml-auto text-xs text-slate-500">
              {filtered.length} of {students.length} student{students.length === 1 ? "" : "s"}
            </span>

            {filtersActive && (
              <button
                onClick={() => { setSearch(""); setBlockFilter("all"); setBillingFilter("all"); setStatusFilter("active"); }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <div className="border border-slate-100 rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs uppercase tracking-wide">Student</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide hidden md:table-cell">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Bed</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right hidden sm:table-cell">Rent</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right">Balance</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className={`${HOVER_ROW} cursor-pointer`} onClick={() => setDetail(row)}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{row.full_name}</p>
                      <p className="text-xs text-slate-400 md:hidden">{row.email ?? "No email"}</p>
                      {row.tenant_status !== "active" && (
                        <p className="text-xs text-slate-400 mt-0.5">{row.status_reason ?? "No reason recorded"}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs text-slate-600 truncate max-w-[14rem]">{row.email ?? "-"}</p>
                      <p className="text-xs text-slate-400">{row.phone ?? "-"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{bedLabel(row)}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {row.rent_amount != null ? fmtKwacha(row.rent_amount) : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${(row.total_balance ?? 0) > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {row.total_balance != null ? fmtKwacha(row.total_balance) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {row.tenant_status === "active"
                          ? <Badge label={row.billing_status ?? "Unknown"} className={billingBadge[row.billing_status ?? ""] ?? "bg-slate-100 text-slate-600"} />
                          : <Badge label={TENANT_STATUS_LABEL[row.tenant_status]} className={tenantStatusBadge[row.tenant_status]} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.tenant_status === "active" ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                            disabled={!canManage}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={canManage ? "Edit student details" : "Landlord access required"}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEvictDialog(row); }}
                            disabled={!canManage}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={canManage ? "Remove or mark as evicted" : "Landlord access required"}
                          >
                            <UserMinus size={13} /> Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {row.status_changed_at ? new Date(row.status_changed_at).toLocaleDateString() : "-"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      No students match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionCard>

      <OccupancyAuditPanel runAudit={runOccupancyAudit} onReconcile={reconcileOccupancy} />

      <StudentAccountDialog
        open={formOpen}
        mode={formMode}
        student={formStudent}
        beds={beds}
        canManage={canManage}
        onOpenChange={setFormOpen}
        onCreate={async (input) => {
          await onboardStudent(input);
          toast.success(`${input.name} assigned to ${input.bedId}`, {
            description: `An invite was sent to ${input.email} to create a password.`,
          });
        }}
        onUpdate={async (input) => {
          await updateStudentAccount(input);
          toast.success(`${input.name} updated`);
        }}
      />

      <RentIncrementDialog
        open={rentDialogOpen}
        onOpenChange={setRentDialogOpen}
        beds={beds}
        onApply={applyRentIncrement}
      />

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider">{bedLabel(detail)}</p>
                <h3 className="text-white font-bold text-base mt-0.5">{detail.full_name}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white p-1 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-slate-600">
                  <Mail size={14} className="text-slate-400 shrink-0" /> {detail.email ?? "No email on file"}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400 shrink-0" /> {detail.phone ?? "No phone on file"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["NRC", detail.nrc ?? "-"],
                  ["Move-in", detail.move_in_date ?? "-"],
                  ["Monthly rent", detail.rent_amount != null ? fmtKwacha(detail.rent_amount) : "-"],
                  ["Balance", detail.total_balance != null ? fmtKwacha(detail.total_balance) : "-"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {detail.tenant_status !== "active" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                  <Badge label={TENANT_STATUS_LABEL[detail.tenant_status]} className={tenantStatusBadge[detail.tenant_status]} />
                  <p className="text-sm text-slate-700">{detail.status_reason ?? "No reason recorded"}</p>
                  {detail.status_changed_at && (
                    <p className="text-xs text-slate-400">{new Date(detail.status_changed_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setDetail(null)} className={`${buttonStyles.outline} flex-1`}>Close</button>
              {detail.tenant_status === "active" && (
                <>
                  <button
                    onClick={() => openEdit(detail)}
                    disabled={!canManage}
                    className={`${buttonStyles.primary} flex-1`}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => openEvictDialog(detail)}
                    disabled={!canManage}
                    className={`${buttonStyles.danger} flex-1`}
                  >
                    <UserMinus size={14} /> Remove
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(evictTarget)} onOpenChange={(open) => { if (!open) setEvictTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX size={18} className="text-red-600" /> Remove {evictTarget?.full_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The student record is kept for history and their bed space{" "}
              <span className="font-mono">{evictTarget?.bed_space_id}</span> becomes available for re-letting.
              Their portal access is revoked and this action is written to the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {(evictTarget?.total_balance ?? 0) > 0 && (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  This student has an outstanding balance of{" "}
                  <strong>{fmtKwacha(evictTarget?.total_balance ?? 0)}</strong>. It will be recorded in the audit log
                  and then cleared from the bed's billing record.
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Outcome</label>
              <div className="flex gap-2">
                {(["evicted", "moved_out"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setEvictStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${evictStatus === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {TENANT_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="evict-reason">
                Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                id="evict-reason"
                rows={3}
                value={evictReason}
                onChange={(e) => setEvictReason(e.target.value)}
                placeholder="e.g. Non-payment of rent for three consecutive months"
                className={`${inputStyles} resize-none`}
              />
            </div>

            {evictError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{evictError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <button type="button" onClick={() => setEvictTarget(null)} className={buttonStyles.outline}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleEvict()}
              disabled={evicting || !canManage}
              className={buttonStyles.danger}
            >
              {evicting ? "Removing…" : `Confirm ${TENANT_STATUS_LABEL[evictStatus]}`}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
