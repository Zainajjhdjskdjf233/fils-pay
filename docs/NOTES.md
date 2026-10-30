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

## N13 — No refund could ever be saved

### The idea
When a shop gives money back, the system saves a refund row with a reason. Like a shop receipt that must have a "reason for return" box filled in.

### The problem
Every refund crashed when it was saved.
- A database rule says the reason may not be empty (migration 0070).
- The code wrote "empty" on purpose when no reason was given.
- The rule's default value only works when the field is left out, not when it is set to empty.

### The fix
- apps/api/src/payments/processRefund.ts: when no reason is given, write "unspecified".
- Smallest change: one value in one line.

### The code
Before (apps/api/src/payments/processRefund.ts:189):
```ts
input.reason ?? null,
```
After:
```ts
input.reason ?? "unspecified",
```
The new value fills the reason box with "unspecified", which is the same default the database rule already expects.

### The proof
- Before: 11 refund tests failed with "violates check constraint chk_refunds_reason_not_null".
- After: those 11 tests pass.

### If the judges ask
"Why not just remove the database rule?"
The rule protects the records: every refund should have a reason. The code was wrong, not the rule.

Commit: 397d79d

## N14 — Refunds could pay out twice, too much, or for another shop

### The idea
A refund sends money back to the buyer's card and takes it from the shop's balance. Like a cashier giving back cash: check the receipt, lock the till, then pay, all in one go.

### The problem
The refund code checked, paid and wrote down in three separate steps, with no lock.
- Two refund clicks at the same time both passed the check (ticket FP-209): double money out.
- It allowed refunding the authorized amount, not only what was captured.
- It did not check that the transaction belongs to the shop asking.
- The fee given back ignored the shop's discount, and partial refunds did not add up to the fee.

