import { getSupabaseConfig } from "./supabase";

/** Edge Function that speaks MCP JSON-RPC and a REST snapshot fallback. */
export const MCP_BRIDGE_FUNCTION = "mcp-bridge";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export const REST_REQUEST_TIMEOUT_MS = 8_000;

export const TRACKER_SYNC_TABLES = [
  "bed_spaces",
  "tenants",
  "billing_records",
  "payments",
  "maintenance_issues",
  "utility_entries",
  "student_applications",
] as const;

export type TrackerSyncTable = (typeof TRACKER_SYNC_TABLES)[number];

export type TrackerBridgeSnapshot = {
  ok: true;
  transport: "rest" | "mcp";
  generatedAt: string;
  counts: Record<string, number>;
};

export function mcpBridgeUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${MCP_BRIDGE_FUNCTION}`;
}

export function mcpInitializeBody(id: number | string) {
  return {
    jsonrpc: "2.0" as const,
    id,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "rrt-web", version: "1.0.0" },
    },
  };
}

export function mcpToolsCallBody(id: number | string, name: string, args: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0" as const,
    id,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

export function parseMcpToolText(payload: unknown): TrackerBridgeSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const result = (payload as { result?: { content?: Array<{ type?: string; text?: string }> } }).result;
  const text = result?.content?.find((part) => part.type === "text")?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as TrackerBridgeSnapshot;
    if (parsed?.ok !== true || typeof parsed.generatedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isTrackerBridgeSnapshot(value: unknown): value is TrackerBridgeSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as TrackerBridgeSnapshot;
  return row.ok === true && typeof row.generatedAt === "string" && row.counts != null && typeof row.counts === "object";
}

type FetchLike = typeof fetch;

async function withTimeout(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function bridgeHeaders(accessToken: string, anonKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  };
}

export async function fetchRestSnapshot(input: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<TrackerBridgeSnapshot> {
  const timeoutMs = input.timeoutMs ?? REST_REQUEST_TIMEOUT_MS;
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await withTimeout(timeoutMs, (signal) =>
    fetchImpl(mcpBridgeUrl(input.supabaseUrl), {
      method: "GET",
      headers: bridgeHeaders(input.accessToken, input.anonKey),
      signal,
    }),
  );
  if (!response.ok) {
    throw new Error(`REST snapshot failed (${response.status})`);
  }
  const body = await response.json();
  if (!isTrackerBridgeSnapshot(body)) {
    throw new Error("REST snapshot was malformed");
  }
  return { ...body, transport: "rest" };
}

export async function fetchMcpSnapshot(input: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<TrackerBridgeSnapshot> {
  const timeoutMs = input.timeoutMs ?? REST_REQUEST_TIMEOUT_MS;
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await withTimeout(timeoutMs, (signal) =>
    fetchImpl(mcpBridgeUrl(input.supabaseUrl), {
      method: "POST",
      headers: bridgeHeaders(input.accessToken, input.anonKey),
      body: JSON.stringify(mcpToolsCallBody(1, "get_tracker_snapshot")),
      signal,
    }),
  );
  if (!response.ok) {
    throw new Error(`MCP snapshot failed (${response.status})`);
  }
  const parsed = parseMcpToolText(await response.json());
  if (!parsed) throw new Error("MCP snapshot was malformed");
  return { ...parsed, transport: "mcp" };
}

/**
 * REST first, MCP JSON-RPC if GET is unavailable. Both must finish within the
 * timeout so the Firebase SPA never waits on a hung Edge Function.
 */
export async function fetchTrackerFallback(input: {
  supabaseUrl?: string;
  anonKey?: string;
  getAccessToken: () => Promise<string | null>;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<{ ok: boolean; transport?: "rest" | "mcp" }> {
  const config = getSupabaseConfig();
  const supabaseUrl = input.supabaseUrl ?? config.url;
  const anonKey = input.anonKey ?? config.anonKey;
  if (!supabaseUrl || !anonKey) return { ok: false };

  const accessToken = await input.getAccessToken();
  if (!accessToken) return { ok: false };

  const shared = {
    supabaseUrl,
    anonKey,
    accessToken,
    timeoutMs: input.timeoutMs,
    fetchImpl: input.fetchImpl,
  };

  try {
    const snapshot = await fetchRestSnapshot(shared);
    return { ok: true, transport: snapshot.transport };
  } catch {
    try {
      const snapshot = await fetchMcpSnapshot(shared);
      return { ok: true, transport: snapshot.transport };
    } catch {
      return { ok: false };
    }
  }
}
