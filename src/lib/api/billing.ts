import { getSupabase } from "../supabase";
import type { BillingRecord } from "../types";
import { mapBilling } from "./mappers";

export async function fetchBillingRecords(): Promise<BillingRecord[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("billing_records")
    .select("*")
    .order("house_block")
    .order("room_number")
    .order("bed_space");

  if (error) throw error;
  return (data ?? []).map(mapBilling);
}