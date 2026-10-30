#!/usr/bin/env bash
# Fast check: typecheck + tests. Non-zero exit on any failure.
# Without DATABASE_URL, tests that need Postgres are skipped (loud warning).
# Without go, settlement Go tests are skipped (loud warning).
set -uo pipefail
cd "$(dirname "$0")/.."
# Go and Postgres were installed in the home folder (no Homebrew): LOG.md section 1.
export PATH="$HOME/.local/go/bin:$HOME/Applications/Postgres.app/Contents/Versions/16/bin:$PATH"

[ -d node_modules ] || { echo "node_modules missing: run npm ci" >&2; exit 2; }

echo "== typecheck"
npm run typecheck --silent || { echo "TYPECHECK FAILED" >&2; exit 1; }

if [ -n "${DATABASE_URL:-}" ]; then
  echo "== full test suite (DATABASE_URL is set)"
  npm test || { echo "TESTS FAILED" >&2; exit 1; }
else
  echo "WARNING: DATABASE_URL not set -> skipping tests that need Postgres" >&2
  FILES=$(grep -rL "DATABASE_URL" --include='*.test.ts' apps packages scripts | grep -v node_modules | sort)
  echo "== unit tests ($(echo "$FILES" | wc -l | tr -d ' ') files, no database)"
  # shellcheck disable=SC2086
  npx tsx --test --test-concurrency=1 $FILES || { echo "TESTS FAILED" >&2; exit 1; }
fi

if command -v go >/dev/null; then
  echo "== go test (settlement)"
  (cd apps/settlement && go vet ./... && go test -p 1 ./...) || { echo "GO TESTS FAILED" >&2; exit 1; }
else
  echo "WARNING: go not installed -> settlement Go tests NOT run" >&2
fi
echo "CHECK OK"
