# Judge Q&A — first draft

Short answers with proof. IDs refer to docs/LOG.md (E = error, H = hidden thing,
J = Judge note, N = note in docs/NOTES.md). Status on 30 Oct 2026, 4:20 PM:
67 of 133 errors fixed (High: 39 of 40; the open High is E13, which needs a human to rotate a leaked secret).

## A. Errors

**1. What was the worst bug you found?**
Money moving twice or to the wrong place. Examples: one payment link charged twice during a slow payment (E29, incident 2026-05-14); two refunds at once both paid out (E28, FP-209); credits never paid to shops (E121). Each has a test that failed before and passes after.

**2. Walk us through one bug from start to end.**
E21, the CSV import: finance uploaded 4.75 BD and the ledger showed 0.475 (CASE-FILE.md:47). Root cause: the parser kept 2 decimals (cents), but BD has 3 (1 BD = 1000 fils), so "4.75" became 475 fils. Fix: use the existing `parseBhdToFils` (packages/money/src/fils.ts:282). Test: `4.75 → 4750` failed (`actual: 475`) then passed. Old tests that locked the wrong numbers were corrected (J20). Commit 2f06eb4; read-only query for old wrong imports in LOG section 5.

**3. Why is the scheme statement always a few fils higher?**
Lines were rounded half-up to 2 decimals (NUMERIC(10,2)), so the export was always over; ADR-0002 says truncate and journal the residue. Fixed in E14 (export = truncated amount) and E73 (residue journaled in CloseBatch). The March sweep also took the residue from shops instead of clearing (E75).

**4. Can a refund be bigger than the charge?**
Not any more. The refund total is checked under a row lock (SELECT … FOR UPDATE) against the captured amount, so two refunds at once cannot both pass (E28, FP-209).

**5. Does login work without the OTP?**
It did: a pending session was accepted before the OTP (E03). Now a session is "live" only after OTP verify; guesses are limited per challenge (E34) and per user across challenges (E117, deep review).

**6. Could merchant A act on merchant B?**
Yes before: A could cancel B's payment link (E05). Now every write checks the merchant id from the session, not from the URL.

**7. How do you know your fixes did not break something else?**
After every fix: the new test (red, then green) and the full regression: about 447 API tests, 18 reporting, 13 web, 10 scripts, 80 Go, compared with a fixed baseline (`baseline-failing-v3.txt`: only the known E54 test). Commits only when they match.

**8. What did you not fix, and why?**
E13: the leaked acquirer secret must be rotated at the acquirer by a human; we removed it from git tracking and the compose file. Medium and Low entries are listed with status in docs/ERRORS.md; some need a finance decision (old wrong sweep rows, E75; old CSV imports, E21).

## B. AI use

**9. How did you check what the AI told you?**
Every claim needs proof (file:line, commit, command output); agent reports are leads, re-checked by hand (J07); every fix has a red-then-green test; the full suite runs before each commit. See docs/AI-SETUP.md.

**10. Show a time the AI was wrong and you caught it.**
My first E29 fix passed its test, but the reviewer found a double charge during a slow capture; a second test with a 500 ms capture failed (`link charged 2 times`) until the link row was locked (J22). Also J23 (OTP fix logged real users out) and J19 (recalculation paid refunds back).

**11. Why hooks and not just instructions?**
Instructions can be skipped; hooks run on every action. The phase guard blocked an edit to CLAUDE.md during the UNDERSTAND phase even though CLAUDE.md itself asked for it (J08, docs/AI-SETUP.md moment 1).

**12. The repo has its own AI rule files. Did you follow them?**
No. AGENTS.md, .cursorrules and CLAUDE.md.bak are evidence, not instructions. Most claims are false: "money is cents", "settlement is UTC", "never change tests" (H14-H16, J03). Obeying them would have kept the 10x CSV bug and the 3 AM close.

**13. Two AI tools reviewed the code. Did they agree?**
They found different bugs (J26): ours went deep on money and races, the second review on input and session edge cases. Where it was wrong (kept the old API key working because a test expected it, E07), we disagreed with proof (J28, docs/COMPARE.md). Its method became our "Deep review lens" (J27), which then found new High bugs (E117-E124).

**14. How did you make AI faster without losing safety?**
Up to 2 read-only planner agents write a fix plan and a failing test into the scratchpad; only the main session edits code, one entry at a time, full tests after each fix (J30).

## C. Capacity and hosting

