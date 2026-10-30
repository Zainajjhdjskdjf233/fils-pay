/**
 * Unit tests for the two manual balance-adjustment functions, against a
 * real, migrated Postgres (run `npm run migrate` first).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { toFils } from "@filspay/money";
import {
  applyBalanceCorrection,
} from "./balanceAdjustments.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "balanceAdjustments.test.ts requires DATABASE_URL to point at a real, migrated Postgres",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

after(async () => {
  await pool.end();
});

async function createAdminUser(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role)
     VALUES ($1, 'not-a-real-hash', 'Balance Adjustment Test', 'finance') RETURNING id`,
    [`balance-adj-${randomUUID()}@admin.test`],
  );
  return result.rows[0]!.id;
}

/** A merchant with an existing merchant_balances row at `startingFils`. */
async function createMerchantWithBalance(startingFils: number): Promise<string> {
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode)
     VALUES ($1, 250, 'active', false) RETURNING id`,
    [`balance-adj-merchant-${randomUUID()}`],
  );
  const merchantId = merchant.rows[0]!.id;
  await pool.query(
    `INSERT INTO merchant_balances (merchant_id, cached_payable_fils) VALUES ($1, $2)`,
    [merchantId, startingFils],
  );
  return merchantId;
}

async function cachedBalance(merchantId: string): Promise<number> {
  const result = await pool.query<{ cached_payable_fils: string }>(
    `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`,
    [merchantId],
  );
  return Number(result.rows[0]!.cached_payable_fils);
}

async function ledgerRowCount(merchantId: string): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ledger_entries WHERE merchant_id = $1`,
    [merchantId],
  );
  return Number(result.rows[0]!.n);
}

// ------------------------------------------------ applyBalanceCorrection

test("applyBalanceCorrection moves the cache by exactly the delta", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchantWithBalance(100_000);

  const result = await applyBalanceCorrection(pool, {
    merchantId,
    adminUserId,
    deltaFils: toFils(50_000, { allowNegative: true }),
    reason: "statement cross-check",
  });

  assert.equal(result.cachedPayableFilsBefore, 100_000);
  assert.equal(result.cachedPayableFilsAfter, 150_000);
  assert.equal(await cachedBalance(merchantId), 150_000);
});

test("applyBalanceCorrection applies a negative delta", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchantWithBalance(80_000);

  const result = await applyBalanceCorrection(pool, {
    merchantId,
    adminUserId,
    deltaFils: toFils(-30_000, { allowNegative: true }),
    reason: "duplicate credit backed out",
  });

  assert.equal(result.cachedPayableFilsAfter, 50_000);
  assert.equal(await cachedBalance(merchantId), 50_000);
});

test("applyBalanceCorrection writes an audit row", async () => {
  const adminUserId = await createAdminUser();
  const merchantId = await createMerchantWithBalance(10_000);

  await applyBalanceCorrection(pool, {
    merchantId,
    adminUserId,
    deltaFils: toFils(750, { allowNegative: true }),
    reason: "phone confirmation",
  });

  const audit = await pool.query<{ action: string; metadata: Record<string, unknown> }>(
    `SELECT action, metadata FROM admin_audit_log WHERE target_id = $1`,
    [merchantId],
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0]!.action, "balance_adjustment");
  assert.equal(audit.rows[0]!.metadata.deltaFils, 750);
  assert.equal(audit.rows[0]!.metadata.reason, "phone confirmation");
});

test("applyBalanceCorrection 404s for a merchant with no balance row", async () => {
  const adminUserId = await createAdminUser();
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode)
     VALUES ($1, 250, 'active', false) RETURNING id`,
    [`balance-adj-no-balance-${randomUUID()}`],
  );

  await assert.rejects(
    applyBalanceCorrection(pool, {
      merchantId: merchant.rows[0]!.id,
      adminUserId,
      deltaFils: toFils(1_000, { allowNegative: true }),
      reason: "nothing to adjust",
    }),
    /merchant_balance_not_found/,
  );
});

