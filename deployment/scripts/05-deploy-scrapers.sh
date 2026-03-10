#!/bin/bash
# ============================================================================
# DocuFusion Scraper Deployment Script
# Run after 04-deploy-app.sh
# ============================================================================

set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-docfusion}"
BACKEND_DIR="/opt/docfusion/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 1. Create Backend Directory
# ============================================================================

log_info "Setting up backend directory..."

mkdir -p "${BACKEND_DIR}"
mkdir -p /var/log/docfusion/scrapers

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${BACKEND_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /var/log/docfusion

# ============================================================================
# 2. Copy Scraper Files
# ============================================================================

log_info "Copying scraper files..."

APP_DIR="/opt/docfusion/app"

# Copy backend discovery module
if [ -d "${APP_DIR}/backend/discovery" ]; then
    cp -r "${APP_DIR}/backend/discovery" "${BACKEND_DIR}/"
    log_info "Copied discovery module"
else
    log_warn "Backend discovery module not found in app directory"
    log_info "Creating directory structure..."

    mkdir -p "${BACKEND_DIR}/discovery/scheduler"
    mkdir -p "${BACKEND_DIR}/discovery/scrapers"
    mkdir -p "${BACKEND_DIR}/discovery/sources"
fi

# Copy scraper runner
if [ -f "${APP_DIR}/backend/discovery/scheduler/scraper_runner.py" ]; then
    cp "${APP_DIR}/backend/discovery/scheduler/scraper_runner.py" "${BACKEND_DIR}/discovery/scheduler/"
    log_info "Copied scraper_runner.py"
fi

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${BACKEND_DIR}"

# ============================================================================
# 3. Create Python Virtual Environment
# ============================================================================

log_info "Setting up Python environment..."

cd "${BACKEND_DIR}"

# Create venv
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate

# Install UV in venv
pip install uv

# If pyproject.toml exists, use it
if [ -f "${APP_DIR}/pyproject.toml" ]; then
    cp "${APP_DIR}/pyproject.toml" "${BACKEND_DIR}/"
    uv pip install -e .
else
    # Install minimal dependencies
    uv pip install \
        httpx \
        beautifulsoup4 \
        lxml \
        python-dateutil \
        pydantic \
        rich
fi

deactivate

# ============================================================================
# 4. Create Systemd Timer Files
# ============================================================================

log_info "Creating systemd timer files..."

# Tier 1: High-priority sources (every 6 hours)
cat > /etc/systemd/system/docfusion-scraper-tier1.service << 'EOF'
[Unit]
Description=DocuFusion Tier 1 Scraper (High Priority)
Documentation=https://docfusion.com/docs/scrapers
After=network.target postgresql.service

[Service]
Type=oneshot
User=docfusion
Group=docfusion
WorkingDirectory=/opt/docfusion/backend

Environment="PATH=/opt/docfusion/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="LOG_LEVEL=INFO"

ExecStart=/opt/docfusion/backend/venv/bin/python -m discovery.scheduler.scraper_runner --tier 1

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/log/docfusion /opt/docfusion/backend

# Resource limits
MemoryMax=2G
TasksMax=512
TimeoutStartSec=1800
TimeoutStopSec=60

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scraper-tier1
EOF

cat > /etc/systemd/system/docfusion-scraper-tier1.timer << 'EOF'
[Unit]
Description=Run DocuFusion Tier 1 Scrapers every 6 hours
Documentation=https://docfusion.com/docs/scrapers

[Timer]
OnCalendar=*:0/6:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Tier 2: Medium-priority sources (every 12 hours)
cat > /etc/systemd/system/docfusion-scraper-tier2.service << 'EOF'
[Unit]
Description=DocuFusion Tier 2 Scraper (Medium Priority)
Documentation=https://docfusion.com/docs/scrapers
After=network.target postgresql.service

[Service]
Type=oneshot
User=docfusion
Group=docfusion
WorkingDirectory=/opt/docfusion/backend

Environment="PATH=/opt/docfusion/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="LOG_LEVEL=INFO"

ExecStart=/opt/docfusion/backend/venv/bin/python -m discovery.scheduler.scraper_runner --tier 2

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/log/docfusion /opt/docfusion/backend

# Resource limits
MemoryMax=2G
TasksMax=512
TimeoutStartSec=2400
TimeoutStopSec=60

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scraper-tier2
EOF

cat > /etc/systemd/system/docfusion-scraper-tier2.timer << 'EOF'
[Unit]
Description=Run DocuFusion Tier 2 Scrapers every 12 hours
Documentation=https://docfusion.com/docs/scrapers

[Timer]
OnCalendar=*:0/12:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Tier 3: Low-priority sources (daily)
cat > /etc/systemd/system/docfusion-scraper-tier3.service << 'EOF'
[Unit]
Description=DocuFusion Tier 3 Scraper (Low Priority)
Documentation=https://docfusion.com/docs/scrapers
After=network.target postgresql.service

[Service]
Type=oneshot
User=docfusion
Group=docfusion
WorkingDirectory=/opt/docfusion/backend

Environment="PATH=/opt/docfusion/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="LOG_LEVEL=INFO"

ExecStart=/opt/docfusion/backend/venv/bin/python -m discovery.scheduler.scraper_runner --tier 3

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/log/docfusion /opt/docfusion/backend

# Resource limits
MemoryMax=2G
TasksMax=512
TimeoutStartSec=3600
TimeoutStopSec=60

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scraper-tier3
EOF

cat > /etc/systemd/system/docfusion-scraper-tier3.timer << 'EOF'
[Unit]
Description=Run DocuFusion Tier 3 Scrapers daily
Documentation=https://docfusion.com/docs/scrapers

[Timer]
OnCalendar=daily
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
EOF

# ============================================================================
# 5. Create Scraper Helper Script
# ============================================================================

log_info "Creating scraper helper script..."

cat > /usr/local/bin/docfusion-scraper << 'HELPER'
#!/bin/bash
# DocuFusion Scraper Management Helper
set -e

TIER="${1:-}"
ACTION="${2:-status}"

show_help() {
    echo "DocuFusion Scraper Management"
    echo ""
    echo "Usage: docfusion-scraper <tier|all> <action>"
    echo ""
    echo "Tiers:"
    echo "  1       High-priority sources (every 6h)"
    echo "  2       Medium-priority sources (every 12h)"
    echo "  3       Low-priority sources (daily)"
    echo "  all     All tiers"
    echo ""
    echo "Actions:"
    echo "  status    Show timer/service status"
    echo "  start     Start timer"
    echo "  stop      Stop timer"
    echo "  run       Run scraper immediately"
    echo "  logs      Show recent logs"
    echo "  enable    Enable timer"
    echo "  disable   Disable timer"
    echo ""
    echo "Examples:"
    echo "  docfusion-scraper 1 run      # Run tier 1 immediately"
    echo "  docfusion-scraper all status # Show all tier status"
    echo "  docfusion-scraper 2 logs     # Show tier 2 logs"
}

run_tier() {
    local tier=$1
    local action=$2

    case $action in
        status)
            systemctl status docfusion-scraper-tier${tier}.timer --no-pager
            ;;
        start)
            systemctl start docfusion-scraper-tier${tier}.timer
            echo "Started tier ${tier} timer"
            ;;
        stop)
            systemctl stop docfusion-scraper-tier${tier}.timer
            echo "Stopped tier ${tier} timer"
            ;;
        run)
            echo "Running tier ${tier} scraper..."
            systemctl start docfusion-scraper-tier${tier}.service
            ;;
        logs)
            journalctl -u docfusion-scraper-tier${tier} --no-pager -n 100
            ;;
        enable)
            systemctl enable docfusion-scraper-tier${tier}.timer
            echo "Enabled tier ${tier} timer"
            ;;
        disable)
            systemctl disable docfusion-scraper-tier${tier}.timer
            echo "Disabled tier ${tier} timer"
            ;;
        *)
            echo "Unknown action: $action"
            show_help
            exit 1
            ;;
    esac
}

