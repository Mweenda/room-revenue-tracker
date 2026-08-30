import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// `import.meta.env` only exists under Vite. Fall back so the module can be
// imported by the Node test runner without crashing at load time.
const viteEnv: Record<string, string | undefined> =
  (typeof import.meta !== "undefined" && (import.meta as any).env) ||
  (globalThis as any).__vite_env__ ||
  {};

const rawUrl = viteEnv.VITE_SUPABASE_URL;
const rawAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

const url = rawUrl?.trim();
const anonKey = rawAnonKey?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabaseConfig() {
  return {
    url,
    anonKey,
    isConfigured: isSupabaseConfigured,
  };
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return sb;
}
