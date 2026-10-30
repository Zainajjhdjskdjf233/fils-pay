# FilsPay — The Handover: submission

## Cover page

**Team:** Case Closed

**Members and what each owned**
<!-- members:start (copied from docs/CONTRIBUTIONS.md, built at the code freeze) -->
- Zainab — built the AI setup: 24 files in .claude/ and CLAUDE.md (`git ls-files .claude CLAUDE.md`); directed and checked the fixes: 299 commits after the inherited history (`git shortlog -sn a12d4c7^..HEAD`); led the case investigation (docs/CASE-MAP.md); her setup recorded 149 of 176 error entries (docs/ERRORS.md minus the second-review entries in docs/CONTRIBUTIONS.md section 4).
- Lulwa — reviewed the code independently in a separate copy: 91 items (docs/COMPARE.md); its findings that were new to us became 27 entries in this fork (items with one root cause share an entry; listed by ID in docs/CONTRIBUTIONS.md section 4); her code changes are not in this fork: 0 commits (`git shortlog -sn a12d4c7^..HEAD`); her notes state her tests could not be run.
<!-- members:end -->

**Live URLs**
- Checkout and merchant dashboard: http://139.59.57.26/ (dashboard login: http://139.59.57.26/dashboard/login)
- Public API: http://139.59.57.26/v1/… (health: http://139.59.57.26/healthz)
- Admin console: http://139.59.57.26:8081/
- Demo accounts: a demo merchant owner and a super_admin exist on the server. Their passwords are not in this document or in git; they are in a mode-600 file on the server and are handed to the organizers on request.

- Access is by IP over plain HTTP: the organizers confirmed no domain and no SSL are needed.

**Fork:** https://github.com/Zainajjhdjskdjf233/fils-pay

**Last commit ID:** TODO at the code freeze (draft written at d3e4fd1)

---

## 1. Summary

We inherited FilsPay: a Fastify/TypeScript payments API, a Go settlement service, a reporting worker, two React apps (merchant dashboard and checkout, admin console) and a Postgres database. On arrival it could not be installed: migrations stopped at 0054 (E01) and `docker compose up` failed (E02).

What we did, with sources:
- **Errors:** 176 entries recorded with file:line proof (docs/ERRORS.md, docs/LOG.md section 2). 148 fixed, 12 partly fixed, 2 skipped with a recorded reason, 14 open (4 Medium, 10 Low). All 46 High entries are fixed (docs/ERRORS.md, "High (46 of 46 fixed)").
- **Hidden things:** 40 entries in docs/LOG.md section 3 (false comments, planted AI instruction files, a staged git history, missing commits).
- **Features from the case file:** both done. F01 (refund flow end to end) and F02 (live on Dilmune Cloud) (docs/LOG.md section 4).
- **Tests:** every fix started with a test that failed for the right reason, except a few UI-only and timing-race fixes where LOG says so. Final full regression on a fresh database (commit 8acf5d2, 08:06 PM): API 519/519, money 44/44, events 4/4, reporting 21/21, web 13/13, scripts 11/11, Go 84 pass, 0 failures (docs/LOG.md section 6).
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

### Services and ports

**nginx is the reverse proxy and the only service that faces the internet (ports 80 and 8081); api, postgres, settlement and reporting are on internal Docker networks only.**

Only nginx publishes ports on the host. Everything else is on internal Docker networks (`edge`, `internal`, `db` in ops/docker-compose.yml) and cannot be reached from the internet.

```mermaid
flowchart LR
  U(["Internet: buyers, merchants, staff"])
  subgraph host["Dilmune VM 139.59.57.26"]
    subgraph pub["Faces the internet"]
      N80["nginx — host port 80<br/>checkout, dashboard, /v1, /healthz"]
      N81["nginx — host port 8081<br/>admin console, /v1/admin"]
    end
    subgraph priv["Internal only (no published port)"]
      API["api :3000<br/>Fastify"]
      SET["settlement :8091<br/>Go, internal API"]
      REP["reporting<br/>worker, no port"]
      PG[("postgres :5432")]
      MIG["migrate<br/>one-shot"]
    end
  end
  U -->|HTTP 80| N80
  U -->|HTTP 8081| N81
  N80 -->|edge network| API
  N81 -->|edge network| API
  API -->|internal network, bearer token| SET
  API -->|db network| PG
  SET -->|db network| PG
  REP -->|db network| PG
  MIG -->|db network| PG
```

