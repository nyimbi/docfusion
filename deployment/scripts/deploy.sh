#!/usr/bin/env bash
# DocFusion deploy script — rsync + systemd, no Docker, no nginx
# Usage:
#   ./deploy.sh [server] [action]
#
#   server   spare-2 (default) | datacraft-ours
#   action   sync     — rsync code only
#            build    — uv sync + npm build on server (no restart)
#            install  — first-time: sync + build + install units + enable + start
#            deploy   — subsequent: sync + build + restart (default)
#            restart  — restart services without sync
#            status   — show service status
#            logs     — tail journals (Ctrl-C to stop)
#            timers   — show timer schedule and last/next run
#            shell    — open SSH shell
#
# Requires: rsync, ssh, ~/.ssh/id_rsa with access to the target host.

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────
APP_DIR="/root/docfusion"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }
step()  { echo -e "\n${CYAN}──▶${NC} $*\n"; }

SERVER="${1:-spare-2}"
ACTION="${2:-deploy}"

# bash 3.2-safe server→host lookup (no associative arrays)
case "$SERVER" in
    spare-2)        HOST_IP="161.97.124.202" ;;
    datacraft-ours) HOST_IP="37.60.225.7" ;;
    *) die "Unknown server '$SERVER'. Known: spare-2, datacraft-ours" ;;
esac
REMOTE="root@${HOST_IP}"

