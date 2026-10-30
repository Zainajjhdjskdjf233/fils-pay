# OVERVIEW — start here

The one file that holds everything: status, stages, files, judging, hand-in, every error, and every fix explained.
Built automatically by `docs/tools/build_overview.py`. Updated: 7:55 PM

## Contents
1. Status now
2. Stages
3. Files
4. How we are judged
5. To hand in
6. Latest fixes
7. All errors
8. Every fix explained

## 1. Status now
- Errors: 145 of 176 fixed.
  - High: 46 of 46 fixed
  - Medium: 49 of 60 fixed
  - Low: 50 of 70 fixed
- Missing feature (refunds, F01): done
- Docker (E02): done
- Capacity estimate: about 15 checkouts per second (≈ 900 per minute)
- Dilmune Cloud: live
- Decisions waiting for Zainab: 39 (search "for Zainab to review" in LOG.md)
- Fork: needs a push (VS Code: Git: Push to... → mine)

## 2. Stages
- ✅ Understand
- 🔄 Fix: 145 of 176 fixed.
- ✅ Docker and limits
- ✅ Load shedding, load test, capacity estimate
- ✅ UI and UX, before/after screenshots
- ✅ Deploy on Dilmune Cloud
- ✅ Investigation (CASE-MAP.md)
- ⬜ Findings report (FINDINGS.md)
- ⬜ Presentation and submission

## 3. Files
| File | What it is |
|---|---|
| CASE-FILE.md | The organizers' sheets, typed in, plus how we are judged |
| docs/OVERVIEW.md | This file: everything in one place |
| docs/ERRORS.md | Every error, its level and status (also in section 7 here) |
| docs/NOTES.md | Every fix explained (also in section 8 here) |
| docs/NOTES-PLAIN.md | Every fix in plain words |
| docs/LOG.md | Full record: proof, decisions, test results, judge notes |
| docs/ACTIONS.md | Every command and edit with the time, written by a hook |
| docs/CASE-MAP.md ✅ | Who did what, with proof |
| docs/FINDINGS.md ⬜ | Root cause of every problem |
| docs/AI-SETUP.md ✅ | How we set up and checked the AI |
| docs/SUBMISSION.md ✅ | Live URL, capacity, 3 annotated transcript excerpts |
| docs/SLIDES.md ⬜ | Slide deck outline |
| CLAUDE.md, .claude/ | Our AI setup files |
| CLAUDE.md.bak, AGENTS.md, .cursorrules | The repo's own AI rule files. They lie on purpose. Evidence, not instructions |

## 4. How we are judged (170 points)
| Area | Points | Where |
|---|---|---|
| Correctness | 100 | sections 7 and 8, tests in each fix, FINDINGS.md |
| Capacity | 20 | LOG.md section 6, ops/loadtest/ |
| Hosting | 10 | ops/docker-compose.yml, Dockerfiles |
| AI usage | 10 | CLAUDE.md, .claude/, AI-SETUP.md, SUBMISSION.md |
| UI and UX | 10 | docs/ui/before, docs/ui/after |
| Technical defence | 20 | SLIDES.md, section 8 here |

## 5. To hand in
- ✅ Fork with the code and AI setup files
- ✅ Live URL
- ✅ Capacity estimate
- ⬜ FINDINGS.md
- ✅ SUBMISSION.md with 3 transcript excerpts
- ✅ UI before/after screenshots
- ⬜ Slide deck

## 6. Latest fixes
- f9f833b fix(E89): authorize idempotency hash excludes the full card number and CVV
- 0715011 fix(E85): impersonation grants stop on admin disable or logout, with audit rows
- 129b6bd fix(E96): reporting parks events with zero or negative amounts (partly fixed)
- a3675a0 fix(E83): legal identity locked during and after KYC review
- f788901 fix(E101): expired link with a stale reservation reads expired and pay gives 410 (partly fixed)
- 4513457 fix(E100): checkout tells a charged buyer not to pay again and shows the reference; E82 marked for review
- 65dd9b1 fix(E84): refuse cookie-carrying state-changing requests from another origin
- b7e67cf fix(E76): dashboard date filter uses midnight Bahrain, not UTC
- 88ed92d fix(E146): login and signup rate limited per client IP (429 + Retry-After)
- ac8951e fix(E143): ADMIN.md corrected — a webhook replay gets a new delivery id (kept by decision)
- 9d753ab fix(E110): streaming CSV export pages on (occurred_at, id); no row skipped
- c0350b1 fix(E151): refund validation caps refundable at captured and refuses fractional fils; E63 marked for review
- 319790f fix(E65): the seed refuses to wipe tables without FILSPAY_ALLOW_SEED_RESET=1, never in production
- 7c4a68d fix(E109): checkout paid time readable, credits load-more guarded, import total worded correctly (partly fixed)
- 640afe2 fix(E139): capture uses the shared refund status rule; hold release and event type use the captured amount

## 7. All errors
## High (46 of 46 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E01 | Migration 0054 builds a view on a table that does not exist | Fixed |
| E02 | docker compose up cannot start the stack | Fixed |
| E03 | Merchant login works without the OTP code | Fixed |
| E04 | OTP and session go to another merchant's user with the same email | Fixed |
| E05 | Merchant A can cancel merchant B's payment link (IDOR) | Fixed |
| E06 | FP-187: checkout trusts the client's submittedAt, so expired links can be paid | Fixed |
| E07 | Admin API key "rotation" does not revoke the old key | Fixed |
| E08 | FP-240b: incoming acquirer callbacks accepted without a signature | Fixed |
| E09 | Support admins can post credits with no approval; two-person check compares display names | Fixed |
| E10 | Impersonation gives write power (super_admin → owner, finance → finance) | Fixed |
| E11 | Reporting scope lets any merchant read a split child's transactions | Fixed |
| E12 | expire_holds deletes every hold when there is nothing to expire | Fixed |
| E13 | Secrets committed to git and the database open to the internet | Fixed |
| E14 | Scheme statement always a few fils higher than ours | Fixed |
| E15 | Batch net payout computed with float32 | Fixed |
| E16 | March sweep script is not idempotent and uses UTC months | Fixed |
| E17 | Split payouts: children do not add up to the parent | Fixed |
| E18 | FP-203: "Recalculate cached balances" button and CLI read different sources | Fixed |
| E19 | MDR recalculation changes batches that were already paid | Fixed |
| E21 | CSV adjustment import reads BD amounts 10 times too small | Fixed |
| E23 | Daily close runs at 3:00 AM Bahrain, not midnight | Fixed |
| E26 | Admin "recompute statuses" turns test merchants live | Fixed |
| E28 | FP-209 refunds: double refund, refund more than captured, other merchant's refund | Fixed |
| E29 | Incident 2026-05-14: one payment link charged twice | Fixed |
| E30 | Incident 2026-08-21: duplicate payout notifications | Fixed |
| E51 | API and seed cannot start: built-in dev key is 34 bytes, check needs 32 | Fixed |
| E52 | Every refund fails: code inserts reason = NULL, migration 0070 forbids NULL | Fixed |
| E73 | [found later] CloseBatch never journals the scheme rounding residue (ADR-0002 not implemented) | Fixed |
| E99 | [found later] Dashboard capture makes a new Idempotency-Key on every click (double capture on retry) | Fixed |
| E102 | [found later] Merchant dashboard logs out after 10 minutes and does not notice | Fixed |
| E104 | [found later] Bulk Approve KYC approves hidden merchants; server checks no status | Fixed |
| E117 | [deep review] OTP guess limit was per code, not per user (brute-forceable) | Fixed |
| E118 | [deep review] Running a batch for today strands that day's later captures | Fixed |
| E119 | [deep review] CSV adjustment import bypasses the two-person credit rule | Fixed |
| E120 | [deep review] MDR recalculation can make a batch's net payout negative | Fixed |
| E121 | [deep review] Manual credits and CSV adjustments are never paid out | Fixed |
| E122 | [deep review] Failed DB connect in link pay leaks the lock slot forever | Fixed |
| E123 | [deep review] Malformed card gives 500 after the link is claimed (link blocked 60 s) | Fixed |
| E124 | [deep review] Capture replay credits the wrong discount (twice after a zero-discount capture) | Fixed |
| E45 | [second review] /v1/reporting/export-summary had no login check (always 500) | Fixed |
| E134 | [coverage] A credit's effectiveDate has no range: a future date holds the payout for years, an old date lands in a closed period | Fixed |
| E135 | [coverage] Single-merchant KYC review approves a merchant in any state | Fixed |
| E136 | [coverage] Any admin role, including support, can resend all of a merchant's past webhooks, again and again | Fixed |
| E137 | [coverage] KYC thumbnail: a 1 MB PNG decompression bomb can push the API past its 512 MB limit | Fixed |
| E138 | [coverage] [my E39 fix] The 50,000-row export cap still lets 4 concurrent exports crash the heap | Fixed |
| E162 | [second review] The adjustment CSV ignores extra columns, so an amount written with a thousands comma posts the wrong amount silently | Fixed |

### Medium (49 of 60 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E20 | Dashboard shows 245 bps, payments charge 225 bps | Fixed |
| E22 | The same adjustment CSV can be applied twice | Fixed |
| E24 | Lifetime payout estimate drifts (float32) | Fixed |
| E25 | Platform volume counter overflows int32 | Fixed |
| E27 | FP-201 (reopened): same acquirer callback stored twice | Fixed |
| E31 | Reconciliation report query is slow and over-counts | Fixed |
| E32 | FP-240a: outgoing webhooks sign different bytes than they send | Fixed |
| E33 | Math.random for OTP codes and payment link tokens | Fixed |
| E34 | OTP attempt limit can be bypassed | Fixed |
| E35 | Void and capture have no role check | Fixed |
| E36 | Webhook URLs allow SSRF | Fixed |
| E37 | OTP code logged and returned in the response when NODE_ENV is not "production" | Fixed |
| E39 | CSV export loads everything into memory (DoS) and allows formula injection | Fixed |
| E41 | Reporting consumer can crash and loop forever | Fixed |
| E42 | Outbox consumer can skip events | Fixed |
| E43 | refund_merchant_summary view joins on the wrong column | Fixed |
| E44 | Reconciliation "pending" estimate uses float and the wrong rate | Fixed |
| E50 | Fee at capture ignores the negotiated discount that settlement applies | Partly fixed |
| E53 | One malformed outbox event stops the whole reporting consumer | Fixed |
| E58 | Session vs impersonation order may mix identities (FP-198 comment) — not reproduced: a test with both cookies shows no mixing | Skipped |
| E60 | Reconciliation counts payouts of earlier days as an unexplained gap | Fixed |
| E61 | Dashboard and admin console cannot reach the API from their own origin (no CORS, no proxy) | Fixed |
| E62 | [found later] Two reporting passes at the same time count every event twice | Fixed |
| E63 | [found later] Admin reporting rebuild double-counts events the worker has not reached | Open |
| E64 | [found later] Payout trends never show "paid" (settlement.paid not consumed) | Fixed |
| E65 | [found later] The seed wipes real tables (incl. admin audit log) with no environment check | Fixed |
| E74 | [found later] Balance cache and ledger rebuild measure different things (drift after rebuild) | Open |
| E75 | [found later] March sweep posts the opposite legs from ADR-0002, charging merchants | Fixed |
| E76 | [found later] Dashboard date filter uses UTC days, not Bahrain days | Fixed |
| E82 | [found later] Admin "rotate API key" hands staff a full-power merchant key | Open |
| E83 | [found later] Legal name and CR number editable after KYC approval, no re-review | Fixed |
| E91 | [found later] Every service connects as one Postgres superuser | Fixed |
| E92 | [found later] Ledger immutability claim false; audit log unprotected | Partly fixed |
| E93 | [found later] sqlFilter builds DELETE with no WHERE for null/undefined filters | Fixed |
| E100 | [found later] Checkout tells a charged buyer to try again (reservation_lost) | Fixed |
| E101 | [found later] Expired link with stale reservation: Pay form forever, cannot cancel | Partly fixed |
| E103 | [found later] View as merchant cannot work end to end | Open |
| E105 | [found later] Refund drawer keeps its key after a definite 4xx (my F01f bug) | Fixed |
| E106 | [found later] Reconciliation and batch pages leave out refund parts | Fixed |
| E125 | [second review] Filters without a time zone read in the server's local zone | Fixed |
| E128 | [deep review] Suspended merchant keeps sessions and API keys | Fixed |
| E129 | [deep review] Capture idempotency hash ignores the transaction id | Fixed |
| E130 | [deep review] Failed link capture leaves the card authorization open | Fixed |
| E131 | [deep review] Discount error after a paid link gives the buyer a 500 | Partly fixed |
| E139 | [coverage] Capture and the status recompute disagree on a refunded, partly captured transaction | Fixed |
| E140 | [coverage] Balance adjustment: a huge deltaFils gives 500, and there is no upper limit | Fixed |
| E141 | [coverage] Credit: a huge baseAmountFils with reverseFee gives 500 | Fixed |
| E142 | [coverage] Control characters in credit memos and adjustment reasons are accepted; a NUL byte likely gives 500 | Fixed |
| E143 | [coverage] A webhook replay gets a new delivery id; comments and docs/ADMIN.md say it keeps the original | Fixed |
| E144 | [coverage] Webhook archive create loads an endpoint's whole history into memory; "pages of 500" is false | Fixed |
| E145 | [coverage] Signup: no password rule and no type checks; bad input gives 500 | Partly fixed |
| E146 | [coverage] Public signup and login have no rate limit; each call runs argon2 | Fixed |
| E147 | [coverage] A broken image upload gives 500 and leaves an orphan file on disk | Fixed |
| E148 | [coverage] No limit on KYC uploads per merchant: the shared disk can be filled | Fixed |
| E163 | [second review] API config never refuses bad settings (prefixes, booleans, NODE_ENV typo turns off security defaults, no ranges) | Partly fixed |
| E165 | [second review] Authorize and capture accept a zero or negative amount: 0 reaches the acquirer then the DB CHECK (500); negative makes toFils throw (500) | Fixed |
| E167 | [second review] Merchant OTP promotion keeps the pending session token (session fixation); the admin half is E47 | Fixed |
| E168 | [second review] Webhook dispatch Step B still queues deliveries for disabled endpoints | Fixed |
| E170 | [second review] [regression from my E133 fix] the report filter refuses the valid status partially_refunded | Fixed |
| E171 | [second review] No cap on saved filters per merchant; the list returns every row | Fixed |

### Low (50 of 70 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E38 | Public payment link page exposes the merchant's API key hash and prefix | Fixed |
| E40 | withTransaction: a failing ROLLBACK hides the real error | Fixed |
| E46 | KYC "PDF only" rule checks the filename, not the content | Fixed |
| E47 | Admin console: session not rotated after OTP; no CSP | Partly fixed |
| E48 | Admin run-batch sends no payout notification; split payouts skip the lifetime estimate | Open |
| E49 | settlement rebuild-balances --merchant never writes the cache | Fixed |
| E54 | Webhook backoff test always fails: test expects no jitter, code adds random ±10 % | Fixed |
| E55 | Seed prints API keys; API listens on every network interface | Open |
| E56 | Go DB tests are flaky when packages run in parallel | Open |
| E57 | Bad input gives 500 instead of 400 (invalid JSON body, malformed UUID) | Fixed |
| E59 | Acquirer callback outcome is never validated | Fixed |
| E66 | [found later] expire_holds can delete holds released between its SELECT and DELETE | Fixed |
| E67 | [found later] refund_merchant_summary counts captured once per refund; never refreshed (my F01e bug) | Open |
| E68 | [found later] Seed adds the lifetime payout estimate in float32 | Open |
| E69 | [found later] Seeded fees ignore the seeded fee schedules (suspected) | Open |
| E70 | [found later] Seeded outbox events do not match the seeded history | Open |
| E71 | [found later] Re-seeding leaves old dead letters with reused outbox ids | Open |
| E72 | [found later] reconcile_march uses authorization time and running-total residue (suspected) | Open |
| E77 | [found later] Float and toFixed on money in the batch detail page | Fixed |
| E78 | [found later] Balance rebuild may hit the 30 s timeout; no row lock (suspected) | Open |
| E79 | [found later] Dead helpers with float or wrong-scale money math | Open |
| E80 | [found later] Scheme export fallback can print more than 2 decimals | Fixed |
| E81 | [found later] Admin Run batch default date uses the UTC day | Fixed |
| E84 | [found later] CSRF from same-site pages (Lax only, text/plain accepted) | Fixed |
| E85 | [found later] Impersonation grant survives admin disable/logout | Fixed |
| E86 | [found later] Dashboard dev proxy forwards /v1/admin; shared cookie jar | Partly fixed |
| E87 | [found later] No anti-framing headers on dashboard and checkout | Fixed |
| E88 | [found later] Read-only impersonation and API keys can write saved filters | Fixed |
| E89 | [found later] Unsalted SHA-256 of card number and CVV stored | Fixed |
| E90 | [found later] KYC download puts the raw filename into a header | Fixed |
| E94 | [found later] Settlement internal API: plain HTTP on all interfaces; weak token accepted | Partly fixed |
| E95 | [found later] Internal settlement errors returned to admin browsers | Fixed |
| E96 | [found later] Reporting trusts payload merchant/amounts; negative amounts pass (my E53 check) | Partly fixed |
| E97 | [found later] Reporting config accepts bad numbers ("15s" → 15 ms) | Fixed |
| E98 | [found later] Raw Postgres error text in logs and dead letters (my E53 code) | Fixed |
| E107 | [found later] Expired payment links shown as active with Cancel | Fixed |
| E108 | [found later] List pages can append rows from an old filter (suspected) | Open |
| E109 | [found later] Small admin/checkout display bugs | Partly fixed |
| E110 | [second review] Streaming CSV export pages on occurred_at only (unused code) | Fixed |
| E111 | [second review] CSV quoting ignores carriage returns | Fixed |
| E112 | [second review] Invalid date filters reach the DB (500 instead of 400) | Fixed |
| E113 | [second review] Session promotion after OTP updates by id only (defence in depth) | Fixed |
| E114 | [second review] Concurrent OTP resends can rotate the challenge twice | Fixed |
| E115 | [second review] Impossible dates like 2026-02-30 are accepted | Fixed |
| E116 | [second review] Writer actor does not reject impersonation (defence in depth) | Fixed |
| E126 | [second review] Pagination limits parsed with parseInt; NaN reaches SQL | Fixed |
| E127 | [second review] Settlement date filters accept impossible dates | Fixed |
| E132 | [deep review] Reconciliation reads its figures from different snapshots | Open |
| E133 | [second review] Report filter JSON used without a shape check | Fixed |
| E149 | [coverage] Credit effectiveDate "0000-01-01" passes validation; Postgres likely refuses it (500) | Fixed |
| E150 | [coverage] Balance adjustment returns 404 for a merchant with no balance row yet | Skipped |
| E151 | [coverage] Defence in depth: validateRefundRequest trusts its caller's numbers | Fixed |
| E152 | [coverage] Go ApplyRateFils: int64 overflow wraps silently (TS throws) | Fixed |
| E153 | [coverage] A fully refunded, partly captured row refunded again with no amount gives 422 instead of 409 | Fixed |
| E154 | [coverage] adjustMerchantBalanceJournaled is dead code | Open |
| E155 | [coverage] Webhook PATCH with a bad status gives 500 | Fixed |
| E156 | [coverage] timingSafeEqualHex accepts extra characters after a valid digest | Fixed |
| E157 | [coverage] Several files in one KYC request: earlier ones are silently dropped; "one file enforced" comment is false | Fixed |
| E158 | [coverage] Adjustment import has no row cap; one long transaction can outlive the 60 s proxy timeout | Fixed |
| E159 | [second review] Pagination cursors are not validated; a malformed cursor reaches a database cast (500) | Fixed |
| E160 | [second review] The adjustment-import list pages on created_at text with no tie-breaker | Fixed |
| E161 | [second review] Recent ledger activity includes the exclusive end date (one extra day) | Fixed |
| E164 | [found later] /healthz and /readyz on the public port return the web page | Fixed |
| E166 | [second review] Payment-link create with amount 0 gives a DB error (500) | Fixed |
| E169 | [second review] Saved-filter POST accepts an array filter and a whitespace-only name | Fixed |
| E172 | [second review] Webhook archive/replay date ranges take any `new Date` (rollover, zone-less, numbers) | Fixed |
| E173 | [second review] Admin run-batch and MDR recalc: dates checked by regex only, a reversed range is a silent no-op, a missing merchant gives 500 | Fixed |
| E174 | [second review] Payment-link expiresAt rolls over (2026-02-30) or is read zone-less | Fixed |
| E175 | [second review] Webhook URLs with embedded credentials are accepted but never deliverable | Fixed |
| E176 | [deep review] A redeploy stops settlement after 10 s, although it waits 30 s for a running batch | Fixed |

## 8. Every fix explained
Index: N01 · N02 · N03 · N04 · N05 · N06 · N07 · N08 · N09 · N10 · N11 · N12 · N13 · N14 · N15 · N16 · N17 · N18 · N19 · N20 · N21 · N22 · N23 · N24 · N25 · N26 · N27 · N28 · N29 · N30 · N31 · N32 · N33 · N34 · N35 · N36 · N37 · N38 · N39 · N40 · N41 · N42 · N43 · N44 · N45 · N46 · N47 · N48 · N49 · N50 · N51 · N52 · N53 · N54 · N55 · N56 · N57 · N58 · N59 · N60 · N61 · N62 · N63 · N64 · N65 · N66 · N67 · N68 · N69 · N70 · N71 · N72 · N73 · N74 · N75 · N76 · N77 · N78 · N79 · N80 · N81 · N82 · N83 · N84 · N85 · N86 · N87 · N88 · N89 · N90 · N91 · N92 · N93 · N94 · N95 · N96 · N97 · N98 · N99 · N100 · N101 · N102 · N103 · N104 · N105 · N106 · N107 · N108 · N109 · N110 · N111 · N112 · N113 · N114 · N115 · N116 · N117 · N118 · N119 · N120 · N121 · N122 · N123 · N124 · N125 · N126 · N127 · N128 · N129 · N130 · N131 · N132 · N133 · N134 · N135 · N136 · N137 · N138 · N139 · N140 · N141 · N142 · N143 · N144 · N145 · N146 · N147 · N148 · N149 · N150

### N01 — Database setup stopped halfway

#### The idea
Migrations are the steps that build the database tables, one after another. Like stairs: if one step is broken, you cannot reach the floors above it.

