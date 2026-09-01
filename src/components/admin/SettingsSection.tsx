import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { fetchPlatformSettings, savePlatformSettings, type PlatformSettings } from "../../lib/api/admin";
import { adminInput, adminLabel } from "./adminUi";

const CURRENCIES = ["ZMW", "USD", "EUR", "GBP", "ZAR"];

export function SettingsSection({ onSaved }: { onSaved?: (settings: PlatformSettings) => void }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPlatformSettings()
      .then((s) => { if (active) setSettings(s); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load settings"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await savePlatformSettings(settings);
      setSaved(true);
      onSaved?.(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw size={20} className="animate-spin mr-2" /> Loading settings…</div>;
  }
  if (!settings) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error ?? "Settings unavailable."}</div>;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Billing</h3>
          <p className="text-xs text-slate-400 mt-0.5">Defaults applied across all properties.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={adminLabel}>Billing cycle day</label>
            <input type="number" min={1} max={28} value={settings.billingCycleDay} onChange={(e) => update("billingCycleDay", Math.max(1, Math.min(28, Number(e.target.value) || 1)))} className={adminInput} />
            <p className="mt-1 text-xs text-slate-400">Day of month rent is due.</p>
          </div>
          <div>
            <label className={adminLabel}>Grace period (days)</label>
            <input type="number" min={0} max={30} value={settings.gracePeriodDays} onChange={(e) => update("gracePeriodDays", Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className={adminInput} />
            <p className="mt-1 text-xs text-slate-400">Days before a balance is overdue.</p>
          </div>
          <div>
            <label className={adminLabel}>Currency</label>
            <select value={settings.currency} onChange={(e) => update("currency", e.target.value)} className={adminInput}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Authentication</h3>
          <p className="text-xs text-slate-400 mt-0.5">Controls how tenants and staff sign in.</p>
        </div>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-700 dark:text-slate-300">Allow one-time-code (OTP) student login</span>
          <input type="checkbox" checked={settings.otpEnabled} onChange={(e) => update("otpEnabled", e.target.checked)} className="w-5 h-5 rounded accent-indigo-600" />
        </label>
        <div>
          <label className={adminLabel}>Session timeout (minutes)</label>
          <input type="number" min={5} max={1440} value={settings.sessionTimeoutMinutes} onChange={(e) => update("sessionTimeoutMinutes", Math.max(5, Math.min(1440, Number(e.target.value) || 60)))} className={`${adminInput} sm:w-48`} />
        </div>
      </div>

      {error && <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span></div>}
      {saved && <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm"><CheckCircle2 size={16} /> Settings saved.</div>}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
          {saving ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : "Save settings"}
        </button>
      </div>
    </div>
  );
}
