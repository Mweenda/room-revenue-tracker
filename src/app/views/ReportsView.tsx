import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  RefreshCw,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  KpiCard,
  NavCard,
  SectionCard,
  buttonStyles,
  inputStyles,
  ModalFrame,
} from "../components/primitives";
import {
  billingMonthOptions,
  fmtKwacha,
  getCurrentBillingMonth,
  getCurrentYear,
  type BillingMonth,
} from "../../lib/billing";
import { buildFinancialReport, exportFinancialWorkbook } from "../../lib/export/financialWorkbook";
import { bytesToBase64 } from "../../lib/spreadsheet/base64";
import { createLandlordCaller, downloadBlobFromBase64 } from "../../lib/trpc";
import type {
  BedSpace,
  BillingRecord,
  IssueCategory,
  IssueStatus,
  MaintenanceIssue,
  Payment,
  UtilityBlock,
} from "../../lib/types";

type ReportsSubView = "hub" | "financial" | "maintenance";

const issueStatusStyle: Record<IssueStatus, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
};
const issueLabel: Record<IssueStatus, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
const categoryIcon: Record<string, string> = { Plumbing: "🔧", Electrical: "⚡", Structural: "🏗️", Appliance: "📦" };
const categoryColor: Record<string, string> = {
  Plumbing: "bg-blue-50 text-blue-700",
  Electrical: "bg-yellow-50 text-yellow-700",
  Structural: "bg-orange-50 text-orange-700",
  Appliance: "bg-purple-50 text-purple-700",
};

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportsViewProps = {
  issues: MaintenanceIssue[];
  payments: Payment[];
  beds: BedSpace[];
  billingRecords: BillingRecord[];
  utilities: UtilityBlock[];
  canExport: boolean;
  updateIssueStatus: (id: string, status: IssueStatus, resolutionNote?: string) => Promise<void>;
  initialSubView?: ReportsSubView;
  onRefresh?: () => Promise<unknown> | void;
};

