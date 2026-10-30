# FilsPay — The Handover: submission

**Team:** Case Closed

**Members and what each owned**
<!-- members:start (regenerated from docs/CONTRIBUTIONS.md after the code freeze) -->
- Zainab — built the AI setup: 24 files in .claude/ and CLAUDE.md (`git ls-files .claude CLAUDE.md`); directed and checked the fixes: 226 commits after the inherited history (`git shortlog -sn a12d4c7^..HEAD`); led the case investigation (docs/CASE-MAP.md); her setup recorded 148 of 175 error entries (docs/ERRORS.md minus the second-review entries in docs/CONTRIBUTIONS.md section 4).
- Lulwa — reviewed the code independently in a separate copy: 91 items (docs/COMPARE.md); its findings that were new to us became 27 entries in this fork (items with one root cause share an entry; listed by ID in docs/CONTRIBUTIONS.md section 4); her code changes are not in this fork: 0 commits (`git shortlog -sn a12d4c7^..HEAD`); her notes state her tests could not be run.
<!-- members:end -->

**Live URLs**
- Checkout and merchant dashboard: http://139.59.57.26/ (dashboard login: http://139.59.57.26/dashboard/login)
- Public API: http://139.59.57.26/v1/… (health: http://139.59.57.26/healthz)
- Admin console: http://139.59.57.26:8081/
- Demo accounts: a demo merchant owner and a super_admin exist on the server. Their passwords are not in this document or in git; they are in a mode-600 file on the server and are handed to the organizers on request.

**Fork:** https://github.com/Zainajjhdjskdjf233/fils-pay

**Last commit ID:** TODO at the code freeze (draft written at d3e4fd1)

---

## 1. Summary

We inherited FilsPay: a Fastify/TypeScript payments API, a Go settlement service, a reporting worker, two React apps (merchant dashboard and checkout, admin console) and a Postgres database. On arrival it could not be installed: migrations stopped at 0054 (E01) and `docker compose up` failed (E02).

What we did, with sources:
- **Errors:** 176 entries recorded with file:line proof (docs/ERRORS.md, docs/LOG.md section 2). 123 fixed, 8 partly fixed, 1 skipped with a recorded decision, 44 open (all Medium or Low). All 46 High entries are fixed (docs/ERRORS.md, "High (46 of 46 fixed)").
- **Hidden things:** 40 entries in docs/LOG.md section 3 (false comments, planted AI instruction files, a staged git history, missing commits).
- **Features from the case file:** both done. F01 (refund flow end to end) and F02 (live on Dilmune Cloud) (docs/LOG.md section 4).
- **Tests:** every fix started with a test that failed for the right reason. Last full regression on a fresh database (commit ceacc85): API 498/498, money 44/44, events 4/4, reporting 18/18, web 13/13, scripts 10/10, Go 80 pass, 0 failures (docs/LOG.md section 5, E88).
- **Live check:** 45 public and 29 logged-in checks against the live server, including a full refund (10.000 BD) and a partial refund (4.000 BD), with a reconciliation gap of 0 (docs/LOG.md section 6).
- **Case:** the inherited history was staged after 12 Sep 2026. Main actor: Mahmood Khalil (medium confidence). Full reasoning: docs/CASE-MAP.md.

## 2. Architecture and deployment

### Components

| Part | Technology | Role |
|---|---|---|
| api | Node 20, Fastify, TypeScript | Public API, checkout, merchant dashboard API, admin API |
| settlement | Go | Daily batches, payouts, MDR recalculation; internal HTTP API on port 8091 |
| reporting | Node worker | Reads the outbox, builds reporting tables |
| web | React (Vite build, served by nginx) | Checkout and merchant dashboard |
| admin | React (Vite build, served by nginx on its own port) | Admin console |
| postgres | Postgres 16 | One database, one role per service |
| nginx | nginx | Port 80: web, checkout, /v1 and /healthz to the API. Port 8081: admin console and /v1/admin |

