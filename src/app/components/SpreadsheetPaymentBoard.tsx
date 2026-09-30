import { fmtKwacha } from "../../lib/billing";
import { paymentWindowGroups, vacantBedRows, occupancyReport } from "../../lib/paymentTracking";
import type { BillingRecord } from "../../lib/types";

export default function SpreadsheetPaymentBoard({ billingRecords }: { billingRecords: BillingRecord[] }) {
  const occupancy = occupancyReport(billingRecords);
  const vacant = vacantBedRows(billingRecords);
  const windows = paymentWindowGroups(billingRecords);
  const early = windows.find((group) => group.window === "days-1-5");
  const late = windows.find((group) => group.window === "days-20-30");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Available Bed Spaces</h3>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Block</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Number</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Space</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Rent</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Gender</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vacant.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">No vacant beds</td></tr>
                )}
                {vacant.map((row) => (
                  <tr key={row.billingId}>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{row.block}</td>
                    <td className="px-3 py-2.5">{row.room}</td>
                    <td className="px-3 py-2.5">{row.space}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{row.rent.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-amber-700 font-semibold">Vacant</td>
                    <td className="px-4 py-2.5">{row.gender}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Occupancy Report</h3>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Gender</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Occupied</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Vacant</th>
                  <th className="text-center px-5 py-2.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-5 py-2.5 font-semibold text-blue-700">Male</td>
                  <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{occupancy.maleOccupied}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-amber-700">{occupancy.maleVacant}</td>
                  <td className="px-5 py-2.5 text-center font-bold">{occupancy.maleBeds}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 font-semibold text-pink-700">Female</td>
                  <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{occupancy.femaleOccupied}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-amber-700">{occupancy.femaleVacant}</td>
                  <td className="px-5 py-2.5 text-center font-bold">{occupancy.femaleBeds}</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-5 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-center text-emerald-700">{occupancy.activeTenants}</td>
                  <td className="px-3 py-2.5 text-center text-amber-700">{occupancy.vacantBeds}</td>
                  <td className="px-5 py-2.5 text-center">{occupancy.totalBeds}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Bed Space Report</h3>
            <MetricRow label="Active Tenants" value={String(occupancy.activeTenants)} />
            <MetricRow label="Vacant" value={String(occupancy.vacantBeds)} />
            <MetricRow label="Total Bed Spaces" value={String(occupancy.totalBeds)} />
            <MetricRow label="Expected Revenue" value={fmtKwacha(occupancy.expectedRevenue)} emphasize />
            <MetricRow label="Full Capacity Revenue" value={fmtKwacha(occupancy.fullCapacityRevenue)} emphasize />
            <MetricRow label="Days 20–30 Subtotal" value={fmtKwacha(late?.expected ?? 0)} />
            <MetricRow label="Days 1–5 Subtotal" value={fmtKwacha(early?.expected ?? 0)} />
            <MetricRow label="Window total" value={fmtKwacha((early?.expected ?? 0) + (late?.expected ?? 0))} />
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold tabular-nums ${emphasize ? "text-blue-700" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}
