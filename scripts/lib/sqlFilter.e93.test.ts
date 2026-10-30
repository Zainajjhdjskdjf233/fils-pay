/** E93 [found later]: buildDelete must never build a DELETE with no WHERE
 *  (null/undefined filters were skipped), and table/column names must be
 *  plain identifiers, never pasted text. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDelete, buildWhere } from "./sqlFilter.js";

test("testE93_noUnfilteredDeleteAndNoPastedIdentifiers", () => {
  assert.throws(() => buildDelete("holds", { id: undefined }), /no filter/);
  assert.throws(() => buildDelete("holds", { id: null }), /no filter/);
  assert.throws(() => buildDelete("holds", {}), /no filter/);
  assert.throws(() => buildDelete("holds; DROP TABLE x", { id: ["a"] }), /identifier/);
  assert.throws(() => buildWhere({ "id = id OR 1": 1 }), /identifier/);
  assert.deepEqual(buildDelete("holds", { id: ["a"] }), { text: "DELETE FROM holds WHERE id = ANY($1::uuid[])", values: [["a"]] });
});
