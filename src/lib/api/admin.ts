import { getSupabase } from "../supabase";

export type LandlordStatus = "active" | "suspended";

export interface AdminLandlord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  status: LandlordStatus;
  createdAt: string | null;
  blocks: number;
  beds: number;
  occupiedBeds: number;
  students: number;
  monthlyRevenue: number;
  collected: number;
}

export interface AdminStudentRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  bedSpaceId: string;
  blockCode: string;
  landlordName: string;
  tenantStatus: string;
  billingStatus: string | null;
  balance: number;
  moveInDate: string | null;
}

export interface AdminActivity {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  note: string | null;
  createdAt: string;
  category: ActivityCategory;
}

export type ActivityCategory = "create" | "update" | "delete" | "login" | "security" | "other";

export interface AdminOverview {
  landlordCount: number;
  activeLandlords: number;
  suspendedLandlords: number;
  studentCount: number;
  bedCount: number;
  occupiedBeds: number;
  occupancyRate: number;
  collectedRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

export interface AdminData {
  overview: AdminOverview;
  landlords: AdminLandlord[];
  students: AdminStudentRow[];
  activity: AdminActivity[];
}

export interface PlatformSettings {
  billingCycleDay: number;
  gracePeriodDays: number;
  currency: string;
  otpEnabled: boolean;
  sessionTimeoutMinutes: number;
}

export interface OnboardLandlordInput {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  password: string;
}

function categorizeAction(action: string): ActivityCategory {
  const a = action.toLowerCase();
  if (a.includes("login") || a.includes("sign")) return "login";
  if (a.includes("suspend") || a.includes("reactivate") || a.includes("ban") || a.includes("security") || a.includes("password") || a.includes("session")) return "security";
  if (a.includes("delete") || a.includes("evict") || a.includes("remove") || a.includes("vacate")) return "delete";
  if (a.includes("create") || a.includes("onboard") || a.includes("insert") || a.includes("add")) return "create";
  if (a.includes("update") || a.includes("edit") || a.includes("increment") || a.includes("verify") || a.includes("reject") || a.includes("reconcile")) return "update";
  return "other";
}

async function invokeAdmin(action: string, payload: Record<string, unknown> = {}): Promise<{ success: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, message: "Database not configured" };
  try {
    const { data, error } = await sb.functions.invoke("admin", { body: { action, ...payload } });
    if (error) {
      const context = (error as any)?.context;
      let message = error.message ?? "The request failed";
      try {
        const parsed = context && typeof context.json === "function" ? await context.json() : null;
        if (parsed?.error) message = parsed.error;
      } catch {
        // keep generic message
      }
      return { success: false, message };
    }
    if (data?.error) return { success: false, message: data.error };
    return { success: true, message: "Done" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "The request failed" };
  }
}

