/** E92 [found later]: ledger_entries must be append-only for everyone, and
 *  admin_audit_log may only have its outcome/metadata updated (log.ts:112).
 *  Requires DATABASE_URL (a migrated Postgres). */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("appendOnly.e92.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => { await pool.end(); });

test("testE92_ledgerAndAuditAreAppendOnly", async () => {
  const anyLedger = await pool.query<{ id: string }>(`SELECT id FROM ledger_entries LIMIT 1`);
  if (anyLedger.rows[0]) {
    await assert.rejects(pool.query(`UPDATE ledger_entries SET amount_fils = amount_fils WHERE id = $1`, [anyLedger.rows[0].id]), /append-only/);
    await assert.rejects(pool.query(`DELETE FROM ledger_entries WHERE id = $1`, [anyLedger.rows[0].id]), /append-only/);
  }
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'x', 'E92', 'support') RETURNING id`,
    [`e92-${randomUUID()}@admin.test`],
  );
  const row = await pool.query<{ id: string }>(
    `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id) VALUES ($1, 'e92_test', 'merchant', $2) RETURNING id`,
    [admin.rows[0]!.id, randomUUID()],
  );
  const id = row.rows[0]!.id;
  await pool.query(`UPDATE admin_audit_log SET outcome = 'failed', metadata = metadata || '{"e92": true}'::jsonb WHERE id = $1`, [id]);
  await assert.rejects(pool.query(`UPDATE admin_audit_log SET action = 'rewritten' WHERE id = $1`, [id]), /only outcome and metadata/);
  await assert.rejects(pool.query(`DELETE FROM admin_audit_log WHERE id = $1`, [id]), /append-only/);
});