ssh_cmd() { ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE" "$@"; }

# ── Actions ────────────────────────────────────────────────────────────────

do_sync() {
    step "Syncing code → $REMOTE:$APP_DIR"
    rsync -az --delete \
        --exclude='.git' \
        --exclude='.venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='/storage/documents' \
        --exclude='/storage/indexes' \
        --exclude='/storage/search' \
        --exclude='intelligence_storage/data' \
        --exclude='/.env' \
        --exclude='/.env.*' \
        --exclude='/deployment/.env.*' \
        --exclude='/frontend/.env*' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
        "$LOCAL_ROOT/" "$REMOTE:$APP_DIR/"
    info "Sync complete."
}

do_bootstrap_uv() {
    step "Bootstrapping uv on $REMOTE"
    ssh_cmd bash -euo pipefail << 'REMOTE'
if ! command -v uv &>/dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # astral installer puts uv in ~/.local/bin — add to PATH for this session
    export PATH="$HOME/.local/bin:$PATH"
fi
uv --version
REMOTE
}

do_build() {
    step "Building on $REMOTE"
    ssh_cmd bash -euo pipefail << 'REMOTE'
export PATH="$HOME/.local/bin:$PATH"
cd /root/docfusion

echo "── Python deps (uv sync) ──"
uv sync --frozen

echo "── Frontend (npm ci + build) ──"
cd frontend
npm ci --prefer-offline --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=4096 npm run build
cd ..

echo "── Build complete ──"
REMOTE
}

do_migrate() {
    step "Running DB migrations on $REMOTE"
    ssh_cmd bash -euo pipefail << 'REMOTE'
export PATH="$HOME/.local/bin:$PATH"
cd /root/docfusion

# Load DATABASE_URL from .env for drizzle
if [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a; source .env; set +a
fi

echo "── Alembic upgrade head ──"
if [ -f alembic.ini ]; then
    uv run alembic -c alembic.ini upgrade head || echo "⚠  Alembic failed (non-fatal)"
else
    echo "⚠  alembic.ini not found; skipping"
fi

echo "── Drizzle migrations (frontend/drizzle) ──"
cd frontend
if [ -d drizzle ] && [ -n "${DATABASE_URL:-}" ]; then
    DATABASE_URL="$DATABASE_URL" npx drizzle-kit migrate || echo "⚠  drizzle-kit migrate failed"
else
    echo "⚠  drizzle dir or DATABASE_URL missing; skipping"
fi
cd ..

echo "── Migrations complete ──"
REMOTE
}

do_install_redis() {
    step "Installing Redis on $REMOTE (if missing)"
    ssh_cmd bash -euo pipefail << 'REMOTE'
if ! command -v redis-server &>/dev/null; then
    echo "Installing redis-server..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server
fi
systemctl enable --now redis-server
redis-cli ping
REMOTE
}

do_install_units() {
    step "Installing systemd units"
    ssh_cmd bash -euo pipefail << 'REMOTE'
cd /root/docfusion

cp deployment/systemd/docfusion-api.service          /etc/systemd/system/
cp deployment/systemd/docfusion-frontend.service      /etc/systemd/system/
cp deployment/systemd/docfusion-daily-crawl.service   /etc/systemd/system/
cp deployment/systemd/docfusion-daily-crawl.timer     /etc/systemd/system/
cp deployment/systemd/docfusion-digest.service        /etc/systemd/system/
cp deployment/systemd/docfusion-digest.timer          /etc/systemd/system/
cp deployment/systemd/docfusion-memory-cleanup.service /etc/systemd/system/
cp deployment/systemd/docfusion-memory-cleanup.timer  /etc/systemd/system/

systemctl daemon-reload
echo "Units installed and daemon reloaded."
REMOTE
}

do_enable() {
    step "Enabling and starting all services"
    ssh_cmd bash -euo pipefail << 'REMOTE'
systemctl enable --now docfusion-api
systemctl enable --now docfusion-frontend
systemctl enable --now docfusion-daily-crawl.timer
systemctl enable --now docfusion-digest.timer
systemctl enable --now docfusion-memory-cleanup.timer
echo "All services enabled and started."
REMOTE
}

do_restart() {
    step "Restarting app services on $REMOTE"
    ssh_cmd bash -euo pipefail << 'REMOTE'
systemctl daemon-reload
systemctl restart docfusion-api
systemctl restart docfusion-frontend
echo "Restarted docfusion-api and docfusion-frontend."
REMOTE
}

do_status() {
    ssh_cmd bash << 'REMOTE'
echo "=== Services ==="
systemctl status docfusion-api      --no-pager -l 2>&1 | head -8
systemctl status docfusion-frontend --no-pager -l 2>&1 | head -8
echo ""
echo "=== Timers ==="
systemctl list-timers docfusion-* --no-pager 2>&1
REMOTE
}

do_logs() {
    ssh_cmd journalctl -f \
        -u docfusion-api \
        -u docfusion-frontend \
        -u docfusion-daily-crawl \
        -u docfusion-digest \
        -u docfusion-memory-cleanup \
        -n 50
}

do_timers() {
    ssh_cmd systemctl list-timers 'docfusion-*' --no-pager
}

do_shell() {
    exec ssh -i "$SSH_KEY" "$REMOTE"
}

check_env() {
    ssh_cmd test -f "$APP_DIR/.env" \
        || warn ".env not found at $APP_DIR/.env on $REMOTE — create it before starting services."
}

# ── Dispatch ───────────────────────────────────────────────────────────────

case "$ACTION" in
    sync)
        do_sync ;;
    build)
        do_build ;;
    install)
        info "First-time install on $SERVER (${HOST_IP})"
        check_env
        do_sync
        do_bootstrap_uv
        do_install_redis
        do_build
        do_migrate
        do_install_units
        do_enable
        info "Install complete. Run './deploy.sh $SERVER status' to verify." ;;
    deploy|update)
        info "Deploying to $SERVER (${HOST_IP})"
        do_sync
        do_build
        do_migrate
        do_install_units
        do_restart
        info "Deploy complete. Run './deploy.sh $SERVER status' to verify." ;;
    migrate)
        do_migrate ;;
    redis)
        do_install_redis ;;
    restart)
        do_restart ;;
    status)
        do_status ;;
    logs)
        do_logs ;;
    timers)
        do_timers ;;
    shell)
        do_shell ;;
    *)
        die "Unknown action '$ACTION'. Valid: sync build install deploy migrate redis restart status logs timers shell" ;;
esac
