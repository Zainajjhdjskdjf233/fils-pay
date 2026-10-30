/**
 * E161 [second review, item 35]: recent ledger activity treats `to` as
 * exclusive, like every other analytics route. It used BETWEEN, so a
 * one-day range (from=D, to=D+1) also returned day D+1.
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
  throw new Error("ledgerActivity.e161.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE161_toIsExclusive", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E161 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e161-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e161" });
  for (const [day, fils] of [["2026-03-01", 1000], ["2026-03-02", 2000]] as const) {
    const g = randomUUID();
    await pool.query(
      `INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
       VALUES ($1, $2, 'manual_balance_adjustment_contra', 'debit', $3, $4, 'e161'), ($1, $2, 'merchant_payable', 'credit', $3, $4, 'e161')`,
      [g, merchantId, fils, `${day}T12:00:00+03:00`],
    );
  }
  const r = await app.inject({
    method: "GET", url: "/v1/analytics/recent-ledger-activity?from=2026-03-01&to=2026-03-02",
    headers: { authorization: `Bearer ${rawKey}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  const body = r.json() as Record<string, unknown>;
  const rows = (Object.values(body).find(Array.isArray) ?? []) as Array<{ amountFils?: number; amount_fils?: number }>;
  const amounts = rows.map((x) => Number(x.amountFils ?? x.amount_fils)).sort((a, b) => a - b);
  assert.deepEqual(amounts, [1000, 1000], `only 1 March (both legs); got ${JSON.stringify(amounts)}`);
});
