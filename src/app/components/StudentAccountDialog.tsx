import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { buttonStyles, inputStyles } from "./primitives";
import { formatBedOption } from "../../lib/students";
import type { StudentAccountRow } from "../../lib/api/students";
import { PAYMENT_METHODS, type BedSpace, type BillingStatus, type OnboardStudentInput, type PaymentMethod, type RoomGender, type UpdateStudentAccountInput } from "../../lib/types";

const EDITABLE_BILLING_STATUSES: Exclude<BillingStatus, "Vacant">[] = [
  "Paid / Secured",
  "OVERDUE / UNPAID",
  "Open Window",
  "Grace Period",
];

export type StudentFormValues = {
  name: string;
  phone: string;
  email: string;
  nrc: string;
  moveInDate: string;
  billingStatus: Exclude<BillingStatus, "Vacant">;
  bedSpaceId: string;
  rentAmount: string;
  gender: RoomGender | "";
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentRef: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function billingStatusFromRow(row: StudentAccountRow): Exclude<BillingStatus, "Vacant"> {
  const status = row.billing_status;
  if (status === "Paid / Secured" || status === "OVERDUE / UNPAID" || status === "Open Window" || status === "Grace Period") {
    return status;
  }
  return "Open Window";
}

function valuesFromStudent(row: StudentAccountRow): StudentFormValues {
  return {
    name: row.full_name,
    phone: row.phone && row.phone !== "-" ? row.phone : "",
    email: row.email ?? "",
    nrc: row.nrc && row.nrc !== "-" ? row.nrc : "",
    moveInDate: row.move_in_date ?? todayIso(),
    billingStatus: billingStatusFromRow(row),
    bedSpaceId: row.bed_space_id ?? "",
    rentAmount: row.rent_amount != null ? String(row.rent_amount) : "",
    gender: row.gender ?? row.room_gender ?? "",
    paymentAmount: "",
    paymentDate: todayIso(),
    paymentMethod: "Cash",
    paymentRef: "",
  };
}

function emptyValues(defaultBedId: string, defaultRent: string): StudentFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    nrc: "",
    moveInDate: todayIso(),
    billingStatus: "Open Window",
    bedSpaceId: defaultBedId,
    rentAmount: defaultRent,
    gender: "",
    paymentAmount: "",
    paymentDate: todayIso(),
    paymentMethod: "Cash",
    paymentRef: "",
  };
}

