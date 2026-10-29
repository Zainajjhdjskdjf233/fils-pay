/**
 * E05: merchant A must not cancel (or even detect) merchant B's payment link.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("paymentLinks.e05.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function merchantWithKey(label: string) {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`E05 ${label} ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e05-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const issued = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label });
  return { merchantId, headers: { authorization: `Bearer ${issued.rawKey}` } };
}

test("testE05_merchantCannotCancelAnotherMerchantsLink", async () => {
  const a = await merchantWithKey("A");
  const b = await merchantWithKey("B");
  const created = await app.inject({
    method: "POST",
    url: `/v1/merchants/${b.merchantId}/payment-links`,
    headers: b.headers,
    payload: {
      amountFils: 4_750,
      reference: "e05",
      description: "E05",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const linkId = (created.json() as { id: string }).id;

  const cancel = await app.inject({
    method: "DELETE",
    url: `/v1/merchants/${a.merchantId}/payment-links/${linkId}`,
    headers: a.headers,
  });
  assert.equal(cancel.statusCode, 404, `A cancelling B's link must look like "not found": ${cancel.statusCode}`);

  const row = await pool.query<{ status: string }>(`SELECT status FROM payment_links WHERE id = $1`, [linkId]);
  assert.equal(row.rows[0]!.status, "active", "B's link must stay active");
});
