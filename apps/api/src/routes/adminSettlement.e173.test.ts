/**
 * E173 [second review, items 84, 87, 88]: admin run-batch and MDR recalc must
 * refuse impossible dates (regex-only: 2026-02-30 → settlement 400 → API 500),
 * a reversed MDR range (silent no-op) and an unknown merchant (FK → 500).
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
  throw new Error("adminSettlement.e173.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
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
  // E47: verify issues a new admin session token; the login cookie stops working.
  const sessionCookie = ([] as string[]).concat(verify.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.adminCookieName}=`))!.split(";")[0]!;
  return { cookie: sessionCookie, id: u.rows[0]!.id };
}

test("testE173_adminSettlementInputIsChecked", async () => {
  const finance = await admin("finance");
  const post = (url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie: finance.cookie }, payload });
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E173 ${randomUUID()}`]);
  const cases: Array<[string, object, number]> = [
    ["/v1/admin/settlement/run-batch", { date: "2026-02-30" }, 400],
    ["/v1/admin/settlement/run-batch", { date: "2026-03-01", merchantId: randomUUID() }, 404],
    [`/v1/admin/merchants/${m.rows[0]!.id}/mdr-recalculation`, { from: "2026-02-30", to: "2026-03-05" }, 400],
    [`/v1/admin/merchants/${m.rows[0]!.id}/mdr-recalculation`, { from: "2026-03-05", to: "2026-03-01" }, 400],
  ];
  for (const [url, payload, want] of cases) {
    const r = await post(url, payload);
    assert.equal(r.statusCode, want, `${url} ${JSON.stringify(payload)}: ${r.statusCode} ${r.body}`);
  }
});
