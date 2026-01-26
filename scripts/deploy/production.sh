#!/usr/bin/env bash
# =============================================================================
# DocFusion - Production Deployment
# =============================================================================
# Builds locally and deploys to production server using rsync and PM2.
# Includes safety checks, backups, and rollback capabilities.
# =============================================================================

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

setup_trap

# =============================================================================
# CONFIGURATION
# =============================================================================
DEPLOY_ENV="production"
REMOTE_HOST="${PRODUCTION_HOST:-20.63.27.56}"
REMOTE_USER="${PRODUCTION_USER:-deploy}"
REMOTE_PORT="${PRODUCTION_SSH_PORT:-22}"
REMOTE_PATH="${PRODUCTION_PATH:-/opt/docfusion-prod}"
APP_PORT="${PRODUCTION_APP_PORT:-10101}"
BACKEND_PORT="${PRODUCTION_BACKEND_PORT:-8000}"
BACKUP_RETENTION="${BACKUP_RETENTION:-5}"

# PM2 app names
PM2_FRONTEND_NAME="docfusion-frontend-prod"
PM2_BACKEND_NAME="docfusion-backend-prod"

# SSH connection string
SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS="-o StrictHostKeyChecking=no -p ${REMOTE_PORT}"

# Safety requirements
REQUIRED_BRANCH="${REQUIRED_BRANCH:-main}"
REQUIRE_CLEAN="${REQUIRE_CLEAN:-true}"

# =============================================================================
# FUNCTIONS
# =============================================================================

show_help() {
	cat <<EOF
DocFusion Production Deployment

Builds locally and deploys to production server.

Usage: $(basename "$0") [command] [options]

Commands:
  deploy      Full deployment with safety checks [default]
  sync        Sync files only (no restart)
  restart     Restart/reload services (zero-downtime)
  stop        Stop all services
  start       Start all services
  status      Show remote service status
  health      Run health checks
  logs        Show remote logs
  rollback    Rollback to previous deployment
  backup      Create a backup of current deployment
  setup       Initial server setup

Options:
  -h, --help         Show this help message
  --skip-tests       Skip running tests (NOT RECOMMENDED)
  --force            Skip safety confirmations
  --dry-run          Show what would be done

Environment Variables:
  PRODUCTION_HOST       Remote host (default: 20.63.27.56)
  PRODUCTION_USER       SSH user (default: deploy)
  PRODUCTION_APP_PORT   Frontend port (default: 10101)

Safety Requirements:
  - Must be on '$REQUIRED_BRANCH' branch
  - Working directory must be clean
  - All tests must pass
  - Manual confirmation required

Examples:
  $(basename "$0")                    # Full deployment
  $(basename "$0") status             # Check production status
  $(basename "$0") rollback           # Rollback to previous version
  $(basename "$0") logs frontend      # View frontend logs
EOF
}

safety_checks() {
	log_step "Running production safety checks"

	# Check branch
	local current_branch
	current_branch=$(get_git_branch)
	log_substep "Checking branch: $current_branch"

	if [[ "$current_branch" != "$REQUIRED_BRANCH" ]]; then
		log_error "Production deployments must be from '$REQUIRED_BRANCH' branch"
		log_error "Current branch: $current_branch"
		exit 1
	fi
	log_success "Branch OK: $current_branch"

	# Check for uncommitted changes
	if [[ "$REQUIRE_CLEAN" == "true" ]]; then
		log_substep "Checking for uncommitted changes"
		if has_uncommitted_changes; then
			log_error "Working directory has uncommitted changes"
			log_error "Commit or stash changes before deploying to production"
			exit 1
		fi
		log_success "Working directory is clean"
	fi

	# Check SSH connectivity
	log_substep "Testing SSH connection"
	if ! ssh $SSH_OPTS "$SSH_TARGET" "echo 'OK'" &>/dev/null; then
		log_error "Cannot connect to production server: $SSH_TARGET"
		exit 1
	fi
	log_success "SSH connection OK"

	log_success "All safety checks passed"
}

confirm_deployment() {
	if [[ "${FORCE:-}" == "true" ]]; then
		return 0
	fi

	echo ""
	echo -e "${YELLOW}${BOLD}⚠️  PRODUCTION DEPLOYMENT ⚠️${NC}"
	echo ""
	echo -e "  ${BOLD}Target:${NC}   ${REMOTE_HOST}:${APP_PORT}"
	echo -e "  ${BOLD}Version:${NC}  ${VERSION}"
	echo -e "  ${BOLD}Branch:${NC}   $(get_git_branch)"
	echo -e "  ${BOLD}Commit:${NC}   $(get_git_sha)"
	echo ""

	read -p "Are you sure you want to deploy to PRODUCTION? [yes/N] " response
	if [[ "$response" != "yes" ]]; then
		log_info "Deployment cancelled"
		exit 0
	fi
}

