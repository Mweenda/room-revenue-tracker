import { dbFn } from "../../server/dbFn";
import { inviteStudentToPortal } from "../invite";
import { getSupabase } from "../supabase";
import type {
  RoomGender,
  StudentApplication,
  StudentApplicationStatus,
  SubmitStudentApplicationInput,
} from "../types";

type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  nrc: string | null;
  gender: RoomGender | null;
  preferred_move_in_date: string | null;
  note: string | null;
  status: StudentApplicationStatus;
  review_note: string | null;
  assigned_bed_space_id: string | null;
  created_tenant_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function mapApplication(row: ApplicationRow): StudentApplication {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    nrc: row.nrc,
    gender: row.gender,
    preferredMoveInDate: row.preferred_move_in_date,
    note: row.note,
    status: row.status,
    reviewNote: row.review_note,
    assignedBedSpaceId: row.assigned_bed_space_id,
    createdTenantId: row.created_tenant_id,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/** Public self-onboarding: create (or refresh) a pending bed-space request. */
export async function submitStudentApplication(
  input: SubmitStudentApplicationInput,
): Promise<StudentApplication> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn<ApplicationRow>(sb, "submit_student_application", {
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_nrc: input.nrc ?? null,
    p_gender: input.gender ?? null,
    p_preferred_move_in_date: input.preferredMoveInDate ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return mapApplication(data as ApplicationRow);
}

/** Landlord / admin: list applications, newest pending first. */
export async function listStudentApplications(
  status?: StudentApplicationStatus,
): Promise<StudentApplication[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn<ApplicationRow[]>(sb, "list_student_applications", {
    p_status: status ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapApplication);
}

export interface ApproveApplicationResult {
  tenantId: string;
  bedSpaceId: string;
  fullName: string;
  email: string;
  inviteSent: boolean;
}

/** Landlord: assign a vacant bed, onboard the student, and email a password invite. */
export async function approveStudentApplication(input: {
  applicationId: string;
  bedId: string;
  rentAmount?: number | null;
  moveInDate?: string | null;
}): Promise<ApproveApplicationResult> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn<
    Array<{ tenant_id: string; bed_space_id: string; full_name: string; email: string }> |
      { tenant_id: string; bed_space_id: string; full_name: string; email: string }
  >(sb, "approve_student_application", {
    p_application_id: input.applicationId,
    p_bed_space_id: input.bedId,
    p_rent_amount: input.rentAmount ?? null,
    p_move_in_date: input.moveInDate ?? null,
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Approval did not return a student record");

  let inviteSent = false;
  try {
    const result = await inviteStudentToPortal(row.email, row.full_name);
    inviteSent = result.success;
  } catch {
    inviteSent = false;
  }

  return {
    tenantId: row.tenant_id,
    bedSpaceId: row.bed_space_id,
    fullName: row.full_name,
    email: row.email,
    inviteSent,
  };
}

/** Landlord: decline an application with a reason. */
export async function rejectStudentApplication(input: {
  applicationId: string;
  reason: string;
}): Promise<StudentApplication> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn<ApplicationRow>(sb, "reject_student_application", {
    p_application_id: input.applicationId,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  const mapped = mapApplication(data as ApplicationRow);

  try {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    await sb.functions.invoke("send-email", {
      body: {
        type: "application_rejected",
        applicationId: mapped.id,
        details: { reason: input.reason },
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // The application is already rejected; email is best-effort.
  }

  return mapped;
}
