/**
 * E70: seeded outbox events must match the seeded history — each event
 * carries the time of the thing it reports (the reporting worker files it
 * under that Bahrain day), and every seeded closed batch has its
 * settlement.batch_closed event. Runs generate() (TRUNCATES): fresh local DB
 * only, with FILSPAY_ALLOW_SEED_RESET=1.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { generate } from "./generate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.FILSPAY_ALLOW_SEED_RESET !== "1") {
  throw new Error("outboxHistory.e70.test.ts needs DATABASE_URL (a throw-away local DB) and FILSPAY_ALLOW_SEED_RESET=1");
}

test("testE70_seededOutboxMatchesSeededHistory", { timeout: 120_000 }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  try {
    const before = Date.now();
    await generate(pool);
    const fresh = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM outbox_events WHERE created_at >= to_timestamp($1 / 1000.0)`, [before],
    );
    assert.equal(fresh.rows[0]!.n, 0, "no seeded event is stamped with the seed run's own time");
    const missing = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM settlement_batches sb
        WHERE sb.status = 'closed'
          AND NOT EXISTS (SELECT 1 FROM outbox_events oe WHERE oe.event_type = 'settlement.batch_closed' AND oe.aggregate_id = sb.id)`,
    );
    assert.equal(missing.rows[0]!.n, 0, "every seeded closed batch has its batch_closed event");
  } finally {
    await pool.end();
  }
});
