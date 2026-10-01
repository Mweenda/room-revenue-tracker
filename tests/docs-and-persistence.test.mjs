import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { mapUserPreferences } = await import("../src/lib/api/preferences.ts");

test("project documentation lives in docs/", () => {
  assert.equal(existsSync(join(process.cwd(), "docs/README.md")), true);
  assert.equal(existsSync(join(process.cwd(), "docs/attributions.md")), true);
  assert.equal(existsSync(join(process.cwd(), "docs/spec/room-revenue-schema.json")), true);
  const rootReadme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  assert.match(rootReadme, /docs\//);
  assert.equal(existsSync(join(process.cwd(), "src/imports/StudentPortalRoomRevenueTracker")), false);
});

test("live tracker and inboxes do not invent seed or localStorage rows", () => {
  const tracker = readFileSync(join(process.cwd(), "src/hooks/useTrackerData.ts"), "utf8");
  const landlord = readFileSync(join(process.cwd(), "src/hooks/useLandlordInbox.ts"), "utf8");
  const student = readFileSync(join(process.cwd(), "src/hooks/useStudentInbox.ts"), "utf8");
  assert.doesNotMatch(tracker, /from ["']\.\.\/data\/seed["']/);
  assert.doesNotMatch(tracker, /SEED_BEDS/);
  assert.doesNotMatch(landlord, /localStorage/);
  assert.doesNotMatch(student, /localStorage/);
  assert.match(landlord, /fetchLandlordNotifications/);
  assert.match(student, /fetchStudentNotifications/);
});

test("user preferences map from the database row the frontend can write back", () => {
  const prefs = mapUserPreferences({
    user_id: "user-1",
    whatsapp_client: "web",
    color_mode: "dark",
    welcome_ad_seen_at: "2026-10-01T06:00:00Z",
    updated_at: "2026-10-01T06:00:00Z",
  });
  assert.equal(prefs.whatsappClient, "web");
  assert.equal(prefs.colorMode, "dark");
  assert.equal(prefs.welcomeAdSeenAt, "2026-10-01T06:00:00Z");
});
