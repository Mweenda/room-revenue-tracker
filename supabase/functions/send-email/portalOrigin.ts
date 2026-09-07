/** Host used in invite / recovery links. Never trust an arbitrary Origin. */

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function resolvePortalOrigin(
  originHeader: string | null | undefined,
  publicSiteUrl: string | null | undefined,
): string {
  const configured = (publicSiteUrl ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const origin = (originHeader ?? "").trim().replace(/\/$/, "");
  if (LOCAL_ORIGIN.test(origin)) return origin;

  return "http://localhost:5173";
}
