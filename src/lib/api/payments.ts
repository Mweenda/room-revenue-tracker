import { dbFn } from "../../server/dbFn";
import { getSupabase } from "../supabase";
import type { Payment, SubmitPaymentInput } from "../types";
import { mapPayment } from "./mappers";
import { applyPaymentEdit } from "../paymentsEdit";

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

export async function recordManualPayment(input: {
  bedSpaceId: string;
  studentName: string;
  amount: number;
  method: Payment["method"];
  transactionRef?: string;
  submittedAt: string;
}): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero");
  if (!input.bedSpaceId) throw new Error("A bed space is required");

  const submittedAt = input.submittedAt || new Date().toISOString().slice(0, 10);
  const ref = input.transactionRef?.trim() || `CASH-${submittedAt.replace(/-/g, "")}`;

  const { data, error } = await dbFn(sb, "record_manual_payment", {
    p_bed_space_id: input.bedSpaceId,
    p_student_name: input.studentName,
    p_amount: input.amount,
    p_method: input.method,
    p_transaction_ref: ref,
    p_submitted_at: submittedAt,
  });
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row) return mapPayment(row);
  }

  const id = `p-manual-${Date.now()}`;
  const { data: inserted, error: insertError } = await sb
    .from("payments")
    .insert({
      id,
      student_name: input.studentName,
      bed_space_id: input.bedSpaceId,
      amount: input.amount,
      method: input.method,
      transaction_ref: ref,
      submitted_at: submittedAt,
      status: "pending",
    })
    .select("*")
    .single();
  if (insertError) throw error ?? insertError;

  const { data: verified, error: verifyError } = await sb
    .from("payments")
    .update({ status: "verified", rejection_reason: null })
    .eq("id", inserted.id)
    .select("*")
    .single();
  if (verifyError) throw verifyError;
  return mapPayment(verified);
}

export async function verifyPayment(id: string): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await dbFn(sb, "verify_payment", { p_payment_id: id });
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

  const { data, error } = await dbFn(sb, "reject_payment", { p_payment_id: id, p_reason: trimmed });
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

export async function updatePayment(input: {
  id: string;
  studentName: string;
  bedSpaceId: string;
  amount: number;
  method: Payment["method"];
  transactionRef: string;
  submittedAt: string;
}): Promise<Payment> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: existingRow, error: existingError } = await sb
    .from("payments")
    .select("*")
    .eq("id", input.id)
    .single();
  if (existingError) throw existingError;

  const edited = applyPaymentEdit(mapPayment(existingRow), input);

  const { data, error } = await dbFn(sb, "update_payment", {
    p_payment_id: edited.id,
    p_student_name: edited.studentName,
    p_bed_space_id: edited.bedSpaceId,
    p_amount: edited.amount,
    p_method: edited.method,
    p_transaction_ref: edited.transactionRef,
    p_submitted_at: edited.submittedAt,
  });
  if (!error && data) return mapPayment(data);

  const { data: row, error: updateError } = await sb
    .from("payments")
    .update({
      student_name: edited.studentName,
      bed_space_id: edited.bedSpaceId,
      amount: edited.amount,
      method: edited.method,
      transaction_ref: edited.transactionRef,
      submitted_at: edited.submittedAt,
    })
    .eq("id", edited.id)
    .select("*")
    .single();
  if (updateError) throw error ?? updateError;
  return mapPayment(row);
}