- Port 80 on the host maps to nginx's port 8080 inside the container (`HTTP_PORT`, ops/docker-compose.yml:152); 8081 maps to 8081 (`ADMIN_PORT`).
- nginx on port 80 answers 404 for `/v1/admin` (E86), so the admin API is reachable only through port 8081.
- Postgres has no published port (E13); the panel firewall allows only 22, 80, 443 and 8081.
- Checked on the live server (08:30 PM, `docker ps`): filspay-nginx-1 `0.0.0.0:80->8080/tcp, 0.0.0.0:8081->8081/tcp`; filspay-api-1 `3000/tcp`, filspay-reporting-1 `3000/tcp`, filspay-settlement-1 `8091/tcp`, filspay-postgres-1 `5432/tcp` (container ports only, nothing published). Networks: nginx only on `edge`; api on `db`, `edge`, `internal`; settlement on `db`, `internal`; reporting and postgres only on `db`. On the host only 22 (ssh), 80 and 8081 listen on all addresses (`ss -ltn`).

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
- **Limits chosen by us (for review):** balance adjustment and credit caps (E140, E141), CSV import 1,000 rows (E158), webhook archive 10,000 deliveries (E144), 50 saved filters (E171), 20 KYC documents per merchant (E148, a lifetime limit because no code deletes documents), password minimum (E145), credits back-dated at most 90 days (E134), login and signup 120 calls per IP per minute (E146), reporting settings ranges (E97).
- **Left as designed (for review):** E150 (a balance adjustment for a merchant with no balance row returns 404; recorded by MK as a choice, three tests assert it); admin impersonation still works for a suspended merchant (E128); API keys can save report filters (E88); a webhook replay gets a new delivery id, as the code intends (E143, docs/ADMIN.md corrected); the seed needs FILSPAY_ALLOW_SEED_RESET=1 (E65).
- **Open risks (14 open entries, 4 Medium and 10 Low, plus 12 partly fixed; docs/ERRORS.md):** among them E63 (the admin reporting rebuild can double-count events the worker has not reached; analysis and options in LOG, for review), E82 (admin "rotate API key" shows staff a full-power merchant key; options in LOG, for review), E74 (balance cache and ledger rebuild measure different things), E103 ("view as merchant" cannot work end to end), E108 (list pages can mix rows from an old filter). Partly fixed items list what is left in docs/LOG.md (for example E101: a merchant cannot cancel an expired link that kept a stale reservation; E67: no job refreshes the refund summary view). The Origin check (E84) does not cover very old browsers that send no Origin header. Old idempotency rows written before E89 still hold the old card hashes until they are cleared.
- **Existing data:** fixes change future behaviour. Rows written wrongly before a fix are not rewritten; finance would correct them from the ledger history.
- **Live version:** the server runs d3e4fd1 (redeploy 2, 07:12 PM); one more redeploy at the code freeze.

## 5. UI and UX changes

Screenshots: docs/ui/before/ (the inherited screens, commit a12d4c7) and docs/ui/after/ (the same pages and data now). How they were made: docs/ui/README.md. Left = before, right = after.

### Checkout layout (desktop and phone)
Before: the expiry and CVV row was wider than the form; on a phone the CVV box ran off the screen. After: three equal columns that fit (apps/web/src/pages/checkout/CheckoutPage.css).

![before](ui/before/checkout-pay.png) ![after](ui/after/checkout-pay.png)

![before](ui/before/checkout-pay-mobile.png) ![after](ui/after/checkout-pay-mobile.png)

