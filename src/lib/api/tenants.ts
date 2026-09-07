import { getCurrentBillingMonth } from "../billing";
import { getSupabase } from "../supabase";
import { inviteStudentToPortal, normalizeEmail } from "../auth";
import { contentTypeFor, describeStorageError, prepareUploadFile, storageObjectPath } from "../upload";
import { findTenantByEmail, findTenantOnBed, reconcileBedSpace } from "./occupancy";
import type { BedSpace, BillingRecord, OnboardStudentInput, RoomGender, Student } from "../types";

type OnboardRpcRow = {
  tenant_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  nrc: string | null;
  move_in_date: string | null;
  bed_space_id: string;
  rent_amount: number | string;
  block_code: BedSpace["blockCode"];
  room_number: number;
  bed_letter: string;
  room_gender: BillingRecord["room_gender"];
};

function mapOnboardRow(row: OnboardRpcRow, fallback: OnboardStudentInput): {
  bed: BedSpace;
  billing: BillingRecord;
  student: Student;
} {
  const rent = Number(row.rent_amount);
  const moveIn = row.move_in_date || fallback.moveInDate;
  const student: Student = {
    id: row.tenant_id,
    name: row.full_name,
    phone: row.phone || "-",
    email: row.email || "-",
    nrc: row.nrc ?? "-",
    moveInDate: moveIn,
    gender: fallback.gender ?? row.room_gender,
  };
  const bed: BedSpace = {
    id: row.bed_space_id,
    blockCode: row.block_code,
    roomNumber: row.room_number,
    bedLetter: row.bed_letter,
    identifier: `${row.block_code}-${row.room_number}-${row.bed_letter}`,
    rentAmount: rent,
    status: "occupied",
    student,
    roomGender: row.room_gender,
  };
  const billing: BillingRecord = {
    billing_id: row.bed_space_id,
    house_block: row.block_code,
    room_number: String(row.room_number),
    bed_space: row.bed_letter,
    room_gender: row.room_gender,
    tenant_name: row.full_name,
    phone_number: row.phone || "-",
    entry_date: moveIn,
    current_rent: rent,
    target_month: getCurrentBillingMonth(),
    accumulated_total: rent,
    total_balance: rent,
    days_past_due: 0,
    billing_status: "Open Window",
  };
  return { bed, billing, student };
}

function rpcMissing(error: { message?: string; code?: string } | null): boolean {
  const code = (error?.code ?? "").toUpperCase();
  const text = (error?.message ?? "").toLowerCase();
  return code === "PGRST202" || (text.includes("onboard_student") && (text.includes("does not exist") || text.includes("could not find")));
}

function postgresMessage(error: { message?: string; details?: string; hint?: string } | null | undefined, fallback: string): Error {
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(" — ");
  return new Error(text || fallback);
}