All parts run in Docker Compose (ops/docker-compose.yml) with hard limits that fit the case file's 1 vCPU / 2 GB: whole stack 1.00 vCPU / 1664 MB, API 0.50 vCPU / 512 MB (docs/LOG.md section 5, E02).

### Live server
- Dilmune Cloud VM 139.59.57.26: Ubuntu, 1 vCPU, 2 GB RAM plus 2 GB swap, Docker 29.9.2, Compose v5.6.1. The panel firewall allows 22, 80, 443 and 8081.
- One command deploys or redeploys: `ssh dilmune@139.59.57.26 'bash ~/fils-pay/ops/deploy.sh'`. It installs Docker only if it is missing, fast-forwards to the latest main, keeps the existing secrets, and runs `compose up -d --build` (ops/deploy.sh).
- Secrets are generated on the server by ops/gen-env.sh into ops/.env.docker (gitignored, mode 600) and never printed. The acquirer signing secret that leaked in git (E13) is replaced by a new one, and the API refuses to start with the leaked value (apps/api/src/config.ts).
- Data lives in named volumes (pgdata, kyc). Every long-running service has `restart: unless-stopped` and a health check.
- Migrations run in a one-shot `migrate` container before the API and settlement start (`depends_on: service_completed_successfully`).

### How a redeploy avoids interrupting a settlement run
1. **Atomic steps.** Each settlement step (close a batch, pay a batch, recalculate MDR) is one Postgres transaction. If the process stops in the middle, Postgres rolls the transaction back. Nothing is left half-written (apps/settlement/internal/scheduler/daemon.go:5-9).
2. **Safe to run again.** The daemon always runs the most recent completed business day. A batch that is already closed or paid is a no-op (daemon.go:22-29; batch.go:82 `ON CONFLICT (merchant_id, batch_date) DO NOTHING`, batch.go:95 `FOR UPDATE`). After a restart the interrupted day is simply run again.
3. **Graceful stop.** SIGTERM cancels the daemon's context (cmd/settlement/main.go:55). The internal API waits up to 30 s for a running request (internalapi/server.go:42).
4. **A gap we found and fixed while writing this section (E176).** Docker's default stop grace period is 10 s, so Docker killed settlement before its own 30 s wait ended. ops/docker-compose.yml now gives settlement `stop_grace_period: 40s` (commit d3e4fd1). Points 1 and 2 remain the real guarantee; point 4 means a nearly finished run is less likely to start over.
5. **Only changed services restart.** `compose up -d --build` recreates a container only when its image or settings changed, so an API-only change does not touch settlement.
6. **Duplicate payouts cannot happen on a re-run.** Payout notifications and disbursements are guarded by advisory locks (E30, commit 8d56ba7).

Not done (open risk): no live test of a redeploy during a running batch.

## 3. Capacity

**Estimate: about 15 checkouts per second (about 900 per minute)** on 1 vCPU / 2 GB, with the API at 0.5 vCPU / 512 MB, p95 under 2 s, and no errors other than the simulated bank's planned declines.