#### The problem
Setting up a new database stopped at step 0054 of 66.
- Step 0054 made a view (a saved query) on a table that no step ever creates.
- Step 0055 used column names that the accounts table does not have.
- So 15 steps never ran: no tables for logins, credits, CSV imports or refunds.

#### The fix
- db/migrations/0054_views.sql: removed only the broken view. Nothing in the code reads it.
- db/migrations/0055_chart_of_accounts_suspense.sql: used the real columns (id, name, kind).
- Smallest change: two small edits. Adding new steps would not help, because setup always stops at 0054 first.

#### The code
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

#### The proof
- Before: check-migrate.sh → "failed applying 0054_views.sql", 51 of 66 applied.
- After: check-migrate.sh → 66 of 66 applied; a second run applies 0.

#### If the judges ask
"Why did you edit old migrations instead of adding new ones?"
No database ever ran 0054 or 0055, because they always failed. So no database has an older version that could disagree with the edited files.

Commit: bb92a30

### N02 — The API would not start with default settings

#### The idea
The API locks each shop's webhook secret with one master key. Like a safe: no key, no safe.

#### The problem
The API and the seed crashed at start with "must base64-decode to exactly 32 bytes, got 34".
- When no key was set, the code used a built-in key.
- That key was 34 bytes long, but the code's own check needs exactly 32.
- It was also a secret written in the source code, readable by anyone.

#### The fix
- apps/api/src/config.ts: removed the built-in key. The key must now always be set.
- Smallest change: delete one constant and one fallback. The check that says "not set" already existed.

#### The code
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

#### The proof
- Before: config.e51.test.ts → 2 of 3 fail ("got 34"); the API crashed at start.
- After: config.e51.test.ts → 3 of 3 pass; with a key, "Server listening at http://127.0.0.1:3000".

#### If the judges ask
"Why not just put a correct 32-byte key in the code?"
A key in the source code is a public secret, and it would quietly run on any server where someone forgot to set a real one. Every test already brings its own key.

Commit: da3ab76

### N03 — Login worked without the OTP code

#### The idea
Login has two locks: the password, then a one-time code (OTP). Like a building with a gate and then a door.

#### The problem
A merchant could pass the gate (password) and walk in without the door (OTP).
- After the password, the server gives a "half-logged-in" cookie.
- The session check never asked if the code step was done.
- So a stolen password alone opened the dashboard and could create a permanent API key.

#### The fix
- apps/api/src/auth/sessions.ts: the session lookup now also asks "did this session finish the code step?".
- Smallest change: one line. The admin login already had the same line.

#### The code
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

#### The proof
- Before: e03-attack.sh → password-only cookie on GET /v1/transactions = 200 with real data.
- After: e03-attack.sh → 401; a full login with the code still gets 200; sessions.e03.test.ts passes.

#### If the judges ask
"Why not fix the live_sessions view instead?"
The schema rules say a half-logged-in cookie is still a valid lookup key, so the view means only "not expired, not revoked". Fixing the query matches the admin code and needs no new migration.

Commit: 35f4415

### N04 — Login could open another shop's account

#### The idea
Two shops can have a user with the same email. Login should open the shop whose password you typed. Like two flats with the same family name on the door: your key must open your own flat.

#### The problem
After the password check, the server sent the code and the session to the first user with that email in any shop.
- It searched by email only, with no shop filter.
- An attacker could sign up a new shop with the victim's email and their own password.
- Logging in to their own shop then opened the victim's shop.

#### The fix
- apps/api/src/routes/auth.ts: the code and session now go to the exact user whose password was checked.
- Smallest change: one line, plus removing an import. That user was already loaded two lines above.

#### The code
Before (apps/api/src/routes/auth.ts:78):
```ts
const recipient = await findOtpRecipient(app.db, email) ?? user;
```
After:
```ts
const recipient = user;
```
The new line uses the user found by shop id and email together, so the login always lands in that shop.

#### The proof
- Before: auth.e04.test.ts → fails 3 of 3 runs: the attacker lands in the victim's shop.
- After: auth.e04.test.ts → passes 3 of 3 runs; a live login to Beta Digital shows Beta Digital.

#### If the judges ask
"Why is findOtpRecipient still in the code?"
Nothing calls it now. Removing it would leave an empty file, and deleting files needs Zainab's approval, so it is listed in the log to remove.

Commit: 5e9d46d

### N05 — One shop could cancel another shop's payment link

#### The idea
A payment link is a page a shop sends to a buyer to pay one bill. Like a numbered ticket: only the shop that printed it should be able to tear it up.

#### The problem
Any logged-in shop could cancel any other shop's payment link if it knew the link's id.
- The cancel query matched the link id only, not the shop.
- The error message also told a shop if another shop's link was paid or canceled.

#### The fix
- apps/api/src/paymentLinks/cancel.ts: both queries now also require "this link belongs to the logged-in shop".
- apps/api/src/routes/paymentLinks.ts: passes the logged-in shop's id from the login data, not from the URL.
- Smallest change: one extra condition in each of the two queries.

#### The code
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

#### The proof
- Before: paymentLinks.e05.test.ts → shop A cancels shop B's link and gets 204 (success).
- After: paymentLinks.e05.test.ts → 404, and B's link is still active; the 8 old payment link tests still pass.

#### If the judges ask
"Why answer 404 and not 403?"
403 would tell the attacker "this link exists but is not yours". 404 tells them nothing, and the project's architecture doc asks for 404 on other merchants' objects.

Commit: 5710a31

### N06 — Expired payment links could still be paid (FP-187)

#### The idea
A payment link has an end time. Like a coupon with an expiry date: after that date the shop must refuse it.

#### The problem
The server asked the buyer's browser "when did you press pay?" and believed the answer.
- A buyer could send any old time, for example 2020.
- Then an expired link looked fresh, and the card was charged.
- This is ticket FP-187: "The checkout page sends something the server shouldn't trust."

#### The fix
- apps/api/src/paymentLinks/pay.ts: the expiry check now uses the server's own clock only.
- apps/api/src/routes/paymentLinks.ts: fixed a comment that wrongly said the time was ignored.
- Smallest change: one line. The browser may still send the time, but the server ignores it.

#### The code
Before (apps/api/src/paymentLinks/pay.ts:60):
```ts
const expiryCheckTime = expiryReferenceTime(input.submittedAt);
```
After:
```ts
const expiryCheckTime = new Date();
```
The new line takes "now" from the server, so nobody outside can move the clock back.

#### The proof
- Before: paymentLinks.e06.test.ts → expired link plus submittedAt 2020 → 200 "paid", 4750 fils charged.
- After: paymentLinks.e06.test.ts → 410 "payment_link_expired", and no transaction row.

#### If the judges ask
"What about a buyer who pressed pay one second before expiry on a slow network?"
That payment is refused, which is the safe side for money. The shop can send a new link; trusting the buyer's clock would let anyone pay any expired link.

Commit: 41f2313

### N07 — Rotating an API key did not stop the old key

#### The idea
An API key is a password a shop's software uses to talk to FilsPay. Rotating a key means "give me a new key and kill the old one". Like changing a lock after you lose a key.

#### The problem
The admin "rotate" button made a new key but never killed the old one.
- A leaked key kept working after the admin rotated it.
- A test even checked that the old key still worked, calling it a "grace period" that no document defines.

#### The fix
- apps/api/src/admin/apiKeys.ts: the rotation now marks the old key as revoked, reason "rotated", in the same database transaction.
- apps/api/src/routes/admin.test.ts: the test now expects the old key to fail.
- Smallest change: one UPDATE inside the transaction that already existed.

#### The code
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

#### The proof
- Before: admin.test.ts rotation test (corrected) → the old key still got 200 after rotation.
- After: the old key gets 401; all 41 admin tests pass, including the "audit failure undoes the whole rotation" test.

#### If the judges ask
"You changed an existing test. Isn't that cheating?"
The test protected the bug. The database design (0037:12-14), the code comment (issue.ts:22) and the route comment all say rotation revokes the old key, and the "grace period" it cited does not exist in ADMIN.md.

Commit: 9da617a

### N08 — Anyone could send fake messages "from the bank" (FP-240)

#### The idea
The bank (acquirer) sends FilsPay messages like "this payment is fraud". Each message carries a signature made with a secret only the bank and FilsPay know. Like a sealed letter with a wax stamp.

#### The problem
FilsPay accepted letters with no stamp at all.
- Signature checking was off by default.
- Old stamped letters could be sent again forever (replay).
- With an empty secret, anyone could make a valid stamp.
- So anyone could attach a fake fraud note to any payment.

#### The fix
- apps/api/src/config.ts: signatures are now required by default.
- apps/api/src/webhooks/inboundVerify.ts: an empty secret rejects everything; a timestamp older or newer than 5 minutes is rejected before the compare; the compare is constant-time.
- Old tests that expected unsigned letters to pass were corrected.

#### The code
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

#### The proof
- Before: inboundVerify.e08.test.ts → 3 of 5 fail; the route test accepted an unsigned callback (200, note saved).
- After: inboundVerify.e08.test.ts → 5 of 5 pass; unsigned → 401, replayed → 401, no note saved.

#### If the judges ask
"Can someone still replay a message inside the 5 minutes?"
Yes, the signature alone cannot stop that. The fix for that is a unique callback id, which is entry E27 and is next in our list.

Commit: 602aff0

### N09 — Support staff could give shops free money, and the "two people" check looked at names

#### The idea
A credit is money FilsPay gives a shop, for example after an outage. Big credits need a second person to approve. Like a bank where a large cash withdrawal needs a manager's signature.

#### The problem
The lowest admin role (support) could create credits, and small ones were paid at once.
- The create route checked "is this an admin?" but not "which role?".
- The "second person" check compared display names, which are not unique.
- So one person could approve their own credit by changing their name, and two different people called "Ahmed" blocked each other.

#### The fix
- apps/api/src/routes/adminCredits.ts: creating a credit now needs the finance or super_admin role, like approve and reject.
- apps/api/src/admin/creditApproval.ts: the check compares the admin's unique id.
- Smallest change: one role check and one compared field.

#### The code
Before (apps/api/src/admin/creditApproval.ts:11):
```ts
if (approver.displayName === requester.displayName) {
```
After:
```ts
if (approver.adminUserId === requester.adminUserId) {
```
The new line compares the person, not the name, so nobody can approve their own credit and two people with the same name are not blocked.

#### The proof
- Before: E09 tests → support creates a credit (201); same person with a new name approves; two "Ahmed"s blocked.
- After: support gets 403 and no credit row is written; the id tests pass; all 21 credit tests pass.

#### If the judges ask
"ADMIN.md says support can issue small credits. Why did you block them?"
Small credits are paid at once with no second person, so allowing support breaks the money control. The code comments and the admin website already say support cannot; we recorded the doc conflict for the team to confirm.

Commit: 1f6c885

### N10 — "View as merchant" let senior admins act as the shop owner

#### The idea
Admins can open a shop's dashboard to help with support ("view as merchant"). It should be look-only. Like a building manager who may look into a flat but not sign the tenant's contracts.

#### The problem
Senior admins got real power inside the shop.
- super_admin became the shop "owner", finance became the shop "finance".
- They could create payment links and change where the shop's webhooks go.
- The logs recorded these actions as the shop's own.
- The audit export shows 16 such owner grants by MK and AM, and 16 finance grants.

#### The fix
- apps/api/src/admin/impersonation.ts: every admin role now becomes the look-only "support" role while viewing a shop.
- Smallest change: two words in one table. All write routes already refuse the support role.

#### The code
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

#### The proof
- Before: E10 test → a finance admin viewing a shop created a payment link (201).
- After: E10 test → 403, reading still works; all 42 admin tests pass.

#### If the judges ask
"Is impersonation fully read-only now?"
Not yet: capture and void have no role check at all (entry E35), so they are still open. We recorded that instead of claiming more than we fixed.

Commit: f50a4c3

### N11 — Any shop could read the sales of another shop's sub-shops

#### The idea
A marketplace shop can have sub-shops ("split children") that share its payouts. The parent may see the children's sales reports. Like a mall manager who may see each store's takings, but a stranger may not.

#### The problem
The report check only asked "is this some shop's child?", not "is it YOUR child?".
- Any shop could put a child's id in the report filter.
- It then got up to 500 of that child's transactions.

#### The fix
- apps/api/src/reporting/scope.ts: the check now also requires that the caller is the child's parent.
- apps/api/src/reporting/transactionsReportQuery.ts: fixed a comment that wrongly said the id was always replaced.
- Smallest change: one extra condition in one query.

#### The code
Before (apps/api/src/reporting/scope.ts:13):
```ts
`SELECT 1 AS ok FROM merchant_split_children WHERE child_merchant_id = $1`,
```
After:
```ts
`SELECT 1 AS ok FROM merchant_split_children WHERE child_merchant_id = $1 AND parent_merchant_id = $2`,
```
Now only the real parent gets the child's report; anyone else only ever gets their own data.

#### The proof
- Before: scope.e11.test.ts → an outsider got the child's id back.
- After: scope.e11.test.ts → the outsider gets its own id; the real parent still gets the child.

#### If the judges ask
"Why return the caller's own data instead of an error?"
That is what the function already did for unknown ids, so the API does not reveal which ids are children. We kept the existing behaviour and only closed the hole.

Commit: bfddbe9

### N12 — The nightly cleanup deleted every hold when nothing had expired

#### The idea
A hold reserves money on a card until the payment is taken. A nightly script removes holds that expired. Like a cleaner who should throw out only the milk that is past its date.

#### The problem
On a night with nothing expired, the script deleted every hold.
- It built "delete holds with these ids", but with an empty list the "with these ids" part was dropped.
- The command became "delete all holds".

#### The fix
- scripts/lib/sqlFilter.ts: an empty list is now kept as a filter that matches nothing.
- Smallest change: remove one line. It also protects any other script that uses this helper.

#### The code
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

#### The proof
- Before: live run on a database copy with 4 valid holds → "matched 0, deleted 4", 0 holds left.
- After: "matched 0, deleted 0", 4 holds left; with one expired hold, exactly 1 is deleted.

#### If the judges ask
"Is the script fully safe now?"
The empty-list disaster is fixed. A small race remains (a hold captured between the check and the delete), and the handover says holds should be marked expired, not deleted; both are recorded as open.

Commit: b3d6e94

### N13 — No refund could ever be saved

#### The idea
When a shop gives money back, the system saves a refund row with a reason. Like a shop receipt that must have a "reason for return" box filled in.

#### The problem
Every refund crashed when it was saved.
- A database rule says the reason may not be empty (migration 0070).
- The code wrote "empty" on purpose when no reason was given.
- The rule's default value only works when the field is left out, not when it is set to empty.

#### The fix
- apps/api/src/payments/processRefund.ts: when no reason is given, write "unspecified".
- Smallest change: one value in one line.

#### The code
Before (apps/api/src/payments/processRefund.ts:189):
```ts
input.reason ?? null,
```
After:
```ts
input.reason ?? "unspecified",
```
The new value fills the reason box with "unspecified", which is the same default the database rule already expects.

#### The proof
- Before: 11 refund tests failed with "violates check constraint chk_refunds_reason_not_null".
- After: those 11 tests pass.

#### If the judges ask
"Why not just remove the database rule?"
The rule protects the records: every refund should have a reason. The code was wrong, not the rule.

Commit: 397d79d

### N14 — Refunds could pay out twice, too much, or for another shop

#### The idea
A refund sends money back to the buyer's card and takes it from the shop's balance. Like a cashier giving back cash: check the receipt, lock the till, then pay, all in one go.

#### The problem
The refund code checked, paid and wrote down in three separate steps, with no lock.
- Two refund clicks at the same time both passed the check (ticket FP-209): double money out.
- It allowed refunding the authorized amount, not only what was captured.
- It did not check that the transaction belongs to the shop asking.
- The fee given back ignored the shop's discount, and partial refunds did not add up to the fee.

