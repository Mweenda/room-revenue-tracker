import type { SupabaseClient } from "@supabase/supabase-js";
import { mapBed, mapBilling, mapPayment } from "../api/mappers";
import { dbFn } from "../../server/dbFn";
import type { SpreadsheetRepository, SpreadsheetUploadLog } from "./types";

const SPREADSHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const PAYMENTS_SPREADSHEET_BUCKET = "payments-spreadsheets";

export function createSpreadsheetRepo(sb: SupabaseClient): SpreadsheetRepository {
  return {
    async getLandlordId() {
      const { data, error } = await dbFn<string | null>(sb, "current_landlord_id");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    async listPayments() {
      const { data, error } = await sb.from("payments").select("*").order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPayment);
    },
    async listBilling() {
      const { data, error } = await sb.from("billing_records").select("*");
      if (error) throw error;
      return (data ?? []).map(mapBilling);
    },
    async listBeds() {
      const { data, error } = await sb
        .from("bed_spaces")
        .select("*")
        .order("block_code")
        .order("room_number")
        .order("bed_letter");
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const { data: tenants, error: tenantsError } = await sb
        .from("tenants")
        .select("*")
        .eq("status", "active")
        .in("bed_space_id", rows.map((row) => row.id));
      if (tenantsError) throw tenantsError;
      const tenantsByBed = new Map<string, NonNullable<typeof tenants>>();
      for (const tenant of tenants ?? []) {
        const existing = tenantsByBed.get(tenant.bed_space_id) ?? [];
        existing.push(tenant);
        tenantsByBed.set(tenant.bed_space_id, existing);
      }
      return rows.map((row) => mapBed({
        ...row,
        tenants: tenantsByBed.get(row.id) ?? [],
      }));
    },
    async upsertPayments(rows) {
      if (rows.length === 0) return 0;
      const { error } = await sb.from("payments").insert(
        rows.map((row) => ({
          id: row.id,
          student_name: row.studentName,
          bed_space_id: row.bedSpaceId,
          amount: row.amount,
          method: row.method,
          transaction_ref: row.transactionRef,
          submitted_at: row.submittedAt,
          status: row.status,
        })),
      );
      if (error) throw error;
      return rows.length;
    },
    async updateBilling(patches) {
      let count = 0;
      for (const patch of patches) {
        const { error } = await sb
          .from("billing_records")
          .update({
            tenant_name: patch.tenant_name,
            phone_number: patch.phone_number,
            current_rent: patch.current_rent,
            entry_date: patch.entry_date,
            target_month: patch.target_month,
            accumulated_total: patch.accumulated_total,
            total_balance: patch.total_balance,
          })
          .eq("billing_id", patch.billing_id);
        if (error) throw error;
        count += 1;
      }
      return count;
    },
    async updateBeds(patches) {
      let count = 0;
      for (const patch of patches) {
        const { error } = await sb
          .from("bed_spaces")
          .update({
            rent_amount: patch.rentAmount,
            room_gender: patch.roomGender,
          })
          .eq("id", patch.id);
        if (error) throw error;
        count += 1;
      }
      return count;
    },
    async uploadFile(path, bytes, contentType) {
      const { error } = await sb.storage.from(PAYMENTS_SPREADSHEET_BUCKET).upload(path, bytes, {
        contentType: contentType || SPREADSHEET_MIME,
        upsert: true,
      });
      if (error) throw error;
    },
    async logUpload(row: SpreadsheetUploadLog) {
      const { error } = await sb.from("spreadsheet_uploads").insert({
        storage_path: row.storagePath,
        filename: row.filename,
        payments_upserted: row.paymentsUpserted,
        payments_skipped: row.paymentsSkipped,
        roster_updated: row.rosterUpdated,
        billing_updated: row.billingUpdated,
      });
      if (error && !/spreadsheet_uploads|schema cache|does not exist/i.test(error.message)) {
        throw error;
      }
    },
  };
}
