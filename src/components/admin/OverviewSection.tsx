import { Building2, Users, BedDouble, Wallet, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { AdminData } from "../../lib/api/admin";
import { money, relativeTime, categoryStyle, OccupancyBar } from "./adminUi";

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}><Icon size={18} /></div>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function OverviewSection({ data, currency, onManageLandlords }: {
  data: AdminData;
  currency: string;
  onManageLandlords: () => void;
}) {
  const { overview, landlords, activity } = data;
  const pieData = [
    { name: "Active", value: overview.activeLandlords, color: "#10b981" },
    { name: "Suspended", value: overview.suspendedLandlords, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const topLandlords = [...landlords].sort((a, b) => b.beds - a.beds).slice(0, 6);
  const recent = activity.slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Landlords" value={String(overview.landlordCount)} sub={`${overview.activeLandlords} active · ${overview.suspendedLandlords} suspended`} icon={Building2} accent="bg-indigo-100 text-indigo-600" />
        <StatCard label="Students" value={String(overview.studentCount)} sub="Active tenants" icon={Users} accent="bg-sky-100 text-sky-600" />
        <StatCard label="Beds" value={String(overview.bedCount)} sub={`${overview.occupancyRate}% occupied (${overview.occupiedBeds}/${overview.bedCount})`} icon={BedDouble} accent="bg-emerald-100 text-emerald-600" />
        <StatCard label="Revenue" value={money(overview.collectedRevenue, currency)} sub={`${money(overview.monthlyRevenue, currency)} monthly potential`} icon={Wallet} accent="bg-amber-100 text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Landlords at a glance</h3>
            <button onClick={onManageLandlords} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Manage →</button>
          </div>
          {topLandlords.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No landlords onboarded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-2.5 font-semibold">Landlord</th>
                    <th className="px-5 py-2.5 font-semibold hidden sm:table-cell">Occupancy</th>
                    <th className="px-5 py-2.5 font-semibold text-center">Students</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {topLandlords.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[12rem]">{l.fullName}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[12rem]">{l.blocks} block{l.blocks === 1 ? "" : "s"}</div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell"><OccupancyBar occupied={l.occupiedBeds} total={l.beds} /></td>
                      <td className="px-5 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{l.students}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{money(l.collected, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Landlord status</h3>
          {pieData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <>
              <div className="w-full h-[200px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={3} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="white" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} landlords`, n]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <TrendingUp size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Recent activity</h3>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {recent.map((a) => {
              const style = categoryStyle[a.category];
              return (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{a.note || a.action}</p>
                    <p className="text-xs text-slate-400 truncate">{a.actorEmail ?? "system"}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.className}`}>{style.label}</span>
                  <span className="shrink-0 text-xs text-slate-400 w-16 text-right">{relativeTime(a.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
