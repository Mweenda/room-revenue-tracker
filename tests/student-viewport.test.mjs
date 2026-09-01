import test from "node:test";
import assert from "node:assert/strict";

const viewport = await import("../src/lib/studentViewport.ts");

test("a tall phone stays in the expanded chrome layout", () => {
  const next = viewport.studentViewportFromSize(390, 844);
  assert.ok(next.aspect < 0.5);
  assert.equal(next.short, false);
  assert.equal(next.compactChrome, false);
});

test("a landscape phone shrinks chrome so content stays reachable", () => {
  const next = viewport.studentViewportFromSize(844, 390);
  assert.ok(next.aspect > 2);
  assert.equal(next.short, true);
  assert.equal(next.compactChrome, true);
  assert.equal(next.sideNav, true);
  assert.equal(next.wide, false);
});

test("a squat window under 560px tall uses compact chrome", () => {
  const next = viewport.studentViewportFromSize(400, 500);
  assert.equal(next.short, true);
  assert.equal(next.compactChrome, true);
  assert.equal(next.sideNav, false);
});

test("a tablet keeps full chrome even when landscape", () => {
  const next = viewport.studentViewportFromSize(1024, 768);
  assert.equal(next.wide, true);
  assert.equal(next.compactChrome, false);
  assert.equal(next.sideNav, false);
});

test("a landscape foldable still uses a side rail instead of a bottom bar", () => {
  const next = viewport.studentViewportFromSize(720, 320);
  assert.equal(next.compactChrome, true);
  assert.equal(next.sideNav, true);
});
