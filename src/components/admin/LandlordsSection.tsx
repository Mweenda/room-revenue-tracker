import { useMemo, useRef, useState, useEffect } from "react";
import {
  Search, UserPlus, MoreVertical, Eye, Pencil, Ban, CheckCircle2, Trash2,
  Building2, BedDouble, Users, Wallet, Mail, Phone, MapPin, AlertTriangle, RefreshCw, EyeOff,
} from "lucide-react";
import {
  onboardLandlord, updateLandlord, setLandlordStatus, deleteLandlord,
  type AdminLandlord, type LandlordStatus,
} from "../../lib/api/admin";
import { money, landlordStatusStyle, OccupancyBar, Modal, adminInput, adminLabel } from "./adminUi";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const symbols = "!@#$%&*";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += chars[buf[i] % chars.length];
  out += symbols[buf[10] % symbols.length];
  out += String(buf[11] % 10);
  return out;
}

type StatusFilter = "all" | LandlordStatus;

export function LandlordsSection({ landlords, currency, onChanged }: {
  landlords: AdminLandlord[];
  currency: string;
  onChanged: () => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminLandlord | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminLandlord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminLandlord | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminLandlord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return landlords.filter((l) =>
      (statusFilter === "all" || l.status === statusFilter) &&
      (q === "" || l.fullName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q)),
    );
  }, [landlords, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…"
            className={`${adminInput} pl-9`} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={`${adminInput} sm:w-44`}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-sm font-semibold shadow-sm whitespace-nowrap">
          <UserPlus size={16} /> Onboard landlord
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            {landlords.length === 0 ? "No landlords yet. Onboard your first landlord to get started." : "No landlords match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 font-semibold">Landlord</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Occupancy</th>
                  <th className="px-5 py-3 font-semibold text-center hidden sm:table-cell">Students</th>
                  <th className="px-5 py-3 font-semibold text-right hidden lg:table-cell">Collected</th>
                  <th className="px-5 py-3 font-semibold text-center">Status</th>
                  <th className="px-5 py-3 font-semibold text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[14rem]">{l.fullName}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[14rem]">{l.email}</div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell"><OccupancyBar occupied={l.occupiedBeds} total={l.beds} /></td>
                    <td className="px-5 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 hidden sm:table-cell">{l.students}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100 hidden lg:table-cell">{money(l.collected, currency)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${landlordStatusStyle[l.status]}`}>
                        {l.status === "active" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right relative">
                      <RowMenu
                        open={menuFor === l.id}
                        onToggle={() => setMenuFor((cur) => (cur === l.id ? null : l.id))}
                        onClose={() => setMenuFor(null)}
                        landlord={l}
                        onView={() => { setDetailTarget(l); setMenuFor(null); }}
                        onEdit={() => { setEditTarget(l); setMenuFor(null); }}
                        onStatus={() => { setStatusTarget(l); setMenuFor(null); }}
                        onDelete={() => { setDeleteTarget(l); setMenuFor(null); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && <CreateEditModal currency={currency} onClose={() => setCreateOpen(false)} onDone={onChanged} />}
      {editTarget && <CreateEditModal landlord={editTarget} currency={currency} onClose={() => setEditTarget(null)} onDone={onChanged} />}
      {detailTarget && <DetailModal landlord={detailTarget} currency={currency} onClose={() => setDetailTarget(null)} onEdit={() => { setEditTarget(detailTarget); setDetailTarget(null); }} />}
      {statusTarget && <StatusModal landlord={statusTarget} onClose={() => setStatusTarget(null)} onDone={onChanged} />}
      {deleteTarget && <DeleteModal landlord={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={onChanged} />}
    </div>
  );
}

function RowMenu({ open, onToggle, onClose, landlord, onView, onEdit, onStatus, onDelete }: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  landlord: AdminLandlord;
  onView: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={onToggle} aria-label="Actions" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 text-sm">
          <button onClick={onView} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"><Eye size={15} /> View details</button>
          <button onClick={onEdit} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"><Pencil size={15} /> Edit</button>
          <button onClick={onStatus} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            {landlord.status === "active" ? <><Ban size={15} /> Suspend</> : <><CheckCircle2 size={15} /> Reactivate</>}
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button onClick={onDelete} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={15} /> Delete</button>
        </div>
      )}
    </div>
  );
}

