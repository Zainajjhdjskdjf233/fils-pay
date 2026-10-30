/**
 * E136 [coverage]: webhook replay-batch, archive and archive replay must be
 * finance/super_admin only, and one archive may be replayed only once.
 * Before the fix any admin role (support too) could call all three, and an
 * archive could be replayed again and again (duplicate payment events).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../adminAuth/passwords.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adminWebhookReplay.e136.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

const PASSWORD = "admin-test-password-9000!";
async function admin(role: "support" | "finance"): Promise<{ cookie: string; id: string }> {
  const email = `e136-${role}-${randomUUID()}@admin.test`;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'E136', $3) RETURNING id`,
    [email, await hashPassword(PASSWORD, config), role],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  const cookie = ([] as string[]).concat(login.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.adminCookieName}=`))!.split(";")[0]!;
  const verify = await app.inject({
    method: "POST", url: "/v1/admin/auth/otp/verify", headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  return { cookie, id: u.rows[0]!.id };
}

test("testE136_replayIsFinanceOnlyAndAnArchiveReplaysOnce", async () => {
  const support = await admin("support");
  const finance = await admin("finance");
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E136 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const ep = await pool.query<{ id: string }>(
    `INSERT INTO webhook_endpoints (merchant_id, url, secret_ciphertext, secret_prefix, created_by_type, created_by_id)
     VALUES ($1, 'https://example.com/hook', 'x', 'whsec_x', 'merchant_session', gen_random_uuid()) RETURNING id`,
    [merchantId],
  );
  const endpointId = ep.rows[0]!.id;
  const outbox = await pool.query<{ id: string }>(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ('transaction.captured', 'transaction', gen_random_uuid(), $1) RETURNING id`,
    [JSON.stringify({ merchantId, amountCapturedFils: 1000 })],
  );
  const original = await pool.query<{ id: string }>(
    `INSERT INTO webhook_deliveries (endpoint_id, outbox_event_id, event_type, delivery_event_id, payload, status)
     VALUES ($1, $2, 'transaction.captured', gen_random_uuid(), $3, 'succeeded') RETURNING id`,
    [endpointId, outbox.rows[0]!.id, JSON.stringify({ merchantId })],
  );
  const originalId = original.rows[0]!.id;
  const entries = [{ deliveryId: originalId, outboxEventId: outbox.rows[0]!.id, eventType: "transaction.captured", payload: { merchantId }, createdAt: new Date().toISOString() }];
  const arch = await pool.query<{ id: string }>(
    `INSERT INTO webhook_delivery_archives (endpoint_id, merchant_id, created_by_admin_user_id, from_created_at, to_created_at, delivery_count, archive_payload)
     VALUES ($1, $2, $3, now() - interval '1 day', now(), 1, $4) RETURNING id`,
    [endpointId, merchantId, finance.id, JSON.stringify(entries)],
  );
  const archiveId = arch.rows[0]!.id;
  const base = `/v1/admin/merchants/${merchantId}/webhook-endpoints/${endpointId}`;
  const calls = [
    { url: `${base}/replay-batch`, payload: { statuses: ["succeeded"], from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" } },
    { url: `${base}/archive`, payload: { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" } },
    { url: `${base}/archive/${archiveId}/replay`, payload: { targetEndpointId: endpointId } },
  ];
  for (const c of calls) {
    const res = await app.inject({ method: "POST", url: c.url, headers: { cookie: support.cookie }, payload: c.payload });
    assert.equal(res.statusCode, 403, `support on ${c.url}: ${res.statusCode} ${res.body}`);
  }

  const replay = calls[2]!;
  const first = await app.inject({ method: "POST", url: replay.url, headers: { cookie: finance.cookie }, payload: replay.payload });
  assert.equal(first.statusCode, 200, first.body);
  const second = await app.inject({ method: "POST", url: replay.url, headers: { cookie: finance.cookie }, payload: replay.payload });
  assert.equal(second.statusCode, 409, `second replay of the same archive: ${second.statusCode} ${second.body}`);
  const queued = await pool.query(`SELECT 1 FROM webhook_deliveries WHERE replay_of_delivery_id = $1`, [originalId]);
  assert.equal(queued.rowCount, 1, "the archived delivery is queued again once, not once per replay");
});