export async function fetchAdminData(): Promise<AdminData> {
  const sb = getSupabase();
  if (!sb) throw new Error("Database not configured");

  const [profilesRes, blocksRes, bedsRes, tenantsRes, billingRes, paymentsRes, auditRes] = await Promise.all([
    sb.from("profiles").select("id, full_name, email, phone, address, status, created_at, role").eq("role", "landlord"),
    sb.from("blocks").select("code, name, landlord_id"),
    sb.from("bed_spaces").select("id, block_code, status, rent_amount"),
    sb.from("tenants").select("id, full_name, email, phone, bed_space_id, status, move_in_date"),
    sb.from("billing_records").select("billing_id, billing_status, total_balance"),
    sb.from("payments").select("bed_space_id, amount, status"),
    sb.from("audit_log").select("id, actor_email, action, entity_type, entity_id, note, created_at").order("created_at", { ascending: false }).limit(150),
  ]);

  for (const res of [profilesRes, blocksRes, bedsRes, tenantsRes, billingRes, paymentsRes, auditRes]) {
    if (res.error) throw res.error;
  }

  const landlordRows = (profilesRes.data ?? []) as any[];
  const blocks = (blocksRes.data ?? []) as any[];
  const beds = (bedsRes.data ?? []) as any[];
  const tenants = (tenantsRes.data ?? []) as any[];
  const billing = (billingRes.data ?? []) as any[];
  const payments = (paymentsRes.data ?? []) as any[];

  const blockToLandlord = new Map<string, string>();
  const landlordName = new Map<string, string>();
  for (const l of landlordRows) landlordName.set(l.id, l.full_name);
  for (const b of blocks) blockToLandlord.set(String(b.code), b.landlord_id);

  const bedToBlock = new Map<string, string>();
  const bedRent = new Map<string, number>();
  for (const bed of beds) {
    bedToBlock.set(bed.id, String(bed.block_code));
    bedRent.set(bed.id, Number(bed.rent_amount) || 0);
  }
  const bedToLandlord = (bedId: string): string | undefined => {
    const code = bedToBlock.get(bedId);
    return code ? blockToLandlord.get(code) : undefined;
  };

  const billingByBed = new Map<string, { status: string; balance: number }>();
  for (const rec of billing) {
    billingByBed.set(rec.billing_id, { status: rec.billing_status, balance: Number(rec.total_balance) || 0 });
  }

  // Per-landlord aggregates.
  const agg = new Map<string, { blocks: number; beds: number; occupied: number; students: number; monthly: number; collected: number }>();
  const ensure = (id: string) => {
    if (!agg.has(id)) agg.set(id, { blocks: 0, beds: 0, occupied: 0, students: 0, monthly: 0, collected: 0 });
    return agg.get(id)!;
  };
  for (const l of landlordRows) ensure(l.id);
  for (const b of blocks) { const l = blockToLandlord.get(String(b.code)); if (l) ensure(l).blocks += 1; }
  for (const bed of beds) {
    const l = bedToLandlord(bed.id);
    if (!l) continue;
    const a = ensure(l);
    a.beds += 1;
    if (bed.status === "occupied") { a.occupied += 1; a.monthly += Number(bed.rent_amount) || 0; }
  }
  for (const t of tenants) {
    if (t.status !== "active") continue;
    const l = bedToLandlord(t.bed_space_id);
    if (l) ensure(l).students += 1;
  }
  for (const p of payments) {
    if (p.status !== "verified") continue;
    const l = bedToLandlord(p.bed_space_id);
    if (l) ensure(l).collected += Number(p.amount) || 0;
  }

  const landlords: AdminLandlord[] = landlordRows
    .map((l) => {
      const a = ensure(l.id);
      return {
        id: l.id,
        fullName: l.full_name ?? "",
        email: l.email ?? "",
        phone: l.phone ?? "",
        address: l.address ?? "",
        status: (l.status === "suspended" ? "suspended" : "active") as LandlordStatus,
        createdAt: l.created_at ?? null,
        blocks: a.blocks,
        beds: a.beds,
        occupiedBeds: a.occupied,
        students: a.students,
        monthlyRevenue: a.monthly,
        collected: a.collected,
      };
    })
    .sort((x, y) => x.fullName.localeCompare(y.fullName));

  const students: AdminStudentRow[] = tenants
    .map((t) => {
      const code = bedToBlock.get(t.bed_space_id) ?? "";
      const l = bedToLandlord(t.bed_space_id);
      const bill = billingByBed.get(t.bed_space_id);
      return {
        id: t.id,
        fullName: t.full_name ?? "",
        email: t.email ?? "",
        phone: t.phone ?? "",
        bedSpaceId: t.bed_space_id,
        blockCode: code,
        landlordName: (l && landlordName.get(l)) || "—",
        tenantStatus: t.status ?? "active",
        billingStatus: bill?.status ?? null,
        balance: bill?.balance ?? 0,
        moveInDate: t.move_in_date ?? null,
      };
    })
    .sort((x, y) => x.fullName.localeCompare(y.fullName));

  const activity: AdminActivity[] = ((auditRes.data ?? []) as any[]).map((row) => ({
    id: row.id,
    actorEmail: row.actor_email ?? null,
    action: row.action,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
    category: categorizeAction(row.action ?? ""),
  }));

  const bedCount = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === "occupied").length;
  const activeStudents = tenants.filter((t) => t.status === "active").length;
  const collectedRevenue = payments.filter((p) => p.status === "verified").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  const monthlyRevenue = beds.filter((b) => b.status === "occupied").reduce((s, b) => s + (Number(b.rent_amount) || 0), 0);
  const suspendedLandlords = landlords.filter((l) => l.status === "suspended").length;

  const overview: AdminOverview = {
    landlordCount: landlords.length,
    activeLandlords: landlords.length - suspendedLandlords,
    suspendedLandlords,
    studentCount: activeStudents,
    bedCount,
    occupiedBeds,
    occupancyRate: bedCount > 0 ? Math.round((occupiedBeds / bedCount) * 100) : 0,
    collectedRevenue,
    monthlyRevenue,
    pendingPayments,
  };

  return { overview, landlords, students, activity };
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const sb = getSupabase();
  if (!sb) throw new Error("Database not configured");
  const { data, error } = await sb
    .from("platform_settings")
    .select("billing_cycle_day, grace_period_days, currency, otp_enabled, session_timeout_minutes")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return {
    billingCycleDay: data?.billing_cycle_day ?? 1,
    gracePeriodDays: data?.grace_period_days ?? 5,
    currency: data?.currency ?? "ZMW",
    otpEnabled: data?.otp_enabled ?? true,
    sessionTimeoutMinutes: data?.session_timeout_minutes ?? 60,
  };
}

export async function savePlatformSettings(settings: PlatformSettings): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Database not configured");
  const { error } = await sb
    .from("platform_settings")
    .update({
      billing_cycle_day: settings.billingCycleDay,
      grace_period_days: settings.gracePeriodDays,
      currency: settings.currency,
      otp_enabled: settings.otpEnabled,
      session_timeout_minutes: settings.sessionTimeoutMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
}

export function onboardLandlord(input: OnboardLandlordInput) {
  return invokeAdmin("onboard-landlord", {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? "",
    address: input.address ?? "",
    password: input.password,
  });
}

export function updateLandlord(input: { id: string; fullName: string; phone?: string; address?: string }) {
  return invokeAdmin("update-landlord", {
    id: input.id,
    fullName: input.fullName,
    phone: input.phone ?? "",
    address: input.address ?? "",
  });
}

export function setLandlordStatus(id: string, status: LandlordStatus) {
  return invokeAdmin("set-landlord-status", { id, status });
}

export function deleteLandlord(id: string) {
  return invokeAdmin("delete-landlord", { id });
}

export function logAdminLogin(): void {
  void invokeAdmin("log-login");
}
