import { useState } from "react";
import { CheckCircle, RefreshCw, Search } from "lucide-react";
import type { OccupancyIssue } from "../../lib/occupancy";
import { Badge, SectionCard, buttonStyles } from "./primitives";

export default function OccupancyAuditPanel({ runAudit, onReconcile }: {
  runAudit: () => Promise<OccupancyIssue[]>;
  onReconcile: () => Promise<void>;
}) {
  const [issues, setIssues] = useState<OccupancyIssue[] | null>(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunAudit() {
    setRunning(true);
    setError(null);
    try {
      setIssues(await runAudit());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleReconcile() {
    setFixing(true);
    setError(null);
    try {
      await onReconcile();
      setIssues(await runAudit());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconcile failed");
    } finally {
      setFixing(false);
    }
  }

  const errorCount = issues?.filter((i) => i.severity === "error").length ?? 0;
  const warningCount = issues?.filter((i) => i.severity === "warning").length ?? 0;

  return (
    <SectionCard title="Occupancy Integrity Audit" action={
      <div className="flex gap-2">
        <button onClick={() => void handleRunAudit()} disabled={running || fixing}
          className={`${buttonStyles.subtle} px-3 py-1.5 text-xs min-h-0`}>
          <Search size={13} /> {running ? "Running…" : "Run audit"}
        </button>
        <button onClick={() => void handleReconcile()} disabled={running || fixing}
          className={`${buttonStyles.primary} px-3 py-1.5 text-xs min-h-0`}>
          <RefreshCw size={13} className={fixing ? "animate-spin" : ""} /> {fixing ? "Fixing…" : "Fix all"}
        </button>
      </div>
    }>
      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          Verifies that vacant beds have no tenant, occupied beds match billing, and no email is assigned to more than one bed.
          Assignments use the <span className="font-semibold">active tenants</span> as source of truth — stale bed status is reconciled automatically on load and before onboarding.
        </p>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

        {issues === null && !running && (
          <div className="text-center py-8 text-slate-400 text-sm">Run the audit to check bed occupancy consistency.</div>
        )}

        {issues !== null && issues.length === 0 && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm font-semibold">
            <CheckCircle size={16} /> All beds pass occupancy checks.
          </div>
        )}

        {issues !== null && issues.length > 0 && (
          <>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="text-red-700">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
              <span className="text-amber-700">{warningCount} warning{warningCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {issues.map((issue, idx) => (
                <div key={`${issue.issue_code}-${issue.bed_space_id}-${idx}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-white">
                  <Badge label={issue.severity} className={issue.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"} />
                  <span className="font-mono text-xs text-slate-500 shrink-0">{issue.bed_space_id}</span>
                  <span className="text-sm text-slate-700 flex-1">{issue.details}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{issue.issue_code.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
