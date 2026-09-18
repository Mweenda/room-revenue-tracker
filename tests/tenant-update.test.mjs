import test from "node:test";
import assert from "node:assert/strict";

const { tenantUpdateFields } = await import("../src/lib/api/tenants.ts");

const PROFILE = {
  name: "Maika Nengo",
  phone: "0977000000",
  email: "maika@example.com",
  moveInDate: "2026-02-01",
};

test("occupancy billing edits omit NRC so a date correction cannot wipe the ID number", () => {
  const fields = tenantUpdateFields(PROFILE);
  assert.equal("nrc" in fields, false);
  assert.equal(fields.full_name, "Maika Nengo");
  assert.equal(fields.email, "maika@example.com");
  assert.equal(fields.move_in_date, "2026-02-01");
});

test("a profile save that includes NRC still writes it, including a blank clear", () => {
  const kept = tenantUpdateFields({ ...PROFILE, nrc: "123456/78/9" });
  assert.equal(kept.nrc, "123456/78/9");

  const cleared = tenantUpdateFields({ ...PROFILE, nrc: "" });
  assert.equal(cleared.nrc, null);
});
