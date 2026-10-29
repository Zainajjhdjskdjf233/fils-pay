import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assertDistinctApprover } from "./creditApproval.js";

// E09: two-person control is about the person (admin user id), not the display name.
test("testE09_sameAdminWithDifferentNameCannotApprove", () => {
  const id = randomUUID();
  assert.throws(
    () => assertDistinctApprover({ adminUserId: id, displayName: "Dana" }, { adminUserId: id, displayName: "Dana F." }),
    /self_approval_forbidden/,
  );
});

test("testE09_twoAdminsWithSameNameCanApprove", () => {
  assert.doesNotThrow(() =>
    assertDistinctApprover(
      { adminUserId: randomUUID(), displayName: "Ahmed" },
      { adminUserId: randomUUID(), displayName: "Ahmed" },
    ),
  );
});
