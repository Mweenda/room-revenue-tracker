import test from "node:test";
import assert from "node:assert/strict";

const {
  alreadyRegistered,
  existingAuthUserAction,
  profileRoleConflict,
} = await import("../supabase/functions/_shared/authUserPolicy.ts");

test("already-registered detection covers GoTrue phrasings", () => {
  assert.equal(alreadyRegistered("User already registered"), true);
  assert.equal(alreadyRegistered("A user with this email address has already been registered"), true);
  assert.equal(alreadyRegistered("email address already exists"), true);
  assert.equal(alreadyRegistered("Invalid login credentials"), false);
  assert.equal(alreadyRegistered(undefined), false);
});

test("landlord onboard must not reuse an existing auth user", () => {
  assert.equal(existingAuthUserAction(false), "conflict");
});

test("admin bootstrap may reuse the existing admin auth user", () => {
  assert.equal(existingAuthUserAction(true), "reuse");
});

test("onboard refuses to convert an admin or student profile into a landlord", () => {
  assert.equal(profileRoleConflict("admin", "landlord"), true);
  assert.equal(profileRoleConflict("student", "landlord"), true);
  assert.equal(profileRoleConflict("landlord", "landlord"), false);
  assert.equal(profileRoleConflict(null, "landlord"), false);
});