run_tests() {
	if [[ "${SKIP_TESTS:-}" == "true" ]]; then
		log_warn "Skipping tests (--skip-tests) - NOT RECOMMENDED FOR PRODUCTION"
		return 0
	fi

	log_step "Running test suite"

	log_substep "Running frontend tests"
	cd "$FRONTEND_DIR"
	npm run test -- --run || {
		log_error "Frontend tests failed - deployment aborted"
		exit 1
	}

	log_substep "Running frontend linting"
	npm run lint || {
		log_error "Frontend linting failed - deployment aborted"
		exit 1
	}

	# Python tests (if available)
	if [[ -f "$BACKEND_DIR/pyproject.toml" ]]; then
		log_substep "Running backend tests"
		cd "$BACKEND_DIR"
		uv run pytest -vxs tests/ci || {
			log_error "Backend tests failed - deployment aborted"
			exit 1
		}
	fi

	log_success "All tests passed"
}

install_local_deps() {
	log_step "Installing local dependencies"

	log_substep "Installing frontend dependencies"
	cd "$FRONTEND_DIR"
	npm ci

	log_substep "Installing backend dependencies"
	cd "$BACKEND_DIR"
	if command_exists uv; then
		uv sync
	fi

	log_success "Dependencies installed"
}

create_backup() {
	log_step "Creating backup of current deployment"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
set -e

BACKUP_DIR="${REMOTE_PATH}/backups"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="\${BACKUP_DIR}/backup_\${TIMESTAMP}.tar.gz"

mkdir -p "\$BACKUP_DIR"

if [[ -d "${REMOTE_PATH}/frontend/.next" ]]; then
    echo "Creating backup: \$BACKUP_FILE"
    tar -czf "\$BACKUP_FILE" \
        -C "${REMOTE_PATH}" \
        --exclude='node_modules' \
        --exclude='.venv' \
        --exclude='logs' \
        --exclude='backups' \
        . 2>/dev/null || true

    # Keep only last ${BACKUP_RETENTION} backups
    ls -t "\${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +$((BACKUP_RETENTION + 1)) | xargs -r rm -f

    echo "Backup created: \$BACKUP_FILE"
else
    echo "No existing deployment to backup"
fi
EOF

	log_success "Backup completed"
}

build_frontend() {
	log_step "Building frontend locally for production"

	cd "$FRONTEND_DIR"

	# Create production environment file
	cat > .env.production.local <<EOF
# DocFusion Frontend - Production
NEXT_PUBLIC_API_URL=http://${REMOTE_HOST}:${BACKEND_PORT}
NEXT_PUBLIC_PUSHER_KEY=production-key
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
NEXT_PUBLIC_SOKETI_HOST=${REMOTE_HOST}
NEXT_PUBLIC_SOKETI_PORT=6001
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_AI_COMMANDS=true
NODE_ENV=production
EOF

	# Production build
	NODE_ENV=production npm run build

	log_success "Frontend build completed"
}

create_ecosystem_file() {
	log_step "Creating PM2 ecosystem file"

	cat > "$PROJECT_ROOT/ecosystem.production.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: '${PM2_FRONTEND_NAME}',
      cwd: '${REMOTE_PATH}/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p ${APP_PORT}',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: ${APP_PORT},
      },
      error_file: '${REMOTE_PATH}/logs/frontend-error.log',
      out_file: '${REMOTE_PATH}/logs/frontend-out.log',
      log_file: '${REMOTE_PATH}/logs/frontend-combined.log',
      time: true,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: '${PM2_BACKEND_NAME}',
      cwd: '${REMOTE_PATH}',
      script: '.venv/bin/python',
      args: '-m hypercorn src.docfusion.api.app:app --bind 0.0.0.0:${BACKEND_PORT} --workers 4',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PYTHONUNBUFFERED: '1',
        ENV: 'production',
      },
      error_file: '${REMOTE_PATH}/logs/backend-error.log',
      out_file: '${REMOTE_PATH}/logs/backend-out.log',
      log_file: '${REMOTE_PATH}/logs/backend-combined.log',
      time: true,
      max_memory_restart: '2G',
      exp_backoff_restart_delay: 100,
    },
  ],
};
EOF

	log_success "Ecosystem file created"
}

