/** E83 [found later]: after KYC approval the legal identity (legal name, CR
 *  number, business type) must not change without a new review; contact
 *  fields stay editable. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { recordKycReview } from "./review.js";
import { updateBusinessProfile } from "./businessProfile.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("businessProfile.e83.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => { await pool.end(); });

test("testE83_identityIsLockedAfterKycApproval", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E83 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await pool.query(
    `INSERT INTO merchant_business_profiles (merchant_id, legal_name, registration_number, business_type, contact_email, contact_phone, address_line1, city)
     VALUES ($1, 'Company A', $2, 'llc', 'a@example.test', '+97300000000', '1 Road', 'Manama')`,
    [merchantId, `RC-${randomUUID().slice(0, 8)}`],
  );
  // Before approval the identity can still be corrected.
  await updateBusinessProfile(pool, merchantId, { legalName: "Company A W.L.L." });
  // fix-reviewer: locked while under review too.
  await pool.query(`UPDATE merchants SET onboarding_status = 'under_review' WHERE id = $1`, [merchantId]);
  await assert.rejects(updateBusinessProfile(pool, merchantId, { legalName: "Company C" }), (err: { code?: string }) => err.code === "identity_locked_after_kyc");
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "e83" });
  for (const patch of [{ legalName: "Company B" }, { registrationNumber: "RC-OTHER" }, { businessType: "partnership" }]) {
    await assert.rejects(
      updateBusinessProfile(pool, merchantId, patch as never),
      (err: { statusCode?: number; code?: string }) => err.statusCode === 409 && err.code === "identity_locked_after_kyc",
      JSON.stringify(patch),
    );
  }
  const ok = await updateBusinessProfile(pool, merchantId, { city: "Muharraq" });
  assert.equal(ok.city, "Muharraq");
  assert.equal(ok.legalName, "Company A W.L.L.");
});
