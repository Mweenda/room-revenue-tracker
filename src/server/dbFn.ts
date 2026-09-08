import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The only `.rpc()` wrapper in the app. Feature code talks to tRPC;
 * tRPC procedures call this when a Postgres function is required.
 */
export async function dbFn<T = any>(
  sb: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{
  data: T;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
}> {
  const { data, error } = await sb.rpc(fn, args ?? {});
  return { data: data as T, error };
}
