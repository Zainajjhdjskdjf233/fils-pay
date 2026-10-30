/**
 * E20: the fee shown on the dashboard must be the fee payments are charged.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { getCurrentFeeScheduleForDisplay } from "./currentFeeScheduleDisplay.js";
import { getEffectiveMdrBps } from "./feeSchedule.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("currentFeeScheduleDisplay.e20.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => {
  await pool.end();
});

test("testE20_displayEqualsChargedRate", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E20 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const add = (bps: number, eff: string, created: string) =>
    pool.query(`INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from, created_at) VALUES ($1, $2, $3, $4)`, [merchantId, bps, eff, created]);
  await add(225, "2026-08-01T00:00:00Z", "2026-08-01T00:00:00Z"); // renegotiated rate
  await add(245, "2026-03-01T00:00:00Z", "2026-08-15T00:00:00Z"); // backfill for an old period, keyed in later
  await add(150, "2099-01-01T00:00:00Z", "2026-09-01T00:00:00Z"); // future rate, not yet in effect

  const client = await pool.connect();
  let charged: number;
  try {
    charged = await getEffectiveMdrBps(client, merchantId, new Date(), 250);
  } finally {
    client.release();
  }
  const shown = await getCurrentFeeScheduleForDisplay(pool, merchantId);
  assert.equal(charged, 225);
  assert.equal(shown?.mdrBps, charged, "dashboard must show the rate payments are charged");
});
