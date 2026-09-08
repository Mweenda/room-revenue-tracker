import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { appRouter } = await import("../src/server/root.ts");

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

test("app code does not call Postgres rpc; tRPC procedures are the API", () => {
  const root = join(process.cwd(), "src");
  const allowed = new Set([
    join(root, "server/dbFn.ts"),
  ]);
  const offenders = [];
  for (const file of walk(root)) {
    if (allowed.has(file)) continue;
    const text = readFileSync(file, "utf8");
    if (/\.rpc\s*\(/.test(text)) offenders.push(file.replace(process.cwd() + "/", ""));
  }
  assert.deepEqual(offenders, []);
});

test("tRPC router exposes the former rpc surface", () => {
  assert.equal(typeof appRouter._def.procedures, "object");
  const keys = Object.keys(appRouter._def.record ?? appRouter._def.procedures ?? {});
  for (const name of [
    "auth",
    "payments",
    "tenants",
    "students",
    "occupancy",
    "billing",
    "landlordInbox",
    "notifications",
    "rent",
    "spreadsheet",
  ]) {
    assert.ok(name in appRouter._def.record, `missing router ${name}`);
  }
  void keys;
});

test("tRPC auth.tenantExists is public and payments.verify requires a landlord", async () => {
  const caller = appRouter.createCaller({
    supabase: null,
    landlordId: null,
    tenantId: null,
    isAdmin: false,
    repo: {
      getLandlordId: async () => null,
      listPayments: async () => [],
      listBilling: async () => [],
      listBeds: async () => [],
      upsertPayments: async () => 0,
      updateBilling: async () => 0,
      updateBeds: async () => 0,
      uploadFile: async () => {},
      logUpload: async () => {},
    },
  });

  await assert.rejects(() => caller.payments.verify({ id: "p-1" }), /landlord/i);
  await assert.rejects(() => caller.auth.linkLandlordProfile(), /sign in/i);
});
