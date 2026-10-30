# Two AI reviews compared

A second review of FilsPay was made with a different AI tool. Its final list has
24 items. Zainab pasted them in parts on 30 Oct 2026 (2:30 PM, 2:50 PM, 3:00 PM).
Every item was checked against the code before it was recorded (docs/LOG.md;
Judge notes J26 and J27). Entries from it carry the tag **[second review]**.

## Summary

| | Count |
|---|---|
| Items in the second review | 31 (24 + 7 later) |
| Already in our list (matched to an entry) | 14 |
| Real and new, recorded as [second review] | 10 (E110-E116, E125-E127) |
| Not real | 0 |
| High among the new ones | 0 (one Medium, nine Low) |

The second review counts 13 matches and 11 new items. We count 14 and 10,
because its item (f) turned out to be our E34, which was already fixed.

## The 11 items it marked as new

| # | Item (shortened) | Checked in the code | Our entry | Level |
|---|---|---|---|---|
| a | CSV streaming export pages on `occurred_at` only; equal timestamps at a page boundary are skipped (exportCsv.ts:89) | Real. The function is unused today; E39 chose a 50,000-row cap and noted this bug in its decision, but no entry existed. | **New: E110** | Low |
| b | CSV quoting ignores `\r` (exportCsv.ts:22) | Real: only `,` `"` and `\n` trigger quoting. | **New: E111** | Low |
| c | Invalid date filters reach the DB in /v1/transactions list and export (routes/transactions.ts:148,166) | Real: `new Date(q.from)` with no check gives an Invalid Date, a Postgres error and a 500. Same family as E57. | **New: E112** | Low |
| d | Session promotion after OTP updates by id only, merchant and admin (auth/sessions.ts:58) | Real but limited: revoked and expired sessions stay hidden by the `live_sessions` view (0058). Only an expired pending session could be revived, with the correct OTP. | **New: E113** | Low |
| e | Concurrent OTP resends rotate the challenge twice | Real: the 30-second throttle is checked outside the transaction (routes/auth.ts:248). The guess budget still carries over (E34, E117). | **New: E114** | Low |
| f | OTP verify can use a challenge replaced by a concurrent resend | Already fixed by our E34: verify reserves an attempt only where `consumed_at IS NULL`, so a replaced challenge gets 410. | **Matches E34 (fixed)** | — |
| g | Impossible dates like 2026-02-30 accepted (analytics, transactions) | Real: `Date.parse("2026-02-30")` rolls over to 2 March; the comment "rejects 2026-02-30" (analytics.ts:25) is false. | **New: E115** | Low |
| h | `requireMerchantWriterActor` does not reject `admin_impersonation` | Real, defence only: every route using it already requires owner or finance, and impersonation has the "support" role. | **New: E116** | Low |
| i | Timestamps without a time zone use the server's time zone (routes/transactions.ts) | Real: `2026-03-01T00:00` is 2026-02-28T21:00Z on a Bahrain-zone machine and 2026-03-01T00:00Z in a UTC container (checked with node in both zones). | **New: E125** | Medium |
| j | Pagination limits parsed with `parseInt` in each route; NaN can reach SQL (7 routes) | Real: `limit=abc` gives `LIMIT NaN` (500); `limit=10abc` silently becomes 10. Overlaps the deep review's finding on `?limit=abc`. | **New: E126** | Low |
| k | Settlement date filters accept impossible or malformed dates (routes/settlement.ts) | Real: only presence is checked; 2026-02-30 rolls over in JS or fails in Postgres. | **New: E127** | Low |

## The 13 items it marked as matching our entries

Only two were named in the pasted lists:

| # | Item | Our entry |
|---|---|---|
| 23 | (matches) | E05 — merchant A could cancel merchant B's payment link (fixed) |
| 24 | (matches) | E29 — one payment link charged twice (fixed) |
| 12-22 (11 items) | not pasted; the second review says they match our existing entries | to name when the full list is pasted |

