import assert from "node:assert/strict";
import test from "node:test";
import { validateDisplayName } from "../src/lib/profile-shared.ts";

test("profile names support Unicode and reject hidden characters and invalid lengths", () => {
  assert.equal(validateDisplayName("  Sam 王  "), "Sam 王");
  assert.equal(validateDisplayName("🦁".repeat(40)), "🦁".repeat(40));
  for (const value of [null, new Blob(["Sam"]), "   ", "a".repeat(41), "Sam\nAdmin", "Sam\u202eAdmin", "Sam\u0000"]) {
    assert.equal(validateDisplayName(value), null);
  }
});
