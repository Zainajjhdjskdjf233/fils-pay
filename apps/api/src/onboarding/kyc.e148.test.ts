/** E148 [coverage]: a merchant is capped at MAX_KYC_DOCUMENTS_PER_MERCHANT
 *  uploads, so a loop of large PDFs cannot fill the disk Postgres shares.
 *  Parallel uploads must not pass the cap. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { MAX_KYC_DOCUMENTS_PER_MERCHANT, recordKycDocument } from "./kyc.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("kyc.e148.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const kycUploadDir = mkdtempSync(join(tmpdir(), "filspay-kyc-e148-"));
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", KYC_UPLOAD_DIR: kycUploadDir, WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
test.after(async () => {
  await pool.end();
});

const pdf = (tag: string) => Buffer.from(`%PDF-1.4\n% ${tag}\n%%EOF\n`);

async function merchantWithDocs(n: number) {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E148 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e148-${randomUUID()}@example.test`],
  );
  const userId = u.rows[0]!.id;
  await pool.query(
    `INSERT INTO kyc_documents (merchant_id, document_type, file_name, mime_type, file_size_bytes, storage_key, sha256, uploaded_by)
     SELECT $1::uuid, 'owner_id', 'old.pdf', 'application/pdf', 10, $1::text || '/old' || g || '.pdf', md5(g::text), $2 FROM generate_series(1, $3::int) g`,
    [merchantId, userId, n],
  );
  return { merchantId, userId };
}

test("testE148_uploadAboveTheCapIsRefusedAndWritesNothing", async () => {
  const { merchantId, userId } = await merchantWithDocs(MAX_KYC_DOCUMENTS_PER_MERCHANT);
  await assert.rejects(
    recordKycDocument(pool, config, { merchantId, documentType: "owner_id", fileName: "id.pdf", buffer: pdf("over"), uploadedBy: userId }),
    (err: { statusCode?: number; code?: string }) => err.statusCode === 409 && err.code === "too_many_documents",
  );
  const left = await readdir(join(kycUploadDir, merchantId)).catch(() => [] as string[]);
  assert.deepEqual(left, [], "nothing may be written to disk");
});

test("testE148_parallelUploadsStopAtTheCap", async () => {
  const { merchantId, userId } = await merchantWithDocs(MAX_KYC_DOCUMENTS_PER_MERCHANT - 1);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      recordKycDocument(pool, config, { merchantId, documentType: "owner_id", fileName: `id${i}.pdf`, buffer: pdf(`p${i}`), uploadedBy: userId }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
  const n = await pool.query(`SELECT count(*)::int AS n FROM kyc_documents WHERE merchant_id = $1`, [merchantId]);
  assert.equal(n.rows[0].n, MAX_KYC_DOCUMENTS_PER_MERCHANT);
});