- **Method:** k6 v2.3.0 (ops/loadtest/checkout.js). One checkout = open the payment link, then pay it by card with a fresh Idempotency-Key, through nginx, on the compose stack with its real limits. 60,000 links were prepared in the local database.
- **Pass rules (our choice):** pay p95 < 2 s; real errors < 1 %; turned away (503) ≤ 1 %. The simulator declines 2 % of bank calls on purpose; those count as correct answers.
- **Round 1:** fast up to 12/s; from 16/s p95 was 2.7-6 s. The API used at most 15 % of a core, while Postgres sat at its 0.25 vCPU cap. The database was the bottleneck.
- **Change:** Postgres 0.25 → 0.35 vCPU, idle services 0.05 each, in-flight cap 48 → 24. Total still 1.00 vCPU.
- **Round 2:** 20/s passed (p95 1.2 s, 1 % shed). Closed model: 10-15 back-to-back users gave about 14.5 checkouts/s (p95 1.4-1.75 s). We report the lower figure: about 15/s.
- **Overload (60/s for 30 s):** 72 % were turned away with 503 and Retry-After; served requests p95 2.6 s; 0 restarts, no out-of-memory kill; right after, p95 1.0 s with nothing shed.
- **Correctness after about 11,000 checkouts:** 10,518 paid links = 10,518 captured transactions; 0 links paid twice; 0 unbalanced ledger groups; merchant payable = captures − fees exactly (48,708,858 fils on both sides).
- **What limits it:** two simulated bank calls per checkout (100-400 ms each) while database rows are locked (E29 protection). The next step would be fewer database round trips per checkout, not more API CPU.
- Full tables: docs/LOG.md section 6, "Capacity estimate".

## 4. Findings report

Each finding below follows the same pattern: symptom, how it was found and reproduced, root cause, fix, how it was verified, and the effect on existing data. The ones shown are the High findings with the largest effect on money or access. All 176 entries, with the same fields, are in docs/LOG.md (section 2 = the error, section 5 = the fix) and docs/ERRORS.md.

### F-1 (E29) One payment link charged twice — incident 2026-05-14
- **Symptom:** a buyer was charged twice for one link; the second buyer also saw "paid".
- **Found / reproduced:** the incident file plus the comment at apps/api/src/paymentLinks/pay.ts:154 ("MK: authorize+capture is under a second. 60s can't happen. unreachable"). Test paymentLinks.e29.test.ts with a 0 s reservation timeout and a 300 ms bank: `link charged 2 times; responses 200,200`.
- **Root cause:** after 60 s a reservation still in use could be claimed again, and finalize/release matched only `status = 'reserved'`, with no owner token.
- **Fix:** a reservation token plus a row lock held through capture (commit ad472fc). My first fix (token only) still failed a slow-capture test; the row lock closed it.
- **Verified:** 3 tests pass; load test: 0 links paid twice in about 11,000 checkouts.
- **Existing data:** no rewrite; past double charges must be found and refunded by finance.

### F-2 (E03, E04) Login without the OTP, and OTP sent to another merchant's user
- **Symptom:** the dashboard opened after the password step only (E03); a user with the same email at another merchant received the code and session (E04).
- **Found / reproduced:** code reading. `lookupSession` never checked `authenticated = true`; `findOtpRecipient(email)` took the first user with that email in any merchant (`LIMIT 1`, no ORDER BY). Tests sessions.e03.test.ts and auth.e04.test.ts failed before.
- **Fix:** commits 35f4415 and 5e9d46d. Later, the session token is also replaced at OTP verify (E167, aa35616; admin side E47/E113, e8c9454).
- **Verified:** tests pass; on the live server, a pending cookie cannot open the dashboard.
- **Existing data:** none changed; old sessions expire on their own.

### F-3 (E05) Merchant A could cancel merchant B's payment link
- **Symptom / root cause:** `UPDATE payment_links ... WHERE id = $1 AND status = 'active'` had no merchant check; the 409/404 difference also leaked other merchants' link status.
- **Fix / verified:** merchant id in every query (commit 5710a31); paymentLinks.e05.test.ts failed before and passes now.
- **Existing data:** none.

### F-4 (E06) FP-187: expired payment links could be paid
- **Symptom / root cause:** expiry was compared with `submittedAt` sent by the buyer's browser. An old date made an expired link payable.
- **Fix / verified:** the server clock decides (commit 41f2313); paymentLinks.e06.test.ts. The missing commit c47c4e0 cited at db/migrations/0020_payment_links.sql:62 is one of six cited commits that do not exist (H25).
- **Existing data:** none.

