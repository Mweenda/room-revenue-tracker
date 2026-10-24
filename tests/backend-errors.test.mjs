import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_UNAVAILABLE_MESSAGE, isBackendUnavailable } from "../src/lib/backendErrors.ts";

test("classifies Supabase auth fetch failures as backend outages", () => {
  const error = new Error("Failed to fetch");
  error.name = "AuthRetryableFetchError";

  assert.equal(isBackendUnavailable(error), true);
});

test("classifies browser network errors as backend outages", () => {
  assert.equal(isBackendUnavailable(new TypeError("Load failed")), true);
  assert.match(BACKEND_UNAVAILABLE_MESSAGE, /authentication service is unavailable/i);
});

test("does not classify invalid credentials as a backend outage", () => {
  assert.equal(isBackendUnavailable(new Error("Invalid login credentials")), false);
});