### Tables: tabular numbers
Before: digits of different widths, so amounts did not line up. After: every digit the same width (apps/web/src/dashboard.css, apps/admin/src/admin.css).

![before](ui/before/dashboard-transactions.png) ![after](ui/after/dashboard-transactions.png)

![before](ui/before/admin-merchants.png) ![after](ui/after/admin-merchants.png)

### Dashboard settlement and reconciliation with refunds (E106)
Before: the refund parts were missing, so Gross − Fee did not equal Net on screen. After: refund and fee-returned rows; the numbers add up (20.000 − 0.450 − 14.000 + 0.315 = 5.865).

![before](ui/before/dashboard-settlement.png) ![after](ui/after/dashboard-settlement.png)

![before](ui/before/dashboard-reconciliation.png) ![after](ui/after/dashboard-reconciliation.png)

Refund screens (new, after only):

![after](ui/after/refund-batch-list.png)

![after](ui/after/refund-batch-detail.png)

### Transaction detail: refund drawer (F01f)
New screen; after only.

![after](ui/after/refund-partial-transaction.png)

### Admin settlement: skipped batches notice (E120)
Before: no warning when MDR recalculation skipped a batch. After: a red notice lists the skipped dates.

![before](ui/before/admin-settlement.png) ![after](ui/after/admin-settlement.png)

### Behaviour changes without a new screen
- Checkout: an expired link is no longer payable (server-side expiry, E06).
- Payment links list: an expired link shows "expired" with no Cancel button, and the filter has "expired" (E107).

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

### Every error entry

<!-- errors:start (generated from docs/ERRORS.md) -->
All 177 entries from docs/ERRORS.md (157 of 177 fixed.). Each ID has its error (section 2) and, when fixed, its fix (section 5) in docs/LOG.md.

