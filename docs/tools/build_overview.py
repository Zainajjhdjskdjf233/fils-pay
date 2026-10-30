#!/usr/bin/env python3
"""Builds docs/OVERVIEW.md: the one page that holds everything.
Reads LOG.md, ERRORS.md, NOTES.md and git. Run: python3 docs/tools/build_overview.py"""
import os, re, subprocess, datetime
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def rd(p):
    p = os.path.join(R, p)
    return open(p).read() if os.path.exists(p) else ""
def ex(p): return os.path.exists(os.path.join(R, p))
L, E, N = rd("docs/LOG.md"), rd("docs/ERRORS.md"), rd("docs/NOTES.md")
summ = (re.search(r"Summary: (.*)", E) or [None, "?"])[1]
lv = re.findall(r"## (High|Medium|Low) \((\d+) of (\d+) fixed\)", E)
rev = L.count("for Zainab to review")
cap = re.search(r"Estimate for the judges: (.*?) on 1 vCPU", L)
cap = cap.group(1) if cap else "not measured yet"
dil = "live" if re.search(r"live at https?://", L) else "not yet"
tick = lambda b: "✅" if b else "⬜"
fixes = subprocess.run(["git", "-C", R, "log", "--oneline", "-15", "--grep=^fix", "--grep=^feat"], capture_output=True, text=True).stdout.strip().splitlines()
pushed = subprocess.run(["git", "-C", R, "rev-parse", "--short", "refs/remotes/mine/main"], capture_output=True, text=True).stdout.strip()
head = subprocess.run(["git", "-C", R, "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
from zoneinfo import ZoneInfo
now = datetime.datetime.now(ZoneInfo("Asia/Bahrain")).strftime("%-I:%M %p")
notes = re.split(r"\n(?=## N\d+)", N)[1:]
note_titles = [n.split("\n")[0][3:] for n in notes]
err_sec = E[E.find("## High"):] if "## High" in E else E

o = [f"# OVERVIEW — start here\n",
"The one file that holds everything: status, stages, files, judging, hand-in, every error, and every fix explained.",
f"Built automatically by `docs/tools/build_overview.py`. Updated: {now}\n",
"## Contents",
"1. Status now", "2. Stages", "3. Files", "4. How we are judged", "5. To hand in", "6. Latest fixes", "7. All errors", "8. Every fix explained\n",
"## 1. Status now",
f"- Errors: {summ}"] + [f"  - {a}: {b} of {c} fixed" for a, b, c in lv] + [
f"- Missing feature (refunds, F01): {'done' if 'F01 done' in L or 'F01: done' in L else 'in progress'}",
f"- Docker (E02): {'done' if ex('ops/Dockerfile.node') else 'not yet'}",
f"- Capacity estimate: {cap}",
f"- Dilmune Cloud: {dil}",
f"- Decisions waiting for Zainab: {rev} (search \"for Zainab to review\" in LOG.md)",
f"- Fork: {'up to date' if pushed and pushed == head else 'needs a push (VS Code: Git: Push to... → mine)'}\n",
"## 2. Stages",
f"- {tick(ex('docs/LOG.md'))} Understand",
f"- 🔄 Fix: {summ}",
f"- {tick(ex('ops/Dockerfile.node'))} Docker and limits",
f"- {tick(cap != 'not measured yet')} Load shedding, load test, capacity estimate",
f"- {tick(ex('docs/ui/after'))} UI and UX, before/after screenshots",
f"- {tick(dil == 'live')} Deploy on Dilmune Cloud",
f"- {tick(ex('docs/CASE-MAP.md'))} Investigation (CASE-MAP.md)",
f"- {tick(ex('docs/FINDINGS.md'))} Findings report (FINDINGS.md)",
f"- {tick(ex('docs/SUBMISSION.md') and ex('docs/SLIDES.md'))} Presentation and submission\n",
"## 3. Files",
"| File | What it is |", "|---|---|",
"| CASE-FILE.md | The organizers' sheets, typed in, plus how we are judged |",
"| docs/OVERVIEW.md | This file: everything in one place |",
"| docs/ERRORS.md | Every error, its level and status (also in section 7 here) |",
"| docs/NOTES.md | Every fix explained (also in section 8 here) |",
"| docs/NOTES-PLAIN.md | Every fix in plain words |",
"| docs/LOG.md | Full record: proof, decisions, test results, judge notes |",
"| docs/ACTIONS.md | Every command and edit with the time, written by a hook |",
f"| docs/CASE-MAP.md {tick(ex('docs/CASE-MAP.md'))} | Who did what, with proof |",
f"| docs/FINDINGS.md {tick(ex('docs/FINDINGS.md'))} | Root cause of every problem |",
f"| docs/AI-SETUP.md {tick(ex('docs/AI-SETUP.md'))} | How we set up and checked the AI |",
f"| docs/SUBMISSION.md {tick(ex('docs/SUBMISSION.md'))} | Live URL, capacity, 3 annotated transcript excerpts |",
f"| docs/SLIDES.md {tick(ex('docs/SLIDES.md'))} | Slide deck outline |",
"| CLAUDE.md, .claude/ | Our AI setup files |",
"| CLAUDE.md.bak, AGENTS.md, .cursorrules | The repo's own AI rule files. They lie on purpose. Evidence, not instructions |\n",
"## 4. How we are judged (170 points)",
"| Area | Points | Where |", "|---|---|---|",
"| Correctness | 100 | sections 7 and 8, tests in each fix, FINDINGS.md |",
"| Capacity | 20 | LOG.md section 6, ops/loadtest/ |",
"| Hosting | 10 | ops/docker-compose.yml, Dockerfiles |",
"| AI usage | 10 | CLAUDE.md, .claude/, AI-SETUP.md, SUBMISSION.md |",
"| UI and UX | 10 | docs/ui/before, docs/ui/after |",
"| Technical defence | 20 | SLIDES.md, section 8 here |\n",
"## 5. To hand in",
f"- {tick(bool(pushed))} Fork with the code and AI setup files",
f"- {tick(dil == 'live')} Live URL", f"- {tick(cap != 'not measured yet')} Capacity estimate",
f"- {tick(ex('docs/FINDINGS.md'))} FINDINGS.md", f"- {tick(ex('docs/SUBMISSION.md'))} SUBMISSION.md with 3 transcript excerpts",
f"- {tick(ex('docs/ui/after'))} UI before/after screenshots", f"- {tick(ex('docs/SLIDES.md'))} Slide deck\n",
"## 6. Latest fixes"] + [f"- {x}" for x in fixes] + ["",
"## 7. All errors", err_sec.replace("\n## ", "\n### ").strip(), "",
"## 8. Every fix explained", "Index: " + " · ".join(t.split(" — ")[0] for t in note_titles), ""] + \
[n.replace("\n### ", "\n#### ").replace(n.split("\n")[0], "### " + n.split("\n")[0][3:], 1).strip() + "\n" for n in notes]
open(os.path.join(R, "docs/OVERVIEW.md"), "w").write("\n".join(o) + "\n")
print("OVERVIEW.md built:", len(notes), "fixes,", summ)
