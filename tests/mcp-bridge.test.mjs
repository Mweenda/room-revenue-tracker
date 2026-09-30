import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

globalThis.__vite_env__ = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon-test",
};

const bridge = await import("../src/lib/mcpBridge.ts");
const sync = await import("../src/lib/trackerSync.ts");

test("MCP bridge URL points at the Edge Function REST fallback", () => {
  assert.equal(
    bridge.mcpBridgeUrl("https://example.supabase.co/"),
    "https://example.supabase.co/functions/v1/mcp-bridge",
  );
});

test("MCP JSON-RPC initialize and tools/call payloads are well-formed", () => {
  const init = bridge.mcpInitializeBody(1);
  assert.equal(init.jsonrpc, "2.0");
  assert.equal(init.method, "initialize");
  assert.equal(init.params.protocolVersion, bridge.MCP_PROTOCOL_VERSION);

  const call = bridge.mcpToolsCallBody(7, "get_tracker_snapshot");
  assert.equal(call.method, "tools/call");
  assert.equal(call.params.name, "get_tracker_snapshot");
});

test("MCP tool text unwraps the tracker snapshot", () => {
  const snapshot = {
    ok: true,
    transport: "mcp",
    generatedAt: "2026-09-30T00:00:00.000Z",
    counts: { payments: 3 },
  };
  const parsed = bridge.parseMcpToolText({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: JSON.stringify(snapshot) }] },
  });
  assert.deepEqual(parsed, snapshot);
  assert.equal(bridge.parseMcpToolText({ result: {} }), null);
});

test("REST fallback is used before MCP POST, and both honor the timeout", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method });
    if (init.method === "GET") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          transport: "rest",
          generatedAt: "2026-09-30T00:00:00.000Z",
          counts: { payments: 1 },
        }),
      };
    }
    throw new Error("MCP should not run when REST succeeds");
  };

  const result = await bridge.fetchTrackerFallback({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test",
    getAccessToken: async () => "jwt-test",
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true, transport: "rest" });
  assert.deepEqual(calls, [{ url: "https://example.supabase.co/functions/v1/mcp-bridge", method: "GET" }]);
});

test("MCP JSON-RPC is the fallback when REST GET fails", async () => {
  const snapshot = {
    ok: true,
    transport: "mcp",
    generatedAt: "2026-09-30T00:00:00.000Z",
    counts: { tenants: 8 },
  };
  const fetchImpl = async (_url, init) => {
    if (init.method === "GET") {
      return { ok: false, status: 503, json: async () => ({ error: "down" }) };
    }
    return {
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: JSON.stringify(snapshot) }] },
      }),
    };
  };

  const result = await bridge.fetchTrackerFallback({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test",
    getAccessToken: async () => "jwt-test",
    fetchImpl,
  });
  assert.deepEqual(result, { ok: true, transport: "mcp" });
});

test("hung REST/MCP calls abort instead of blocking the UI", async () => {
  const fetchImpl = (_url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });

  const started = Date.now();
  const result = await bridge.fetchTrackerFallback({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test",
    getAccessToken: async () => "jwt-test",
    timeoutMs: 20,
    fetchImpl,
  });
  assert.equal(result.ok, false);
  assert.ok(Date.now() - started < 500);
});

test("realtime events debounce into one instant refresh and skip REST", async () => {
  const reasons = [];
  let onTable;
  let onStatus;
  const fallbackCalls = [];

  const created = sync.createTrackerSync({
    subscribeTimeoutMs: 50,
    pollIntervalMs: 20,
    debounceMs: 15,
    subscribeRealtime: (tableHandler, statusHandler) => {
      onTable = tableHandler;
      onStatus = statusHandler;
      return () => {};
    },
    fetchFallback: async () => {
      fallbackCalls.push(1);
      return { ok: true };
    },
    onRefresh: (reason) => reasons.push(reason),
  });

  onStatus("SUBSCRIBED");
  onTable("payments");
  onTable("billing_records");
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.deepEqual(reasons, ["realtime"]);
  assert.equal(fallbackCalls.length, 0);
  assert.equal(created.transport(), "realtime");
  created.stop();
});

test("realtime timeout falls back to REST polling so the UI still updates", async () => {
  const reasons = [];
  const created = sync.createTrackerSync({
    subscribeTimeoutMs: 15,
    pollIntervalMs: 30,
    debounceMs: 1,
    subscribeRealtime: () => () => {},
    fetchFallback: async () => ({ ok: true }),
    onRefresh: (reason) => reasons.push(reason),
  });

  await new Promise((resolve) => setTimeout(resolve, 55));
  created.stop();

  assert.ok(reasons.includes("rest"));
  assert.ok(reasons.length >= 1);
});

test("edge function snapshot tables stay aligned with the web client", () => {
  const fn = readFileSync(
    join(process.cwd(), "supabase/functions/mcp-bridge/index.ts"),
    "utf8",
  );
  assert.match(fn, /auth:\s*["']user["']/);
  assert.match(fn, /verifyAuth/);
  assert.match(fn, /get_tracker_snapshot/);
  for (const table of bridge.TRACKER_SYNC_TABLES) {
    assert.match(fn, new RegExp(`"${table}"`));
  }
});

test("realtime migration publishes the tracker tables", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/028_tracker_realtime.sql"),
    "utf8",
  );
  for (const table of ["bed_spaces", "payments", "billing_records", "student_notifications"]) {
    assert.match(sql, new RegExp(table));
  }
});
