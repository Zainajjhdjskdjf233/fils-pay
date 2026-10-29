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

## N06 — Expired payment links could still be paid (FP-187)

### The idea
A payment link has an end time. Like a coupon with an expiry date: after that date the shop must refuse it.

### The problem
The server asked the buyer's browser "when did you press pay?" and believed the answer.
- A buyer could send any old time, for example 2020.
- Then an expired link looked fresh, and the card was charged.
- This is ticket FP-187: "The checkout page sends something the server shouldn't trust."

### The fix
- apps/api/src/paymentLinks/pay.ts: the expiry check now uses the server's own clock only.
- apps/api/src/routes/paymentLinks.ts: fixed a comment that wrongly said the time was ignored.
- Smallest change: one line. The browser may still send the time, but the server ignores it.

### The code
Before (apps/api/src/paymentLinks/pay.ts:60):
```ts
const expiryCheckTime = expiryReferenceTime(input.submittedAt);
```
After:
```ts
const expiryCheckTime = new Date();
```
The new line takes "now" from the server, so nobody outside can move the clock back.

### The proof
- Before: paymentLinks.e06.test.ts → expired link plus submittedAt 2020 → 200 "paid", 4750 fils charged.
- After: paymentLinks.e06.test.ts → 410 "payment_link_expired", and no transaction row.

### If the judges ask
"What about a buyer who pressed pay one second before expiry on a slow network?"
That payment is refused, which is the safe side for money. The shop can send a new link; trusting the buyer's clock would let anyone pay any expired link.

Commit: 41f2313

## N07 — Rotating an API key did not stop the old key

### The idea
An API key is a password a shop's software uses to talk to FilsPay. Rotating a key means "give me a new key and kill the old one". Like changing a lock after you lose a key.

### The problem
The admin "rotate" button made a new key but never killed the old one.
- A leaked key kept working after the admin rotated it.
- A test even checked that the old key still worked, calling it a "grace period" that no document defines.

### The fix
- apps/api/src/admin/apiKeys.ts: the rotation now marks the old key as revoked, reason "rotated", in the same database transaction.
- apps/api/src/routes/admin.test.ts: the test now expects the old key to fail.
- Smallest change: one UPDATE inside the transaction that already existed.

### The code
Before (apps/api/src/admin/apiKeys.ts:31-38):
```ts
const issued = await issueApiKeyInTx(client, config, { ..., rotatedFromKeyId: input.apiKeyId });
await insertAdminAuditLog(client, { ... });
```
After:
```ts
const issued = await issueApiKeyInTx(client, config, { ..., rotatedFromKeyId: input.apiKeyId });
await client.query(
  `UPDATE api_keys SET revoked_at = now(), revoked_reason = 'rotated'
    WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL`, [input.apiKeyId, input.merchantId]);
await insertAdminAuditLog(client, { ... });
```
The new query kills the old key at the same moment the new key is made. If anything fails, both changes are undone together.

### The proof
- Before: admin.test.ts rotation test (corrected) → the old key still got 200 after rotation.
- After: the old key gets 401; all 41 admin tests pass, including the "audit failure undoes the whole rotation" test.

### If the judges ask
"You changed an existing test. Isn't that cheating?"
The test protected the bug. The database design (0037:12-14), the code comment (issue.ts:22) and the route comment all say rotation revokes the old key, and the "grace period" it cited does not exist in ADMIN.md.

Commit: 9da617a

## N08 — Anyone could send fake messages "from the bank" (FP-240)

### The idea
The bank (acquirer) sends FilsPay messages like "this payment is fraud". Each message carries a signature made with a secret only the bank and FilsPay know. Like a sealed letter with a wax stamp.

### The problem
FilsPay accepted letters with no stamp at all.
- Signature checking was off by default.
- Old stamped letters could be sent again forever (replay).
- With an empty secret, anyone could make a valid stamp.
- So anyone could attach a fake fraud note to any payment.

### The fix
- apps/api/src/config.ts: signatures are now required by default.
- apps/api/src/webhooks/inboundVerify.ts: an empty secret rejects everything; a timestamp older or newer than 5 minutes is rejected before the compare; the compare is constant-time.
- Old tests that expected unsigned letters to pass were corrected.

### The code
Before (apps/api/src/webhooks/inboundVerify.ts:50-56):
```ts
  requireSignature = false,
): VerifyAcquirerCallbackResult {
  if (!header) {
    return requireSignature ? { valid: false, ... } : { valid: true };
```
After:
```ts
  requireSignature = true,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifyAcquirerCallbackResult {
  if (!secret) return { valid: false, reason: "no_secret_configured" };
  ...
  if (Math.abs(nowSeconds - parsed.timestamp) > ACQUIRER_CALLBACK_TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
```
Now a letter must have a stamp, a real secret must exist, and the stamp must be less than 5 minutes old.

### The proof
- Before: inboundVerify.e08.test.ts → 3 of 5 fail; the route test accepted an unsigned callback (200, note saved).
- After: inboundVerify.e08.test.ts → 5 of 5 pass; unsigned → 401, replayed → 401, no note saved.

### If the judges ask
"Can someone still replay a message inside the 5 minutes?"
Yes, the signature alone cannot stop that. The fix for that is a unique callback id, which is entry E27 and is next in our list.

Commit: 602aff0

## N09 — Support staff could give shops free money, and the "two people" check looked at names

### The idea
A credit is money FilsPay gives a shop, for example after an outage. Big credits need a second person to approve. Like a bank where a large cash withdrawal needs a manager's signature.

