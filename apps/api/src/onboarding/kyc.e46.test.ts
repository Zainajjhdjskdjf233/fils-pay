/** E46: "commercial_registration and bank_letter must be a PDF" must be
 *  checked on the file's bytes, not its name. A JPEG renamed cr.pdf passed;
 *  a real PDF with another name was refused. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import sharp from "sharp";
import { loadConfig } from "../config.js";
import { recordKycDocument } from "./kyc.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("kyc.e46.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", KYC_UPLOAD_DIR: mkdtempSync(join(tmpdir(), "filspay-kyc-e46-")), WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => { await pool.end(); });

test("testE46_pdfOnlyRuleChecksTheBytes", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E46 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(`INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`, [merchantId, `e46-${randomUUID()}@example.test`]);
  const uploadedBy = u.rows[0]!.id;
  const jpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#888" } }).jpeg().toBuffer();
  await assert.rejects(
    recordKycDocument(pool, config, { merchantId, documentType: "commercial_registration", fileName: "cr.pdf", buffer: jpeg, uploadedBy }),
    (err: { statusCode?: number; code?: string }) => err.statusCode === 422 && err.code === "document_must_be_pdf",
    "a JPEG named cr.pdf is not a PDF",
  );
  const pdf = Buffer.from("%PDF-1.4\n% e46\n%%EOF\n");
  const ok = await recordKycDocument(pool, config, { merchantId, documentType: "bank_letter", fileName: "bank letter (scan)", buffer: pdf, uploadedBy });
  assert.equal(ok.mimeType, "application/pdf");
});
