/**
 * E27 (FP-201 reopened): the same acquirer callback must be stored once.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyAcquirerCallback, type AcquirerCallbackInput } from "./callbacks.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("callbacks.e27.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
test.after(async () => {
  await pool.end();
});

test("testE27_sameCallbackStoredOnce", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E27 ${randomUUID()}`]);
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 1000, 1000, $2) RETURNING id`,
    [m.rows[0]!.id, `acq-${randomUUID()}`],
  );
  const cb: AcquirerCallbackInput = {
    callbackId: `acqcb_${randomUUID()}`,
    type: "fraud_review.completed",
    transactionId: t.rows[0]!.id,
    occurredAt: new Date().toISOString(),
    outcome: "cleared",
    note: "no fraud",
  };
  // The bank sends it twice at once, then once more later.
  await Promise.all([applyAcquirerCallback(pool, cb), applyAcquirerCallback(pool, cb)]);
  await applyAcquirerCallback(pool, cb);

  const r = await pool.query(`SELECT 1 FROM acquirer_callback_notes WHERE callback_id = $1`, [cb.callbackId]);
  assert.equal(r.rowCount, 1, "one note per callback");
});
