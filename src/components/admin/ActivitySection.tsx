import { useMemo, useState } from "react";
import type { AdminActivity, ActivityCategory } from "../../lib/api/admin";
import { relativeTime, categoryStyle } from "./adminUi";

const FILTERS: (ActivityCategory | "all")[] = ["all", "create", "update", "delete", "login", "security"];

export function ActivitySection({ activity }: { activity: AdminActivity[] }) {
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: activity.length };
    for (const a of activity) c[a.category] = (c[a.category] ?? 0) + 1;
    return c;
  }, [activity]);

  const filtered = useMemo(
    () => (filter === "all" ? activity : activity.filter((a) => a.category === filter)),
    [activity, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const label = f === "all" ? "All" : categoryStyle[f].label;
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${active ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
              {label} {counts[f] ? `(${counts[f]})` : ""}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No activity in this category yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {filtered.map((a) => {
              const style = categoryStyle[a.category];
              return (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 dark:text-slate-200">{a.note || a.action}</p>
                    <p className="text-xs text-slate-400 truncate">
                      <span className="font-mono">{a.action}</span>
                      {a.actorEmail ? <> · {a.actorEmail}</> : null}
                      {a.entityType ? <> · {a.entityType}</> : null}
                    </p>
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
