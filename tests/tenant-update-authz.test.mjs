import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const regression = readFileSync(
  resolve("supabase/migrations/020_unique_phones_gender_manual_payment.sql"),
  "utf8",
);
const paymentSource = readFileSync(
  resolve("supabase/migrations/017_gender_onboarding_grace_payments.sql"),
  "utf8",
);
const fix = readFileSync(
  resolve("supabase/migrations/026_lock_down_tenant_and_payment_updates.sql"),
  "utf8",
);

function functionBody(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return next >= 0 ? sql.slice(start, next) : sql.slice(start);
}

test("020 update_tenant dropped property checks that 010 had", () => {
  const body = functionBody(regression, "update_tenant");
  assert.doesNotMatch(body, /landlord_owns_tenant/);
  assert.doesNotMatch(body, /landlord_owns_bed/);
});

test("update_tenant must own the tenant and the destination bed", () => {
  const body = functionBody(fix, "update_tenant");
  assert.match(body, /not public\.landlord_owns_tenant\(p_tenant_id\)/);
  assert.match(body, /not public\.landlord_owns_bed\(p_bed_space_id\)/);
  assert.match(body, /security definer/);
});

test("017 update_payment did not lock the existing payment to the caller", () => {
  const body = functionBody(paymentSource, "update_payment");
  assert.doesNotMatch(body, /landlord_owns_bed\(v_row\.bed_space_id\)/);
  assert.match(body, /landlord_owns_bed\(p_bed_space_id\)/);
});

test("update_payment must own the existing row before reassigning the bed", () => {
  const body = functionBody(fix, "update_payment");
  assert.match(
    body,
    /select \* into v_row from public\.payments where id = p_payment_id for update/,
  );
  assert.match(body, /not public\.landlord_owns_bed\(v_row\.bed_space_id\)/);
  assert.match(body, /not public\.landlord_owns_bed\(p_bed_space_id\)/);
});
