#!/usr/bin/env bash
# =============================================================================
# DocFusion - Staging Deployment
# =============================================================================
# Builds locally and deploys to staging server using rsync and PM2.
# Target: 20.63.27.56:10101
# =============================================================================

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

setup_trap

# =============================================================================
# CONFIGURATION
# =============================================================================
DEPLOY_ENV="staging"
REMOTE_HOST="${STAGING_HOST:-20.63.27.56}"
REMOTE_USER="${STAGING_USER:-deploy}"
REMOTE_PORT="${STAGING_SSH_PORT:-22}"
REMOTE_PATH="${STAGING_PATH:-/opt/docfusion}"
APP_PORT="${STAGING_APP_PORT:-10101}"
BACKEND_PORT="${STAGING_BACKEND_PORT:-8001}"

# PM2 app names
PM2_FRONTEND_NAME="docfusion-frontend-staging"
PM2_BACKEND_NAME="docfusion-backend-staging"

# SSH connection string
SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS="-o StrictHostKeyChecking=no -p ${REMOTE_PORT}"

# =============================================================================
# FUNCTIONS
# =============================================================================

show_help() {
	cat <<EOF
DocFusion Staging Deployment

Builds locally and deploys to staging server.

Usage: $(basename "$0") [command] [options]

Commands:
  deploy      Full deployment (build + sync + restart) [default]
  sync        Sync files only (no restart)
  restart     Restart services on remote
  stop        Stop all services
  start       Start all services
  status      Show remote service status
  health      Run health checks
  logs        Show remote logs
  rollback    Rollback to previous deployment
  setup       Initial server setup (install PM2, create dirs)

Options:
  -h, --help     Show this help message
  --skip-build   Skip local build step
  --skip-tests   Skip running tests

Environment Variables:
  STAGING_HOST       Remote host (default: 20.63.27.56)
  STAGING_USER       SSH user (default: deploy)
  STAGING_SSH_PORT   SSH port (default: 22)
  STAGING_PATH       Deployment path (default: /opt/docfusion)
  STAGING_APP_PORT   Frontend port (default: 10101)

Examples:
  $(basename "$0")                    # Full deployment
  $(basename "$0") deploy --skip-tests
  $(basename "$0") restart            # Just restart services
  $(basename "$0") logs frontend      # View frontend logs
EOF
}

preflight_checks() {
	log_step "Running preflight checks"

	require_command ssh
	require_command rsync
	require_command npm
	require_command node

	# Check SSH connectivity
	log_substep "Testing SSH connection to $SSH_TARGET"
	if ! ssh $SSH_OPTS "$SSH_TARGET" "echo 'Connection OK'" &>/dev/null; then
		log_error "Cannot connect to $SSH_TARGET"
		log_info "Make sure you have SSH access configured"
		exit 1
	fi
	log_success "SSH connection OK"

	# Check for uncommitted changes (warn only)
	if has_uncommitted_changes; then
		log_warn "You have uncommitted changes in your working directory"
		read -p "Continue anyway? [y/N] " -n 1 -r
		echo
		if [[ ! $REPLY =~ ^[Yy]$ ]]; then
			exit 1
		fi
	fi
}

run_tests() {
	if [[ "${SKIP_TESTS:-}" == "true" ]]; then
		log_warn "Skipping tests (--skip-tests)"
		return 0
	fi

	log_step "Running tests"

	log_substep "Running frontend tests"
	cd "$FRONTEND_DIR"
	npm run test -- --run || {
		log_error "Frontend tests failed"
		exit 1
	}

	log_substep "Running frontend linting"
	npm run lint || {
		log_error "Frontend linting failed"
		exit 1
	}

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

build_frontend() {
	if [[ "${SKIP_BUILD:-}" == "true" ]]; then
		log_warn "Skipping build (--skip-build)"
		return 0
	fi

	log_step "Building frontend locally for staging"

	cd "$FRONTEND_DIR"

	# Create staging environment file
	cat > .env.production.local <<EOF
# DocFusion Frontend - Staging
NEXT_PUBLIC_API_URL=http://${REMOTE_HOST}:${BACKEND_PORT}
NEXT_PUBLIC_PUSHER_KEY=staging-key
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
NEXT_PUBLIC_SOKETI_HOST=${REMOTE_HOST}
NEXT_PUBLIC_SOKETI_PORT=6001
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_AI_COMMANDS=true
NODE_ENV=production
EOF

	# Build with production config
	NODE_ENV=production npm run build

	log_success "Frontend build completed"
}

create_ecosystem_file() {
	log_step "Creating PM2 ecosystem file"

	cat > "$PROJECT_ROOT/ecosystem.staging.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: '${PM2_FRONTEND_NAME}',
      cwd: '${REMOTE_PATH}/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p ${APP_PORT}',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: ${APP_PORT},
      },
      error_file: '${REMOTE_PATH}/logs/frontend-error.log',
      out_file: '${REMOTE_PATH}/logs/frontend-out.log',
      log_file: '${REMOTE_PATH}/logs/frontend-combined.log',
      time: true,
      max_memory_restart: '500M',
      exp_backoff_restart_delay: 100,
    },
    {
      name: '${PM2_BACKEND_NAME}',
      cwd: '${REMOTE_PATH}',
      script: '.venv/bin/python',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PYTHONUNBUFFERED: '1',
        ENV: 'staging',
      },
      error_file: '${REMOTE_PATH}/logs/backend-error.log',
      out_file: '${REMOTE_PATH}/logs/backend-out.log',
      log_file: '${REMOTE_PATH}/logs/backend-combined.log',
      time: true,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
    },
  ],
};
EOF

	log_success "Ecosystem file created"
}