sync_files() {
	log_step "Syncing built artifacts to production"

	if [[ "${DRY_RUN:-}" == "true" ]]; then
		log_info "DRY RUN - would sync to ${SSH_TARGET}:${REMOTE_PATH}"
		return 0
	fi

	# Create remote directories
	log_substep "Creating remote directories"
	ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p ${REMOTE_PATH}/{frontend,logs,backups}"

	# Sync frontend (including .next build and node_modules)
	log_substep "Syncing frontend with build artifacts"
	rsync -avz --delete --progress \
		--exclude='.git' \
		--exclude='.env.local' \
		--exclude='.env.*.local' \
		--exclude='*.log' \
		-e "ssh $SSH_OPTS" \
		"$FRONTEND_DIR/" \
		"${SSH_TARGET}:${REMOTE_PATH}/frontend/"

	# Sync backend
	log_substep "Syncing backend"
	rsync -avz --delete --progress \
		--exclude='.git' \
		--exclude='frontend' \
		--exclude='node_modules' \
		--exclude='__pycache__' \
		--exclude='.pytest_cache' \
		--exclude='.ruff_cache' \
		--exclude='*.pyc' \
		--exclude='.env.local' \
		--exclude='*.log' \
		--exclude='tests/' \
		--exclude='docs/' \
		--exclude='examples/' \
		--exclude='backups/' \
		-e "ssh $SSH_OPTS" \
		"$PROJECT_ROOT/" \
		"${SSH_TARGET}:${REMOTE_PATH}/"

	# Sync Python virtual environment
	if [[ -d "$PROJECT_ROOT/.venv" ]]; then
		log_substep "Syncing Python virtual environment"
		rsync -avz --delete \
			-e "ssh $SSH_OPTS" \
			"$PROJECT_ROOT/.venv/" \
			"${SSH_TARGET}:${REMOTE_PATH}/.venv/"
	fi

	# Sync ecosystem file
	rsync -avz \
		-e "ssh $SSH_OPTS" \
		"$PROJECT_ROOT/ecosystem.production.config.cjs" \
		"${SSH_TARGET}:${REMOTE_PATH}/"

	log_success "Files synced"
}

reload_services() {
	log_step "Reloading services (zero-downtime)"

	if [[ "${DRY_RUN:-}" == "true" ]]; then
		log_info "DRY RUN - would reload services"
		return 0
	fi

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
set -e

cd ${REMOTE_PATH}

# Create logs directory
mkdir -p logs

# Check if apps exist in PM2
if pm2 describe ${PM2_FRONTEND_NAME} &>/dev/null; then
    echo "Reloading services (zero-downtime)..."
    pm2 reload ecosystem.production.config.cjs --update-env
else
    echo "Starting services for the first time..."
    pm2 start ecosystem.production.config.cjs
fi

# Wait for processes to stabilize
sleep 5

# Save PM2 process list
pm2 save

# Show status
pm2 status
EOF

	log_success "Services reloaded"
}

health_check() {
	log_step "Running production health checks"

	local frontend_url="http://${REMOTE_HOST}:${APP_PORT}"
	local failed=0

	log_substep "Checking frontend at $frontend_url"
	if http_health_check "$frontend_url" 60 3 200; then
		log_success "Frontend is healthy"
	else
		log_error "Frontend health check failed"
		failed=1
	fi

	if [[ $failed -eq 1 ]]; then
		log_error "Health checks failed - consider rolling back"
		return 1
	fi

	return 0
}

do_deploy() {
	log_step "Starting PRODUCTION deployment"
	log_info "Target: ${SSH_TARGET}:${REMOTE_PATH}"
	log_info "Version: $VERSION"

	safety_checks
	confirm_deployment
	run_tests
	install_local_deps
	create_backup
	build_frontend
	create_ecosystem_file
	sync_files
	reload_services

	sleep 10
	if health_check; then
		notify_slack "✅ Production deployment completed: $VERSION" "success"

		echo ""
		log_success "Production deployment completed successfully!"
		echo ""
		echo -e "  ${GREEN}${BOLD}PRODUCTION IS LIVE${NC}"
		echo ""
		echo -e "  ${CYAN}Frontend:${NC}  http://${REMOTE_HOST}:${APP_PORT}"
		echo -e "  ${CYAN}Backend:${NC}   http://${REMOTE_HOST}:${BACKEND_PORT}"
		echo -e "  ${CYAN}Version:${NC}   $VERSION"
		echo ""
	else
		notify_slack "⚠️ Production deployment completed but health check failed: $VERSION" "warning"
		log_warn "Deployment completed but health check failed"
		log_info "Run '$(basename "$0") rollback' to restore previous version"
	fi
}

