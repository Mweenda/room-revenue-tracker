import { getCurrentBillingMonth } from "../billing";
import { getSupabase } from "../supabase";
import { inviteStudentToPortal, normalizeEmail } from "../auth";
import { findTenantByEmail, findTenantOnBed, reconcileBedSpace } from "./occupancy";
import type { BedSpace, BillingRecord, OnboardStudentInput, Student } from "../types";

export async function onboardStudent(input: OnboardStudentInput): Promise<{
  bed: BedSpace;
  billing: BillingRecord;
  student: Student;
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const moveIn = input.moveInDate || new Date().toISOString().slice(0, 10);

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
    })
    .select("*")
    .single();
  if (tenantErr) throw tenantErr;

  const { data: billing, error: billErr } = await sb
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
  if (billErr) throw billErr;

  const { error: updateBedErr } = await sb
    .from("bed_spaces")
    .update({ status: "occupied" })
    .eq("id", input.bedId);
  if (updateBedErr) throw updateBedErr;

  const student: Student = {
    id: tenant.id,
    name: tenant.full_name,
    phone: tenant.phone || "-",
    email: tenant.email || "-",
    nrc: tenant.nrc,
    moveInDate: tenant.move_in_date,
  };

  const bed: BedSpace = {
    id: bedRow.id,
    blockCode: bedRow.block_code,
    roomNumber: bedRow.room_number,
    bedLetter: bedRow.bed_letter,
    identifier: `${bedRow.block_code}-${bedRow.room_number}-${bedRow.bed_letter}`,
    rentAmount: rent,
    status: "occupied",
    student,
  };

  const billingRecord: BillingRecord = {
    billing_id: billing.billing_id,
    house_block: billing.house_block,
    room_number: billing.room_number,
    bed_space: billing.bed_space,
    room_gender: billing.room_gender,
    tenant_name: billing.tenant_name,
    phone_number: billing.phone_number,
    entry_date: billing.entry_date,
    current_rent: Number(billing.current_rent),
    target_month: billing.target_month,
    accumulated_total: Number(billing.accumulated_total),
    total_balance: Number(billing.total_balance),
    days_past_due: billing.days_past_due,
    billing_status: billing.billing_status,
  };

  return { bed, billing: billingRecord, student };
}

export async function updateStudent(input: {
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  moveInDate: string;
  nrc?: string;
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

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${tenantId}/${category}-${Date.now()}.${extension}`;
  const { error: uploadError } = await sb.storage.from("tenant-media").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

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
