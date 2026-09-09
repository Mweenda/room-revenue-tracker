import { applyOccupancyAdminEdit, type OccupancyAdminEditInput } from "../occupancyBillingEdit";
import { getSupabase } from "../supabase";
import type { BedSpace, BillingRecord } from "../types";
import { mapBilling, mapPayment } from "./mappers";
import { updatePayment } from "./payments";
import { updateStudent } from "./tenants";

export async function saveOccupancyAdmin(input: OccupancyAdminEditInput) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  await updateStudent({
    tenantId: input.tenantId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    moveInDate: input.moveInDate,
    gender: input.gender,
  });

  const { data: billingRow, error: billingError } = await sb
    .from("billing_records")
    .select("*")
    .eq("billing_id", input.bedId)
    .single();
  if (billingError) throw billingError;

  const { data: paymentRows, error: paymentError } = await sb
    .from("payments")
    .select("*")
    .eq("bed_space_id", input.bedId);
  if (paymentError) throw paymentError;

  const billing = mapBilling(billingRow);
  const bed: BedSpace = {
    id: input.bedId,
    blockCode: billing.house_block,
    roomNumber: Number(billing.room_number),
    bedLetter: billing.bed_space,
    identifier: input.bedId,
    status: "occupied",
    rentAmount: billing.current_rent,
    roomGender: billing.room_gender,
    student: {
      id: input.tenantId,
      name: input.name,
      phone: input.phone,
      nrc: "",
      email: input.email,
      moveInDate: input.moveInDate,
      gender: input.gender,
    },
  };

  const next = applyOccupancyAdminEdit(
    [bed],
    [billing],
    (paymentRows ?? []).map(mapPayment),
    input,
  );
  const patched = next.billingRecords[0] as BillingRecord;

  const { error: billingUpdateError } = await sb
    .from("billing_records")
    .update({
      tenant_name: patched.tenant_name,
      phone_number: patched.phone_number || null,
      entry_date: patched.entry_date || null,
      current_rent: patched.current_rent,
      total_balance: patched.total_balance,
      target_month: patched.target_month,
      days_past_due: patched.days_past_due,
    })
    .eq("billing_id", input.bedId);
  if (billingUpdateError) throw billingUpdateError;

  const { error: rentError } = await sb
    .from("bed_spaces")
    .update({ rent_amount: patched.current_rent })
    .eq("id", input.bedId);
  if (rentError) throw rentError;

  if (next.paymentAction === "update" && next.payment) {
    await updatePayment({
      id: next.payment.id,
      studentName: next.payment.studentName,
      bedSpaceId: next.payment.bedSpaceId,
      amount: next.payment.amount,
      method: next.payment.method,
      transactionRef: next.payment.transactionRef,
      submittedAt: next.payment.submittedAt,
    });
  }

  if (next.paymentAction === "insert" && next.payment) {
    const { error: insertError } = await sb.from("payments").insert({
      id: next.payment.id,
      student_name: next.payment.studentName,
      bed_space_id: next.payment.bedSpaceId,
      amount: next.payment.amount,
      method: next.payment.method,
      transaction_ref: next.payment.transactionRef,
      submitted_at: next.payment.submittedAt,
      status: "verified",
    });
    if (insertError) throw insertError;
  }

  return {
    paymentAction: next.paymentAction,
    payment: next.payment,
    billing: patched,
  };
}
