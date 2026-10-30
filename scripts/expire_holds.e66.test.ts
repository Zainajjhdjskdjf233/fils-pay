/** E66 [found later]: a hold released (captured or voided) between the
 *  SELECT and the DELETE must not be deleted. FH named this race in the
 *  script; the reply "negligible window, fine" left it open.
 *  Requires DATABASE_URL to point at a real, migrated Postgres. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { buildExpiredHoldsDelete, fetchExpiredHoldIds } from "./expire_holds.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("expire_holds.e66.test.ts requires DATABASE_URL");

test("testE66_holdReleasedInBetweenIsNotDeleted", async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const m = await client.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E66 ${randomUUID()}`]);
    const h = await client.query<{ id: string }>(
      `INSERT INTO holds (merchant_id, amount_fils, status, expires_at) VALUES ($1, 1000, 'active', now() - interval '1 day') RETURNING id`,
      [m.rows[0]!.id],
    );
    const holdId = h.rows[0]!.id;
    const ids = await fetchExpiredHoldIds(client);
    assert.ok(ids.includes(holdId));
    // A capture or void releases the hold between the SELECT and the DELETE.
    await client.query(`UPDATE holds SET status = 'released' WHERE id = $1`, [holdId]);
    const { text, values } = buildExpiredHoldsDelete([holdId]);
    await client.query(text, values);
    const left = await client.query(`SELECT status FROM holds WHERE id = $1`, [holdId]);
    assert.equal(left.rowCount, 1, "a released hold must survive the sweep");
    assert.equal(left.rows[0].status, "released");
  } finally {
    await client.end();
  }
});
