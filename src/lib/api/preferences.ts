import { getSupabase } from "../supabase";
import type { WhatsAppClient } from "../whatsapp";

export type PreferenceColorMode = "light" | "dark";

export type UserPreferences = {
  userId: string;
  whatsappClient: WhatsAppClient;
  colorMode: PreferenceColorMode | null;
  welcomeAdSeenAt: string | null;
  updatedAt: string;
};

type PreferenceRow = {
  user_id: string;
  whatsapp_client: string;
  color_mode: string | null;
  welcome_ad_seen_at: string | null;
  updated_at: string;
};

function asWhatsAppClient(value: string | null | undefined): WhatsAppClient {
  return value === "app" || value === "web" || value === "auto" ? value : "auto";
}

function asColorMode(value: string | null | undefined): PreferenceColorMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export function mapUserPreferences(row: PreferenceRow): UserPreferences {
  return {
    userId: row.user_id,
    whatsappClient: asWhatsAppClient(row.whatsapp_client),
    colorMode: asColorMode(row.color_mode),
    welcomeAdSeenAt: row.welcome_ad_seen_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchUserPreferences(): Promise<UserPreferences | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in is required");

  const { data, error } = await sb
    .from("user_preferences")
    .select("user_id, whatsapp_client, color_mode, welcome_ad_seen_at, updated_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapUserPreferences(data as PreferenceRow) : null;
}

export async function upsertUserPreferences(input: {
  whatsappClient?: WhatsAppClient;
  colorMode?: PreferenceColorMode | null;
  welcomeAdSeenAt?: string | null;
}): Promise<UserPreferences> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in is required");

  const patch: Record<string, unknown> = { user_id: authData.user.id };
  if (input.whatsappClient !== undefined) patch.whatsapp_client = input.whatsappClient;
  if (input.colorMode !== undefined) patch.color_mode = input.colorMode;
  if (input.welcomeAdSeenAt !== undefined) patch.welcome_ad_seen_at = input.welcomeAdSeenAt;

  const { data, error } = await sb
    .from("user_preferences")
    .upsert(patch, { onConflict: "user_id" })
    .select("user_id, whatsapp_client, color_mode, welcome_ad_seen_at, updated_at")
    .single();
  if (error) throw error;
  return mapUserPreferences(data as PreferenceRow);
}
