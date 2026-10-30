/**
 * E69: seeded capture fees must follow the seeded fee_schedules (they used
 * the flat fixture rate). Runs generate() — it TRUNCATES tables — so use a
 * fresh local database only (DATABASE_URL) and set FILSPAY_ALLOW_SEED_RESET=1.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { bankersRoundDiv } from "@filspay/money";
import { generate } from "./generate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.FILSPAY_ALLOW_SEED_RESET !== "1") {
  throw new Error("feeSchedules.e69.test.ts needs DATABASE_URL (a throw-away local DB) and FILSPAY_ALLOW_SEED_RESET=1");
}

test("testE69_seededFeesFollowTheSeededFeeSchedules", { timeout: 120_000 }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  try {
    await generate(pool);
    const rows = await pool.query<{ occurred_at: Date; captured: string; fee: string; rate: number }>(
      `SELECT l.occurred_at,
              SUM(l.amount_fils) FILTER (WHERE l.account_id = 'card_scheme_clearing') AS captured,
              COALESCE(SUM(l.amount_fils) FILTER (WHERE l.account_id = 'platform_fee_revenue' AND l.direction = 'credit'), 0) AS fee,
              (SELECT fs.mdr_bps FROM fee_schedules fs
                WHERE fs.merchant_id = m.id AND fs.effective_from <= l.occurred_at
                ORDER BY fs.effective_from DESC LIMIT 1) AS rate
         FROM ledger_entries l
         JOIN merchants m ON m.id = l.merchant_id
        WHERE m.display_name ILIKE '%alpha%retail%'
          AND l.account_id IN ('card_scheme_clearing', 'platform_fee_revenue')
        GROUP BY l.entry_group_id, l.occurred_at, m.id
       HAVING SUM(l.amount_fils) FILTER (WHERE l.account_id = 'card_scheme_clearing') > 0`,
    );
    const withSchedule = rows.rows.filter((r) => r.rate !== null);
    assert.ok(withSchedule.length > 0, "alpha-retail has captures inside its fee schedules");
    const wrong = withSchedule.filter((r) => Number(r.fee) !== Number(bankersRoundDiv(BigInt(r.captured) * BigInt(r.rate), 10_000n)));
    assert.deepEqual(wrong.slice(0, 3), [], `${wrong.length} of ${withSchedule.length} seeded fees ignore the schedule rate`);
  } finally {
    await pool.end();
  }
});
