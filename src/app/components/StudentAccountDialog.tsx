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
import type { BedSpace, OnboardStudentInput, UpdateStudentAccountInput } from "../../lib/types";

export type StudentFormValues = {
  name: string;
  phone: string;
  email: string;
  nrc: string;
  moveInDate: string;
  bedSpaceId: string;
  rentAmount: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function valuesFromStudent(row: StudentAccountRow): StudentFormValues {
  return {
    name: row.full_name,
    phone: row.phone && row.phone !== "-" ? row.phone : "",
    email: row.email ?? "",
    nrc: row.nrc && row.nrc !== "-" ? row.nrc : "",
    moveInDate: row.move_in_date ?? todayIso(),
    bedSpaceId: row.bed_space_id ?? "",
    rentAmount: row.rent_amount != null ? String(row.rent_amount) : "",
  };
}

function emptyValues(defaultBedId: string, defaultRent: string): StudentFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    nrc: "",
    moveInDate: todayIso(),
    bedSpaceId: defaultBedId,
    rentAmount: defaultRent,
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
    const vacant = beds.filter((bed) => !bed.student).sort((a, b) => a.id.localeCompare(b.id));
    if (mode === "edit" && student?.bed_space_id) {
      const current = beds.find((bed) => bed.id === student.bed_space_id);
      if (current && !vacant.some((bed) => bed.id === current.id)) {
        return [current, ...vacant];
      }
    }
    return vacant;
  }, [beds, mode, student]);

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
        });
      } else if (student) {
        await onUpdate({
          tenantId: student.id,
          name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          nrc: form.nrc.trim() || undefined,
          moveInDate: form.moveInDate || todayIso(),
          bedSpaceId: form.bedSpaceId,
          rentAmount,
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
              ? "Assign a vacant bed and set the monthly rent. We’ll email them a link to create a password and open their portal."
              : "Update contact details, move the student to another bed, or change the monthly rent."}
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Move-in date</span>
              <input
                type="date"
                value={form.moveInDate}
                onChange={(e) => setField("moveInDate", e.target.value)}
                className={inputStyles}
                required
              />
            </label>

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
