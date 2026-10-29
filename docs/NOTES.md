# NOTES

One note for each change. Same IDs as docs/NOTES-PLAIN.md.

## N01 — Database setup stopped halfway

### The idea
Migrations are the steps that build the database tables, one after another. Like stairs: if one step is broken, you cannot reach the floors above it.

### The problem
Setting up a new database stopped at step 0054 of 66.
- Step 0054 made a view (a saved query) on a table that no step ever creates.
- Step 0055 used column names that the accounts table does not have.
- So 15 steps never ran: no tables for logins, credits, CSV imports or refunds.

### The fix
- db/migrations/0054_views.sql: removed only the broken view. Nothing in the code reads it.
- db/migrations/0055_chart_of_accounts_suspense.sql: used the real columns (id, name, kind).
- Smallest change: two small edits. Adding new steps would not help, because setup always stops at 0054 first.

### The code
Before (db/migrations/0055_chart_of_accounts_suspense.sql:3-9):
```sql
INSERT INTO chart_of_accounts (code, name, account_type, description)
  ... 'suspense' ...
ON CONFLICT (code) DO NOTHING;
```
After:
```sql
INSERT INTO chart_of_accounts (id, name, kind)
  ... 'asset' ...
ON CONFLICT (id) DO NOTHING;
```
The new lines use the three columns the table really has (0007_ledger_double_entry.sql:7-11). The table only allows asset, liability or revenue, and the older suspense account is also an asset.

### The proof
- Before: check-migrate.sh → "failed applying 0054_views.sql", 51 of 66 applied.
- After: check-migrate.sh → 66 of 66 applied; a second run applies 0.

### If the judges ask
"Why did you edit old migrations instead of adding new ones?"
No database ever ran 0054 or 0055, because they always failed. So no database has an older version that could disagree with the edited files.

Commit: bb92a30

## N02 — The API would not start with default settings

### The idea
The API locks each shop's webhook secret with one master key. Like a safe: no key, no safe.

### The problem
The API and the seed crashed at start with "must base64-decode to exactly 32 bytes, got 34".
- When no key was set, the code used a built-in key.
- That key was 34 bytes long, but the code's own check needs exactly 32.
- It was also a secret written in the source code, readable by anyone.

### The fix
- apps/api/src/config.ts: removed the built-in key. The key must now always be set.
- Smallest change: delete one constant and one fallback. The check that says "not set" already existed.

### The code
Before (apps/api/src/config.ts:249-251):
```ts
webhookSecretEncryptionKey: parseWebhookSecretEncryptionKey(
  env.WEBHOOK_SECRET_ENCRYPTION_KEY || (nodeEnv !== "production" ? DEV_FALLBACK_WEBHOOK_KEY_B64 : undefined),
),
```
After:
```ts
webhookSecretEncryptionKey: parseWebhookSecretEncryptionKey(env.WEBHOOK_SECRET_ENCRYPTION_KEY),
```
The new line reads only the real setting. If it is missing, the app stops with a clear "environment variable is not set" message.

### The proof
- Before: config.e51.test.ts → 2 of 3 fail ("got 34"); the API crashed at start.
- After: config.e51.test.ts → 3 of 3 pass; with a key, "Server listening at http://127.0.0.1:3000".

### If the judges ask
"Why not just put a correct 32-byte key in the code?"
A key in the source code is a public secret, and it would quietly run on any server where someone forgot to set a real one. Every test already brings its own key.

Commit: da3ab76

## N03 — Login worked without the OTP code

### The idea
Login has two locks: the password, then a one-time code (OTP). Like a building with a gate and then a door.

### The problem
A merchant could pass the gate (password) and walk in without the door (OTP).
- After the password, the server gives a "half-logged-in" cookie.
- The session check never asked if the code step was done.
- So a stolen password alone opened the dashboard and could create a permanent API key.

### The fix
- apps/api/src/auth/sessions.ts: the session lookup now also asks "did this session finish the code step?".
- Smallest change: one line. The admin login already had the same line.

### The code
Before (apps/api/src/auth/sessions.ts:92):
```ts
  WHERE s.token_hash = $1`,
```
After:
```ts
  WHERE s.token_hash = $1
    AND s.authenticated = true`,
```
The new line accepts a session only after the one-time code was checked, as the rule in db/migrations/0012_sessions.sql:5-9 says.

### The proof
- Before: e03-attack.sh → password-only cookie on GET /v1/transactions = 200 with real data.
- After: e03-attack.sh → 401; a full login with the code still gets 200; sessions.e03.test.ts passes.

### If the judges ask
"Why not fix the live_sessions view instead?"
The schema rules say a half-logged-in cookie is still a valid lookup key, so the view means only "not expired, not revoked". Fixing the query matches the admin code and needs no new migration.

Commit: 35f4415

## N04 — Login could open another shop's account

### The idea
Two shops can have a user with the same email. Login should open the shop whose password you typed. Like two flats with the same family name on the door: your key must open your own flat.

### The problem
After the password check, the server sent the code and the session to the first user with that email in any shop.
- It searched by email only, with no shop filter.
- An attacker could sign up a new shop with the victim's email and their own password.
- Logging in to their own shop then opened the victim's shop.

### The fix
- apps/api/src/routes/auth.ts: the code and session now go to the exact user whose password was checked.
- Smallest change: one line, plus removing an import. That user was already loaded two lines above.

### The code
Before (apps/api/src/routes/auth.ts:78):
```ts
const recipient = await findOtpRecipient(app.db, email) ?? user;
```
After:
```ts
const recipient = user;
```
The new line uses the user found by shop id and email together, so the login always lands in that shop.

### The proof
- Before: auth.e04.test.ts → fails 3 of 3 runs: the attacker lands in the victim's shop.
- After: auth.e04.test.ts → passes 3 of 3 runs; a live login to Beta Digital shows Beta Digital.

### If the judges ask
"Why is findOtpRecipient still in the code?"
Nothing calls it now. Removing it would leave an empty file, and deleting files needs Zainab's approval, so it is listed in the log to remove.

Commit: 5e9d46d

## N05 — One shop could cancel another shop's payment link

### The idea
A payment link is a page a shop sends to a buyer to pay one bill. Like a numbered ticket: only the shop that printed it should be able to tear it up.

### The problem
Any logged-in shop could cancel any other shop's payment link if it knew the link's id.
- The cancel query matched the link id only, not the shop.
- The error message also told a shop if another shop's link was paid or canceled.

### The fix
- apps/api/src/paymentLinks/cancel.ts: both queries now also require "this link belongs to the logged-in shop".
- apps/api/src/routes/paymentLinks.ts: passes the logged-in shop's id from the login data, not from the URL.
- Smallest change: one extra condition in each of the two queries.

### The code
Before (apps/api/src/paymentLinks/cancel.ts:16 and :26):
```ts
WHERE id = $1 AND status = 'active'
`SELECT status FROM payment_links WHERE id = $1`
```
After:
```ts
WHERE id = $1 AND merchant_id = $2 AND status = 'active'
`SELECT status FROM payment_links WHERE id = $1 AND merchant_id = $2`
```
Now a link of another shop looks exactly like a link that does not exist, so it cannot be canceled and nothing about it leaks.

### The proof
- Before: paymentLinks.e05.test.ts → shop A cancels shop B's link and gets 204 (success).
- After: paymentLinks.e05.test.ts → 404, and B's link is still active; the 8 old payment link tests still pass.

### If the judges ask
"Why answer 404 and not 403?"
403 would tell the attacker "this link exists but is not yours". 404 tells them nothing, and the project's architecture doc asks for 404 on other merchants' objects.

Commit: 5710a31
