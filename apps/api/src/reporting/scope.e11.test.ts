/**
 * E11: only a split child's own parent may report on the child's transactions.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { resolveReportMerchantId } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("scope.e11.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

async function merchant(label: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`E11 ${label} ${randomUUID().slice(0, 8)}`],
  );
  return r.rows[0]!.id;
}

test("testE11_outsiderCannotReportOnAnotherParentsChild", async () => {
  const parent = await merchant("parent");
  const child = await merchant("child");
  const outsider = await merchant("outsider");
  await pool.query(
    `INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, 10000)`,
    [parent, child],
  );

  assert.equal(await resolveReportMerchantId(pool, outsider, child), outsider, "an outsider only ever sees itself");
  assert.equal(await resolveReportMerchantId(pool, parent, child), child, "the real parent may report on its child");
});