### F-5 (E07) Admin "rotate API key" did not revoke the old key
- **Symptom:** after rotation, the old (possibly leaked) key kept working.
- **Root cause:** rotation issued a new key and wrote an audit row but never set `revoked_at` on the old key. `revoke_after` is never read anywhere.
- **Fix:** the old key is revoked in the same transaction (commit 9da617a). An existing test expected the old key to keep working; we changed it after checking every source (see section 6, excerpt b).
- **Verified:** admin.test.ts; live check.
- **Existing data:** keys rotated before the fix are still active; finance or support should revoke them.

### F-6 (E08, E13, E59) Acquirer callbacks: no signature needed, and the secret was in git
- **Symptom:** unsigned callbacks were accepted (E08); the signing secret was committed in 669af52 (E13); any `outcome` string was stored (E59).
- **Root cause:** a missing signature header returned `{valid: true}` unless a flag (default off) was set; no freshness check; non-constant-time compare.
- **Fix:** signature required, fresh (300 s), constant time (602aff0); the leaked secret is replaced and refused at startup (E13); outcome must be `cleared` or `confirmed_fraud` (E59, 35c9921).
- **Verified:** inboundVerify.e08.test.ts, acquirerCallbacks tests 18/18.
- **Existing data:** callbacks stored before the fix are not re-verified.

### F-7 (E09) Support admins could post credits; the two-person check compared display names
- **Fix / verified:** only finance and super_admin create credits; the approver check compares admin ids (commit 1f6c885); creditApproval.e09.test.ts.
- **Existing data:** credits already posted by support remain in the ledger; they are listed by the admin audit log.

### F-8 (E15, E21, E16) Money arithmetic: float32 payouts, 10x CSV import, a March sweep that doubled
- **E15:** net payout went through float32 (`NetPayableFils(135000123, 3375003) = 131625125, want 131625120`). Now integer fils (2db05e0). Yousif warned about this (925744c).
- **E21:** the CSV import read BD with 2 decimals: 4.755 BD was posted as 475 fils, not 4755. Now `parseBhdToFils` (2f06eb4). Yousif warned about this too (9567ea0).
- **E16:** the March sweep posted the residue again on every run, with UTC months. Now idempotent, Bahrain months (d69061a).
- **Existing data:** past wrong postings are not rewritten. They need a finance correction from the ledger history.

### F-9 (E27, E30) Duplicate callbacks and duplicate payout notifications — FP-201 and incident 2026-08-21
- **E27:** the "hotfix" claimed in Slack (`processed_events`) exists nowhere in the code. Two copies of one callback were both stored (`actual: 3` notes). Now an advisory lock plus NOT EXISTS (8fd0c90).
- **E30:** two settlement workers each sent notifications (46 events for 30 batches in one run). Now advisory locks (8d56ba7).
- **Existing data:** duplicate rows from before are not deleted.

### F-10 (E01, E02) The app could not be installed
- **E01:** migration 0054 built a view on a table no migration creates, so 15 later migrations never ran (bb92a30).
- **E02:** the compose stack could not start; rebuilt within 1 vCPU / 2 GB (d7d17b2).

### Root causes
1. **Checks done in the wrong place or not at all.** Trusting the client (E06 submittedAt), checking the URL instead of the row owner (E05), a flag defaulting to "off" (E08), a session state never checked (E03).
2. **Read, then write, with nothing in between.** Many bugs were two requests reading the same row before either wrote (E29, E27, E30, E34, E114, E171, E148). The fix is always one locked transaction or one atomic `UPDATE … WHERE <state> RETURNING`.
3. **Money in the wrong unit or type.** Cents instead of fils (E21), float32 (E15), UTC instead of Bahrain days (E16).
4. **False comments and planted rules.** 32 "MK:" comments dismiss real bugs at the exact lines (CASE-MAP Branch 2). The repo's AI files (AGENTS.md, the inherited CLAUDE.md) say "never change tests" and "money is cents"; both are wrong for this code (H14-H16).
5. **Claims of fixes that were never made.** `processed_events`, FP-202 and `SETTLEMENT_SINGLETON_LOCK` are "Done" in the postmortem and absent from the code (CASE-MAP, planted traps).

