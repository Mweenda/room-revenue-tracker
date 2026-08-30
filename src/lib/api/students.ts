import { getSupabase } from "../supabase";
import { inviteStudentToPortal } from "../auth";
import type { TenantStatus, UpdateStudentAccountInput } from "../types";

export type StudentAccountRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nrc: string | null;
  move_in_date: string | null;
  profile_image_url: string | null;
  bed_space_id: string | null;
  tenant_status: TenantStatus;
  status_changed_at: string | null;
  status_reason: string | null;
  bed_status: string | null;
  block_code: string | null;
  room_number: number | null;
  bed_letter: string | null;
  rent_amount: number | null;
  total_balance: number | null;
  billing_status: string | null;
};

type BedJoin = {
  id: string;
  block_code: string | null;
  room_number: number | null;
  bed_letter: string | null;
  rent_amount: number | null;
  status: string | null;
  billing_records: unknown;
};

function firstOf<T>(value: unknown): T | undefined {
  if (Array.isArray(value)) return value[0] as T | undefined;
  return (value ?? undefined) as T | undefined;
}

/**
 * Every tenant with their bed and current billing snapshot. Evicted and
 * moved-out tenants are retained for history and only returned when
 * `includeInactive` is set.
 */
export async function fetchStudentAccounts(
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<StudentAccountRow[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  let query = sb
    .from("tenants")
    .select(
      "id, full_name, email, phone, nrc, move_in_date, profile_image_url, bed_space_id, status, status_changed_at, status_reason, " +
      "bed_spaces (id, block_code, room_number, bed_letter, rent_amount, status, billing_records (total_balance, billing_status))",
    )
    .order("full_name");

  if (!includeInactive) query = query.eq("status", "active");

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const bed = firstOf<BedJoin>(row.bed_spaces);
    const billing = firstOf<{ total_balance: number | null; billing_status: string | null }>(bed?.billing_records);

    return {
      id: row.id,
      full_name: row.full_name ?? "",
      email: row.email ?? null,
      phone: row.phone ?? null,
      nrc: row.nrc ?? null,
      move_in_date: row.move_in_date ?? null,
      profile_image_url: row.profile_image_url ?? null,
      bed_space_id: row.bed_space_id ?? null,
      tenant_status: (row.status ?? "active") as TenantStatus,
      status_changed_at: row.status_changed_at ?? null,
      status_reason: row.status_reason ?? null,
      bed_status: bed?.status ?? null,
      block_code: bed?.block_code ?? null,
      room_number: bed?.room_number ?? null,
      bed_letter: bed?.bed_letter ?? null,
      rent_amount: bed?.rent_amount ?? null,
      total_balance: billing?.total_balance ?? null,
      billing_status: billing?.billing_status ?? null,
    };
  });
}

export type EvictTenantInput = {
  tenantId: string;
  reason: string;
  actor?: string | null;
  status?: Exclude<TenantStatus, "active">;
};

export type EvictTenantResult = {
  tenantId: string;
  fullName: string;
  email: string | null;
  bedSpaceId: string;
  outstandingBalance: number;
};

/** Soft-deletes a tenant, frees the bed, and writes an audit_log entry. */
export async function evictTenant(input: EvictTenantInput): Promise<EvictTenantResult> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to remove a student");

  const { data, error } = await sb.rpc("evict_tenant", {
    p_tenant_id: input.tenantId,
    p_reason: reason,
    p_actor: input.actor ?? null,
    p_status: input.status ?? "evicted",
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Removal did not return a result");

  return {
    tenantId: row.tenant_id,
    fullName: row.full_name,
    email: row.email ?? null,
    bedSpaceId: row.bed_space_id,
    outstandingBalance: Number(row.outstanding_balance ?? 0),
  };
}

export async function updateStudentAccount(input: UpdateStudentAccountInput): Promise<{
  tenantId: string;
  fullName: string;
  bedSpaceId: string;
  rentAmount: number;
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const name = input.name.trim();
  if (!name) throw new Error("A full name is required");
  if (!(input.rentAmount > 0)) throw new Error("Monthly rent must be greater than zero");
  if (!input.bedSpaceId) throw new Error("A bed space is required");

  const { data: existing, error: existingError } = await sb
    .from("tenants")
    .select("email")
    .eq("id", input.tenantId)
    .single();
  if (existingError) throw existingError;

  const { data, error } = await sb.rpc("update_tenant", {
    p_tenant_id: input.tenantId,
    p_full_name: name,
    p_phone: input.phone,
    p_email: input.email,
    p_nrc: input.nrc ?? "-",
    p_move_in_date: input.moveInDate || null,
    p_bed_space_id: input.bedSpaceId,
    p_rent_amount: input.rentAmount,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Update did not return a result");

  const nextEmail = input.email.trim();
  if (nextEmail && nextEmail.toLowerCase() !== (existing.email ?? "").toLowerCase()) {
    await inviteStudentToPortal(nextEmail, name);
  }

  return {
    tenantId: row.tenant_id,
    fullName: row.full_name,
    bedSpaceId: row.bed_space_id,
    rentAmount: Number(row.rent_amount),
  };
}