export async function onboardStudent(input: OnboardStudentInput): Promise<{
  bed: BedSpace;
  billing: BillingRecord;
  student: Student;
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const moveIn = input.moveInDate || new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.rpc("onboard_student", {
    p_bed_space_id: input.bedId,
    p_full_name: input.name,
    p_phone: input.phone || "",
    p_email: input.email,
    p_nrc: input.nrc ?? "-",
    p_move_in_date: moveIn,
    p_rent_amount: input.rentAmount ?? null,
    p_target_month: getCurrentBillingMonth(),
    p_gender: input.gender ?? null,
  });

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as OnboardRpcRow | null;
    if (!row) throw new Error("Onboarding did not return a student record");
    return mapOnboardRow(row, { ...input, moveInDate: moveIn });
  }

  if (!rpcMissing(error)) {
    const text = error.message ?? "";
    if (text.includes("tenants_active_phone_idx") || /phone .* already assigned/i.test(text)) {
      throw new Error("That phone number is already assigned to another active student.");
    }
    throw postgresMessage(error, "Could not onboard the student");
  }

  // Fallback until migration 016 is applied: same checks, still not atomic.
  const { data: bedRow, error: bedErr } = await sb
    .from("bed_spaces")
    .select("*")
    .eq("id", input.bedId)
    .single();
  if (bedErr) throw bedErr;

  const existingOnBed = await findTenantOnBed(input.bedId);
  if (existingOnBed) {
    throw new Error(`Bed space is already occupied by ${existingOnBed.full_name}`);
  }

  if (bedRow.status === "occupied") {
    await reconcileBedSpace(input.bedId);
    const stillOccupied = await findTenantOnBed(input.bedId);
    if (stillOccupied) {
      throw new Error(`Bed space is already occupied by ${stillOccupied.full_name}`);
    }
  }

  if (input.email) {
    const emailUsed = await findTenantByEmail(input.email);
    if (emailUsed) {
      throw new Error(`This email is already assigned to bed ${emailUsed.bed_space_id}`);
    }
  }

  const rent = Number(input.rentAmount ?? bedRow.rent_amount);
  if (!(rent > 0)) throw new Error("Monthly rent must be greater than zero");

  if (input.rentAmount != null) {
    const { error: rentErr } = await sb
      .from("bed_spaces")
      .update({ rent_amount: rent })
      .eq("id", input.bedId);
    if (rentErr) throw rentErr;
  }

  const { data: tenant, error: tenantErr } = await sb
    .from("tenants")
    .insert({
      bed_space_id: input.bedId,
      full_name: input.name,
      phone: input.phone || null,
      email: input.email ? normalizeEmail(input.email) : null,
      nrc: input.nrc ?? "-",
      move_in_date: moveIn,
      gender: input.gender ?? bedRow.room_gender,
    })
    .select("*")
    .single();
  if (tenantErr) throw postgresMessage(tenantErr, "Could not onboard the student");

  const { error: billErr } = await sb
    .from("billing_records")
    .upsert({
      billing_id: input.bedId,
      house_block: bedRow.block_code,
      room_number: String(bedRow.room_number),
      bed_space: bedRow.bed_letter,
      room_gender: bedRow.room_gender,
      tenant_name: input.name,
      phone_number: input.phone || "-",
      entry_date: moveIn,
      current_rent: rent,
      target_month: getCurrentBillingMonth(),
      accumulated_total: rent,
      total_balance: rent,
      days_past_due: 0,
      billing_status: "Open Window",
    })
    .select("*")
    .single();
  if (billErr) throw postgresMessage(billErr, "Student was created but billing could not be updated");

  const { error: updateBedErr } = await sb
    .from("bed_spaces")
    .update({ status: "occupied" })
    .eq("id", input.bedId);
  if (updateBedErr) throw updateBedErr;

  return mapOnboardRow({
    tenant_id: tenant.id,
    full_name: tenant.full_name,
    phone: tenant.phone,
    email: tenant.email,
    nrc: tenant.nrc,
    move_in_date: tenant.move_in_date,
    bed_space_id: tenant.bed_space_id,
    rent_amount: rent,
    block_code: bedRow.block_code,
    room_number: bedRow.room_number,
    bed_letter: bedRow.bed_letter,
    room_gender: bedRow.room_gender,
  }, { ...input, moveInDate: moveIn });
}

export async function updateStudent(input: {
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  moveInDate: string;
  nrc?: string;
  gender?: RoomGender;
  sendLoginLink?: boolean;
}): Promise<Student> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: existingTenant, error: existingTenantError } = await sb
    .from("tenants")
    .select("email")
    .eq("id", input.tenantId)
    .single();
  if (existingTenantError) throw existingTenantError;
  const { data: authUser } = await sb.auth.getUser();
  const isSignedInStudent = Boolean(
    authUser.user?.email && existingTenant.email &&
    authUser.user.email.toLowerCase() === existingTenant.email.toLowerCase(),
  );

  const { data: tenant, error: tenantErr } = await sb
    .from("tenants")
    .update({
      full_name: input.name,
      phone: input.phone || null,
      email: input.email ? normalizeEmail(input.email) : null,
      nrc: input.nrc ?? "-",
      move_in_date: input.moveInDate,
      ...(input.gender ? { gender: input.gender } : {}),
    })
    .eq("id", input.tenantId)
    .select("*")
    .single();
  if (tenantErr) throw tenantErr;

  const { data: bedSpace } = await sb
    .from("bed_spaces")
    .select("id")
    .eq("id", tenant.bed_space_id)
    .single();

  if (bedSpace) {
    await sb
      .from("billing_records")
      .update({
        tenant_name: input.name,
        phone_number: input.phone || "-",
      })
      .eq("billing_id", bedSpace.id);

    if (isSignedInStudent && input.email.trim().toLowerCase() !== existingTenant.email?.toLowerCase()) {
      // Keep the authenticated identity aligned when the signed-in student edits their email.
      const { error: authError } = await sb.auth.updateUser({ email: input.email.trim().toLowerCase() });
      if (authError) throw authError;
    }
  }

  if (input.email && input.sendLoginLink) {
    await inviteStudentToPortal(input.email, input.name);
  }

  return {
    id: tenant.id,
    name: tenant.full_name,
    phone: tenant.phone || "-",
    email: tenant.email || "-",
    nrc: tenant.nrc ?? "-",
    moveInDate: tenant.move_in_date ?? input.moveInDate,
    gender: tenant.gender ?? input.gender,
  };
}

