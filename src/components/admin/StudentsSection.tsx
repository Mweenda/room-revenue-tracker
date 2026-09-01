import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AdminStudentRow } from "../../lib/api/admin";
import { money, adminInput } from "./adminUi";

const billingBadge: Record<string, string> = {
  "Open Window": "bg-emerald-100 text-emerald-800",
  "Paid / Secured": "bg-blue-100 text-blue-800",
  "OVERDUE / UNPAID": "bg-red-100 text-red-800",
  "Grace Period": "bg-amber-100 text-amber-800",
  Vacant: "bg-slate-100 text-slate-600",
};

const tenantStatusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  evicted: "bg-red-100 text-red-800",
  moved_out: "bg-slate-100 text-slate-600",
};

export function StudentsSection({ students, currency }: { students: AdminStudentRow[]; currency: string }) {
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) =>
      (!onlyActive || s.tenantStatus === "active") &&
      (q === "" || s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.bedSpaceId.toLowerCase().includes(q) || s.landlordName.toLowerCase().includes(q)),
    );
  }, [students, search, onlyActive]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, bed, landlord…" className={`${adminInput} pl-9`} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
          Active only
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No students match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 font-semibold">Student</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Bed</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Landlord</th>
                  <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Balance</th>
                  <th className="px-5 py-3 font-semibold text-center">Billing</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[13rem]">{s.fullName}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[13rem]">{s.email || s.phone || "—"}</div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell font-mono text-xs text-slate-600 dark:text-slate-300">{s.bedSpaceId}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-slate-600 dark:text-slate-300 truncate max-w-[12rem]">{s.landlordName}</td>
                    <td className="px-5 py-3 text-right hidden lg:table-cell font-semibold text-slate-900 dark:text-slate-100">{money(s.balance, currency)}</td>
                    <td className="px-5 py-3 text-center">
                      {s.tenantStatus === "active"
                        ? <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${billingBadge[s.billingStatus ?? ""] ?? "bg-slate-100 text-slate-600"}`}>{s.billingStatus ?? "Unknown"}</span>
                        : <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${tenantStatusBadge[s.tenantStatus] ?? "bg-slate-100 text-slate-600"}`}>{s.tenantStatus.replace("_", " ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 px-1">Showing {filtered.length} of {students.length} tenants across all properties.</p>
    </div>
  );
}