do_rollback() {
	log_step "Rolling back to previous deployment"

	confirm_deployment

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
set -e

BACKUP_DIR="${REMOTE_PATH}/backups"
LATEST_BACKUP=\$(ls -t "\${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | head -1)

if [[ -z "\$LATEST_BACKUP" ]]; then
    echo "ERROR: No backups found"
    exit 1
fi

echo "Rolling back to: \$LATEST_BACKUP"

# Stop services
pm2 stop ${PM2_FRONTEND_NAME} ${PM2_BACKEND_NAME} 2>/dev/null || true

# Restore backup
cd ${REMOTE_PATH}
tar -xzf "\$LATEST_BACKUP" --overwrite

# Restart services
pm2 start ecosystem.production.config.cjs

echo "Rollback completed"
pm2 status
EOF

	sleep 5
	health_check

	notify_slack "🔄 Production rollback completed" "warning"
	log_success "Rollback completed"
}

stop_services() {
	log_step "Stopping production services"

	ssh $SSH_OPTS "$SSH_TARGET" "pm2 stop ${PM2_FRONTEND_NAME} ${PM2_BACKEND_NAME} 2>/dev/null || true"

	log_success "Services stopped"
}

start_services() {
	log_step "Starting production services"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
cd ${REMOTE_PATH}
pm2 start ecosystem.production.config.cjs
pm2 status
EOF

	log_success "Services started"
}

show_status() {
	log_step "Production server status"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
echo ""
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== System Resources ==="
echo "Disk:"
df -h ${REMOTE_PATH} 2>/dev/null || df -h /
echo ""
echo "Memory:"
free -h
echo ""
echo "Load:"
uptime

echo ""
echo "=== Recent Errors (last 20 lines) ==="
pm2 logs --err --lines 20 --nostream 2>/dev/null || echo "No recent errors"
EOF
}

show_logs() {
	local service="${1:-all}"
	local lines="${2:-100}"

	case "$service" in
		frontend)
			ssh $SSH_OPTS "$SSH_TARGET" "pm2 logs ${PM2_FRONTEND_NAME} --lines $lines"
			;;
		backend)
			ssh $SSH_OPTS "$SSH_TARGET" "pm2 logs ${PM2_BACKEND_NAME} --lines $lines"
			;;
		error|errors)
			ssh $SSH_OPTS "$SSH_TARGET" "pm2 logs --err --lines $lines"
			;;
		*)
			ssh $SSH_OPTS "$SSH_TARGET" "pm2 logs --lines $lines"
			;;
	esac
}

do_backup() {
	create_backup
	log_success "Manual backup completed"
}

do_server_setup() {
	log_step "Initial production server setup"

	log_warn "This will configure the production server."
	read -p "Continue? [yes/N] " response
	if [[ "$response" != "yes" ]]; then
		exit 0
	fi

	ssh $SSH_OPTS "$SSH_TARGET" bash <<'SETUP_EOF'
set -e

echo "=== Checking Node.js ==="
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Please install Node.js 20+ first."
    exit 1
fi
echo "Node.js: $(node --version)"

echo "=== Installing PM2 ==="
npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME || true

echo "=== Creating Application Directory ==="
mkdir -p /opt/docfusion-prod/{frontend,logs,backups}

echo ""
echo "=== Setup Complete ==="
echo "PM2: $(pm2 --version)"
SETUP_EOF

	log_success "Server setup complete"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
	local command="${1:-deploy}"
	shift || true

	# Parse flags
	while [[ $# -gt 0 ]]; do
		case "$1" in
			--skip-tests)
				SKIP_TESTS=true
				shift
				;;
			--force)
				FORCE=true
				shift
				;;
			--dry-run)
				DRY_RUN=true
				shift
				;;
			-h|--help)
				show_help
				exit 0
				;;
			*)
				break
				;;
		esac
	done

	case "$command" in
		deploy)
			do_deploy
			;;
		sync)
			safety_checks
			build_frontend
			create_ecosystem_file
			sync_files
			log_success "Files synced. Run 'restart' to apply."
			;;
		restart)
			reload_services
			;;
		stop)
			stop_services
			;;
		start)
			start_services
			;;
		status)
			show_status
			;;
		health)
			health_check
			;;
		logs)
			show_logs "${1:-all}" "${2:-100}"
			;;
		rollback)
			do_rollback
			;;
		backup)
			do_backup
			;;
		setup)
			do_server_setup
			;;
		-h|--help|help)
			show_help
			;;
		*)
			log_error "Unknown command: $command"
			show_help
			exit 1
			;;
	esac
}

main "$@"
