# Stages

## /understand — read everything, write LOG.md sections 1-4, change no code

1. Write `understand` to `.claude/phase`. Ask: Learning mode or Competition mode? Record the answer at the top of LOG.md.
2. Read the brief / case file / task sheet FIRST (any of: CASE-FILE*, BRIEF*, brief*, TASK*, docs given by organizers). Note required features.
3. Git: `git status`, `git log --all --format='%h | %an <%ae> | committer %cn <%ce> | %ad | %s' --date=iso`. If there is no repo: `git init`, commit everything as `chore: snapshot as received`.
4. Delegate to `code-mapper` (structure, how to run, contradictions). Run the app exactly as received; save the real output as proof.
5. Create `.claude/check.sh`: the fastest command that builds and runs the tests; non-zero exit on failure.
6. Run `bug-hunter` and `security-reviewer` in parallel (read-only). For each suspicious line run `git blame -L <line>,<line> <file>`.
7. Write `docs/LOG.md` with the template below: sections 1, 2, 3 and 4. Section 3 gets every contradiction, strange note, misleading doc, deleted file, odd commit, secret, and anything that looks like a clue.
8. Add Judge notes for anything from this stage worth telling judges (see section 7 of the template).
9. Show her a short summary: what the app is, how many errors / hidden things / features, the top 3 errors. Then stop. She reads the log and runs /fix when ready.

## /fix — one entry at a time

1. Write `fix` to `.claude/phase` (first time only).
2. First time only: ask `test-writer` for a few characterization tests (`char_...`) that record current behaviour, so accidental changes show up.
3. Pick the entry: the ID she gives, or the next open entry in this order:
   1. errors that stop the app from starting or running
   2. high-severity security issues
   3. features from the brief (F01, F02 ...)
   4. errors that give wrong results
   5. medium/low security issues
   6. messy code
   Reason: judges test the running app and the brief's features, so a working app with the required features comes before small fixes.
4. **Plan**: show What / Why / Where, the before/after code, and the expected result. Wait for her OK (Learning mode: also wait before each individual edit).
5. **Prove**: a small test that fails now because of this entry (`test-writer`). Show it failing.
6. **Do**: smallest change. Explain changed lines one by one.
7. **Verify**: run `.claude/check.sh` and the app. Fill "Actual result". If it differs from expected: say so, keep status open, explain.
8. **Review** non-trivial changes with `fix-reviewer`.
9. **Record**: commit, set the entry status, add a block to section 5, update the Summary line, and add a Judge note if this entry had a moment worth telling judges. Then stop.
10. New problems found while fixing: add them to section 2 as new IDs tagged `[found later]`.
11. **Tell her in 3 lines** after every entry, in the terminal:
    `What:` what was wrong · `Why:` the root cause · `Result:` actual result and whether it matched.
12. **Decisions**: any choice the brief does not cover (a limit, a different approach, a skipped fix) is recorded in the entry as `Decision: <what> — Why: <reason> — Alternative: <the other option>`, and as a Judge note of type "a trade-off chosen".
13. **Checkpoint**: when every app-stopping error, every high-severity security issue and every brief feature is done, STOP even in Competition mode. Show the remaining open entries, one line each with severity and a time estimate, and ask which ones to do. Do not start them until she answers.
14. **Cost**: use `fix-reviewer` only for changes to more than one function or any security fix. Do not run other agents in /fix unless she asks.

## /deploy — section 6

1. Read the brief for the hosting target (for The Handover: Dilmune Cloud). Never type passwords or API keys yourself; ask her to enter them.
2. Prepare: start command, port from an environment variable, `.env.example` with names only (no real secrets), `.gitignore` for `.env`.
3. Add a GET /health route (returns 200 {"ok":true}) if the app has none, so the live app can be checked fast.
4. Write a deploy checklist in section 6 before deploying: start command; port (read from PORT); every environment variable the app needs (name and purpose, never the value); files that must not be uploaded (.env); how to test it live (the exact URLs).
5. After deploying, write: URL, the live test results, problems seen in logs.

## /investigate — case conclusion

