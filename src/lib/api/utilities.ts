import { getSupabase } from "../supabase";
import type { BlockCode, UtilityBlock } from "../types";
import { mapUtility } from "./mappers";

export async function fetchUtilities(): Promise<UtilityBlock[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("utility_entries")
    .select("*")
    .order("month", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapUtility);
}

export async function upsertUtility(entry: UtilityBlock): Promise<UtilityBlock> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("utility_entries")
    .upsert(
      {
        block_code: entry.blockCode,
        month: entry.month,
        total_cost: entry.totalCost,
        active_students: entry.activeStudents,
        owner_contribution: entry.ownerContribution,
        excess: entry.excess,
        students_settled: entry.studentsSettled,
      },
      { onConflict: "block_code,month" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapUtility(data);
}

export async function toggleUtilitySettled(
  blockCode: BlockCode,
  month: string,
  studentName: string,
): Promise<UtilityBlock> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: existing, error: fetchErr } = await sb
    .from("utility_entries")
    .select("*")
    .eq("block_code", blockCode)
    .eq("month", month)
    .single();
  if (fetchErr) throw fetchErr;

  const settled: string[] = existing.students_settled ?? [];
  const next = settled.includes(studentName)
    ? settled.filter((s) => s !== studentName)
    : [...settled, studentName];

  const { data, error } = await sb
    .from("utility_entries")
    .update({ students_settled: next })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapUtility(data);
}