### Decisions and open risks
- **OTP on the live demo server.** There is no SMS or email sender. To let judges log in, the live server sets `OTP_DEV_EXPOSE=true`, so the login response shows the code. The code default is off (E37). This is set only in the server's ops/.env.docker. Safeguard: in a real deployment OTP goes by SMS or email and this flag stays off.
- **Limits chosen by us (for review):** balance adjustment and credit caps (E140, E141), CSV import 1,000 rows (E158), webhook archive 10,000 deliveries (E144), 50 saved filters (E171), 20 KYC documents per merchant (E148, a lifetime limit because no code deletes documents), password minimum (E145), credits back-dated at most 90 days (E134).
- **Left as designed (for review):** E150 (a balance adjustment for a merchant with no balance row returns 404; recorded by MK as a choice, three tests assert it); admin impersonation still works for a suspended merchant (E128); API keys can save report filters (E88).
- **Open risks (44 Medium/Low entries, docs/ERRORS.md):** among them E139 (capture and status recompute disagree on one rare refund order; no money moves), E146 (no rate limit on signup and login), E89 (unsalted hash of card data in the simulator), E84 (CSRF from same-site pages), E47 (no Content-Security-Policy yet).
- **Existing data:** fixes change future behaviour. Rows written wrongly before a fix are not rewritten; finance would correct them from the ledger history.
- **Live version:** the server runs d3e4fd1 (redeploy 2, 07:12 PM); one more redeploy at the code freeze.

## 5. UI and UX changes

Screenshots: docs/ui/before/ (the inherited screens, commit a12d4c7) and docs/ui/after/ (the same pages and data now). How they were made: docs/ui/README.md.

| Screen | Before | After | Picture |
|---|---|---|---|
| Checkout (desktop and phone) | Expiry and CVV row wider than the form; on a phone the CVV box ran off the screen | Three equal columns that fit | checkout-pay.png, checkout-pay-mobile.png |
| Dashboard and admin tables | Digits of different widths; amounts did not line up | Tabular numbers | dashboard-transactions.png, admin-merchants.png |
| Dashboard settlement and reconciliation | Refund parts missing, so Gross − Fee did not equal Net on screen (E106) | Refund and fee-returned rows; the numbers add up (20.000 − 0.450 − 14.000 + 0.315 = 5.865) | refund-batch-detail.png, refund-batch-list.png |
| Transaction detail | No refund drawer | Refund drawer with the refunded amount (F01f) | refund-partial-transaction.png |
| Admin settlement | No warning when MDR recalculation skipped a batch | Red notice listing skipped dates (E120) | admin-settlement.png |
| Checkout behaviour | Expired link still payable | Server-side expiry (E06) | — |

Not changed (recorded): money columns are still left-aligned (29 cells in 10 files).

## 6. AI usage

### Setup and where it lives
- Everything is in the repository: `CLAUDE.md` (how we work) and `.claude/` (24 files): hooks, agents, commands, the handover skill and check.sh. Explained in docs/AI-SETUP.md.
- **Hooks (rules the AI cannot skip):** phase-guard.py blocks code edits until the understanding phase is done; log-action.py writes every action with its time into docs/ACTIONS.md; run-check.sh runs typecheck and tests after every edit and stops the AI on failure.
- **Permissions:** `rm`, `git reset`, `git push` and `git checkout --` always ask the human (.claude/settings.json).
- **Agents:** read-only reviewers (bug-hunter, security-reviewer, detective, fix-reviewer) and a test-writer. fix-reviewer reviewed every money and security fix before commit.
- **Second tool:** an independent review in a separate copy (docs/COMPARE.md, 91 items).
- **Rule behind all of it:** AI output is a lead, not proof. Every LOG claim has a file:line, a commit hash or command output.

