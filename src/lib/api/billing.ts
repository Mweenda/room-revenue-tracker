import { getSupabase } from "../supabase";
import type { BillingRecord } from "../types";
import { mapBilling } from "./mappers";
import { refreshBillingRecords } from "../billing";
import { rollBillingRecords } from "../paymentTracking";

export async function fetchBillingRecords(): Promise<BillingRecord[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  try {
    await sb.rpc("roll_billing_cycle");
  } catch {
    // RPC ships with migration 018; the client still rolls the fetched snapshot.
  }

  try {
    await sb.rpc("sync_billing_due_dates");
  } catch {
    // RPC ships with migration 017; client refresh still labels overdue correctly.
  }

  const { data, error } = await sb
    .from("billing_records")
    .select("*")
    .order("house_block")
    .order("room_number")
    .order("bed_space");

  if (error) throw error;
  return refreshBillingRecords(rollBillingRecords((data ?? []).map(mapBilling)));
}