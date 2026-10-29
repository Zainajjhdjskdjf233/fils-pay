# NOTES

Questions and answers for each change. Same IDs as docs/NOTES-PLAIN.md.

## N01 — Database setup stopped halfway

What did we see?
   Setting up a new database failed with "relation settlement_batch_events does not exist" and only 51 of 66 migrations ran.

Why?
   Migration 0054 made a view on a table no migration creates, and 0055 used column names the accounts table never had.

What did it break?
   No fresh install could get the tables for sessions, credits, CSV imports, webhook archives or refunds, so the app could not work.

What did we change?
   We removed the one broken view in db/migrations/0054_views.sql:10 and used the real columns in db/migrations/0055_chart_of_accounts_suspense.sql:3.

How do we know it works?
   check-migrate.sh: before 51 of 66 applied, after 66 of 66 applied.

What does the code look like?
Before (db/migrations/0055_chart_of_accounts_suspense.sql:3-9):
```sql
INSERT INTO chart_of_accounts (code, name, account_type, description)
VALUES
  ('fx_rounding_difference', 'FX Rounding Difference', 'suspense', '...'),
  ('chargeback_suspense', 'Chargeback Suspense', 'suspense', '...')
ON CONFLICT (code) DO NOTHING;
```
After:
```sql
INSERT INTO chart_of_accounts (id, name, kind)
VALUES
  ('fx_rounding_difference', 'FX Rounding Difference (suspense)', 'asset'),
  ('chargeback_suspense', 'Chargeback Suspense', 'asset')
ON CONFLICT (id) DO NOTHING;
```
   INSERT INTO ... (id, name, kind): uses the three columns the table really has (0007_ledger_double_entry.sql:7-11).
   'asset': the table only allows asset, liability or revenue, and the older suspense account is also an asset.
   ON CONFLICT (id) DO NOTHING: running it twice adds nothing the second time.
   In db/migrations/0054_views.sql:10-22 we deleted the whole CREATE VIEW v_unbatched_capture_events block, because it read a table that does not exist and nothing used the view.

## N02 — The API would not start with default settings

What did we see?
   Starting the API or the seed stopped at once with "must base64-decode to exactly 32 bytes, got 34".

Why?
   When no key was set the code used a built-in key that is 34 bytes long, but its own check needs exactly 32.

What did it break?
   Nobody could start the API or load the test data without knowing to set a key, and a public key was written in the source.

What did we change?
   We removed the built-in key so the key must always be set, in apps/api/src/config.ts:247.

How do we know it works?
   config.e51.test.ts: before 2 of 3 tests failed, after 3 of 3 pass.

What does the code look like?
Before (apps/api/src/config.ts:153 and :249-251):
```ts
const DEV_FALLBACK_WEBHOOK_KEY_B64 = "dGVzdC1rZXktZm9yLWRldi1vbmx5LW5vdC1mb3ItcHJvZA==";

webhookSecretEncryptionKey: parseWebhookSecretEncryptionKey(
  env.WEBHOOK_SECRET_ENCRYPTION_KEY || (nodeEnv !== "production" ? DEV_FALLBACK_WEBHOOK_KEY_B64 : undefined),
),
```
After:
```ts
// Required in every environment (see the Config doc above): no built-in key.
webhookSecretEncryptionKey: parseWebhookSecretEncryptionKey(env.WEBHOOK_SECRET_ENCRYPTION_KEY),
```
   The constant line is gone: it was a 34-byte key written in the source, so it could never pass the 32-byte check and anyone could read it.
   parseWebhookSecretEncryptionKey(env.WEBHOOK_SECRET_ENCRYPTION_KEY): reads only the real setting; if it is missing, the existing check stops the app with "environment variable is not set".

## N03 — Login worked without the OTP code

What did we see?
   A merchant could log in with only the password, skip the one-time code, and still read the dashboard data.

Why?
   The session check looked only at "not expired and not revoked" and never asked whether the one-time code was entered.

What did it break?
   A stolen password alone was enough to take over a merchant account and even create a permanent API key.

What did we change?
   We added "and the session finished the one-time code step" to the session lookup in apps/api/src/auth/sessions.ts:92.

How do we know it works?
   sessions.e03.test.ts and e03-attack.sh: before the password-only cookie got 200 on GET /v1/transactions, after it gets 401.

What does the code look like?
Before (apps/api/src/auth/sessions.ts:89-92):
```ts
`SELECT s.id AS session_id, s.merchant_user_id, mu.merchant_id, mu.role
   FROM live_sessions s
   JOIN merchant_users mu ON mu.id = s.merchant_user_id
  WHERE s.token_hash = $1`,
```
After:
```ts
`SELECT s.id AS session_id, s.merchant_user_id, mu.merchant_id, mu.role
   FROM live_sessions s
   JOIN merchant_users mu ON mu.id = s.merchant_user_id
  WHERE s.token_hash = $1
    AND s.authenticated = true`,
```
   WHERE s.token_hash = $1: finds the session that belongs to the cookie, as before.
   AND s.authenticated = true: only accepts a session after the one-time code was checked, as the rule in db/migrations/0012_sessions.sql:5-9 demands.
