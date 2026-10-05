import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function latestSubmitStudentApplicationSql() {
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  let body = "";
  const marker = "create or replace function public.submit_student_application(";
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    let from = sql.indexOf(marker);
    while (from >= 0) {
      const end = sql.indexOf("$$;", from);
      assert.ok(end > from, `unterminated submit_student_application in ${file}`);
      body = sql.slice(from, end);
      from = sql.indexOf(marker, end);
    }
  }
  assert.ok(body, "missing submit_student_application");
  return body;
}

test("a second pending application for the same email is rejected instead of overwriting the first", () => {
  const sql = latestSubmitStudentApplicationSql();
  assert.match(sql, /already has a pending bed space request/i);
  assert.match(sql, /unique_violation/);
  assert.doesNotMatch(sql, /set\s+full_name\s*=\s*v_name/i);
  assert.doesNotMatch(sql, /set\s+nrc\s*=\s*v_nrc/i);
});
