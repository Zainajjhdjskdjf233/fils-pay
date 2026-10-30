/** E157: two files in one KYC upload must be refused, not "last one wins". Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("kyc.e157.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const kycUploadDir = mkdtempSync(join(tmpdir(), "filspay-kyc-e157-"));
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", KYC_UPLOAD_DIR: kycUploadDir, WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => { await app.close(); await pool.end(); });

test("testE157_twoFilesInOneUploadAreRefused", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E157 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(`INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`, [merchantId, `e157-${randomUUID()}@example.test`]);
  const raw = randomToken(32);
  await pool.query(`INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at) VALUES ($1, $2, true, now() + interval '1 hour')`, [u.rows[0]!.id, sha256Hex(raw)]);
  const b = `----e157${randomUUID().replace(/-/g, "")}`;
  const file = (name: string, body: string) => `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n${body}\r\n`;
  const payload = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nowner_id\r\n` + file("a.pdf", "%PDF-1.4\n%A\n%%EOF") + file("b.pdf", "%PDF-1.4\n%B\n%%EOF") + `--${b}--\r\n`);
  const res = await app.inject({ method: "POST", url: `/v1/merchants/${merchantId}/kyc/documents`, headers: { cookie: `${config.cookieName}=${raw}`, "content-type": `multipart/form-data; boundary=${b}` }, payload });
  assert.equal(res.statusCode, 400, res.body);
  assert.equal((res.json() as { error: string }).error, "too_many_files");
  const docs = await pool.query(`SELECT 1 FROM kyc_documents WHERE merchant_id = $1`, [merchantId]);
  assert.equal(docs.rowCount, 0, "no document may be stored from a multi-file upload");
});
