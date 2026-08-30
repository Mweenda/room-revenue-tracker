/**
 * Landlord gating in the browser.
 *
 * These checks hide controls and stop honest mistakes. The security boundary is
 * the database: each property row belongs to a landlord profile (migration 010),
 * and RLS plus privileged RPCs refuse any other landlord's data.
 */

/** Shapes returned by `landlordLogin` (role: 'Property Owner') and `profiles`. */
const LANDLORD_ROLES = new Set(["property owner", "landlord", "owner", "admin"]);

export type MaybeUser = { role?: unknown; email?: unknown } | null | undefined;

export function isLandlord(user: MaybeUser): boolean {
  const role = user?.role;
  if (typeof role !== "string") return false;
  return LANDLORD_ROLES.has(role.trim().toLowerCase());
}

/** Throws unless the user is a landlord. Use inside write helpers. */
export function assertLandlord(user: MaybeUser, action = "perform this action"): void {
  if (!isLandlord(user)) {
    throw new Error(`You do not have permission to ${action}. Sign in as the landlord and try again.`);
  }
}

export function actorEmail(user: MaybeUser): string | null {
  const email = user?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}
