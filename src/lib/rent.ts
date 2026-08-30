import type { BedSpace, BlockCode } from "./types";

export type RentIncreaseMode = "percentage" | "fixed";

export type RentScope =
  | { kind: "all" }
  | { kind: "block"; blockCode: BlockCode }
  | { kind: "selected"; bedIds: string[] };

export type RentPreviewRow = {
  bedId: string;
  label: string;
  studentName: string | null;
  studentEmail: string | null;
  oldRent: number;
  newRent: number;
  delta: number;
};

/**
 * Mirrors the rounding in the `apply_rent_increment` RPC so the preview the
 * landlord approves is exactly what gets written.
 */
export function computeRentIncrease(current: number, mode: RentIncreaseMode, value: number): number {
  if (!Number.isFinite(current) || current < 0) throw new Error("Current rent must be a non-negative number");
  if (!Number.isFinite(value) || value <= 0) throw new Error("Increase value must be greater than zero");

  const raw = mode === "percentage" ? current * (1 + value / 100) : current + value;
  return Math.round(raw * 100) / 100;
}

/** Beds affected by a scope, always in a stable display order. */
export function resolveScope(beds: BedSpace[], scope: RentScope): BedSpace[] {
  const ordered = [...beds].sort((a, b) =>
    a.blockCode.localeCompare(b.blockCode) ||
    a.roomNumber - b.roomNumber ||
    a.bedLetter.localeCompare(b.bedLetter),
  );

  switch (scope.kind) {
    case "all":
      return ordered;
    case "block":
      return ordered.filter((bed) => bed.blockCode === scope.blockCode);
    case "selected": {
      const wanted = new Set(scope.bedIds);
      return ordered.filter((bed) => wanted.has(bed.id));
    }
  }
}

export function buildRentPreview(
  beds: BedSpace[],
  scope: RentScope,
  mode: RentIncreaseMode,
  value: number,
): RentPreviewRow[] {
  return resolveScope(beds, scope).map((bed) => {
    const newRent = computeRentIncrease(bed.rentAmount, mode, value);
    return {
      bedId: bed.id,
      label: `${bed.blockCode} ${bed.roomNumber}${bed.bedLetter}`,
      studentName: bed.student?.name ?? null,
      studentEmail: bed.student?.email ?? null,
      oldRent: bed.rentAmount,
      newRent,
      delta: Math.round((newRent - bed.rentAmount) * 100) / 100,
    };
  });
}

export function summarizePreview(rows: RentPreviewRow[]) {
  const occupied = rows.filter((row) => Boolean(row.studentName));
  return {
    bedCount: rows.length,
    studentCount: occupied.length,
    vacantCount: rows.length - occupied.length,
    currentMonthlyTotal: rows.reduce((sum, row) => sum + row.oldRent, 0),
    newMonthlyTotal: rows.reduce((sum, row) => sum + row.newRent, 0),
    monthlyUplift: rows.reduce((sum, row) => sum + row.delta, 0),
    notifiableCount: rows.filter((row) => Boolean(row.studentEmail)).length,
  };
}