if [ -z "$TIER" ]; then
    show_help
    exit 0
fi

if [ "$TIER" = "all" ]; then
    for t in 1 2 3; do
        echo "=== Tier $t ==="
        run_tier $t $ACTION
        echo ""
    done
else
    run_tier $TIER $ACTION
fi
HELPER

chmod +x /usr/local/bin/docfusion-scraper

# ============================================================================
# 6. Enable Timers
# ============================================================================

log_info "Enabling scraper timers..."

systemctl daemon-reload

# Enable and start timers
for tier in 1 2 3; do
    systemctl enable docfusion-scraper-tier${tier}.timer
    systemctl start docfusion-scraper-tier${tier}.timer
    log_info "Enabled tier ${tier} timer"
done

# ============================================================================
# 7. Verify Timers
# ============================================================================

log_info "Verifying timer status..."

systemctl list-timers --all | grep docfusion-scraper

# ============================================================================
# 8. Configure Log Rotation
# ============================================================================

log_info "Configuring log rotation..."

cat > /etc/logrotate.d/docfusion-scrapers << 'EOF'
/var/log/docfusion/scrapers/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 docfusion docfusion
    sharedscripts
    postrotate
        systemctl reload docfusion-scraper-tier1.service >/dev/null 2>&1 || true
    endscript
}
EOF

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "Scraper Deployment Complete!"
log_info "============================================"
log_info ""
log_info "Timers installed:"
log_info "  Tier 1: Every 6 hours (high priority)"
log_info "  Tier 2: Every 12 hours (medium priority)"
log_info "  Tier 3: Daily (low priority)"
log_info ""
log_info "Useful commands:"
log_info "  docfusion-scraper all status  # Show all timers"
log_info "  docfusion-scraper 1 run      # Run tier 1 now"
log_info "  docfusion-scraper 2 logs     # View tier 2 logs"
log_info "  journalctl -u scraper-tier1  # View tier 1 logs"
log_info ""
log_info "Next steps:"
log_info "1. Run: 06-setup-monitoring.sh"
log_info "2. Verify scrapers: docfusion-scraper all run"