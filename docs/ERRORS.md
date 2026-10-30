# Errors

One line per error. Claude updates this file after every fix and every new error.

## Levels
- High: money is lost or wrong, a security hole, or the app cannot run.
- Medium: wrong results in some cases, or a weaker security problem.
- Low: small bugs, messy code, or problems only in rare cases.

## Status
- Fixed: fixed, tested and committed.
- Partly fixed: the main part is fixed, a small part is left (see LOG.md).
- Skipped: cannot be proven here yet (for example, it needs Docker).
- Open: not started.

Summary: 92 of 163 fixed.

## High (45 of 46 fixed)

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
| E13 | Secrets committed to git and the database open to the internet | Partly fixed |
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

## Medium (31 of 55 fixed)

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
| E65 | [found later] The seed wipes real tables (incl. admin audit log) with no environment check | Open |
| E74 | [found later] Balance cache and ledger rebuild measure different things (drift after rebuild) | Open |
| E75 | [found later] March sweep posts the opposite legs from ADR-0002, charging merchants | Fixed |
| E76 | [found later] Dashboard date filter uses UTC days, not Bahrain days | Open |
| E82 | [found later] Admin "rotate API key" hands staff a full-power merchant key | Open |
| E83 | [found later] Legal name and CR number editable after KYC approval, no re-review | Open |
| E91 | [found later] Every service connects as one Postgres superuser | Fixed |
| E92 | [found later] Ledger immutability claim false; audit log unprotected | Partly fixed |
| E93 | [found later] sqlFilter builds DELETE with no WHERE for null/undefined filters | Open |
| E100 | [found later] Checkout tells a charged buyer to try again (reservation_lost) | Open |
| E101 | [found later] Expired link with stale reservation: Pay form forever, cannot cancel | Open |
| E103 | [found later] View as merchant cannot work end to end | Open |
| E105 | [found later] Refund drawer keeps its key after a definite 4xx (my F01f bug) | Fixed |
| E106 | [found later] Reconciliation and batch pages leave out refund parts | Fixed |
| E125 | [second review] Filters without a time zone read in the server's local zone | Fixed |
| E128 | [deep review] Suspended merchant keeps sessions and API keys | Open |
| E129 | [deep review] Capture idempotency hash ignores the transaction id | Fixed |
| E130 | [deep review] Failed link capture leaves the card authorization open | Fixed |
| E131 | [deep review] Discount error after a paid link gives the buyer a 500 | Partly fixed |
| E139 | [coverage] Capture and the status recompute disagree on a refunded, partly captured transaction | Open |
| E140 | [coverage] Balance adjustment: a huge deltaFils gives 500, and there is no upper limit | Fixed |
| E141 | [coverage] Credit: a huge baseAmountFils with reverseFee gives 500 | Fixed |
| E142 | [coverage] Control characters in credit memos and adjustment reasons are accepted; a NUL byte likely gives 500 | Open |
| E143 | [coverage] A webhook replay gets a new delivery id; comments and docs/ADMIN.md say it keeps the original | Open |
| E144 | [coverage] Webhook archive create loads an endpoint's whole history into memory; "pages of 500" is false | Open |
| E145 | [coverage] Signup: no password rule and no type checks; bad input gives 500 | Partly fixed |
| E146 | [coverage] Public signup and login have no rate limit; each call runs argon2 | Open |
| E147 | [coverage] A broken image upload gives 500 and leaves an orphan file on disk | Open |
| E148 | [coverage] No limit on KYC uploads per merchant: the shared disk can be filled | Open |
| E163 | [second review] API config never refuses bad settings (prefixes, booleans, NODE_ENV typo turns off security defaults, no ranges) | Partly fixed |

