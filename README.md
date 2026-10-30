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

Plus new database migrations, more than 60 new test files, and fixes in over 100 existing files. Every fix is its own commit: `fix(E..)` or `feat(..)`.

## Run it
```
bash ops/gen-env.sh
docker compose -f ops/docker-compose.yml up -d
```
