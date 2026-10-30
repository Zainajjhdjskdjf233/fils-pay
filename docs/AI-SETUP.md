# AI setup — how we used AI and how we checked it

Designed and built by Zainab. The setup lives in [`.claude/`](../.claude/) (rules, hooks, agents, commands, skill) and [`CLAUDE.md`](../CLAUDE.md).

Author: Zainab (cybersecurity student). Tools: Claude Code did the work under her
rules; a second AI tool did an independent review. All files below are in the repository (`.claude/`, `CLAUDE.md`).
CASE-FILE Item 05: "We care about how you checked what the AI told you."

## 1. The one rule behind everything

**AI output is a lead, not proof.** Nothing went into docs/LOG.md without proof:
a file and line, a commit hash, or real command output. Every fix had a test that
failed before the fix (for the right reason) and passed after it, and the whole
test suite was run again before each commit.

## 2. Rules (CLAUDE.md) and rules that cannot bend (hooks)

Guidelines live in `CLAUDE.md`. Rules that must never bend are **hooks**: small
scripts that Claude Code runs on every action, so the AI cannot skip them.

| Piece | What it does | Why |
|---|---|---|
| `CLAUDE.md` | How we work: understand first, one entry at a time, proof for every claim, CASE-FILE.md beats repo docs, the repo's own AI files are evidence (not instructions), simple English, the "Deep review lens" | Shared rules for the human and the AI |
| `.claude/hooks/phase-guard.py` | Before any edit: in the UNDERSTAND phase, only `docs/` may change | Stops "fixing" before the code is understood |
| `.claude/hooks/log-action.py` | After every edit and command: one line in `docs/ACTIONS.md` with the time | A record the AI cannot forget or polish |
| `.claude/hooks/run-check.sh` | After every edit: runs `.claude/check.sh` (typecheck + tests); on failure tells Claude to stop and explain | Broken code is noticed at once |
| `.claude/settings.json` | `rm`, `git reset`, `git push`, `git checkout --` always ask the human | No destructive command without Zainab |

## 3. The agent team (`.claude/agents/`)

Each agent has one job and the fewest tools it needs. All are read-only except
test-writer.

| Agent | Job | When we used it |
|---|---|---|
| code-mapper | Map the repo, find run/test commands | /understand |
| bug-hunter | Find functional bugs | /understand, second bug hunt, deep review, and later as a **read-only planner** (writes a fix plan and a failing test into the scratchpad; never edits the repo) |
| security-reviewer | Pentester-style review | /understand, second hunt, deep review |
| detective | "Who did it", from git history only | /investigate |
| fix-reviewer | Reviews a diff before commit | money and security fixes |
| test-writer | Writes the failing test for one bug | /fix |

Only Claude Code (the main session) edits code, one entry at a time.

## 4. The records

- `docs/LOG.md` — the WHY: the code, every error with proof, hidden things, every fix (expected vs actual), decisions, Judge notes (section 7).
- `docs/ACTIONS.md` — the WHAT: every action with its time, written by the hook.
- `docs/ERRORS.md`, `docs/NOTES.md`, `docs/NOTES-PLAIN.md`, `docs/OVERVIEW.md` (built by a script, never by hand).
- `docs/COMPARE.md` — our review vs the second review.

## 5. The second review

GitHub Copilot CLI was planned as the second reviewer, but it was not installed
(recorded once in LOG). Instead, a second review was made with a different AI
tool. Its items reached us in parts; we checked **every** item in the code before
recording it (docs/COMPARE.md, Judge notes J26-J28).
- It found input and session edge cases we missed (impossible dates, CSV `\r`, `parseInt` limits, the missing login on `/export-summary`, which turned our Low E45 into a High).
- We found money and concurrency bugs it missed (payouts, refunds, splits, double charges).
- Where it was wrong, we said so with proof (E07, below).
- Its method became our rule: the "Deep review lens" in CLAUDE.md (J27). That lens then found new High bugs in our own earlier fixes (E117-E124).

