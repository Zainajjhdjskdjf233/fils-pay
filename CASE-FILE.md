# CASE FILE — The Handover: FilsPay

Typed from the printed sheets the organizers handed out on 29 Oct 2026.
Read this file FIRST. If this file and anything in the repo disagree, this file wins.

## Item 01 — Security & Code Audit (onboarding briefing)

Your job: check FilsPay, a payment app made for Bahrain. It signs up shops, takes card payments, and pays the shops their money. Everything is in Bahraini Dinar (BD). **1 BD = 1000 fils.**

What you need to do:
1. **AUDIT** — find security holes, money bugs and anything that breaks.
2. **FIX** — fix each bug with the smallest change that works.
3. **EXPLAIN** — for each bug, write a short note: what's wrong, why, and what it breaks.
4. **BUILD** — finish the missing feature and host it on Dilmune Cloud.

The repo:
- `apps/api/` TypeScript/Fastify API (auth, payments, webhooks, admin)
- `apps/settlement/` Go daemon (batch close, scheme export, splits, payouts)
- `apps/reporting/` TypeScript consumer (outbox events to rollups)
- `apps/web/` React hosted checkout
- `apps/admin/` React admin console
- `packages/money/` shared integer-fils arithmetic
- `packages/events/` outbox event types
- `db/migrations/` Postgres schema (numbered 0001 to 0072)
- `scripts/` one-off operational scripts
- `ops/` Docker compose, env files
- `docs/` architecture, ADRs, runbook, handover notes

Where to start:
- Start with `docs/ARCHITECTURE.md` and `docs/HANDOVER.md`.
- Read every ADR in `docs/adr/`. They are the rules the code should follow.
- Money rule: **whole fils only, never decimals** (ADR-0001).
- Settlement closes every day at **midnight, Bahrain time (UTC+3)**.
- Run `docker compose up` in `ops/` to start everything on your laptop.

Scoring: bigger bugs get more points, and so do clear explanations. Explaining WHY a bug happens scores more than just spotting it. A small fix that works scores more than a big rewrite.

## Item 02 — Finance & Ops Weekly (from Fatima H., Finance, circulated 2026-09-20)

Open items from the Sep 17 reconciliation review. "The numbers still don't match."
- The scheme statement total is always a few fils HIGHER than ours. Always over, never under. Same for three months. Something is rounding.
- The March sweep script was meant to fix the leftover gap for Q1. Someone ran it twice on staging and the gap doubled. Nobody knows if it ran more than once on production. The log file only has one timestamp. Is it safe to run again? "I wouldn't."
- Split payouts for Delta Marketplace: the three child payouts don't add up to the parent's total. A few tens of fils each batch, every batch since launch. The missing fils are not anywhere in the ledger.
- The "Recalculate cached balances" button in admin: Alpha Retail's balance went from 135K to 7K. Yousif had to run the CLI rebuild to fix it. Why do the button and the CLI give different numbers?
- MDR recalculation changed batches that were already paid out. Those should never change. Settlement team says it only touches open batches.
- The fee shown in the merchant dashboard is 245 bps, but payments go through at 225 bps. The two fee tables have different dates; one was a backfill fix.
- The CSV import for manual changes: uploaded 4.755 BD, ledger shows 4.750. Uploaded 4.75 BD, ledger shows 0.475 — ten times less. Something is wrong with how it reads BD amounts.

Group chat claims (not checked):
- "The daily close is running at 3am local, not midnight."
- "Lifetime payout estimate drifts for high-volume merchants."
- "Test merchants keep showing up in the real settlement run."
- "Login works without entering the OTP code?"
- "I cancelled merchant B's payment link from merchant A's dashboard."

## Item 03 — Support Ticket Excerpts & Incident Notes

- **FP-187** Payment link paid after expiry. The link showed "expired" but the payment still went through. The checkout page sends something the server shouldn't trust.
- **FP-201 (REOPENED)** Duplicate notes on acquirer callbacks. The bank sent the same callback twice and two identical notes were saved on one payment. The 1.9.0 postmortem says this was fixed. It wasn't.
- **FP-203** Balance cache wrong after admin action. "Recalculate cached balances" dropped a balance from 135K to 7K. The CLI tool gives the right number. The two read from different places.
- **FP-209** Concurrent refund: double money out. Two refund requests at the same time both went through. Normal payments don't have this problem.
- **FP-240** Webhook signatures rejected by merchants. The part that signs the message and the part that sends it don't agree on what it looks like. Also, the incoming signature check has its own problems.
- **INCIDENT 2026-05-14** Payment link charged twice. A slow payment let a second buyer use the same link before the first one finished. Code comments say "this IS reachable."
- **INCIDENT 2026-08-21** Duplicate payout notifications. Two processes checked at the same time and both thought they were first.

Things that feel wrong but nobody filed tickets for:
- Can you refund more than what was actually charged?
- The settlement splits are always a few fils short.
- Some admin actions don't seem to have the right role checks.
- There's a key rotation flow that doesn't do what you'd expect.
- The daily close timing doesn't match what the docs say.
- One of the reporting queries is suspiciously slow.
- What happens to test merchants when certain admin tools run?
- The OTP implementation changed at some point. Is it still safe?
- Has anyone tried uploading a really large export?

## Item 04 — FP-??? Finish the Missing Feature (Feature · Priority: High · Status: To do · UNFINISHED)

Requested by product, never shipped. The last developer started a feature but never finished it. Find out what it is, build it so it works from start to end, and host the app on Dilmune Cloud.

Done when:
- [ ] The feature works from start to end, through the API.
- [ ] The money is right in the ledger, down to the fils.
- [ ] Fees and payouts come out right.
- [ ] The shop gets the right webhook.
- [ ] It shows up right in the timeline, the reports and reconciliation.
- [ ] The app is live on Dilmune Cloud, our hosting provider.

"looks easy. it isn't. it touches everything."

## Item 05 — How you'll be judged (170 points) — shared by the organizers on 30 Oct 2026

| Area | Points | What it means |
|---|---|---|
| Correctness | 100 | Load testing, a security review, hidden regression tests and a written findings report explaining the root cause of each problem. |
| Capacity | 20 | We load test your live server with a fixed checkout scenario and measure how many users it serves while staying fast and correct. Send us your own estimate, because an accurate one earns points. Then we push past your limit and see whether your stack turns away the excess, restarts itself and recovers without losing data. |
| Hosting architecture | 10 | Live, secure and reproducible. The whole stack runs on one server with 1 vCPU and 2 GB RAM, and the API is limited to 0.5 vCPU and 512 MB. |
| AI usage and setup | 10 | Add your AI setup files to your repository and include three annotated transcript excerpts in your submission document. We care about how you checked what the AI told you, not how much you used it. |
| UI and UX | 10 | Checkout, the merchant dashboard and the admin console. Bring before and after evidence. |
| Technical defence | 20 | The whole team meets the judges. You present from your slide deck, then the judges ask technical questions and choose who answers. Anything you can't explain or show working doesn't score. |
