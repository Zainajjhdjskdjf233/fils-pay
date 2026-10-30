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

Plus 12 new database migrations, 73 new test files, and changes to 105 existing files (89 of them code). Every fix is its own commit: `fix(E..)` or `feat(..)`.

## Who did what

### Zainab
- Designed and built the whole AI setup (.claude/: rules, hooks, agents, commands, and CLAUDE.md).
- Directed and checked every fix. All fixes in this fork were made under her setup; all commits after the inherited history are hers.
- Her setup found 147 of the 163 recorded errors (every entry except the 16 tagged [second review]), plus 39 hidden things in the docs and git history.
- Built the missing refunds feature end to end (API, ledger, fees, settlement, webhook, reports, reconciliation, dashboard).
- Added 73 new test files.
- Built the Docker hosting within the 1 vCPU / 2 GB limits, load shedding, the k6 load test and the capacity estimate.
- Did the UI work and the before/after screenshots.
- Wrote all the documentation: LOG, NOTES, ERRORS, OVERVIEW, AI-SETUP and the rest of docs/.
- Turned the second review's method into a permanent rule (the "Deep review lens"), which then found 8 more High bugs (E117-E124).

### Teammate
- An independent review with a different AI tool, in a separate copy of the repo: 45 items.
- 16 items were new to us, checked in the code and added to our list: E110-E116, E125-E127, E133, E159-E163. Item 29 also showed the real cause of our E45 (a missing login check).
- Her changes are not part of this fork, and her notes say her tests could not be run. Details: [docs/COMPARE.md](docs/COMPARE.md).

## Run it
```
bash ops/gen-env.sh
docker compose -f ops/docker-compose.yml up -d
```