### The problem
The lowest admin role (support) could create credits, and small ones were paid at once.
- The create route checked "is this an admin?" but not "which role?".
- The "second person" check compared display names, which are not unique.
- So one person could approve their own credit by changing their name, and two different people called "Ahmed" blocked each other.

### The fix
- apps/api/src/routes/adminCredits.ts: creating a credit now needs the finance or super_admin role, like approve and reject.
- apps/api/src/admin/creditApproval.ts: the check compares the admin's unique id.
- Smallest change: one role check and one compared field.

### The code
Before (apps/api/src/admin/creditApproval.ts:11):
```ts
if (approver.displayName === requester.displayName) {
```
After:
```ts
if (approver.adminUserId === requester.adminUserId) {
```
The new line compares the person, not the name, so nobody can approve their own credit and two people with the same name are not blocked.

### The proof
- Before: E09 tests → support creates a credit (201); same person with a new name approves; two "Ahmed"s blocked.
- After: support gets 403 and no credit row is written; the id tests pass; all 21 credit tests pass.

### If the judges ask
"ADMIN.md says support can issue small credits. Why did you block them?"
Small credits are paid at once with no second person, so allowing support breaks the money control. The code comments and the admin website already say support cannot; we recorded the doc conflict for the team to confirm.

Commit: 1f6c885

## N10 — "View as merchant" let senior admins act as the shop owner

### The idea
Admins can open a shop's dashboard to help with support ("view as merchant"). It should be look-only. Like a building manager who may look into a flat but not sign the tenant's contracts.

### The problem
Senior admins got real power inside the shop.
- super_admin became the shop "owner", finance became the shop "finance".
- They could create payment links and change where the shop's webhooks go.
- The logs recorded these actions as the shop's own.
- The audit export shows 16 such owner grants by MK and AM, and 16 finance grants.

### The fix
- apps/api/src/admin/impersonation.ts: every admin role now becomes the look-only "support" role while viewing a shop.
- Smallest change: two words in one table. All write routes already refuse the support role.

### The code
Before (apps/api/src/admin/impersonation.ts:85-89):
```ts
  support: "support",
  finance: "finance",
  super_admin: "owner",
```
After:
```ts
  support: "support",
  finance: "support",
  super_admin: "support",
```
Now any admin viewing a shop has the same look-only role, so the existing role checks block every owner/finance action.

### The proof
- Before: E10 test → a finance admin viewing a shop created a payment link (201).
- After: E10 test → 403, reading still works; all 42 admin tests pass.

### If the judges ask
"Is impersonation fully read-only now?"
Not yet: capture and void have no role check at all (entry E35), so they are still open. We recorded that instead of claiming more than we fixed.

Commit: f50a4c3

## N11 — Any shop could read the sales of another shop's sub-shops

### The idea
A marketplace shop can have sub-shops ("split children") that share its payouts. The parent may see the children's sales reports. Like a mall manager who may see each store's takings, but a stranger may not.

### The problem
The report check only asked "is this some shop's child?", not "is it YOUR child?".
- Any shop could put a child's id in the report filter.
- It then got up to 500 of that child's transactions.

### The fix
- apps/api/src/reporting/scope.ts: the check now also requires that the caller is the child's parent.
- apps/api/src/reporting/transactionsReportQuery.ts: fixed a comment that wrongly said the id was always replaced.
- Smallest change: one extra condition in one query.

### The code
Before (apps/api/src/reporting/scope.ts:13):
```ts
`SELECT 1 AS ok FROM merchant_split_children WHERE child_merchant_id = $1`,
```
After:
```ts
`SELECT 1 AS ok FROM merchant_split_children WHERE child_merchant_id = $1 AND parent_merchant_id = $2`,
```
Now only the real parent gets the child's report; anyone else only ever gets their own data.

### The proof
- Before: scope.e11.test.ts → an outsider got the child's id back.
- After: scope.e11.test.ts → the outsider gets its own id; the real parent still gets the child.

### If the judges ask
"Why return the caller's own data instead of an error?"
That is what the function already did for unknown ids, so the API does not reveal which ids are children. We kept the existing behaviour and only closed the hole.

Commit: bfddbe9

## N12 — The nightly cleanup deleted every hold when nothing had expired

### The idea
A hold reserves money on a card until the payment is taken. A nightly script removes holds that expired. Like a cleaner who should throw out only the milk that is past its date.

### The problem
On a night with nothing expired, the script deleted every hold.
- It built "delete holds with these ids", but with an empty list the "with these ids" part was dropped.
- The command became "delete all holds".

### The fix
- scripts/lib/sqlFilter.ts: an empty list is now kept as a filter that matches nothing.
- Smallest change: remove one line. It also protects any other script that uses this helper.

### The code
Before (scripts/lib/sqlFilter.ts:9-11):
```ts
if (Array.isArray(val)) {
  if (val.length === 0) continue;
  values.push(val);
```
After:
```ts
if (Array.isArray(val)) {
  values.push(val);
```
Now an empty list becomes "id is in an empty list", which matches nothing, so nothing is deleted.

### The proof
- Before: live run on a database copy with 4 valid holds → "matched 0, deleted 4", 0 holds left.
- After: "matched 0, deleted 0", 4 holds left; with one expired hold, exactly 1 is deleted.

### If the judges ask
"Is the script fully safe now?"
The empty-list disaster is fixed. A small race remains (a hold captured between the check and the delete), and the handover says holds should be marked expired, not deleted; both are recorded as open.

Commit: b3d6e94
