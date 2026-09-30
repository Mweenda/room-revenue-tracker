import test from "node:test";
import assert from "node:assert/strict";

const { landlordRailCompact, LANDLORD_RAIL_COLLAPSE_MS } = await import("../src/lib/landlordSidebar.ts");

test("the desktop rail stays collapsed until hover, and expanded while hovered", () => {
  assert.equal(landlordRailCompact(true, false), true);
  assert.equal(landlordRailCompact(true, true), false);
});

test("touch and coarse pointers keep the full sidebar", () => {
  assert.equal(landlordRailCompact(false, false), false);
  assert.equal(landlordRailCompact(false, true), false);
});

test("collapse is delayed so the cursor can leave a small gap", () => {
  assert.ok(LANDLORD_RAIL_COLLAPSE_MS >= 120);
  assert.ok(LANDLORD_RAIL_COLLAPSE_MS <= 300);
});
