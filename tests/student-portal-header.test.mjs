import test from "node:test";
import assert from "node:assert/strict";

const header = await import("../src/lib/studentPortalHeader.ts");

test("the student header is expanded at the top of the scroll", () => {
  assert.equal(header.headerCollapseProgress(0), 0);
  assert.equal(header.compactTitleVisible(0), false);
});

test("the student header interpolates collapse without a binary snap", () => {
  const mid = header.headerCollapseProgress(36);
  assert.ok(mid > 0 && mid < 1);
  assert.equal(header.headerCollapseProgress(header.STUDENT_HEADER_COLLAPSE_RANGE_PX), 1);
  assert.equal(header.headerCollapseProgress(400), 1);
});

test("the compact title appears only after the large title has tucked under", () => {
  assert.equal(header.compactTitleVisible(0.2), false);
  assert.equal(header.compactTitleVisible(0.9), true);
});
