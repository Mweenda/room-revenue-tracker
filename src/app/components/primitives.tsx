import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge as ShadBadge } from "./ui/badge";

/** Shared interactive treatment so every clickable surface reacts the same way. */
export const HOVER_SURFACE =
  "glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
export const HOVER_ROW = "glass-row hover:bg-slate-50/90 dark:hover:bg-slate-800/80";
export const GLASS_PANEL =
  "bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-2xl";
export const GLASS_SOFT =
  "bg-white/70 dark:bg-slate-900/65 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg";
/** Frosted floating menu that lifts off the page with a specular edge and layered shadow. */
export const GLASS_POPOVER =
  "glass-popover rounded-3xl";
export const OVERLAY_SCRIM =
  "absolute inset-0 bg-slate-950/50 backdrop-blur-sm";

export function Badge({ label, className }: { label: string; className: string }) {
  return (
    <ShadBadge
      variant="secondary"
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border-transparent ${className}`}
    >
      {label}
    </ShadBadge>
  );
}

export function KpiCard({ label, value, sub, accent, icon: Icon }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ElementType;
}) {
  return (
    <Card className={`gap-1 border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-4 shadow-sm group ${HOVER_SURFACE}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />}
      </div>
      <span className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </Card>
  );
}

export function SectionCard({ title, children, action, className }: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`gap-0 border-slate-200/80 dark:border-slate-700 dark:bg-slate-900/80 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden py-0 ${HOVER_SURFACE} ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4 border-b-[1px] border-slate-100 dark:border-slate-800">
        <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

/** Entry-point card used by the Reports hub. */
export function NavCard({ title, description, icon: Icon, accent, onClick, footer }: {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  onClick: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`cursor-pointer border-slate-200 shadow-sm gap-0 py-0 ${HOVER_SURFACE}`}
    >
      <CardContent className="p-6 flex flex-col items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accent}`}>
          <Icon size={22} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
        {footer}
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          Open <ChevronRight size={15} />
        </span>
      </CardContent>
    </Card>
  );
}

const PRIMARY_BUTTON =
  "glass-hover inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const buttonStyles = {
  primary: `${PRIMARY_BUTTON} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500`,
  danger: `${PRIMARY_BUTTON} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500`,
  neutral: `${PRIMARY_BUTTON} bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500`,
  outline: `${PRIMARY_BUTTON} border border-slate-200 bg-white/70 backdrop-blur-sm text-slate-700 hover:bg-white focus-visible:ring-slate-400`,
  subtle: `${PRIMARY_BUTTON} bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400`,
} as const;

export const inputStyles =
  "glass-field w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white/90 dark:bg-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[40px] disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-400";

export function ModalFrame({
  children,
  onClose,
  className,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button type="button" className={`${OVERLAY_SCRIM} z-0`} aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${GLASS_PANEL} rounded-2xl max-h-[min(92dvh,48rem)] overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-200 ${className ?? "max-w-md"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export function StatusBanner({ tone, children }: {
  tone: "error" | "warning" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-slate-50 border-slate-200 text-slate-700",
  } as const;
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm shadow-sm backdrop-blur-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}
