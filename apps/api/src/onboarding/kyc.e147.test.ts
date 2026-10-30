/** E147 [coverage]: a corrupt JPEG must give 422 and leave no file on disk
 *  (before: the original was written first, then sharp threw → 500, orphan file). */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { recordKycDocument } from "./kyc.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("kyc.e147.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const kycUploadDir = mkdtempSync(join(tmpdir(), "filspay-kyc-e147-"));
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", KYC_UPLOAD_DIR: kycUploadDir, WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
test.after(async () => {
  await pool.end();
});

test("testE147_corruptJpegIs422AndLeavesNoFile", async () => {
  const merchantId = randomUUID();
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]);
  await assert.rejects(
    recordKycDocument(pool, config, { merchantId, documentType: "owner_id", fileName: "id.jpg", buffer: broken, uploadedBy: randomUUID() }),
    (err: { statusCode?: number; code?: string }) => err.statusCode === 422 && err.code === "invalid_image",
  );
  const left = await readdir(join(kycUploadDir, merchantId)).catch(() => [] as string[]);
  assert.deepEqual(left, [], "no orphan file may remain");
});