1. Delegate to `detective` (read-only). Compare author vs committer, times, deleted files (`git log --all --diff-filter=D --summary`), notes, comments.
2. Write `docs/CASE-MAP.md` (English): the evidence map, so she can follow how the conclusion was reached.
   - Start: the line in the brief/case file that starts the case.
   - Branches: The code (what was done) · Git history (when and by whom) · Notes and docs (who warned, what was hidden). Add a branch if the evidence needs one.
   - For each branch, a chain of steps: `Clue (ID) → what it shows → proof (file:line / commit / command) → leads to`.
   - End: the conclusion, confidence (high/medium/low) and why, and what would change the conclusion.
   - Draw the same map as a mermaid `flowchart TD` block at the top of the file (VS Code shows it with Cmd + Shift + V when a mermaid preview extension is installed; the text chains below must stand alone without it).
   - "## Summary" at the end.
3. Add to section 3 a "Case conclusion" block: timeline, who did what, proof for each claim, confidence (high/medium/low), open questions. Name everyone honestly, including people who made smaller mistakes.

## /findings — the final report (run after /investigate, before /present)

Write everything in simple, clear English. No Arabic in any file.

1. Write `docs/FINDINGS.md`:
   - "Part 1: Errors": every error from LOG.md section 2, grouped by kind (the app does not run · one request crashes the server · wrong results · money · security · code quality). One line each: **ID** + one plain sentence.
   - "Part 2: Hidden things": every hidden thing from section 3, grouped (clues · misleading messages and docs · secrets · open questions). Same format.
   - "Part 3: Decisions": every Decision recorded in /fix: what, why, alternative.
   - "## Summary" at the end: 5-7 bullets — what was broken, what was hidden, who did what (from the case conclusion), what is fixed now.
2. Append a "## Summary" section at the END of `docs/LOG.md`: one bullet per section (1 to 7).
3. Append a "## Summary" section at the END of `docs/ACTIONS.md`: totals per type (RUN / EDIT / WRITE), then the timeline by stage with times. This is the only time you write to ACTIONS.md.
4. Use only facts already in LOG.md and ACTIONS.md. No new findings.

## /present

1. Final run of `.claude/check.sh` and the app. Update README with the real run command.
2. Write `docs/AI-SETUP.md` (simple English), built mainly from LOG.md section 7 (Judge notes): the agent team and why each exists; the two records (LOG.md = why, ACTIONS.md = what, written by a hook); the phase guard; why rules that cannot bend are hooks and guidelines are in CLAUDE.md; 2-3 moments from LOG.md where the setup caught a mistake.
3. Write `docs/DEMO.md` (English): ONE end-to-end flow that shows the app working and the most important fixes, as numbered steps. Each step: the exact command or URL (curl or browser), and the expected output. Include how to start the app first (with any environment variables). Keep it under 3 minutes. Run every step once yourself and confirm the output matches.
4. Ask her the 8 readiness questions one by one and help her answer in her own words:
   what the app does; one error end-to-end; a mistake Claude made and how it was caught; why the agents are set up this way; why this fix order; security findings; who did it and the proof; what she would do with more time.

## /log — print LOG.md summary (IDs, titles, status). Change nothing.
## /status — phase, mode, counts, next entry, check.sh result. Change nothing.

---

## LOG.md template

```
# LOG
Mode: Learning | Competition
Updated: 7:50 PM
Summary: Errors 0/6 fixed · Hidden 0 found · Features 0/2 done · Deploy: not started

## 1. The code
- What it does:
- Parts: (file → role, one line each)
- How to run:
- First run: (real output, or "crashes: see E01")

## 2. Errors
### E01 — <short title>
- Where: file:line
- Error: what goes wrong
- Root cause: why it happens
- Proof: file:line / command output / commit
- Severity: high | medium | low
- Proposed fix:
- Expected result:
- Status: open | fixed | found later (open)

## 3. Hidden things
### H01 — <short title>
- What:
- Where: file:line or commit hash
- Meaning: trap / clue / misleading doc / secret

(### Case conclusion — added by /investigate)

## 4. Features (from the brief)
### F01 — <short title>
- Required by: brief file:line
- Plan:
- Expected result:
- Status: open | done

## 5. Fixes
### E01 — 7:42 PM
- Changed: file:line, before → after
- Test: test name
- Actual result: ... (matches / does NOT match expected)
- Commit: hash

## 6. Deploy
- Platform:
- Status: not started | in progress | live at <URL>

## 7. Judge notes
Short entries, added the moment they happen, at every stage:
### J01 — 10:11 AM — <type>
- What happened: (one or two sentences)
- Why it matters: (what it shows about how the AI was set up or checked)
- Proof: file:line / commit / LOG entry ID
Types: Claude caught its own mistake · a hook or rule blocked something · actual result did not match expected · key clue found · a decision made by the human · a trade-off chosen.
```

Times are always 12-hour (7:42 PM).
