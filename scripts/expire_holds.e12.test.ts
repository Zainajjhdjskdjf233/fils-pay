import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExpiredHoldsDelete } from "./expire_holds.js";
import { buildWhere } from "./lib/sqlFilter.js";

// E12: on a night with nothing expired, the delete must match no rows, never become "DELETE FROM holds".
test("testE12_emptyIdListDeletesNothing", () => {
  const { text } = buildExpiredHoldsDelete([]);
  assert.notEqual(text, "DELETE FROM holds", "an empty list must not drop the WHERE clause");
  assert.match(text, /WHERE/);
});

// E12: the shared helper must keep an empty-array filter instead of silently dropping it.
test("testE12_buildWhereKeepsEmptyArrayFilter", () => {
  const { clause, values } = buildWhere({ id: [] });
  assert.equal(clause, "WHERE id = ANY($1::uuid[])");
  assert.deepEqual(values, [[]]);
});
