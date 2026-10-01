import { getSupabase } from "./supabase";
import { normalizeEmail } from "./email";

/**
 * Sends the student a portal invite after a tenant row exists for the email.
 * Kept out of `auth.ts` so API modules can call it without an auth ↔ tRPC cycle.
 */
export async function inviteStudentToPortal(
  email: string,
  _name: string,
): Promise<{ success: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: false, message: "Database not configured, so no invite can be sent." };
  }

  const normalized = normalizeEmail(email);
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("id, bed_space_id")
    .eq("email", normalized)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!tenant) {
    return {
      success: false,
      message: "No tenant profile exists for this email. The landlord must assign the bed space first.",
    };
  }

  try {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data, error: invokeError } = await sb.functions.invoke("send-email", {
      body: { type: "welcome", tenantId: tenant.id, details: { bedSpace: tenant.bed_space_id } },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (invokeError) throw invokeError;
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
      throw new Error((data as { error: string }).error);
    }
    return {
      success: true,
      message: "Invite sent. The student can create a password from the email and will land in their portal.",
    };
  } catch {
    return { success: false, message: "The tenant was saved, but the invite email could not be sent." };
  }
}