export default function ReportsView(props: ReportsViewProps) {
  const [subView, setSubView] = useState<ReportsSubView>(props.initialSubView ?? "hub");

  const openIssues = props.issues.filter((issue) => issue.status === "open").length;
  const outstanding = props.billingRecords.reduce((sum, record) => sum + record.total_balance, 0);

  if (subView === "financial") {
    return (
      <div className="space-y-5">
        <BackLink label="Financial Reports" onBack={() => setSubView("hub")} />
        <FinancialReports {...props} />
      </div>
    );
  }

  if (subView === "maintenance") {
    return (
      <div className="space-y-5">
        <BackLink label="Maintenance Reports" onBack={() => setSubView("hub")} />
        <MaintenanceReports
          issues={props.issues}
          updateIssueStatus={props.updateIssueStatus}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <NavCard
          title="Financial Reports"
          description="Export a formatted Excel workbook for any month, or upload the boarding-house spreadsheet so Master Roster, billing, and the payments archive stay in sync with live balances."
          icon={FileSpreadsheet}
          accent="bg-emerald-50 text-emerald-700"
          onClick={() => setSubView("financial")}
          footer={
            <div className="flex flex-wrap gap-2">
              <Badge label={`${fmtKwacha(Math.round(outstanding))} outstanding`} className="bg-amber-100 text-amber-800" />
              <Badge label="XLSX + CSV" className="bg-slate-100 text-slate-600" />
            </div>
          }
        />
        <NavCard
          title="Maintenance Reports"
          description="Review the maintenance queue, filter by status, inspect reported damage with photos, and record resolutions."
          icon={Wrench}
          accent="bg-blue-50 text-blue-700"
          onClick={() => setSubView("maintenance")}
          footer={
            <div className="flex flex-wrap gap-2">
              <Badge
                label={`${openIssues} open issue${openIssues === 1 ? "" : "s"}`}
                className={openIssues > 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}
              />
              <Badge label={`${props.issues.length} total`} className="bg-slate-100 text-slate-600" />
            </div>
          }
        />
      </div>
    </div>
  );
}

function BackLink({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg px-1 py-0.5"
    >
      <ArrowLeft size={15} /> Reports
      <ChevronRight size={13} className="text-slate-300" />
      <span className="text-slate-900">{label}</span>
    </button>
  );
}

// ─── Financial ───────────────────────────────────────────────────────────────

function FinancialReports({ beds, billingRecords, payments, utilities, canExport, onRefresh }: ReportsViewProps) {
  const [month, setMonth] = useState<BillingMonth>(() => getCurrentBillingMonth());
  const [year, setYear] = useState(() => getCurrentYear());
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState<"upload" | "download" | null>(null);

  const monthOptions = useMemo(() => billingMonthOptions(year), [year]);
  const yearOptions = useMemo(() => {
    const current = getCurrentYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const report = useMemo(
    () => buildFinancialReport({ billingRecords, beds, payments, utilities, month, year }),
    [billingRecords, beds, payments, utilities, month, year],
  );

  async function handleExcelExport() {
    setExporting(true);
    try {
      if (!canExport) throw new Error("Landlord access is required to export financial reports");
      await exportFinancialWorkbook({ billingRecords, beds, payments, utilities, month, year });
      toast.success("Financial report exported", {
        description: `${report.periodLabel} · ${report.sheets.length} sheets`,
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not generate the workbook",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleBoardingHouseUpload(file: File | undefined) {
    if (!file) return;
    setSyncing("upload");
    try {
      if (!canExport) throw new Error("Landlord access is required to import a boarding-house spreadsheet");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const caller = await createLandlordCaller();
      const result = await caller.spreadsheet.upload({
        filename: file.name,
        fileBase64: bytesToBase64(bytes),
      });
      toast.success("Spreadsheet synced", {
        description: `${result.recordsSynced.payments} payments, ${result.recordsSynced.billing} billing rows, ${result.recordsSynced.roster} roster rents`,
      });
      await onRefresh?.();
    } catch (err) {
      toast.error("Spreadsheet import failed", {
        description: err instanceof Error ? err.message : "Could not parse or sync the workbook",
      });
    } finally {
      setSyncing(null);
    }
  }

  async function handleBoardingHouseDownload() {
    setSyncing("download");
    try {
      if (!canExport) throw new Error("Landlord access is required to download the boarding-house spreadsheet");
      const caller = await createLandlordCaller();
      const result = await caller.spreadsheet.download();
      downloadBlobFromBase64(
        result.fileBase64,
        result.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast.success("Boarding house workbook downloaded");
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Could not generate the workbook",
      });
    } finally {
      setSyncing(null);
    }
  }

  function exportCSV(type: string) {
    if (type === "revenue") {
      downloadCSV(`revenue-ledger-${month}-${year}.csv`, [
        ["Student", "Bed Space", "Amount", "Method", "Ref", "Date", "Status"],
        ...payments.map((p) => [p.studentName, p.bedSpaceId, String(p.amount), p.method, p.transactionRef, p.submittedAt, p.status]),
      ]);
    } else if (type === "occupancy") {
      downloadCSV(`occupancy-report-${month}-${year}.csv`, [
        ["Bed Space", "Block", "Status", "Student", "Move-in"],
        ...beds.map((b) => [b.identifier, b.blockCode, b.status, b.student?.name ?? "", b.student?.moveInDate ?? ""]),
      ]);
    } else {
      downloadCSV(`utility-summary-${month}-${year}.csv`, [
        ["Block", "Month", "Total Cost", "Students", "Owner Contrib", "Excess"],
        ...utilities.map((u) => [u.blockCode, u.month, String(u.totalCost), String(u.activeStudents), String(u.ownerContribution), String(u.excess)]),
      ]);
    }
    toast.success("CSV downloaded");
  }

  return (
    <>
      <SectionCard title="Export Financial Report">
        <div className="p-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="report-month">
                Reporting month
              </label>
              <select
                id="report-month"
                value={month}
                onChange={(e) => setMonth(e.target.value as BillingMonth)}
                className={inputStyles}
              >
                {monthOptions.map((option) => (
                  <option key={option.month} value={option.month}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="report-year">
                Year
              </label>
              <select
                id="report-year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={`${inputStyles} sm:w-28`}
              >
                {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <button
              onClick={() => void handleExcelExport()}
              disabled={exporting || !canExport}
              className={buttonStyles.primary}
              title={canExport ? undefined : "Landlord access required"}
            >
              <FileSpreadsheet size={15} />
              {exporting ? "Generating…" : "Export Excel (.xlsx)"}
            </button>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed">
            The workbook contains {report.sheets.map((sheet) => sheet.name).join(", ")} — each with frozen headers,
            kwacha number formats and a totals row. Figures come from the live billing cycle; exporting also writes a
            server snapshot so this period can be retrieved later.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Expected" value={fmtKwacha(Math.round(report.summary.expectedRevenue))} />
            <KpiCard label="Collected" value={fmtKwacha(Math.round(report.summary.collectedRevenue))} accent="text-emerald-600" />
            <KpiCard label="Outstanding" value={fmtKwacha(Math.round(report.summary.outstandingRevenue))} accent="text-red-600" />
            <KpiCard
              label="Occupancy"
              value={`${report.summary.occupancyRate}%`}
              sub={`${report.summary.occupiedBeds} of ${report.summary.occupiedBeds + report.summary.vacantBeds} beds`}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Boarding house workbook</p>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Upload the Master Roster / Payments Log Archive / Monthly Billing Tab workbook. New cash receipts
                are appended without duplicating existing bed+month amounts. Download rebuilds every tab from live
                balances, with occupancy totals that include occupied beds.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className={`${buttonStyles.outline} cursor-pointer ${!canExport || syncing ? "pointer-events-none opacity-60" : ""}`}>
                <Upload size={14} />
                {syncing === "upload" ? "Syncing…" : "Upload .xlsx"}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={!canExport || Boolean(syncing)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleBoardingHouseUpload(file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void handleBoardingHouseDownload()}
                disabled={!canExport || Boolean(syncing)}
                className={buttonStyles.primary}
              >
                <Download size={14} />
                {syncing === "download" ? "Building…" : "Download latest"}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quick CSV exports</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: "revenue", label: "Revenue Ledger" },
                { key: "occupancy", label: "Occupancy" },
                { key: "utilities", label: "Utilities" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => exportCSV(key)}
                  disabled={!canExport}
                  className={buttonStyles.outline}
                >
                  <Download size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Summary · ${report.periodLabel}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {report.sheets[0].rows
                .filter((row) => row[0] !== "")
                .map((row, index) => (
                  <tr key={`${row[0]}-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2.5 text-slate-600">{row[0]}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-900">
                      {typeof row[1] === "number" ? row[1].toLocaleString() : row[1]}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

function MaintenanceReports({ issues, updateIssueStatus }: {
  issues: MaintenanceIssue[];
  updateIssueStatus: (id: string, status: IssueStatus, resolutionNote?: string) => Promise<void>;
}) {
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "all">("all");
  const [viewIssue, setViewIssue] = useState<MaintenanceIssue | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [resNote, setResNote] = useState("");
  const [newStatus, setNewStatus] = useState<IssueStatus>("open");
  const [saving, setSaving] = useState(false);

  const filtered = issues.filter((issue) => filterStatus === "all" || issue.status === filterStatus);

  async function saveIssue() {
    if (!viewIssue) return;
    setSaving(true);
    try {
      await updateIssueStatus(viewIssue.id, newStatus, resNote);
      setViewIssue({ ...viewIssue, status: newStatus, resolutionNote: resNote });
      setEditMode(false);
      toast.success("Issue updated", { description: `${viewIssue.bedSpaceId} · ${issueLabel[newStatus]}` });
    } catch (err) {
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : "Could not update the issue",
      });
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    downloadCSV("maintenance-log.csv", [
      ["Bed Space", "Student", "Category", "Description", "Date", "Status"],
      ...issues.map((i) => [i.bedSpaceId, i.studentName, i.category, i.description, i.reportedDate, i.status]),
    ]);
    toast.success("Maintenance log downloaded");
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Open" value={issues.filter((i) => i.status === "open").length} accent="text-red-600" icon={AlertTriangle} />
        <KpiCard label="In Progress" value={issues.filter((i) => i.status === "in_progress").length} accent="text-amber-600" icon={RefreshCw} />
        <KpiCard label="Resolved" value={issues.filter((i) => i.status === "resolved").length} accent="text-emerald-600" icon={CheckCircle} />
      </div>

      <SectionCard
        title="Maintenance Queue"
        action={
          <div className="flex gap-1.5 flex-wrap items-center">
            {(["all", "open", "in_progress", "resolved"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${filterStatus === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
            <button onClick={exportCSV} className={`${buttonStyles.outline} px-3 py-1 text-xs min-h-0`}>
              <Download size={12} /> CSV
            </button>
          </div>
        }
      >
        <div className="divide-y divide-slate-100">
          {filtered.map((issue) => (
            <button
              key={issue.id}
              onClick={() => { setViewIssue(issue); setNewStatus(issue.status); setResNote(issue.resolutionNote ?? ""); setEditMode(false); }}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors duration-150 group"
            >
              <div className="shrink-0 w-16 h-14 sm:w-20 sm:h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                {issue.imageUrl
                  ? <img src={issue.imageUrl} alt={issue.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-slate-400" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-900">{issue.studentName}</span>
                  <span className="font-mono text-xs text-slate-400 hidden sm:inline">{issue.bedSpaceId}</span>
                  <Badge label={issue.category} className={categoryColor[issue.category]} />
                  <Badge label={issueLabel[issue.status]} className={issueStatusStyle[issue.status]} />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{issue.description}</p>
                <p className="text-xs text-slate-400 mt-1">Reported {issue.reportedDate}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mt-1" />
            </button>
          ))}
          {filtered.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">No issues in this category.</div>}
        </div>
      </SectionCard>

      {viewIssue && (
        <ModalFrame onClose={() => { setViewIssue(null); setEditMode(false); }} className="max-w-lg">
          <div className="bg-slate-900/95 backdrop-blur-md px-6 py-5 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{categoryIcon[viewIssue.category]}</span>
                  <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">{viewIssue.bedSpaceId}</span>
                </div>
                <h3 className="text-white font-bold text-base">{viewIssue.category} Issue</h3>
                <p className="text-slate-300 text-xs mt-0.5">{viewIssue.studentName} · {viewIssue.reportedDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={issueLabel[viewIssue.status]} className={issueStatusStyle[viewIssue.status]} />
                <button onClick={() => { setViewIssue(null); setEditMode(false); }} className="text-slate-400 hover:text-white p-1 ml-1 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {viewIssue.imageUrl && (
                <div className="relative bg-slate-100 h-48">
                  <img src={viewIssue.imageUrl} alt="Damage" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-white/80 text-xs">
                    <Camera size={12} /> {viewIssue.category} photo
                  </div>
                </div>
              )}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{viewIssue.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Category", viewIssue.category as IssueCategory | string],
                    ["Bed Space", viewIssue.bedSpaceId],
                    ["Reported By", viewIssue.studentName],
                    ["Date", viewIssue.reportedDate],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
                {viewIssue.resolutionNote && !editMode && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Resolution</p>
                    <p className="text-sm text-emerald-800">{viewIssue.resolutionNote}</p>
                  </div>
                )}
                {editMode && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="issue-status">Update Status</label>
                      <select
                        id="issue-status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as IssueStatus)}
                        className={inputStyles}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="issue-note">Resolution Note</label>
                      <textarea
                        id="issue-note"
                        rows={3}
                        value={resNote}
                        onChange={(e) => setResNote(e.target.value)}
                        className={`${inputStyles} resize-none`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              {editMode ? (
                <>
                  <button onClick={() => setEditMode(false)} className={`${buttonStyles.outline} flex-1`}>Cancel</button>
                  <button onClick={() => void saveIssue()} disabled={saving} className={`${buttonStyles.primary} flex-1`}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setViewIssue(null); setEditMode(false); }} className={`${buttonStyles.outline} flex-1`}>Close</button>
                  <button onClick={() => setEditMode(true)} className={`${buttonStyles.neutral} flex-1`}>Update Status</button>
                </>
              )}
            </div>
        </ModalFrame>
      )}
    </>
  );
}
