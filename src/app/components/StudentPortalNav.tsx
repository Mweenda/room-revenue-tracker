import type { ElementType } from "react";

export type StudentNavTab<T extends string> = {
  id: T;
  label: string;
  icon: ElementType;
};

export function StudentPortalNav<T extends string>({
  tabs,
  view,
  unread = 0,
  compactChrome,
  sideNav,
  onSelect,
}: {
  tabs: StudentNavTab<T>[];
  view: T;
  unread?: number;
  compactChrome: boolean;
  sideNav: boolean;
  onSelect: (id: T) => void;
}) {
  const buttons = tabs.map(({ id, label, icon: Icon }) => {
    const active = view === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        className={`${sideNav ? "w-full py-2.5 px-1" : "flex-1 py-3"} flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] transition-all duration-150 ${
          compactChrome && !sideNav ? "py-2" : ""
        } ${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
      >
        <span className="relative">
          <Icon size={20} className="transition-transform duration-150" style={{ transform: active ? "scale(1.1)" : "scale(1)" }} />
          {id === "notifications" && unread > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold leading-4 text-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span className={`font-semibold leading-tight text-center ${sideNav ? "text-[10px]" : "text-[11px]"}`}>{label}</span>
      </button>
    );
  });

  if (sideNav) {
    return (
      <nav
        aria-label="Student portal"
        className="shrink-0 w-[min(4.75rem,22vw)] max-w-[5.25rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center gap-1 px-0.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] z-30 shadow-none"
      >
        {buttons}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Student portal"
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-[max(0.5rem,min(1rem,3vw))] pb-[max(0.35rem,env(safe-area-inset-bottom))] z-30 shrink-0 shadow-none"
    >
      <div className="max-w-3xl mx-auto flex">{buttons}</div>
    </nav>
  );
}
