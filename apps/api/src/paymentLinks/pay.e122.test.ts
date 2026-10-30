/**
 * E122 [deep review]: if pool.connect() fails after the lock slot is taken,
 * the slot must be given back, the link released and the authorization voided.
 * Before the fix the slot leaked: with one slot, the next pay waited forever.
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
  throw new Error("pay.e122.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
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
  const token = `e122-${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, reference, description, expires_at, status, created_by_type, created_by_id)
     VALUES ($1, $2, 5000, 'e122', 'E122', now() + interval '1 hour', 'active', 'merchant_api_key', gen_random_uuid())`,
    [merchantId, token],
  );
  return token;
}

const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
const payConfig = { paymentLinkReservationTimeoutSeconds: 60, maxConcurrentLockedPays: 1 };

test("testE122_connectFailureGivesBackTheLockSlot", { timeout: 15_000 }, async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E122 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });

  // connect #1 = authorize's transaction, connect #2 = pay.ts's link lock → fail it.
  let connects = 0;
  const flaky = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === "connect") {
        return () => {
          connects += 1;
          if (connects === 2) return Promise.reject(new Error("timeout exceeded when trying to connect"));
          return target.connect();
        };
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? v.bind(target) : v;
    },
  }) as Pool;

  const token1 = await newLink(merchantId);
  await assert.rejects(payPaymentLink(flaky, acquirer, payConfig, { token: token1, idempotencyKey: randomUUID(), card }), /timeout exceeded/);

  const l1 = await pool.query<{ status: string }>(`SELECT status FROM payment_links WHERE token = $1`, [token1]);
  assert.equal(l1.rows[0]!.status, "active", "the failed pay must release its claim at once");
  const t1 = await pool.query<{ status: string }>(`SELECT status FROM transactions WHERE merchant_id = $1`, [merchantId]);
  assert.deepEqual(t1.rows.map((r) => r.status), ["voided"], "the authorization of the failed pay must be voided");

  // With one slot, a leaked slot makes this second pay wait forever.
  const token2 = await newLink(merchantId);
  const second = payPaymentLink(pool, acquirer, payConfig, { token: token2, idempotencyKey: randomUUID(), card });
  const hang = new Promise<"hang">((resolve) => setTimeout(() => resolve("hang"), 3_000).unref());
  const r = await Promise.race([second, hang]);
  assert.notEqual(r, "hang", "the next pay waited for a lock slot that was never given back");
  assert.equal((r as { statusCode: number }).statusCode, 200);
});
