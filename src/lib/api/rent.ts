import { getSupabase } from "../supabase";
import type { RentIncreaseMode } from "../rent";

export type ApplyRentIncrementInput = {
  bedIds: string[];
  mode: RentIncreaseMode;
  value: number;
  effectiveDate: string;
  actor?: string | null;
};

export type RentIncrementRow = {
  bedSpaceId: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  oldRent: number;
  newRent: number;
};

/**
 * Forward-only rent change: updates the lease rate on bed_spaces and writes one
 * audit_log row per bed. The current billing cycle is intentionally untouched.
 */
export async function applyRentIncrement(input: ApplyRentIncrementInput): Promise<RentIncrementRow[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  if (input.bedIds.length === 0) throw new Error("Select at least one bed space");
  if (!(input.value > 0)) throw new Error("Increase value must be greater than zero");

  const { data, error } = await sb.rpc("apply_rent_increment", {
    p_bed_ids: input.bedIds,
    p_mode: input.mode,
    p_value: input.value,
    p_effective_date: input.effectiveDate,
    p_actor: input.actor ?? null,
  });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    bedSpaceId: row.bed_space_id,
    tenantId: row.tenant_id ?? null,
    tenantName: row.tenant_name ?? null,
    tenantEmail: row.tenant_email ?? null,
    oldRent: Number(row.old_rent ?? 0),
    newRent: Number(row.new_rent ?? 0),
  }));
}