## Low (16 of 62 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E38 | Public payment link page exposes the merchant's API key hash and prefix | Open |
| E40 | withTransaction: a failing ROLLBACK hides the real error | Open |
| E46 | KYC "PDF only" rule checks the filename, not the content | Open |
| E47 | Admin console: session not rotated after OTP; no CSP | Open |
| E48 | Admin run-batch sends no payout notification; split payouts skip the lifetime estimate | Open |
| E49 | settlement rebuild-balances --merchant never writes the cache | Fixed |
| E54 | Webhook backoff test always fails: test expects no jitter, code adds random ±10 % | Open |
| E55 | Seed prints API keys; API listens on every network interface | Open |
| E56 | Go DB tests are flaky when packages run in parallel | Open |
| E57 | Bad input gives 500 instead of 400 (invalid JSON body, malformed UUID) | Fixed |
| E59 | Acquirer callback outcome is never validated | Open |
| E66 | [found later] expire_holds can delete holds released between its SELECT and DELETE | Open |
| E67 | [found later] refund_merchant_summary counts captured once per refund; never refreshed (my F01e bug) | Open |
| E68 | [found later] Seed adds the lifetime payout estimate in float32 | Open |
| E69 | [found later] Seeded fees ignore the seeded fee schedules (suspected) | Open |
| E70 | [found later] Seeded outbox events do not match the seeded history | Open |
| E71 | [found later] Re-seeding leaves old dead letters with reused outbox ids | Open |
| E72 | [found later] reconcile_march uses authorization time and running-total residue (suspected) | Open |
| E77 | [found later] Float and toFixed on money in the batch detail page | Open |
| E78 | [found later] Balance rebuild may hit the 30 s timeout; no row lock (suspected) | Open |
| E79 | [found later] Dead helpers with float or wrong-scale money math | Open |
| E80 | [found later] Scheme export fallback can print more than 2 decimals | Open |
| E81 | [found later] Admin Run batch default date uses the UTC day | Open |
| E84 | [found later] CSRF from same-site pages (Lax only, text/plain accepted) | Open |
| E85 | [found later] Impersonation grant survives admin disable/logout | Open |
| E86 | [found later] Dashboard dev proxy forwards /v1/admin; shared cookie jar | Partly fixed |
| E87 | [found later] No anti-framing headers on dashboard and checkout | Fixed |
| E88 | [found later] Read-only impersonation and API keys can write saved filters | Open |
| E89 | [found later] Unsalted SHA-256 of card number and CVV stored | Open |
| E90 | [found later] KYC download puts the raw filename into a header | Open |
| E94 | [found later] Settlement internal API: plain HTTP on all interfaces; weak token accepted | Partly fixed |
| E95 | [found later] Internal settlement errors returned to admin browsers | Open |
| E96 | [found later] Reporting trusts payload merchant/amounts; negative amounts pass (my E53 check) | Open |
| E97 | [found later] Reporting config accepts bad numbers ("15s" → 15 ms) | Open |
| E98 | [found later] Raw Postgres error text in logs and dead letters (my E53 code) | Open |
| E107 | [found later] Expired payment links shown as active with Cancel | Open |
| E108 | [found later] List pages can append rows from an old filter (suspected) | Open |
| E109 | [found later] Small admin/checkout display bugs | Open |
| E110 | [second review] Streaming CSV export pages on occurred_at only (unused code) | Open |
| E111 | [second review] CSV quoting ignores carriage returns | Fixed |
| E112 | [second review] Invalid date filters reach the DB (500 instead of 400) | Fixed |
| E113 | [second review] Session promotion after OTP updates by id only (defence in depth) | Open |
| E114 | [second review] Concurrent OTP resends can rotate the challenge twice | Open |
| E115 | [second review] Impossible dates like 2026-02-30 are accepted | Fixed |
| E116 | [second review] Writer actor does not reject impersonation (defence in depth) | Fixed |
| E126 | [second review] Pagination limits parsed with parseInt; NaN reaches SQL | Fixed |
| E127 | [second review] Settlement date filters accept impossible dates | Fixed |
| E132 | [deep review] Reconciliation reads its figures from different snapshots | Open |
| E133 | [second review] Report filter JSON used without a shape check | Fixed |
| E149 | [coverage] Credit effectiveDate "0000-01-01" passes validation; Postgres likely refuses it (500) | Fixed |
| E150 | [coverage] Balance adjustment returns 404 for a merchant with no balance row yet | Open |
| E151 | [coverage] Defence in depth: validateRefundRequest trusts its caller's numbers | Open |
| E152 | [coverage] Go ApplyRateFils: int64 overflow wraps silently (TS throws) | Open |
| E153 | [coverage] A fully refunded, partly captured row refunded again with no amount gives 422 instead of 409 | Fixed |
| E154 | [coverage] adjustMerchantBalanceJournaled is dead code | Open |
| E155 | [coverage] Webhook PATCH with a bad status gives 500 | Fixed |
| E156 | [coverage] timingSafeEqualHex accepts extra characters after a valid digest | Fixed |
| E157 | [coverage] Several files in one KYC request: earlier ones are silently dropped; "one file enforced" comment is false | Open |
| E158 | [coverage] Adjustment import has no row cap; one long transaction can outlive the 60 s proxy timeout | Open |
| E159 | [second review] Pagination cursors are not validated; a malformed cursor reaches a database cast (500) | Fixed |
| E160 | [second review] The adjustment-import list pages on created_at text with no tie-breaker | Open |
| E161 | [second review] Recent ledger activity includes the exclusive end date (one extra day) | Fixed |
