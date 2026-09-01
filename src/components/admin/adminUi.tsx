import * as React from "react";
import { X } from "lucide-react";
import type { ActivityCategory, LandlordStatus } from "../../lib/api/admin";

const CURRENCY_SYMBOL: Record<string, string> = {
  ZMW: "K",
  USD: "$",
  EUR: "€",
  GBP: "£",
  ZAR: "R",
};

export function money(value: number, currency = "ZMW"): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const n = Number.isFinite(value) ? value : 0;
  return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const categoryStyle: Record<ActivityCategory, { label: string; className: string; dot: string }> = {
  create: { label: "Create", className: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  update: { label: "Update", className: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  delete: { label: "Delete", className: "bg-red-100 text-red-800", dot: "bg-red-500" },
  login: { label: "Login", className: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  security: { label: "Security", className: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  other: { label: "Event", className: "bg-slate-100 text-slate-600", dot: "bg-slate-300" },
};

export const landlordStatusStyle: Record<LandlordStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
};

export function OccupancyBar({ occupied, total }: { occupied: number; total: number }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const tone = pct >= 85 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums w-14 text-right">{occupied}/{total}</span>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, maxWidth = "max-w-lg" }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[min(92dvh,44rem)] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700`}>
        <div className="sticky top-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export const adminInput =
  "w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

export const adminLabel = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";
