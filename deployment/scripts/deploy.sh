#!/bin/bash
# ============================================================================
# DocuFusion Master Deployment Script
# Orchestrates all deployment steps
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}==>${NC} $1\n"; }

# Configuration
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEP="${1:-all}"
DOMAIN="${DOMAIN:-docfusion.com}"
DEPLOY_USER="${DEPLOY_USER:-docfusion}"

show_help() {
    cat << 'EOF'
DocuFusion Deployment Script

Usage: deploy.sh [step|all]

Steps:
  1 or vps       Configure base VPS (updates, firewall, user)
  2 or postgres  Install and configure PostgreSQL
  3 or nginx     Install Nginx with SSL
  4 or app       Deploy Next.js application
  5 or scrapers  Deploy scraper systemd timers
  6 or monitor   Set up monitoring and alerting
  all            Run all steps in sequence

Environment Variables:
  DOMAIN         Domain name (default: docfusion.com)
  DEPLOY_USER    Deployment user (default: docfusion)
  DB_NAME        Database name (default: docfusion)
  DB_USER        Database user (default: docfusion)
  DB_PASSWORD    Database password (auto-generated if not set)
  REPO_URL       Git repository URL
  BRANCH         Git branch (default: main)

Examples:
  ./deploy.sh all              # Full deployment
  ./deploy.sh vps              # Only configure VPS
  ./deploy.sh app              # Only deploy application
  DOMAIN=myapp.com ./deploy.sh all  # Custom domain

Prerequisites:
  - Fresh Ubuntu 22.04/24.04 server
  - Root or sudo access
  - SSH key for authentication

Order of execution:
  1. VPS configuration (run once)
  2. PostgreSQL installation
  3. Nginx with SSL
  4. Application deployment
  5. Scraper timers
  6. Monitoring setup
EOF
}

run_step() {
    local step=$1
    local script

    case $step in
        1|vps)
            script="01-configure-vps.sh"
            ;;
        2|postgres|postgresql|db)
            script="02-install-postgresql.sh"
            ;;
        3|nginx)
            script="03-install-nginx.sh"
            ;;
        4|app|application)
            script="04-deploy-app.sh"
            ;;
        5|scrapers|scraper)
            script="05-deploy-scrapers.sh"
            ;;
        6|monitor|monitoring)
            script="06-setup-monitoring.sh"
            ;;
        *)
            log_error "Unknown step: $step"
            show_help
            exit 1
            ;;
    esac

    if [ -f "${SCRIPTS_DIR}/${script}" ]; then
        log_step "Running: ${script}"
        chmod +x "${SCRIPTS_DIR}/${script}"
        "${SCRIPTS_DIR}/${script}"
    else
        log_error "Script not found: ${SCRIPTS_DIR}/${script}"
        exit 1
    fi
}

run_all() {
    log_info "Starting full deployment..."
    log_info "Domain: ${DOMAIN}"
    log_info "User: ${DEPLOY_USER}"
    log_info ""

    for step in 1 2 3 4 5 6; do
        run_step $step
    done

    log_step "Deployment Complete!"
    log_info "Application URL: https://${DOMAIN}"
    log_info ""
    log_info "Next steps:"
    log_info "1. Configure DNS records for ${DOMAIN}"
    log_info "2. Generate SSL certificates: certbot --nginx -d ${DOMAIN}"
    log_info "3. Configure alerts: cp /opt/docfusion/.env.alerts.example /opt/docfusion/.env.alerts"
    log_info "4. Test scrapers: docfusion-scraper all run"
}

# Main
if [ "${STEP}" = "-h" ] || [ "${STEP}" = "--help" ]; then
    show_help
    exit 0
fi

if [ "${STEP}" = "all" ]; then
    run_all
else
    run_step "${STEP}"
fi