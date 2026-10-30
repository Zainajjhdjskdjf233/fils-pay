#!/bin/sh
# E02: fill ops/.env.docker (gitignored) with random secrets for every key that
# is missing. Existing values are never changed and nothing is printed.
set -eu
F="$(dirname "$0")/.env.docker"
touch "$F"; chmod 600 "$F"
add() { grep -q "^$1=" "$F" || printf '%s=%s\n' "$1" "$2" >> "$F"; }
# E13: the acquirer callback signing secret leaked in git history (669af52).
# If this file still holds that value, replace it (only its SHA-256 is here).
LEAKED_SHA256="63889b3971febcfcdfe8d4bc9a17e67b719c00e47b2c1fc74eb7aa8a50ec6306"
cur=$(sed -n 's/^ACQUIRER_CALLBACK_SIGNING_SECRET=//p' "$F" | tr -d '\n')
if [ -n "$cur" ] && [ "$(printf '%s' "$cur" | openssl dgst -sha256 | sed 's/^.*= //')" = "$LEAKED_SHA256" ]; then
  grep -v '^ACQUIRER_CALLBACK_SIGNING_SECRET=' "$F" > "$F.tmp" && mv "$F.tmp" "$F" && chmod 600 "$F"
  echo "ops/.env.docker: replaced the leaked ACQUIRER_CALLBACK_SIGNING_SECRET with a new random one"
fi
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
