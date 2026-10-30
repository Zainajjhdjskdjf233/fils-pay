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

Summary: 43 of 60 fixed.

## High (24 of 27 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E01 | Migration 0054 builds a view on a table that does not exist | Fixed |
| E02 | docker compose up cannot start the stack | Skipped |
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
| E19 | MDR recalculation changes batches that were already paid | Partly fixed |
| E21 | CSV adjustment import reads BD amounts 10 times too small | Fixed |
| E23 | Daily close runs at 3:00 AM Bahrain, not midnight | Fixed |
| E26 | Admin "recompute statuses" turns test merchants live | Fixed |
| E28 | FP-209 refunds: double refund, refund more than captured, other merchant's refund | Fixed |
| E29 | Incident 2026-05-14: one payment link charged twice | Fixed |
| E30 | Incident 2026-08-21: duplicate payout notifications | Fixed |
| E51 | API and seed cannot start: built-in dev key is 34 bytes, check needs 32 | Fixed |
| E52 | Every refund fails: code inserts reason = NULL, migration 0070 forbids NULL | Fixed |

## Medium (18 of 21 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E20 | Dashboard shows 245 bps, payments charge 225 bps | Fixed |
| E22 | The same adjustment CSV can be applied twice | Fixed |
| E24 | Lifetime payout estimate drifts (float32) | Fixed |
| E25 | Platform volume counter overflows int32 | Fixed |
| E27 | FP-201 (reopened): same acquirer callback stored twice | Fixed |
| E31 | Reconciliation report query is slow and over-counts | Partly fixed |
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
| E50 | Fee at capture ignores the negotiated discount that settlement applies | Skipped |
| E53 | One malformed outbox event stops the whole reporting consumer | Fixed |
| E58 | Session vs impersonation order may mix identities (FP-198 comment) | Open |
| E60 | Reconciliation counts payouts of earlier days as an unexplained gap | Fixed |

## Low (1 of 12 fixed)

| ID | What is wrong | Status |
|---|---|---|
| E38 | Public payment link page exposes the merchant's API key hash and prefix | Open |
| E40 | withTransaction: a failing ROLLBACK hides the real error | Open |
| E45 | /v1/reporting/export-summary always returns 500 | Open |
| E46 | KYC "PDF only" rule checks the filename, not the content | Open |
| E47 | Admin console: session not rotated after OTP; no CSP | Open |
| E48 | Admin run-batch sends no payout notification; split payouts skip the lifetime estimate | Open |
| E49 | settlement rebuild-balances --merchant never writes the cache | Fixed |
| E54 | Webhook backoff test always fails: test expects no jitter, code adds random ±10 % | Open |
| E55 | Seed prints API keys; API listens on every network interface | Open |
| E56 | Go DB tests are flaky when packages run in parallel | Open |
| E57 | Bad input gives 500 instead of 400 (invalid JSON body, malformed UUID) | Open |
| E59 | Acquirer callback outcome is never validated | Open |
