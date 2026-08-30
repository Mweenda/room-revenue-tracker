import { getSupabase } from "../supabase";
import type { Payment, SubmitPaymentInput } from "../types";
import { mapPayment } from "./mappers";

export async function fetchPayments(): Promise<Payment[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("payments")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function submitPayment(input: SubmitPaymentInput): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const id = `p-${Date.now()}`;
  const { data, error } = await sb
    .from("payments")
    .insert({
      id,
      student_name: input.studentName,
      bed_space_id: input.bedSpaceId,
      amount: input.amount,
      method: input.method,
      transaction_ref: input.transactionRef,
      submitted_at: new Date().toISOString().slice(0, 10),
      status: "pending",
      proof_url: input.proofUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapPayment(data);
}

export async function verifyPayment(id: string): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("verify_payment", { p_payment_id: id });
  if (!error && data) return mapPayment(data);

  // Fallback until migration 007 is applied.
  const { data: row, error: updateError } = await sb
    .from("payments")
    .update({ status: "verified", rejection_reason: null })
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) throw error ?? updateError;
  return mapPayment(row);
}

export async function rejectPayment(id: string, reason: string): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A rejection reason is required");

  const { data, error } = await sb.rpc("reject_payment", { p_payment_id: id, p_reason: trimmed });
  if (!error && data) return mapPayment(data);

  const { data: row, error: updateError } = await sb
    .from("payments")
    .update({ status: "rejected", rejection_reason: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) throw error ?? updateError;
  return mapPayment(row);
}
