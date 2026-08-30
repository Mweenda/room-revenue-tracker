import { useState, useRef, useEffect, useMemo } from "react";
import {
  Building2, CreditCard, Zap, FileText, Plus, X, Check,
  Download, Eye, Home, User, Menu, CheckCircle,
  Upload, ChevronRight, AlertTriangle, TrendingUp, Search,
  Settings, LogOut, UserCircle, Camera, EyeOff,
  Bell, Shield, Phone, Mail, MapPin, Calendar,
  Edit3, Save, RefreshCw, HelpCircle, ExternalLink,
  ChevronDown, Hash, DollarSign, Users, BarChart3,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useTrackerData } from "../hooks/useTrackerData";
import { BLOCKS, billingMonthOptions, billingRecordsForMonth, formatBillingPeriodLabel, formatMonthYear, formatMonthYearShort, getCurrentBillingMonth, getCurrentYear, type BillingMonth } from "../lib/billing";
import { formatHeaderDateTime, useLiveDateTime } from "../hooks/useLiveDateTime";
import { isBedAssignable, type OccupancyIssue } from "../lib/occupancy";
import { LandingPage } from "../components/LandingPage";
import { StudentLogin } from "../components/StudentLogin";
import { LandlordLogin } from "../components/LandlordLogin";
import { changeStudentPassword, linkTenantToAuthUser, signOutStudent } from "../lib/auth";
import { getSupabase } from "../lib/supabase";
import { Toaster } from "./components/ui/sonner";
import { Badge, KpiCard, SectionCard, StatusBanner } from "./components/primitives";
import StudentsView from "./views/StudentsView";
import ReportsView from "./views/ReportsView";
import { assertLandlord, isLandlord } from "../lib/authz";
import type { StudentAccountRow } from "../lib/api/students";
import type { ApplyRentIncrementResult } from "./components/RentIncrementDialog";
import type { EvictionResult } from "./views/StudentsView";
import type { RentIncreaseMode, RentScope } from "../lib/rent";
import type {
  BedSpace,
  BillingRecord,
  BillingStatus,
  BlockCode,
  IssueCategory,
  IssueStatus,
  LandlordView,
  MaintenanceIssue,
  OnboardStudentInput,
  Payment,
  PayStatus,
  StudentView,
  TenantStatus,
  UpdateStudentAccountInput,
  UtilityBlock,
} from "../lib/types";

type EvictStudentFn = (input: {
  tenantId: string;
  reason: string;
  status?: Exclude<TenantStatus, "active">;
}) => Promise<EvictionResult>;

type ApplyRentIncrementFn = (input: {
  scope: RentScope;
  mode: RentIncreaseMode;
  value: number;
  effectiveDate: string;
}) => Promise<ApplyRentIncrementResult>;

// ─── Helpers & Constants ─────────────────────────────────────────────────────