export default function StudentAccountDialog({
  open,
  mode,
  student,
  beds,
  canManage,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  mode: "create" | "edit";
  student: StudentAccountRow | null;
  beds: BedSpace[];
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: OnboardStudentInput) => Promise<unknown>;
  onUpdate: (input: UpdateStudentAccountInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<StudentFormValues>(() => emptyValues("", ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableBeds = useMemo(() => {
    const vacant = beds
      .filter((bed) => !bed.student)
      .filter((bed) => !form.gender || !bed.roomGender || bed.roomGender === form.gender)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (mode === "edit" && student?.bed_space_id) {
      const current = beds.find((bed) => bed.id === student.bed_space_id);
      if (current && !vacant.some((bed) => bed.id === current.id)) {
        return [current, ...vacant];
      }
    }
    return vacant;
  }, [beds, mode, student, form.gender]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (mode === "edit" && student) {
      setForm(valuesFromStudent(student));
      return;
    }
    const first = beds.filter((bed) => !bed.student).sort((a, b) => a.id.localeCompare(b.id))[0];
    setForm(emptyValues(first?.id ?? "", first ? String(first.rentAmount) : ""));
  }, [open, mode, student, beds]);

  function setField<K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBedChange(bedId: string) {
    const bed = beds.find((row) => row.id === bedId);
    setForm((prev) => ({
      ...prev,
      bedSpaceId: bedId,
      rentAmount: bed ? String(bed.rentAmount) : prev.rentAmount,
      gender: bed?.roomGender ?? prev.gender,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const name = form.name.trim();
    const rentAmount = Number(form.rentAmount);
    if (!name) {
      setError("A full name is required.");
      return;
    }
    if (mode === "create" && !form.email.trim()) {
      setError("An email is required so we can send the password invite.");
      return;
    }
    if (!form.gender) {
      setError("Select whether the student is male or female.");
      return;
    }
    if (!form.bedSpaceId) {
      setError("Choose a bed space.");
      return;
    }
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setError("Monthly rent must be greater than zero.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await onCreate({
          bedId: form.bedSpaceId,
          name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          nrc: form.nrc.trim() || undefined,
          moveInDate: form.moveInDate || todayIso(),
          rentAmount,
          gender: form.gender || undefined,
        });
      } else if (student) {
        const paymentAmount = Number(form.paymentAmount);
        const manualPayment = form.paymentAmount.trim() && Number.isFinite(paymentAmount) && paymentAmount > 0
          ? {
              amount: paymentAmount,
              submittedAt: form.paymentDate || todayIso(),
              method: form.paymentMethod,
              transactionRef: form.paymentRef.trim() || undefined,
            }
          : undefined;
        await onUpdate({
          tenantId: student.id,
          name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          nrc: form.nrc.trim() || undefined,
          moveInDate: form.moveInDate || todayIso(),
          bedSpaceId: form.bedSpaceId,
          rentAmount,
          gender: form.gender || undefined,
          billingStatus: form.billingStatus,
          manualPayment,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add student" : `Edit ${student?.full_name ?? "student"}`}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Assign gender and a matching vacant bed. We’ll email a link (valid at least 15 minutes) so they can finish onboarding, pick their bed if needed, and create a password."
              : "Update contact details, gender, bed, rent, or record a cash/mobile receipt for students who paid without the app."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Full name</span>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={inputStyles}
                autoComplete="name"
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Email{mode === "create" ? " *" : ""}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={inputStyles}
                autoComplete="email"
                placeholder="student@email.com"
                required={mode === "create"}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={inputStyles}
                autoComplete="tel"
                placeholder="0977 000 000"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">NRC</span>
              <input
                value={form.nrc}
                onChange={(e) => setField("nrc", e.target.value)}
                className={inputStyles}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Gender</span>
              <select
                value={form.gender}
                onChange={(e) => {
                  const next = e.target.value as RoomGender | "";
                  const matching = beds
                    .filter((bed) => !bed.student || (mode === "edit" && student?.bed_space_id === bed.id))
                    .filter((bed) => !next || !bed.roomGender || bed.roomGender === next)
                    .sort((a, b) => a.id.localeCompare(b.id));
                  const keep = matching.find((bed) => bed.id === form.bedSpaceId) ?? matching[0];
                  setForm((prev) => ({
                    ...prev,
                    gender: next,
                    bedSpaceId: keep?.id ?? "",
                    rentAmount: keep ? String(keep.rentAmount) : prev.rentAmount,
                  }));
                }}
                className={inputStyles}
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Move-in date</span>
              <input
                type="date"
                value={form.moveInDate}
                onChange={(e) => setField("moveInDate", e.target.value)}
                className={inputStyles}
                required
              />
            </label>

            {mode === "edit" && (
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
                <select
                  value={form.billingStatus}
                  onChange={(e) => setField("billingStatus", e.target.value as Exclude<BillingStatus, "Vacant">)}
                  className={inputStyles}
                >
                  {EDITABLE_BILLING_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === "OVERDUE / UNPAID" ? "Overdue" : status}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bed space</span>
              <select
                value={form.bedSpaceId}
                onChange={(e) => handleBedChange(e.target.value)}
                className={inputStyles}
                required
              >
                {assignableBeds.length === 0 && <option value="">No vacant beds</option>}
                {assignableBeds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {formatBedOption(bed)}
                    {student?.bed_space_id === bed.id ? " · current" : " · vacant"}
                    {bed.roomGender ? ` · ${bed.roomGender}` : ""}
                    {` · K${bed.rentAmount}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly rent (K)</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.rentAmount}
                onChange={(e) => setField("rentAmount", e.target.value)}
                className={inputStyles}
                required
              />
            </label>
          </div>

          {mode === "edit" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Record last payment</p>
                <p className="text-xs text-slate-500 mt-1">
                  {student?.last_payment_at
                    ? `Current last payment: ${student.last_payment_at}${student.last_payment_amount != null ? ` · K${student.last_payment_amount}` : ""}. Leave amount blank to keep it.`
                    : "For students who paid in cash or without the app. Leave amount blank unless you are recording a receipt."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount (K)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.paymentAmount}
                    onChange={(e) => setField("paymentAmount", e.target.value)}
                    className={inputStyles}
                    placeholder="e.g. 900"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment date</span>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setField("paymentDate", e.target.value)}
                    className={inputStyles}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Method</span>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setField("paymentMethod", e.target.value as PaymentMethod)}
                    className={inputStyles}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Receipt / ref</span>
                  <input
                    value={form.paymentRef}
                    onChange={(e) => setField("paymentRef", e.target.value)}
                    className={inputStyles}
                    placeholder="Optional"
                  />
                </label>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className={buttonStyles.outline}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !canManage || assignableBeds.length === 0} className={buttonStyles.primary}>
              {saving ? "Saving…" : mode === "create" ? "Add student" : "Save changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
