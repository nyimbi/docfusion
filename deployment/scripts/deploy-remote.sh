#!/bin/bash
# ============================================================================
# DocuFusion Remote Deployment Script
# Deploys to configured servers via SSH
# ============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVERS_CONFIG="${SCRIPT_DIR}/../servers.yaml"
LOCAL_REPO="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}==>${NC} $1\n"; }
log_server() { echo -e "${CYAN}[SERVER]${NC} $1"; }

# Server definitions
declare -A SERVERS
SERVERS["datacraft"]="root@84.247.166.219"
SERVERS["datacraft-ours"]="root@84.247.166.219"

# Domain mapping
declare -A DOMAINS
DOMAINS["datacraft"]="ours.datacraft.systems"
DOMAINS["datacraft-ours"]="ours.datacraft.systems"

show_help() {
    cat << 'EOF'
DocuFusion Remote Deployment Script

Usage: deploy-remote.sh [server] [action] [options]

Servers:
  azure-primary    Primary Azure VPS (20.84.71.33)
  datacraft        DataCraft Systems (84.247.166.219 / docfusion.datacraft.systems)
  datacraft-ours   Alias for datacraft
  all              Deploy to all servers

Actions:
  setup            Initial server setup (run 01-configure-vps.sh)
  deploy           Deploy/update application
  status           Check service status
  logs             View logs (follow mode)
  restart          Restart services
  shell            Open SSH shell
  sync             Sync local code to server
  full             Full deployment (setup + deploy)

Options:
  --branch BRANCH  Git branch (default: main)
  --dry-run        Show commands without executing
  --verbose        Verbose output

Environment Variables:
  SSH_KEY          SSH private key path (default: ~/.ssh/id_rsa)
  BRANCH           Git branch (default: main)

Examples:
  # Deploy to DataCraft server
  ./deploy-remote.sh datacraft deploy

  # Deploy to all servers
  ./deploy-remote.sh all deploy

  # Initial setup on new server
  ./deploy-remote.sh datacraft setup

  # Check status
  ./deploy-remote.sh datacraft status

  # View logs
  ./deploy-remote.sh datacraft logs

  # Deploy specific branch
  BRANCH=feature-branch ./deploy-remote.sh datacraft deploy

  # Sync local changes
  ./deploy-remote.sh datacraft sync
EOF
}

# ============================================================================
# Helper Functions
# ============================================================================

ssh_cmd() {
    local server=$1
    shift
    local host="${SERVERS[$server]}"
    local ssh_key="${SSH_KEY:-~/.ssh/id_rsa}"

    if [ "${DRY_RUN:-false}" = "true" ]; then
        echo "[DRY-RUN] ssh -i ${ssh_key} ${host} $*"
    else
        ssh -i "${ssh_key}" -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new "$host" "$@"
    fi
}

rsync_to_server() {
    local server=$1
    local src=$2
    local dest=$3
    local host="${SERVERS[$server]}"
    local ssh_key="${SSH_KEY:-~/.ssh/id_rsa}"

    if [ "${DRY_RUN:-false}" = "true" ]; then
        echo "[DRY-RUN] rsync -avz -e 'ssh -i ${ssh_key}' ${src} ${host}:${dest}"
    else
        rsync -avz -e "ssh -i ${ssh_key}" "$src" "${host}:${dest}"
    fi
}

get_domain() {
    local server=$1
    echo "${DOMAINS[$server]}"
}

# ============================================================================
# Actions
# ============================================================================

do_setup() {
    local server=$1
    local host="${SERVERS[$server]}"
    local domain=$(get_domain "$server")

    log_step "Setting up server: ${server} (${host})"
    log_info "Domain: ${domain}"

    # Copy deployment scripts
    log_info "Copying deployment scripts..."
    rsync_to_server "$server" "${SCRIPT_DIR}/" "/tmp/deployment/"

    # Run VPS configuration
    log_info "Running VPS configuration..."
    ssh_cmd "$server" "cd /tmp/deployment && chmod +x *.sh && DOMAIN=${domain} ./01-configure-vps.sh"

    log_info "Setup complete for ${server}"
    log_info "Next steps:"
    log_info "  1. Run: ./deploy-remote.sh ${server} deploy"
}

do_deploy() {
    local server=$1
    local branch="${BRANCH:-main}"
    local host="${SERVERS[$server]}"
    local domain=$(get_domain "$server")
    local deploy_user="docfusion"

    log_step "Deploying to: ${server} (${host})"
    log_info "Branch: ${branch}"
    log_info "Domain: ${domain}"

    # Copy deployment scripts
    log_info "Copying deployment scripts..."
    rsync_to_server "$server" "${SCRIPT_DIR}/" "/tmp/deployment/"

    # Run deployment steps
    log_info "Running deployment steps..."

    ssh_cmd "$server" << EOF
set -e
cd /tmp/deployment
chmod +x *.sh

# Set environment
export DOMAIN="${domain}"
export DEPLOY_USER="${deploy_user}"
export BRANCH="${branch}"
export REPO_URL="${REPO_URL:-https://github.com/your-org/docfusion.git}"

# Run deployment steps (skip VPS config if already done)
./02-install-postgresql.sh || true
./03-install-nginx.sh || true
./04-deploy-app.sh
./05-deploy-scrapers.sh
./06-setup-monitoring.sh || true

echo "Deployment complete!"
EOF

    log_info "Deployed to ${server}"
    log_info "URL: https://${domain}"
}

