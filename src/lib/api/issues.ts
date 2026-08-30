import { getSupabase } from "../supabase";
import type { IssueStatus, MaintenanceIssue, SubmitIssueInput } from "../types";
import { mapIssue } from "./mappers";

export async function fetchIssues(): Promise<MaintenanceIssue[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("maintenance_issues")
    .select("*")
    .order("reported_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapIssue);
}

export async function submitIssue(input: SubmitIssueInput): Promise<MaintenanceIssue> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const id = `i-${Date.now()}`;
  const { data, error } = await sb
    .from("maintenance_issues")
    .insert({
      id,
      bed_space_id: input.bedSpaceId,
      student_name: input.studentName,
      category: input.category,
      description: input.description,
      reported_date: new Date().toISOString().slice(0, 10),
      status: "open",
      image_url: input.imageUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapIssue(data);
}

export async function updateIssueStatus(
  id: string,
  status: IssueStatus,
  resolutionNote?: string,
): Promise<MaintenanceIssue> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb
    .from("maintenance_issues")
    .update({
      status,
      resolution_note: resolutionNote ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapIssue(data);
}