### The fix
- apps/api/src/payments/processRefund.ts: one database transaction that locks the payment row (and only the shop's own row) and keeps the lock while the bank is called, exactly like capture already does.
- Refund at most what was captured; give back only the net fee the shop paid, and let the last refund take exactly what is left.
- apps/api/src/refunds/initiateMerchantRefund.ts: look up only the caller's own transaction.

### The code
Before (apps/api/src/payments/processRefund.ts:73-90):
```ts
`SELECT ... FROM transactions WHERE id = $1`,
const refundableFils = subtractFils(amountAuthorized, refundedFils);
```
After:
```ts
`SELECT ... FROM transactions WHERE id = $1 AND merchant_id = $2 FOR UPDATE`,
const refundableFils = subtractFils(capturedFils, refundedFils);
```
FOR UPDATE locks the row until the refund is written, so a second refund waits and then sees the new total. The merchant filter makes another shop's payment "not found", and the limit is now the captured money.

### The proof
- Before: two parallel refunds → both 200; refund 10000 on a 4000 capture → 200; another shop → 200; partial refunds → 249 of 250 fee; discounted shop → 250 instead of 200.
- After: [200, 422]; 422; 404; 250 of 250; 200. All 24 refund tests pass.

### If the judges ask
"Doesn't holding a lock during the bank call make it slow?"
Only for refunds on that one payment, and capture already works this way on purpose (capture.ts:77-85). Money correctness comes before speed here.

Commit: 68fd1bf

## N15 — Refunds can now be made through the API

### The idea
A shop needs one web address to ask "refund this payment". Like a returns desk: one counter, staffed only by people allowed to give money back.

### The problem
The refund address only answered "501 not implemented".
- The refund logic existed but nothing called it.
- An old draft made a new safety key on every request, which would let a retry refund twice.

### The fix
- apps/api/src/routes/refunds.ts: a real route at /v1/merchants/:merchantId/refunds. Only owner or finance users (or the shop's API key) may use it. The client must send its own Idempotency-Key. Amounts must be whole fils; the reason is at most 500 characters.
- apps/api/src/app.ts: the route is mounted with the other shop routes.

### The code
Before (apps/api/src/routes/refunds.ts:23-25):
```ts
app.post("/", { preHandler: requireMerchantAuth }, async (_request, reply) => {
  reply.code(501).send({ error: "not_implemented" });
});
```
After:
```ts
app.post("/:merchantId/refunds", { preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
  async (request, reply) => {
    assertRefundRequestScope(auth, request.params.merchantId);
    ... // Idempotency-Key required, body checked
    const result = await initiateMerchantRefund(app.db, app.acquirer, { merchantId: auth.merchantId, ... });
```
The new route checks who you are and which shop you act for, checks the input, and then runs the refund logic fixed in N14.

### The proof
- Before: refunds.f01b.test.ts → every call got 404 (no route existed).
- After: 7 tests pass: refund 1.250 BD → 200 with 31 fils fee back; same key → same answer, one refund; support user → 403; other shop → 403; refund shows in the timeline as −1250.

### If the judges ask
"Why does the client have to send the Idempotency-Key?"
Only the client knows that two clicks are the same request. A key made by the server is new every time, so it cannot stop a double refund.

Commit: f84083a, 8f05f9e

## N16 — Shops now get a webhook when a refund succeeds

### The idea
A webhook is a message FilsPay sends to the shop's own server when something happens. Like a text message from your bank after a payment.

### The problem
Refunds never sent a message.
- The refund event was saved, but the sender's allowlist did not include it.
- Adding it to the list alone would crash the sender, because there was no message format for it.

### The fix
- apps/api/src/webhooks/envelope.ts: a message format for refund.succeeded, field by field.
- apps/api/src/webhooks/dispatcher.ts: refund.succeeded added to the allowlist, after the format exists.

### The code
Before (apps/api/src/webhooks/dispatcher.ts:28-32):
```ts
const WEBHOOK_ELIGIBLE_EVENT_TYPES = ["transaction.captured", "transaction.voided", "settlement.paid"];
```
After:
```ts
const WEBHOOK_ELIGIBLE_EVENT_TYPES = ["transaction.captured", "transaction.voided", "settlement.paid", "refund.succeeded"];
```
Refund events now go out, using a fixed public shape (refundId, amountFils, feeReversedFils, status and more).

### The proof
- Before: refundWebhook.f01c.test.ts → only "transaction.captured" was delivered.
- After: "refund.succeeded" is delivered with amountFils 1250.

### If the judges ask
"Why not just send the saved event as it is?"
The webhook is a contract shops write code against. A field-by-field mapping keeps internal fields private and lets us change internals without breaking shops.

Commit: 079aeea

## N17 — The compose secrets file is no longer in git

### The idea
Git keeps every file you give it, forever, for everyone who copies the repo. A secrets file in git is like a house key taped to the front door.

### The problem
ops/.env.docker was tracked by git, but its own comment says it is ignored.
- It holds the acquirer callback signing secret.
- Anyone with the repo could sign fake acquirer callbacks.

### The fix
- git rm --cached ops/.env.docker: git stops tracking it, but the file stays on disk.
- .gitignore: ops/.env.docker added, so it cannot be added again by mistake.
- ops/.env.docker.example: the same names, with no secret value.

### The code
Before (.gitignore:1-8):
```
.env
.env.local
```
After (.gitignore:10-11):
```
# E13: compose env file holds secrets; only the .example is tracked
ops/.env.docker
```
The old rule `.env` matches only a file named exactly .env. The new line names the real file.

### The proof
- Before: git ls-files ops → ops/.env.docker is listed; git check-ignore → exit 1 (not ignored).
- After: git ls-files ops → no .env.docker; git check-ignore → .gitignore:11:ops/.env.docker.

### If the judges ask
"Is the secret safe now?"
No. It is still in old commits since 669af52, so a human must rotate it. Untracking only stops new copies.

Commit: 3145f24

## N18 — Refunds now lower the shop's payout

### The idea
Every day, FilsPay adds up a shop's sales, takes its fee, and pays the rest. This is the batch. It is like a cashier counting the till at closing time.

### The problem
The daily count only looked at sales, never at refunds.
- A shop that refunded 1.250 BD was still paid as if the sale stood.
- After a fee change, the recalculation also rebuilt the payout as sales minus fee, so it would bring the refund back.

### The fix
- New migration 0073: each batch stores its refund total and the fee given back.
- refund_batch.go (new): picks the shop's refunds not yet counted, oldest first, while the payout stays at 0 or more. The rest wait for the next day.
- batch.go: subtracts those refunds and marks each refund with the batch id, so it counts once.
- recalculate_mdr.go: moves the payout only by the fee change.

### The code
Before (apps/settlement/internal/settlement/batch.go:219):
```go
netPayout := NetPayableFils(batchGross, batchFee)
```
After:
```go
netPayout := NetPayableFils(batchGross, batchFee)
refundIDs, batchRefund, batchFeeReversed, err := takeRefunds(ctx, tx, merchantID, end, netPayout)
netPayout = netPayout - batchRefund + batchFeeReversed
```
The payout now drops by the refund, minus the fee we gave back. All in whole fils.

### The proof
- Before: Go test → NetPayoutFils = 9750, want 8531.
- After: 4 Go tests pass. A real refund through the API, then the real batch: payout 8531, and the shop's balance in the ledger ends at exactly 0 fils.

### If the judges ask
"What if refunds are bigger than the day's sales?"
We never pay a negative amount. The refund that does not fit waits, and the next day's batch takes it. No fils are lost.

Commit: 6ff2ffb

## N19 — Refunds now show in the reports and in reconciliation

### The idea
Reports count what happened each day. Reconciliation checks that two records agree, like matching your bank statement against your receipts.

### The problem
Refunds were invisible in reports, and they broke reconciliation.
- The report worker did not listen for refunds, and its refund code wrote columns that did not exist.
- The refund summary view joined on the wrong id, so it was always empty.
- A refund not yet paid out showed as a 1.219 BD gap nobody could explain.

### The fix
- Migration 0074: refund columns in the daily report, and the view rebuilt with the right join.
- Report worker: listens for refund.succeeded and counts it on the Bahrain date. The admin rebuild counts refunds too.
- Reconciliation: a refund waiting for a later batch counts as pending; a refund from an earlier day inside this period's batch is matched too.
- The batch API now shows refundFils and feeReversedFils.

### The code
Before (apps/api/src/settlement/query.ts:333):
```ts
const gapFils = ledgerMerchantPayableNetFils - settlementNetPayoutFils - pendingUnbatchedFils;
```
After:
```ts
pendingUnbatchedFils -= Number(pendingRefundResult.rows[0]?.total ?? 0);
const gapFils =
  ledgerMerchantPayableNetFils - settlementNetPayoutFils - pendingUnbatchedFils - refundsFromOtherPeriodsFils;
```
Waiting refunds now lower "pending". Refunds that a batch took from another day are matched separately.

### The proof
- Before: reconciliation gapFils -1219; the view had 0 rows; "column refund_count does not exist".
- After: 7 new tests pass. A live run of the real report worker shows 1 sale of 10000 fils and 1 refund of 1250 fils on 30 Oct.

### If the judges ask
"Why does reconciliation need two refund numbers?"
A refund can wait a day before a batch takes it. So one day has the refund in the ledger but not in a batch, and the next day has it in a batch but not in the ledger. One number covers each side.

Commit: 9afd98d

## N20 — The CSV import reads Bahraini Dinars with 3 decimals

### The idea
Finance uploads a CSV file to fix balances by hand. Each row has an amount in BD. 1 BD is 1000 fils, so BD has 3 decimals, not 2 like dollars.

### The problem
The import read amounts as if they had 2 decimals.
- 4.75 BD was saved as 475 fils, ten times too small.
- 4.755 BD lost its last digit and became 475 fils too.

### The fix
- adjustmentCsvParsing.ts: use parseBhdToFils, the BD parser that already exists in the money package.
- Old tests that expected the wrong numbers were corrected.

### The code
Before (apps/api/src/admin/adjustmentCsvParsing.ts:8):
```ts
return toFils(parseDecimalMinor(raw), { allowNegative: true });
```
After:
```ts
return parseBhdToFils(raw);
```
parseBhdToFils reads up to 3 decimals and multiplies by 1000 with whole numbers only. A 4th decimal is now an error, not silently cut.

### The proof
- Before: 4.755 → 475 fils; 4.7555 was accepted.
- After: 4.755 → 4755, 4.75 → 4750, -3.50 → -3500; 4.7555 is rejected. A read-only query lists any old rows that were saved wrong.

### If the judges ask
"What about money that was already imported wrong?"
We do not edit old ledger rows. The read-only query lists each wrong row and the missing fils, so finance can post a new correcting adjustment.

Commit: 2f06eb4

## N21 — The daily close now starts just after Bahrain midnight

### The idea
Every night a timer closes the day that just ended and pays the shops. It is like a shop that counts the till right after closing time.

### The problem
The timer read the clock in UTC, which is 3 hours behind Bahrain.
- From midnight to 3 AM in Bahrain, UTC still showed yesterday's date.
- So the day that just ended was only closed at about 3:15 AM.

### The fix
- window.go: a new helper, BusinessDateOf, gives the Bahrain date of any moment.
- daemon.go: the "what is due now" check uses that Bahrain date first. The check is now a small function we can test.

### The code
Before (apps/settlement/internal/scheduler/daemon.go:80-81):
```go
now := time.Now().UTC()
todayStart, _ := settlement.BusinessDayWindow(now)
```
After:
```go
todayStart, _ := settlement.BusinessDayWindow(settlement.BusinessDateOf(now))
```
The clock reading is turned into a Bahrain date before the day is chosen.

### The proof
- Before: at 00:15 Bahrain on 31 Oct, the check picked 29 Oct.
- After: it picks 30 Oct. At 00:05 it waits for the grace period. At 11 PM it still closes the day before.

### If the judges ask
"Why not fix BusinessDayWindow itself?"
Every other caller gives it a plain date, and that works. Only the timer gave it a clock time, so we fixed the timer and kept the shared function's promise.

Commit: 7af14ce

## N22 — The scheme file no longer rounds up

### The idea
Each day we send the card scheme a file with one line per payment. Both sides must add up to the same total, like two people checking the same receipt.

### The problem
Each line stored two amounts that did not match.
- amount_fils was cut down to 10 fils (39705 → 39700).
- The BD amount in the file came from the uncut number and was rounded up (39.705 → 39.71).
- So the scheme total was always a few fils higher than ours.

### The fix
- batch.go: the BD amount is now amount_fils / 1000, from the same cut number, in whole-number math inside SQL.

### The code
Before (apps/settlement/internal/settlement/batch.go:277):
```go
`, batchID, line.transactionID, int64(truncated), SchemeAmountBD(line.grossFils), i+1)
```
After:
```go
VALUES ($1, $2, $3::bigint, $3::bigint::numeric / 1000, $4)
`, batchID, line.transactionID, int64(truncated), i+1)
```
Both amounts now come from one number, so they always agree.

### The proof
- Before: 39705 fils → file amount 39.71 (10 fils over).
- After: 39705 fils → 39700 fils and 39.70 BD. A read-only query lists old lines that were over.

### If the judges ask
"Where do the 5 cut fils go?"
That is a separate question (the rounding residue, E16). This fix only makes the file match our own number, as ADR-0002 says.

Commit: 01eee15

## N23 — Split payouts now add up to the parent's total

### The idea
Some shops (like a marketplace) split their daily payout between child shops by fixed shares, like 50%, 30% and 20%. It is like cutting a cake into agreed pieces.

### The problem
Each child's piece was rounded on its own.
- With a payout of 3 fils, the pieces were 2, 1 and 1: 4 fils paid out of 3.
- With 1 fil, every piece was 0, so 1 fil vanished.

### The fix
- shares.go: largest remainder. Every child gets the rounded-down share, then the few fils left go one each to the children with the biggest leftovers.
- allocate.go: the payout uses that one calculation for all children.

### The code
Before (apps/settlement/internal/splits/allocate.go:98):
```go
share := money.ApplyRateFils(money.Fils(netPayout), weightBps)
```
After (apps/settlement/internal/splits/allocate.go:110):
```go
for i, amount := range ChildShares(money.Fils(netPayout), weights) {
    shares[i].AllocatedFils = amount
}
```
All shares are cut from the same total, so they always add back up to it.

### The proof
- Before: net 3 with 50/30/20 paid 4 fils, and the shop's cached balance went to -1.
- After: net 3 pays exactly 3. Many amounts and weights all add up exactly.

### If the judges ask
"Who gets the extra fil?"
The child whose exact share was closest to the next fil. The same rule as the allocateRemainder helper in our money package.

Commit: 2327ed9

## N24 — The daily payout is computed in whole fils

### The idea
The payout is sales minus fees. Money must be counted in whole fils, like counting coins, never as a rough decimal.

### The problem
The payout was computed with float32, a number type with only about 7 exact digits.
- A batch of 135,000.123 BD minus a 3,375.003 BD fee gave 131,625.125 BD.
- The right answer is 131,625.120 BD, so 5 fils were invented.

### The fix
- payable.go: subtract the two whole-fils numbers directly.

### The code
Before (apps/settlement/internal/settlement/payable.go:11-12):
```go
netBD := float32(grossFils)/1000 - float32(feeFils)/1000
return money.Fils(math.Round(float64(netBD) * 1000))
```
After:
```go
return grossFils - feeFils
```
Whole numbers subtract exactly, at any size.

### The proof
- Before: NetPayableFils(135000123, 3375003) = 131625125.
- After: 131625120.

### If the judges ask
"Why did nobody notice?"
Small batches are exact in float32. Only big batches (above about 16,777 BD) drift, and only by a few fils.

Commit: 2db05e0

## N25 — The March sweep can be run again safely

### The idea
The March sweep is a one-time script. It moves tiny rounding leftovers into a special account, like sweeping crumbs into one bin.

### The problem
Running it twice swept twice.
- Each run made new ledger rows with a new random id, so the gap doubled.
- It also used UTC months, so the first 3 hours of March (Bahrain time) were missed and 3 hours of April were included.

### The fix
- A Postgres lock: two runs cannot happen at the same time.
- Before posting, it checks if this merchant was already swept for March. If yes, it skips.
- Month bounds now start at Bahrain midnight.

### The code
Before (scripts/reconcile_march.ts:72-74):
```ts
// am: re-running is safe, entry_group_id dedupes it
const entryGroupId = randomUUID();
```
After:
```ts
const already = await client.query(
  `SELECT 1 FROM ledger_entries
    WHERE merchant_id = $1 AND account_id = 'scheme_rounding_residue' AND description = $2 LIMIT 1`,
  [merchant.merchantId, SWEEP_DESCRIPTION],
);
if ((already.rowCount ?? 0) > 0) return false;
```
A merchant that already has a sweep row is skipped, even from old runs.

### The proof
- Before: two runs made 4 ledger rows for one merchant.
- After: two runs make 2 rows; the real script's second run says "skipped".

### If the judges ask
"Was production swept twice?"
We cannot see production. A read-only count of sweep rows per merchant answers it: more than 2 rows means it ran more than once.

Commit: d69061a

## N26 — The balance button and the CLI now agree

### The idea
Each shop has a saved balance (a cache) so pages load fast. If it drifts, staff can rebuild it, either with a button in the admin site or with a command-line tool (CLI).

### The problem
The button and the CLI counted from different places.
- The CLI adds up the ledger: sales, fees, payouts, refunds.
- The button added up the scheme file lines: sales only, before fees and payouts. So Alpha Retail went from 135K to 7K.
- The CLI's one-shop mode printed the right number but never saved it.

### The fix
- server.go: the button now runs the same ledger rebuild as the CLI.
- rebuild.go: the one-shop rebuild now saves the number in the same SQL statement.

### The code
Before (apps/settlement/internal/internalapi/server.go:268):
```go
diffs, err := ledger.RefreshBalanceCache(r.Context(), pool)
```
After:
```go
diffs, err := ledger.RebuildAllBalances(r.Context(), pool)
```
One source of truth for the balance: the ledger.

### The proof
- Before: button 10000, CLI 9750 for the same shop; the one-shop rebuild left 135000 in the cache.
- After: both give 9750; the one-shop rebuild saves 7000.

### If the judges ask
"Why keep the old function?"
Nothing calls it now. We do not delete code without Zainab's OK; it is recorded in the log.

Commit: b15f944

## N27 — Fee recalculation no longer changes paid batches

### The idea
When finance changes a shop's fee, a tool recalculates fees on recent batches. A batch that was already paid is history, like a receipt already handed over.

### The problem
The tool picked every batch that was not "open".
- That includes "paid" batches.
- So it rewrote the fee and payout of money already sent, and posted ledger rows against them.

### The fix
- recalculate_mdr.go: pick only "closed" batches (closed but not yet paid).

### The code
Before (apps/settlement/internal/settlement/recalculate_mdr.go:67):
```sql
AND status <> 'open'
```
After:
```sql
AND status = 'closed' -- E19: never a paid batch ('<> open' included paid)
```
"Not open" meant "closed or paid". Now it means only "closed".

### The proof
- Before: a paid batch's fee went from 250 to 300 fils and 2 ledger rows were posted against it.
- After: the paid batch stays the same; the unpaid batch is still recalculated.

### If the judges ask
"Does it now use the right fee table?"
Not yet. That part (fee schedules and volume tier) is still open and linked to E20. We fixed the part the settlement team said must never happen.

Commit: 23e2f73

## N28 — The admin status tool no longer turns test shops live

### The idea
Test shops (test_mode) are fake shops for trying things out. Settlement skips them, so no real money is paid. It is like a practice till that is never counted.

### The problem
An admin tool that tidies payment statuses also changed the test flag.
- It switched test_mode off when a shop had "no open authorizations".
- That count was always 0, because the tool never looked at authorized payments.
- So every test shop it touched went live and joined the real settlement run.

### The fix
- adminMerchantsRecompute.ts: the tool no longer touches the test flag at all.
- transactionStatusRecompute.ts: it also leaves chargeback payments alone.

### The code
Before (apps/api/src/routes/adminMerchantsRecompute.ts:27):
```ts
const flagsUpdated = await reconcileSandboxFlag(client, request.params.id, recompute);
```
After:
```ts
const flagsUpdated: string[] = [];
```
A status clean-up now only changes statuses, nothing else.

### The proof
- Before: after the tool ran, the test shop had test_mode = false.
- After: test_mode stays true, and the chargeback stays a chargeback.

### If the judges ask
"How does a test shop go live now?"
Through an explicit go-live step, not as a side effect. That choice is marked for Zainab to review.

Commit: 41c17e8

## N29 — One payment link can only be paid once, even when payment is slow

### The idea
A payment link is a page a shop sends a buyer to pay one fixed amount. When a buyer starts paying, the link is "reserved" for a short time, like a "taken" sign on a restaurant table.

### The problem
The "taken" sign expired after 60 seconds, even if the first payment was still running.
- A second buyer could take the link and pay too: two cards charged for one link (incident 2026-05-14).
- The first request then still answered "paid".

### The fix
- Each reservation gets its own secret token (migration 0075).
- From the ownership check to the end of capture, the request holds a database lock on the link row, so nobody can take it mid-payment.
- A buyer who arrives during that time gets "processing" (409) at once.
- If the first request lost its claim before taking money, it cancels (voids) its authorization.

### The code
Before (apps/api/src/paymentLinks/pay.ts:147-150):
```ts
`UPDATE payment_links SET status = 'paid', ...
  WHERE id = $1 AND status = 'reserved'`
```
After (apps/api/src/paymentLinks/pay.ts:144-147):
```ts
`SELECT 1 FROM payment_links
  WHERE id = $1 AND status = 'reserved' AND reservation_token = $2
  FOR UPDATE`
```
Only the request that holds the token can finish, and the row stays locked until it does.

### The proof
- Before: two buyers at once → both charged, both told "paid".
- After: one is charged, the other gets 409. Also with a 500 ms slow capture. 3 runs out of 3.

### If the judges ask
"Did the reviewer find anything?"
Yes, twice. My first fix only noticed a double charge during a slow capture, and my second could use up the database connections. Both were fixed and tested.

Commit: ad472fc

## N30 — A paid batch is announced and paid out only once

### The idea
When a batch is paid, the system tells the shop (a "settlement.paid" message) and writes a payout instruction for the bank. Each should happen once, like one receipt per purchase.

### The problem
Two things could make copies.
- The daemon and the command-line tool could check "already announced?" at the same moment; both saw "no" and both announced (incident 2026-08-21).
- The payout instruction was written once per webhook delivery, so a shop with two webhook addresses got two instructions.

### The fix
- payout_notify.go: the check and the insert run inside one transaction that takes a named lock, so two processes take turns.
- payoutDisbursement.ts: a per-batch lock, and insert only if no instruction exists yet.

### The code
Before (apps/settlement/internal/settlement/payout_notify.go:32):
```go
rows, err := db.Query(ctx, `
```
After:
```go
tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('settlement.paid notifications'))`)
rows, err := tx.Query(ctx, `
```
The second process waits for the first to finish, then sees its rows and skips them.

### The proof
- Before: two processes at once → up to 20 of 30 batches announced twice; one batch got 3 payout instructions.
- After: every batch once, in 3 runs out of 3.

### If the judges ask
"Why not a unique index?"
It would fail to create on a database that already has the duplicates from the incident. Cleaning those up means deleting rows, which needs a human. The choice is marked for Zainab.

Commit: 8d56ba7

## N31 — The dashboard shows the fee that is really charged

### The idea
Each shop has a fee rate history (fee schedules). Each row says "from this date, the rate is X". Like a price list with start dates.

### The problem
The dashboard and the payment code picked different rows.
- Payments use the newest row that has already started (225 bps).
- The dashboard used the row typed in most recently, even a backfill for an old period (245 bps), or even a future rate.
- The Go settlement code had no rule for two rows with the same start date.

### The fix
- currentFeeScheduleDisplay.ts: the same rule as payments: newest start date already reached, ties by newest entry.
- fee_schedule.go: the same tie-break.

### The code
Before (apps/api/src/fees/currentFeeScheduleDisplay.ts:36):
```sql
ORDER BY created_at DESC
```
After:
```sql
WHERE merchant_id = $1 AND effective_from <= now()
ORDER BY effective_from DESC, created_at DESC
```
The dashboard now asks the same question as the payment code.

### The proof
- Before: dashboard 150 (a future rate), payments 225; Go picked 200 instead of the later correction 210.
- After: dashboard 225 = payments 225; Go picks 210.

### If the judges ask
"What about the discount?"
That is E50, still open: the discount is applied three different ways, and choosing the right one is a business decision.

Commit: 5b2599c

## N32 — The same correction file cannot be applied twice

### The idea
Finance uploads CSV files to correct balances. Each file should count once, like a cheque that can only be cashed once.

### The problem
Nothing stopped a second upload of the same file.
- A comment said the filename was unique. It was not, and a renamed copy ("march (1).csv") would pass anyway.
- Every row would be posted to the ledger again.

### The fix
- Migration 0076: a fingerprint column (SHA-256 of the rows) with a unique index.
- adjustmentImport.ts: compute the fingerprint; if it already exists, answer 409 before posting anything.

### The code
Before (apps/api/src/admin/adjustmentImport.ts:56-58):
```ts
`INSERT INTO adjustment_imports (uploaded_by_admin_user_id, original_filename, row_count)
 VALUES ($1, $2, $3) RETURNING id`