do_status() {
    local server=$1
    local host="${SERVERS[$server]}"
    local domain=$(get_domain "$server")

    log_step "Status for: ${server} (${host})"

    ssh_cmd "$server" << 'EOF'
echo "=== System Status ==="
uptime
echo ""

echo "=== Services ==="
systemctl status docfusion --no-pager || true
echo ""

echo "=== Scrapers ==="
systemctl list-timers --no-pager | grep scraper || echo "No scraper timers"
echo ""

echo "=== Database ==="
systemctl status postgresql --no-pager || true
echo ""

echo "=== Disk Usage ==="
df -h /opt/docfusion 2>/dev/null || df -h /
echo ""

echo "=== Memory ==="
free -h
EOF
}

do_logs() {
    local server=$1
    local host="${SERVERS[$server]}"

    log_step "Logs for: ${server} (${host})"
    log_info "Press Ctrl+C to exit"

    ssh_cmd "$server" "journalctl -u docfusion -f"
}

do_restart() {
    local server=$1
    local host="${SERVERS[$server]}"

    log_step "Restarting services on: ${server}"

    ssh_cmd "$server" << 'EOF'
echo "Restarting DocuFusion..."
systemctl restart docfusion

echo "Waiting for service..."
sleep 5

if systemctl is-active --quiet docfusion; then
    echo "✅ DocuFusion restarted successfully"
else
    echo "❌ DocuFusion failed to start"
    journalctl -u docfusion -n 20
    exit 1
fi
EOF
}

do_shell() {
    local server=$1
    local host="${SERVERS[$server]}"
    local ssh_key="${SSH_KEY:-~/.ssh/id_rsa}"

    log_info "Opening shell on ${server}..."
    ssh -i "${ssh_key}" "$host"
}

do_sync() {
    local server=$1
    local host="${SERVERS[$server]}"

    log_step "Syncing local code to: ${server}"

    # Sync frontend
    log_info "Syncing frontend..."
    rsync_to_server "$server" "${LOCAL_REPO}/frontend/" "/opt/docfusion/app/frontend/"

    # Sync backend
    log_info "Syncing backend..."
    rsync_to_server "$server" "${LOCAL_REPO}/backend/" "/opt/docfusion/backend/"

    # Restart services
    log_info "Restarting services..."
    ssh_cmd "$server" "systemctl restart docfusion"

    log_info "Sync complete"
}

do_full() {
    local server=$1

    log_step "Full deployment to: ${server}"

    do_setup "$server"
    do_deploy "$server"

    log_info "Full deployment complete for ${server}"
}

# ============================================================================
# Main
# ============================================================================

# Parse arguments
if [ $# -lt 1 ]; then
    show_help
    exit 1
fi

SERVER="${1:-all}"
ACTION="${2:-status}"
shift 2 2>/dev/null || true

# Parse options
DRY_RUN="false"
VERBOSE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --verbose|-v)
            VERBOSE="true"
            shift
            ;;
        --branch|-b)
            BRANCH="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Validate server
if [ "$SERVER" != "all" ] && [ -z "${SERVERS[$SERVER]:-}" ]; then
    log_error "Unknown server: ${SERVER}"
    log_info "Available servers: ${!SERVERS[*]}"
    exit 1
fi

# Execute
case $ACTION in
    setup)
        if [ "$SERVER" = "all" ]; then
            for s in "${!SERVERS[@]}"; do
                do_setup "$s"
            done
        else
            do_setup "$SERVER"
        fi
        ;;
    deploy)
        if [ "$SERVER" = "all" ]; then
            for s in "${!SERVERS[@]}"; do
                do_deploy "$s"
            done
        else
            do_deploy "$SERVER"
        fi
        ;;
    status)
        if [ "$SERVER" = "all" ]; then
            for s in "${!SERVERS[@]}"; do
                do_status "$s"
            done
        else
            do_status "$SERVER"
        fi
        ;;
    logs)
        do_logs "$SERVER"
        ;;
    restart)
        do_restart "$SERVER"
        ;;
    shell|ssh)
        do_shell "$SERVER"
        ;;
    sync)
        do_sync "$SERVER"
        ;;
    full)
        do_full "$SERVER"
        ;;
    *)
        log_error "Unknown action: ${ACTION}"
        show_help
        exit 1
        ;;
esac