sync_files() {
	log_step "Syncing built artifacts to staging server"

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
		"$PROJECT_ROOT/ecosystem.staging.config.cjs" \
		"${SSH_TARGET}:${REMOTE_PATH}/"

	log_success "Files synced"
}

restart_services() {
	log_step "Restarting services on staging"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
set -e

cd ${REMOTE_PATH}

# Create logs directory
mkdir -p logs

# Stop existing processes
pm2 stop ecosystem.staging.config.cjs 2>/dev/null || true
pm2 delete ecosystem.staging.config.cjs 2>/dev/null || true

# Start with ecosystem file
pm2 start ecosystem.staging.config.cjs

# Save PM2 process list
pm2 save

# Show status
pm2 status

echo ""
echo "Services restarted successfully"
EOF

	log_success "Services restarted"
}

health_check() {
	log_step "Running health checks"

	local frontend_url="http://${REMOTE_HOST}:${APP_PORT}"

	log_substep "Checking frontend at $frontend_url"
	if http_health_check "$frontend_url" 30 2 200; then
		log_success "Frontend is healthy"
	else
		log_error "Frontend health check failed"
		return 1
	fi
}

do_deploy() {
	log_step "Starting staging deployment"
	log_info "Target: ${SSH_TARGET}:${REMOTE_PATH}"
	log_info "Version: $VERSION"

	preflight_checks
	run_tests
	install_local_deps
	build_frontend
	create_ecosystem_file
	sync_files
	restart_services

	sleep 5
	health_check

	notify_slack "Staging deployment completed: $VERSION" "success"

	echo ""
	log_success "Deployment completed successfully!"
	echo ""
	echo -e "  ${CYAN}Frontend:${NC}  http://${REMOTE_HOST}:${APP_PORT}"
	echo -e "  ${CYAN}Backend:${NC}   http://${REMOTE_HOST}:${BACKEND_PORT}"
	echo -e "  ${CYAN}Version:${NC}   $VERSION"
	echo ""
}

do_sync() {
	log_step "Syncing files to staging (no restart)"

	preflight_checks
	build_frontend
	create_ecosystem_file
	sync_files

	log_success "Files synced. Run '$(basename "$0") restart' to restart services."
}

show_status() {
	log_step "Staging server status"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
echo ""
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== Disk Usage ==="
df -h ${REMOTE_PATH} 2>/dev/null || df -h /

echo ""
echo "=== Memory Usage ==="
free -h
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

stop_services() {
	log_step "Stopping staging services"

	ssh $SSH_OPTS "$SSH_TARGET" "pm2 stop ${PM2_FRONTEND_NAME} ${PM2_BACKEND_NAME} 2>/dev/null || true"

	log_success "Services stopped"
}

start_services() {
	log_step "Starting staging services"

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
cd ${REMOTE_PATH}
pm2 start ecosystem.staging.config.cjs
pm2 status
EOF

	log_success "Services started"
}

do_health() {
	health_check
}

do_rollback() {
	log_step "Rolling back to previous deployment"

	log_warn "Rollback not yet implemented"
	log_info "To rollback manually:"
	log_info "  1. SSH to server: ssh $SSH_TARGET"
	log_info "  2. Restore from backup in ${REMOTE_PATH}/backups/"
	log_info "  3. Restart services: pm2 restart all"
}

do_server_setup() {
	log_step "Initial server setup"

	log_info "This will set up PM2 and create directories on the staging server."
	read -p "Continue? [y/N] " -n 1 -r
	echo
	if [[ ! $REPLY =~ ^[Yy]$ ]]; then
		exit 0
	fi

	ssh $SSH_OPTS "$SSH_TARGET" bash <<EOF
set -e

echo "=== Checking Node.js ==="
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Please install Node.js 20+ first."
    exit 1
fi
node --version

echo "=== Installing PM2 ==="
npm install -g pm2

echo "=== Creating deployment directory ==="
mkdir -p ${REMOTE_PATH}/{frontend,logs,backups}

echo "=== Setup PM2 startup ==="
pm2 startup || true

echo "=== Setup complete ==="
EOF

	log_success "Server setup complete"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
	local command="${1:-deploy}"

	# Parse flags
	for arg in "$@"; do
		case "$arg" in
			--skip-build)
				SKIP_BUILD=true
				;;
			--skip-tests)
				SKIP_TESTS=true
				;;
			-h|--help)
				show_help
				exit 0
				;;
		esac
	done

	case "$command" in
		deploy)
			do_deploy
			;;
		sync)
			do_sync
			;;
		restart)
			restart_services
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
			do_health
			;;
		logs)
			show_logs "${2:-all}" "${3:-100}"
			;;
		rollback)
			do_rollback
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
