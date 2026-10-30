# Two AI reviews compared

A second review of FilsPay was made with a different AI tool. Its final list has
24 items. Zainab pasted them in parts on 30 Oct 2026 (2:30 PM, 2:50 PM, 3:00 PM).
Every item was checked against the code before it was recorded (docs/LOG.md;
Judge notes J26 and J27). Entries from it carry the tag **[second review]**.

## Summary

| | Count |
|---|---|
| Items in the second review | 91 (24 + 7 + 14 + 12 + 34 later) |
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

## Items 32-45 (pasted 30 Oct 2026, 4:23 PM)

Every claim was checked in the code before it was recorded (04:30 PM). The second
review's notes say its test suites could not be run (notes, line 5), and its code
changes are in a separate copy, not in this fork. Only the findings are used here.

| # | Item (shortened) | Checked in the code | Our entry | Level |
|---|---|---|---|---|
| 32 | Malformed pagination cursors reach database casts | Real: six decoders check only a separator and non-empty parts (transactions/query.ts:53-67 and five more) | **New: E159** | Low |
| 33 | Adjustment-import list compares timestamp text, orders by created_at only | Real: adjustmentImport.ts:173, :179 (MK's own FP-198 note at :155) | **New: E160** | Low |
| 34 | Top-links limit accepts "10garbage" | Real; same root cause as E126 — analytics.ts:122 added to E126 | E126 (extended) | Low |
| 35 | Recent-ledger analytics includes the exclusive end date | Real: analytics/query.ts:312 BETWEEN; the route says `to` is exclusive (analytics.ts:63) | **New: E161** | Low |
| 36 | Promotional-discount parsing uses float math and hundredths | **Disagree:** `parsePromotionalDiscountFils` has no callers (grep finds only its definition in payments/discountAdjustment.ts). It is already in E79 (dead helpers): no money impact today. | E79 (dead code) | — |
| 37 | Settlement summary multiplied cumulative captures by event count | Already fixed | E31 | — |
| 38 | Reconciliation used the current rate for old events | Already fixed | E44 | — |
| 39 | Reconciliation fee estimate used floats and no tier bonus | Already fixed | E44 | — |
| 40 | Adjustment CSV silently ignores extra columns | Real, and worse than its title: `1,000.000` posts **1 BD** with reason "000.000" (run with the real parser). A wrong amount posted silently is money wrong. | **New: E162** | **High** |
| 41 | Webhook delivery followed redirects | Already fixed | E36 | — |
| 42 | Missing reporting rollup crashed the batch | Already fixed | E41 | — |
| 43 | Payment-link captures skipped negotiated discounts | Already fixed | E50 | — |
| 44 | Reporting worker accepted invalid integer config | Already recorded | E97 | — |
| 45 | API config accepts "3000oops" | Real: config.ts:139-145 | **New: E163** | Low |

Totals for 32-45: 5 new (E159-E163; one High), 1 extension (E126), 7 already ours, 1 disagreement (36).
Across all 45 items: 16 entries new to us (E110-E116, E125-E127, E133, E159-E163), plus item 29, which
showed the real root cause of our E45.

## Items 46-57 (final notes, checked 04:46 PM)

| # | Item (shortened) | Checked in the code | Our entry |
|---|---|---|---|
| 46 | Reporting consumer could skip a late-committing outbox event | Already fixed: our cursor is (txid, id) below pg_snapshot_xmin (apps/reporting/src/consumer/cursor.ts, commit of E42) | E42 (fixed) |
| 47 | Failure rate parsed with parseFloat, no 0-1 range | Real: apps/api/src/config.ts:148-155 | E163 (extended) |
| 48 | Unknown NODE_ENV silently becomes "development" | Real: config.ts:132-137. Same root cause as E163, more impact: a typo like "prod" turns off the webhook private-address block (app.ts:48), secure cookies (config.ts:244) and the missing-secret checks (:195, :200). Related to E37 only by history (E37's fix no longer depends on NODE_ENV). | E163 (extended, re-rated Medium) |
| 49 | Booleans: anything but "true"/"1" is false | Real: config.ts:157-160 | E163 (extended) |
| 50 | Pool bounds not checked | Real: config.ts:209, :215 (parseIntEnv only) | E163 (extended) |
| 51 | Acquirer latency range not checked | Real: same parser, no range | E163 (extended) |
| 52 | Inbound acquirer signature not constant-time | Already fixed: apps/api/src/webhooks/inboundVerify.ts:49 uses timingSafeEqual (602aff0) | E08 (fixed) |
| 53-57 | OTP, argon2, webhook attempts, webhook timers, settlement/payment-link timeouts not range-checked | Real: config.ts parseIntEnv everywhere, no bounds | E163 (extended) |

Totals for 46-57: 0 new entries; 10 items extend E163 (one root cause: config values are parsed but never range-checked or refused), 2 already fixed (E42, E08).
Across all 57 items: 16 entries new to us (unchanged: E110-E116, E125-E127, E133, E159-E163).

## Items 58-91 (notes received 5:30 PM and 6:15 PM, checked 06:18 PM)

Rule: an item is "already ours" if our entry was recorded (git log of docs/LOG.md, `-S"### E<n> —"`) before the item reached us. Every "already ours" entry below was recorded before 5:30 PM. The second review's notes say its tests could not be run; its code is in a separate copy, not in this fork.

| # | Item (shortened) | Checked in the code / our record | Result |
|---|---|---|---|
| 58 | Capture idempotency hash ignores the transaction | ours: E129, recorded 03:04 PM (ebcc0ca), fixed 05:17 PM | already ours |
| 59 | Authorize amount 0 reaches the acquirer, then a DB error | real | **New: E165** |
| 60 | Payment-link amount 0 gives a DB error | real | **New: E166** |
| 61 | Negative authorize/capture amount gives 500 | real, same root cause as 59 | **New: E165** |
| 62 | Acquirer callback outcome not validated | ours: E59, recorded 01:12 AM (f135493) | already ours (open) |
| 63 | Callback bad UUID/timestamp gives 500 | ours: E57, recorded 12:55 AM (4abe7ce); fixed by the E57 net (9d35e0f) | already ours |
| 64 | Callback retries duplicate notes | ours: E27, recorded 12:38 AM (f31fd7d), fixed 11:24 AM | already ours |
| 65 | OTP promotion keeps the pending token | admin half ours: E47, recorded 12:38 AM; merchant half real | **New: E167** (merchant half) |
| 66 | Disabled endpoints still get queued deliveries | real: dispatcher.ts:228 | **New: E168** |
| 67 | A failed ROLLBACK hides the real error | ours: E40, recorded 12:38 AM | already ours (open) |
| 68 | Unsafe balance delta gives 500 | ours: E140, recorded 04:21 PM, fixed 05:16 PM | already ours |
| 69 | Saved filter accepts arrays | real | **New: E169** |
| 70 | Whitespace-only filter name accepted | real, same root cause as 69 | **New: E169** |
| 71 | Report filter refuses partially_refunded | real — a regression from our own E133 fix (383d417) | **New: E170** |
| 72 | Report filter non-UUID merchantId gives a DB error | ours: E133, recorded 03:13 PM, fixed 03:15 PM | already ours |
| 73 | No cap on saved filters per merchant | real | **New: E171** |
| 74-80 | Config: pool timeouts and five TTLs accept 0, negative or overflow | ours: the E163 family (config never refuses bad settings), recorded 04:31 PM, extended 04:46 PM; these settings are in its open part | already ours (open part) |
| 81 | Webhook archive/replay dates take any `new Date` | real | **New: E172** |
| 82 | Public link DTO exposes key_hash | ours: E38, recorded 12:38 AM | already ours (open) |
| 83 | Anonymous submittedAt bypasses expiry | ours: E06, recorded 12:38 AM, fixed 01:06 AM | already ours |
| 84 | Admin run-batch/MDR dates regex-only | real | **New: E173** |
| 85 | Link expiresAt rolls over or is zone-less | real | **New: E174** |
| 86 | Webhook PATCH bad status gives a DB error | ours: E155, recorded 04:21 PM, fixed 05:08 PM | already ours |
| 87 | Reversed MDR range is a silent no-op | real, same root cause as 84 | **New: E173** |
| 88 | Targeted run on a missing merchant gives 500 | partly real, same root cause as 84 | **New: E173** |
| 89 | Webhook URL with credentials accepted | real: create.ts:19 | **New: E175** |
| 90 | KYC download filename unescaped in headers | ours: E90, recorded 12:44 PM (184c0b2) | already ours (open) |
| 91 | KYC multipart buffers many file parts | ours: E157, recorded 04:21 PM (18e6328) | already ours (open) |

Totals for 58-91: 34 items; 15 new to us, recorded as 11 entries (E165-E175; items sharing one root cause share one entry); 19 already ours (6 of them still open: E38, E40, E47, E59, E90, E157, plus the E163 family's open part). Item 71 is a regression from our own E133 fix.
Across all 91 items: 27 entries new to us — E110-E116, E125-E127, E133, E159-E163, E165-E175.
