import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpreadsheetRepository } from "../lib/spreadsheet/types";

export type AppContext = {
  supabase: SupabaseClient | null;
  landlordId: string | null;
  tenantId: string | null;
  isAdmin: boolean;
  repo: SpreadsheetRepository;
};
