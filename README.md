# FilsPay — fixed by Zainab

The Handover hackathon, 29–31 October 2026.

We inherited FilsPay broken. This fork holds our audit, our fixes, the missing refunds feature, the Docker hosting setup, and every file we wrote to explain the work.

**Start here: [docs/OVERVIEW.md](docs/OVERVIEW.md)**: status, every error, and every fix explained, in one file.

## Files we created

### Explanations and records
| File | What it is |
|---|---|
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | The main file: status, stages, judging map, every error, every fix |
| [docs/ERRORS.md](docs/ERRORS.md) | Every error we found: level and status |
| [docs/NOTES.md](docs/NOTES.md) | Every fix explained: idea, problem, fix, code, proof |
| [docs/NOTES-PLAIN.md](docs/NOTES-PLAIN.md) | The same, in plain words |
| [docs/LOG.md](docs/LOG.md) | Full record: proof for every claim, decisions, test results, judge notes |
| [docs/ACTIONS.md](docs/ACTIONS.md) | Every command and edit with the time, written by a hook the AI cannot edit |
| [docs/COMPARE.md](docs/COMPARE.md) | Our results compared with a second, independent AI review |
| [docs/tools/build_overview.py](docs/tools/build_overview.py) | Builds OVERVIEW.md from the other files |
| [CASE-FILE.md](CASE-FILE.md) | The organizers' sheets, typed in, plus how we are judged |

### Our AI setup
| File | What it is |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Our rules for the AI |
| [.claude/](.claude/) | Hooks, agents, commands and the skill that enforce the rules |
| [CLAUDE.md.bak](CLAUDE.md.bak) | The repo's original CLAUDE.md. It lied on purpose; we kept it as evidence |

### Hosting and capacity
| File | What it is |
|---|---|
| [ops/Dockerfile.node](ops/Dockerfile.node), [ops/Dockerfile.go](ops/Dockerfile.go), [ops/Dockerfile.web](ops/Dockerfile.web) | Container images for the API, settlement and web |
| [ops/docker-compose.yml](ops/docker-compose.yml) | The whole stack in 1 vCPU / 2 GB, API at 0.5 vCPU / 512 MB, restarts, volumes (rewritten by us) |
| [ops/gen-env.sh](ops/gen-env.sh), [ops/.env.docker.example](ops/.env.docker.example) | Secrets generated locally, never stored in git |
| [ops/nginx/](ops/nginx/), [ops/postgres/](ops/postgres/) | Web proxy and per-service database roles |
| [ops/loadtest/](ops/loadtest/) | k6 checkout load test and how we got our capacity estimate |

### New code
| File | What it is |
|---|---|
| apps/api/src/plugins/loadShedding.ts | Turns away excess load with 503 + Retry-After |
| apps/api/src/webhooks/ssrfGuard.ts | Blocks webhook URLs that point inside the network |
| apps/api/src/acquirer/cardShape.ts | Card input checked before a payment link is claimed |
| apps/settlement/internal/settlement/refund_batch.go | Refunds lower the shop's daily payout |
| apps/settlement/internal/settlement/credit_batch.go | Credits and adjustments paid through the daily batch |
| apps/web/src/api/idempotencyKey.ts, apps/web/src/pages/transactions/refundForm.ts | Safe retries and the refund screen |

Plus 11 new database migrations, 71 new test files, and changes to 105 existing files (89 of them code). Every fix is its own commit: `fix(E..)` or `feat(..)`.

## Who did what

### Zainab
- Designed and built the AI setup: the rules (CLAUDE.md), the hooks that enforce them, the agent team and the commands (.claude/).
- Ran the full audit: found 122 of the 133 errors, plus 39 hidden things in the docs and git history.
- Wrote every fix in this repository: 70 fixes and features, each with a test that failed first. All 175 commits here are hers.
- Built the missing refunds feature end to end (API, ledger, fees, settlement, webhook, reports, reconciliation, dashboard).
- Added 71 new test files.
- Built the Docker hosting within the 1 vCPU / 2 GB limits, load shedding, the k6 load test and the capacity estimate.
- Did the UI work and the before/after screenshots.
- Wrote all the documentation: LOG, NOTES, ERRORS, OVERVIEW, AI-SETUP and the rest of docs/.
- Turned the second review's method into a permanent rule (the "Deep review lens"), which then found 8 more High bugs.

### Teammate
- Did an independent second review of the code with a different AI tool: 31 items.
- 11 of those items were new to us. They were checked in the code and added to our list (E110-E116, E125-E127, E133). Another one (item 29) showed the real cause of our E45: a missing login check, so E45 became a High security bug.
- Her fixes were made in her own copy and are not part of this repository. Details: docs/COMPARE.md.

## Run it
```
bash ops/gen-env.sh
docker compose -f ops/docker-compose.yml up -d
```
