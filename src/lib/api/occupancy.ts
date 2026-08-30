import { getSupabase } from "../supabase";
import type { OccupancyIssue } from "../occupancy";

export async function auditOccupancy(): Promise<OccupancyIssue[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("audit_occupancy");
  if (error) throw error;
  return (data ?? []) as OccupancyIssue[];
}

export async function reconcileBedSpace(bedId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { error } = await sb.rpc("reconcile_bed_space", { p_bed_id: bedId });
  if (error) throw error;
}

export async function reconcileAllOccupancy(): Promise<number> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("reconcile_all_occupancy");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function findTenantOnBed(bedId: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("tenants")
    .select("id, full_name, email, bed_space_id")
    .eq("bed_space_id", bedId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findTenantByEmail(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const normalized = email.trim().toLowerCase();
  const { data, error } = await sb
    .from("tenants")
    .select("id, full_name, email, bed_space_id")
    .eq("email", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data;
}
