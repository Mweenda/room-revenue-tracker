import { useMemo, useState } from "react";
import { ArrowRight, Percent, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge, buttonStyles, inputStyles } from "./primitives";
import { BLOCKS, fmtKwacha } from "../../lib/billing";
import { buildRentPreview, summarizePreview, type RentIncreaseMode, type RentScope } from "../../lib/rent";
import type { BedSpace, BlockCode } from "../../lib/types";

export type ApplyRentIncrementResult = {
  bedCount: number;
  notified: number;
  notifyFailed: number;
  skipped: number;
};

type ScopeKind = "all" | "block" | "selected";

export default function RentIncrementDialog({ open, onOpenChange, beds, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beds: BedSpace[];
  onApply: (input: {
    scope: RentScope;
    mode: RentIncreaseMode;
    value: number;
    effectiveDate: string;
  }) => Promise<ApplyRentIncrementResult>;
}) {
  const [mode, setMode] = useState<RentIncreaseMode>("percentage");
  const [rawValue, setRawValue] = useState("5");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("all");
  const [blockCode, setBlockCode] = useState<BlockCode>(BLOCKS[0]);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const next = new Date();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    return next.toISOString().slice(0, 10);
  });
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(rawValue);
  const valueIsValid = Number.isFinite(value) && value > 0;

  const occupiedBeds = useMemo(
    () => beds.filter((bed) => Boolean(bed.student)).sort((a, b) => a.id.localeCompare(b.id)),
    [beds],
  );

  const scope = useMemo<RentScope>(() => {
    if (scopeKind === "block") return { kind: "block", blockCode };
    if (scopeKind === "selected") return { kind: "selected", bedIds: selectedBedIds };
    return { kind: "all" };
  }, [scopeKind, blockCode, selectedBedIds]);

  const preview = useMemo(
    () => (valueIsValid ? buildRentPreview(beds, scope, mode, value) : []),
    [beds, scope, mode, value, valueIsValid],
  );
  const summary = useMemo(() => summarizePreview(preview), [preview]);

  function toggleBed(bedId: string) {
    setSelectedBedIds((prev) =>
      prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId],
    );
  }

  function reset() {
    setError(null);
    setApplying(false);
  }

  async function handleApply() {
    if (!valueIsValid) {
      setError("Enter an increase greater than zero.");
      return;
    }
    if (preview.length === 0) {
      setError("No bed spaces match the selected scope.");
      return;
    }
    if (!effectiveDate) {
      setError("Choose an effective date.");
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const result = await onApply({ scope, mode, value, effectiveDate });
      const parts = [`${result.bedCount} bed space${result.bedCount === 1 ? "" : "s"} updated`];
      if (result.notified > 0) parts.push(`${result.notified} student${result.notified === 1 ? "" : "s"} notified`);
      if (result.notifyFailed > 0) parts.push(`${result.notifyFailed} notification${result.notifyFailed === 1 ? "" : "s"} failed`);

      if (result.notifyFailed > 0) {
        toast.warning("Rent updated with notification issues", { description: parts.join(" · ") });
      } else {
        toast.success("Rent increment applied", { description: parts.join(" · ") });
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not apply the rent increment";
      setError(message);
      toast.error("Rent increment failed", { description: message });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600" /> Increase Rent
          </DialogTitle>
          <DialogDescription>
            Updates the monthly rate for the selected bed spaces from the effective date onward.
            Existing balances are not changed, so nobody is pushed into arrears retroactively.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Increase by</label>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
                  {(["percentage", "fixed"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMode(option)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${mode === option ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      {option === "percentage" ? <Percent size={13} /> : "K"}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  step={mode === "percentage" ? "0.5" : "10"}
                  value={rawValue}
                  onChange={(e) => setRawValue(e.target.value)}
                  className={inputStyles}
                  aria-label={mode === "percentage" ? "Percentage increase" : "Fixed kwacha increase"}
                />
              </div>
              <p className="text-xs text-slate-400">
                {mode === "percentage" ? "Percentage of the current rent." : "Flat kwacha amount added to the current rent."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="rent-effective-date">
                Effective from
              </label>
              <input
                id="rent-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className={inputStyles}
              />
              <p className="text-xs text-slate-400">Included in the notice sent to each student.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Apply to</label>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "all", label: "All bed spaces" },
                { key: "block", label: "One block" },
                { key: "selected", label: "Hand-picked students" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScopeKind(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${scopeKind === key ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scopeKind === "block" && (
              <select
                value={blockCode}
                onChange={(e) => setBlockCode(e.target.value as BlockCode)}
                className={inputStyles}
                aria-label="Block"
              >
                {BLOCKS.map((block) => <option key={block} value={block}>{block}</option>)}
              </select>
            )}

            {scopeKind === "selected" && (
              <div className="border border-slate-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                {occupiedBeds.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No occupied bed spaces.</p>
                )}
                {occupiedBeds.map((bed) => (
                  <label key={bed.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedBedIds.includes(bed.id)}
                      onChange={() => toggleBed(bed.id)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="font-mono text-xs text-slate-500 w-24 shrink-0">{bed.id}</span>
                    <span className="text-sm text-slate-800 flex-1 truncate">{bed.student?.name}</span>
                    <span className="text-sm font-semibold text-slate-600">{fmtKwacha(bed.rentAmount)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">Preview</span>
              <Badge label={`${summary.bedCount} beds`} className="bg-slate-200 text-slate-700" />
              <span className="flex items-center gap-1 text-slate-600">
                <Users size={12} /> {summary.studentCount} occupied · {summary.vacantCount} vacant
              </span>
              <span className="ml-auto font-semibold text-emerald-700">
                +{fmtKwacha(Math.round(summary.monthlyUplift))} / month
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {preview.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  {valueIsValid ? "No bed spaces match the selected scope." : "Enter an increase to see the preview."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-2 font-semibold">Bed</th>
                      <th className="px-4 py-2 font-semibold">Student</th>
                      <th className="px-4 py-2 font-semibold text-right">Current</th>
                      <th className="px-4 py-2 font-semibold text-right">New</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.map((row) => (
                      <tr key={row.bedId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.label}</td>
                        <td className="px-4 py-2 text-slate-700 truncate max-w-[10rem]">
                          {row.studentName ?? <span className="text-slate-400 italic">Vacant</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">{fmtKwacha(row.oldRent)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900">
                          <span className="inline-flex items-center gap-1">
                            <ArrowRight size={11} className="text-emerald-500" /> {fmtKwacha(row.newRent)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {preview.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                <span>Current total: <strong className="text-slate-800">{fmtKwacha(Math.round(summary.currentMonthlyTotal))}</strong></span>
                <span>New total: <strong className="text-emerald-700">{fmtKwacha(Math.round(summary.newMonthlyTotal))}</strong></span>
                <span>{summary.notifiableCount} student{summary.notifiableCount === 1 ? "" : "s"} will be emailed</span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className={buttonStyles.outline}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applying || preview.length === 0}
            className={buttonStyles.primary}
          >
            {applying ? "Applying…" : `Apply to ${preview.length} bed${preview.length === 1 ? "" : "s"}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