export async function vacateBedSpace(bedId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const tenant = await findTenantOnBed(bedId);
  if (!tenant) {
    await reconcileBedSpace(bedId);
    return;
  }

  // Soft-delete through the audited RPC. A hard delete would drop history and
  // (after migration 007) is no longer allowed by RLS.
  const { error } = await sb.rpc("evict_tenant", {
    p_tenant_id: tenant.id,
    p_reason: "Marked vacant from occupancy portal",
    p_status: "moved_out",
  });
  if (error) throw error;
}

export async function uploadStudentProfilePhoto(tenantId: string, file: File): Promise<string> {
  return uploadTenantMedia(tenantId, file, "profile");
}

export async function uploadTenantMedia(tenantId: string, file: File, category: "profile" | "receipts" | "maintenance"): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const prepared = await prepareUploadFile(file);
  const path = storageObjectPath(tenantId, category, prepared);
  const { error: uploadError } = await sb.storage.from("tenant-media").upload(path, prepared, {
    cacheControl: "3600",
    upsert: false,
    contentType: contentTypeFor(prepared),
  });
  if (uploadError) {
    console.error("Upload error:", uploadError.message, (uploadError as { statusCode?: string }).statusCode);
    throw new Error(describeStorageError(uploadError));
  }

  const { data } = sb.storage.from("tenant-media").getPublicUrl(path);
  if (category === "profile") {
    const { error: tenantError } = await sb
      .from("tenants")
      .update({ profile_image_url: data.publicUrl })
      .eq("id", tenantId);
    if (tenantError) throw tenantError;
  }
  return data.publicUrl;
}

export async function listVacantBedsForOnboarding(gender: RoomGender): Promise<BedSpace[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("vacant_beds_for_onboarding", { p_gender: gender });
  if (error) throw error;

  return (data ?? []).map((row: {
    id: string;
    block_code: BedSpace["blockCode"];
    room_number: number;
    bed_letter: string;
    room_gender: BillingRecord["room_gender"];
    rent_amount: number;
    status: BedSpace["status"];
    assigned?: boolean;
  }) => ({
    id: row.id,
    blockCode: row.block_code,
    roomNumber: row.room_number,
    bedLetter: row.bed_letter,
    identifier: row.id,
    rentAmount: Number(row.rent_amount),
    status: row.assigned ? "occupied" : "vacant",
    roomGender: row.room_gender,
  }));
}

export async function completeStudentOnboarding(input: {
  gender: BillingRecord["room_gender"];
  bedId: string;
  name: string;
  phone: string;
  nrc?: string;
  moveInDate: string;
}): Promise<Student> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("complete_student_onboarding", {
    p_gender: input.gender,
    p_bed_space_id: input.bedId,
    p_full_name: input.name,
    p_phone: input.phone || "",
    p_nrc: input.nrc ?? "-",
    p_move_in_date: input.moveInDate,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as {
    tenant_id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    nrc: string | null;
    move_in_date: string | null;
    bed_space_id: string;
    gender: BillingRecord["room_gender"] | null;
  } | null;
  if (!row) throw new Error("Onboarding did not return a student record");

  return {
    id: row.tenant_id,
    name: row.full_name,
    phone: row.phone || "-",
    email: row.email || "",
    nrc: row.nrc ?? "-",
    moveInDate: row.move_in_date ?? input.moveInDate,
    gender: row.gender ?? input.gender,
  };
}
