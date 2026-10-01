import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("ship skill requires passing tests, a successful build, and no chunking notice before any push", () => {
  const skill = readFileSync(
    join(process.cwd(), ".cursor/skills/ship-after-tests/SKILL.md"),
    "utf8",
  );
  assert.match(skill, /npm run verify/);
  assert.match(skill, /no chunking notice or error/i);
  assert.match(skill, /chunkSizeWarningLimit/);
  assert.match(skill, /Do not push GitHub, Supabase, or Firebase until all of these are true/);
});

test("verify-build treats Vite chunk-size warnings as a ship blocker", () => {
  const script = readFileSync(join(process.cwd(), "scripts/verify-build.mjs"), "utf8");
  assert.match(script, /Some chunks are larger than/);
  assert.match(script, /dynamic import will not move module into another chunk/);
  assert.match(script, /Do not push GitHub, Supabase, or Firebase/);
});
