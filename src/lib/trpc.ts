import { getSupabase, requireSupabase } from "./supabase";
import { createSpreadsheetRepo } from "./spreadsheet/repo";
import { appRouter } from "../server/root";
import { dbFn } from "../server/dbFn";
import type { AppContext } from "../server/context";
import type { AppRouter } from "../server/root";

type Caller = ReturnType<typeof appRouter.createCaller>;

let inflight: Promise<Caller> | null = null;
let cached: { userId: string; caller: Caller; expires: number } | null = null;
const CACHE_MS = 15_000;

async function buildContext(): Promise<AppContext> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  const [landlord, tenant, admin] = auth.user
    ? await Promise.all([
        dbFn<string | null>(sb, "current_landlord_id"),
        dbFn<string | null>(sb, "current_tenant_id"),
        dbFn<boolean>(sb, "is_admin"),
      ])
    : [
        { data: null as string | null, error: null },
        { data: null as string | null, error: null },
        { data: false, error: null },
      ];

  const landlordId = landlord.error ? null : landlord.data;
  return {
    supabase: sb,
    landlordId,
    tenantId: tenant.error ? null : tenant.data,
    isAdmin: admin.error ? false : admin.data === true,
    repo: createSpreadsheetRepo(sb),
  };
}

export async function createAppCaller() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured");
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id ?? "anon";
  if (cached && cached.userId === userId && cached.expires > Date.now()) {
    return cached.caller;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const caller = appRouter.createCaller(await buildContext());
    cached = { userId, caller, expires: Date.now() + CACHE_MS };
    return caller;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** @deprecated Use createAppCaller — kept so spreadsheet UI can share the same client. */
export async function createLandlordCaller() {
  return createAppCaller();
}

export function invalidateAppCaller() {
  cached = null;
  inflight = null;
}

export async function downloadBlobFromBase64(fileBase64: string, filename: string, mime: string) {
  const binary = atob(fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type { AppRouter };
