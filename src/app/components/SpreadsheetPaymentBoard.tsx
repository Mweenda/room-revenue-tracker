import { fmtKwacha } from "../../lib/billing";
import { paymentWindowGroups, vacantBedRows, occupancyReport } from "../../lib/paymentTracking";
import type { BillingRecord } from "../../lib/types";

function formatEntryDate(value: string): string {
  if (!value || value === "-") return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

export default function SpreadsheetPaymentBoard({ billingRecords }: { billingRecords: BillingRecord[] }) {
  const occupancy = occupancyReport(billingRecords);
  const vacant = vacantBedRows(billingRecords);
  const windows = paymentWindowGroups(billingRecords);
  const early = windows.find((group) => group.window === "days-1-5");
  const late = windows.find((group) => group.window === "days-20-30");
  const listed = [early, late].filter(Boolean);

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
                  <th className="text-center px-3 py-2.5 font-semibold">Vacant</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Reserved</th>
                  <th className="text-center px-5 py-2.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-5 py-2.5 font-semibold text-blue-700">Male</td>
                  <td className="px-3 py-2.5 text-center font-bold">{occupancy.maleVacant}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400">0</td>
                  <td className="px-5 py-2.5 text-center font-bold">{occupancy.maleVacant}</td>
                </tr>
                <tr>
                  <td className="px-5 py-2.5 font-semibold text-pink-700">Female</td>
                  <td className="px-3 py-2.5 text-center font-bold">{occupancy.femaleVacant}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400">0</td>
                  <td className="px-5 py-2.5 text-center font-bold">{occupancy.femaleVacant}</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-5 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-center">{occupancy.vacantBeds}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400">0</td>
                  <td className="px-5 py-2.5 text-center">{occupancy.vacantBeds}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Bed Space Report</h3>
            <MetricRow label="Active Tenants" value={String(occupancy.activeTenants)} />
            <MetricRow label="Vacant / Reserved" value={String(occupancy.vacantBeds)} />
            <MetricRow label="Total Bed Spaces" value={String(occupancy.totalBeds)} />
            <MetricRow label="Expected Revenue" value={fmtKwacha(occupancy.expectedRevenue)} emphasize />
            <MetricRow label="Full Capacity Revenue" value={fmtKwacha(occupancy.fullCapacityRevenue)} emphasize />
            <MetricRow label="Days 20–30 Subtotal" value={fmtKwacha(late?.expected ?? 0)} />
            <MetricRow label="Days 1–5 Subtotal" value={fmtKwacha(early?.expected ?? 0)} />
            <MetricRow label="Window total" value={fmtKwacha((early?.expected ?? 0) + (late?.expected ?? 0))} />
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {listed.map((group) => group && (
          <section key={group.window} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">{group.label}</h3>
              <span className="text-sm font-mono font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg">{fmtKwacha(group.expected)}</span>
            </header>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Tenant Name</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Balance</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Entry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <tr key={row.billingId}>
                      <td className="px-4 py-2 font-semibold text-slate-800">{row.tenantName}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{row.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-slate-500">{formatEntryDate(row.entryDate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="px-4 py-2.5">Subtotal · {group.rows.length} students</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtKwacha(group.expected)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtKwacha(group.outstanding)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        ))}
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
