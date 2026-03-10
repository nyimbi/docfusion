#!/bin/bash
# ============================================================================
# DocuFusion Monitoring Setup Script
# Run after 05-deploy-scrapers.sh
# ============================================================================

set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-docfusion}"
DOMAIN="${DOMAIN:-docfusion.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 1. Install Prometheus Node Exporter
# ============================================================================

log_info "Installing Prometheus Node Exporter..."

# Create prometheus user
useradd --no-create-home --shell /bin/false prometheus || true

# Download and install
NODE_EXPORTER_VERSION="1.7.0"
cd /tmp
wget "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
tar xvf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
cp "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter" /usr/local/bin/
chown prometheus:prometheus /usr/local/bin/node_exporter

# Cleanup
rm -rf "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64"*

# Create systemd service
cat > /etc/systemd/system/node_exporter.service << 'EOF'
[Unit]
Description=Prometheus Node Exporter
Documentation=https://prometheus.io/docs/guides/node-exporter/
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/node_exporter \
    --collector.systemd \
    --collector.processes \
    --web.listen-address=127.0.0.1:9100

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable node_exporter
systemctl start node_exporter

log_info "Node Exporter running on http://localhost:9100/metrics"

# ============================================================================
# 2. Create Health Check Script
# ============================================================================

log_info "Creating health check scripts..."

mkdir -p /opt/docfusion/monitoring

cat > /opt/docfusion/monitoring/health-check.sh << 'EOF'
#!/bin/bash
# DocuFusion Health Check Script
set -e

# Configuration
DOMAIN="${DOMAIN:-localhost}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
LOG_FILE="/var/log/docfusion/health.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} $1" | tee -a "${LOG_FILE}"
}

check_service() {
    local service=$1
    if systemctl is-active --quiet "${service}"; then
        log "${GREEN}✓${NC} ${service}: running"
        return 0
    else
        log "${RED}✗${NC} ${service}: stopped"
        return 1
    fi
}

check_http() {
    local url=$1
    local name=$2
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "${url}" 2>/dev/null || echo "000")

    if [ "${response}" = "200" ]; then
        log "${GREEN}✓${NC} ${name}: OK (${response})"
        return 0
    else
        log "${RED}✗${NC} ${name}: FAILED (${response})"
        return 1
    fi
}

check_database() {
    if pg_isready -q -h localhost -p 5432; then
        log "${GREEN}✓${NC} PostgreSQL: accepting connections"
        return 0
    else
        log "${RED}✗${NC} PostgreSQL: not accepting connections"
        return 1
    fi
}

check_disk_space() {
    local threshold=90
    local usage
    usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')

    if [ "${usage}" -lt "${threshold}" ]; then
        log "${GREEN}✓${NC} Disk space: ${usage}% used"
        return 0
    else
        log "${RED}✗${NC} Disk space: ${usage}% used (threshold: ${threshold}%)"
        return 1
    fi
}

check_memory() {
    local threshold=90
    local usage
    usage=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')

    if [ "${usage}" -lt "${threshold}" ]; then
        log "${GREEN}✓${NC} Memory: ${usage}% used"
        return 0
    else
        log "${YELLOW}!${NC} Memory: ${usage}% used (threshold: ${threshold}%)"
        return 0  # Warning only
    fi
}

# Run checks
ERRORS=0

log "=== Health Check: $(date) ==="

check_service docfusion || ((ERRORS++))
check_service nginx || ((ERRORS++))
check_service postgresql || ((ERRORS++))
check_service pgbouncer || ((ERRORS++))
check_service node_exporter || ((ERRORS++))

check_http "http://localhost:3000/health" "Application" || ((ERRORS++))
check_http "https://${DOMAIN}/health" "Public Site" || ((ERRORS++))

check_database || ((ERRORS++))
check_disk_space || ((ERRORS++))
check_memory

log "=== Check Complete: ${ERRORS} errors ==="

# Send webhook notification if configured and errors found
if [ -n "${WEBHOOK_URL}" ] && [ "${ERRORS}" -gt 0 ]; then
    curl -s -X POST "${WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"⚠️ DocuFusion Health Check: ${ERRORS} issues detected on ${DOMAIN}\"}" \
        > /dev/null || true
fi

exit ${ERRORS}
EOF

chmod +x /opt/docfusion/monitoring/health-check.sh
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /opt/docfusion/monitoring

# ============================================================================
# 3. Create Scraper Status Check Script
# ============================================================================

log_info "Creating scraper status script..."

cat > /opt/docfusion/monitoring/scraper-status.sh << 'EOF'
#!/bin/bash
# DocuFusion Scraper Status Check
set -e

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1"
}

check_scraper_runs() {
    local tier=$1
    local timer="docfusion-scraper-tier${tier}.timer"
    local service="docfusion-scraper-tier${tier}.service"

    # Check last run
    local last_run
    last_run=$(systemctl show --property=LastTriggerUSec "${timer}" 2>/dev/null | cut -d= -f2)

    # Check if running
    if systemctl is-active --quiet "${service}"; then
        log "Tier ${tier}: RUNNING"
        return 0
    fi

    # Check timer status
    if systemctl is-active --quiet "${timer}"; then
        local next_run
        next_run=$(systemctl show --property=NextElapseUSecRealtime "${timer}" 2>/dev/null | cut -d= -f2)
        log "Tier ${tier}: SCHEDULED (next: ${next_run})"
        return 0
    else
        log "Tier ${tier}: STOPPED"
        return 1
    fi
}