#### The fix
- apps/api/src/payments/processRefund.ts: one database transaction that locks the payment row (and only the shop's own row) and keeps the lock while the bank is called, exactly like capture already does.
- Refund at most what was captured; give back only the net fee the shop paid, and let the last refund take exactly what is left.
- apps/api/src/refunds/initiateMerchantRefund.ts: look up only the caller's own transaction.

#### The code
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

#### The proof
- Before: two parallel refunds → both 200; refund 10000 on a 4000 capture → 200; another shop → 200; partial refunds → 249 of 250 fee; discounted shop → 250 instead of 200.
- After: [200, 422]; 422; 404; 250 of 250; 200. All 24 refund tests pass.

#### If the judges ask
"Doesn't holding a lock during the bank call make it slow?"
Only for refunds on that one payment, and capture already works this way on purpose (capture.ts:77-85). Money correctness comes before speed here.

Commit: 68fd1bf

### N15 — Refunds can now be made through the API

#### The idea
A shop needs one web address to ask "refund this payment". Like a returns desk: one counter, staffed only by people allowed to give money back.

#### The problem
The refund address only answered "501 not implemented".
- The refund logic existed but nothing called it.
- An old draft made a new safety key on every request, which would let a retry refund twice.

#### The fix
- apps/api/src/routes/refunds.ts: a real route at /v1/merchants/:merchantId/refunds. Only owner or finance users (or the shop's API key) may use it. The client must send its own Idempotency-Key. Amounts must be whole fils; the reason is at most 500 characters.
- apps/api/src/app.ts: the route is mounted with the other shop routes.

#### The code
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

#### The proof
- Before: refunds.f01b.test.ts → every call got 404 (no route existed).
- After: 7 tests pass: refund 1.250 BD → 200 with 31 fils fee back; same key → same answer, one refund; support user → 403; other shop → 403; refund shows in the timeline as −1250.

#### If the judges ask
"Why does the client have to send the Idempotency-Key?"
Only the client knows that two clicks are the same request. A key made by the server is new every time, so it cannot stop a double refund.

Commit: f84083a, 8f05f9e

### N16 — Shops now get a webhook when a refund succeeds

#### The idea
A webhook is a message FilsPay sends to the shop's own server when something happens. Like a text message from your bank after a payment.

#### The problem
Refunds never sent a message.
- The refund event was saved, but the sender's allowlist did not include it.
- Adding it to the list alone would crash the sender, because there was no message format for it.

#### The fix
- apps/api/src/webhooks/envelope.ts: a message format for refund.succeeded, field by field.
- apps/api/src/webhooks/dispatcher.ts: refund.succeeded added to the allowlist, after the format exists.

#### The code
Before (apps/api/src/webhooks/dispatcher.ts:28-32):
```ts
const WEBHOOK_ELIGIBLE_EVENT_TYPES = ["transaction.captured", "transaction.voided", "settlement.paid"];
```
After:
```ts
const WEBHOOK_ELIGIBLE_EVENT_TYPES = ["transaction.captured", "transaction.voided", "settlement.paid", "refund.succeeded"];
```
Refund events now go out, using a fixed public shape (refundId, amountFils, feeReversedFils, status and more).

#### The proof
- Before: refundWebhook.f01c.test.ts → only "transaction.captured" was delivered.
- After: "refund.succeeded" is delivered with amountFils 1250.

#### If the judges ask
"Why not just send the saved event as it is?"
The webhook is a contract shops write code against. A field-by-field mapping keeps internal fields private and lets us change internals without breaking shops.

Commit: 079aeea

### N17 — The compose secrets file is no longer in git

#### The idea
Git keeps every file you give it, forever, for everyone who copies the repo. A secrets file in git is like a house key taped to the front door.

#### The problem
ops/.env.docker was tracked by git, but its own comment says it is ignored.
- It holds the acquirer callback signing secret.
- Anyone with the repo could sign fake acquirer callbacks.

#### The fix
- git rm --cached ops/.env.docker: git stops tracking it, but the file stays on disk.
- .gitignore: ops/.env.docker added, so it cannot be added again by mistake.
- ops/.env.docker.example: the same names, with no secret value.

#### The code
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

#### The proof
- Before: git ls-files ops → ops/.env.docker is listed; git check-ignore → exit 1 (not ignored).
- After: git ls-files ops → no .env.docker; git check-ignore → .gitignore:11:ops/.env.docker.

#### If the judges ask
"Is the secret safe now?"
No. It is still in old commits since 669af52, so a human must rotate it. Untracking only stops new copies.

Commit: 3145f24

### N18 — Refunds now lower the shop's payout

#### The idea
Every day, FilsPay adds up a shop's sales, takes its fee, and pays the rest. This is the batch. It is like a cashier counting the till at closing time.

#### The problem
The daily count only looked at sales, never at refunds.
- A shop that refunded 1.250 BD was still paid as if the sale stood.
- After a fee change, the recalculation also rebuilt the payout as sales minus fee, so it would bring the refund back.

#### The fix
- New migration 0073: each batch stores its refund total and the fee given back.
- refund_batch.go (new): picks the shop's refunds not yet counted, oldest first, while the payout stays at 0 or more. The rest wait for the next day.
- batch.go: subtracts those refunds and marks each refund with the batch id, so it counts once.
- recalculate_mdr.go: moves the payout only by the fee change.

#### The code
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

#### The proof
- Before: Go test → NetPayoutFils = 9750, want 8531.
- After: 4 Go tests pass. A real refund through the API, then the real batch: payout 8531, and the shop's balance in the ledger ends at exactly 0 fils.

#### If the judges ask
"What if refunds are bigger than the day's sales?"
We never pay a negative amount. The refund that does not fit waits, and the next day's batch takes it. No fils are lost.

Commit: 6ff2ffb

### N19 — Refunds now show in the reports and in reconciliation

#### The idea
Reports count what happened each day. Reconciliation checks that two records agree, like matching your bank statement against your receipts.

#### The problem
Refunds were invisible in reports, and they broke reconciliation.
- The report worker did not listen for refunds, and its refund code wrote columns that did not exist.
- The refund summary view joined on the wrong id, so it was always empty.
- A refund not yet paid out showed as a 1.219 BD gap nobody could explain.

#### The fix
- Migration 0074: refund columns in the daily report, and the view rebuilt with the right join.
- Report worker: listens for refund.succeeded and counts it on the Bahrain date. The admin rebuild counts refunds too.
- Reconciliation: a refund waiting for a later batch counts as pending; a refund from an earlier day inside this period's batch is matched too.
- The batch API now shows refundFils and feeReversedFils.

#### The code
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

#### The proof
- Before: reconciliation gapFils -1219; the view had 0 rows; "column refund_count does not exist".
- After: 7 new tests pass. A live run of the real report worker shows 1 sale of 10000 fils and 1 refund of 1250 fils on 30 Oct.

#### If the judges ask
"Why does reconciliation need two refund numbers?"
A refund can wait a day before a batch takes it. So one day has the refund in the ledger but not in a batch, and the next day has it in a batch but not in the ledger. One number covers each side.

Commit: 9afd98d

### N20 — The CSV import reads Bahraini Dinars with 3 decimals

#### The idea
Finance uploads a CSV file to fix balances by hand. Each row has an amount in BD. 1 BD is 1000 fils, so BD has 3 decimals, not 2 like dollars.

#### The problem
The import read amounts as if they had 2 decimals.
- 4.75 BD was saved as 475 fils, ten times too small.
- 4.755 BD lost its last digit and became 475 fils too.

#### The fix
- adjustmentCsvParsing.ts: use parseBhdToFils, the BD parser that already exists in the money package.
- Old tests that expected the wrong numbers were corrected.

#### The code
Before (apps/api/src/admin/adjustmentCsvParsing.ts:8):
```ts
return toFils(parseDecimalMinor(raw), { allowNegative: true });
```
After:
```ts
return parseBhdToFils(raw);
```
parseBhdToFils reads up to 3 decimals and multiplies by 1000 with whole numbers only. A 4th decimal is now an error, not silently cut.

#### The proof
- Before: 4.755 → 475 fils; 4.7555 was accepted.
- After: 4.755 → 4755, 4.75 → 4750, -3.50 → -3500; 4.7555 is rejected. A read-only query lists any old rows that were saved wrong.

#### If the judges ask
"What about money that was already imported wrong?"
We do not edit old ledger rows. The read-only query lists each wrong row and the missing fils, so finance can post a new correcting adjustment.

Commit: 2f06eb4

### N21 — The daily close now starts just after Bahrain midnight

#### The idea
Every night a timer closes the day that just ended and pays the shops. It is like a shop that counts the till right after closing time.

#### The problem
The timer read the clock in UTC, which is 3 hours behind Bahrain.
- From midnight to 3 AM in Bahrain, UTC still showed yesterday's date.
- So the day that just ended was only closed at about 3:15 AM.

#### The fix
- window.go: a new helper, BusinessDateOf, gives the Bahrain date of any moment.
- daemon.go: the "what is due now" check uses that Bahrain date first. The check is now a small function we can test.

#### The code
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

#### The proof
- Before: at 00:15 Bahrain on 31 Oct, the check picked 29 Oct.
- After: it picks 30 Oct. At 00:05 it waits for the grace period. At 11 PM it still closes the day before.

#### If the judges ask
"Why not fix BusinessDayWindow itself?"
Every other caller gives it a plain date, and that works. Only the timer gave it a clock time, so we fixed the timer and kept the shared function's promise.

Commit: 7af14ce

### N22 — The scheme file no longer rounds up

#### The idea
Each day we send the card scheme a file with one line per payment. Both sides must add up to the same total, like two people checking the same receipt.

#### The problem
Each line stored two amounts that did not match.
- amount_fils was cut down to 10 fils (39705 → 39700).
- The BD amount in the file came from the uncut number and was rounded up (39.705 → 39.71).
- So the scheme total was always a few fils higher than ours.

#### The fix
- batch.go: the BD amount is now amount_fils / 1000, from the same cut number, in whole-number math inside SQL.

#### The code
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

#### The proof
- Before: 39705 fils → file amount 39.71 (10 fils over).
- After: 39705 fils → 39700 fils and 39.70 BD. A read-only query lists old lines that were over.

#### If the judges ask
"Where do the 5 cut fils go?"
That is a separate question (the rounding residue, E16). This fix only makes the file match our own number, as ADR-0002 says.

Commit: 01eee15

### N23 — Split payouts now add up to the parent's total

#### The idea
Some shops (like a marketplace) split their daily payout between child shops by fixed shares, like 50%, 30% and 20%. It is like cutting a cake into agreed pieces.

#### The problem
Each child's piece was rounded on its own.
- With a payout of 3 fils, the pieces were 2, 1 and 1: 4 fils paid out of 3.
- With 1 fil, every piece was 0, so 1 fil vanished.

#### The fix
- shares.go: largest remainder. Every child gets the rounded-down share, then the few fils left go one each to the children with the biggest leftovers.
- allocate.go: the payout uses that one calculation for all children.

#### The code
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

#### The proof
- Before: net 3 with 50/30/20 paid 4 fils, and the shop's cached balance went to -1.
- After: net 3 pays exactly 3. Many amounts and weights all add up exactly.

#### If the judges ask
"Who gets the extra fil?"
The child whose exact share was closest to the next fil. The same rule as the allocateRemainder helper in our money package.

Commit: 2327ed9

### N24 — The daily payout is computed in whole fils

#### The idea
The payout is sales minus fees. Money must be counted in whole fils, like counting coins, never as a rough decimal.

#### The problem
The payout was computed with float32, a number type with only about 7 exact digits.
- A batch of 135,000.123 BD minus a 3,375.003 BD fee gave 131,625.125 BD.
- The right answer is 131,625.120 BD, so 5 fils were invented.

#### The fix
- payable.go: subtract the two whole-fils numbers directly.

#### The code
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

#### The proof
- Before: NetPayableFils(135000123, 3375003) = 131625125.
- After: 131625120.

#### If the judges ask
"Why did nobody notice?"
Small batches are exact in float32. Only big batches (above about 16,777 BD) drift, and only by a few fils.

Commit: 2db05e0

### N25 — The March sweep can be run again safely

#### The idea
The March sweep is a one-time script. It moves tiny rounding leftovers into a special account, like sweeping crumbs into one bin.

#### The problem
Running it twice swept twice.
- Each run made new ledger rows with a new random id, so the gap doubled.
- It also used UTC months, so the first 3 hours of March (Bahrain time) were missed and 3 hours of April were included.

#### The fix
- A Postgres lock: two runs cannot happen at the same time.
- Before posting, it checks if this merchant was already swept for March. If yes, it skips.
- Month bounds now start at Bahrain midnight.

#### The code
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

#### The proof
- Before: two runs made 4 ledger rows for one merchant.
- After: two runs make 2 rows; the real script's second run says "skipped".

#### If the judges ask
"Was production swept twice?"
We cannot see production. A read-only count of sweep rows per merchant answers it: more than 2 rows means it ran more than once.

Commit: d69061a

### N26 — The balance button and the CLI now agree

#### The idea
Each shop has a saved balance (a cache) so pages load fast. If it drifts, staff can rebuild it, either with a button in the admin site or with a command-line tool (CLI).

#### The problem
The button and the CLI counted from different places.
- The CLI adds up the ledger: sales, fees, payouts, refunds.
- The button added up the scheme file lines: sales only, before fees and payouts. So Alpha Retail went from 135K to 7K.
- The CLI's one-shop mode printed the right number but never saved it.

#### The fix
- server.go: the button now runs the same ledger rebuild as the CLI.
- rebuild.go: the one-shop rebuild now saves the number in the same SQL statement.

#### The code
Before (apps/settlement/internal/internalapi/server.go:268):
```go
diffs, err := ledger.RefreshBalanceCache(r.Context(), pool)
```
After:
```go
diffs, err := ledger.RebuildAllBalances(r.Context(), pool)
```
One source of truth for the balance: the ledger.

#### The proof
- Before: button 10000, CLI 9750 for the same shop; the one-shop rebuild left 135000 in the cache.
- After: both give 9750; the one-shop rebuild saves 7000.

#### If the judges ask
"Why keep the old function?"
Nothing calls it now. We do not delete code without Zainab's OK; it is recorded in the log.

Commit: b15f944

### N27 — Fee recalculation no longer changes paid batches

#### The idea
When finance changes a shop's fee, a tool recalculates fees on recent batches. A batch that was already paid is history, like a receipt already handed over.

#### The problem
The tool picked every batch that was not "open".
- That includes "paid" batches.
- So it rewrote the fee and payout of money already sent, and posted ledger rows against them.

#### The fix
- recalculate_mdr.go: pick only "closed" batches (closed but not yet paid).

#### The code
Before (apps/settlement/internal/settlement/recalculate_mdr.go:67):
```sql
AND status <> 'open'
```
After:
```sql
AND status = 'closed' -- E19: never a paid batch ('<> open' included paid)
```
"Not open" meant "closed or paid". Now it means only "closed".

#### The proof
- Before: a paid batch's fee went from 250 to 300 fils and 2 ledger rows were posted against it.
- After: the paid batch stays the same; the unpaid batch is still recalculated.

#### If the judges ask
"Does it now use the right fee table?"
Not yet. That part (fee schedules and volume tier) is still open and linked to E20. We fixed the part the settlement team said must never happen.

Commit: 23e2f73

### N28 — The admin status tool no longer turns test shops live

#### The idea
Test shops (test_mode) are fake shops for trying things out. Settlement skips them, so no real money is paid. It is like a practice till that is never counted.

#### The problem
An admin tool that tidies payment statuses also changed the test flag.
- It switched test_mode off when a shop had "no open authorizations".
- That count was always 0, because the tool never looked at authorized payments.
- So every test shop it touched went live and joined the real settlement run.

#### The fix
- adminMerchantsRecompute.ts: the tool no longer touches the test flag at all.
- transactionStatusRecompute.ts: it also leaves chargeback payments alone.

#### The code
Before (apps/api/src/routes/adminMerchantsRecompute.ts:27):
```ts
const flagsUpdated = await reconcileSandboxFlag(client, request.params.id, recompute);
```
After:
```ts
const flagsUpdated: string[] = [];
```
A status clean-up now only changes statuses, nothing else.

#### The proof
- Before: after the tool ran, the test shop had test_mode = false.
- After: test_mode stays true, and the chargeback stays a chargeback.

#### If the judges ask
"How does a test shop go live now?"
Through an explicit go-live step, not as a side effect. That choice is marked for Zainab to review.

Commit: 41c17e8

### N29 — One payment link can only be paid once, even when payment is slow

#### The idea
A payment link is a page a shop sends a buyer to pay one fixed amount. When a buyer starts paying, the link is "reserved" for a short time, like a "taken" sign on a restaurant table.

#### The problem
The "taken" sign expired after 60 seconds, even if the first payment was still running.
- A second buyer could take the link and pay too: two cards charged for one link (incident 2026-05-14).
- The first request then still answered "paid".

#### The fix
- Each reservation gets its own secret token (migration 0075).
- From the ownership check to the end of capture, the request holds a database lock on the link row, so nobody can take it mid-payment.
- A buyer who arrives during that time gets "processing" (409) at once.
- If the first request lost its claim before taking money, it cancels (voids) its authorization.

#### The code
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

#### The proof
- Before: two buyers at once → both charged, both told "paid".
- After: one is charged, the other gets 409. Also with a 500 ms slow capture. 3 runs out of 3.

#### If the judges ask
"Did the reviewer find anything?"
Yes, twice. My first fix only noticed a double charge during a slow capture, and my second could use up the database connections. Both were fixed and tested.

Commit: ad472fc

### N30 — A paid batch is announced and paid out only once

#### The idea
When a batch is paid, the system tells the shop (a "settlement.paid" message) and writes a payout instruction for the bank. Each should happen once, like one receipt per purchase.

#### The problem
Two things could make copies.
- The daemon and the command-line tool could check "already announced?" at the same moment; both saw "no" and both announced (incident 2026-08-21).
- The payout instruction was written once per webhook delivery, so a shop with two webhook addresses got two instructions.

#### The fix
- payout_notify.go: the check and the insert run inside one transaction that takes a named lock, so two processes take turns.
- payoutDisbursement.ts: a per-batch lock, and insert only if no instruction exists yet.

#### The code
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

#### The proof
- Before: two processes at once → up to 20 of 30 batches announced twice; one batch got 3 payout instructions.
- After: every batch once, in 3 runs out of 3.

#### If the judges ask
"Why not a unique index?"
It would fail to create on a database that already has the duplicates from the incident. Cleaning those up means deleting rows, which needs a human. The choice is marked for Zainab.

Commit: 8d56ba7

### N31 — The dashboard shows the fee that is really charged

#### The idea
Each shop has a fee rate history (fee schedules). Each row says "from this date, the rate is X". Like a price list with start dates.

#### The problem
The dashboard and the payment code picked different rows.
- Payments use the newest row that has already started (225 bps).
- The dashboard used the row typed in most recently, even a backfill for an old period (245 bps), or even a future rate.
- The Go settlement code had no rule for two rows with the same start date.

#### The fix
- currentFeeScheduleDisplay.ts: the same rule as payments: newest start date already reached, ties by newest entry.
- fee_schedule.go: the same tie-break.

#### The code
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

#### The proof
- Before: dashboard 150 (a future rate), payments 225; Go picked 200 instead of the later correction 210.
- After: dashboard 225 = payments 225; Go picks 210.

#### If the judges ask
"What about the discount?"
That is E50, still open: the discount is applied three different ways, and choosing the right one is a business decision.

Commit: 5b2599c

### N32 — The same correction file cannot be applied twice

#### The idea
Finance uploads CSV files to correct balances. Each file should count once, like a cheque that can only be cashed once.

#### The problem
Nothing stopped a second upload of the same file.
- A comment said the filename was unique. It was not, and a renamed copy ("march (1).csv") would pass anyway.
- Every row would be posted to the ledger again.

#### The fix
- Migration 0076: a fingerprint column (SHA-256 of the rows) with a unique index.
- adjustmentImport.ts: compute the fingerprint; if it already exists, answer 409 before posting anything.

#### The code
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

#### The proof
- Before: the second upload was accepted.
- After: the second upload gets 409, and the ledger has one posting.

#### If the judges ask
"What if finance really wants the same correction twice?"
Change the reason text, and it is a different file. This is marked for Zainab to review.

Commit: c32a3d4

### N33 — Two money counters now use big whole numbers

#### The idea
Some totals keep growing forever: a shop's lifetime payout, and the platform's total volume. A counter needs to be big enough, like a car odometer that must not roll back to zero.

#### The problem
Both counters used number types that are too small.
- The lifetime payout used float32 (about 7 exact digits): 1000 payouts of 123.457 BD gave 123,456.136 BD.
- The platform volume used a 32-bit integer. Just past the 2,000,000 BD discount threshold it rolled over to a negative number, which would switch the volume discount off.

#### The fix
- Migration 0077: both columns become BIGINT (64-bit whole numbers).
- payout_estimate.go and platform_volume.go: use int64.
- platformVolumeTier.ts: turn the BIGINT text into a number.

#### The code
Before (apps/settlement/internal/settlement/platform_volume.go:26):
```go
updated := current + int32(batchGrossFils)
```
After:
```go
updated := current + batchGrossFils
```
64-bit whole numbers go up to about 9 quintillion fils, so no roll-over.

#### The proof
- Before: 1,999,000,000 + 200,000,000 = -2,095,967,296; lifetime estimate 123,456,136.
- After: 2,199,000,000 and exactly 123,457,000.

#### If the judges ask
"These are only monitoring numbers. Why fix them?"
The volume counter is not only monitoring: it decides the 0.15% fee discount for every shop. A negative value would silently remove it.

Commit: effaf33

### N34 — The same bank message is saved only once

#### The idea
The bank (acquirer) sends messages later about a payment, like a fraud check result. FilsPay saves each one as a note on the payment.

#### The problem
The bank sometimes sends the same message twice, and the code also retries.
- Each copy became a new note, so one payment showed two identical notes (FP-201, "fixed" in 1.9.0 but not really).
- A commit called "callbacks are deduplicated now" changed no files.

#### The fix
- callbacks.ts: a lock per message id, then save only if that message id is not saved yet.

#### The code
Before (apps/api/src/acquirer/callbacks.ts:37-40):
```sql
INSERT INTO acquirer_callback_notes (...) VALUES ($1, ..., $7)
```
After:
```sql
INSERT INTO acquirer_callback_notes (...) SELECT $1, ..., $7
 WHERE NOT EXISTS (SELECT 1 FROM acquirer_callback_notes WHERE callback_id = $3)
```
A second copy finds the first one and is skipped.

#### The proof
- Before: two copies at once plus one later made 3 notes.
- After: 1 note.

#### If the judges ask
"Why not a unique index?"
Production already has duplicate notes, so the index would fail to create until someone deletes them. That clean-up needs a human.

Commit: 8fd0c90

### N35 — The settlement summary no longer counts part-payments twice

#### The idea
A shop can capture a payment in parts, like paying a bill in two steps. The summary page shows how much was captured in a period.

#### The problem
The summary added the payment's running total once for every part.
- A 10 BD payment captured as 4 + 6 showed 20 BD.

#### The fix
- query.ts: add up each part's own amount instead.

#### The code
Before (apps/api/src/settlement/query.ts:375-379):
```sql
SELECT t.id, t.captured_fils ... JOIN transaction_events te ...
SELECT COUNT(DISTINCT id), SUM(captured_fils) FROM captured
```
After:
```sql
SELECT COUNT(DISTINCT te.transaction_id), SUM(te.amount_fils)
  FROM transaction_events te JOIN transactions t ON t.id = te.transaction_id
```
Each capture event counts its own amount, once.

#### The proof
- Before: 4 + 6 BD captured → summary 20 BD.
- After: 10 BD.

#### If the judges ask
"Is it faster now?"
The doubled rows are gone, but we did not measure speed: we have no production-size data here.

Commit: 0be550a

### N36 — Webhooks now send exactly what they sign

#### The idea
Each webhook carries a signature, like a wax seal. The shop recomputes the seal from the message it received; if it matches, the message really came from FilsPay.

#### The problem
FilsPay sealed one version of the message and sent another.
- It signed the JSON with keys in sorted order.
- It sent the JSON in the database's key order.
- So every shop's check failed (FP-240a), even for the "send test event" button.

#### The fix
- dispatcher.ts and testSend.ts: send the exact sorted string that was signed.

#### The code
Before (apps/api/src/webhooks/dispatcher.ts:173):
```ts
body: JSON.stringify(row.payload),
```
After:
```ts
body: canonicalJson(row.payload),
```
The body is now byte-for-byte the string inside the signature.

#### The proof
- Before: a shop-side HMAC over the raw body did not match the header.
- After: it matches, for real deliveries and for the test button.

#### If the judges ask
"Does sorting the keys change the meaning?"
No. JSON objects have no order; only the bytes change, and now the bytes match the seal.

Commit: 8c76fb8

### N37 — Login codes and secret links now use secure randomness

#### The idea
OTP codes, payment-link tokens and admin invite codes are secrets. They must be impossible to guess, like a lottery draw nobody can predict.

#### The problem
They were made with Math.random.
- Math.random is fast but predictable: after seeing enough outputs, an attacker can work out the next ones.
- A comment and ARCHITECTURE.md both claimed a secure source was used. It was not.

#### The fix
- random.ts: use crypto.randomInt, a cryptographic source.
- inviteCode.ts: admin invite codes use the same helper (they had their own Math.random loop).

#### The code
Before (apps/api/src/lib/random.ts:4):
```ts
return Math.floor(Math.random() * max)
```
After:
```ts
return randomInt(0, max)
```
randomInt comes from Node's crypto module and is safe for secrets.

#### The proof
- Before: with Math.random forced to 0, all 20 OTP codes were the same.
- After: they still differ, so the code no longer depends on Math.random.

#### If the judges ask
"How can a test prove randomness?"
It cannot prove "random", but it proves the source: if the code still used Math.random, fixing Math.random would freeze the output.

Commit: 971474c

### N38 — Five wrong login codes really means five

#### The idea
After the password, the user types a 6-digit code (OTP). Only 5 wrong tries are allowed, like a card that locks after a few wrong PINs.

#### The problem
The limit could be skipped.
- The code read the try count, checked the guess, and only then added one. 50 guesses sent at once all saw "0 tries" and 48 were checked.
- "Resend code" started a new code with 0 tries, so the limit reset every 30 seconds.
- The admin login had the same problem; its comment said the row was locked. It was not.

#### The fix
- auth.ts and adminAuth.ts: one database statement adds the try first, and only if fewer than 5 were used. Only then is the guess checked.
- A code that was already used (for example a double-click) gets "expired" and does not log the user out.
- Resend carries the try count to the new code.

#### The code
Before (apps/api/src/routes/auth.ts:158-167):
```ts
if (challenge.attempt_count >= challenge.max_attempts) { ... }
const matches = verifyOtpCode(code, challenge.code_salt, challenge.code_hash);
if (!matches) { await app.db.query(`UPDATE otp_challenges SET attempt_count = attempt_count + 1 ...`) }
```
After:
```ts
`UPDATE otp_challenges SET attempt_count = attempt_count + 1
  WHERE id = $1 AND consumed_at IS NULL AND attempt_count < max_attempts AND expires_at > now()
  RETURNING id`
```
The database hands out at most 5 "try tickets", even to 50 requests at once.

#### The proof
- Before: 50 parallel guesses → 48 checked; after a resend, 5 more tries.
- After: at most 5 checked; after 3 wrong and a resend, only 2 more. A double-click on the right code stays logged in.

#### If the judges ask
"Why does the right code also use a try?"
The try is taken before we know if the guess is right; that is what makes it safe. A user who gets it right on try 5 still logs in.

Commit: 31b2741

### N39 — Only owners and finance can capture or void payments

#### The idea
Shop staff have roles: owner, finance and support. Support staff help customers; they should not move money. Like a shop where only the manager can open the till.

#### The problem
Capture (take the money) and void (cancel the hold) had no role check.
- Any shop user, including support, could do both.
- Comments said admin impersonation was read-only there; it was not.

#### The fix
- transactions.ts: both routes now require the owner or finance role.

#### The code
Before (apps/api/src/routes/transactions.ts:95):
```ts
{ preHandler: requireMerchantAuth },
```
After:
```ts
{ preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
```
The request must be logged in and have one of the two roles.

#### The proof
- Before: a support user captured 5.000 BD.
- After: support gets 403 on capture and void; finance can still capture.

#### If the judges ask
"What about admins impersonating a shop?"
Since E10 every impersonation counts as the support role, so they get 403 too.

Commit: 2b3c0c7

### N40 — Webhook addresses can no longer point inside our network

#### The idea
A shop gives us a URL, and our server sends webhooks to it. If the URL points at our own internal machines, our server becomes the attacker's messenger. This is called SSRF (server-side request forgery).

#### The problem
Only "http or https" was checked.
- A URL like https://169.254.169.254/ (the cloud's secret metadata address) or https://127.0.0.1/ was accepted.
- Redirects were followed, so even a good-looking URL could bounce inside.
- The test-send button shows the first 2 KB of the answer, so internal data could leak back.

#### The fix
- ssrfGuard.ts (new): a list of private and local addresses, in every way they can be written.
- create.ts: in production, such URLs are refused when the endpoint is created.
- transport.ts: in production, the name is looked up just before sending and refused if it points inside; redirects are not followed; at most 64 KB of the answer is read.

#### The code
Before (apps/api/src/webhooks/transport.ts:40):
```ts
const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: controller.signal });
```
After:
```ts
if (isBlockedHostname(host) || addresses.some((a) => isPrivateAddress(a.address))) {
  return { statusCode: null, body: "", errorMessage: "blocked: webhook URL resolves to a private address" };
}
const response = await fetch(req.url, { ..., redirect: "manual" });
```
We check where the name really points, refuse inside addresses, and never follow a redirect.

#### The proof
- Before: 127.0.0.1 accepted; a redirect to /internal was followed.
- After: all private forms refused (also tricky ones like [::ffff:127.0.0.1]); the redirect is not followed.

#### If the judges ask
"Did the reviewer find anything?"
Yes: [::ffff:127.0.0.1] is rewritten by the URL parser into hex, and my first check missed it. It is fixed and in the test.

Commit: fb51fca

### N41 — Login codes are no longer shown unless a developer asks

#### The idea
For local testing, the app can show the OTP code in the login answer and the log, so developers do not need real SMS. This must never happen on a real server.

#### The problem
It was on by default whenever NODE_ENV was not "production".
- NODE_ENV defaults to "development", and the hosted setup never set it (E02).
- So anyone with a password got the OTP code back in the response. The second factor did nothing.

#### The fix
- config.ts: OTP exposure is off unless OTP_DEV_EXPOSE=true is set on purpose.
- Both notifiers: log the code only in that case.

#### The code
Before (apps/api/src/config.ts:210):
```ts
otpDevExpose: parseBoolEnv(env.OTP_DEV_EXPOSE, nodeEnv !== "production"),
```
After:
```ts
otpDevExpose: parseBoolEnv(env.OTP_DEV_EXPOSE, false),
```
Safe by default: a forgotten setting now hides the code instead of showing it.

#### The proof
- Before: with no settings, exposure was on and codes were in the log.
- After: off by default; on only with OTP_DEV_EXPOSE=true.

#### If the judges ask
"Doesn't this break local development?"
Developers set OTP_DEV_EXPOSE=true in their own environment; all tests already do.

Commit: f588a09

### N42 — The CSV export is safe to open and cannot eat all memory

#### The idea
Shops download their payments as a CSV file and open it in Excel. A cell that starts with "=" is run by Excel as a formula, like a hidden instruction.

#### The problem
- A payment reference like =HYPERLINK("http://evil...") went into the file unchanged, so opening it could run the attacker's formula (CSV injection).
- The export loaded every row into memory with no limit, so a huge export could crash the server.

#### The fix
- exportCsv.ts: cells starting with = + - @ get a leading ' so Excel shows them as text.
- exportCsv.ts: at most 50,000 rows; above that the answer is 413 "narrow the date range".

#### The code
Before (apps/api/src/transactions/exportCsv.ts:12-13):
```ts
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
```
After:
```ts
if (/^[=+\-@\t\r]/.test(value)) {
  value = `'${value}`;
}
```
The leading ' tells the spreadsheet "this is text".

#### The proof
- Before: the =HYPERLINK cell was written as a live formula; no row limit.
- After: it starts with '; 3 rows with a limit of 2 gives 413.

#### If the judges ask
"Why a limit and not streaming?"
A limit is the smallest safe change. The old streaming code was unused and skips rows with the same time; switching to it is marked for Zainab to decide.

Commit: 3918ae8

### N43 — The report worker no longer crashes on an empty day

#### The idea
The report worker reads events one batch at a time. If one event fails, the whole batch is undone and tried again, like a cashier recounting a till from the start.

#### The problem
When a settlement batch closed, the worker compared it with the daily report row.
- If that row did not exist yet, the code read a field from "nothing" and crashed.
- The batch was undone and retried, crashed again, forever. All reports behind it stopped.

#### The fix
- applyEvent.ts: a missing row counts as 0, and the worker logs a warning instead of crashing.

#### The code
Before (apps/reporting/src/consumer/applyEvent.ts:147-148):
```ts
const rollup = rollupResult.rows[0] as { captured_count: number };
if (rollup.captured_count < groundTruthCount) {
```
After:
```ts
const rolledUp = Number((rollupResult.rows[0] as { captured_count?: number } | undefined)?.captured_count ?? 0);
if (rolledUp < groundTruthCount) {
```
"No row" now means "0 counted so far", which is exactly a lag to warn about.

#### The proof
- Before: TypeError: Cannot read properties of undefined (reading 'captured_count').
- After: no crash, and the payout trend row is still written.

#### If the judges ask
"Is this the same as E53?"
No. E53 is a bad event payload (still open); this was a missing report row for a good event.

Commit: 44adee8

### N44 — One bad event no longer stops all reports

#### The idea
The report worker reads a queue of events (payments, voids, refunds). It is like a post office sorting letters in order.

#### The problem
One letter with no address stopped the whole post office.
- An event with an empty payload made the database insert fail.
- The whole batch was undone and the same bad event was picked first again, forever.
- Every report after it stopped updating.

#### The fix
- applyEvent.ts: check the event (merchant id, amount) before writing.
- runConsumerPass.ts: each event gets its own savepoint. A bad event is moved to a "dead letters" table (migration 0078) and the worker continues.
- Real outages (database down) still stop the batch, so no good event is parked by mistake.

#### The code
Before (apps/reporting/src/consumer/runConsumerPass.ts:59):
```ts
for (const row of eventsResult.rows) {
  await applyEvent(client, row);
```
After:
```ts
await client.query("SAVEPOINT apply_event");
try { await applyEvent(client, row); await client.query("RELEASE SAVEPOINT apply_event"); }
catch (err) { if (!isDataError(err)) throw err; await client.query("ROLLBACK TO SAVEPOINT apply_event"); /* park it */ }
```
A savepoint undoes only that one event, not the whole batch.

#### The proof
- Before: 4 reporting tests failed every time in the shared test database.
- After: all 15 reporting tests pass there; a bad event before a good one no longer blocks it.

#### If the judges ask
"Where do bad events go?"
To reporting_dead_letters with the error message, so a person can inspect and replay them.

Commit: 41c9754

### N45 — The report worker can no longer skip a slow payment's event

#### The idea
The report worker remembers "I have read every event up to number N", like a bookmark in a book.

#### The problem
Event numbers are given out when a payment starts saving, not when it finishes.
- A slow payment could take number 10, while a fast one took 11 and finished first.
- The worker read 11 and moved its bookmark past 10. When 10 finished, it was never read.

#### The fix
- Migration 0079: each event also records its transaction id (which transaction wrote it).
- runConsumerPass.ts: only read events from transactions older than the oldest one still running, in (transaction id, event number) order. Nothing can finish "behind" the bookmark any more.

#### The code
Before (apps/reporting/src/consumer/runConsumerPass.ts:49):
```sql
WHERE id > $1 ... ORDER BY id ASC
```
After:
```sql
WHERE (txid, id) > ($1::xid8, $2::bigint)
  AND txid < pg_snapshot_xmin(pg_current_snapshot())
ORDER BY txid ASC, id ASC
```
pg_snapshot_xmin is "the oldest transaction still running"; everything older is finished and safe to read.

#### The proof
- Before: slow event (10) + fast event (11) → only 2.000 BD in the report, the 1.000 BD event lost.
- After: both events counted, 3.000 BD.

#### If the judges ask
"What if a transaction stays open for a long time?"
Reports wait until it ends (late, never lost). A database timeout for idle transactions is suggested for hosting.

Commit: eebf7d4

### N46 — Reconciliation predicts the fee the way settlement charges it

#### The idea
Reconciliation checks: money we owe the shop = paid out + still waiting ("pending"). For the waiting part, it must guess the fee that settlement will take later.

#### The problem
The guess used a different rule from the real one.
- It used rough decimal math and the shop's default rate (250 bps).
- Payments were really charged the shop's scheduled rate (200 bps), and settlement also uses the volume discount.
- So the check showed an unexplained gap (66 fils in our test) almost every day.

#### The fix
- query.ts: compute each waiting payment's fee with the same rate lookup and the same whole-number formula as settlement.

#### The code
Before (apps/api/src/settlement/query.ts:359):
```ts
const feeFils = estimateFeeFils(amountFils, mdrBps, discountBps);
```
After:
```ts
const scheduledBps = await getEffectiveMdrBps(client, input.merchantId, row.occurred_at, mdrBps);
const discounted = toFils(Number(amountFils) - Number(applyRateFils(amountFils, discountBps)));
const feeFils = Number(applyRateFils(discounted, Math.max(0, scheduledBps - tierBonusBps)));
```
Same inputs and same rounding as the real settlement.

#### The proof
- Before: gap 66 fils on a day with two unbatched payments.
- After: gap 0.

#### If the judges ask
"Can the gap still be non-zero?"
Yes, for shops with a negotiated discount (E50): the payment-time fee and the settlement fee really differ, and reconciliation now shows that honestly.

Commit: 976d166

### N47 — A payout on the next day is no longer a mystery gap

#### The idea
Reconciliation compares the ledger for a period with the batches of that period. Paying a batch out is the settling of that batch, not new activity.

#### The problem
Batches are paid out the day after they close.
- The payout line landed in the next day's ledger.
- So the next day showed a gap of minus the whole payout (−9.750 BD in our test), even on a quiet day.

#### The fix
- query.ts: leave payout lines out of the ledger figure. Both payout paths name them "settlement payout: …".

#### The code
Before (apps/api/src/settlement/query.ts:307):
```sql
WHERE merchant_id = $1 AND account_id = 'merchant_payable'
  AND occurred_at >= $2 AND occurred_at < $3
```
After:
```sql
  AND description NOT LIKE 'settlement payout:%'
```
Only real activity (sales, fees, refunds, corrections) is compared with the batches.

#### The proof
- Before: the day after a payout showed a −9750 gap.
- After: today, tomorrow and both days together all show 0.

#### If the judges ask
"Why not exclude every line with a batch id?"
Fee recalculation lines also have a batch id, and they really change what the shop is owed, so they must count.

Commit: ad4a77b

### N48 — Checked: two login cookies never mix identities

#### The idea
A request can carry a shop login cookie and an admin "view as shop" cookie. The app must pick exactly one identity, like a door that reads one key card at a time.

#### The problem
A comment (FP-198) said the two cookies could mix identities. Nobody had tested it.
- If true, an old admin cookie could give a shop user another shop's data.

#### The fix
- No code change. A new test sends both cookies and checks who the app thinks you are.

#### The code
Before (apps/api/src/auth/requireMerchantAuth.ts:47-58):
```ts
const token = request.cookies[request.server.config.cookieName];
if (token) { const session = await lookupSession(...); if (session) { request.merchantAuth = {...}; return; } }
```
After: unchanged. The code takes one source in a fixed order (session, API key, admin cookie) and returns right away, so nothing is merged.

#### The proof
- Valid shop session + admin cookie for another shop → only the first shop's data.
- Expired session + admin cookie → only the other shop's data, read-only (void → 403).

#### If the judges ask
"Why record something that is not a bug?"
A suspected security bug needs proof either way. The test is the proof, and it stays to catch a future change.

Commit: d69c07f

### N49 — Fee recalculation no longer charges back the volume discount

#### The idea
When the platform has processed a lot of money, every shop gets a 0.15% volume discount on its fee. The daily close applies it. A later fee recalculation must use the same rules, like re-adding a receipt with the same coupons.

#### The problem
The recalculation used a different rate.
- It used the shop's default rate, not its fee schedule.
- It ignored the volume discount, which was never saved with the batch.
- So recalculating with no rate change raised a fee from 185 to 250 fils.

#### The fix
- Migration 0080: each batch saves the volume discount it was closed with.
- batch.go: the daily close writes it.
- recalculate_mdr.go: uses the fee schedule at each payment's time, minus the saved discount.

#### The code
Before (apps/settlement/internal/settlement/recalculate_mdr.go:163):
```go
fee += ComputeSettlementFee(money.Fils(amountFils), mdrBps, discountBps)
```
After:
```go
rate := EffectiveMdrBpsAt(schedules, occurredAt, mdrBps) - tierBonusBps
fee += ComputeSettlementFee(money.Fils(amountFils), rate, discountBps)
```
The same rate the daily close used, so "no change" really means no change.

#### The proof
- Before: recalculation with no rate change → fee 185 → 250 (65 fils overcharged).
- After: no adjustment.

#### If the judges ask
"What about batches closed before this change?"
They have a saved discount of 0, which is what the old recalculation already assumed, so nothing gets worse for them.

Commit: 376bc49

### N50 — The settlement summary reads only the days it needs

#### The idea
A database index is like the index at the back of a book: instead of reading every page, you jump to the pages you need.

#### The problem
The summary for one shop and one month read every capture event ever stored.
- In July this took 3 to 6 seconds for a big shop on the small hosted server.
- The work grew with all history, not with the month asked for.

#### The fix
- Migration 0081: an index on capture events by time, holding the two columns the query needs.

#### The code
Before: no index on capture time, so the plan was "Seq Scan on transaction_events".
After (db/migrations/0081_transaction_events_capture_time_idx.sql:7-9):
```sql
CREATE INDEX idx_transaction_events_capture_time
    ON transaction_events (occurred_at) INCLUDE (transaction_id, amount_fils)
    WHERE event_type IN ('captured', 'partially_captured');
```
Postgres now reads only the capture events inside the chosen dates.

#### The proof
- On a copy with 409,140 events: 66 ms → 52 ms with one CPU worker, and the plan changed from a full scan to an index scan.
- The same copy confirmed the earlier over-count: 1,117,260,000 fils reported vs 372,420,000 real.

#### If the judges ask
"Only 20 % faster?"
On a fast laptop, yes. The point is that it no longer grows with history; the real check is the load test on the 0.5-vCPU limit.

Commit: fffaa6c

### N51 — Payment links now get the shop's negotiated discount

#### The idea
Some shops negotiated a discount on their fee (for example 20 % off). It should apply however the customer pays.

#### The problem
The discount was only applied when paying through the card API.
- A payment through a payment link was charged the full fee (250 fils instead of 200 on 10 BD).
- A comment claimed it was applied for both. It was not.

#### The fix
- pay.ts: after a link payment succeeds, call the same discount function the card API uses.

#### The code
Before (apps/api/src/paymentLinks/pay.ts, end of payPaymentLink): no discount step.
After:
```ts
await applyCaptureDiscountAdjustment(pool, { merchantId: link.merchantId, transactionId: txnId });
```
The same function, with the same guard against applying it twice.

#### The proof
- Before: same shop, same amount: card API fee 200, payment link fee 250.
- After: both 200.

#### If the judges ask
"Is the discount math now identical to settlement?"
Almost: payments discount the fee, settlement discounts the amount, so they can differ by 1-2 fils of rounding. Choosing one formula is marked for Zainab.

Commit: 107618c

### N52 — Shops can refund from the dashboard

#### The idea
A refund gives money back to the customer. Shop owners and finance staff need a button for it on the payment page, like a "return" desk in a store.

#### The problem
The refund drawer was finished long ago but switched off (commented out), and it had hidden bugs.
- The first refund row in the timeline (a negative amount) would crash the whole page.
- Every click made a new request key, so a retry after a network error could refund twice.
- It did not know how much was already refunded.

#### The fix
- RefundDrawer.tsx: switched on; amount typed in BD; one request key per refund attempt; shows captured, refunded and still refundable; optional reason.
- refundForm.ts (new): the amount and "can this be refunded?" rules, tested on their own.
- format.ts: money display accepts negative amounts.
- The API now returns refundedFils for each payment.

#### The code
Before (apps/web/src/format.ts:12):
```ts
return `${formatBhd(toFils(amountFils))} BHD`;
```
After:
```ts
return `${formatBhd(toFils(amountFils, { allowNegative: true }))} BHD`;
```
The money display no longer throws on −1.250 BD, so refund rows can be shown.

#### The proof
- Before: bhd(-1250) threw "expected a non-negative amount".
- After: "-1.250 BHD"; amount and status rules tested; the API returns refundedFils 1250 after a 1.250 BD refund; the web app builds.

#### If the judges ask
"Why keep the same request key on retry?"
If the first request reached the server but the answer was lost, the retry with the same key gets the first answer back instead of refunding again.

Commit: e5eb890

### N53 — The dashboard and admin console can reach the API

#### The idea
A browser only lets a website send cookies to its own address (origin), unless the other server says "I allow you" (CORS).

#### The problem
The dashboard (port 5173) and admin console (5174) called the API on port 3000.
- The API never says "I allow you", so the browser blocks every call.
- A comment said "works locally". It did not.

#### The fix
- Both vite configs: the dev server forwards /v1 to the API, so calls stay on the website's own address.
- Both clients: the default API address is the same origin.
- In hosting, a reverse proxy will do the same (part of the E02 plan).

#### The code
Before (apps/web/src/api/client.ts:3):
```ts
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000";
```
After:
```ts
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
```
"" means "my own address", which the proxy forwards to the API.

#### The proof
- Before: the browser's check (preflight) got 404 and no permission header.
- After: signup, login, login code and "who am I" all work through the dashboard's address.

#### If the judges ask
"Why not just turn on CORS?"
CORS with cookies would let the session cookie go to another address; keeping everything on one address needs no exception at all.

Commit: e5eb890

### N54 — The daily close now books the rounding leftovers

#### The idea
The card scheme file can only carry 2 decimals (10-fils steps), so each line loses 0-9 fils. Those leftover fils must be written down somewhere, like putting loose coins into a labelled jar.

#### The problem
The design (ADR-0002) said the daily close books them in a "rounding residue" account. It never did.
- Only a one-off March script ever booked them.
- From April on, every line's leftover went unrecorded, so the scheme clearing account never matched the scheme statement.

#### The fix
- batch.go: for every scheme line with a leftover, book it in the same transaction: credit the scheme clearing account, debit the rounding residue account.

#### The code
Before (apps/settlement/internal/settlement/batch.go:276-284): only the scheme line was inserted.
After:
```go
if residue := line.grossFils - truncated; residue > 0 {
    // credit card_scheme_clearing, debit scheme_rounding_residue, same amount
}
```
Every cut fil is now on the books, so the clearing account ties to the scheme file.

#### The proof
- Before: a 4.755 BD line booked nothing.
- After: 5 fils debited to the residue account and 5 credited to scheme clearing; a 3.000 BD line books nothing.

#### If the judges ask
"Who pays for the leftover fils?"
The ADR says the platform holds them in a suspense account for finance to clear monthly. The old March script charged the merchants instead (E75); that choice is marked for Zainab.

Commit: 184c0b2

### N55 — The shop dashboard no longer logs out after 10 minutes

#### The idea
After login, the browser keeps a session cookie, like a wristband at an event. The wristband must last as long as the ticket.

#### The problem
The cookie was given at login with a 10-minute life (meant only for typing the OTP code).
- After the OTP code, the session was extended to 12 hours in the database, but the cookie was never renewed.
- So 10 minutes after login the browser threw the cookie away, and every page showed "unauthenticated" with no way back except reloading.

#### The fix
- auth.ts: after a correct OTP code, send the cookie again with the 12-hour life (the admin login already did this).
- client.ts and DashboardAuthContext.tsx: if the API ever answers 401, the dashboard goes to the login page.

#### The code
Before (apps/api/src/routes/auth.ts, otp/verify): no Set-Cookie.
After:
```ts
reply.setCookie(app.config.cookieName, rawToken, {
  httpOnly: true, path: "/", sameSite: "lax", secure: app.config.cookieSecure,
  maxAge: app.config.sessionTtlHours * 3_600,
});
```
The wristband now lasts 12 hours, the same as the session.

#### The proof
- Before: the verify response had no Set-Cookie.
- After: Set-Cookie with Max-Age=43200 (12 hours); a 401 fires the "session expired" event.

#### If the judges ask
"Why did nobody notice?"
Most testing takes under 10 minutes. MK even guessed it in a comment ("related to the 10 min logouts?").

Commit: 0d04c29

### N56 — Bulk KYC approval approves only merchants under review

#### The idea
KYC ("know your customer") is the identity check before a shop may take payments. Admins can approve many shops at once from a list.

#### The problem
Two mistakes added up.
- The list kept selected shops after the admin changed the filter, so hidden shops were sent too.
- The server approved any shop id it got, even a rejected shop or one that never finished signing up.

#### The fix
- bulkKyc.ts: approve only shops whose status is "under_review".
- MerchantListPage.tsx: clear the selection when the filter or search changes.

#### The code
Before (apps/api/src/admin/bulkKyc.ts:29):
```sql
WHERE id = ANY($1::uuid[])
```
After:
```sql
WHERE id = ANY($1::uuid[])
  AND onboarding_status = 'under_review'
```
The server now refuses to approve a shop that is not waiting for review, whatever the screen sends.

#### The proof
- Before: under_review, rejected and submitted shops were all approved.
- After: only the under_review shop.

#### If the judges ask
"Why fix it on the server if the screen bug caused it?"
The server is the real gate: any client (or a crafted request) could send the wrong ids. The screen fix just avoids surprises.

Commit: 850275f

### N57 — Retrying a capture or refund can no longer take money twice

#### The idea
An Idempotency-Key is a "request ticket number". If the same ticket arrives twice, the server answers the first result again instead of doing the work twice.

#### The problem
- Capture made a new ticket on every click, so a retry after a lost answer could capture twice.
- My refund screen (F01f) kept the same ticket even after the server clearly said "no", so a corrected retry was refused.

#### The fix
- idempotencyKey.ts (new): one rule for both. Keep the ticket when we got no clear answer (network error, server error 5xx). Use a new ticket after a clear "no" (4xx).
- Capture and the refund drawer both use this rule.

#### The code
Before (apps/web/src/pages/transactions/TransactionDetailPage.tsx:79):
```ts
await captureTransaction(id, input, crypto.randomUUID());
```
After:
```ts
const key = captureKey ?? crypto.randomUUID();
setCaptureKey(key);
await captureTransaction(id, input, key);
```
The same attempt keeps the same ticket until it succeeds, is cancelled, or gets a clear answer.

#### The proof
- The rule test: network error, 500 and 502 keep the ticket; 402, 409 and 422 get a new one.
- The web app builds; all web tests pass.

#### If the judges ask
"Why not always keep the key?"
After a clear "no" the server has saved that "no" under the key; reusing it would just replay the "no" forever.

Commit: 0cf9a60

### N58 — The whole app now runs in Docker, inside the hosting limits

#### The idea
Docker packs each part of the app (API, database, settlement, reports, web pages) into its own box (container) with fixed CPU and memory, like rooms with a set size in one small house.

#### The problem
`docker compose up` could not start anything.
- The Dockerfiles it pointed to did not exist.
- The database password was written in the compose file, its port was open to the world, and every service logged in as the database superuser.

#### The fix
- Three Dockerfiles: Node (API, reports, migrations), Go (settlement), nginx (web pages + proxy).
- Compose with limits: API 0.5 CPU / 512 MB; everything together 1 CPU / about 1.6 GB.
- Restart rules, health checks, data in volumes, only the web proxy reachable from outside.
- One database role per service, none a superuser; the ledger and audit log cannot be edited by the apps.
- Secrets generated into a file that git ignores.

#### The code
Before (ops/docker-compose.yml):
```yaml
POSTGRES_PASSWORD: filspay_dev_password
ports:
  - "5432:5432"
```
After:
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?run ops/gen-env.sh}
deploy:
  resources:
    limits: { cpus: "0.50", memory: 512M }   # api
```
No password in the file, no open database port, and fixed limits per service.

#### The proof
- Started from empty: all 76 migrations ran, every service healthy.
- Crash tests: Postgres stopped without warning and came back by itself with no data lost; the API was stopped and restarted by itself.

#### If the judges ask
"How do you know the limits are real?"
docker inspect shows them on each running container (0.50 CPU and 512 MB for the API), and the load test runs against exactly this stack.

Commit: d7d17b2

### N59 — Too many buyers at once get "busy, retry" instead of a crash, and we know our capacity

#### The idea
A small server can only work on so many payments at the same time. When too many arrive, it is better to say "busy, try again in a second" to some of them than to make everyone wait until the server falls over, like a restaurant that stops seating people when the kitchen is full.

#### The problem
- The API accepted every request. Under heavy load they queued, everything slowed down (5-6 seconds), and the database pool ran out.
- Nobody knew how many checkouts the hosted size could handle.

#### The fix
- loadShedding.ts (new): above 24 requests in progress, or when the server is clearly overloaded, new requests get 503 with "Retry-After: 1" at once. Health checks always answer.
- errorHandler.ts: "no free database connection" is also a 503, not a 500.
- Compose: the database got more of the CPU budget (it was the real bottleneck).
- A k6 load test of the checkout (open link + pay).

#### The code
Before: no limit — every request was accepted and queued.
After (apps/api/src/plugins/loadShedding.ts):
```ts
if (inFlight >= options.maxInFlight || lagging) {
  reply.header("Retry-After", "1");
  reply.code(503).send({ error: "overloaded", message: "The server is busy. Please retry in a moment." });
  return reply;
}
```
Excess requests are turned away in microseconds, so the ones being served stay fast.

#### The proof
- Capacity: about 15 checkouts per second within the limits (p95 under 2 s); up to 20 per second in the open-arrival test.
- At 3× the limit: 72 % turned away, no crash, no restart; right after, back to normal.
- After about 11,000 checkouts: no double charges, every ledger group balanced, shop balance correct to the fil.

#### If the judges ask
"Why not just give the API more CPU?"
The API used only 15 % of one CPU. The database was at its limit, so we moved CPU to the database inside the same 1-CPU budget.

Commit: a8fdcb1

### N60 — Logging in again no longer gives an attacker fresh guesses

#### The idea
After the password, a 6-digit code is the second lock. Only a few wrong guesses are allowed.

#### The problem
The limit counted per code, not per person.
- Every new login made a new code with 5 new guesses.
- Older codes from earlier logins kept working too.
- So someone with the password could keep logging in and guessing until the code was found.

#### The fix
- otp.ts (merchant and admin): at login, lock the user, count their guesses in the last 15 minutes across all codes, and refuse at 10. Old codes and old half-finished logins are ended, so only the newest code works.

#### The code
Before (apps/api/src/routes/auth.ts, login): a new code was inserted, nothing else.
After:
```ts
const allowed = await prepareMerchantUserForNewChallenge(client, {
  merchantUserId: recipient.id,
  maxAttemptsPerWindow: app.config.otpUserMaxAttemptsPerWindow,
  windowMinutes: app.config.otpUserWindowMinutes,
});
if (!allowed) throw new TooManyRequestsError("too_many_attempts");
```
The guess budget belongs to the person, not to each code.

#### The proof
- Before: the first login's code still worked after a second login; guesses across logins went past 10.
- After: the old code stops working; after 10 guesses in 15 minutes, login is refused.

#### If the judges ask
"How was this found?"
By the "deep review lens" we learned from our teammate's review: asking what happens across many requests, not just one.

Commit: a3975a9

### N61 — A day can only be closed after it has ended

#### The idea
Each night the settlement closes the day that just finished. A closed day is final.

#### The problem
Admins could close "today" (or a future day) with the Run batch button.
- The day was marked closed at, say, 10 AM.
- Payments after 10 AM belonged to a closed day, so no batch ever picked them up: the shop was never paid for them.

#### The fix
- batch.go: refuse to close a day whose Bahrain midnight has not passed yet.
- server.go: answer 400 "business_day_not_over".

#### The code
Before (apps/settlement/internal/settlement/batch.go:61): no check.
After:
```go
if time.Now().Before(end) {
    return BatchResult{}, ErrBusinessDayNotOver
}
```
end is the next Bahrain midnight for that day.

#### The proof
- Before: run-batch for today → 200 (day closed early).
- After: 400; no batch created; yesterday still closes.

#### If the judges ask
"Why in CloseBatch and not in the button?"
The button, the internal API and the command-line tool all end in CloseBatch, so one check protects them all.

Commit: fb945fa

### N62 — One admin can no longer move big money through the CSV import

#### The idea
Credits above 50 BD need two people: one asks, another approves. Like a bank cheque that needs two signatures.

#### The problem
The CSV import posted money with one person only.
- Any amount, positive or negative, in one file.
- A test file with 1,000,000 BD was accepted.

#### The fix
- adjustmentImport.ts: before writing anything, refuse an import if one row, or the total of all rows, is above 50 BD. Bigger corrections use the two-person credit flow.

#### The code
Before (apps/api/src/admin/adjustmentImport.ts): no amount limit.
After:
```ts
if (abs > Number(CREDIT_APPROVAL_THRESHOLD_FILS)) {
  throw new UnprocessableEntityError("approval_required", "a row above 50.000 BD needs the two-person credit flow");
}
```
The total is checked too, so splitting into many small rows does not help.

#### The proof
- Before: a 1,000,000 BD import was accepted.
- After: refused (422); nothing posted; a 50 BD import still works.

#### If the judges ask
"Why not build approval for imports?"
It needs a new table and screens. The limit closes the hole today; staged approval is marked for Zainab.

Commit: c973988

### N63 — A busy database no longer freezes all payment-link payments

#### The idea
Only two link payments may hold a link lock at once. Each takes a ticket, like the keys for a small changing room.

#### The problem
If the database had no free connection, the payment failed but kept its ticket.
- After two such failures, no tickets were left.
- Every later link payment waited forever.
- The link also stayed blocked for 60 seconds.

#### The fix
- pay.ts: if getting a connection fails, give the ticket back, free the link and cancel (void) the card hold, then report the error.

#### The code
Before (apps/api/src/paymentLinks/pay.ts:138):
```ts
const releaseSlot = await acquireLockSlot(config.maxConcurrentLockedPays ?? 2);
const linkClient = await pool.connect();
```
After:
```ts
try {
  linkClient = await pool.connect();
} catch (err) {
  releaseSlot();
  await releaseReservation(pool, link.id, link.reservationToken).catch(() => undefined);
  await voidTransaction(pool, { ... }).catch(() => undefined);
  throw err;
}
```
The ticket is returned even when the connection fails. The buyer gets a 503 and can try again.

#### The proof
- Before: the link stayed "reserved"; the next payment waited forever (test with one ticket).
- After: the link is active, the hold is voided, the next payment succeeds (200).

#### If the judges ask
"Why not just use finally?"
The connect line was before the try, so finally never ran. Moving the whole thing inside would also release a client we never got; a small try/catch around connect is clearer.

Commit: c06b7eb

### N64 — A broken card form gives a clear 400, not a crash that blocks the link

#### The idea
Before a link payment starts, the link is "held" for one buyer, like a fitting room marked busy.

#### The problem
A card with missing parts crashed the server after the link was held.
- The buyer got a 500 error.
- The link stayed "busy" for 60 seconds, so the real buyer could not pay.

#### The fix
- New cardShape.ts: checks the card number, month, year and CVV.
- Both payment routes run this check first, before anything is held or saved.
- pay.ts also frees the link if the card step fails for any other reason.

#### The code
Before (apps/api/src/routes/paymentLinks.ts:158):
```ts
if (!card) {
  throw new BadRequestError("invalid_request", "card is required");
}
```
After:
```ts
const cleanCard = parseSimulatedCard(card);
if (!cleanCard) {
  throw new BadRequestError("invalid_card", "card needs pan (12-19 digits), ...");
}
```
The card is checked and cleaned (spaces removed) before the link is touched.

#### The proof
- Before: {"card":{}} gave 500 "internal_error".
- After: 7 bad cards give 400 on both routes; a card typed with spaces still pays (200).

#### If the judges ask
"Why also check in the card API route?"
It has the same gap (only checks that a card exists), and a crash there is also a 500. One shared helper fixes both.

Commit: 93d09b2

### N65 — Each card capture gets its own discount, exactly once

#### The idea
Some shops have a negotiated discount on our fee. After each capture we give back part of the fee, like a cashback receipt for each purchase.

#### The problem
The code gave back money using the newest capture's fee every time.
- If one cashback was lost, the next ones used the wrong amount.
- A capture with a tiny fee (cashback 0) made a replay pay the next cashback twice.

#### The fix
- discountAdjustment.ts: list every capture in order, work out each one's own cashback, and write only the ones not written yet.

#### The code
Before (apps/api/src/payments/discountAdjustment.ts):
```ts
if (counts && Number(counts.adjustments) >= Number(counts.capture_events)) return;
// ... ORDER BY occurred_at DESC LIMIT 1   (always the newest fee)
```
After:
```ts
const discounts = events.rows
  .map((e) => applyRateFils(toFils(Math.max(0, e.metadata?.feeFils ?? 0)), discountBps))
  .filter((d) => d > 0);
for (const discountFils of discounts.slice(adjustmentsSoFar)) { /* write one */ }
```
Each capture's cashback comes from its own fee, and a replay finds nothing new to write.

#### The proof
- Before: [10, 10] instead of [10, 20]; and [20, 20] instead of [20] (paid twice).
- After: both tests pass; all 18 discount tests pass.

#### If the judges ask
"How do you know which cashback belongs to which capture without an id?"
Cashbacks are only written here, in capture order, under a row lock, and only when above 0. So the N-th such capture owns the N-th cashback.

Commit: 1d456a8

### N66 — A fee recalculation can no longer make a payout negative

#### The idea
When a shop's fee changes, admins can recalculate the fee on batches not yet paid, like fixing the price on an unpaid bill.

#### The problem
The new payout was "old payout minus extra fee", with no floor.
- If refunds had already used most of the batch, the payout went below zero.
- A test batch went from 50 fils to minus 1,700 fils.

#### The fix
- recalculate_mdr.go: if the new payout would be below zero, leave that batch alone and list it as "skipped".
- The settlement API, the admin API and the admin page pass the list on, so an admin sees which batches need a look.

#### The code
Before (apps/settlement/internal/settlement/recalculate_mdr.go:114):
```go
newNetPayout := b.netPayoutFils - diff
```
After:
```go
newNetPayout := b.netPayoutFils - diff
if newNetPayout < 0 {
	skipped = append(skipped, BatchAdjustment{ /* ... */ })
	continue
}
```
A batch that would owe a negative payout is not changed; it is reported instead.

#### The proof
- Before: net_payout_fils = -1700 after recalculation.
- After: the batch is unchanged, listed in Skipped, and no fee rows are posted.

#### If the judges ask
"Why not move the extra fee to the next batch?"
That is the full answer, but it touches the batch close too. Skipping is safe today and marked for Zainab to review.

Commit: cc6d252

### N67 — Money an admin credits to a shop is now really paid out

#### The idea
Admins can add money to a shop's balance (a credit or a correction). The daily batch is the envelope that carries the shop's money to its bank.

#### The problem
Credits went into the balance but never into any envelope.
- A 2 BD credit was never in a payout.
- A negative correction was never taken off a payout either.
- Reconciliation showed the credit as an unexplained gap.

#### The fix
- New migration 0083: a small table that remembers which credits a batch already paid, plus a credit_fils column.
- credit_batch.go: the daily close takes unpaid credits; a negative one waits for a day with enough money, like refunds.
- batch.go adds them to the payout; query.ts explains them in reconciliation.

#### The code
Before (apps/settlement/internal/settlement/batch.go:227):
```go
netPayout := NetPayableFils(batchGross, batchFee)
refundIDs, batchRefund, batchFeeReversed, err := takeRefunds(ctx, tx, merchantID, end, netPayout)
```
After:
```go
creditGroups, creditAmounts, batchCredit, err := takeCredits(ctx, tx, merchantID, end, netPayout)
netPayout += batchCredit
refundIDs, batchRefund, batchFeeReversed, err := takeRefunds(ctx, tx, merchantID, end, netPayout)
```
The day's payout now includes credits (and fitting negative corrections) before refunds.

#### The proof
- Before: payout 9750 instead of 11750; the -5000 never taken; reconciliation gap 2000.
- After: all three tests pass; full regression same as baseline.

#### If the judges ask
"Why a new table instead of marking the ledger rows?"
The ledger is append-only for the app (migration 0082), so we cannot update its rows. The table's primary key also stops one credit from being paid twice.

Commit: d97de16

### N68 — The export summary now needs a login

#### The idea
Most report pages check who you are first, like a door that needs a key card.

#### The problem
One report route had no key-card reader at all.
- Anyone on the internet could call it without logging in.
- It only crashed (500) because it looked for a user that was not there; a quick "fix" of the crash would have shown shop data to strangers.

#### The fix
- reporting.ts: added the same login check the other report routes use.

#### The code
Before (apps/api/src/routes/reporting.ts:79):
```ts
app.get("/export-summary", async (request) => {
```
After:
```ts
app.get("/export-summary", { preHandler: requireMerchantAuth }, async (request) => {
```
The login check runs first; no login means 401.

#### The proof
- Before: an anonymous call got 500.
- After: an anonymous call gets 401; a logged-in shop gets its own summary (200).

#### If the judges ask
"It only gave 500, so why High?"
The real bug is the missing login check. It leaked nothing only by luck; the second review found this root cause.

Commit: 26856d3

### N69 — Report filters are checked before they reach the database

#### The idea
A report filter is like an order form: which shop, which status, which dates.

#### The problem
The form was sent to the database without reading it first.
- "null", a number, or a date like 2026-02-30 made the server crash (500).

#### The fix
- reporting.ts: a small check right after reading the filter. A wrong shape, an unknown status or a bad date gets a clear 400.

#### The code
Before (apps/api/src/routes/reporting.ts:31):
```ts
parsed = JSON.parse(request.query.filter);
```
After:
```ts
parsed = JSON.parse(request.query.filter);
// ...
checkReportFilter(parsed); // E133
```
checkReportFilter refuses anything that is not a proper filter before any query runs.

#### The proof
- Before: filter=null gave 500.
- After: 12 bad filters give 400; 4 good ones give 200.

#### If the judges ask
"Was this an injection risk?"
No. The queries use parameters. It was a crash on bad input, which our rule says must be a 400.

Commit: 383d417

### N70 — Checkout fits on a phone; amounts line up in tables

#### The idea
Checkout is the shop window: the buyer types the card there. Tables are the shop's account book.

#### The problem
The expiry and CVV row was wider than the form.
- On a phone, the CVV box ran off the screen.
- The month box was tiny.
- In tables, BHD amounts did not line up because digits had different widths.

#### The fix
- CheckoutPage.css: month, year and CVV share one row as three equal columns, and inputs count their padding inside their width.
- dashboard.css and admin.css: tables use same-width digits.

#### The code
Before (apps/web/src/pages/checkout/CheckoutPage.css:44):
```css
.checkout-form-row {
  display: flex;
  gap: 0.5rem;
}
```
After:
```css
.checkout-form-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}
```
The three boxes now always share the form width equally.

#### The proof
- Before: docs/ui/before/checkout-pay-mobile.png (CVV past the screen edge).
- After: docs/ui/after/checkout-pay-mobile.png (three boxes inside the screen).

#### If the judges ask
"How do we know the before pictures are fair?"
Same database, same API and same pages for both; only the frontend code differs (a12d4c7 vs now). docs/ui/README.md explains every step.

Commit: b22520f

### N71 — Two reporting runs can no longer count a payment twice

#### The idea
The reporting worker keeps daily totals. It remembers "I have read up to here", like a bookmark in a ledger book.

#### The problem
Two runs at the same moment read the same bookmark.
- Both added the same payments to the totals.
- A 1 BD payment showed as 2 BD in the dashboard.

#### The fix
- cursor.ts: reading the bookmark now locks it until the run finishes, so a second run waits and starts after the first.

#### The code
Before (apps/reporting/src/consumer/cursor.ts:36):
```ts
`SELECT last_processed_id, ... FROM reporting_outbox_cursor WHERE consumer_name = $1`,
```
After:
```ts
`SELECT last_processed_id, ... FROM reporting_outbox_cursor WHERE consumer_name = $1 FOR UPDATE`,
```
FOR UPDATE holds the bookmark row until the run commits.

#### The proof
- Before: captured_count 2 for one payment.
- After: captured_count 1; all 17 reporting tests pass.

#### If the judges ask
"Didn't the code already guard against this?"
Only inside one process (a `running` flag). Catch-up and rebuild are separate processes, so the comment saying it was safe was false.

Commit: 8720dd6

### N72 — Paid batches now show as "paid" in payout trends

#### The idea
The dashboard shows each payout batch with a status, like a parcel tracker: closed, then paid.

#### The problem
The "paid" message was sent but nobody read it.
- Every batch stayed "closed" in the trends, even after the money left.

#### The fix
- runConsumerPass.ts: the reporting worker now reads settlement.paid events.
- applyEvent.ts: a new handler marks the trend row paid, using the batch row as the source of truth.

#### The code
Before (apps/reporting/src/consumer/runConsumerPass.ts:12):
```ts
  "refund.succeeded", // F01e: applyEvent has the matching case
];
```
After:
```ts
  "refund.succeeded", // F01e: applyEvent has the matching case
  "settlement.paid", // E64: marks the payout trend row paid (applyEvent has the case)
];
```
The worker now picks up the paid event, and applySettlementPaid updates the row.

#### The proof
- Before: status 'closed' after payout.
- After: status 'paid' with a paid time; all 18 reporting tests pass.

#### If the judges ask
"What about old rows?"
They update after one reporting rebuild. Zero-payout batches never get a paid event, so they stay closed; this is recorded.

Commit: d4df731

### N73 — The March sweep no longer takes money from shops

#### The idea
The scheme file drops tiny fractions of a fil. A sweep moves those leftovers to a "rounding" account, like sweeping crumbs into one jar.

#### The problem
The sweep took the crumbs from the shops' balances.
- It debited merchant_payable instead of card_scheme_clearing.
- Every run lowered what shops were owed.

#### The fix
- reconcile_march.ts: post the two legs ADR-0002 names, the same ones the daily close already uses.

#### The code
Before (scripts/reconcile_march.ts:97):
```ts
VALUES ($1, $2, 'merchant_payable', 'debit', $3, $4, $5),
       ($1, $2, 'scheme_rounding_residue', 'credit', $3, $4, $5)
```
After:
```ts
VALUES ($1, $2, 'card_scheme_clearing', 'credit', $3, $4, $5),
       ($1, $2, 'scheme_rounding_residue', 'debit', $3, $4, $5)
```
The leftover now leaves the clearing account, not the shop's balance.

#### The proof
- Before: the test saw a merchant_payable debit of 12 fils.
- After: credit clearing 12, debit residue 12; no merchant_payable row.

#### If the judges ask
"What about the runs that already happened?"
They stay until finance decides. A read-only query lists them and shows how many times the sweep ran for each shop.

Commit: 235fb29

### N74 — A shop can only be approved after its documents are reviewed

#### The idea
Before a shop can take payments, an admin reviews its documents and approves it. Like a bank checking ID before opening an account.

#### The problem
One admin action approved a shop in any state.
- A shop that never uploaded a document could be approved and go live.
- Two admins deciding at once both wrote a decision.

#### The fix
- review.ts: the approval now only changes a shop that is still "under review", in one step. Otherwise it answers 409 and writes nothing.
- adminMerchants.ts: the admin route asks for this check.

#### The code
Before (apps/api/src/onboarding/review.ts:53):
```ts
`UPDATE merchants SET onboarding_status = $2, kyc_passed = $3 WHERE id = $1`
```
After:
```ts
`UPDATE merchants SET onboarding_status = $2, kyc_passed = $3
  WHERE id = $1 AND ($4::boolean IS NOT TRUE OR onboarding_status = 'under_review')
  RETURNING id`
```
If no row matches, nothing is written and the admin gets 409.

#### The proof
- Before: a "submitted" shop was approved (200, kycPassed true).
- After: submitted and rejected shops get 409; a second decision gets 409; admin tests 43/43.

#### If the judges ask
"Why did you change two old tests?"
They approved a shop with no documents and expected success, so they protected the bug. A real upload moves the shop to "under review" first.

Commit: ce6d4f0

### N75 — Only finance can resend old webhooks, and an archive only once

#### The idea
A webhook is a message we send a shop ("payment captured", "you were paid"). Admins can resend old ones, like reprinting receipts.

#### The problem
Any admin, even support, could resend all of a shop's old messages, again and again.
- The shop received the same payment and payout messages many times.
- Each copy had a new id, so the shop could not tell it was a copy.

#### The fix
- adminMerchants.ts: the three resend routes now need the finance or super_admin role.
- archiveReplay.ts and migration 0084: an archive is marked "replayed" in one step, so it can be resent only once.

#### The code
Before (apps/api/src/routes/adminMerchants.ts:212):
```ts
{ preHandler: [requireAdminSession] },
```
After:
```ts
{ preHandler: [requireAdminSession, requireAdminRole("finance", "super_admin")] },
```
Support admins now get 403 on resend.

#### The proof
- Before: a support admin resent a delivery (200).
- After: support 403 on all three routes; a second resend of the same archive 409.

#### If the judges ask
"Why not just trust admins?"
Support is the lowest role and the duplicates looked real to shops. A duplicate payout message was a real incident before (E30).

Commit: 8fe5a25

### N76 — A tiny image can no longer crash the API

#### The idea
When a shop uploads a document photo, we make a small preview picture. Like shrinking a big poster into a stamp.

#### The problem
A 1 MB picture can unpack into a huge image.
- Making its preview used about 300 MB of memory.
- Two at once went past the API's 512 MB limit and crashed it.

#### The fix
- kycThumbnail.ts: refuse to unpack any image over 25 million pixels, and make previews one at a time. A too-big image just gets no preview; the document is still saved.

#### The code
Before (apps/api/src/onboarding/kycThumbnail.ts:32):
```ts
const resized = await sharp(buffer)
```
After:
```ts
return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
```
sharp now stops before unpacking a too-big image.

#### The proof
- Before: a 36-megapixel test image was unpacked into a preview.
- After: no preview for it; normal photos still get one; 22 upload tests pass.

#### If the judges ask
"Why not refuse the upload?"
The reviewer showed that real 48-megapixel phone photos would then be refused. Skipping only the preview is safer.

Commit: b2ebc90

### N77 — A comma in a CSV amount can no longer post the wrong money

#### The idea
Finance can upload a CSV file of balance corrections: shop, amount, reason. Like a list of cheques.

#### The problem
The file reader cut every line after three pieces.
- "1,000.000" became amount "1" and reason "000.000".
- 1 BD was posted instead of 1,000 BD, with no warning.

#### The fix
- adjustmentCsvParsing.ts: refuse any line with more than three pieces, and require the exact header.

#### The code
Before (apps/api/src/admin/adjustmentCsvParsing.ts:42):
```ts
const cells = (lines[i] as string).split(",").map((cell) => cell.trim());
```
After:
```ts
const cells = (lines[i] as string).split(",").map((cell) => cell.trim());
if (cells.length > 3) {
  throw new BadRequestError("invalid_csv_row", `row ${i} has more than 3 columns; ...`);
}
```
A line with an extra comma is refused instead of cut.

#### The proof
- Before: "1,000.000" was read as 1 BD.
- After: refused with 400; all 37 import tests pass.

#### If the judges ask
"What about a reason with a comma?"
It is refused too, because the format has no quotes. A clear error is better than a cut-off reason.

Commit: 757eab0

### N78 — A credit cannot be dated in the future or long ago

#### The idea
An admin credit has a date that says which day it belongs to, like the date on a receipt.

#### The problem
Any date was accepted.
- "2099-12-31" made the payout wait until 2099.
- "1900-01-01" put money into periods closed long ago.

#### The fix
- creditRequestValidation.ts: the date must be today (Bahrain time) or up to 90 days back.

#### The code
Before (apps/api/src/admin/creditRequestValidation.ts:75): only the date format was checked.
After:
```ts
if (rawDate > bahrainToday || rawDate < earliest) {
  throw new BadRequestError("invalid_effective_date", ...);
}
```
Dates outside the window get a clear 400.

#### The proof
- Before: 2099-12-31 was accepted.
- After: future and very old dates are refused; today and recent dates work; 34 credit tests pass.

#### If the judges ask
"Why 90 days?"
No rule in the code defines a closed period, so we chose a quarter and marked it for Zainab to review.

Commit: f078974

### N79 — Big exports run one at a time

#### The idea
Shops can download their transactions as a CSV file, like printing a long bank statement.

#### The problem
Each export is built fully in memory.
- Four big exports at once crashed the API.
- Our own earlier fix (a 50,000-row limit) was not enough.

#### The fix
- exportCsv.ts: only one export at a time; a second one gets "busy, retry" (503). It also reads only the six needed columns.

#### The code
Before (apps/api/src/transactions/exportCsv.ts:44): no limit on parallel exports.
After:
```ts
if (exportsInFlight >= 1) {
  throw new AppError(503, "export_busy", "another export is running; retry in a few seconds");
}
```
The second export waits its turn instead of crashing the server.

#### The proof
- Before: two exports ran at the same time.
- After: one runs, the other gets 503, a later one works; 8 export tests pass.

#### If the judges ask
"Isn't one at a time slow?"
An export takes about a second; a crash takes the whole API down. Streaming would be the long-term fix.

Commit: e7b8b1b

### N80 — The dashboard shows refunds in settlement

#### The idea
A settlement batch is the shop's payout for one day, like a bank statement line.

#### The problem
The pages showed gross, fee and net only.
- With refunds, gross minus fee did not equal net on screen.

#### The fix
- Batch page, batch list and reconciliation page now show refunds and the fee returned on refunds.

#### The code
Before (apps/web/src/pages/settlement/SettlementBatchDetailPage.tsx:105): Gross, Fee, Net payout only.
After:
```tsx
<dt>Refunds</dt>
<dd>{bhd(batch.refundFils)}</dd>
<dt>Fee returned on refunds</dt>
<dd>{bhd(batch.feeReversedFils)}</dd>
```
The numbers on screen now add up.

#### The proof
- Before: no refund lines; 20.000 − 0.450 ≠ 5.865.
- After: screenshots show 20.000 − 0.450 − 14.000 + 0.315 = 5.865.

#### If the judges ask
"Was the money wrong?"
No. The API and the ledger were right (gap 0); only the screens left out the refund lines.

Commit: 5a998e4

### N81 — Bad requests get 4xx, not 500

#### The idea
A 500 means "the server broke"; a 400 means "your request was wrong". Like a shop saying "we are closed" versus "you gave the wrong coin".

#### The problem
Broken JSON, a huge body or a bad id gave 500.

#### The fix
- errorHandler.ts: the framework's own client errors keep their 4xx; a bad value that reaches the database is 400.
- auth.ts: a login shop id must be a UUID.

#### The code
Before (apps/api/src/plugins/errorHandler.ts:44): every unknown error became 500.
After:
```ts
if (pgCode === "22P02" || pgCode === "22007" || pgCode === "22008") {
  reply.code(400).send({ error: "invalid_request", message: "a value in the request is not valid" });
```
Bad input now gets a clear 400.

#### The proof
- Before: broken JSON → 500; /v1/transactions/not-a-uuid → 500.
- After: 400, 413, 415 as expected; full regression green.

#### If the judges ask
"Can the 400 net hide real bugs?"
It only catches invalid-input codes from Postgres, which come from request values; other errors still give 500 and are logged.

Commit: 9d35e0f

### N82 — Impossible dates are refused in analytics

#### The idea
Analytics take a date range, like "show me March".

#### The problem
"2026-02-30" was silently turned into March 2.
- The answer was for a range nobody asked for.

#### The fix
- queryParsing.ts: a shared check that the day exists; analytics use it.

#### The code
Before (apps/api/src/routes/analytics.ts:25):
```ts
return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
```
After:
```ts
return isRealDate(value, true);
```
The day must exist on the calendar.

#### The proof
- Before: to=2026-02-29 → 200.
- After: 400; the real leap day 2024-02-29 still works.

#### If the judges ask
"Didn't the comment say it rejects 2026-02-30?"
Yes, and the comment was false; Date.parse rolls such dates over.

Commit: 8f2cf8a

### N83 — Date filters mean the same thing on every server

#### The idea
Transaction and settlement lists can be filtered by date.

#### The problem
- Garbage or impossible dates were accepted or rolled over.
- A time without a zone was read in the server's own zone.

#### The fix
- queryParsing.ts: dates must be real; a time must carry its zone. Used in transactions, export and settlement.

#### The code
Before (apps/api/src/routes/transactions.ts:153):
```ts
from: q.from ? new Date(q.from) : undefined,
```
After:
```ts
from: parseOptionalDate(q.from, "from"), // E112/E125
```
Bad or zone-less dates get 400.

#### The proof
- Before: from=2026-02-30 → 200.
- After: 7 bad filters → 400; the dashboard's own format still works.

#### If the judges ask
"Does the dashboard still work?"
Yes. It sends dates with a Z; we checked apps/web/src/format.ts first.

Commit: 173bdda

### N84 — limit must be a whole number

#### The idea
`limit` says how many rows a page shows.

#### The problem
"abc" gave a 500 and "10abc" silently became 10, in 8 routes.

#### The fix
- queryParsing.ts: one parseLimit used by all 8 routes.

#### The code
Before (apps/api/src/routes/transactions.ts:149):
```ts
const limit = q.limit !== undefined ? Number.parseInt(q.limit, 10) : undefined;
```
After:
```ts
const limit = parseLimit(q.limit) /* E126 */;
```
Non-numbers get 400; numbers are still clamped by each route.

#### The proof
- Before: limit=10abc → 200.
- After: 400; 100 route tests pass.

#### If the judges ask
"Why allow -5?"
Existing tests expect the route to clamp it to its minimum; we kept that behaviour.

Commit: e92b748

### N85 — Bad cursors are refused, not a crash

#### The idea
A cursor is a bookmark for "next page" in a list.

#### The problem
A broken bookmark reached the database and crashed the request (500).

#### The fix
- No new code: the E57 change already turns a bad value that reaches the database into 400. A test now locks this in.

#### The code
Before: errorHandler.ts had no rule for invalid input from Postgres.
After (from E57):
```ts
if (pgCode === "22P02" || pgCode === "22007" || pgCode === "22008") {
```
Broken cursors now get 400 or the first page.

#### The proof
- Before (old error handler): a bad cursor → 500.
- After: 400 or page one for 4 bad cursors on 3 lists.

#### If the judges ask
"Why no new code?"
The root cause (bad request values reaching a database cast) was already fixed by E57; we proved it with a test.

Commit: ae2bd75

### N86 — Ledger activity shows the right days

#### The idea
"Recent ledger activity" lists money lines for a date range.

#### The problem
It included one extra day at the end.

#### The fix
- query.ts: use "on or after from, before to", like the other reports.

#### The code
Before (apps/api/src/analytics/query.ts:312):
```sql
AND (occurred_at AT TIME ZONE 'Asia/Bahrain')::date BETWEEN $2::date AND $3::date
```
After:
```sql
AND (occurred_at AT TIME ZONE 'Asia/Bahrain')::date >= $2::date
AND (occurred_at AT TIME ZONE 'Asia/Bahrain')::date <  $3::date
```
The end date is no longer included.

#### The proof
- Before: a one-day range showed two days.
- After: only the asked day.

#### If the judges ask
"Why does to mean 'before'?"
The route defines it that way, and every other report uses the same rule.

Commit: 5100b9c

### N87 — Webhook settings refuse an unknown status

#### The idea
A shop can pause or enable its webhook, like switching a doorbell on or off.

#### The problem
An unknown status like "paused" crashed the request (500).

#### The fix
- update.ts: status must be "active" or "disabled"; otherwise 400.

#### The code
Before (apps/api/src/webhooks/update.ts:35): only "at least one field" was checked.
After:
```ts
if (input.status !== undefined && input.status !== "active" && input.status !== "disabled") {
  throw new BadRequestError("invalid_status", "status must be active or disabled");
}
```
Unknown values get a clear 400.

#### The proof
- Before: 500.
- After: 400 invalid_status.

#### If the judges ask
"Why check in the helper, not the route?"
So every caller of the helper is protected (defence in depth).

Commit: f82fb40

### N88 — Signature checks compare whole strings

#### The idea
We compare secret codes (OTP, signatures) safely, without leaking timing.

#### The problem
The compare stopped at the first non-hex letter.
- "61" and "61zz" counted as equal.

#### The fix
- crypto.ts: both values must be whole hex strings first.

#### The code
Before (apps/api/src/lib/crypto.ts:15):
```ts
const bufA = Buffer.from(a, "hex");
```
After:
```ts
if (!/^(?:[0-9a-fA-F]{2})*$/.test(a) || !/^(?:[0-9a-fA-F]{2})*$/.test(b)) return false;
const bufA = Buffer.from(a, "hex");
```
Changed strings no longer match.

#### The proof
- Before: "61" vs "61zz" → true.
- After: false; 37 auth and signing tests pass.

#### If the judges ask
"Was this a bypass?"
No, one side is always a real digest; it only let an attacker add junk without breaking the check.

Commit: a84b437

### N89 — Bad settings stop the server at start

#### The idea
The server reads its settings from environment variables when it starts.

#### The problem
Bad settings were silently changed.
- "3000oops" became 3000; "treu" became false.
- NODE_ENV "prod" became development, turning off safety defaults.

#### The fix
- config.ts: settings must be fully valid, and a few ranges are checked; otherwise the server refuses to start.

#### The code
Before (apps/api/src/config.ts:132):
```ts
return "development";
```
After:
```ts
if (value === undefined || value === "") return "development";
throw new Error(`loadConfig: NODE_ENV must be production, test or development, got "${value}"`);
```
A typo now stops the start instead of switching modes.

#### The proof
- Before: 9 bad settings all loaded.
- After: all 9 refused; full regression green.

#### If the judges ask
"Is it fully fixed?"
Partly. The main parsers and ranges are fixed; range checks for OTP, argon2 and timers are still open.

Commit: 0ed1b5a

### N90 — A refund with nothing left says "not refundable"

#### The idea
A refund can only return money that was not already returned.

#### The problem
With nothing left and no amount, the error said "amount invalid" (422).

#### The fix
- refundValidation.ts: that case is now "not refundable" (409).

#### The code
Before (apps/api/src/payments/refundValidation.ts:38): went straight to the amount check.
After:
```ts
if (requestedAmountFils === undefined && compareFils(refundable, ZERO_FILS) <= 0) {
  return { ok: false, code: "transaction_not_refundable", status: txn.status };
}
```
The answer now says what is really wrong.

#### The proof
- Before: refund_amount_invalid.
- After: transaction_not_refundable; 39 refund tests pass.

#### If the judges ask
"Does this change money?"
No. No money could move either way; only the error is clearer.

Commit: a394c96

### N91 — A credit cannot be bigger than a set maximum

#### The idea
Admins can give a shop a credit. A credit has an amount, like a refund voucher.

#### The problem
There was no top limit.
- A huge amount plus its fee passed the largest safe number and crashed the request (500).

#### The fix
- creditRequestValidation.ts: at most 1,000,000,000 BD; more gets a clear 400.

#### The code
Before (apps/api/src/admin/creditRequestValidation.ts:42):
```ts
if (typeof rawAmount !== "number" || !Number.isSafeInteger(rawAmount) || rawAmount <= 0) {
```
After:
```ts
if (typeof rawAmount !== "number" || !Number.isSafeInteger(rawAmount) || rawAmount <= 0 || rawAmount > MAX_CREDIT_FILS) {
```
Too-big credits are refused before any math.

#### The proof
- Before: a huge credit crashed with 500.
- After: 400; exactly the maximum still works.

#### If the judges ask
"Why that maximum?"
The case file gives none; we chose a safe value far below the number limit and marked it for Zainab to review.

Commit: d8d42bf

### N92 — A balance correction cannot be absurdly large

#### The idea
Support can correct the balance a shop sees.

#### The problem
A correction of 2^53 fils crashed (500), and 9 quadrillion fils was accepted.

#### The fix
- adminBalanceAdjustments.ts: a safe whole number within the same maximum as credits.

#### The code
Before (apps/api/src/routes/adminBalanceAdjustments.ts:29):
```ts
if (typeof source.deltaFils !== "number" || !Number.isInteger(source.deltaFils)) {
```
After:
```ts
if (typeof source.deltaFils !== "number" || !Number.isSafeInteger(source.deltaFils) || Math.abs(source.deltaFils) > MAX_BALANCE_ADJUSTMENT_FILS) {
```
Out-of-range corrections get 400.

#### The proof
- Before: 2^53 → 500.
- After: 400 for 2^53 and ±9e15; 19 tests pass.

#### If the judges ask
"Is the balance shown here real money?"
No, it is a display cache; payouts come from the ledger. The cap stops nonsense values.

Commit: dda38bd

### N93 — A capture key cannot be reused on another payment

#### The idea
An idempotency key lets a shop safely retry a request without doing it twice, like a ticket number.

#### The problem
The key ignored which payment it was for.
- Using the same key on payment B returned A's answer, and B was never captured.

#### The fix
- capture.ts: the payment id is now part of what the key checks.

#### The code
Before (apps/api/src/payments/capture.ts:92):
```ts
const requestHash = hashRequest({ amountFils: input.amountFils ?? null });
```
After:
```ts
const requestHash = hashRequest({ transactionId: input.transactionId, amountFils: input.amountFils ?? null });
```
Reusing a key on another payment now gets 422.

#### The proof
- Before: B's capture returned A's 200.
- After: 422; B stays authorized; 85 payment tests pass.

#### If the judges ask
"Do retries still work?"
Yes. A retry of the same payment sends the same id, so it replays as before.

Commit: 1354970

### N94 — A paid buyer never sees an error because of a discount

#### The idea
Some shops get a fee discount after each capture.

#### The problem
If the discount step failed after the buyer paid, the buyer got a 500 and might pay again.

#### The fix
- pay.ts: the discount error is logged for a retry; the buyer gets "paid".

#### The code
Before (apps/api/src/paymentLinks/pay.ts:246):
```ts
await applyCaptureDiscountAdjustment(pool, { merchantId: link.merchantId, transactionId: txnId });
```
After:
```ts
try {
  await applyCaptureDiscountAdjustment(pool, { merchantId: link.merchantId, transactionId: txnId });
} catch (err) {
  console.error(`payPaymentLink: discount adjustment failed for transaction ${txnId} ... — retry needed`, err);
}
```
The buyer's answer matches what happened: they paid.

#### The proof
- Before: the request failed with "discount db down".
- After: 200 paid, and the failure is logged.

#### If the judges ask
"Is the discount lost?"
It is logged but not retried automatically; that retry is open work, so this entry is only partly fixed.

Commit: 5543ef2

### N95 — A failed capture frees the buyer's card hold

#### The idea
Paying first puts a hold on the card (authorize), then takes the money (capture).

#### The problem
When the capture failed, the hold stayed on the buyer's card.
- A retry made a second hold.

#### The fix
- pay.ts: after a failed capture, the hold is cancelled (voided).

#### The code
Before (apps/api/src/paymentLinks/pay.ts:193): the link was released, the hold was not.
After:
```ts
await voidTransaction(pool, { transactionId: txnId, merchantId: link.merchantId, actor: { type: "system", id: link.id } })
```
The card hold is released at once.

#### The proof
- Before: the payment stayed "authorized".
- After: "voided", and the link is free again.

#### If the judges ask
"Could it cancel a payment that was taken?"
No. Voiding only works on payments that are still only authorized.

Commit: d3788b8

### N96 — Sign-up and profile changes check their fields

#### The idea
A new shop signs up with its details and an owner password.

#### The problem
- A one-letter password was accepted.
- Wrong field types or a 3-letter country crashed the request (500).

#### The fix
- businessProfile.ts (route) and the profile update: strings only, known business types, 2-letter country, password 12-256 characters.

#### The code
Before (apps/api/src/routes/businessProfile.ts:27): only "is the field there?".
After:
```ts
if (owner.password.length < 12 || owner.password.length > 256) {
  throw new BadRequestError("weak_password", "password must be 12 to 256 characters");
}
```
Bad sign-ups get clear 400 answers.

#### The proof
- Before: password "a" → 201; others → 500.
- After: all refused with 400; a valid sign-up still works.

#### If the judges ask
"Is email checked?"
Not yet; email format and lower-casing are still open, so this entry is partly fixed.

Commit: 7a8b0e6

### N97 — CSV cells with a carriage return are quoted

#### The idea
The export is a CSV file that opens in spreadsheets.

#### The problem
A value with a carriage return was not quoted.
- Spreadsheets split that row in two.

#### The fix
- exportCsv.ts: also quote values that contain \r.

#### The code
Before (apps/api/src/transactions/exportCsv.ts:35):
```ts
if (value.includes(",") || value.includes('"') || value.includes("\n")) {
```
After:
```ts
if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
```
Such cells are wrapped in quotes.

#### The proof
- Before: "order\r42" was not quoted.
- After: quoted; 9 export tests pass.

#### If the judges ask
"Is this a security issue?"
No, it is a correctness issue in exported files.

Commit: b4797ab

### N98 — An impersonating admin cannot act as a writer

#### The idea
Admins can view a shop "as" the shop (impersonation), read-only.

#### The problem
A helper labelled an impersonating admin as a shop session writer.

#### The fix
- requireMerchantAuth.ts: the helper refuses impersonation with 403.

#### The code
Before (apps/api/src/auth/requireMerchantAuth.ts:129):
```ts
if (auth.actorType === "merchant_api_key") {
```
After:
```ts
if (auth.actorType === "admin_impersonation") {
  throw new ForbiddenError("forbidden", "impersonation is read-only");
}
```
Impersonation can never be recorded as a writer.

#### The proof
- Before: no error.
- After: 403; 43 admin tests pass.

#### If the judges ask
"Was this exploitable?"
Not today; every route using it already needs owner or finance. This is defence in depth.

Commit: 6debcca

### N99 — An adjustment file has at most 1000 rows

#### The idea
Finance uploads a CSV of balance corrections.

#### The problem
No row limit; a huge file ran as one long database step, past the 60-second proxy limit.

#### The fix
- adjustmentCsvParsing.ts: more than 1000 rows is refused before anything runs.

#### The code
Before: no limit.
After (apps/api/src/admin/adjustmentCsvParsing.ts):
```ts
if (lines.length - 1 > MAX_ADJUSTMENT_ROWS) {
  throw new BadRequestError("too_many_rows", `at most ${MAX_ADJUSTMENT_ROWS} rows per import; split the file`);
}
```
Big files must be split.

#### The proof
- Before: 1001 rows accepted.
- After: 1001 refused, 1000 accepted.

#### If the judges ask
"Why 1000?"
A safe size for one transaction; it is marked for Zainab to review.

Commit: 89d754e

### N100 — The leaked acquirer secret is dead

#### The idea
The bank (acquirer) signs its callbacks with a shared secret, like a wax seal.

#### The problem
The secret was committed to git history.
- Our local setup still used that leaked value.

#### The fix
- config.ts: the server refuses to start with the leaked secret (we keep only its hash).
- gen-env.sh: replaces the leaked value with a new random one.

#### The code
Before (apps/api/src/config.ts:208): any secret was accepted.
After:
```ts
if (acquirerCallbackSigningSecret !== "" && LEAKED_SECRET_SHA256.has(createHash("sha256").update(acquirerCallbackSigningSecret).digest("hex"))) {
  throw new Error("loadConfig: ... the value leaked in git history; run ops/gen-env.sh for a new one");
}
```
The leaked value can never verify a callback again.

#### The proof
- Before: the server started with the leaked secret.
- After: it refuses; the local file now has a new 64-character secret.

#### If the judges ask
"Why not rewrite git history?"
Rewriting cannot recall copies already cloned; making the value useless is the real fix. The live server only gets a new secret.

Commit: 1b8659c

### N101 — A suspended shop loses access

#### The idea
An admin can suspend a shop, like freezing a bank account.

#### The problem
A suspended shop's logins and API keys kept working.

#### The fix
- sessions.ts and verify.ts: a login or key only works if the shop is active.

#### The code
Before (apps/api/src/apiKeys/verify.ts:19):
```sql
SELECT id, merchant_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL
```
After:
```sql
SELECT k.id, k.merchant_id FROM api_keys k JOIN merchants m ON m.id = k.merchant_id
 WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND m.status = 'active'
```
Suspended shops get 401.

#### The proof
- Before: session and key still worked after suspension.
- After: both get 401; full regression green.

#### If the judges ask
"Are the sessions deleted?"
No, they are hidden; re-activating the shop restores them. That is recorded as a known limit.

Commit: 9397d53

### N102 — A webhook archive cannot load all history at once

#### The idea
Admins can save a copy (archive) of a shop's past webhook messages, like photocopying a ledger.

#### The problem
Creating an archive loaded every message ever sent into memory.
- A busy shop could use up the API's memory.

#### The fix
- archiveReplay.ts: at most 10,000 messages per archive; a wider range is refused (never cut short).

#### The code
Before (apps/api/src/webhooks/archiveReplay.ts:51): no limit.
After:
```ts
if (rows.rows.length > ARCHIVE_MAX_DELIVERIES) {
  throw new BadRequestError("archive_range_too_large", ...);
}
```
Too-wide ranges get 400.

#### The proof
- Before: 10,001 messages were archived.
- After: refused with 400.

#### If the judges ask
"Why refuse instead of cutting?"
An archive must be complete for its dates; a cut-off copy would be misleading.

Commit: 364058f

### N103 — Health checks on the live site reach the API

#### The idea
A health check is a quick "are you alive?" question, like a nurse checking a pulse.

#### The problem
On the public port, /healthz returned the web page.
- A monitor could never see the API's real state.

#### The fix
- nginx.conf: forward /healthz and /readyz to the API.

#### The code
Before (ops/nginx/nginx.conf): only /v1/ went to the API.
After:
```nginx
location = /healthz { proxy_pass http://api; access_log off; }
```
The check now asks the API itself.

#### The proof
- Before: 200 text/html.
- After: 200 {"status":"ok"} on the local stack.

#### If the judges ask
"How did you find it?"
Our live end-to-end check, run the way automated tests would.

Commit: 3e31313

### N104 — The report filter accepts "partially refunded"

#### The idea
Reports can filter payments by status, like sorting receipts.

#### The problem
My earlier fix (E133) left "partially_refunded" out of the allowed list.
- A valid filter was refused.

#### The fix
- reporting.ts: add it to the list, matching the database.

#### The code
Before (apps/api/src/routes/reporting.ts:92): the list had 6 statuses.
After:
```ts
const REPORT_STATUSES = ["authorized", "captured", "partially_captured", "voided", "partially_refunded", "refunded", "chargeback"];
```
All seven real statuses are allowed.

#### The proof
- Before: 400 for partially_refunded.
- After: 200.

#### If the judges ask
"Who found it?"
The second review; it was a regression from our own fix, and we say so.

Commit: e9f97dd

### N105 — Saved filters need a real name and a proper filter

#### The idea
Shops can save report filters with a name, like bookmarks.

#### The problem
A name of only spaces and a list instead of a filter were saved.

#### The fix
- reporting.ts: the name must have text; the filter must be an object.

#### The code
Before (apps/api/src/routes/reporting.ts:59): name only had to be truthy.
After:
```ts
if (typeof name !== "string" || name.trim() === "") {
```
Blank names and list filters get 400.

#### The proof
- Before: both were stored.
- After: both refused; a normal filter still saves.

#### If the judges ask
"Is this security?"
No, data quality; bad input gets a clear 400.

Commit: ebe2652

### N106 — A payment link cannot be for 0 fils

#### The idea
A payment link asks a buyer to pay a set amount.

#### The problem
A 0-fils link crashed the request (500) at a database rule.

#### The fix
- create.ts: amounts must be above 0.

#### The code
Before (apps/api/src/paymentLinks/create.ts:38): only toFils was called.
After:
```ts
if (amountFils <= 0) {
  throw new BadRequestError("invalid_amount", ...);
}
```
Zero amounts get 400.

#### The proof
- Before: 500.
- After: 400.

#### If the judges ask
"Why didn't toFils catch it?"
Zero is a valid number of fils in general; only a payment needs it above 0.

Commit: 6c74bd0

### N107 — A payment link's end date must be real and say its zone

#### The idea
A link expires at a set time.

#### The problem
"30 February" rolled over to March, and a time without a zone used the server's zone.

#### The fix
- create.ts: the shared strict date check runs first.

#### The code
Before (apps/api/src/paymentLinks/create.ts:43):
```ts
const expiresAtDate = new Date(input.expiresAt);
```
After:
```ts
if (!isRealDate(input.expiresAt)) { throw new BadRequestError("invalid_expiry", ...); }
```
Bad dates get 400.

#### The proof
- Before: 2099-02-30 accepted.
- After: refused; the dashboard's format still works.

#### If the judges ask
"Does the dashboard still work?"
Yes; it sends dates with a Z.

Commit: 1ff0962

### N108 — Disabled webhooks receive nothing

#### The idea
A shop can switch off a webhook address, like unplugging a doorbell.

#### The problem
Messages queued before it was switched off were still sent.

#### The fix
- dispatcher.ts: the sending step skips disabled addresses.

#### The code
Before (apps/api/src/webhooks/dispatcher.ts:228): only the message status was checked.
After:
```sql
AND we.status = 'active'
```
Nothing goes to a switched-off address.

#### The proof
- Before: the message was sent.
- After: nothing sent; it waits until re-enabled.

#### If the judges ask
"Are those messages lost?"
No, they stay pending and go out if the shop switches the address back on.

Commit: 4553c70

### N109 — The public payment link hides API key data

#### The idea
Anyone with a payment link can see its page and amount, like a price tag in a window.

#### The problem
The public link answer also showed the shop's API key hash and prefix.
- No login was needed to see them.

#### The fix
- read.ts: the public answer no longer reads or returns any API key data.

#### The code
Before (apps/api/src/paymentLinks/read.ts:43):
```sql
ak.key_prefix AS merchant_public_key,
ak.key_hash AS integration_id
```
After: those lines and the api_keys join are gone.
The public page shows only what a buyer needs.

#### The proof
- Before: the live site returned both fields.
- After: both are gone; an old test that expected the prefix was corrected.

#### If the judges ask
"Was the key itself exposed?"
No, only its hash and prefix; still, it helped an attacker and no page used it.

Commit: a04e53b

### N110 — Webhook addresses cannot contain a password

#### The idea
A shop gives us a web address for its notifications.

#### The problem
Addresses with a username and password inside were accepted.
- They could never be delivered, and the password sat in our database.

#### The fix
- create.ts: such addresses are refused.

#### The code
Before (apps/api/src/webhooks/create.ts:24): only the protocol was checked.
After:
```ts
if (parsed.username !== "" || parsed.password !== "") {
  throw new BadRequestError("invalid_url", ...);
}
```
Credentials in the address get 400.

#### The proof
- Before: accepted.
- After: refused.

#### If the judges ask
"Why not allow it?"
The sender refuses such addresses anyway, and storing a password in an address is unsafe.

Commit: b1fc38d

### N111 — A card payment needs a real amount

#### The idea
A shop asks us to charge a card a set amount.

#### The problem
An amount of 0 reached the bank before the database refused it (500).
- A negative amount also crashed.

#### The fix
- transactions.ts: the amount must be a positive whole number of fils, checked first.

#### The code
Before (apps/api/src/routes/transactions.ts:85):
```ts
amountFils: toFils(amountFils),
```
After:
```ts
if (typeof amountFils !== "number" || !Number.isSafeInteger(amountFils) || amountFils <= 0) {
  throw new BadRequestError("invalid_amount", ...);
}
```
Bad amounts never reach the bank.

#### The proof
- Before: 0 → 500 after a bank call.
- After: 400 with no bank call; 58 payment tests pass.

#### If the judges ask
"Did 0 ever charge a card?"
No money moved, but the bank saw an authorization request that we then dropped.

Commit: 06131f5

### N112 — Webhook archive dates must be real

#### The idea
Admins can resend or archive webhooks for a date range.

#### The problem
Impossible dates rolled over and times without a zone used the server's zone.

#### The fix
- adminMerchants.ts: the shared strict date check is used.

#### The code
Before (apps/api/src/routes/adminMerchants.ts:229):
```ts
const fromDate = new Date(from);
```
After:
```ts
const fromDate = parseOptionalDate(from, "from")!;
```
Bad dates get 400.

#### The proof
- Before: 2026-02-30 accepted.
- After: 400; the admin page still works.

#### If the judges ask
"Does the admin page send zones?"
Yes; it converts with toISOString.

Commit: b6bfae5

### N113 — Admin batch and fee tools check their input

#### The idea
Admins can run a day's settlement or recalculate fees.

#### The problem
- "30 February" reached the settlement service and came back as 500.
- A backwards fee range did nothing but said "done".
- An unknown shop crashed the batch.

#### The fix
- admin.ts: real dates, from before to, and an existing shop.

#### The code
Before (apps/api/src/routes/admin.ts:118):
```ts
if (!date || !ISO_DATE_RE.test(date)) {
```
After:
```ts
if (!date || !isRealDate(date, true)) {
```
Bad input gets 400 or 404 before anything runs.

#### The proof
- Before: 2026-02-30 reached settlement.
- After: 400; unknown shop 404; backwards range 400.

#### If the judges ask
"Why check the shop here?"
So the request fails clearly before an audit row and a settlement call are made.

Commit: c4445c3

### N114 — A broken image upload leaves nothing behind

#### The idea
Shops upload ID documents; for photos we make a small preview.

#### The problem
A broken image was saved first, then the preview step crashed (500).
- The broken file stayed on disk.

#### The fix
- kyc.ts: make the preview first; a broken image gets 422 and nothing is saved.

#### The code
Before (apps/api/src/onboarding/kyc.ts:75): the file was written before the preview.
After:
```ts
try {
  thumbnail = await generateKycThumbnail(input.buffer, detected);
} catch {
  throw new UnprocessableEntityError("invalid_image", "the image could not be read");
}
```
Only readable images are stored.

#### The proof
- Before: 500 and an orphan file.
- After: 422 and no file.

#### If the judges ask
"What about slightly damaged phone photos?"
They might be refused too; that choice is marked for Zainab to review.

Commit: af7cbc4

### N115 — One document per upload

#### The idea
A KYC upload sends one document file.

#### The problem
Sending two files kept only the last one, silently.

#### The fix
- kyc.ts: a second file in the same upload gets 400.

#### The code
Before (apps/api/src/routes/kyc.ts:49): each file overwrote the last.
After:
```ts
if (buffer !== undefined) {
  throw new BadRequestError("too_many_files", "send one file per request");
}
```
The shop is told to send one file.

#### The proof
- Before: 201, only b.pdf stored.
- After: 400, nothing stored.

#### If the judges ask
"Why not use the upload library's limit?"
We tried; it closed the stream early and gave 500, so we check in our loop.

Commit: 045afc1

### N116 — The retry timer test

#### The idea
A failed webhook is sent again later, with a small random wait added. It is like a bus that comes "about every 10 minutes", not exactly 10.

#### The problem
One test expected the exact wait.
- It failed on every run (1084 ms instead of 1000 ms).
- A red test hides real failures.

#### The fix
- dispatcher.test.ts: the test passes a fixed "random" value (0.5) that adds nothing. The code stays as it is.

#### The code
Before (apps/api/src/webhooks/dispatcher.test.ts:195):
```ts
const expectedDelay1 = backoffDelayMs(1, config);
```
After:
```ts
const expectedDelay1 = backoffDelayMs(1, config, () => 0.5);
```
The test now asks for the wait with no random part, so the answer is exact.

#### The proof
- Before: actual 1084, expected 1000.
- After: 9/9, three runs; the whole suite has 0 failures.

#### If the judges ask
"Did you change the test to make it pass?"
Yes, because the test was wrong; the random wait is wanted (dispatcher.ts:57-65) and the code is unchanged.

Commit: 49e0c14

### N117 — New key after the code

#### The idea
Logging in has two steps: password, then a one-time code. It is like a hotel giving you a new room key after you show your ID.

#### The problem
The session token stayed the same after the code step.
- Someone who saw the token before login could use it after login (session fixation).

#### The fix
- auth/sessions.ts: promoting a session writes a new token, and only if the session is still pending, not revoked and not expired.
- routes/auth.ts: the cookie gets the new token.

#### The code
Before (apps/api/src/auth/sessions.ts:57):
```ts
UPDATE sessions SET authenticated = true ... WHERE id = $1
```
After:
```ts
UPDATE sessions SET authenticated = true, ..., token_hash = $3
 WHERE id = $1 AND authenticated = false AND revoked_at IS NULL AND expires_at > now()
```
The old token stops working. A session in the wrong state is not promoted.

#### The proof
- Before: the token after verify was the same as at login.
- After: the old token gets 401, the new one 200. Auth tests 21/21.

#### If the judges ask
"The attacker still needs the code. Why does it matter?"
The victim types the code, not the attacker; without a new token the attacker rides on the victim's login.

Commit: aa35616

### N118 — At most 50 saved filters

#### The idea
A shop can save report filters to reuse. It is like a phone that keeps a fixed number of favourites.

#### The problem
There was no limit.
- A comment promised a database rule that does not exist.
- One shop could store rows without end.

#### The fix
- savedFilters.ts: count and insert under one lock per shop; the 51st gets 409.

#### The code
Before (apps/api/src/reporting/savedFilters.ts:30): a plain INSERT.
After:
```ts
await client.query(`SELECT pg_advisory_xact_lock(hashtext('saved_filters:' || $1))`, [input.merchantId]);
if (count.rows[0]!.n >= MAX_SAVED_FILTERS) throw new ConflictError("too_many_saved_filters");
```
Requests from one shop wait in line, so ten at once cannot all pass.

#### The proof
- Before: 45 saved, 10 at once, all 10 stored.
- After: 5 stored, 5 refused, 50 in total.

#### If the judges ask
"Why a lock and not just a count?"
Two requests can both count 49 and both insert; the lock makes them take turns.

Commit: ef20f9d

### N119 — At most 20 KYC documents

#### The idea
A shop uploads ID papers for review. It is like a drop box with a fixed size.

#### The problem
A shop could upload without end.
- The files sit on the same disk as the database.
- A full disk stops the database.

#### The fix
- onboarding/kyc.ts: count before writing to disk; count again inside the transaction with the shop row locked; the 21st gets 409.

#### The code
Before (apps/api/src/onboarding/kyc.ts:85): the file was written with no count.
After:
```ts
if (already.rows[0]!.n >= MAX_KYC_DOCUMENTS_PER_MERCHANT) {
  throw new ConflictError("too_many_documents");
}
```
Nothing is written once a shop has 20 documents.

#### The proof
- Before: the 21st upload was stored; 5 at once were all stored.
- After: 409 and no file; 1 of 5 stored.

#### If the judges ask
"What if a shop is rejected many times?"
No code deletes documents, so 20 is a lifetime limit; this is a decision for review.

Commit: 09c7707

### N120 — New key after the code (admin)

#### The idea
Staff log in to the admin console with password and code. Same hotel-key idea as N117, for staff.

#### The problem
The admin token stayed the same after the code step.
- A staff member found it before (FP-198); the reply was "unresolved".

#### The fix
- adminAuth/sessions.ts: the same new-token and state check as N117.
- routes/adminAuth.ts: the cookie gets the new token.

#### The code
Before (apps/api/src/adminAuth/sessions.ts:74):
```ts
UPDATE admin_sessions SET authenticated = true ... WHERE id = $1
```
After:
```ts
UPDATE admin_sessions SET ..., token_hash = $3
 WHERE id = $1 AND authenticated = false AND revoked_at IS NULL AND expires_at > now()
```
The pre-login admin token stops working.

#### The proof
- Before: the admin token after verify was the same as at login.
- After: old token 401, new token 200. Admin tests 80/80.

#### If the judges ask
"Why did eight test files change?"
Their login helpers kept the old cookie; now they take the new one, as a browser does.

Commit: e8c9454

### N121 — The real error comes first

#### The idea
Database work runs in a transaction: all steps happen, or none. If a step fails, we undo with ROLLBACK, like tearing up a half-written cheque.

#### The problem
If the undo itself failed, its error replaced the real one.
- The log showed "connection terminated", not the real cause.
- The broken connection went back to the pool for reuse.

#### The fix
- withTransaction.ts: catch the ROLLBACK error, keep the real error, and tell the pool to throw the connection away.

#### The code
Before (apps/api/src/db/withTransaction.ts:34):
```ts
await client.query("ROLLBACK");
throw err;
```
After:
```ts
try { await client.query("ROLLBACK"); } catch (rollbackErr) { broken = ...; }
throw err;
// finally: client.release(broken);
```
The caller sees the true error. A broken connection is destroyed.

#### The proof
- Before: the caller got "connection terminated".
- After: the caller gets the real error; release gets an Error.

#### If the judges ask
"Why not trust MK's comment that release still runs?"
It does run, but without the error the pool keeps a dead connection, and the real cause is lost.

Commit: 86818c4

### N122 — Safe file names in downloads

#### The idea
When staff download a KYC file, a header tells the browser its name. It is like the label on an envelope.

#### The problem
The name the shop typed went into the header as it was.
- A quote could add extra header parts.
- A line break could make the server crash (500).

#### The fix
- New contentDisposition.ts: keep only safe letters in the plain name; put the full name in an encoded part.
- kyc.ts: both downloads use it.

#### The code
Before (apps/api/src/routes/kyc.ts:104):
```ts
reply.header("Content-Disposition", `inline; filename="${file.fileName}"`);
```
After:
```ts
reply.header("Content-Disposition", inlineContentDisposition(file.fileName));
```
The header can no longer carry quotes or line breaks from the shop.

#### The proof
- Before: a name with a quote and CR LF stayed in the header.
- After: no CR LF, only our two quotes; Arabic names kept in the encoded part.

#### If the judges ask
"Why not reject such names at upload?"
Old rows already hold them; fixing the header protects old and new names.

Commit: ceacc85

### N123 — Viewing as a shop is read-only

#### The idea
Support staff can view the dashboard as a shop to help it. Like a guest key that opens doors but cannot move furniture.

#### The problem
That view could still save report filters in the shop's name.

#### The fix
- reporting.ts: saving a filter calls the existing "is this a real writer?" check; staff get 403.

#### The code
Before (apps/api/src/routes/reporting.ts:57): no writer check.
After:
```ts
requireMerchantWriterActor(request.merchantAuth!);
```
Staff viewing as a shop are refused; the shop itself is not.

#### The proof
- Before: 201, a filter created.
- After: 403, no row; reading still 200.

#### If the judges ask
"API keys can still save filters. Why?"
The code treats an owner-issued key as full shop power by design, and a filter moves no money; this is a decision for review.

Commit: 25046a4

### N124 — No control characters in reasons

#### The idea
Staff write a short reason when they change a balance or give a credit. It is like a note on a receipt.

#### The problem
Hidden characters were accepted.
- A NUL byte made the server crash (500).
- A line break wrote fake lines into audit exports.

#### The fix
- queryParsing.ts: one helper that finds control characters.
- Credit memo and balance reason refuse them (400).
- errorHandler.ts: the database "bad character" errors become 400 everywhere.

#### The code
Before (apps/api/src/routes/adminBalanceAdjustments.ts:41): only "not empty" was checked.
After:
```ts
if (hasControlChars(source.reason)) {
  throw new BadRequestError("invalid_request", "reason must not contain control characters or line breaks");
}
```
Bad text is stopped before the database.

#### The proof
- Before: reason with NUL → 500.
- After: NUL, CR LF, tab → 400; normal text still works.

#### If the judges ask
"Why two layers?"
The check gives a clear message; the handler catches any other text field we did not list.

Commit: 3617361

### N125 — No import skipped between pages

#### The idea
The admin list of CSV imports shows pages of rows. Like reading a book: each page should start where the last one ended.

#### The problem
The bookmark was only the time, compared as text.
- Two imports at the same time: one was skipped.

#### The fix
- adjustmentImport.ts: the bookmark is time plus id, compared as real times.

#### The code
Before (apps/api/src/admin/adjustmentImport.ts:175):
```sql
WHERE created_at::text < $1 ORDER BY created_at DESC
```
After:
```sql
WHERE (created_at, id) < ($1::timestamptz, $2::uuid) ORDER BY created_at DESC, id DESC
```
The id breaks ties, so every import appears once.

#### The proof
- Before: 3 imports at one time, pages of 2: one missing.
- After: all 3 shown once.

#### If the judges ask
"What happens to an old bookmark?"
It gets a clear 400 once; the admin page then starts from page one.

Commit: 8b391fe

### N126 — Only two fraud answers allowed

#### The idea
The bank calls us back with the result of a fraud review. It is like a letter that must say "cleared" or "fraud".

#### The problem
Any word was accepted and stored as the result.
- A comment said it was checked; it was not.

#### The fix
- acquirerCallbacks.ts: anything other than cleared or confirmed_fraud gets 400.

#### The code
Before (apps/api/src/routes/acquirerCallbacks.ts:72):
```ts
outcome: body.outcome as AcquirerCallbackInput["outcome"],
```
After:
```ts
if (body.outcome !== "cleared" && body.outcome !== "confirmed_fraud") {
  throw new BadRequestError("invalid_request", "outcome must be cleared or confirmed_fraud");
}
```
A wrong word is refused before anything is stored.

#### The proof
- Before: a signed callback with "approved_by_magic" was stored.
- After: 400 and nothing stored.

#### If the judges ask
"The callback is signed. Why check more?"
A signature proves who sent it, not that the content makes sense.

Commit: 35c9921

### N127 — No delete without a filter

#### The idea
A helper builds DELETE commands for scripts. It is like a shredder that should only take the pages you hand it.

#### The problem
An empty filter built "DELETE FROM holds" with no condition.
- That empties the whole table.
- Names were pasted into the SQL as they were.

#### The fix
- sqlFilter.ts: refuse a DELETE with no condition; allow only plain table and column names.

#### The code
Before (scripts/lib/sqlFilter.ts:30):
```ts
return { text: `DELETE FROM ${table} ${clause}`.trim(), values };
```
After:
```ts
if (clause === "") throw new Error(`sqlFilter: refusing DELETE FROM ${table} with no filter`);
```
The helper stops instead of deleting everything.

#### The proof
- Before: { id: undefined } gave "DELETE FROM holds".
- After: refused; the normal case still works.

#### If the judges ask
"Does any script call it with an empty filter today?"
No; its only caller passes a list, but one wrong value would empty the table, so the helper now refuses.

Commit: 5e4a32a

### N128 — One new code per resend

#### The idea
A shop can ask for a new login code, at most once every 30 seconds. Like a ticket machine that gives one ticket per press.

#### The problem
Ten requests at the same moment all passed the 30-second check.
- Ten new codes were made.

#### The fix
- auth.ts: the 30-second check is inside the same database update that retires the old code.

#### The code
Before (apps/api/src/routes/auth.ts:274):
```sql
UPDATE otp_challenges SET consumed_at = now() WHERE id = $1
```
After:
```sql
UPDATE otp_challenges SET consumed_at = now()
 WHERE id = $1 AND consumed_at IS NULL AND created_at <= now() - interval '30 seconds'
```
Only the first request changes the row; the others get 429.

#### The proof
- Before: 10 at once, all 10 got 200.
- After: exactly one 200 per round, five rounds.

#### If the judges ask
"The guess count still carried over. Why does it matter?"
Each extra code is another message sent and another valid code alive; the limit should hold.

Commit: dacc5f8

### N129 — Time to finish a payout run

#### The idea
When we redeploy, the payout service is asked to stop. It is like asking a cashier to finish the current customer before closing.

#### The problem
The service waits 30 seconds to finish, but Docker forced it off after 10.
- A nearly done run had to start again.

#### The fix
- docker-compose.yml: give the payout service 40 seconds to stop.

#### The code
Before (ops/docker-compose.yml:107): no setting, so 10 seconds.
After:
```yaml
stop_grace_period: 40s
```
Docker now waits longer than the service's own 30 seconds.

#### The proof
- Before: no stop_grace_period in the file.
- After: docker compose config shows 40s for settlement.

#### If the judges ask
"Could money be paid twice if it is cut off?"
No; each step is one transaction that rolls back, and a re-run skips finished batches.

Commit: d3e4fd1

### N130 — Settlement errors stay inside

#### The idea
The admin console asks the payout service to run. If it fails, staff see a message. It is like a shop counter: the customer hears "please wait", not the kitchen's internal shouting.

#### The problem
The message showed internal details.
- Internal paths, host names and the service's raw error text reached the browser.

#### The fix
- errors.ts: an error can carry a "detail" that is never sent.
- settlementClient.ts: a short fixed message for staff; the details go into "detail".
- errorHandler.ts: the detail is written to the server log.

#### The code
Before (apps/api/src/admin/settlementClient.ts:146):
```ts
`settlement internal call to ${path} returned ${response.status}: ${excerpt}`,
```
After:
```ts
"The settlement service reported an error. Check the settlement logs before retrying.",
`settlement internal call to ${path} returned ${response.status}: ${excerpt}`, // log only
```
Staff see a clear message; engineers still find the details in the log.

#### The proof
- Before: the message had "/internal/run-batch" and the raw upstream text.
- After: none of it in the message; all of it in the log detail.

#### If the judges ask
"Only finance staff see this. Why hide it?"
Internal names help an attacker who takes over a staff account; the log keeps them for us.

Commit: 287b2c0

### N131 — Settings must be real numbers

#### The idea
The reporting worker reads settings like "check every 15000 ms". It is like an oven dial: it should not accept nonsense.

#### The problem
"15s" was read as 15 milliseconds.
- The worker would hit the database every 15 ms.
- A comment said this case fails; it did not.

#### The fix
- reporting config.ts: digits only, inside a range; anything else stops the worker at start.

#### The code
Before (apps/reporting/src/config.ts:27):
```ts
const parsed = Number.parseInt(value, 10);
```
After:
```ts
if (!/^\d+$/.test(value.trim())) throw new Error(`loadConfig: ${name} must be a whole number, got "${value}"`);
```
A typo is caught at start, not in production traffic.

#### The proof
- Before: "15s" accepted.
- After: "15s", "0", "1.5", "-1" refused; normal values load.

#### If the judges ask
"Why stop the worker instead of using the default?"
A silent default hides the typo; stopping makes someone fix it.

Commit: bf1cbb7

### N132 — No input values in error records

#### The idea
When the reporting worker cannot use an event, it parks it in a "dead letter" table. Like a lost-and-found box with a label.

#### The problem
The label was the raw database message.
- Some database messages repeat the bad input value.
- That could put personal data into logs.

#### The fix
- runConsumerPass.ts: store the error code and the column name, not the message.

#### The code
Before (apps/reporting/src/consumer/runConsumerPass.ts:75):
```ts
const message = err instanceof Error ? err.message : String(err);
```
After:
```ts
const message = describeParkError(err); // "SQLSTATE 22P02 column=..."
```
The label says what kind of error and where, never the value.

#### The proof
- Before: the full message was stored.
- After: a test message with an email keeps the code and column, without the email.

#### If the judges ask
"Is it harder to debug now?"
A little; the row still points to the event id, so the full event can be found.

Commit: 2a8a534

### N133 — Expired links look expired

#### The idea
A shop sees its payment links on the dashboard. A link has an end time, like a coupon.

#### The problem
A link past its end time still showed "active".
- It also showed a Cancel button.
- The "active" filter included it.

#### The fix
- serialize.ts: an active link past its end time is shown as "expired".
- query.ts: the filter uses the same rule.
- Web: "expired" added to the filter and coloured red.

#### The code
Before (apps/api/src/paymentLinks/serialize.ts:56):
```ts
status: row.status,
```
After:
```ts
status: row.status === "active" && row.expires_at.getTime() <= Date.now() ? "expired" : row.status,
```
The shop sees the true state; the Cancel button only shows for live links.

#### The proof
- Before: the expired link came back "active".
- After: "expired"; the active filter leaves it out.

#### If the judges ask
"Why not store 'expired' in the database?"
Nothing runs at the exact end time to change it; working it out on read is always right.

Commit: 5cd0d37

### N134 — Yesterday in Bahrain

#### The idea
Staff run a payout batch for a day. The page fills in "yesterday" for them, like a calendar that turns the page at midnight.

#### The problem
The page used the UTC day.
- Between midnight and 3 AM in Bahrain it filled in two days ago.

#### The fix
- New bahrainDate.ts: yesterday in Bahrain time.
- SettlementPage.tsx uses it.

#### The code
Before (apps/admin/src/pages/settlement/SettlementPage.tsx:20):
```ts
date.setDate(date.getDate() - 1);
return date.toISOString().slice(0, 10);
```
After:
```ts
const d = new Date(now.getTime() + BAHRAIN_OFFSET_MS);
d.setUTCDate(d.getUTCDate() - 1);
```
The date follows Bahrain time, like the rest of the system.

#### The proof
- Before: at 1:30 AM Bahrain it showed 2026-10-28.
- After: 2026-10-29.

#### If the judges ask
"Why a fixed +3 hours?"
Bahrain has no daylight saving, and the API and settlement use the same rule.

Commit: db9c444

### N135 — No decimals in money math on screen

#### The idea
The batch page draws a small bar from the batch total. Money in this app is whole fils, like counting coins, never fractions.

#### The problem
The bar was worked out with decimal (float) math on fils.
- The project's own rule (ADR-0001) forbids that.

#### The fix
- SettlementBatchDetailPage.tsx: whole-number math only.

#### The code
Before (apps/web/src/pages/settlement/SettlementBatchDetailPage.tsx:84):
```ts
const displayProgress = parseFloat((batch.grossFils / 10000).toFixed(2));
```
After:
```ts
const displayProgress = Math.min(100, Math.floor(batch.grossFils / 10_000));
```
The bar width comes from whole numbers; no amount is shown from it.

#### The proof
- Before: float and toFixed on fils.
- After: web typecheck clean, web tests 13/13; no money use of parseFloat or toFixed left in the pages.

#### If the judges ask
"It only draws a bar. Why fix it?"
Code copied from here would carry the float habit into real amounts; the rule has no exceptions.

Commit: 9f6cb49

### N136 — Two decimals for the card scheme

#### The idea
The card scheme file lists each amount with exactly two decimals. Like a bank form with two boxes after the point.

#### The problem
A backup path printed many decimals.
- It printed "4.7400000000000000" instead of "4.74".

#### The fix
- scheme_export.go: the backup path cuts to two decimals, like the main path.

#### The code
Before (apps/settlement/internal/settlement/scheme_export.go:71):
```sql
COALESCE(sel.amount, sel.amount_fils::numeric / 1000)::text
```
After:
```sql
COALESCE(sel.amount, trunc(sel.amount_fils::numeric / 1000, 2))::text
```
Both paths now give the same two-decimal text.

#### The proof
- Before: "4.7400000000000000".
- After: "4.74".

#### If the judges ask
"Is this path used today?"
Only if the stored amount is empty; old rows were filled in, so it is a safety net.

Commit: a056bec

### N137 — Do not delete a hold that was just used

#### The idea
A hold reserves money on a card for a while. A night job removes holds that ran out. Like clearing old reservation tags from a shelf.

#### The problem
The job listed old holds, then deleted them by id.
- A hold used in between was still deleted.

#### The fix
- expire_holds.ts: the delete also checks the hold is still unused.

#### The code
Before (scripts/expire_holds.ts:25):
```ts
return buildDelete("holds", { id: expiredIds });
```
After:
```ts
return buildDelete("holds", { id: expiredIds, status: "active" });
```
A hold that changed state after the list was made is kept.

#### The proof
- Before: a hold released in between was deleted.
- After: it stays, with status "released".

#### If the judges ask
"An AI called the window negligible. Why fix it?"
Small windows still happen at scale; one extra condition closes it for free.

Commit: fed085a

### N138 — PDF means a real PDF

#### The idea
Some KYC papers must be PDFs. The server can read the first bytes of a file, like checking a passport photo, not just the name on the cover.

#### The problem
The rule looked only at the file name.
- A photo named "cr.pdf" passed.
- A real PDF with another name was refused.

#### The fix
- onboarding/kyc.ts: use the bytes the server already checked.
- app.test.ts: an old test that pinned the name check now tests a photo named .pdf.

#### The code
Before (apps/api/src/onboarding/kyc.ts:70):
```ts
!input.fileName.toLowerCase().endsWith(".pdf")
```
After:
```ts
detected !== "pdf"
```
The file's content decides, not its name.

#### The proof
- Before: a JPEG named cr.pdf was accepted.
- After: refused with 422; a real PDF with any name is accepted.

#### If the judges ask
"You changed an existing test. Why?"
It expected a real PDF to be refused because of its name; that was the bug, so the test now checks the real risk.

Commit: 3ef0efb

### N139 — Overflow is an error, not a wrong fee

#### The idea
The payout service works out fees by multiplying amount by rate. Numbers in a computer have a top limit, like a car's odometer.

#### The problem
Past the limit the number wrapped around silently.
- The fee would be wrong with no warning.

#### The fix
- money/fils.go: a checked version that returns an error.
- The fee function and its two callers pass the error up.

#### The code
Before (apps/settlement/internal/money/fils.go:16):
```go
return Fils(BankersRoundDiv(int64(amount)*rateBasisPoints, 10_000))
```
After:
```go
if a != 0 && (product/a != rateBasisPoints || ...) {
	return 0, fmt.Errorf("ApplyRateFils: %d * %d overflows int64", a, rateBasisPoints)
}
```
A too-large amount stops with a clear error.

#### The proof
- Before: 1e15 × 10000 gave a wrong value.
- After: refused; all Go tests pass.

#### If the judges ask
"Why an error and not a crash?"
A crash inside the daemon would repeat on every restart and block all shops; an error is logged and handled.

Commit: ecd0bf8

### N140 — One rule for a payment's status

#### The idea
A payment has a status like "captured" or "partially refunded". Like a parcel tracker, every part of the system should show the same state.

#### The problem
Taking the rest of the money after a refund set "captured".
- The refund code and the admin recompute said "partially refunded".
- The status changed depending on which code ran last.

#### The fix
- capture.ts: use the same status rule as refunds.
- A separate "fully captured" check drives the card hold release and the event name.

#### The code
Before (apps/api/src/payments/capture.ts:200):
```ts
const newStatus = compareFils(newCapturedFils, amountAuthorized) === 0 ? "captured" : "partially_captured";
```
After:
```ts
const fullyCaptured = compareFils(newCapturedFils, amountAuthorized) === 0;
const newStatus = nextStatusAfterRefund({ amountFils: amountAuthorized, capturedFils: newCapturedFils, refundedTotalFils: ... });
```
The status follows one rule everywhere; the hold is still released when all money is taken.

#### The proof
- Before: "captured".
- After: "partially_refunded"; hold released; last event "captured".

#### If the judges ask
"Did the reviewer find anything?"
Yes: my first version would have left the card hold active; we fixed it before the commit.

Commit: 640afe2

### N141 — Small screen fixes

#### The idea
Small screens should say exactly what happened, like a clear receipt.

#### The problem
Three small display bugs.
- Checkout showed the paid time as raw computer text.
- A double click on "Load more" showed credits twice.
- The import message called a total of both directions a "posting".

#### The fix
- CheckoutPage.tsx: readable time.
- CreditsPage.tsx: ignore a second click while loading.
- AdjustmentImportPage.tsx: clearer words.

#### The code
Before (apps/web/src/pages/checkout/CheckoutPage.tsx:118):
```tsx
<dd>{payState.result.paidAt}</dd>
```
After:
```tsx
<dd>{dateTime(payState.result.paidAt)}</dd>
```
The buyer sees a normal date and time.

#### The proof
- Before: "2026-10-30T15:12:03.120Z" style text.
- After: web and admin typecheck clean; web tests 13/13.

#### If the judges ask
"Is everything in E109 fixed?"
Three of four; the webhook replay page still keeps an old result when the merchant changes.

Commit: 7c4a68d

### N142 — The seed asks first

#### The idea
The seed script fills a test database with sample data. It is like a reset button: it first empties tables.

#### The problem
It emptied real tables with no question.
- That includes the admin audit log.
- A comment said it was safe on shared databases; it is not.

#### The fix
- New guard.ts: refuse unless FILSPAY_ALLOW_SEED_RESET=1; always refuse in production.
- index.ts calls it first; the false comment and the runbook are corrected.

#### The code
Before (db/seed/index.ts:13): no check.
After:
```ts
assertSeedResetAllowed(process.env);
```
Nobody wipes a database by accident.

#### The proof
- Before: the seed ran with no question.
- After: without the flag it stops with a clear message.

#### If the judges ask
"Why a flag and not a database-name check?"
The local and live databases have the same name; an explicit flag is the only safe signal.

Commit: 319790f

### N143 — Refund checks trust nothing

#### The idea
Before a refund, a helper checks the amount is allowed. Like a cashier who counts the money, not just the receipt.

#### The problem
The helper trusted the numbers it was given.
- 1.5 fils passed.
- A wrong "refundable" figure could allow more than was captured.

#### The fix
- refundValidation.ts: cap at what was captured; amount must be a whole number.

#### The code
Before (apps/api/src/payments/refundValidation.ts:39):
```ts
const refundable = refundableAmount(txn);
```
After:
```ts
const raw = refundableAmount(txn);
const refundable = compareFils(raw, txn.capturedFils) > 0 ? txn.capturedFils : raw;
```
Even a wrong input cannot refund more than was taken.

#### The proof
- Before: 1.5 passed; 6000 allowed on a 4000 capture.
- After: both refused; real refunds unchanged.

#### If the judges ask
"The route already checks. Why here too?"
Defence in depth: the next caller may forget, and this is money.

Commit: c0350b1

### N144 — No row skipped in the export

#### The idea
A long export is read in pages. Like a bookmark, each page must start exactly where the last ended.

#### The problem
The bookmark was only the time.
- Rows with the same time at a page edge were skipped.

#### The fix
- exportCsv.ts: the bookmark is time plus id.

#### The code
Before (apps/api/src/transactions/exportCsv.ts:113):
```sql
AND occurred_at > $5 ORDER BY occurred_at ASC
```
After:
```sql
AND (occurred_at, id) > ($5::timestamptz, $6::uuid) ORDER BY occurred_at ASC, id ASC
```
Every row is exported once.

#### The proof
- Before: with pages of 2, one of 3 same-time rows was missing.
- After: all 3 rows.

#### If the judges ask
"This code is not used. Why fix it?"
It is the obvious way to stream a big export later; it should not lose rows when someone wires it.

Commit: 9d753ab

### N145 — The truth about webhook replays

#### The idea
Staff can resend old webhook messages to a shop. Like reprinting a receipt: is it the same receipt number or a new one?

#### The problem
The admin guide said a replay keeps the old id.
- The code gives each replay a new id, on purpose.
- A shop following the guide would be surprised.

#### The fix
- docs/ADMIN.md: a correction under the false line.
- The code stays as it is (a decision for review).

#### The code
Before (apps/api/src/webhooks/replay.ts:48):
```ts
const newDeliveryEventId = randomUUID();
```
After: unchanged; only the guide changed.
The guide now matches what the code does.

#### The proof
- Before: ADMIN.md said "reuses the original delivery ids".
- After: ADMIN.md explains a replay has a new id and why.

#### If the judges ask
"Why not keep the old id?"
A shop that already handled the old id would silently drop the replay, which defeats the point of resending.

Commit: ac8951e

### N146 — Slow down password guessing

#### The idea
Logging in checks a password with a deliberately slow method. Like a door that takes a second to unlock, so guessing is slow.

#### The problem
There was no limit on attempts.
- A loop could guess passwords or fill the server with slow work.

#### The fix
- New ipRateLimit.ts: at most 120 login or signup calls per address per minute.
- app.ts: read the real client address from nginx.

#### The code
Before (apps/api/src/routes/auth.ts:54):
```ts
app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
```
After:
```ts
app.post<{ Body: LoginBody }>("/login", { preHandler: app.authRateLimit }, async (request, reply) => {
```
Too many tries from one address get 429 with a wait time.

#### The proof
- Before: the 6th try (limit 5) was still checked.
- After: 429 with Retry-After; another address is not affected.

#### If the judges ask
"Can someone fake their address?"
No: nginx replaces the address header with the real one, and only nginx is reachable from outside.

Commit: 88ed92d

### N147 — Dashboard days are Bahrain days

#### The idea
The shop filters transactions by date. A day should start at midnight in Bahrain, like the payouts.

#### The problem
The filter started days at midnight UTC.
- Payments from 00:00 to 03:00 in Bahrain showed under the day before.

#### The fix
- format.ts: midnight Bahrain; impossible dates are not sent.
- The old test pinned the UTC rule and was updated.

#### The code
Before (apps/web/src/format.ts:37):
```ts
return dateValue ? `${dateValue}T00:00:00.000Z` : undefined;
```
After:
```ts
const instant = new Date(`${dateValue}T00:00:00.000+03:00`);
```
The list and the payouts now agree on what "a day" is.

#### The proof
- Before: 2026-09-12 started at 2026-09-12T00:00Z.
- After: it starts at 2026-09-11T21:00Z.

#### If the judges ask
"A comment said this was already fixed."
It was false; the code still used UTC, and the test locked it in.

Commit: b7e67cf

### N148 — No forms from other sites

#### The idea
When you are logged in, your browser sends your login cookie automatically. Another page could try to use that, like someone signing a form in your name.

#### The problem
Pages on other parts of the same site could make your browser act.
- For example log out, or resend a code.

#### The fix
- New csrfOrigin.ts: a request that changes something, carries our cookie, and comes from another site is refused.

#### The code
Before (apps/api/src/app.ts): no check.
After:
```ts
if (!originHost || !host || originHost !== host) {
  throw new ForbiddenError("cross_origin_request", "This request must come from the FilsPay site itself.");
}
```
Only our own pages can act with your cookie.

#### The proof
- Before: a POST from another origin was processed.
- After: 403; our own pages and server clients still work.

#### If the judges ask
"Why ignore the port?"
nginx forwards the host without the port, and the admin console runs on 8081; the same machine counts as one site.

Commit: 65dd9b1

### N149 — Do not ask a charged buyer to pay again

#### The idea
Two buyers can pay the same invoice at the same moment. Only one can win; the other's card may already be charged.

#### The problem
The losing buyer saw "try again shortly".
- They might pay again and lose the reference for their refund.

#### The fix
- CheckoutPage.tsx: a clear final message with the reference.

#### The code
Before (apps/web/src/pages/checkout/CheckoutPage.tsx:77):
```tsx
} else if (statusCode === 409) {
  setPayState({ kind: "declined", message: "...Please try again shortly.", retryable: true });
```
After:
```tsx
} else if (statusCode === 409 && body.error === "payment_link_reservation_lost") {
  setPayState({ kind: "terminal", message: `Your card was charged ... Do not pay again ...${ref}` });
```
The buyer knows not to pay twice and keeps the reference.

#### The proof
- Before: "try again shortly" for a charged buyer.
- After: web typecheck clean, web tests 13/13; the server side is tested by the E29 test.

#### If the judges ask
"Who refunds them?"
The server logs "refund needed" with the transaction id, and the merchant refunds from the dashboard.

Commit: 4513457

### N150 — Expired means expired

#### The idea
A payment link can be held for a minute while someone pays. Like a seat held during checkout.

#### The problem
If a hold timed out after the link expired, the link looked open again.
- The buyer saw a Pay form forever.

#### The fix
- status.ts: a timed-out hold on an expired link reads "expired".
- pay.ts: paying such a link gives 410 expired.

#### The code
Before (apps/api/src/paymentLinks/status.ts:40):
```ts
return stillReserved ? "processing" : "active";
```
After:
```ts
if (stillReserved) return "processing";
return row.expiresAt.getTime() <= Date.now() ? "expired" : "active";
```
An expired link stays expired.

#### The proof
- Before: "active" and 409.
- After: "expired" and 410.

#### If the judges ask
"Is everything in E101 fixed?"
Not the merchant's Cancel button for such a link; it is harmless now because nobody can pay it.

Commit: f788901

