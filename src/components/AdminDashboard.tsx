import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Building2, Users, ScrollText, Settings as SettingsIcon, ShieldCheck,
  LogOut, RefreshCw, Menu,
} from "lucide-react";
import { useAdminData } from "../hooks/useAdminData";
import { fetchPlatformSettings, logAdminLogin } from "../lib/api/admin";
import { OverviewSection } from "./admin/OverviewSection";
import { LandlordsSection } from "./admin/LandlordsSection";
import { StudentsSection } from "./admin/StudentsSection";
import { ActivitySection } from "./admin/ActivitySection";
import { SettingsSection } from "./admin/SettingsSection";
import { SecuritySection } from "./admin/SecuritySection";

type Section = "overview" | "landlords" | "students" | "activity" | "settings" | "security";

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "landlords", label: "Landlords", icon: Building2 },
  { id: "students", label: "Students", icon: Users },
  { id: "activity", label: "Activity Log", icon: ScrollText },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "security", label: "Security", icon: ShieldCheck },
];

interface AdminDashboardProps {
  admin: { email?: string; name?: string } | null;
  onLogout: () => void;
}

export function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  const data = useAdminData();
  const [section, setSection] = useState<Section>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [currency, setCurrency] = useState("ZMW");

  useEffect(() => { logAdminLogin(); }, []);
  useEffect(() => {
    let active = true;
    fetchPlatformSettings().then((s) => { if (active) setCurrency(s.currency); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const adminEmail = admin?.email ?? "admin@rrt.io";
  const activeNav = useMemo(() => NAV.find((n) => n.id === section) ?? NAV[0], [section]);

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = section === item.id;
        const Icon = item.icon;
        return (
          <button key={item.id} onClick={() => { setSection(item.id); onNavigate?.(); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            <Icon size={18} /> {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2.5 px-1.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-sm"><ShieldCheck size={20} className="text-white" /></div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">RRT Admin</div>
            <div className="text-[11px] text-slate-400">Console</div>
          </div>
        </div>
        <NavList />
        <div className="mt-auto pt-4">
          <div className="px-1.5 mb-2 text-xs text-slate-400 truncate">{adminEmail}</div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col">
            <div className="flex items-center gap-2.5 px-1.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center"><ShieldCheck size={20} className="text-white" /></div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">RRT Admin</div>
            </div>
            <NavList onNavigate={() => setNavOpen(false)} />
            <div className="mt-auto pt-4">
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={18} /> Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setNavOpen(true)} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Menu size={20} /></button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{activeNav.label}</h1>
                <p className="text-xs text-slate-400 truncate hidden sm:block">Room Revenue Tracker — platform administration</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => data.refresh()} disabled={data.loading} title="Refresh" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                <RefreshCw size={17} className={data.loading ? "animate-spin" : ""} />
              </button>
              <button onClick={onLogout} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={18} /></button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {data.error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <span>Could not load platform data. {data.error}</span>
              <button onClick={() => data.refresh()} className="font-semibold underline shrink-0">Retry</button>
            </div>
          )}

          {data.loading && data.landlords.length === 0 && !data.error ? (
            <div className="flex items-center justify-center py-24 text-slate-400"><RefreshCw size={22} className="animate-spin mr-2" /> Loading platform data…</div>
          ) : (
            <>
              {section === "overview" && <OverviewSection data={data} currency={currency} onManageLandlords={() => setSection("landlords")} />}
              {section === "landlords" && <LandlordsSection landlords={data.landlords} currency={currency} onChanged={data.refresh} />}
              {section === "students" && <StudentsSection students={data.students} currency={currency} />}
              {section === "activity" && <ActivitySection activity={data.activity} />}
              {section === "settings" && <SettingsSection onSaved={(s) => setCurrency(s.currency)} />}
              {section === "security" && <SecuritySection adminEmail={adminEmail} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