| ID | Title | Level | Status |
|---|---|---|---|
| E01 | Migration 0054 builds a view on a table that does not exist | High | Fixed |
| E02 | docker compose up cannot start the stack | High | Fixed |
| E03 | Merchant login works without the OTP code | High | Fixed |
| E04 | OTP and session go to another merchant's user with the same email | High | Fixed |
| E05 | Merchant A can cancel merchant B's payment link (IDOR) | High | Fixed |
| E06 | FP-187: checkout trusts the client's submittedAt, so expired links can be paid | High | Fixed |
| E07 | Admin API key "rotation" does not revoke the old key | High | Fixed |
| E08 | FP-240b: incoming acquirer callbacks accepted without a signature | High | Fixed |
| E09 | Support admins can post credits with no approval; two-person check compares display names | High | Fixed |
| E10 | Impersonation gives write power (super_admin → owner, finance → finance) | High | Fixed |
| E11 | Reporting scope lets any merchant read a split child's transactions | High | Fixed |
| E12 | expire_holds deletes every hold when there is nothing to expire | High | Fixed |
| E13 | Secrets committed to git and the database open to the internet | High | Fixed |
| E14 | Scheme statement always a few fils higher than ours | High | Fixed |
| E15 | Batch net payout computed with float32 | High | Fixed |
| E16 | March sweep script is not idempotent and uses UTC months | High | Fixed |
| E17 | Split payouts: children do not add up to the parent | High | Fixed |
| E18 | FP-203: "Recalculate cached balances" button and CLI read different sources | High | Fixed |
| E19 | MDR recalculation changes batches that were already paid | High | Fixed |
| E20 | Dashboard shows 245 bps, payments charge 225 bps | Medium | Fixed |
| E21 | CSV adjustment import reads BD amounts 10 times too small | High | Fixed |
| E22 | The same adjustment CSV can be applied twice | Medium | Fixed |
| E23 | Daily close runs at 3:00 AM Bahrain, not midnight | High | Fixed |
| E24 | Lifetime payout estimate drifts (float32) | Medium | Fixed |
| E25 | Platform volume counter overflows int32 | Medium | Fixed |
| E26 | Admin "recompute statuses" turns test merchants live | High | Fixed |
| E27 | FP-201 (reopened): same acquirer callback stored twice | Medium | Fixed |
| E28 | FP-209 refunds: double refund, refund more than captured, other merchant's refund | High | Fixed |
| E29 | Incident 2026-05-14: one payment link charged twice | High | Fixed |
| E30 | Incident 2026-08-21: duplicate payout notifications | High | Fixed |
| E31 | Reconciliation report query is slow and over-counts | Medium | Fixed |
| E32 | FP-240a: outgoing webhooks sign different bytes than they send | Medium | Fixed |
| E33 | Math.random for OTP codes and payment link tokens | Medium | Fixed |
| E34 | OTP attempt limit can be bypassed | Medium | Fixed |
| E35 | Void and capture have no role check | Medium | Fixed |
| E36 | Webhook URLs allow SSRF | Medium | Fixed |
| E37 | OTP code logged and returned in the response when NODE_ENV is not "production" | Medium | Fixed |
| E38 | Public payment link page exposes the merchant's API key hash and prefix | Low | Fixed |
| E39 | CSV export loads everything into memory (DoS) and allows formula injection | Medium | Fixed |
| E40 | withTransaction: a failing ROLLBACK hides the real error | Low | Fixed |
| E41 | Reporting consumer can crash and loop forever | Medium | Fixed |
| E42 | Outbox consumer can skip events | Medium | Fixed |
| E43 | refund_merchant_summary view joins on the wrong column | Medium | Fixed |
| E44 | Reconciliation "pending" estimate uses float and the wrong rate | Medium | Fixed |
| E45 | [second review] /v1/reporting/export-summary had no login check (always 500) | High | Fixed |
| E46 | KYC "PDF only" rule checks the filename, not the content | Low | Fixed |
| E47 | Admin console: session not rotated after OTP; no CSP | Low | Fixed |
| E48 | Admin run-batch sends no payout notification; split payouts skip the lifetime estimate | Low | Partly fixed |
| E49 | settlement rebuild-balances --merchant never writes the cache | Low | Fixed |
| E50 | Fee at capture ignores the negotiated discount that settlement applies | Medium | Partly fixed |
| E51 | API and seed cannot start: built-in dev key is 34 bytes, check needs 32 | High | Fixed |
| E52 | Every refund fails: code inserts reason = NULL, migration 0070 forbids NULL | High | Fixed |
| E53 | One malformed outbox event stops the whole reporting consumer | Medium | Fixed |
| E54 | Webhook backoff test always fails: test expects no jitter, code adds random ±10 % | Low | Fixed |
| E55 | Seed prints API keys; API listens on every network interface | Low | Fixed |
| E56 | Go DB tests are flaky when packages run in parallel | Low | Fixed |
| E57 | Bad input gives 500 instead of 400 (invalid JSON body, malformed UUID) | Low | Fixed |
| E58 | Session vs impersonation order may mix identities (FP-198 comment) — not reproduced: a test with both cookies shows no mixing | Medium | Skipped |
| E59 | Acquirer callback outcome is never validated | Low | Fixed |
| E60 | Reconciliation counts payouts of earlier days as an unexplained gap | Medium | Fixed |
| E61 | Dashboard and admin console cannot reach the API from their own origin (no CORS, no proxy) | Medium | Fixed |
| E62 | [found later] Two reporting passes at the same time count every event twice | Medium | Fixed |
| E63 | [found later] Admin reporting rebuild double-counts events the worker has not reached | Medium | Open |
| E64 | [found later] Payout trends never show "paid" (settlement.paid not consumed) | Medium | Fixed |
| E65 | [found later] The seed wipes real tables (incl. admin audit log) with no environment check | Medium | Fixed |
| E66 | [found later] expire_holds can delete holds released between its SELECT and DELETE | Low | Fixed |
| E67 | [found later] refund_merchant_summary counts captured once per refund; never refreshed (my F01e bug) | Low | Partly fixed |
| E68 | [found later] Seed adds the lifetime payout estimate in float32 | Low | Fixed |
| E69 | [found later] Seeded fees ignore the seeded fee schedules (suspected) | Low | Open |
| E70 | [found later] Seeded outbox events do not match the seeded history | Low | Open |
| E71 | [found later] Re-seeding leaves old dead letters with reused outbox ids | Low | Fixed |
| E72 | [found later] reconcile_march uses authorization time and running-total residue (suspected) | Low | Open |
| E73 | [found later] CloseBatch never journals the scheme rounding residue (ADR-0002 not implemented) | High | Fixed |
| E74 | [found later] Balance cache and ledger rebuild measure different things (drift after rebuild) | Medium | Open |
| E75 | [found later] March sweep posts the opposite legs from ADR-0002, charging merchants | Medium | Fixed |
| E76 | [found later] Dashboard date filter uses UTC days, not Bahrain days | Medium | Fixed |
| E77 | [found later] Float and toFixed on money in the batch detail page | Low | Fixed |
| E78 | [found later] Balance rebuild may hit the 30 s timeout; no row lock (suspected) | Low | Partly fixed |
| E79 | [found later] Dead helpers with float or wrong-scale money math | Low | Open |
| E80 | [found later] Scheme export fallback can print more than 2 decimals | Low | Fixed |
| E81 | [found later] Admin Run batch default date uses the UTC day | Low | Fixed |
| E82 | [found later] Admin "rotate API key" hands staff a full-power merchant key | Medium | Open |
| E83 | [found later] Legal name and CR number editable after KYC approval, no re-review | Medium | Fixed |
| E84 | [found later] CSRF from same-site pages (Lax only, text/plain accepted) | Low | Fixed |
| E85 | [found later] Impersonation grant survives admin disable/logout | Low | Fixed |
| E86 | [found later] Dashboard dev proxy forwards /v1/admin; shared cookie jar | Low | Partly fixed |
| E87 | [found later] No anti-framing headers on dashboard and checkout | Low | Fixed |
| E88 | [found later] Read-only impersonation and API keys can write saved filters | Low | Fixed |
| E89 | [found later] Unsalted SHA-256 of card number and CVV stored | Low | Fixed |
| E90 | [found later] KYC download puts the raw filename into a header | Low | Fixed |
| E91 | [found later] Every service connects as one Postgres superuser | Medium | Fixed |
| E92 | [found later] Ledger immutability claim false; audit log unprotected | Medium | Partly fixed |
| E93 | [found later] sqlFilter builds DELETE with no WHERE for null/undefined filters | Medium | Fixed |
| E94 | [found later] Settlement internal API: plain HTTP on all interfaces; weak token accepted | Low | Partly fixed |
| E95 | [found later] Internal settlement errors returned to admin browsers | Low | Fixed |
| E96 | [found later] Reporting trusts payload merchant/amounts; negative amounts pass (my E53 check) | Low | Fixed |
| E97 | [found later] Reporting config accepts bad numbers ("15s" → 15 ms) | Low | Fixed |
| E98 | [found later] Raw Postgres error text in logs and dead letters (my E53 code) | Low | Fixed |
| E99 | [found later] Dashboard capture makes a new Idempotency-Key on every click (double capture on retry) | High | Fixed |
| E100 | [found later] Checkout tells a charged buyer to try again (reservation_lost) | Medium | Fixed |
| E101 | [found later] Expired link with stale reservation: Pay form forever, cannot cancel | Medium | Fixed |
| E102 | [found later] Merchant dashboard logs out after 10 minutes and does not notice | High | Fixed |
| E103 | [found later] View as merchant cannot work end to end | Medium | Open |
| E104 | [found later] Bulk Approve KYC approves hidden merchants; server checks no status | High | Fixed |
| E105 | [found later] Refund drawer keeps its key after a definite 4xx (my F01f bug) | Medium | Fixed |
| E106 | [found later] Reconciliation and batch pages leave out refund parts | Medium | Fixed |
| E107 | [found later] Expired payment links shown as active with Cancel | Low | Fixed |
| E108 | [found later] List pages can append rows from an old filter (suspected) | Low | Fixed |
| E109 | [found later] Small admin/checkout display bugs | Low | Fixed |
| E110 | [second review] Streaming CSV export pages on occurred_at only (unused code) | Low | Fixed |
| E111 | [second review] CSV quoting ignores carriage returns | Low | Fixed |
| E112 | [second review] Invalid date filters reach the DB (500 instead of 400) | Low | Fixed |
| E113 | [second review] Session promotion after OTP updates by id only (defence in depth) | Low | Fixed |
| E114 | [second review] Concurrent OTP resends can rotate the challenge twice | Low | Fixed |
| E115 | [second review] Impossible dates like 2026-02-30 are accepted | Low | Fixed |
| E116 | [second review] Writer actor does not reject impersonation (defence in depth) | Low | Fixed |
| E117 | [deep review] OTP guess limit was per code, not per user (brute-forceable) | High | Fixed |
| E118 | [deep review] Running a batch for today strands that day's later captures | High | Fixed |
| E119 | [deep review] CSV adjustment import bypasses the two-person credit rule | High | Fixed |
| E120 | [deep review] MDR recalculation can make a batch's net payout negative | High | Fixed |
| E121 | [deep review] Manual credits and CSV adjustments are never paid out | High | Fixed |
| E122 | [deep review] Failed DB connect in link pay leaks the lock slot forever | High | Fixed |
| E123 | [deep review] Malformed card gives 500 after the link is claimed (link blocked 60 s) | High | Fixed |
| E124 | [deep review] Capture replay credits the wrong discount (twice after a zero-discount capture) | High | Fixed |
| E125 | [second review] Filters without a time zone read in the server's local zone | Medium | Fixed |
| E126 | [second review] Pagination limits parsed with parseInt; NaN reaches SQL | Low | Fixed |
| E127 | [second review] Settlement date filters accept impossible dates | Low | Fixed |
| E128 | [deep review] Suspended merchant keeps sessions and API keys | Medium | Fixed |
| E129 | [deep review] Capture idempotency hash ignores the transaction id | Medium | Fixed |
| E130 | [deep review] Failed link capture leaves the card authorization open | Medium | Fixed |
| E131 | [deep review] Discount error after a paid link gives the buyer a 500 | Medium | Partly fixed |
| E132 | [deep review] Reconciliation reads its figures from different snapshots | Low | Fixed |
| E133 | [second review] Report filter JSON used without a shape check | Low | Fixed |
| E134 | [coverage] A credit's effectiveDate has no range: a future date holds the payout for years, an old date lands in a closed period | High | Fixed |
| E135 | [coverage] Single-merchant KYC review approves a merchant in any state | High | Fixed |
| E136 | [coverage] Any admin role, including support, can resend all of a merchant's past webhooks, again and again | High | Fixed |
| E137 | [coverage] KYC thumbnail: a 1 MB PNG decompression bomb can push the API past its 512 MB limit | High | Fixed |
| E138 | [coverage] [my E39 fix] The 50,000-row export cap still lets 4 concurrent exports crash the heap | High | Fixed |
| E139 | [coverage] Capture and the status recompute disagree on a refunded, partly captured transaction | Medium | Fixed |
| E140 | [coverage] Balance adjustment: a huge deltaFils gives 500, and there is no upper limit | Medium | Fixed |
| E141 | [coverage] Credit: a huge baseAmountFils with reverseFee gives 500 | Medium | Fixed |
| E142 | [coverage] Control characters in credit memos and adjustment reasons are accepted; a NUL byte likely gives 500 | Medium | Fixed |
| E143 | [coverage] A webhook replay gets a new delivery id; comments and docs/ADMIN.md say it keeps the original | Medium | Fixed |
| E144 | [coverage] Webhook archive create loads an endpoint's whole history into memory; "pages of 500" is false | Medium | Fixed |
| E145 | [coverage] Signup: no password rule and no type checks; bad input gives 500 | Medium | Fixed |
| E146 | [coverage] Public signup and login have no rate limit; each call runs argon2 | Medium | Fixed |
| E147 | [coverage] A broken image upload gives 500 and leaves an orphan file on disk | Medium | Fixed |
| E148 | [coverage] No limit on KYC uploads per merchant: the shared disk can be filled | Medium | Fixed |
| E149 | [coverage] Credit effectiveDate "0000-01-01" passes validation; Postgres likely refuses it (500) | Low | Fixed |
| E150 | [coverage] Balance adjustment returns 404 for a merchant with no balance row yet | Low | Skipped |
| E151 | [coverage] Defence in depth: validateRefundRequest trusts its caller's numbers | Low | Fixed |
| E152 | [coverage] Go ApplyRateFils: int64 overflow wraps silently (TS throws) | Low | Fixed |
| E153 | [coverage] A fully refunded, partly captured row refunded again with no amount gives 422 instead of 409 | Low | Fixed |
| E154 | [coverage] adjustMerchantBalanceJournaled is dead code | Low | Open |
| E155 | [coverage] Webhook PATCH with a bad status gives 500 | Low | Fixed |
| E156 | [coverage] timingSafeEqualHex accepts extra characters after a valid digest | Low | Fixed |
| E157 | [coverage] Several files in one KYC request: earlier ones are silently dropped; "one file enforced" comment is false | Low | Fixed |
| E158 | [coverage] Adjustment import has no row cap; one long transaction can outlive the 60 s proxy timeout | Low | Fixed |
| E159 | [second review] Pagination cursors are not validated; a malformed cursor reaches a database cast (500) | Low | Fixed |
| E160 | [second review] The adjustment-import list pages on created_at text with no tie-breaker | Low | Fixed |
| E161 | [second review] Recent ledger activity includes the exclusive end date (one extra day) | Low | Fixed |
| E162 | [second review] The adjustment CSV ignores extra columns, so an amount written with a thousands comma posts the wrong amount silently | High | Fixed |
| E163 | [second review] API config never refuses bad settings (prefixes, booleans, NODE_ENV typo turns off security defaults, no ranges) | Medium | Fixed |
| E164 | [found later] /healthz and /readyz on the public port return the web page | Low | Fixed |
| E165 | [second review] Authorize and capture accept a zero or negative amount: 0 reaches the acquirer then the DB CHECK (500); negative makes toFils throw (500) | Medium | Fixed |
| E166 | [second review] Payment-link create with amount 0 gives a DB error (500) | Low | Fixed |
| E167 | [second review] Merchant OTP promotion keeps the pending session token (session fixation); the admin half is E47 | Medium | Fixed |
| E168 | [second review] Webhook dispatch Step B still queues deliveries for disabled endpoints | Medium | Fixed |
| E169 | [second review] Saved-filter POST accepts an array filter and a whitespace-only name | Low | Fixed |
| E170 | [second review] [regression from my E133 fix] the report filter refuses the valid status partially_refunded | Medium | Fixed |
| E171 | [second review] No cap on saved filters per merchant; the list returns every row | Medium | Fixed |
| E172 | [second review] Webhook archive/replay date ranges take any `new Date` (rollover, zone-less, numbers) | Low | Fixed |
| E173 | [second review] Admin run-batch and MDR recalc: dates checked by regex only, a reversed range is a silent no-op, a missing merchant gives 500 | Low | Fixed |
| E174 | [second review] Payment-link expiresAt rolls over (2026-02-30) or is read zone-less | Low | Fixed |
| E175 | [second review] Webhook URLs with embedded credentials are accepted but never deliverable | Low | Fixed |
| E176 | [deep review] A redeploy stops settlement after 10 s, although it waits 30 s for a running batch | Low | Fixed |
| E177 | [deep review] Admin login and admin invites match emails case-sensitively | Low | Open |
<!-- errors:end -->