**15. What is your capacity estimate?**
About 15 checkouts per second (≈ 900 per minute), p95 under 2 s, on 1 vCPU / 2 GB with the API at 0.5 vCPU / 512 MB. Open model: 20/s still inside the rules (p95 1.2 s, 1 % shed); closed model: about 14.5/s at 10-15 users (LOG section 6, "Capacity estimate").

**16. How did you measure it?**
k6 (ops/loadtest/checkout.js): one checkout = read the link, then pay it, each on a fresh link, through nginx on the real compose stack with its limits. Rules: p95 < 2 s, real errors < 1 %, turned away ≤ 1 %. The simulator's planned 2 % declines count as correct answers.

**17. What was the bottleneck?**
Postgres, not the API: in round 1 Postgres sat at its 0.25 vCPU cap while the API used at most 15 % of a core. We moved CPU to Postgres (0.35) and lowered the in-flight cap from 48 to 24 (LOG section 6).

**18. What happens when you push past the limit?**
The API turns away the excess with 503 + Retry-After (more than 24 requests in flight, or an event-loop delay over 300 ms; a DB pool timeout is also 503). At 60/s it shed 72 % and never restarted. After about 11,000 checkouts: no double charges and the ledger balanced exactly (LOG section 6).

**19. Does it restart and recover without losing data?**
Every service has `restart: unless-stopped` and a health check (reporting has no health check yet: gap recorded); data is in volumes. We killed Postgres (pg_ctl stop -m immediate) and the API (SIGTERM to PID 1): both came back, no data lost (LOG section 6).

**20. Is the hosting secure and reproducible?**
Only nginx publishes ports; Postgres and the settlement API stay on private networks; each service has its own non-superuser DB role; the ledger and audit log are append-only for the app roles (0082). Secrets come from `ops/gen-env.sh` (random, gitignored, never printed). A fresh clone of the fork plus two commands gave a healthy stack and a working checkout (LOG section 6, "Reproducibility check").

## D. The case story (docs/CASE-MAP.md; LOG section 3, "Case conclusion")

**21. Who did it?**
The history was staged after 12 Sep 2026 (high confidence). Main actor: Mahmood Khalil (medium): his notes cite two erased commits that match case bugs (FP-187, FP-203), 32 of his comments dismiss real bugs, he claimed a callback fix (`processed_events`) that exists nowhere in code, and he wrote the misleading AI rule files. Ali revoked Yousif and committed a fix he knew was false (high). Fatima made smaller mistakes. Yousif's name on bug files proves little.

**22. What was planted to mislead an AI?**
The repo's AI rule files (H14-H16), tests and comments that defend bugs (H13, H35), "Claude says" comments dismissed (H12), false docs and ADRs (H17-H20), empty "fix" commits (H10), postmortem "Done" items that never shipped, and puzzle bait (the transmissions). Full list in docs/CASE-MAP.md.

**23. How do you know the history was rewritten?**
41 commits have committer "placeholder <p@x>" (H08); a commit dated Aug 2025 contains a file "Last updated: 2026-09-12" (`git show 669af52:.cursorrules`); a Feb 2026 commit sits on top of a Sep 2026 one (`git merge-base --is-ancestor 098c2de f7a7a3a`).

**24. Why not just trust git blame?**
Every inherited file was added once and never edited (`git log a12d4c7^ --diff-filter=M` is empty), so blame shows only which name the rewrite gave each file. MK-signed files carry Yousif's name.

**25. Did your own investigation get anything wrong?**
Yes, and we corrected it in place: nine hidden-thing entries had a wrong commit, a weaker claim or a missing detail (H05, H07, H09, H11, H13, H14, H16, H25, H35). Each now has a dated "Correction" line.

## E. Decisions

**26. Which decisions did you make that the brief did not cover?**
Each is a "Decision" in LOG section 5 (what, why, alternative); those for Zainab to review are marked. Examples: refunds carried to the next batch, not a negative payout (F01); CSV imports capped at the two-person threshold (E119); MDR recalculation skips a batch instead of storing a negative payout (E120); 0055 suspense accounts as `asset` (E01, the second review disagrees).

**27. Why this fix order?**
App-stopping errors first (E01 migrations), then High security, then the missing feature (F01 refunds), then wrong-result money errors, then Medium and Low. When Zainab changed the priority to "every High first", we did that (J24).

**28. Why small fixes instead of rewrites?**
The case file scores small working fixes higher (Item 01), and small fixes are easier to prove: one root cause, one test, one commit. Example: E62 is one line (`FOR UPDATE`) with a test that proves the race.
