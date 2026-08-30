import { getSupabase } from "../supabase";
import type { BedSpace } from "../types";
import { mapBed } from "./mappers";

export async function fetchBeds(): Promise<BedSpace[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("bed_spaces")
    .select("*")
    .order("block_code")
    .order("room_number")
    .order("bed_letter");

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: tenants, error: tenantsError } = await sb
    .from("tenants")
    .select("*")
    .eq("status", "active")
    .in("bed_space_id", rows.map((row) => row.id));
  if (tenantsError) throw tenantsError;

  const tenantsByBed = new Map<string, typeof tenants>();
  for (const tenant of tenants ?? []) {
    const existing = tenantsByBed.get(tenant.bed_space_id) ?? [];
    existing.push(tenant);
    tenantsByBed.set(tenant.bed_space_id, existing);
  }

  return rows.map((row) => mapBed({
    ...row,
    tenants: tenantsByBed.get(row.id) ?? row.tenants ?? [],
  }));
}
