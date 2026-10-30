/**
 * E130 [deep review]: when the capture of a link payment fails, the card
 * authorization must be voided at once (the link is released for a retry,
 * which authorizes afresh). Before the fix the hold stayed open.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import { recordKycReview } from "../onboarding/review.js";
import { payPaymentLink } from "./pay.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("pay.e130.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const acquirer = createAcquirerSimulator(config);
test.after(async () => {
  await pool.end();
});

async function newLink(merchantId: string): Promise<string> {
  const token = `e130-${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, reference, description, expires_at, status, created_by_type, created_by_id)
     VALUES ($1, $2, 5000, 'e130', 'E130', now() + interval '1 hour', 'active', 'merchant_api_key', gen_random_uuid())`,
    [merchantId, token],
  );
  return token;
}

const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
const payConfig = { paymentLinkReservationTimeoutSeconds: 60, maxConcurrentLockedPays: 2 };

test("testE130_failedCaptureVoidsTheAuthorization", async () => {
  const merchantId = (
    await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E130 ${randomUUID()}`])
  ).rows[0]!.id;
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const token = await newLink(merchantId);
  const failingCapture = {
    ...acquirer,
    capture: async (req: { acquirerReference: string }) => ({ outcome: "error" as const, acquirerReference: req.acquirerReference, latencyMs: 0 }),
  };
  const r = await payPaymentLink(pool, failingCapture as typeof acquirer, payConfig, { token, idempotencyKey: randomUUID(), card });
  assert.equal(r.statusCode, 502);
  const link = await pool.query<{ status: string }>(`SELECT status FROM payment_links WHERE token = $1`, [token]);
  assert.equal(link.rows[0]!.status, "active");
  const txns = await pool.query<{ status: string }>(`SELECT status FROM transactions WHERE merchant_id = $1`, [merchantId]);
  assert.deepEqual(txns.rows.map((x) => x.status), ["voided"]);
});
