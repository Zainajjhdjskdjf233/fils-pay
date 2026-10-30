/**
 * E104: bulk "Approve KYC" must approve only merchants that are under review —
 * never rejected or not-yet-submitted ones (the docblock promised this).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { bulkApproveMerchantsKyc } from "./bulkKyc.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("bulkKyc.e104.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

test("testE104_onlyUnderReviewMerchantsAreApproved", async () => {
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'x', 'E104', 'finance') RETURNING id`,
    [`e104-${randomUUID()}@admin.test`],
  );
  const merchant = async (status: string) =>
    (await pool.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps, onboarding_status) VALUES ($1, 250, $2) RETURNING id`,
      [`E104 ${status} ${randomUUID()}`, status],
    )).rows[0]!.id;
  const review = await merchant("under_review");
  const rejected = await merchant("rejected");
  const submitted = await merchant("submitted");

  const res = await bulkApproveMerchantsKyc(pool, { merchantIds: [review, rejected, submitted], adminUserId: admin.rows[0]!.id });
  assert.deepEqual(res.approvedMerchantIds, [review]);

  const rows = await pool.query<{ id: string; onboarding_status: string; kyc_passed: boolean }>(
    `SELECT id, onboarding_status, kyc_passed FROM merchants WHERE id = ANY($1::uuid[])`,
    [[rejected, submitted]],
  );
  for (const r of rows.rows) {
    assert.notEqual(r.onboarding_status, "approved", `merchant ${r.id} must not be approved`);
    assert.equal(r.kyc_passed, false);
  }
});
