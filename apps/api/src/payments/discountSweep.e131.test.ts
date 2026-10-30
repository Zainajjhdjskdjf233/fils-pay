/** E131 (rest): if the discount adjustment fails after a paid checkout, a
 *  periodic sweep must post it later — exactly once. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { sweepMissingDiscountAdjustments } from "./discountAdjustment.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("discountSweep.e131.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => { await pool.end(); });

test("testE131_sweepPostsAMissedDiscountOnce", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`, [`E131 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 10000, 10000, $2) RETURNING id`,
    [merchantId, `acq-${randomUUID()}`],
  );
  // The capture happened (fee 250) but the adjustment call failed: no credit row.
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, 'captured', 10000, 'system', '{"feeFils": 250}')`,
    [t.rows[0]!.id],
  );
  const count = async () => Number((await pool.query(
    `SELECT count(*) AS n FROM ledger_entries WHERE transaction_id = $1 AND direction = 'credit' AND description = 'capture: negotiated discount adjustment'`,
    [t.rows[0]!.id],
  )).rows[0].n);
  assert.equal(await count(), 0);
  await sweepMissingDiscountAdjustments(pool);
  await sweepMissingDiscountAdjustments(pool);
  assert.equal(await count(), 1, "posted once, not once per sweep");
  const amount = await pool.query(
    `SELECT amount_fils FROM ledger_entries WHERE transaction_id = $1 AND direction = 'credit' AND description = 'capture: negotiated discount adjustment'`,
    [t.rows[0]!.id],
  );
  assert.equal(Number(amount.rows[0].amount_fils), 50, "20 % of the 250 fee");
});

// fix-reviewer: one malformed event (feeFils not an integer) must not break
// the sweep query for everyone.
test("testE131_malformedFeeDoesNotBreakTheSweep", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`, [`E131b ${randomUUID()}`],
  );
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 10000, 10000, $2) RETURNING id`,
    [m.rows[0]!.id, `acq-${randomUUID()}`],
  );
  for (const meta of ['{"feeFils": "abc"}', '{"feeFils": 1.5}', '{"feeFils": 99999999999999999999}']) {
    await pool.query(`INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, 'captured', 10000, 'system', $2::jsonb)`, [t.rows[0]!.id, meta]);
  }
  await assert.doesNotReject(sweepMissingDiscountAdjustments(pool));
});

// E50 fix-reviewer cases: the sweep must use the adjustment capture recorded
// (discountAdjFils). 60 fils at 250 bps with 20 %: fee 2, owed 1 (fee*bps =
// 4000 would have hidden it). A capture owed 0 must not stay a candidate.
test("testE50_sweepUsesTheRecordedAdjustment", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`, [`E50s ${randomUUID()}`],
  );
  const mk = async (adj: number) => {
    const t = await pool.query<{ id: string }>(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 60, 60, $2) RETURNING id`,
      [m.rows[0]!.id, `acq-${randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, 'captured', 60, 'system', $2::jsonb)`,
      [t.rows[0]!.id, JSON.stringify({ feeFils: 2, discountBps: 2000, mdrBps: 250, discountAdjFils: adj })],
    );
    return t.rows[0]!.id;
  };
  const owed = await mk(1);
  const nothing = await mk(0);
  await sweepMissingDiscountAdjustments(pool);
  const credits = async (id: string) => (await pool.query<{ amount_fils: string }>(
    `SELECT amount_fils FROM ledger_entries WHERE transaction_id = $1 AND direction = 'credit' AND description = 'capture: negotiated discount adjustment'`, [id],
  )).rows.map((r) => Number(r.amount_fils));
  assert.deepEqual(await credits(owed), [1], "the small owed credit is retried");
  assert.deepEqual(await credits(nothing), []);
  const stillCandidate = await pool.query(
    `SELECT 1 FROM transaction_events e WHERE e.transaction_id = $1 AND (e.metadata->>'discountAdjFils')::bigint > 0`, [nothing],
  );
  assert.equal(stillCandidate.rowCount, 0, "an event owed 0 is never counted as missing");
});
