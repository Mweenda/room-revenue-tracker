// Firebase SPA ↔ Supabase bridge.
//
// Primary live path is Postgres Changes on the tracker tables. This function is
// the authenticated fallback: REST GET for a timely snapshot, and MCP JSON-RPC
// (initialize / tools/list / tools/call) for the same payload.
//
// Authorization: `auth: 'user'` — the handler uses the caller's JWT and RLS.
// verify_jwt is disabled so OPTIONS preflight can return CORS headers.

const SNAPSHOT_TABLES = [
  "bed_spaces",
  "tenants",
  "billing_records",
  "payments",
  "maintenance_issues",
  "utility_entries",
  "student_applications",
] as const;

const MCP_PROTOCOL_VERSION = "2024-11-05";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function withCors(response: Response): Response {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    next.headers.set(key, value);
  }
  return next;
}

type UserClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options: { count: "exact"; head: boolean },
    ) => Promise<{ count: number | null; error: { message: string } | null }>;
  };
};

async function createUserClient(request: Request): Promise<
  | { data: UserClient; error: null }
  | { data: null; error: { message: string; code?: string; status: number } }
> {
  const { createContextClient, verifyAuth } = await import("npm:@supabase/server/core");
  const { data: auth, error } = await verifyAuth(request, { auth: "user" });
  if (error) return { data: null, error };
  try {
    return {
      data: createContextClient({
        auth: { token: auth.token, keyName: auth.keyName },
      }) as UserClient,
      error: null,
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not create Supabase client";
    return { data: null, error: { message, status: 500 } };
  }
}

async function loadSnapshot(supabase: UserClient) {
  const counts: Record<string, number> = {};
  await Promise.all(
    SNAPSHOT_TABLES.map(async (table) => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      counts[table] = error ? -1 : (count ?? 0);
    }),
  );
  return {
    ok: true as const,
    transport: "rest" as const,
    generatedAt: new Date().toISOString(),
    counts,
  };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

function snapshotTool() {
  return {
    name: "get_tracker_snapshot",
    description:
      "Return RLS-scoped row counts for tracker tables so the Firebase frontend can refresh immediately when realtime is unavailable.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  };
}

async function handleMcp(request: Request, supabase: UserClient): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  const id = (body as { id?: unknown }).id;
  const method = (body as { method?: unknown }).method;
  if (typeof method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request", 400);
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "rrt-mcp-bridge", version: "1.0.0" },
    });
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: [snapshotTool()] });
  }

  if (method === "tools/call") {
    const name = (body as { params?: { name?: unknown } }).params?.name;
    if (name !== "get_tracker_snapshot") {
      return jsonRpcError(id, -32601, "Unknown tool");
    }
    const snapshot = await loadSnapshot(supabase);
    return jsonRpcResult(id, {
      content: [{ type: "text", text: JSON.stringify({ ...snapshot, transport: "mcp" }) }],
    });
  }

  return jsonRpcError(id, -32601, "Method not found");
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
    }

    const { data: supabase, error } = await createUserClient(req);
    if (error) {
      return withCors(
        Response.json({ error: error.message, code: error.code }, { status: error.status }),
      );
    }

    if (req.method === "GET") {
      return withCors(Response.json(await loadSnapshot(supabase)));
    }

    return withCors(await handleMcp(req, supabase));
  },
};
