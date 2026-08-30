import { getSupabase } from "../supabase";
import type { FinancialReport } from "../export/financialWorkbook";
import type { BillingMonth } from "../billing";

export async function persistFinancialSnapshot(input: {
  month: BillingMonth;
  year: number;
  report: FinancialReport;
  actor?: string | null;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb.from("financial_snapshots").insert({
    period_month: input.month,
    period_year: input.year,
    title: input.report.title,
    summary: input.report.summary,
    payload: {
      periodLabel: input.report.periodLabel,
      generatedAt: input.report.generatedAt,
      sheets: input.report.sheets,
    },
    actor_email: input.actor ?? null,
  });

  // Table may not exist until migration 007 is applied; export still succeeds.
  if (error && !/financial_snapshots|schema cache|does not exist/i.test(error.message)) {
    throw error;
  }
}
