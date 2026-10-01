/**
 * Shared provisioning rules for the admin Edge Function.
 *
 * createUser failing with "already registered" is not permission to reset that
 * password. Bootstrap may overwrite the RRT admin account it owns; landlord
 * onboard must not hijack a student, admin, or existing landlord.
 */

export function alreadyRegistered(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("already") && (text.includes("registered") || text.includes("exist"));
}

export type ExistingAuthUserAction = "reuse" | "conflict";

export function existingAuthUserAction(allowOverwrite: boolean): ExistingAuthUserAction {
  return allowOverwrite ? "reuse" : "conflict";
}

/** Refuse to change an existing profile into a different role (e.g. admin → landlord). */
export function profileRoleConflict(
  existingRole: string | null | undefined,
  desiredRole: string,
): boolean {
  return Boolean(existingRole && existingRole !== desiredRole);
}
