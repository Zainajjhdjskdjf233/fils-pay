#!/bin/bash
# One-command deploy / redeploy of FilsPay on the live server (F02).
#   ssh dilmune@<server> 'bash ~/fils-pay/ops/deploy.sh'      (first time: see LOG.md section 6)
# Idempotent: installs Docker only if missing, pulls the latest main, keeps
# existing secrets (ops/gen-env.sh never prints or changes a good value, and
# replaces the leaked acquirer secret, E13), then rebuilds and restarts.
set -euo pipefail
REPO_URL="https://github.com/Zainajjhdjskdjf233/fils-pay.git"
DIR="$HOME/fils-pay"
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

# 1. Docker Engine + Compose plugin from Docker's official apt repo.
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER" || true
fi
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"

# 2. Code: clone once, then fast-forward to the latest main.
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO_URL" "$DIR"; fi
cd "$DIR"

# 3. Secrets: generated here, kept in ops/.env.docker (gitignored, mode 600), never printed.
sh ops/gen-env.sh
setkey() { grep -q "^$1=" ops/.env.docker || printf '%s=%s\n' "$1" "$2" >> ops/.env.docker; }
setkey HTTP_PORT 80
setkey ADMIN_PORT 8081
setkey CHECKOUT_BASE_URL "http://$PUBLIC_HOST"

# 4. Build and start (the server has 2 GB swap for the build), then show health.
$DOCKER compose --env-file ops/.env.docker -f ops/docker-compose.yml up -d --build
for i in $(seq 1 60); do
  $DOCKER compose --env-file ops/.env.docker -f ops/docker-compose.yml ps --format '{{.Service}} {{.Status}}' | grep -q "starting" || break
  sleep 5
done
$DOCKER compose --env-file ops/.env.docker -f ops/docker-compose.yml ps --format 'table {{.Service}}\t{{.Status}}'