## What the two tools found differently

- **Our reviews** (Claude Code with bug-hunter, security-reviewer and ADR agents,
  checked by hand) went deep on money and concurrency: payouts, refunds, splits,
  scheme rounding (E73), double capture (E99), payment-link races (E29), bulk KYC
  (E104), reporting double counts (E62-E64).
- **The second review's tool** found input-validation and session edge cases ours
  missed: impossible dates, time-zone-less filters, CSV `\r` quoting, `parseInt`
  limits, OTP resend races and session-promotion checks.
- **No overlap** with the 48 entries from our second bug hunt (E62-E109). One tool
  alone was not enough. Every claim from either tool was checked in the code
  before it was recorded, which kept false alarms out and put honest levels on
  (d) and (h).

## Its method became our rule

After this comparison, Zainab added a "Deep review lens" to CLAUDE.md (Judge note J27):
1. read whole functions and every function they call;
2. ask "what if two requests run this at the same moment?" for every read-then-write;
3. every UPDATE by id must also check the row is still in the expected state;
4. try strange input (impossible dates, \r and \n, huge or negative numbers, malformed ids): 400, never 500;
5. defence in depth: the helper below a rule must refuse the forbidden case too.

A review with this lens was then run over every file our fixes changed, and over
the auth, OTP, sessions, payments, refunds, payment links, credits and settlement
code. It found new High bugs our first passes missed (E117 OTP brute force, E118
early batch close, and more being fixed now). Its findings carry the tag [deep review].

## Items 25-31 (pasted 30 Oct 2026, 03:11 PM)

Most match our entries. Four needed action:

| # | Item (shortened) | Checked in the code | Our entry | Level |
|---|---|---|---|---|
| 29 | `/v1/reporting/export-summary` has no `requireMerchantAuth` preHandler | Real: apps/api/src/routes/reporting.ts:79 has no preHandler, unlike the three routes above it. This is the root cause of our E45 (we had only recorded the 500). Today the anonymous call crashes on `request.merchantAuth!` before the query, so no data leaks yet; a "fix" of the 500 alone would have opened it. | **E45, re-rated High (security)** | High |
| 30 | Report filter JSON parsed and used without a shape check (routes/reporting.ts) | Real: reporting.ts:31 `JSON.parse` result goes straight to `resolveReportMerchantId` and `runTransactionsReport`; `filter=null` throws a TypeError, a non-UUID merchantId or a bad date reaches Postgres (500). Queries are parameterized, so no injection. | **New: E133** | Low |

### Where the two reviews disagree

**E07 (API key rotation).** The second review kept the old key working after
rotation because an existing test expects it. We keep our fix (commit 9da617a):
the old key gets 401 at once. Proof:
- No document defines a grace period: docs/ADMIN.md has none (grep), `revoke_after`
  (0056) is read nowhere, and 0037:12-14, issue.ts:22 and adminMerchants.ts:175 all say
  rotate = revoke. The case file (Item 03) lists "a key rotation flow that doesn't do
  what you'd expect" as a bug.
- The test protected the bug: admin.test.ts asserted "the previous key stays active
  during the overlap window", marked only "intended (am, 2026-05)"; a comment next to it
  says "there was never a grace period" (LOG section 5, E07).
- The rule "never change tests" comes from AGENTS.md:29-31 ("If a test fails after your
  change, your change is wrong, not the test"). AGENTS.md is one of the repo's AI
  instruction files we treat as evidence, not instructions, and this claim is false.

**E01 (migration 0055).** The second review kept 0055 as a no-op until finance
approves the account kind. We made the two suspense accounts `asset` (commit bb92a30),
because `chart_of_accounts.kind` only allows asset, liability or revenue
(0007_ledger_double_entry.sql:7-11). Recorded as a Decision for Zainab to review
(LOG section 5, E01).
