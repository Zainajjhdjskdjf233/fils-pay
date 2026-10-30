/**
 * E131 [deep review]: once the link is paid and committed, a failing discount
 * adjustment must not turn the buyer's answer into a 500 — the card WAS
 * charged. The failure is logged for a retry (the adjustment is idempotent).
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
  throw new Error("pay.e131.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
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
  const token = `e131-${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_links (merchant_id, token, amount_fils, reference, description, expires_at, status, created_by_type, created_by_id)
     VALUES ($1, $2, 5000, 'e131', 'E131', now() + interval '1 hour', 'active', 'merchant_api_key', gen_random_uuid())`,
    [merchantId, token],
  );
  return token;
}

const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
const payConfig = { paymentLinkReservationTimeoutSeconds: 60, maxConcurrentLockedPays: 2 };

test("testE131_discountFailureAfterPaymentStillAnswersPaid", async (t) => {
  const merchantId = (
    await pool.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`,
      [`E131 ${randomUUID()}`],
    )
  ).rows[0]!.id;
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const token = await newLink(merchantId);
  // The only pool.connect() after the link is finalized is the discount's transaction.
  const failAfterPaid = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === "connect") {
        return async () => {
          const s = await target.query<{ status: string }>(`SELECT status FROM payment_links WHERE token = $1`, [token]);
          if (s.rows[0]?.status === "paid") throw new Error("discount db down");
          return target.connect();
        };
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? v.bind(target) : v;
    },
  }) as Pool;
  const logged = t.mock.method(console, "error", () => undefined);
  const r = await payPaymentLink(failAfterPaid, acquirer, payConfig, { token, idempotencyKey: randomUUID(), card });
  assert.equal(r.statusCode, 200);
  assert.equal((r.body as { status: string }).status, "paid");
  assert.ok(logged.mock.calls.some((c) => String(c.arguments[0]).includes("discount adjustment failed")), "the failure is logged for a retry");
});
