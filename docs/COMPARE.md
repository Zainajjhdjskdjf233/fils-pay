# Two AI reviews compared

Lulwa (teammate) reviewed FilsPay with a different AI tool and reported 19 items.
Zainab pasted 8 of them (the ones Lulwa marked as new) on 30 Oct 2026, 2:30 PM.
Each was checked against the code before it was recorded (docs/LOG.md, entries
E110-E116; Judge note J26).

## Her 19 items

### The 8 items received and checked

| # | Her item (her words, shortened) | Checked in the code | Our entry | Level |
|---|---|---|---|---|
| a | CSV streaming export pages on `occurred_at` only, so equal timestamps at a page boundary are skipped (exportCsv.ts:89) | Real. The function is unused today; E39 chose a 50,000-row cap instead and mentioned this bug in its decision, but no entry existed. | **New: E110** | Low |
| b | CSV quoting ignores `\r` (exportCsv.ts:22) | Real: only `,` `"` and `\n` trigger quoting. | **New: E111** | Low |
| c | Invalid date filters reach the DB in /v1/transactions list and export (routes/transactions.ts:148,166) | Real: `new Date(q.from)` with no check gives an Invalid Date, a Postgres error and a 500. Same family as E57. | **New: E112** | Low |
| d | Session promotion after OTP updates by id only, not checking pending / not revoked / not expired (auth/sessions.ts:58, admin too) | Real, but weaker than it sounds: revoked and expired sessions stay hidden by the `live_sessions` view (0058). Only an expired pending session could be revived, in a short window, and only with the correct OTP. | **New: E113** | Low |
| e | Concurrent OTP resends can rotate the challenge more than once | Real: the 30-second throttle is checked outside the transaction (routes/auth.ts:248). The guess budget still carries over (E34). | **New: E114** | Low |
| f | OTP verify can use a challenge already replaced by a concurrent resend | Already fixed. Since E34, verify reserves an attempt only where `consumed_at IS NULL`, so a replaced challenge gets 410. | **Matches E34 (fixed)** | — |
| g | Impossible dates like 2026-02-30 are accepted (routes/analytics.ts:25 and transactions) | Real: `Date.parse("2026-02-30")` rolls over to 2 March; the comment "rejects 2026-02-30" is false. | **New: E115** | Low |
| h | `requireMerchantWriterActor` does not reject `admin_impersonation` (defence in depth on top of E10) | Real, defence only: every route using it already requires owner or finance, and impersonation has the "support" role. | **New: E116** | Low |

### The other 11 items

Not received yet: the pasted message only listed the 8 new ones. Lulwa says
they match our existing entries. To finish this table, paste her full list and
each one will be matched to its entry ID the same way.

| # | Her item | Our entry |
|---|---|---|
| 1-11 | (not received) | (to match) |

## Summary

| | Count |
|---|---|
| Her items received | 8 of 19 |
| Real and new | 7 (E110-E116, all Low) |
| Already fixed by us | 1 (E34) |
| Not real | 0 |
| Her items we have not seen yet | 11 |

## What the two tools found differently

- **Our reviews** (Claude Code with bug-hunter, security-reviewer and ADR agents,
  checked by hand) went deep on money and concurrency: payouts, refunds, splits,
  settlement rounding (E73), double capture (E99), payment-link races (E29), bulk
  KYC (E104), reporting double counts (E62-E64).
- **Her tool** found input-validation and session edge cases that ours missed:
  impossible dates, CSV `\r` quoting, invalid date filters, OTP resend races, and
  session-promotion checks.
- **No overlap** with our 48 entries from the second bug hunt (E62-E109). The
  lesson (Judge note J26) is that one tool alone is not enough. Every claim from
  either tool was checked in the code before it was recorded, which kept false
  alarms out and put honest levels on (d) and (h).

## Her method became our rule

After this comparison, Zainab added a "Deep review lens" to CLAUDE.md (Judge note J27):
1. read whole functions and every function they call;
2. ask "what if two requests run this at the same moment?" for every read-then-write;
3. every UPDATE by id must also check the row is still in the expected state;
4. try strange input (impossible dates, \r and \n, huge or negative numbers, malformed ids): 400, never 500;
5. defence in depth: the helper below a rule must refuse the forbidden case too.

A second review with this lens was run over every file our fixes changed and the
auth, OTP, sessions, payments, refunds, payment links, credits and settlement code.
Its findings are recorded in docs/LOG.md with the tag [deep review].