log "=== Scraper Status ==="

for tier in 1 2 3; do
    check_scraper_runs "${tier}"
done

log "====================="
EOF

chmod +x /opt/docfusion/monitoring/scraper-status.sh

# ============================================================================
# 4. Create Monitoring Cron Jobs
# ============================================================================

log_info "Setting up monitoring cron jobs..."

cat > /etc/cron.d/docfusion-monitoring << EOF
# DocuFusion Monitoring Cron Jobs

# Health check every 5 minutes
*/5 * * * * root /opt/docfusion/monitoring/health-check.sh >> /var/log/docfusion/health.log 2>&1

# Scraper status check every hour
0 * * * * root /opt/docfusion/monitoring/scraper-status.sh >> /var/log/docfusion/scraper-status.log 2>&1

# Clean old logs weekly
0 0 * * 0 root find /var/log/docfusion -name "*.log" -mtime +30 -delete

# Database vacuum weekly
0 3 * * 0 postgres vacuumdb -a -z >> /var/log/postgresql/vacuum.log 2>&1
EOF

chmod 644 /etc/cron.d/docfusion-monitoring

# ============================================================================
# 5. Create Log Aggregation Directory
# ============================================================================

log_info "Setting up log directories..."

mkdir -p /var/log/docfusion/{app,scrapers,monitoring}
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /var/log/docfusion

# Create log rotation config
cat > /etc/logrotate.d/docfusion << 'EOF'
/var/log/docfusion/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 docfusion docfusion
    sharedscripts
    postrotate
        systemctl reload docfusion >/dev/null 2>&1 || true
    endscript
}

/var/log/docfusion/*/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 docfusion docfusion
}
EOF

# ============================================================================
# 6. Create Alerting Script
# ============================================================================

log_info "Creating alerting script..."

cat > /opt/docfusion/monitoring/send-alert.sh << 'EOF'
#!/bin/bash
# DocuFusion Alerting Script
# Sends alerts to configured channels (Slack, email, etc.)

SUBJECT="${1:-Alert}"
MESSAGE="${2:-No details provided}"
SEVERITY="${3:-warning}"

# Configuration (override in /opt/docfusion/.env.alerts)
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_RECIPIENT="${EMAIL_RECIPIENT:-}"

# Load environment if exists
[ -f /opt/docfusion/.env.alerts ] && source /opt/docfusion/.env.alerts

# Send Slack notification
send_slack() {
    local color
    case "${SEVERITY}" in
        critical) color="danger" ;;
        warning)  color="warning" ;;
        info)     color="good" ;;
        *)        color="warning" ;;
    esac

    if [ -n "${SLACK_WEBHOOK}" ]; then
        curl -s -X POST "${SLACK_WEBHOOK}" \
            -H "Content-Type: application/json" \
            -d "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"DocuFusion: ${SUBJECT}\",
                    \"text\": \"${MESSAGE}\",
                    \"footer\": \"$(hostname)\",
                    \"ts\": $(date +%s)
                }]
            }" > /dev/null
    fi
}

# Send email notification
send_email() {
    if [ -n "${EMAIL_RECIPIENT}" ]; then
        echo "${MESSAGE}" | mail -s "DocuFusion ${SEVERITY^^}: ${SUBJECT}" "${EMAIL_RECIPIENT}"
    fi
}

# Send alerts
send_slack
send_email

echo "$(date '+%Y-%m-%d %H:%M:%S') [${SEVERITY}] ${SUBJECT}: ${MESSAGE}" >> /var/log/docfusion/alerts.log
EOF

chmod +x /opt/docfusion/monitoring/send-alert.sh

# Create alerts environment template
cat > /opt/docfusion/.env.alerts.example << 'EOF'
# Alert Configuration
# Copy to .env.alerts and configure

# Slack Webhook URL
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Email recipient for alerts
EMAIL_RECIPIENT="admin@example.com"
EOF

# ============================================================================
# 7. Install Additional Monitoring Tools
# ============================================================================

log_info "Installing monitoring tools..."

apt-get install -y \
    iotop \
    nethogs \
    htop \
    ncdu \
    jq

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "Monitoring Setup Complete!"
log_info "============================================"
log_info ""
log_info "Monitoring components:"
log_info "  - Node Exporter: http://localhost:9100/metrics"
log_info "  - Health check: /opt/docfusion/monitoring/health-check.sh"
log_info "  - Scraper status: /opt/docfusion/monitoring/scraper-status.sh"
log_info "  - Alerting: /opt/docfusion/monitoring/send-alert.sh"
log_info ""
log_info "Cron jobs installed:"
log_info "  - Health check: every 5 minutes"
log_info "  - Scraper status: every hour"
log_info "  - Log cleanup: weekly"
log_info "  - Database vacuum: weekly"
log_info ""
log_info "To configure alerts:"
log_info "  cp /opt/docfusion/.env.alerts.example /opt/docfusion/.env.alerts"
log_info "  # Edit .env.alerts with your webhook URLs"
log_info ""
log_info "Test commands:"
log_info "  /opt/docfusion/monitoring/health-check.sh"
log_info "  /opt/docfusion/monitoring/scraper-status.sh"
log_info ""
log_info "Deployment complete! Access your application at https://${DOMAIN}"