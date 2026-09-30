import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  Check,
  Inbox,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  TrendingUp,
  UserMinus,
  UserPlus,
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
  ModalFrame,
} from "../components/primitives";
import RentIncrementDialog, { type ApplyRentIncrementResult } from "../components/RentIncrementDialog";
import StudentAccountDialog from "../components/StudentAccountDialog";
import WhatsAppGateway from "../components/WhatsAppGateway";
import { blocksInData, fmtKwacha } from "../../lib/billing";
import { displayOptional } from "../../lib/occupancy";
import { bedLabel, filterStudentAccounts, STUDENT_BILLING_FILTERS, STUDENT_TENANT_FILTERS, TENANT_STATUS_LABEL, type StudentBillingFilter, type StudentTenantFilter } from "../../lib/students";
import { composeRentReminder, whatsappChatUrl } from "../../lib/whatsapp";
import type { StudentAccountRow } from "../../lib/api/students";
import { approveStudentApplication, listStudentApplications, rejectStudentApplication } from "../../lib/api";
import { trackerSyncEvents } from "../../lib/trackerSync";
import type { RentIncreaseMode, RentScope } from "../../lib/rent";
import type { BedSpace, BlockCode, OnboardStudentInput, RoomGender, StudentApplication, TenantStatus, UpdateStudentAccountInput } from "../../lib/types";

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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

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
  onDataChanged,
  focusStudent,
  focusNonce = 0,
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
  onDataChanged?: () => void;
  focusStudent?: StudentAccountRow | null;
  focusNonce?: number;
}) {
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<BlockCode | "all">("all");
  const blocks = useMemo(() => blocksInData(beds), [beds]);
  const [billingFilter, setBillingFilter] = useState<StudentBillingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StudentTenantFilter>("active");
  const [genderFilter, setGenderFilter] = useState<RoomGender | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<StudentAccountRow | null>(null);
  const [rentDialogOpen, setRentDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formOpen, setFormOpen] = useState(false);
  const [formStudent, setFormStudent] = useState<StudentAccountRow | null>(null);
  const openedFocusAt = useRef<number>(0);

  const [evictTarget, setEvictTarget] = useState<StudentAccountRow | null>(null);
  const [evictReason, setEvictReason] = useState("");
  const [evictStatus, setEvictStatus] = useState<Exclude<TenantStatus, "active">>("evicted");
  const [evicting, setEvicting] = useState(false);
  const [evictError, setEvictError] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterStudentAccounts(students, {
      search,
      block: blockFilter,
      billing: billingFilter,
      status: statusFilter,
      gender: genderFilter,
    }),
    [students, search, blockFilter, billingFilter, statusFilter, genderFilter],
  );

  const activeStudents = students.filter((row) => row.tenant_status === "active");
  const paidCount = activeStudents.filter((row) => row.billing_status === "Paid / Secured").length;
  const overdue = activeStudents.filter((row) => row.billing_status === "OVERDUE / UNPAID");
  const totalOutstanding = activeStudents.reduce((sum, row) => sum + (row.total_balance ?? 0), 0);
  const removedCount = students.length - activeStudents.length;
  const billingChipCounts = useMemo(() => {
    const scoped = filterStudentAccounts(students, {
      search,
      block: blockFilter,
      status: statusFilter,
      gender: genderFilter,
    });
    return Object.fromEntries(
      STUDENT_BILLING_FILTERS.map((chip) => [
        chip.id,
        chip.id === "all" ? scoped.length : scoped.filter((row) => row.billing_status === chip.id).length,
      ]),
    ) as Record<StudentBillingFilter, number>;
  }, [students, search, blockFilter, statusFilter, genderFilter]);
  const filtersActive = search !== "" || blockFilter !== "all" || billingFilter !== "all" || statusFilter !== "active" || genderFilter !== "all";

  useEffect(() => {
    if (!focusStudent || !focusNonce) {
      return;
    }
    if (openedFocusAt.current === focusNonce) return;
    openedFocusAt.current = focusNonce;
    setStatusFilter(focusStudent.tenant_status === "active" ? "active" : "removed");
    setBillingFilter("all");
    setFormMode("edit");
    setFormStudent(focusStudent);
    setFormOpen(true);
    setDetail(null);
  }, [focusStudent, focusNonce]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const row of filtered) next.delete(row.id);
      } else {
        for (const row of filtered) next.add(row.id);
      }
      return next;
    });
  }

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
      <ApplicationsPanel
        beds={beds}
        canManage={canManage}
        onChanged={onDataChanged}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Active Students"
          value={activeStudents.length}
          icon={Users}
          selected={statusFilter === "active" && billingFilter === "all"}
          onClick={() => { setStatusFilter("active"); setBillingFilter("all"); }}
        />
        <KpiCard
          label="Paid"
          value={paidCount}
          accent="text-blue-700"
          icon={Check}
          selected={statusFilter === "active" && billingFilter === "Paid / Secured"}
          onClick={() => { setStatusFilter("active"); setBillingFilter("Paid / Secured"); }}
        />
        <KpiCard
          label="Overdue"
          value={overdue.length}
          accent="text-red-600"
          icon={AlertTriangle}
          sub={fmtKwacha(Math.round(totalOutstanding)) + " outstanding"}
          selected={statusFilter === "active" && billingFilter === "OVERDUE / UNPAID"}
          onClick={() => { setStatusFilter("active"); setBillingFilter("OVERDUE / UNPAID"); }}
        />
        <KpiCard
          label="Removed"
          value={removedCount}
          accent="text-slate-500"
          icon={UserX}
          sub="Evicted or moved out"
          selected={statusFilter === "removed"}
          onClick={() => { setStatusFilter("removed"); setBillingFilter("all"); }}
        />
      </div>

      <SectionCard
        title="Students"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <WhatsAppGateway students={filtered} selectedIds={selectedIds} />
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
              {blocks.map((block) => <option key={block} value={block}>{block}</option>)}
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as RoomGender | "all")}
              className={inputStyles}
              aria-label="Filter by gender"
            >
              <option value="all">All genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-16 shrink-0">Status</span>
              {STUDENT_TENANT_FILTERS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  active={statusFilter === chip.id}
                  onClick={() => setStatusFilter(chip.id)}
                >
                  {chip.label}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-16 shrink-0">Billing</span>
              {STUDENT_BILLING_FILTERS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  active={billingFilter === chip.id}
                  onClick={() => setBillingFilter(chip.id)}
                >
                  {chip.label}
                  {billingChipCounts[chip.id] > 0 || chip.id === "all" ? ` (${billingChipCounts[chip.id]})` : ""}
                </FilterChip>
              ))}
              <span className="ml-auto text-xs text-slate-500">
                {filtered.length} of {students.length} student{students.length === 1 ? "" : "s"}
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setBlockFilter("all"); setBillingFilter("all"); setStatusFilter("active"); setGenderFilter("all"); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectFiltered}
                      aria-label="Select filtered students"
                    />
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Student</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide hidden md:table-cell">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Bed</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide hidden lg:table-cell">Gender</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right hidden sm:table-cell">Rent</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right">Balance</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right hidden md:table-cell">Days past due</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide hidden lg:table-cell">Last payment</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className={`${HOVER_ROW} cursor-pointer`} onClick={() => setDetail(row)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Select ${row.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{row.full_name}</p>
                      <p className="text-xs text-slate-400 md:hidden">{row.email ?? "No email"}</p>
                      {row.tenant_status !== "active" && (
                        <p className="text-xs text-slate-400 mt-0.5">{row.status_reason ?? "No reason recorded"}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs text-slate-600 truncate max-w-[14rem]">{displayOptional(row.email)}</p>
                      <p className="text-xs text-slate-400">{displayOptional(row.phone)}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{bedLabel(row)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs font-semibold">
                      <span className={row.gender === "Female" || row.room_gender === "Female" ? "text-pink-600" : "text-blue-600"}>
                        {row.gender ?? row.room_gender ?? ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {row.rent_amount != null ? fmtKwacha(row.rent_amount) : ""}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${(row.total_balance ?? 0) > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {row.total_balance != null ? fmtKwacha(row.total_balance) : ""}
                    </TableCell>
                    <TableCell className={`text-right hidden md:table-cell font-semibold ${(row.days_past_due ?? 0) > 5 ? "text-red-600" : (row.days_past_due ?? 0) > 0 ? "text-amber-600" : "text-slate-500"}`}>
                      {row.days_past_due ?? 0}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                      {row.last_payment_at
                        ? `${row.last_payment_at}${row.last_payment_amount != null ? ` · ${fmtKwacha(row.last_payment_amount)}` : ""}`
                        : "—"}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                const url = whatsappChatUrl(row.phone ?? "", composeRentReminder({
                                  name: row.full_name,
                                  bedLabel: bedLabel(row),
                                  balance: row.total_balance ?? 0,
                                  dueDate: row.due_date ?? "the 1st of the month",
                                  daysPastDue: row.days_past_due ?? 0,
                                  status: row.billing_status,
                                }));
                                const opened = window.open(url, "_blank", "noopener,noreferrer");
                                if (!opened) window.location.href = url;
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not open WhatsApp");
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Remind via WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </button>
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
                    <TableCell colSpan={11} className="py-12 text-center text-sm text-slate-400">
                      No students match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionCard>

      <StudentAccountDialog
        open={formOpen}
        mode={formMode}
        student={formStudent}
        beds={beds}
        canManage={canManage}
        onOpenChange={setFormOpen}
        onCreate={async (input) => {
          const result = await onboardStudent(input) as { inviteSent?: boolean };
          if (result?.inviteSent === false) {
            toast.warning(`${input.name} assigned to ${input.bedId}`, {
              description: `The student was saved, but the invite email could not be sent to ${input.email}. Ask them to use Forgot password once email delivery is working, or edit the student to resend.`,
            });
            return;
          }
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
        <ModalFrame onClose={() => setDetail(null)} className="max-w-md">
          <div className="bg-slate-900/95 backdrop-blur-md px-6 py-5 flex items-start justify-between">
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
                  ["NRC", displayOptional(detail.nrc)],
                  ["Gender", detail.gender ?? detail.room_gender ?? ""],
                  ["Move-in", displayOptional(detail.move_in_date)],
                  ["Monthly rent", detail.rent_amount != null ? fmtKwacha(detail.rent_amount) : ""],
                  ["Balance", detail.total_balance != null ? fmtKwacha(detail.total_balance) : ""],
                  ["Days past due", String(detail.days_past_due ?? 0)],
                  ["Due date", displayOptional(detail.due_date)],
                  ["Last payment", detail.last_payment_at
                    ? `${detail.last_payment_at}${detail.last_payment_amount != null ? ` · ${fmtKwacha(detail.last_payment_amount)}` : ""}`
                    : "None recorded"],
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
        </ModalFrame>
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

function bedOptionLabel(bed: BedSpace): string {
  const id = bed.identifier || `${bed.blockCode}-${bed.roomNumber}-${bed.bedLetter}`;
  return `${id} · ${bed.roomGender ?? "Any"} · ${fmtKwacha(bed.rentAmount)}`;
}

function ApplicationsPanel({
  beds,
  canManage,
  onChanged,
}: {
  beds: BedSpace[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [apps, setApps] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [assignTarget, setAssignTarget] = useState<StudentApplication | null>(null);
  const [bedId, setBedId] = useState("");
  const [rent, setRent] = useState("");
  const [moveInDate, setMoveInDate] = useState("");

  const [rejectTarget, setRejectTarget] = useState<StudentApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function reload() {
    try {
      const rows = await listStudentApplications("pending");
      setApps(rows);
    } catch (err) {
      // A student without landlord rights should never see this panel; stay quiet on read errors.
      console.error("Could not load applications", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const done = await listStudentApplications("pending").catch(() => [] as StudentApplication[]);
      if (active) {
        setApps(done);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onChange = (event: Event) => {
      const table = (event as CustomEvent<{ table?: string }>).detail?.table;
      if (table && table !== "*" && table !== "student_applications") return;
      void reload();
    };
    trackerSyncEvents.addEventListener("change", onChange);
    return () => trackerSyncEvents.removeEventListener("change", onChange);
  }, []);

  const vacantForTarget = useMemo(() => {
    if (!assignTarget) return [] as BedSpace[];
    return beds.filter((bed) =>
      bed.status === "vacant" &&
      (!assignTarget.gender || !bed.roomGender || bed.roomGender === assignTarget.gender),
    );
  }, [beds, assignTarget]);

  function openAssign(app: StudentApplication) {
    setAssignTarget(app);
    const firstBed = beds.find((bed) =>
      bed.status === "vacant" && (!app.gender || !bed.roomGender || bed.roomGender === app.gender),
    );
    setBedId(firstBed?.id ?? "");
    setRent(firstBed ? String(firstBed.rentAmount) : "");
    setMoveInDate(app.preferredMoveInDate ?? new Date().toISOString().slice(0, 10));
  }

  function onBedChange(nextBedId: string) {
    setBedId(nextBedId);
    const bed = beds.find((row) => row.id === nextBedId);
    if (bed) setRent(String(bed.rentAmount));
  }

  async function handleApprove() {
    if (!assignTarget || !bedId) return;
    setBusy(true);
    try {
      const rentAmount = Number(rent);
      const result = await approveStudentApplication({
        applicationId: assignTarget.id,
        bedId,
        rentAmount: Number.isFinite(rentAmount) && rentAmount > 0 ? rentAmount : null,
        moveInDate: moveInDate || null,
      });
      toast.success(`${result.fullName} assigned to ${result.bedSpaceId}`, {
        description: result.inviteSent
          ? `An invite was emailed to ${result.email} to set a password.`
          : `Saved, but the invite email to ${result.email} could not be sent. They can use "Forgot password" once email works.`,
      });
      setAssignTarget(null);
      await reload();
      onChanged?.();
    } catch (err) {
      toast.error("Could not assign bed space", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusy(true);
    try {
      await rejectStudentApplication({ applicationId: rejectTarget.id, reason: rejectReason.trim() });
      toast.success(`Application from ${rejectTarget.fullName} rejected`);
      setRejectTarget(null);
      setRejectReason("");
      await reload();
      onChanged?.();
    } catch (err) {
      toast.error("Could not reject application", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading || apps.length === 0) return null;

  return (
    <SectionCard
      title={`Bed space requests · ${apps.length}`}
      action={<span className="text-xs text-slate-500">Self-onboarding</span>}
    >
      <div className="p-5 space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-8 h-8 rounded-xl bg-violet-100 text-violet-700 items-center justify-center shrink-0">
                  <UserPlus size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{app.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {app.email}
                    {app.phone ? ` · ${app.phone}` : ""}
                    {app.gender ? ` · ${app.gender}` : ""}
                  </p>
                </div>
              </div>
              {app.note && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">“{app.note}”</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openAssign(app)}
                disabled={!canManage}
                className={`${buttonStyles.primary} px-3 py-1.5 text-xs min-h-0`}
                title={canManage ? "Assign a bed space" : "Landlord access required"}
              >
                <BedDouble size={13} /> Assign bed
              </button>
              <button
                onClick={() => { setRejectTarget(app); setRejectReason(""); }}
                disabled={!canManage}
                className={`${buttonStyles.outline} px-3 py-1.5 text-xs min-h-0`}
                title={canManage ? "Reject this request" : "Landlord access required"}
              >
                <X size={13} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {assignTarget && (
        <ModalFrame onClose={() => setAssignTarget(null)} className="max-w-md">
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign a bed space</h3>
              <p className="text-xs text-slate-500 mt-0.5">{assignTarget.fullName} · {assignTarget.email}</p>
            </div>
            <button onClick={() => setAssignTarget(null)} className="text-slate-400 hover:text-slate-700 p-1">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bed space</label>
              {vacantForTarget.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  No vacant {assignTarget.gender ? `${assignTarget.gender.toLowerCase()} ` : ""}beds are available. Free a
                  bed first, then assign it.
                </p>
              ) : (
                <select value={bedId} onChange={(e) => onBedChange(e.target.value)} className={inputStyles}>
                  {vacantForTarget.map((bed) => (
                    <option key={bed.id} value={bed.id}>{bedOptionLabel(bed)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly rent</label>
                <input
                  type="number"
                  min={0}
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  className={inputStyles}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Move-in date</label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className={inputStyles}
                />
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
            <button onClick={() => setAssignTarget(null)} className={`${buttonStyles.outline} flex-1`}>Cancel</button>
            <button
              onClick={() => void handleApprove()}
              disabled={busy || !canManage || !bedId}
              className={`${buttonStyles.primary} flex-1`}
            >
              <Check size={14} /> {busy ? "Assigning…" : "Assign & invite"}
            </button>
          </div>
        </ModalFrame>
      )}

      <AlertDialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Inbox size={18} className="text-red-600" /> Reject {rejectTarget?.fullName}'s request?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This closes the application. The student is not onboarded and no bed space is assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="reject-app-reason">
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              id="reject-app-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Not a current or prospective student"
              className={`${inputStyles} resize-none`}
            />
          </div>
          <AlertDialogFooter>
            <button type="button" onClick={() => setRejectTarget(null)} className={buttonStyles.outline}>Cancel</button>
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={busy || !canManage || !rejectReason.trim()}
              className={buttonStyles.danger}
            >
              {busy ? "Rejecting…" : "Confirm reject"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