### Excerpt (a): the AI was wrong — the weak spot in my own E39 fix (E138)
> 11:42 AM, E39 fix: "`buildTransactionsExportCsv` reads at most MAX_EXPORT_ROWS (50,000) + 1 rows … throws 413 above the cap. Decision: cap the export instead of switching to streaming — smallest safe change." (docs/LOG.md, section 5, E39)

> 04:21 PM, coverage review: "The 50,000-row export cap still lets 4 concurrent exports crash the heap … One 50k-row export holds about 120 MB of heap; 4 at once → JavaScript heap out of memory, the API exits." (docs/LOG.md, section 2, E138, tagged "[my E39 fix]")

**Annotation.** The AI's earlier fix limited one export but still built the whole CSV in memory, under a 384 MB heap. The AI called it "the smallest safe change", and its own later review showed it was not safe. We recorded E138 against our own fix, then limited exports to one at a time per process, with 503 and Retry-After (commit e7b8b1b). The test `one export runs` failed before the fix and passes after. Lesson: a fix is a new piece of code that also needs review.

### Excerpt (b): the E07 disagreement — "a key rotation flow that doesn't do what you'd expect"
> CASE-FILE.md, line 70: "There's a key rotation flow that doesn't do what you'd expect."

> 1:08 AM, commit 9da617a: rotation now revokes the old key. The existing test expected the old key to keep working. We changed that test after checking every source: no document defines a grace period, `revoke_after` is never read, and the only support for a grace period was a comment in the test itself.

> 03:11 PM, Judge note J28: "The second review kept the old API key working after rotation (E07) because an existing test expected it … The rule 'never change tests' comes from AGENTS.md:29-31, one of the repo's planted AI instruction files."

**Annotation.** Two reviews disagreed. The other review followed the inherited test, and that test followed a planted rule. We followed the case file (the highest authority) and the code (`revoke_after` unused). A test shows what someone wanted; it does not prove the behaviour is right. The disagreement is recorded item by item in docs/COMPARE.md.

### Excerpt (c): a check.sh failure that was our own environment (E47, E90, E88)
> 06:50-07:03 PM: check.sh said "TESTS FAILED" three times. My first note in LOG said "possible flaky test".

> Judge note (07:03 PM): "The real cause was my own shell: DATABASE_URL was still set, so check.sh ran the full suite on a dirty shared test DB. Clean runs and a fresh-DB regression (0 failures) prove the code was fine."

**Annotation.** The AI first guessed "flaky" without proof. The guess was wrong, and it would have hidden the real cause. Reading check.sh:15-17 showed the full suite runs whenever DATABASE_URL is set. A clean run (`env -u DATABASE_URL bash .claude/check.sh` → CHECK OK) and a fresh-database regression proved the code. The wrong notes were corrected in the next commit (25046a4), not deleted.

## Appendix

- **Where everything is:** docs/OVERVIEW.md (one page: status, stages, errors, every fix note), docs/LOG.md (the why, with proof), docs/ACTIONS.md (every action with its time, written by a hook), docs/ERRORS.md (one line per error), docs/NOTES.md and docs/NOTES-PLAIN.md (one note per fix), docs/CASE-MAP.md (who did what), docs/COMPARE.md (second review), docs/CONTRIBUTIONS.md (who did what, with commands), docs/AI-SETUP.md, docs/JUDGE-QA.md.
- **How to run locally:** `./ops/gen-env.sh` once, then `docker compose --env-file ops/.env.docker -f ops/docker-compose.yml up -d --build`. Dashboard and checkout on http://localhost:8080, admin on http://localhost:8081.
- **How to test:** `npm test` (needs DATABASE_URL to a migrated Postgres for the full suite); Go: `go test -p 1 ./...` in apps/settlement; quick check: `.claude/check.sh`.
- **Live server rules we kept:** only migrations run on the live server; no scripts, resets, rebuilds or sweeps; secrets generated there and never printed.
