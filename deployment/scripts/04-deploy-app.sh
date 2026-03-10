#!/bin/bash
# ============================================================================
# DocuFusion Application Deployment Script
# Run after 03-install-nginx.sh
# ============================================================================

set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-docfusion}"
APP_DIR="/opt/docfusion/app"
REPO_URL="${REPO_URL:-https://github.com/your-org/docfusion.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-docfusion.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# 1. Clone Repository
# ============================================================================

log_info "Cloning repository..."

# Clone or update repository
if [ -d "${APP_DIR}/.git" ]; then
    log_info "Repository exists, updating..."
    cd "${APP_DIR}"
    git fetch origin
    git reset --hard "origin/${BRANCH}"
else
    log_info "Cloning fresh repository..."
    rm -rf "${APP_DIR}"
    mkdir -p "${APP_DIR}"
    git clone -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    cd "${APP_DIR}"
fi

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

# ============================================================================
# 2. Install Dependencies
# ============================================================================

log_info "Installing dependencies..."

cd "${APP_DIR}/frontend"

# Install Node.js dependencies
npm ci

# ============================================================================
# 3. Create Environment File
# ============================================================================

log_info "Creating environment file..."

# Check if database credentials exist
if [ -f "/opt/docfusion/.env.database" ]; then
    source /opt/docfusion/.env.database
fi

cat > "${APP_DIR}/frontend/.env.production" << EOF
# Application
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Database (from .env.database)
DATABASE_URL="${DATABASE_URL:-postgresql://docfusion:password@localhost:6432/docfusion}"

# Authentication
NEXTAUTH_URL="https://${DOMAIN}"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# AI Services (configure as needed)
# OPENAI_API_KEY=""
# ANTHROPIC_API_KEY=""

# Scraper Configuration
SCRAPER_USER_AGENT="DocuFusion/1.0 (contact@${DOMAIN})"
SCRAPER_RATE_LIMIT="1.0"

# Logging
LOG_LEVEL="info"
EOF

chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/frontend/.env.production"
chmod 600 "${APP_DIR}/frontend/.env.production"

# ============================================================================
# 4. Build Application
# ============================================================================

log_info "Building application..."

cd "${APP_DIR}/frontend"
npm run build

# ============================================================================
# 5. Create Systemd Service
# ============================================================================

log_info "Creating systemd service..."

cat > /etc/systemd/system/docfusion.service << 'EOF'
[Unit]
Description=DocuFusion Next.js Application
Documentation=https://docfusion.com/docs
After=network.target postgresql.service pgbouncer.service

[Service]
Type=simple
User=docfusion
Group=docfusion
WorkingDirectory=/opt/docfusion/app/frontend
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
EnvironmentFile=/opt/docfusion/app/frontend/.env.production

ExecStart=/usr/bin/node /opt/docfusion/app/frontend/node_modules/.bin/next start
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/docfusion/app/frontend/.next /opt/docfusion/logs
ReadOnlyPaths=/

# Resource limits
LimitNOFILE=65535
MemoryMax=2G
TasksMax=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=docfusion

[Install]
WantedBy=multi-user.target
EOF

# ============================================================================
# 6. Create Deployment Helper Script
# ============================================================================

log_info "Creating deployment helper..."

cat > /usr/local/bin/docfusion-deploy << 'DEPLOY_SCRIPT'
#!/bin/bash
# DocuFusion Deployment Helper
set -e

APP_DIR="/opt/docfusion/app"
BRANCH="${1:-main}"

echo "Deploying DocuFusion (branch: ${BRANCH})..."

cd "${APP_DIR}"

# Pull latest code
git fetch origin
git reset --hard "origin/${BRANCH}"

# Install dependencies
cd frontend
npm ci

# Build
npm run build

# Restart service
sudo systemctl restart docfusion

# Wait for service to be ready
echo "Waiting for service to start..."
sleep 5

# Check status
if systemctl is-active --quiet docfusion; then
    echo "✅ Deployment successful!"
    echo "Application running on https://${DOMAIN}"
else
    echo "❌ Deployment failed!"
    journalctl -u docfusion --no-pager -n 50
    exit 1
fi
DEPLOY_SCRIPT

chmod +x /usr/local/bin/docfusion-deploy

# ============================================================================
# 7. Enable and Start Service
# ============================================================================

log_info "Starting DocuFusion service..."

systemctl daemon-reload
systemctl enable docfusion
systemctl start docfusion

# Wait for service to start
sleep 5

# Check status
if systemctl is-active --quiet docfusion; then
    log_info "DocuFusion service is running"
else
    log_error "DocuFusion service failed to start"
    journalctl -u docfusion --no-pager -n 50
    exit 1
fi

# ============================================================================
# 8. Verify Application
# ============================================================================

log_info "Verifying application..."

# Wait for app to be ready
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        log_info "Application health check passed"
        break
    fi
    log_warn "Waiting for application... (${i}/30)"
    sleep 2
done

# Final health check
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    log_info "Application is healthy"
else
    log_warn "Health check returned unexpected response"
fi

# ============================================================================
# Summary
# ============================================================================

log_info "============================================"
log_info "Application Deployment Complete!"
log_info "============================================"
log_info ""
log_info "Application: ${APP_DIR}"
log_info "Branch: ${BRANCH}"
log_info "URL: https://${DOMAIN}"
log_info ""
log_info "Useful commands:"
log_info "  View logs: journalctl -u docfusion -f"
log_info "  Restart: systemctl restart docfusion"
log_info "  Status: systemctl status docfusion"
log_info "  Deploy: docfusion-deploy [branch]"
log_info ""
log_info "Next steps:"
log_info "1. Run: 05-deploy-scrapers.sh"
log_info "2. Configure DNS records for ${DOMAIN}"