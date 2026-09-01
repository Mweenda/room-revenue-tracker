import { useState } from "react";
import { KeyRound, ShieldCheck, LogOut, CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { getSupabase } from "../../lib/supabase";
import { adminInput, adminLabel } from "./adminUi";

const PERMISSIONS: { capability: string; admin: boolean; landlord: boolean; student: boolean }[] = [
  { capability: "Onboard & manage landlords", admin: true, landlord: false, student: false },
  { capability: "Platform-wide settings", admin: true, landlord: false, student: false },
  { capability: "View all properties & tenants", admin: true, landlord: false, student: false },
  { capability: "Manage own blocks, beds & rent", admin: false, landlord: true, student: false },
  { capability: "Onboard & manage own students", admin: false, landlord: true, student: false },
  { capability: "Verify payments & maintenance", admin: false, landlord: true, student: false },
  { capability: "Submit payments & requests", admin: false, landlord: false, student: true },
  { capability: "View own billing & inbox", admin: false, landlord: false, student: true },
];

function Cell({ on }: { on: boolean }) {
  return on
    ? <span className="inline-flex w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center"><CheckCircle2 size={13} /></span>
    : <span className="text-slate-300 dark:text-slate-600">—</span>;
}

export function SecuritySection({ adminEmail }: { adminEmail: string }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const [revoking, setRevoking] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState<string | null>(null);

  const canChange = form.current && form.next.length >= 8 && form.next === form.confirm && !pwSaving;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canChange) return;
    setPwSaving(true);
    setPwError(null);
    setPwSaved(false);
    const sb = getSupabase();
    if (!sb) { setPwError("Database not configured"); setPwSaving(false); return; }
    try {
      const { data: session } = await sb.auth.getSession();
      const email = session.session?.user.email;
      if (!email) throw new Error("Your session has expired. Sign in again.");
      const { error: reauth } = await sb.auth.signInWithPassword({ email, password: form.current });
      if (reauth) throw new Error("Current password is incorrect.");
      const { error } = await sb.auth.updateUser({ password: form.next });
      if (error) throw error;
      setPwSaved(true);
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPwSaving(false);
    }
  };

  const revokeOthers = async () => {
    setRevoking(true);
    setRevokeMsg(null);
    const sb = getSupabase();
    if (!sb) { setRevokeMsg("Database not configured"); setRevoking(false); return; }
    try {
      const { error } = await sb.auth.signOut({ scope: "others" });
      if (error) throw error;
      setRevokeMsg("All other sessions were signed out.");
    } catch (err) {
      setRevokeMsg(err instanceof Error ? err.message : "Could not revoke sessions");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center"><ShieldCheck size={20} className="text-indigo-600 dark:text-indigo-400" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Admin account</h3>
            <p className="text-xs text-slate-400">{adminEmail}</p>
          </div>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><KeyRound size={15} /> Change password</div>
          {pwError && <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{pwError}</span></div>}
          {pwSaved && <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm"><CheckCircle2 size={16} /> Password updated.</div>}
          <div>
            <label className={adminLabel}>Current password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" className={`${adminInput} pr-11`} />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={adminLabel}>New password</label>
              <input type={show ? "text" : "password"} value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} autoComplete="new-password" placeholder="At least 8 characters" className={adminInput} />
            </div>
            <div>
              <label className={adminLabel}>Confirm new password</label>
              <input type={show ? "text" : "password"} value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" className={adminInput} />
            </div>
          </div>
          {form.confirm && form.next !== form.confirm && <p className="text-xs text-red-600">Passwords don't match.</p>}
          <button type="submit" disabled={!canChange} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold">
            {pwSaving ? <><RefreshCw size={15} className="animate-spin" /> Updating…</> : "Update password"}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Active sessions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sign out everywhere except this device. Useful if you signed in on a shared machine.</p>
          </div>
          <button onClick={revokeOthers} disabled={revoking} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap">
            {revoking ? <><RefreshCw size={15} className="animate-spin" /> Revoking…</> : <><LogOut size={15} /> Revoke other sessions</>}
          </button>
        </div>
        {revokeMsg && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{revokeMsg}</p>}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Role permissions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-2.5 font-semibold">Capability</th>
                <th className="px-5 py-2.5 font-semibold text-center">Admin</th>
                <th className="px-5 py-2.5 font-semibold text-center">Landlord</th>
                <th className="px-5 py-2.5 font-semibold text-center">Student</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.capability} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                  <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{p.capability}</td>
                  <td className="px-5 py-2.5 text-center"><Cell on={p.admin} /></td>
                  <td className="px-5 py-2.5 text-center"><Cell on={p.landlord} /></td>
                  <td className="px-5 py-2.5 text-center"><Cell on={p.student} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