```
After:
```ts
`INSERT INTO adjustment_imports (..., content_sha256) VALUES ($1, $2, $3, $4)
 ON CONFLICT (content_sha256) WHERE content_sha256 IS NOT NULL DO NOTHING RETURNING id`
```
The database itself refuses the second copy, even if two uploads happen at once.

### The proof
- Before: the second upload was accepted.
- After: the second upload gets 409, and the ledger has one posting.

### If the judges ask
"What if finance really wants the same correction twice?"
Change the reason text, and it is a different file. This is marked for Zainab to review.

Commit: c32a3d4

## N33 — Two money counters now use big whole numbers

### The idea
Some totals keep growing forever: a shop's lifetime payout, and the platform's total volume. A counter needs to be big enough, like a car odometer that must not roll back to zero.

### The problem
Both counters used number types that are too small.
- The lifetime payout used float32 (about 7 exact digits): 1000 payouts of 123.457 BD gave 123,456.136 BD.
- The platform volume used a 32-bit integer. Just past the 2,000,000 BD discount threshold it rolled over to a negative number, which would switch the volume discount off.

### The fix
- Migration 0077: both columns become BIGINT (64-bit whole numbers).
- payout_estimate.go and platform_volume.go: use int64.
- platformVolumeTier.ts: turn the BIGINT text into a number.

### The code
Before (apps/settlement/internal/settlement/platform_volume.go:26):
```go
updated := current + int32(batchGrossFils)
```
After:
```go
updated := current + batchGrossFils
```
64-bit whole numbers go up to about 9 quintillion fils, so no roll-over.

### The proof
- Before: 1,999,000,000 + 200,000,000 = -2,095,967,296; lifetime estimate 123,456,136.
- After: 2,199,000,000 and exactly 123,457,000.

### If the judges ask
"These are only monitoring numbers. Why fix them?"
The volume counter is not only monitoring: it decides the 0.15% fee discount for every shop. A negative value would silently remove it.

Commit: PENDING_N33