const billingStatusStyle: Record<BillingStatus, { bg: string; border: string; dot: string; text: string; badge: string }> = {
  "Open Window":     { bg: "bg-emerald-50", border: "border-emerald-300", dot: "bg-emerald-500",  text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-800" },
  "Paid / Secured":  { bg: "bg-blue-50",    border: "border-blue-300",    dot: "bg-blue-500",     text: "text-blue-800",    badge: "bg-blue-100 text-blue-800" },
  "OVERDUE / UNPAID":{ bg: "bg-red-50",     border: "border-red-300",     dot: "bg-red-500",      text: "text-red-800",     badge: "bg-red-100 text-red-800" },
  "Grace Period":    { bg: "bg-amber-50",   border: "border-amber-300",   dot: "bg-amber-500",    text: "text-amber-800",   badge: "bg-amber-100 text-amber-800" },
  "Vacant":          { bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400",    text: "text-slate-500",   badge: "bg-slate-100 text-slate-600" },
};

const payStatusStyle: Record<PayStatus, string> = {
  pending:  "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const categoryIcon: Record<string, string> = { Plumbing: "🔧", Electrical: "⚡", Structural: "🏗️", Appliance: "📦" };

function fmt(n: number) { return `K${n.toLocaleString()}`; }

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function getInitials(name: string) { return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(); }

// ─── Shared UI Components ────────────────────────────────────────────────────


function InfoRow({ label, value, icon: Icon, mono }: { label: string; value: string; icon?: React.ElementType; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        {Icon && <Icon size={14} className="shrink-0" />}
        <span>{label}</span>
      </div>
      <span className={`text-sm font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${checked ? "bg-emerald-600" : "bg-slate-200"}`}
    >
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled }: { label: string; value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
      <input
        type={isPassword && visible ? "text" : type} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        disabled={disabled}
        className={`w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[44px] disabled:bg-slate-50 disabled:text-slate-400 ${isPassword ? "pr-11" : ""}`}
      />
      {isPassword && <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label}` : `Show ${label}`} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700"><>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</></button>}
      </div>
    </div>
  );
}

// ─── User Menu ───────────────────────────────────────────────────────────────

function UserMenu({ name, role, onLogout, onProfile, onSettings, dark = false, dropUp = true }: {
  name: string; role: string; onLogout: () => void;
  onProfile?: () => void; onSettings?: () => void;
  dark?: boolean; dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 min-h-[52px] ${dark ? "hover:bg-slate-800 text-white" : "hover:bg-slate-100 text-slate-900"}`}
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
          {getInitials(name)}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-sm font-semibold truncate ${dark ? "text-white" : "text-slate-900"}`}>{name}</p>
          <p className={`text-xs truncate ${dark ? "text-slate-400" : "text-slate-500"}`}>{role}</p>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${dark ? "text-slate-400" : "text-slate-400"}`} />
      </button>

      {open && (
        <div className={`absolute ${dropUp ? "bottom-full mb-2" : "top-full mt-2"} left-0 right-0 rounded-xl shadow-2xl border overflow-hidden z-50 ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
          <div className={`px-4 py-3 border-b ${dark ? "border-slate-700" : "border-slate-100"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {getInitials(name)}
              </div>
              <div>
                <p className={`text-sm font-bold ${dark ? "text-white" : "text-slate-900"}`}>{name}</p>
                <p className={`text-xs ${dark ? "text-emerald-400" : "text-emerald-600"}`}>{role}</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            {[
              { icon: UserCircle, label: "View Profile", action: onProfile },
              { icon: Settings,   label: "Settings",     action: onSettings },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={() => { setOpen(false); action?.(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${dark ? "text-slate-300 hover:bg-slate-700 hover:text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                <Icon size={15} className={dark ? "text-slate-400" : "text-slate-400"} />
                {label}
              </button>
            ))}
            <div className={`my-1 border-t ${dark ? "border-slate-700" : "border-slate-100"}`} />
            <button onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors duration-150">
              <LogOut size={15} className="text-red-500" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bed Card Component ───────────────────────────────────────────────────────

function BedCard({ bed, billingRecord, onClick }: { bed: BedSpace; billingRecord?: BillingRecord; onClick: () => void }) {
  const status = billingRecord?.billing_status ?? (bed.status === "vacant" ? "Vacant" : "Open Window");
  const style = billingStatusStyle[status];

  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 border-2 ${style.border} ${style.bg} hover:scale-[1.04] hover:shadow-lg hover:brightness-[0.97] active:scale-[1.02] transition-all duration-200 flex flex-col gap-1.5 text-left w-full min-h-[100px] group focus:outline-none focus:ring-2 focus:ring-emerald-500`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
        <span className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-wide">{bed.identifier}</span>
      </div>
      <p className={`text-[11px] font-semibold ${style.text} line-clamp-2 flex-1 leading-snug`}>
        {bed.student?.name ?? "Vacant"}
      </p>
      <p className="text-[10px] font-mono text-slate-400 font-medium">{fmt(bed.rentAmount)}</p>
    </button>
  );
}

// ─── Landlord Profile Page ────────────────────────────────────────────────────

function LandlordProfile({ beds, billingRecords, landlord, onSave }: { beds: BedSpace[]; billingRecords: BillingRecord[]; landlord: any; onSave: (input: any) => Promise<any> }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: landlord?.name ?? "",
    email: "",
    phone: landlord?.phone ?? "",
    address: landlord?.address ?? "",
    bio: landlord?.bio ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totalOccupied = beds.filter((b) => b.status === "occupied").length;
  const totalRevenue = billingRecords.reduce((s, r) => s + r.current_rent, 0);
  const overdueCount = billingRecords.filter((r) => r.billing_status === "OVERDUE / UNPAID").length;
  const paidCount = billingRecords.filter((r) => r.billing_status === "Paid / Secured").length;

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave({ id: landlord.id, ...form, email: form.email.trim() || landlord.email });
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile update failed");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-8 flex flex-col sm:flex-row items-start sm:items-end gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
            {getInitials(form.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">Property Owner</p>
            <h1 className="text-2xl font-bold text-white">{form.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5"><MapPin size={13} />{form.address}</p>
          </div>
          <button
            onClick={() => editMode ? handleSave() : setEditMode(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shrink-0 ${editMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}
          >
            {editMode ? <><Save size={15} /> Save Changes</> : <><Edit3 size={15} /> Edit Profile</>}
          </button>
        </div>
        <div className="border-t border-slate-700 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-700">
          {[
            { label: "Total Beds",  value: beds.length,      icon: Hash },
            { label: "Occupied",    value: totalOccupied,    icon: Users },
            { label: "Full Capacity", value: fmt(totalRevenue), icon: DollarSign },
            { label: "Overdue",     value: overdueCount,     icon: AlertTriangle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="px-5 py-4 text-center">
              <Icon size={14} className="text-slate-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle size={16} /> Profile saved successfully.
        </div>
      )}
      {saveError && <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{saveError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Contact Information">
          <div className="p-5 space-y-4">
            <Field label="Full Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} disabled={!editMode} />
            <Field label="Email Address" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="example@email.com" type="email" disabled={!editMode} />
            <Field label="Phone Number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} disabled={!editMode} />
            <Field label="Property Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} disabled={!editMode} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio</label>
              <textarea
                disabled={!editMode}
                value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:bg-slate-50 disabled:text-slate-400 transition-all"
              />
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Portfolio Overview">
            <div className="p-5 space-y-1">
              <InfoRow label="Residential Blocks" value="4 (BBH, NWG, ANX, CRV)" icon={Building2} />
              <InfoRow label="Total Bed Spaces" value={`${beds.length} beds`} icon={Hash} />
              <InfoRow label="Active Tenants" value={`${totalOccupied} tenants`} icon={Users} />
              <InfoRow label="Vacant Beds" value={`${beds.filter(b => b.status === "vacant").length} available`} icon={Home} />
              <InfoRow label="Paid / Secured" value={`${paidCount} accounts`} icon={CheckCircle} />
              <InfoRow label="Overdue Accounts" value={`${overdueCount} accounts`} icon={AlertTriangle} />
              <InfoRow label="Full Capacity Value" value={fmt(totalRevenue)} icon={DollarSign} />
            </div>
          </SectionCard>

          <SectionCard title="Block Occupancy">
            <div className="p-5 space-y-3">
              {BLOCKS.map((code) => {
                const total = beds.filter((b) => b.blockCode === code).length;
                const occ = beds.filter((b) => b.blockCode === code && b.status === "occupied").length;
                const pct = Math.round((occ / total) * 100);
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600 w-10">{code}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-16 text-right">{occ}/{total} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ─── Landlord Settings Page ───────────────────────────────────────────────────

function LandlordSettings({ landlord, onProfileSave }: { landlord: any; onProfileSave: (input: any) => Promise<any> }) {
  const [activeTab, setActiveTab] = useState<"general" | "property" | "notifications" | "security">("general");
  const [notifs, setNotifs] = useState({ paymentAlerts: true, overdueAlerts: true, maintenanceAlerts: true, weeklyReport: false, smsAlerts: false });
  const [property, setProperty] = useState({ gracePeriod: "5", ownerUtilityCap: "70", billingCycle: "Monthly", currency: "ZMW (K)" });
  const [saved, setSaved] = useState(false);
  const [account, setAccount] = useState({
    name: landlord?.name ?? "",
    email: "",
    phone: landlord?.phone ?? "",
    address: landlord?.address ?? "",
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleAccountSave() {
    setSaveError(null);
    try {
      await onProfileSave({ id: landlord.id, name: account.name, email: account.email.trim() || landlord.email, phone: account.phone, address: account.address, bio: landlord.bio ?? "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Account update failed");
    }
  }
  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  async function handlePasswordSave() {
    setSaveError(null);
    if (newPassword.length < 8) { setSaveError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setSaveError("New passwords do not match."); return; }
    try {
      await changeStudentPassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Password update failed"); }
  }

  const tabs = [
    { id: "general" as const,       label: "General",       icon: Settings },
    { id: "property" as const,      label: "Property",      icon: Building2 },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "security" as const,      label: "Security",      icon: Shield },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and property preferences.</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle size={16} /> Settings saved successfully.
        </div>
      )}
      {saveError && <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{saveError}</p>}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap ${activeTab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <SectionCard title="Account Information">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Display Name" value={account.name} onChange={(value) => setAccount((current) => ({ ...current, name: value }))} />
              <Field label="Role" value={landlord?.role ?? "Property Owner"} disabled />
              <Field label="Email Address" value={account.email} onChange={(value) => setAccount((current) => ({ ...current, email: value }))} placeholder="example@email.com" type="email" />
              <Field label="Phone Number" value={account.phone} onChange={(value) => setAccount((current) => ({ ...current, phone: value }))} />
            </div>
            <Field label="Property Address" value={account.address} onChange={(value) => setAccount((current) => ({ ...current, address: value }))} />
            <div className="pt-2">
              <button onClick={() => void handleAccountSave()} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors duration-150">
                <Save size={15} /> Save Changes
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "property" && (
        <SectionCard title="Property Configuration">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Grace Period (days)</label>
                <input type="number" value={property.gracePeriod} onChange={(e) => setProperty(f => ({ ...f, gracePeriod: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]" />
                <p className="text-xs text-slate-400 mt-1">Days before overdue status is applied after rent due date.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Owner Utility Cap (K per student)</label>
                <input type="number" value={property.ownerUtilityCap} onChange={(e) => setProperty(f => ({ ...f, ownerUtilityCap: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]" />
                <p className="text-xs text-slate-400 mt-1">Maximum utilities contribution per student per month.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Billing Cycle</label>
                <select value={property.billingCycle} onChange={(e) => setProperty(f => ({ ...f, billingCycle: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]">
                  <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                <select value={property.currency} onChange={(e) => setProperty(f => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]">
                  <option>ZMW (K)</option><option>USD ($)</option>
                </select>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors duration-150">
                <Save size={15} /> Save Configuration
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "notifications" && (
        <SectionCard title="Notification Preferences">
          <div className="p-5 space-y-4">
            {[
              { key: "paymentAlerts" as const,     label: "Payment Submissions",    desc: "Get notified when students submit payment proof" },
              { key: "overdueAlerts" as const,      label: "Overdue Accounts",        desc: "Alerts for accounts that become overdue" },
              { key: "maintenanceAlerts" as const,  label: "Maintenance Reports",     desc: "Notified when new issues are reported" },
              { key: "weeklyReport" as const,       label: "Weekly Revenue Report",   desc: "Receive a weekly summary of billing activity" },
              { key: "smsAlerts" as const,          label: "SMS Alerts",              desc: "Receive critical alerts via SMS" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
                <ToggleSwitch checked={notifs[key]} onChange={(v) => setNotifs((n) => ({ ...n, [key]: v }))} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "security" && (
        <div className="space-y-4">
          <SectionCard title="Change Password">
            <div className="p-5 space-y-4">
              <Field label="Current Password" value={currentPassword} onChange={setCurrentPassword} placeholder="Your current password" type="password" />
              <Field label="New Password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" type="password" />
              <Field label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" type="password" />
              <button onClick={() => void handlePasswordSave()} disabled={!currentPassword || !newPassword || !confirmPassword} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors duration-150">
                <Shield size={15} /> Update Password
              </button>
            </div>
          </SectionCard>
          <SectionCard title="Active Sessions">
            <div className="p-5">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Current Session</p>
                  <p className="text-xs text-slate-500">Chrome · Lusaka, Zambia · Active now</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Active</span>
              </div>
              <button className="mt-4 text-sm text-red-500 hover:text-red-700 font-medium transition-colors duration-150">Sign out of all other sessions</button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ─── Student Profile Page ─────────────────────────────────────────────────────

function StudentProfileView({ bed, billingRecord, onSave, onPhotoUpload }: { bed?: BedSpace; billingRecord?: BillingRecord; onSave?: (input: { tenantId: string; name: string; phone: string; email: string; nrc?: string; moveInDate: string; sendLoginLink?: boolean }) => Promise<unknown> | unknown; onPhotoUpload?: (tenantId: string, file: File) => Promise<string>; }) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: bed?.student?.name ?? "",
    phone: bed?.student?.phone ?? "",
    email: bed?.student?.email ?? "",
    nrc: bed?.student?.nrc ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bed) return;
    setForm({
      name: bed.student?.name ?? "",
      phone: bed.student?.phone ?? "",
      email: bed.student?.email ?? "",
      nrc: bed.student?.nrc ?? "",
    });
  }, [bed]);

  const status = billingRecord?.billing_status ?? "Open Window";
  const style = billingStatusStyle[status];

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bed?.student || !onPhotoUpload) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose an image smaller than 5 MB.");
      return;
    }
    setPhotoSaving(true);
    setPhotoError(null);
    try { await onPhotoUpload(bed.student.id, file); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : "Photo upload failed"); }
    finally { setPhotoSaving(false); }
  }

  async function handleSave() {
    if (!bed?.student || !onSave) {
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 2500);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        tenantId: bed.student.id,
        name: form.name,
        phone: form.phone,
        email: form.email,
        nrc: form.nrc || "-",
        moveInDate: bed.student.moveInDate,
        sendLoginLink: true,
      });
      setSaved(true);
      setEditMode(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile update failed. Please try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (!bed) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 pb-24">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold text-base mb-1">No profile is linked to this account</p>
          <p>Please contact the landlord to assign your room and billing profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-8 flex flex-col sm:flex-row items-start sm:items-end gap-5">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={photoSaving} className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0 disabled:opacity-60" title="Update profile picture">
            {bed.student?.profileImageUrl ? <img src={bed.student.profileImageUrl} alt="Profile" className="w-full h-full object-cover" /> : getInitials(form.name)}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-[9px] py-1 text-center">{photoSaving ? "Uploading" : "Change photo"}</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          <div className="flex-1 min-w-0">
            <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-1">Student Tenant</p>
            <h1 className="text-2xl font-bold text-white">{form.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5 font-mono">{bed.identifier}</p>
          </div>
          <button onClick={() => editMode ? void handleSave() : setEditMode(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shrink-0 ${editMode ? "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}>
            {saving ? <><RefreshCw size={15} className="animate-spin" /> Saving...</> : editMode ? <><Save size={15} /> Save</> : <><Edit3 size={15} /> Edit</>}
          </button>
        </div>
        <div className="border-t border-slate-700 grid grid-cols-3 divide-x divide-slate-700">
          {[
            { label: "Monthly Rent", value: fmt(bed.rentAmount) },
            { label: "Move-in Date", value: bed.student?.moveInDate ?? "—" },
            { label: "Billing Status", value: status === "OVERDUE / UNPAID" ? "Overdue" : status },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-4 text-center">
              <p className="text-base font-bold text-white truncate">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle size={16} /> Profile updated successfully.
        </div>
      )}
      {saveError && <p className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{saveError}</p>}
      {photoError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{photoError}</p>}

      {billingRecord && (
        <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${style.text} mb-1`}>Current Billing Status</p>
              <p className="text-lg font-bold text-slate-900">{billingRecord.total_balance === 0 ? "Account Fully Settled" : `Balance Due: ${fmt(billingRecord.total_balance)}`}</p>
              <p className="text-sm text-slate-500 mt-0.5">Target month: {billingRecord.target_month} · Rent: {fmt(billingRecord.current_rent)}/mo</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${style.badge} shrink-0`}>
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {status === "OVERDUE / UNPAID" ? "Overdue" : status}
            </span>
          </div>
        </div>
      )}

      <SectionCard title="Personal Information">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} disabled={!editMode} />
            <Field label="Phone Number" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} disabled={!editMode} />
            <Field label="Email Address" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} type="email" disabled={!editMode} />
            <Field label="NRC / ID Number" value={form.nrc === "-" ? "" : form.nrc} onChange={(v) => setForm(f => ({ ...f, nrc: v }))} placeholder="123456/10/1" disabled={!editMode} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Lease Details">
        <div className="p-5 space-y-0">
          <InfoRow label="Block" value={bed.blockCode} icon={Building2} />
          <InfoRow label="Room Number" value={String(bed.roomNumber)} icon={Home} />
          <InfoRow label="Bed Letter" value={bed.bedLetter} icon={Hash} />
          <InfoRow label="Bed Identifier" value={bed.identifier} icon={Hash} mono />
          <InfoRow label="Monthly Rent" value={fmt(bed.rentAmount)} icon={DollarSign} />
          <InfoRow label="Move-in Date" value={bed.student?.moveInDate ?? "—"} icon={Calendar} />
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Student Settings Page ────────────────────────────────────────────────────

function StudentSettingsView({ onLogout, email }: { onLogout: () => void; email: string }) {
  const [notifs, setNotifs] = useState({ paymentReminders: true, maintenanceUpdates: true, announcements: false });
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  async function handlePasswordChange() {
    setPasswordError(null);
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters."); return; }
    try {
      await changeStudentPassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (error) { setPasswordError(error instanceof Error ? error.message : "Password update failed"); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Manage your account preferences.</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle size={16} /> Settings saved.
        </div>
      )}

      <SectionCard title="Notifications">
        <div className="p-5 space-y-4">
          {[
            { key: "paymentReminders" as const,  label: "Payment Reminders",      desc: "Reminders before your rent due date" },
            { key: "maintenanceUpdates" as const, label: "Maintenance Updates",    desc: "Status changes on your reported issues" },
            { key: "announcements" as const,      label: "Property Announcements", desc: "Updates from your property manager" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-1.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ToggleSwitch checked={notifs[key]} onChange={(v) => setNotifs((n) => ({ ...n, [key]: v }))} />
            </div>
          ))}
          <button onClick={handleSave} className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors duration-150">
            <Save size={15} /> Save Preferences
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Security">
        <div className="p-5 space-y-4">
          <Field label="Current Password" value={currentPassword} onChange={setCurrentPassword} placeholder="Your current password" type="password" />
          <Field label="New Password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" type="password" />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-emerald-700">Password updated successfully for {email}.</p>}
          <button onClick={() => void handlePasswordChange()} disabled={!currentPassword || !newPassword} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors duration-150">
            <Shield size={15} /> Update Password
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Support">
        <div className="p-5 space-y-2">
          {[
            { icon: HelpCircle,    label: "Help Center",        desc: "Browse FAQs and guides" },
            { icon: Mail,          label: "Contact Management", desc: "Email your property manager" },
            { icon: ExternalLink,  label: "Terms & Privacy",    desc: "Review our policies" },
          ].map(({ icon: Icon, label, desc }) => (
            <button key={label} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-left group transition-colors duration-150">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors"><Icon size={16} className="text-slate-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          ))}
        </div>
      </SectionCard>

      <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl text-sm font-semibold transition-all duration-150">
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}

// ─── Revenue View ─────────────────────────────────────────────────────────────

function RevenueView({ billingRecords, billingMonth, onBillingMonthChange }: { billingRecords: BillingRecord[]; billingMonth: BillingMonth; onBillingMonthChange: (month: BillingMonth) => void }) {
  const [search, setSearch] = useState("");
  const [filterBlock, setFilterBlock] = useState<BlockCode | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<BillingStatus | "ALL">("ALL");
  const [filterGender, setFilterGender] = useState<"All" | "Male" | "Female">("All");

  const monthRecords = billingRecordsForMonth(billingRecords, billingMonth);
  const groups = {
    "Open Window":     monthRecords.filter((r) => r.billing_status === "Open Window"),
    "Paid / Secured":  monthRecords.filter((r) => r.billing_status === "Paid / Secured"),
    "OVERDUE / UNPAID":monthRecords.filter((r) => r.billing_status === "OVERDUE / UNPAID"),
    "Vacant":          monthRecords.filter((r) => r.billing_status === "Vacant"),
    "Grace Period":    monthRecords.filter((r) => r.billing_status === "Grace Period"),
  };

  const grandTotal = monthRecords.reduce((s, r) => s + r.current_rent, 0);
  const maleOcc = monthRecords.filter((r) => r.room_gender === "Male" && r.billing_status !== "Vacant").length;
  const femaleOcc = monthRecords.filter((r) => r.room_gender === "Female" && r.billing_status !== "Vacant").length;
  const maleVac = monthRecords.filter((r) => r.room_gender === "Male" && r.billing_status === "Vacant").length;
  const femaleVac = monthRecords.filter((r) => r.room_gender === "Female" && r.billing_status === "Vacant").length;

  const pieData = [
    { name: "Occupied Male",   value: maleOcc,   color: "#10B981" },
    { name: "Occupied Female", value: femaleOcc,  color: "#3B82F6" },
    { name: "Vacant Male",     value: maleVac,    color: "#F59E0B" },
    { name: "Vacant Female",   value: femaleVac,  color: "#F43F5E" },
  ];

  const filtered = monthRecords.filter((r) =>
    (search === "" || r.tenant_name.toLowerCase().includes(search.toLowerCase()) || r.billing_id.toLowerCase().includes(search.toLowerCase()) || r.phone_number.includes(search)) &&
    (filterBlock === "ALL" || r.house_block === filterBlock) &&
    (filterStatus === "ALL" || r.billing_status === filterStatus) &&
    (filterGender === "All" || r.room_gender === filterGender)
  );

  const statusSummaryRows: { key: BillingStatus; label: string }[] = [
    { key: "Open Window",     label: "Open Window" },
    { key: "Paid / Secured",  label: "Paid / Secured" },
    { key: "OVERDUE / UNPAID",label: "OVERDUE / UNPAID" },
    { key: "Vacant",          label: "Vacant" },
    { key: "Grace Period",    label: "Grace Period" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statusSummaryRows.map(({ key, label }) => {
          const s = billingStatusStyle[key];
          const records = groups[key];
          return (
            <div key={key} className={`rounded-xl border-l-4 ${s.border} ${s.bg} px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-default`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${s.text} mb-1 leading-tight`}>{label}</p>
              <p className={`text-2xl font-bold ${s.text}`}>{records.length}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{fmt(records.reduce((s, r) => s + r.current_rent, 0))}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Full Capacity" value={fmt(grandTotal)} sub={`${monthRecords.length} bed spaces`} icon={BarChart3} />
        <KpiCard label="Active Tenants" value={maleOcc + femaleOcc} sub="occupied beds" accent="text-emerald-700" icon={Users} />
        <KpiCard label={`Expected ${billingMonth}`} value={fmt(monthRecords.filter(r => r.billing_status !== "Vacant").reduce((s,r) => s + r.current_rent, 0))} accent="text-blue-700" icon={DollarSign} />
        <KpiCard label="Overdue Exposure" value={fmt(groups["OVERDUE / UNPAID"].reduce((s, r) => s + r.total_balance, 0))} accent="text-red-600" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
        <SectionCard title="Billing Status Breakdown" className="xl:col-span-3 min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                <tr><th className="text-left px-5 py-3 font-semibold">Status</th><th className="text-center px-4 py-3 font-semibold">Beds</th><th className="text-right px-5 py-3 font-semibold">Value (K)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusSummaryRows.map(({ key, label }) => {
                  const s = billingStatusStyle[key];
                  const records = groups[key];
                  return (
                    <tr key={key} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>{label}</span></td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">{records.length}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-700">{fmt(records.reduce((s, r) => s + r.current_rent, 0))}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                  <td className="px-5 py-3 text-xs uppercase tracking-wide text-slate-700">Total System Capacity</td>
                  <td className="px-4 py-3 text-center text-slate-900">{monthRecords.length}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-900">{fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100">
            <div className="px-5 py-3 border-b border-slate-100"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Occupancy — Gender Breakdown</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                  <tr><th className="text-left px-5 py-2.5 font-semibold">Gender</th><th className="text-center px-4 py-2.5 font-semibold">Occupied</th><th className="text-center px-4 py-2.5 font-semibold">Vacant</th><th className="text-center px-4 py-2.5 font-semibold">Reserved</th><th className="text-center px-4 py-2.5 font-semibold">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors"><td className="px-5 py-3 font-semibold text-blue-700">Male</td><td className="px-4 py-3 text-center font-bold">{maleOcc}</td><td className="px-4 py-3 text-center text-amber-600 font-medium">{maleVac}</td><td className="px-4 py-3 text-center text-slate-400">0</td><td className="px-4 py-3 text-center font-bold">{maleOcc+maleVac}</td></tr>
                  <tr className="hover:bg-slate-50 transition-colors"><td className="px-5 py-3 font-semibold text-pink-700">Female</td><td className="px-4 py-3 text-center font-bold">{femaleOcc}</td><td className="px-4 py-3 text-center text-amber-600 font-medium">{femaleVac}</td><td className="px-4 py-3 text-center text-slate-400">0</td><td className="px-4 py-3 text-center font-bold">{femaleOcc+femaleVac}</td></tr>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold"><td className="px-5 py-3 text-slate-900">Total</td><td className="px-4 py-3 text-center text-emerald-700">{maleOcc+femaleOcc}</td><td className="px-4 py-3 text-center text-amber-600">{maleVac+femaleVac}</td><td className="px-4 py-3 text-center text-slate-400">0</td><td className="px-4 py-3 text-center text-slate-900">{maleOcc+femaleOcc+maleVac+femaleVac}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Bed Space Occupancy" className="xl:col-span-2 min-w-0">
          <div className="p-5 flex flex-col h-full">
            <div className="w-full h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                      if (!value) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.52;
                      const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
                      const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
                      return (
                        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
                          {value}
                        </text>
                      );
                    }}
                  >
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="white" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} beds`, n]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 mt-4">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-slate-600 leading-tight truncate">{d.name}</span>
                  <span className="text-sm font-bold text-slate-900 ml-auto tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <InfoRow label="Active Tenants" value={String(maleOcc + femaleOcc)} />
              <InfoRow label="Vacant / Reserved" value={String(maleVac + femaleVac)} />
              <InfoRow label="Full Capacity Revenue" value={fmt(grandTotal)} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Tenant Billing Roster">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="sr-only">Tenant Billing Roster</span>
              <button onClick={() => downloadCSV(`billing-roster-${billingMonth.toLowerCase()}-${getCurrentYear()}.csv`, [["Billing ID","Block","Room","Bed","Gender","Tenant","Phone","Entry","Rent","Month","Balance","Days Due","Status"], ...monthRecords.map(r => [r.billing_id,r.house_block,r.room_number,r.bed_space,r.room_gender,r.tenant_name,r.phone_number,r.entry_date,String(r.current_rent),r.target_month,String(r.total_balance),String(r.days_past_due),r.billing_status])])}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150">
                <Download size={12} /> Export
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, phone…" className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full min-h-[36px]" />
              </div>
              {[
                { value: filterBlock, onChange: (v: string) => setFilterBlock(v as BlockCode | "ALL"), options: [["ALL","All Blocks"],["BBH","BBH"],["NWG","NWG"],["ANX","ANX"],["CRV","CRV"]] },
                { value: filterStatus, onChange: (v: string) => setFilterStatus(v as BillingStatus | "ALL"), options: [["ALL","All Statuses"],["Open Window","Open Window"],["Paid / Secured","Paid"],["OVERDUE / UNPAID","Overdue"],["Vacant","Vacant"],["Grace Period","Grace Period"]] },
                { value: filterGender, onChange: (v: string) => setFilterGender(v as "All" | "Male" | "Female"), options: [["All","All Genders"],["Male","Male"],["Female","Female"]] },
              ].map((sel, i) => (
                <select key={i} value={sel.value} onChange={(e) => sel.onChange(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[36px]">
                  {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-400">{filtered.length} of {monthRecords.length} records</p><select value={billingMonth} onChange={(e) => onBillingMonthChange(e.target.value as BillingMonth)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white font-semibold text-slate-700">{billingMonthOptions().map(({ month, label }) => <option key={month} value={month}>{label}</option>)}</select></div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Billing ID</th>
                <th className="text-left px-4 py-3 font-semibold">Tenant</th>
                <th className="text-left px-3 py-3 font-semibold">Gender</th>
                <th className="text-left px-3 py-3 font-semibold">Phone</th>
                <th className="text-right px-3 py-3 font-semibold">Rent</th>
                <th className="text-left px-3 py-3 font-semibold">Month</th>
                <th className="text-right px-3 py-3 font-semibold">Balance</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const s = billingStatusStyle[r.billing_status];
                return (
                  <tr key={r.billing_id} className="hover:bg-slate-50 transition-colors duration-150 group">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600 group-hover:text-slate-800">{r.billing_id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 max-w-[160px]"><span className="truncate block">{r.tenant_name}</span></td>
                    <td className="px-3 py-3"><span className={`text-xs font-semibold ${r.room_gender === "Male" ? "text-blue-600" : "text-pink-600"}`}>{r.room_gender}</span></td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{r.phone_number === "-" ? "—" : r.phone_number}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-700">{fmt(r.current_rent)}</td>
                    <td className="px-3 py-3 text-xs font-medium text-slate-600">{r.target_month === "-" ? "—" : r.target_month}</td>
                    <td className={`px-3 py-3 text-right font-mono text-xs font-bold ${r.total_balance === 0 ? "text-emerald-600" : r.billing_status === "OVERDUE / UNPAID" ? "text-red-600" : "text-slate-900"}`}>{r.billing_status === "Vacant" ? "—" : fmt(r.total_balance)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`}/>{r.billing_status === "OVERDUE / UNPAID" ? "Overdue" : r.billing_status}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No records match your filters.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 && <div className="px-4 py-10 text-center text-slate-400 text-sm">No records match.</div>}
          {filtered.map((r) => {
            const s = billingStatusStyle[r.billing_status];
            return (
              <div key={r.billing_id} className="px-4 py-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1"><span className="font-mono text-[10px] font-bold text-slate-500">{r.billing_id}</span><span className={`text-[10px] font-semibold ${r.room_gender === "Male" ? "text-blue-600" : "text-pink-600"}`}>{r.room_gender}</span></div>
                  <p className="font-bold text-slate-900 text-sm leading-tight">{r.tenant_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{fmt(r.current_rent)}/mo</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`}/>{r.billing_status === "OVERDUE / UNPAID" ? "Overdue" : r.billing_status}</span>
                  {r.billing_status !== "Vacant" && <span className={`text-sm font-bold font-mono ${r.total_balance === 0 ? "text-emerald-600" : r.billing_status === "OVERDUE / UNPAID" ? "text-red-600" : "text-slate-900"}`}>{fmt(r.total_balance)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Portal View ─────────────────────────────────────────────────────────────

function PortalView({ beds, billingMap, billingMonth, onBillingMonthChange, onboard, updateStudent, vacateBed }: {
  beds: BedSpace[];
  billingMap: Map<string, BillingRecord>;
  billingMonth: BillingMonth;
  onBillingMonthChange: (month: BillingMonth) => void;
  onboard: (input: { bedId: string; name: string; phone: string; email: string; moveInDate: string }) => Promise<unknown>;
  updateStudent: (input: { tenantId: string; name: string; phone: string; email: string; moveInDate: string }) => Promise<unknown>;
  vacateBed: (bedId: string) => Promise<void>;
}) {
  const [drawerBed, setDrawerBed] = useState<BedSpace | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockCode | "ALL">("ALL");
  const [form, setForm] = useState({ name: "", phone: "", email: "", bedId: "", moveInDate: "" });
  const [onboardSuccess, setOnboardSuccess] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vacating, setVacating] = useState(false);

  function closeDrawer() {
    setDrawerBed(null);
    setEditMode(false);
    setShowVacateConfirm(false);
    setDrawerError(null);
  }

  async function handleSaveTenant() {
    if (!drawerBed?.student?.id || !form.name.trim()) return;
    setSaving(true);
    setDrawerError(null);
    try {
      await updateStudent({
        tenantId: drawerBed.student.id,
        name: form.name.trim(),
        phone: form.phone,
        email: form.email,
        moveInDate: form.moveInDate || drawerBed.student.moveInDate,
      });
      setEditMode(false);
      setShowVacateConfirm(false);
      closeDrawer();
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : "Failed to save tenant");
    } finally {
      setSaving(false);
    }
  }

  async function handleVacate() {
    if (!drawerBed) return;
    setVacating(true);
    setDrawerError(null);
    try {
      await vacateBed(drawerBed.id);
      closeDrawer();
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : "Failed to mark bed as vacant");
    } finally {
      setVacating(false);
      setShowVacateConfirm(false);
    }
  }

  const occupied = beds.filter((b) => b.status === "occupied").length;
  const vacant = beds.filter((b) => b.status === "vacant").length;
  const totalRevenue = beds.filter((b) => b.status === "occupied").reduce((s, b) => s + b.rentAmount, 0);
  const vacantBeds = beds.filter((b) => isBedAssignable(b, billingMap.get(b.id)));
  const filteredBeds = selectedBlock === "ALL" ? beds : beds.filter((b) => b.blockCode === selectedBlock);

  async function handleOnboard() {
    if (!form.name || !form.bedId || !form.email.trim()) return;
    setOnboardError(null);
    try {
      await onboard({ bedId: form.bedId, name: form.name, phone: form.phone, email: form.email, moveInDate: form.moveInDate || new Date().toISOString().slice(0, 10) });
      setOnboardSuccess(true);
      setTimeout(() => { setShowOnboard(false); setOnboardSuccess(false); setForm({ name: "", phone: "", email: "", bedId: "", moveInDate: "" }); }, 1800);
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : "Onboarding failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Beds" value={beds.length} sub="across 4 blocks" icon={Building2} />
        <KpiCard label="Occupied" value={occupied} accent="text-emerald-600" sub={`${Math.round(occupied / beds.length * 100)}% occupancy`} icon={Users} />
        <KpiCard label="Vacant" value={vacant} accent="text-amber-600" sub="available" icon={Home} />
        <KpiCard label="Revenue Capacity" value={fmt(totalRevenue)} accent="text-emerald-700" sub={formatMonthYearShort(getCurrentBillingMonth())} icon={DollarSign} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select value={billingMonth} onChange={(e) => onBillingMonthChange(e.target.value as BillingMonth)} aria-label="Billing month" className="order-first sm:order-none border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white font-semibold text-slate-700 min-h-[44px]">
          {billingMonthOptions().map(({ month, label }) => (
            <option key={month} value={month}>{label}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap">
          {(["ALL", ...BLOCKS] as (BlockCode | "ALL")[]).map((b) => (
            <button key={b} onClick={() => setSelectedBlock(b)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 min-h-[36px] ${selectedBlock === b ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50"}`}>
              {b}
            </button>
          ))}
        </div>
        <button onClick={() => setShowOnboard(true)} className="sm:ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold text-sm transition-all duration-150 min-h-[44px] shadow-sm hover:shadow-md">
          <Plus size={16} /> Onboard New Tenant
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {(["Open Window","Paid / Secured","OVERDUE / UNPAID","Grace Period","Vacant"] as BillingStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${billingStatusStyle[s].dot}`} />
            {s === "OVERDUE / UNPAID" ? "Overdue" : s}
          </span>
        ))}
      </div>

      {BLOCKS.map((code) => {
        const blockBeds = filteredBeds.filter((b) => b.blockCode === code);
        if (blockBeds.length === 0) return null;
        const bOccupied = blockBeds.filter((b) => b.status === "occupied").length;
        const pct = Math.round((bOccupied / blockBeds.length) * 100);
        return (
          <div key={code} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900 font-mono text-sm">{code}</span>
                <span className="text-xs text-slate-500">{bOccupied}/{blockBeds.length} occupied · {pct}%</span>
              </div>
              <div className="w-24 sm:w-36 bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5">
              {blockBeds.map((bed) => (
                <BedCard key={bed.id} bed={bed} billingRecord={billingMap.get(bed.id)} onClick={() => setDrawerBed(bed)} />
              ))}
            </div>
          </div>
        );
      })}

      {drawerBed && (() => {
        const br = billingMap.get(drawerBed.id);
        const s = billingStatusStyle[br?.billing_status ?? "Vacant"];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDrawer} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-slate-900 px-6 py-5 flex items-start justify-between shrink-0">
                <div>
                  <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">{drawerBed.identifier}</span>
                  <p className="text-white font-bold text-lg mt-1">{drawerBed.student?.name ?? "Vacant Bed Space"}</p>
                  {br && <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-2 ${s.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>{br.billing_status === "OVERDUE / UNPAID" ? "Overdue" : br.billing_status}</span>}
                </div>
                <button onClick={closeDrawer} className="text-slate-400 hover:text-white transition-colors p-1 ml-4"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {drawerError && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{drawerError}</div>
                )}
                {drawerBed.student ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tenant Profile</h3>
                      {!editMode && (
                        <button onClick={() => { setEditMode(true); setShowVacateConfirm(false); setDrawerError(null); setForm({ name: drawerBed.student?.name || "", phone: drawerBed.student?.phone || "", email: drawerBed.student?.email || "", bedId: drawerBed.id, moveInDate: drawerBed.student?.moveInDate || "" }); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1">
                          <Edit3 size={14} /> Edit
                        </button>
                      )}
                    </div>
                    {editMode ? (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Move-in Date</label>
                          <input type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => { setEditMode(false); setShowVacateConfirm(false); setDrawerError(null); }} disabled={saving || vacating} className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">Cancel</button>
                          <button onClick={() => void handleSaveTenant()} disabled={saving || vacating || !form.name.trim()} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                            {saving ? "Saving…" : "Save Changes"}
                          </button>
                        </div>
                        {!showVacateConfirm ? (
                          <button
                            type="button"
                            onClick={() => setShowVacateConfirm(true)}
                            disabled={saving || vacating}
                            className="w-full mt-1 px-4 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Home size={15} /> Mark Bed as Vacant
                          </button>
                        ) : (
                          <div className="mt-1 p-3 bg-red-50 border border-red-100 rounded-xl space-y-3">
                            <p className="text-sm text-red-800">Remove <span className="font-semibold">{drawerBed.student.name}</span> from this bed? Billing will reset to Vacant.</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setShowVacateConfirm(false)} disabled={vacating} className="flex-1 px-3 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-semibold">Keep Tenant</button>
                              <button type="button" onClick={() => void handleVacate()} disabled={vacating} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                                {vacating ? "Vacating…" : "Confirm Vacant"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                        <InfoRow label="Full Name" value={drawerBed.student.name} icon={User} />
                        <InfoRow label="Phone" value={drawerBed.student.phone} icon={Phone} />
                        <InfoRow label="Email" value={drawerBed.student.email} icon={Mail} />
                        <InfoRow label="Move-in Date" value={drawerBed.student.moveInDate} icon={Calendar} />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Lease Details</h3>
                      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                        <InfoRow label="Monthly Rent" value={fmt(drawerBed.rentAmount)} icon={DollarSign} />
                        <InfoRow label="Block" value={drawerBed.blockCode} icon={Building2} />
                        <InfoRow label="Room" value={String(drawerBed.roomNumber)} icon={Hash} />
                        <InfoRow label="Bed" value={drawerBed.bedLetter} icon={Hash} />
                      </div>
                    </div>
                    {br && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Billing</h3>
                        <div className={`rounded-xl p-4 space-y-2.5 border ${s.border} ${s.bg}`}>
                          <InfoRow label="Balance" value={fmt(br.total_balance)} />
                          <InfoRow label="Target Month" value={br.target_month} />
                          <InfoRow label="Days Past Due" value={br.days_past_due > 0 ? `${br.days_past_due} days` : "On time"} />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <Home size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">This bed space is currently unoccupied.</p>
                    <button onClick={() => { setDrawerBed(null); setShowOnboard(true); setForm((f) => ({ ...f, bedId: drawerBed.id })); }}
                      className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
                      Assign Tenant
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOnboard(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
              <div><p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Tenant Onboarding</p><h2 className="text-white font-bold text-lg">Assign New Tenant</h2></div>
              <button onClick={() => setShowOnboard(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            {onboardSuccess ? (
              <div className="p-10 text-center"><CheckCircle size={52} className="text-emerald-500 mx-auto mb-4" /><p className="font-bold text-slate-900">Tenant onboarded</p><p className="text-sm text-slate-500 mt-2">An invite was sent so they can create a password and open their portal.</p></div>
            ) : (
              <div className="p-6 space-y-4">
                {onboardError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{onboardError}</p>}
                <Field label="Full Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Chanda Mutale" />
                <Field label="Phone Number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="260977 000 000" />
                <Field label="Email Address *" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign Bed Space *</label>
                  <select value={form.bedId} onChange={(e) => setForm((f) => ({ ...f, bedId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]">
                    <option value="">Select available bed space…</option>
                    {vacantBeds.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}
                  </select>
                </div>
                <Field label="Move-in Date" value={form.moveInDate} onChange={(v) => setForm((f) => ({ ...f, moveInDate: v }))} type="date" />
                <button onClick={handleOnboard} disabled={!form.name || !form.bedId || !form.email}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-all duration-150 hover:shadow-md">
                  Onboard Tenant
                </button>
                <p className="text-xs text-slate-500 text-center">We’ll email them a link to create a password and open their student portal.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pay View ────────────────────────────────────────────────────────────────

function PayView({ payments, beds, verifyPay, rejectPay }: {
  payments: Payment[];
  beds: BedSpace[];
  verifyPay: (id: string) => Promise<void>;
  rejectPay: (id: string, reason: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<PayStatus | "all">("pending");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewReceipt, setViewReceipt] = useState<Payment | null>(null);

  const filtered = payments.filter((p) => filter === "all" || p.status === filter);
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const verifiedCount = payments.filter((p) => p.status === "verified").length;
  const totalVerified = payments.filter((p) => p.status === "verified").reduce((s, p) => s + p.amount, 0);
  const totalExpected = beds.filter((b) => b.status === "occupied").reduce((s, b) => s + b.rentAmount, 0);

  async function verify(id: string) { await verifyPay(id); }
  async function reject() {
    if (!rejectModal) return;
    await rejectPay(rejectModal.id, rejectReason);
    setRejectModal(null); setRejectReason("");
  }

  const blockProgress = BLOCKS.map((code) => {
    const blockBeds = beds.filter((b) => b.blockCode === code && b.status === "occupied");
    const expected = blockBeds.reduce((s, b) => s + b.rentAmount, 0);
    const names = blockBeds.map((b) => b.student?.name).filter(Boolean);
    const verified = payments.filter((p) => p.status === "verified" && names.includes(p.studentName)).reduce((s, p) => s + p.amount, 0);
    return { code, expected, verified, pct: expected > 0 ? Math.min((verified / expected) * 100, 100) : 0 };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Expected Revenue" value={fmt(totalExpected)} sub="all occupied beds" icon={DollarSign} />
        <KpiCard label="Verified" value={fmt(totalVerified)} accent="text-emerald-700" sub={`${verifiedCount} payments`} icon={CheckCircle} />
        <KpiCard label="Pending Review" value={pendingCount} accent="text-amber-600" sub="awaiting verification" icon={RefreshCw} />
        <KpiCard label="Collection Rate" value={`${Math.round((totalVerified / totalExpected) * 100)}%`} accent="text-blue-700" icon={BarChart3} />
      </div>

      <SectionCard title={`Revenue Progress — ${formatMonthYear(getCurrentBillingMonth())}`}>
        <div className="p-5 space-y-3">
          {blockProgress.map(({ code, expected, verified, pct }) => (
            <div key={code} className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-slate-600 w-10">{code}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5"><div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
              <span className="text-xs font-mono text-slate-500 w-36 text-right shrink-0">{fmt(verified)} / {fmt(expected)}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Payment Queue" action={
        <div className="flex gap-1.5">
          {(["pending","all","verified","rejected"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all duration-150 ${filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s === "all" ? "All" : s}{s === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Student</th>
                <th className="text-left px-4 py-3 font-semibold">Bed Space</th>
                <th className="text-left px-3 py-3 font-semibold">Method</th>
                <th className="text-left px-3 py-3 font-semibold">Ref</th>
                <th className="text-right px-3 py-3 font-semibold">Amount</th>
                <th className="text-left px-3 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors duration-150 group">
                  <td className="px-4 py-3.5 font-semibold text-slate-900 max-w-[140px]"><span className="truncate block">{p.studentName}</span></td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{p.bedSpaceId}</td>
                  <td className="px-3 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-bold ${p.method === "Airtel" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{p.method}</span></td>
                  <td className="px-3 py-3.5 font-mono text-xs text-slate-500">{p.transactionRef}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-slate-900">{fmt(p.amount)}</td>
                  <td className="px-3 py-3.5 text-xs text-slate-500">{p.submittedAt}</td>
                  <td className="px-4 py-3.5"><Badge label={p.status.charAt(0).toUpperCase() + p.status.slice(1)} className={payStatusStyle[p.status]} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => setViewReceipt(p)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all" title="View"><Eye size={14} /></button>
                      {p.status === "pending" && (
                        <>
                          <button onClick={() => verify(p.id)} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-all" title="Verify"><Check size={14} /></button>
                          <button onClick={() => setRejectModal({ id: p.id })} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all" title="Reject"><X size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">{filter === "pending" ? "No payments awaiting verification." : "No payments in this category."}</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {viewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewReceipt(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Payment Receipt</h3><button onClick={() => setViewReceipt(null)}><X size={18} className="text-slate-500" /></button></div>
            <div className="bg-slate-100 rounded-xl h-40 flex items-center justify-center"><div className="text-center text-slate-400"><CreditCard size={28} className="mx-auto mb-2 opacity-50" /><p className="text-xs font-mono">{viewReceipt.transactionRef}</p></div></div>
            <div className="space-y-1">
              <InfoRow label="Student" value={viewReceipt.studentName} />
              <InfoRow label="Bed Space" value={viewReceipt.bedSpaceId} mono />
              <InfoRow label="Amount" value={fmt(viewReceipt.amount)} />
              <InfoRow label="Method" value={viewReceipt.method} />
              <InfoRow label="Submitted" value={viewReceipt.submittedAt} />
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-slate-900">Reject Payment</h3>
            <p className="text-sm text-slate-500">Provide a reason — the student will be notified to resubmit.</p>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Reference code does not match our records…" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={reject} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Utilities View ───────────────────────────────────────────────────────────

function UtilitiesView({ utilities, beds, saveUtility, toggleSettled }: {
  utilities: UtilityBlock[];
  beds: BedSpace[];
  saveUtility: (blockCode: BlockCode, month: string, totalCost: number) => Promise<unknown>;
  toggleSettled: (blockCode: BlockCode, month: string, name: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ blockCode: "BBH" as BlockCode, totalCost: "", month: formatMonthYear(getCurrentBillingMonth()) });
  const [submitted, setSubmitted] = useState(false);

  function calcEntry() {
    const cost = parseFloat(form.totalCost) || 0;
    const n = beds.filter((b) => b.blockCode === form.blockCode && b.status === "occupied").length;
    const ownerContrib = Math.min(70 * n, cost);
    const excess = Math.max(0, cost - ownerContrib);
    return { cost, n, ownerContrib, excess, studentShare: n > 0 ? excess / n : 0 };
  }

  const preview = calcEntry();

  async function handleSubmit() {
    if (!form.totalCost) return;
    await saveUtility(form.blockCode, form.month, parseFloat(form.totalCost) || 0);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setForm((f) => ({ ...f, totalCost: "" })); }, 1800);
  }

  async function handleToggleSettled(blockCode: BlockCode, name: string) {
    const entry = utilities.find((u) => u.blockCode === blockCode);
    if (!entry) return;
    await toggleSettled(blockCode, entry.month, name);
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Log Prepaid Meter Entry">
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Block</label>
              <select value={form.blockCode} onChange={(e) => setForm((f) => ({ ...f, blockCode: e.target.value as BlockCode }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]">
                {BLOCKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <Field label="Billing Month" value={form.month} onChange={(v) => setForm((f) => ({ ...f, month: v }))} />
            <Field label="Total Meter Cost (K)" value={form.totalCost} onChange={(v) => setForm((f) => ({ ...f, totalCost: v }))} placeholder="e.g. 1500" type="number" />
          </div>
          {parseFloat(form.totalCost) > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border border-slate-100">
              {[{ l: "Total Bill", v: fmt(preview.cost), c: "text-slate-900" }, { l: "Owner Covers", v: fmt(preview.ownerContrib), c: "text-emerald-700", sub: `K70 × ${preview.n}` }, { l: "Student Excess", v: fmt(preview.excess), c: "text-amber-600" }, { l: "Per Student", v: fmt(Math.round(preview.studentShare)), c: "text-slate-900" }].map(({ l, v, c, sub }) => (
                <div key={l} className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{l}</p>
                  <p className={`text-xl font-bold mt-1 ${c}`}>{v}</p>
                  {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
                </div>
              ))}
            </div>
          )}
          <button onClick={handleSubmit} disabled={!form.totalCost} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-all duration-150 hover:shadow-md min-h-[44px]">
            <Zap size={15} /> {submitted ? "Saved!" : "Log Entry & Calculate Split"}
          </button>
        </div>
      </SectionCard>

      {utilities.map((u) => {
        const blockBeds = beds.filter((b) => b.blockCode === u.blockCode && b.status === "occupied");
        const studentShare = u.activeStudents > 0 ? Math.round(u.excess / u.activeStudents) : 0;
        const settledCount = blockBeds.filter((b) => b.student && u.studentsSettled.includes(b.student.name)).length;
        return (
          <div key={`${u.blockCode}-${u.month}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-slate-900">{u.blockCode}</span>
                <span className="text-xs text-slate-500">{u.month}</span>
                <Badge label={`${settledCount}/${blockBeds.length} settled`} className={settledCount === blockBeds.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"} />
              </div>
              <span className="text-xs font-mono text-slate-500">{fmt(u.totalCost)} total · {fmt(studentShare)}/student</span>
            </div>
            <div className="p-4 divide-y divide-slate-100">
              {blockBeds.map((b) => {
                if (!b.student) return null;
                const settled = u.studentsSettled.includes(b.student.name);
                return (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors duration-150">
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{b.student.name}</p><p className="text-xs font-mono text-slate-400">{b.identifier}</p></div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-slate-900">{fmt(studentShare)}</span>
                      <button onClick={() => void handleToggleSettled(u.blockCode, b.student!.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${settled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {settled ? "Settled ✓" : "Mark Settled"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Student Portal ───────────────────────────────────────────────────────────

function StudentPortal({ beds, payments, issues, billingMap, currentUser, onLogout, submitPay, submitMaint, updateStudent, uploadStudentProfilePhoto, uploadStudentMedia }: {
  beds: BedSpace[];
  payments: Payment[];
  issues: MaintenanceIssue[];
  billingMap: Map<string, BillingRecord>;
  currentUser?: { id?: string; name?: string; email?: string; phone?: string; nrc?: string; moveInDate?: string } | null;
  onLogout: () => void;
  submitPay: (input: { studentName: string; bedSpaceId: string; amount: number; method: "Airtel" | "MTN"; transactionRef: string; proofUrl?: string }) => Promise<unknown>;
  submitMaint: (input: { bedSpaceId: string; studentName: string; category: IssueCategory; description: string; imageUrl?: string }) => Promise<unknown>;
  updateStudent: (input: { tenantId: string; name: string; phone: string; email: string; nrc?: string; moveInDate: string; sendLoginLink?: boolean }) => Promise<unknown>;
  uploadStudentProfilePhoto: (tenantId: string, file: File) => Promise<string>;
  uploadStudentMedia: (tenantId: string, file: File, category: "receipts" | "maintenance") => Promise<string>;
}) {
  const [view, setView] = useState<StudentView>("home");
  const myBed = useMemo(() => {
    const email = currentUser?.email?.trim().toLowerCase();
    const name = currentUser?.name?.trim().toLowerCase();
    return beds.find((bed) => {
      if (!bed.student) return false;
      const matchEmail = email && bed.student.email?.trim().toLowerCase() === email;
      const matchName = name && bed.student.name.trim().toLowerCase() === name;
      const matchId = currentUser?.id && bed.student.id === currentUser.id;
      return Boolean(matchEmail || matchName || matchId);
    });
  }, [beds, currentUser]);
  const student = myBed?.student ?? {
    id: currentUser?.id ?? "guest-student",
    name: currentUser?.name ?? "Student",
    phone: currentUser?.phone ?? "-",
    nrc: currentUser?.nrc ?? "-",
    email: currentUser?.email ?? "",
    moveInDate: currentUser?.moveInDate ?? new Date().toISOString().slice(0, 10),
  };
  const billingRec = myBed ? billingMap.get(myBed.identifier) : undefined;
  const myPayments = myBed ? payments.filter((p) => p.bedSpaceId === myBed.id || p.studentName === student.name) : [];

  const [payForm, setPayForm] = useState({ method: "Airtel" as "Airtel" | "MTN", ref: "", amount: String(myBed?.rentAmount ?? 1200) });
  const [paySubmitted, setPaySubmitted] = useState(false);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payFileName, setPayFileName] = useState("");
  const [mainForm, setMainForm] = useState({ category: "Plumbing" as IssueCategory, description: "" });
  const [mainSubmitted, setMainSubmitted] = useState(false);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [mainImageUrl, setMainImageUrl] = useState<string | undefined>(undefined);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const payFileRef = useRef<HTMLInputElement>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const y = el.scrollTop;
      if (y > lastScrollY.current + 8) { setHeaderVisible(false); }
      else if (y < lastScrollY.current - 8 || y < 60) { setHeaderVisible(true); }
      lastScrollY.current = y;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setMainFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => { const url = ev.target?.result as string; setMainImagePreview(url); setMainImageUrl(url); };
    reader.readAsDataURL(file);
  }

  async function submitPayment() {
    if (!payForm.ref || !myBed || !student.name) return;
    const proofUrl = payFile && myBed ? await uploadStudentMedia(student.id, payFile, "receipts") : undefined;
    await submitPay({
      studentName: student.name,
      bedSpaceId: myBed.id,
      amount: parseFloat(payForm.amount) || 1200,
      method: payForm.method,
      transactionRef: payForm.ref,
      proofUrl,
    });
    setPaySubmitted(true);
    setTimeout(() => { setPaySubmitted(false); setPayForm({ method: "Airtel", ref: "", amount: String(myBed.rentAmount) }); setPayFile(null); setPayFileName(""); }, 2000);
  }

  async function submitMaintenance() {
    if (!mainForm.description || !myBed || !student.name) return;
    const imageUrl = mainFile && myBed ? await uploadStudentMedia(student.id, mainFile, "maintenance") : mainImageUrl;
    await submitMaint({
      bedSpaceId: myBed.id,
      studentName: student.name,
      category: mainForm.category,
      description: mainForm.description,
      imageUrl,
    });
    setMainSubmitted(true);
    setTimeout(() => { setMainSubmitted(false); setMainForm({ category: "Plumbing", description: "" }); setMainImagePreview(null); setMainImageUrl(undefined); setMainFile(null); }, 2000);
  }

  const bStatus = billingRec?.billing_status ?? "Open Window";
  const bStyle = billingStatusStyle[bStatus];
  const pendingPayments = myPayments.filter((p) => p.status === "pending");

  const navTabs: { id: StudentView; label: string; icon: React.ElementType }[] = [
    { id: "home",     label: "Home",     icon: Home },
    { id: "profile",  label: "Profile",  icon: UserCircle },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className={`bg-slate-900 z-30 transition-transform duration-300 ease-in-out shrink-0 ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-5">
          <div className="flex items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center"><Building2 size={13} className="text-white" /></div>
              <span className="text-emerald-400 text-xs font-mono font-bold tracking-wider">ROOM REVENUE</span>
            </div>
          </div>
          {view === "home" && (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Active Tenant Portal</p>
                <h1 className="text-xl font-bold text-white mt-1">{student?.name ?? "Student"}</h1>
                <p className="text-slate-400 text-sm font-mono">{myBed?.identifier} · {myBed?.blockCode} Block</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${bStyle.badge} shrink-0`}>
                <span className={`w-2 h-2 rounded-full ${bStyle.dot}`} />{bStatus === "OVERDUE / UNPAID" ? "Overdue" : bStatus}
              </span>
            </div>
          )}
          {view === "profile" && <h1 className="text-xl font-bold text-white">My Profile</h1>}
          {view === "settings" && <h1 className="text-xl font-bold text-white">Settings</h1>}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-5 pb-28">
        {view === "home" && (
          <div className="space-y-5">
            {!myBed ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-bold text-base mb-1">No bed assignment found</p>
                <p>This account is not linked to a residential bedspace yet. Please contact the landlord to assign your room and billing profile.</p>
              </div>
            ) : (
              <>
                <div className={`rounded-xl border-2 ${bStyle.border} ${bStyle.bg} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${bStyle.text} mb-1`}>Billing — {formatBillingPeriodLabel(billingRec?.target_month)}</p>
                      <p className="text-lg font-bold text-slate-900">{billingRec?.total_balance === 0 ? "Account fully settled" : `Balance: ${fmt(billingRec?.total_balance ?? 0)}`}</p>
                      <p className="text-sm text-slate-500 mt-0.5">Monthly rent: {fmt(myBed.rentAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Bed Space</p>
                    <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{myBed.identifier}</p>
                    <p className="text-xs text-slate-400">{myBed.blockCode} Block · Room {myBed.roomNumber}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly Rent</p>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(myBed.rentAmount)}</p>
                    <p className="text-xs text-slate-400">Due {formatBillingPeriodLabel(billingRec?.target_month)}</p>
                  </div>
                </div>

                {pendingPayments.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{pendingPayments.length} payment{pendingPayments.length > 1 ? "s" : ""} awaiting verification</p>
                      <p className="text-xs text-amber-700 mt-0.5">Your landlord will verify your submission shortly.</p>
                    </div>
                  </div>
                )}

                <SectionCard title="Payment History">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[360px]">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wide">
                        <tr><th className="text-left px-5 py-3 font-semibold">Date</th><th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Method</th><th className="text-right px-5 py-3 font-semibold">Amount</th><th className="text-left px-5 py-3 font-semibold">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myPayments.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No payment records yet.</td></tr>
                          : myPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-slate-700 text-xs">{p.submittedAt}</td>
                              <td className="px-5 py-3 font-bold text-xs hidden sm:table-cell">{p.method}</td>
                              <td className="px-5 py-3 text-right font-bold text-slate-900">{fmt(p.amount)}</td>
                              <td className="px-5 py-3"><Badge label={p.status.charAt(0).toUpperCase() + p.status.slice(1)} className={payStatusStyle[p.status]} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <SectionCard title="Submit Payment Proof">
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
                        <div className="flex gap-2">
                          {(["Airtel", "MTN"] as const).map((m) => (
                            <button key={m} onClick={() => setPayForm((f) => ({ ...f, method: m }))}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 min-h-[44px] hover:shadow-sm ${payForm.method === m ? (m === "Airtel" ? "bg-red-600 text-white shadow-sm" : "bg-yellow-400 text-yellow-900 shadow-sm") : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field label="Amount (K)" value={payForm.amount} onChange={(v) => setPayForm((f) => ({ ...f, amount: v }))} type="number" />
                    </div>
                    <Field label="Transaction Reference *" value={payForm.ref} onChange={(v) => setPayForm((f) => ({ ...f, ref: v }))} placeholder="TXN-AIRTL-0000" />
                    <div onClick={() => payFileRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-all duration-150 group">
                      <Upload size={20} className="mx-auto text-slate-400 mb-1 group-hover:text-emerald-500 transition-colors" />
                      <p className="text-xs text-slate-500 group-hover:text-emerald-600">{payFileName || "Click to upload receipt (JPEG/PNG)"}</p>
                      <input ref={payFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPayFile(file); setPayFileName(file.name); } }} />
                    </div>
                    <button onClick={submitPayment} disabled={!payForm.ref}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-all duration-150 hover:shadow-md min-h-[48px]">
                      {paySubmitted ? "Submitted — Pending Review ✓" : "Submit Payment Proof"}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Report Maintenance Issue">
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["Plumbing", "Electrical", "Structural", "Appliance"] as IssueCategory[]).map((c) => (
                        <button key={c} onClick={() => setMainForm((f) => ({ ...f, category: c }))}
                          className={`py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 min-h-[40px] hover:shadow-sm ${mainForm.category === c ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          {categoryIcon[c]} {c}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
                      <textarea rows={3} value={mainForm.description} onChange={(e) => setMainForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the issue — location, severity, when it started…" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all" />
                    </div>
                    {mainImagePreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 h-36">
                        <img src={mainImagePreview} alt="Damage preview" className="w-full h-full object-cover" />
                        <button onClick={() => { setMainImagePreview(null); setMainImageUrl(undefined); }} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"><X size={13} /></button>
                      </div>
                    ) : (
                      <div onClick={() => mainFileRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-all duration-150 group">
                        <Camera size={18} className="mx-auto text-slate-400 mb-1 group-hover:text-emerald-500 transition-colors" />
                        <p className="text-xs text-slate-500 group-hover:text-emerald-600">Upload damage photo</p>
                      </div>
                    )}
                    <input ref={mainFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <button onClick={submitMaintenance} disabled={!mainForm.description}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm tracking-wide transition-all duration-150 hover:shadow-md min-h-[52px] shadow-sm">
                      {mainSubmitted ? "✓ Issue Reported Successfully" : "Submit Maintenance Report"}
                    </button>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        )}

        {view === "profile" && <StudentProfileView bed={myBed} billingRecord={billingRec} onSave={updateStudent} onPhotoUpload={uploadStudentProfilePhoto} />}
        {view === "settings" && <StudentSettingsView onLogout={onLogout} email={student.email} />}
      </div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 pb-safe z-30 shrink-0">
        <div className="max-w-2xl mx-auto flex">
          {navTabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-150 ${view === id ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}>
              <Icon size={20} className="transition-transform duration-150" style={{ transform: view === id ? "scale(1.1)" : "scale(1)" }} />
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Landlord Dashboard ───────────────────────────────────────────────────────

const MAIN_NAV: { id: LandlordView; label: string; icon: React.ElementType }[] = [
  { id: "portal",    label: "Portal",    icon: Home },
  { id: "revenue",   label: "Revenue",   icon: TrendingUp },
  { id: "pay",       label: "Pay",       icon: CreditCard },
  { id: "utilities", label: "Utilities", icon: Zap },
  { id: "students",  label: "Students",  icon: Users },
  { id: "reports",   label: "Reports",   icon: FileText },
];
const BOTTOM_NAV: { id: LandlordView; label: string; icon: React.ElementType }[] = [
  { id: "profile",  label: "Profile",  icon: UserCircle },
  { id: "settings", label: "Settings", icon: Settings },
];

function LandlordDashboard({ beds, billingRecords, billingMap, payments, issues, utilities, students, landlord, dataError, onLandlordProfileSave, onLogout, onboard, updateStudent, updateStudentAccount, vacateBed, evictStudent, applyRentIncrement, verifyPay, rejectPay, saveUtility, toggleSettled, updateIssueStatus, runOccupancyAudit, reconcileOccupancy }: {
  beds: BedSpace[];
  billingRecords: BillingRecord[];
  billingMap: Map<string, BillingRecord>;
  payments: Payment[];
  issues: MaintenanceIssue[];
  utilities: UtilityBlock[];
  students: StudentAccountRow[];
  landlord: any;
  dataError?: string | null;
  onLandlordProfileSave: (input: any) => Promise<any>;
  onLogout: () => void;
  onboard: (input: OnboardStudentInput) => Promise<unknown>;
  updateStudent: (input: { tenantId: string; name: string; phone: string; email: string; moveInDate: string }) => Promise<unknown>;
  updateStudentAccount: (input: UpdateStudentAccountInput) => Promise<unknown>;
  vacateBed: (bedId: string) => Promise<void>;
  evictStudent: EvictStudentFn;
  applyRentIncrement: ApplyRentIncrementFn;
  verifyPay: (id: string) => Promise<void>;
  rejectPay: (id: string, reason: string) => Promise<void>;
  saveUtility: (blockCode: BlockCode, month: string, totalCost: number) => Promise<unknown>;
  toggleSettled: (blockCode: BlockCode, month: string, name: string) => Promise<void>;
  updateIssueStatus: (id: string, status: IssueStatus, resolutionNote?: string) => Promise<void>;
  runOccupancyAudit: () => Promise<OccupancyIssue[]>;
  reconcileOccupancy: () => Promise<void>;
}) {
  const now = useLiveDateTime();
  const [view, setView] = useState<LandlordView>("revenue");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [billingMonth, setBillingMonth] = useState<BillingMonth>(() => getCurrentBillingMonth());
  const monthBillingRecords = billingRecordsForMonth(billingRecords, billingMonth);
  const monthBillingMap = new Map(monthBillingRecords.map((record) => [record.billing_id, record]));

  const pendingPay = payments.filter((p) => p.status === "pending").length;
  const openIssues = issues.filter((i) => i.status === "open").length;
  const overdueCount = monthBillingRecords.filter((r) => r.billing_status === "OVERDUE / UNPAID").length;

  const canManage = isLandlord(landlord);

  const viewTitles: Record<LandlordView, string> = {
    portal: "Occupancy Portal", revenue: "Revenue Tracker", pay: "Payments & Verification",
    utilities: "Utilities Subsystem", students: "Students", reports: "Reports",
    profile: "My Profile", settings: "Settings",
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-250 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg"><Building2 size={17} className="text-white" /></div>
            <div><p className="text-white font-bold text-sm leading-tight">Room Revenue</p><p className="text-emerald-400 text-xs font-mono">Tracker · {getCurrentYear()}</p></div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Navigation</p>
          {MAIN_NAV.map(({ id, label, icon: Icon }) => {
            const badge = id === "pay" ? pendingPay : id === "reports" ? openIssues : id === "revenue" ? overdueCount : 0;
            return (
              <button key={id} onClick={() => { setView(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 min-h-[44px] group ${view === id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <Icon size={16} className="shrink-0 transition-transform duration-150 group-hover:scale-110" />
                <span className="flex-1 text-left">{label}</span>
                {badge > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${view === id ? "bg-white/25 text-white" : id === "revenue" ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900"}`}>{badge}</span>}
              </button>
            );
          })}

          <div className="pt-4 pb-1"><p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Account</p></div>
          {BOTTOM_NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setView(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 min-h-[44px] group ${view === id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <Icon size={16} className="shrink-0" /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-800 pt-3">
          <UserMenu name={landlord?.name ?? "Property Owner"} role={landlord?.role ?? "Property Owner"} onLogout={onLogout} dark
            onProfile={() => { setView("profile"); setSidebarOpen(false); }}
            onSettings={() => { setView("settings"); setSidebarOpen(false); }} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-4 flex items-center gap-4 shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"><Menu size={20} /></button>
          <h1 className="text-base font-bold text-slate-900 flex-1">{viewTitles[view]}</h1>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">{formatHeaderDateTime(now)}</span>
            {overdueCount > 0 && <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold"><AlertTriangle size={12} />{overdueCount} overdue</span>}
            {pendingPay > 0 && <span className="hidden sm:flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold"><AlertTriangle size={12} />{pendingPay} pending</span>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {dataError && (
            <StatusBanner tone="error">
              Could not refresh tracker data from the server. {dataError}
            </StatusBanner>
          )}
          {view === "portal"    && <PortalView beds={beds} billingMap={monthBillingMap} billingMonth={billingMonth} onBillingMonthChange={setBillingMonth} onboard={onboard} updateStudent={updateStudent} vacateBed={vacateBed} />}
          {view === "revenue"   && <RevenueView billingRecords={billingRecords} billingMonth={billingMonth} onBillingMonthChange={setBillingMonth} />}
          {view === "pay"       && <PayView payments={payments} beds={beds} verifyPay={verifyPay} rejectPay={rejectPay} />}
          {view === "utilities" && <UtilitiesView utilities={utilities} beds={beds} saveUtility={saveUtility} toggleSettled={toggleSettled} />}
          {view === "students"  && <StudentsView students={students} beds={beds} canManage={canManage} onboardStudent={async (input) => { assertLandlord(landlord, "onboard a student"); return onboard(input); }} updateStudentAccount={updateStudentAccount} evictStudent={evictStudent} applyRentIncrement={applyRentIncrement} runOccupancyAudit={runOccupancyAudit} reconcileOccupancy={reconcileOccupancy} />}
          {view === "reports"   && <ReportsView issues={issues} payments={payments} beds={beds} billingRecords={billingRecords} utilities={utilities} canExport={canManage} updateIssueStatus={updateIssueStatus} />}
          {view === "profile"   && <LandlordProfile beds={beds} billingRecords={billingRecords} landlord={landlord} onSave={onLandlordProfileSave} />}
          {view === "settings"  && <LandlordSettings landlord={landlord} onProfileSave={onLandlordProfileSave} />}
        </main>
      </div>
    </div>
  );
}

// ─── Student Email Confirmation ───────────────────────────────────────────────

function StudentEmailConfirmation({ onBackToLogin, onLoginSuccess, purpose = "confirmation" }: {
  onBackToLogin: () => void;
  onLoginSuccess?: (user: any) => void;
  purpose?: "confirmation" | "reset";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setError("Account verification is unavailable because Supabase is not configured.");
      return;
    }

    const client = sb;
    let active = true;

    async function establishSession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const tokenHash = params.get("token_hash") ?? hashParams.get("token_hash");
      const otpType = (params.get("type") ?? hashParams.get("type") ?? (purpose === "reset" ? "recovery" : "invite")) as
        | "invite"
        | "recovery"
        | "email"
        | "magiclink"
        | "signup";

      if (tokenHash) {
        const { error: otpError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
        if (otpError) {
          if (active) setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
          return;
        }
      } else {
        // GoTrue Invite/Recovery ConfirmationURL lands with hash tokens.
        // The app client uses PKCE, which does not consume those fragments.
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            if (active) setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
            return;
          }
          const keepAuth = purpose === "reset" ? "student-reset" : "student-confirm";
          window.history.replaceState({}, "", `${window.location.pathname}?auth=${keepAuth}`);
        }
      }

      const { data, error: userError } = await client.auth.getUser();
      if (!active) return;
      if (userError || !data.user?.email) {
        setError("This invite link is invalid or has expired. Ask your landlord to send a new one.");
        return;
      }
      setEmail(data.user.email);
    }

    void establishSession();
    return () => { active = false; };
  }, [purpose]);

  async function setNewPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Your password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    const { error: updateError } = await sb.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const linked = await linkTenantToAuthUser(email);
    if (!linked) {
      setError("Password saved, but no tenant profile is linked to this email. Ask your landlord to onboard you with this exact email, then sign in.");
      setComplete(true);
      return;
    }

    window.history.replaceState({}, "", window.location.pathname);
    if (onLoginSuccess) {
      onLoginSuccess(linked);
      return;
    }

    setComplete(true);
  }

  async function continueToLogin() {
    await signOutStudent();
    window.history.replaceState({}, "", window.location.pathname);
    onBackToLogin();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{purpose === "reset" ? "Reset your password" : "Create your password"}</h1>
          <p className="text-slate-300 text-sm mt-2">{purpose === "reset" ? "Choose a new password for your student account." : "Your email has been confirmed. Choose a password to finish setting up your account."}</p>
        </div>

        {error && <p className="bg-red-500/20 border border-red-500/30 text-red-100 rounded-xl px-4 py-3 text-sm mb-4">{error}</p>}

        {complete ? (
          <div className="space-y-5 text-center">
            <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-xl p-4 text-sm">
              {purpose === "reset" ? "Password reset" : "Password created"} for <strong>{email}</strong>. Please sign in with your confirmed email and new password.
            </div>
            <button onClick={() => void continueToLogin()} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition-colors">Go to student login</button>
          </div>
        ) : (
          <form onSubmit={setNewPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmed email</label>
              <input value={email} readOnly placeholder="Confirming your email…" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300 placeholder-slate-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} autoComplete="new-password" required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={saving || !email} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{saving ? "Saving password…" : "Create password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

type View = "landing" | "student-login" | "student-confirm" | "student-reset" | "landlord-login" | "student-dashboard" | "landlord-dashboard";

function AppRoutes() {
  const [view, setView] = useState<View>(() =>
    (() => {
      const auth = new URLSearchParams(window.location.search).get("auth");
      return auth === "student-reset" ? "student-reset" : ["student", "student-confirm"].includes(auth ?? "") ? "student-confirm" : "landing";
    })(),
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const tracker = useTrackerData();

  function handleLogout() { 
    void signOutStudent();
    window.history.replaceState({}, "", window.location.pathname);
    setView("landing"); 
    setCurrentUser(null);
  }

  function handleStudentLoginSuccess(user: any) {
    setCurrentUser(user);
    setView("student-dashboard");
    void tracker.refresh();
  }

  function handleLandlordLoginSuccess(user: any) {
    setCurrentUser(user);
    setView("landlord-dashboard");
  }

  if (tracker.loading && view !== "landing" && view !== "student-login" && view !== "landlord-login" && view !== "student-confirm" && view !== "student-reset") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <RefreshCw size={28} className="text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading tracker data…</p>
        </div>
      </div>
    );
  }

  if (view === "landing") {
    return (
      <>
        {tracker.error && (
          <div className="fixed top-0 inset-x-0 z-[60] bg-red-50 border-b border-red-200 px-4 py-2 text-center text-xs text-red-800">
            Could not load tracker data from the server. {tracker.error}
          </div>
        )}
        {!tracker.configured && (
          <div className="fixed top-0 inset-x-0 z-[60] bg-slate-900 text-slate-300 px-4 py-2 text-center text-xs">
            Offline mode — add <code className="text-emerald-400">VITE_SUPABASE_URL</code> and <code className="text-emerald-400">VITE_SUPABASE_ANON_KEY</code> to connect Supabase.
          </div>
        )}
        <LandingPage 
          onStudentLogin={() => setView("student-login")}
          onLandlordLogin={() => setView("landlord-login")}
        />
      </>
    );
  }

  if (view === "student-login") {
    return <StudentLogin onBack={() => setView("landing")} onLoginSuccess={handleStudentLoginSuccess} />;
  }

  if (view === "student-confirm") {
    return <StudentEmailConfirmation onBackToLogin={() => setView("student-login")} onLoginSuccess={handleStudentLoginSuccess} />;
  }

  if (view === "student-reset") {
    return <StudentEmailConfirmation purpose="reset" onBackToLogin={() => setView("student-login")} onLoginSuccess={handleStudentLoginSuccess} />;
  }

  if (view === "landlord-login") {
    return <LandlordLogin onBack={() => setView("landing")} onLoginSuccess={handleLandlordLoginSuccess} />;
  }

  if (view === "student-dashboard") {
    return (
      <StudentPortal
        beds={tracker.beds}
        payments={tracker.payments}
        issues={tracker.issues}
        billingMap={tracker.billingMap}
        currentUser={currentUser}
        onLogout={handleLogout}
        submitPay={tracker.submitPay}
        submitMaint={tracker.submitMaint}
        updateStudent={tracker.updateStudent}
        uploadStudentProfilePhoto={tracker.uploadStudentProfilePhoto}
        uploadStudentMedia={tracker.uploadStudentMedia}
      />
    );
  }

  return (
    <LandlordDashboard
      beds={tracker.beds}
      billingRecords={tracker.billingRecords}
      billingMap={tracker.billingMap}
      payments={tracker.payments}
      issues={tracker.issues}
      utilities={tracker.utilities}
      students={tracker.students}
      landlord={currentUser}
      dataError={tracker.error}
      evictStudent={async (input) => {
        assertLandlord(currentUser, "remove a student");
        return tracker.evictStudent({ ...input, actor: currentUser?.email ?? null });
      }}
      applyRentIncrement={async (input) => {
        assertLandlord(currentUser, "change rent amounts");
        return tracker.applyRentIncrement({ ...input, actor: currentUser?.email ?? null });
      }}
      onLandlordProfileSave={async (input) => {
        if (!currentUser?.id) {
          const saved = { ...currentUser, ...input };
          setCurrentUser(saved);
          return saved;
        }
        const saved = await tracker.updateLandlordProfile(input);
        setCurrentUser((previous: any) => ({ ...previous, ...saved }));
        return saved;
      }}
      onLogout={handleLogout}
      onboard={tracker.onboard}
      updateStudent={tracker.updateStudent}
      updateStudentAccount={async (input) => {
        assertLandlord(currentUser, "edit a student");
        return tracker.updateStudentAccount(input);
      }}
      vacateBed={tracker.vacateBed}
      verifyPay={tracker.verifyPay}
      rejectPay={tracker.rejectPay}
      saveUtility={tracker.saveUtility}
      toggleSettled={tracker.toggleSettled}
      updateIssueStatus={tracker.updateIssue}
      runOccupancyAudit={tracker.runOccupancyAudit}
      reconcileOccupancy={tracker.reconcileOccupancy}
    />
  );
}


export default function App() {
  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
