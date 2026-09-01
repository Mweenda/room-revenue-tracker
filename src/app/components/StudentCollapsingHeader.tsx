import { type ReactNode } from "react";
import { Building2 } from "lucide-react";

/**
 * Material / iOS-style large title: a pinned compact bar with no elevation,
 * and an expanded block that scrolls under it so the header appears to
 * minimize without a gap or drop shadow.
 */
export function StudentCollapsingHeader({
  title,
  compactTitleVisible,
  compactChrome = false,
  children,
}: {
  title: string;
  compactTitleVisible: boolean;
  compactChrome?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 bg-slate-900 dark:bg-black shadow-none drop-shadow-none ring-0 isolate [transform:translateZ(0)]">
        <div className={`max-w-3xl mx-auto px-[max(1rem,min(1.5rem,4vw))] flex items-center gap-3 min-h-12 ${compactChrome ? "pt-[max(0.4rem,env(safe-area-inset-top))] pb-2" : "pt-[max(0.75rem,env(safe-area-inset-top))] pb-3"}`}>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Building2 size={13} className="text-white" />
            </div>
            <span className="text-emerald-400 text-xs font-mono font-bold tracking-wider">ROOM REVENUE</span>
          </div>
          <p
            className={`min-w-0 flex-1 text-sm font-semibold text-white truncate text-right transition-opacity duration-200 ease-out ${
              compactTitleVisible || compactChrome ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!compactTitleVisible && !compactChrome}
          >
            {title}
          </p>
        </div>
      </header>
      <div className={`relative z-10 bg-slate-900 dark:bg-black shadow-none ${compactChrome ? "hidden" : ""}`}>
        <div className="max-w-3xl mx-auto px-[max(1rem,min(1.5rem,4vw))] pb-5">{children}</div>
      </div>
    </>
  );
}