function CreateEditModal({ landlord, currency, onClose, onDone }: {
  landlord?: AdminLandlord;
  currency: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const editing = Boolean(landlord);
  const [form, setForm] = useState({
    fullName: landlord?.fullName ?? "",
    email: landlord?.email ?? "",
    phone: landlord?.phone ?? "",
    address: landlord?.address ?? "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = form.fullName.trim() && (editing || (emailValid && form.password.length >= 8)) && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = editing
      ? await updateLandlord({ id: landlord!.id, fullName: form.fullName.trim(), phone: form.phone.trim(), address: form.address.trim() })
      : await onboardLandlord({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(), password: form.password });
    setSubmitting(false);
    if (result.success) { await onDone(); onClose(); } else { setError(result.message); }
  };

  return (
    <Modal title={editing ? "Edit landlord" : "Onboard landlord"} subtitle={editing ? landlord!.email : "Creates their account and login"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span></div>}
        <div>
          <label className={adminLabel}>Full name *</label>
          <input value={form.fullName} onChange={set("fullName")} placeholder="Mr. S. Mwamba" className={adminInput} required />
        </div>
        <div>
          <label className={adminLabel}>Email {editing ? "" : "*"}</label>
          <input type="email" value={form.email} onChange={set("email")} disabled={editing} placeholder="landlord@example.com" autoComplete="off" className={`${adminInput} ${editing ? "opacity-60 cursor-not-allowed" : ""}`} required={!editing} />
          {editing && <p className="mt-1 text-xs text-slate-400">Email is the login identifier and can't be changed here.</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={adminLabel}>Phone</label><input value={form.phone} onChange={set("phone")} placeholder="+260 …" className={adminInput} /></div>
          <div><label className={adminLabel}>Address</label><input value={form.address} onChange={set("address")} placeholder="Property address" className={adminInput} /></div>
        </div>
        {!editing && (
          <div>
            <label className={adminLabel}>Initial password *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" className={`${adminInput} pr-11`} required />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              <button type="button" onClick={() => { setForm((f) => ({ ...f, password: generatePassword() })); setShowPassword(true); }} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap">Generate</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Share this securely — the landlord signs in with it.</p>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button type="submit" disabled={!canSubmit} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold">
            {submitting ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : editing ? "Save changes" : "Onboard"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetailStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400"><Icon size={13} /> {label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function DetailModal({ landlord, currency, onClose, onEdit }: {
  landlord: AdminLandlord;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Modal title={landlord.fullName} subtitle={landlord.email} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${landlordStatusStyle[landlord.status]}`}>{landlord.status === "active" ? "Active" : "Suspended"}</span>
          {landlord.createdAt && <span className="text-xs text-slate-400">Joined {new Date(landlord.createdAt).toLocaleDateString()}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailStat icon={Building2} label="Blocks" value={String(landlord.blocks)} />
          <DetailStat icon={BedDouble} label="Beds" value={`${landlord.occupiedBeds}/${landlord.beds}`} />
          <DetailStat icon={Users} label="Students" value={String(landlord.students)} />
          <DetailStat icon={Wallet} label="Collected" value={money(landlord.collected, currency)} />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Mail size={15} className="text-slate-400" /> {landlord.email || "—"}</div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Phone size={15} className="text-slate-400" /> {landlord.phone || "—"}</div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><MapPin size={15} className="text-slate-400" /> {landlord.address || "—"}</div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
          Monthly potential from occupied beds: <span className="font-semibold text-slate-800 dark:text-slate-200">{money(landlord.monthlyRevenue, currency)}</span>
        </div>
        <button onClick={onEdit} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"><Pencil size={15} /> Edit landlord</button>
      </div>
    </Modal>
  );
}

function StatusModal({ landlord, onClose, onDone }: {
  landlord: AdminLandlord;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const suspending = landlord.status === "active";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await setLandlordStatus(landlord.id, suspending ? "suspended" : "active");
    setSubmitting(false);
    if (result.success) { await onDone(); onClose(); } else { setError(result.message); }
  };

  return (
    <Modal title={suspending ? "Suspend landlord" : "Reactivate landlord"} subtitle={landlord.fullName} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">{error}</div>}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {suspending
            ? "Suspending blocks this landlord from signing in. Their property data is preserved and reactivating restores access."
            : "Reactivating restores this landlord's ability to sign in and manage their properties."}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={confirm} disabled={submitting} className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 ${suspending ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {submitting ? <><RefreshCw size={15} className="animate-spin" /> Working…</> : suspending ? "Suspend" : "Reactivate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteModal({ landlord, onClose, onDone }: {
  landlord: AdminLandlord;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await deleteLandlord(landlord.id);
    setSubmitting(false);
    if (result.success) { await onDone(); onClose(); } else { setError(result.message); }
  };

  return (
    <Modal title="Delete landlord" subtitle={landlord.fullName} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>This permanently removes the landlord's account and login. It can't be undone. Landlords who still own properties must have their blocks reassigned first.</span>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">{error}</div>}
        <div>
          <label className={adminLabel}>Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={adminInput} placeholder="DELETE" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={confirm} disabled={submitting || confirmText !== "DELETE"} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold">
            {submitting ? <><RefreshCw size={15} className="animate-spin" /> Deleting…</> : "Delete permanently"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
