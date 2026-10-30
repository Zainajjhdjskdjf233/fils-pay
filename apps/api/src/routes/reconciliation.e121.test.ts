/**
 * E121 [deep review]: a manual credit is explained by reconciliation, first as
 * pending and then as part of the batch that pays it. Before the fix it was an
 * unexplained gap (no batch ever paid it).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconciliation.e121.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE121_creditIsExplainedPendingThenBatched", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E121 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e121-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e121" });
  const h = { authorization: `Bearer ${rawKey}` };
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  const tomorrow = d.toISOString().slice(0, 10);

  const group = randomUUID();
  await pool.query(
    `INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
     VALUES ($1, $2, 'manual_balance_adjustment_contra', 'debit', 2000, now(), 'manual balance adjustment'),
            ($1, $2, 'merchant_payable', 'credit', 2000, now(), 'manual balance adjustment')`,
    [group, merchantId],
  );
  const url = `/v1/settlement/reconciliation?from=${today}&to=${tomorrow}`;
  const pending = await app.inject({ method: "GET", url, headers: h });
  assert.equal((pending.json() as { gapFils: number }).gapFils, 0, `unbatched credit must be pending, not a gap: ${pending.body}`);

  // The day's batch pays it (as CloseBatch now does).
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, credit_fils, closed_at)
     VALUES ($1, $2, 'closed', 0, 0, 2000, 2000, now()) RETURNING id`,
    [merchantId, today],
  );
  await pool.query(
    `INSERT INTO settlement_batch_ledger_groups (entry_group_id, settlement_batch_id, merchant_id, amount_fils) VALUES ($1, $2, $3, 2000)`,
    [group, b.rows[0]!.id, merchantId],
  );
  const batched = await app.inject({ method: "GET", url, headers: h });
  assert.equal((batched.json() as { gapFils: number }).gapFils, 0, `batched credit: ${batched.body}`);
});
