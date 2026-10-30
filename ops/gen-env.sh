#!/bin/sh
# E02: fill ops/.env.docker (gitignored) with random secrets for every key that
# is missing. Existing values are never changed and nothing is printed.
set -eu
F="$(dirname "$0")/.env.docker"
touch "$F"; chmod 600 "$F"
add() { grep -q "^$1=" "$F" || printf '%s=%s\n' "$1" "$2" >> "$F"; }
hex() { openssl rand -hex "$1"; }
add POSTGRES_PASSWORD "$(hex 24)"
add FILSPAY_OWNER_DB_PASSWORD "$(hex 24)"
add FILSPAY_API_DB_PASSWORD "$(hex 24)"
add FILSPAY_SETTLEMENT_DB_PASSWORD "$(hex 24)"
add FILSPAY_REPORTING_DB_PASSWORD "$(hex 24)"
add WEBHOOK_SECRET_ENCRYPTION_KEY "$(openssl rand -base64 32)"
add SETTLEMENT_INTERNAL_TOKEN "$(hex 32)"
add ACQUIRER_CALLBACK_SIGNING_SECRET "$(hex 32)"
echo "ops/.env.docker: $(grep -c '^[A-Z_]*=' "$F") keys (values not shown)"
