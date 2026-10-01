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

test("tRPC is allowed in the Vite browser bundle", () => {
  const text = readFileSync(join(process.cwd(), "src/server/trpc.ts"), "utf8");
  assert.match(text, /allowOutsideOfServer:\s*true/);
});

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
    "applications",
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
  await assert.rejects(
    () => caller.applications.list(),
    /landlord/i,
  );
});

const emptyRepo = {
  getLandlordId: async () => null,
  listPayments: async () => [],
  listBilling: async () => [],
  listBeds: async () => [],
  upsertPayments: async () => 0,
  updateBilling: async () => 0,
  updateBeds: async () => 0,
  uploadFile: async () => {},
  logUpload: async () => {},
};

const profileInput = {
  tenantId: "t-ada",
  name: "Ada Lovelace",
  phone: "0970000000",
  email: "ada@example.com",
  nrc: "123456/78/9",
  moveInDate: "2026-02-01",
};

test("tenants.update is a student self-service route, not a landlord gate", async () => {
  const landlordCaller = appRouter.createCaller({
    supabase: null,
    landlordId: "landlord-1",
    tenantId: null,
    isAdmin: false,
    repo: emptyRepo,
  });
  await assert.rejects(
    () => landlordCaller.tenants.update(profileInput),
    /student access is required/i,
  );

  const studentCaller = appRouter.createCaller({
    supabase: null,
    landlordId: null,
    tenantId: "t-ada",
    isAdmin: false,
    repo: emptyRepo,
  });
  await assert.rejects(
    () => studentCaller.tenants.update({ ...profileInput, tenantId: "t-other" }),
    /your own profile/i,
  );

  // Matching tenantId passes the student gate and only then hits the API layer.
  await assert.rejects(
    () => studentCaller.tenants.update(profileInput),
    /supabase not configured/i,
  );
});

test("student profile save does not request a welcome login link", () => {
  const app = readFileSync(join(process.cwd(), "src/app/App.tsx"), "utf8");
  const tracker = readFileSync(join(process.cwd(), "src/server/routers/tracker.ts"), "utf8");
  const profileView = app.slice(app.indexOf("function StudentProfileView"), app.indexOf("function StudentPortal"));
  assert.match(tracker, /update:\s*studentProcedure/);
  assert.match(tracker, /sendLoginLink:\s*false/);
  assert.doesNotMatch(profileView, /sendLoginLink:\s*true/);
});
