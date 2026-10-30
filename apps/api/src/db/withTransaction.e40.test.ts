/** E40: a failing ROLLBACK must not hide the real error, and the broken
 *  client must be destroyed (release(err)), not returned to the pool. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { withTransaction } from "./withTransaction.js";

test("testE40_rollbackFailureKeepsTheRealError", async () => {
  let releasedWith: unknown = "not called";
  const client = {
    query: async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("connection terminated");
      return { rows: [], rowCount: 0 };
    },
    release: (err?: unknown) => { releasedWith = err; },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await assert.rejects(
    withTransaction(pool, async () => { throw new Error("real cause: unique violation"); }),
    /real cause: unique violation/,
  );
  assert.ok(releasedWith instanceof Error, "a client whose ROLLBACK failed must be destroyed, not reused");
});