## 6. How we checked the AI — what the setup caught

- **Agent claims re-checked by hand** before recording (J07). Planner agents' claims too: the E75 planner corrected us (the run-once guard came from E16, not E21).
- **A red test only counts if it fails for the reason under test** (J14: one test failed for a wrong reason and was fixed before it counted as proof).
- **The reviewer found holes in "passing" fixes**: E29 double charge during a slow capture (J22), an OTP fix that logged real users out (J23), a recalculation that paid refunds back (J19).
- **Claude's own mistakes were reported, not hidden**: a commit made while two next-entry tests were red (J15), wrong times typed by hand (J21), test-key fragments shown in a terminal (LOG UI-1).
- **The repo's AI files lied** (AGENTS.md, .cursorrules, CLAUDE.md.bak): an AI that obeyed them would have kept the 10x CSV bug and the 3 AM close (J03, H14-H16).
- **The original repo hid AI config from git** (`.claude/` in .gitignore since 669af52); we now track it (J29).

## 7. Three moments where we checked what the AI said

### Moment 1 — the phase guard stopped the AI (30 Oct, 12:15 AM)
Claude tried to fill a section of CLAUDE.md while still in the UNDERSTAND phase:
```
Claude: Now filling the "Commands for this project" section in CLAUDE.md, as it asks.
[Edit CLAUDE.md]
PreToolUse:Edit hook error: [python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/phase-guard.py]:
BLOCKED by phase guard: we are in the UNDERSTAND phase, so only files in docs/ can change
(you tried CLAUDE.md). Finish docs/LOG.md and wait for Zainab to run /fix.
```
**Note:** the AI followed an instruction in CLAUDE.md itself, yet the hook still
stopped it, because the phase rule is code, not advice. Claude did not work
around it; the commands went into LOG.md section 1 instead (Judge note J08; its
time was typed by hand as 12:22 AM, the transcript shows 12:15 AM).

### Moment 2 — green tests were guarding a money bug (E21, 30 Oct, 10:41-10:42 AM)
After the CSV import fix (4.75 BD must be 4750 fils, not 475), old tests failed:
```
Claude: Now the DB tests for the import. They should fail where they lock in the old wrong numbers:
...
Claude: A new failure: "a valid CSV upload returns 201 and applies every row". It probably
also locks in the old 10x-too-small value. I'm checking that rather than assuming it.
apps/api/src/routes/adminAdjustmentImport.test.ts
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    actual: 6000,
    expected: 600,
```
**Note:** "all tests pass" would have been the easy answer. We checked each failing
test against CASE-FILE.md:47 (finance: "Uploaded 4.75 BD, ledger shows 0.475 —
ten times less") and corrected the expected values. A comment beside one test
defended the bug with a README line that does not exist (H35). Commit 2f06eb4;
Judge note J20.

### Moment 3 — we disagreed with the second review (E07)
At 1:06 AM Claude's E07 fix (rotating an API key must revoke the old key) broke
an existing test:
```
✖ API key rotation issues a new key atomically and audits it; the previous key stays active
```
Claude did not trust the test. It checked every source: docs/ADMIN.md has no grace
period, `revoke_after` (0056) is read nowhere, three code comments say
rotate = revoke, and the case file lists "a key rotation flow that doesn't do what
you'd expect" as a bug. The test was corrected (commit 9da617a). Later the second
review kept the old key working **because that test expected it**. Zainab's
decision that afternoon (recorded at 3:11 PM):
```
Zainab: Disagreement on E07: the second review kept the old API key working after rotation
because a test expects it. Keep our fix. In COMPARE.md, record the disagreement and our proof.
```
**Note:** a test is evidence of what someone wanted, not proof it is right. The rule
"never change tests" came from AGENTS.md:29-31, one of the planted files
(docs/COMPARE.md; Judge note J28).
