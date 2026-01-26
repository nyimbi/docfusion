#!/usr/bin/env bash
# =============================================================================
# DocFusion - Common Deployment Utilities
# =============================================================================
# Shared functions and variables for all deployment scripts.
# Source this file at the beginning of environment-specific scripts.
# Uses PM2 for process management on remote servers.
# =============================================================================

set -euo pipefail

# =============================================================================
# COLORS AND FORMATTING
# =============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================
log_info() {
	echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
	echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_step() {
	echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$*${NC}"
}

log_substep() {
	echo -e "  ${MAGENTA}->>${NC} $*"
}

# =============================================================================
# PROJECT PATHS
# =============================================================================

# Get the project root directory (parent of scripts/deploy)
get_project_root() {
	local script_dir
	script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	echo "$(cd "$script_dir/../.." && pwd)"
}

# Initialize paths
PROJECT_ROOT=$(get_project_root)
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

export PROJECT_ROOT FRONTEND_DIR BACKEND_DIR SCRIPTS_DIR

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Check if a command exists
command_exists() {
	command -v "$1" &>/dev/null
}

# Require a command to exist or exit
require_command() {
	local cmd="$1"
	local install_hint="${2:-}"

	if ! command_exists "$cmd"; then
		log_error "Required command '$cmd' not found."
		if [[ -n "$install_hint" ]]; then
			log_info "Install hint: $install_hint"
		fi
		exit 1
	fi
}

# Check if running in CI environment
is_ci() {
	[[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ -n "${GITLAB_CI:-}" ]]
}

# Get current git branch
get_git_branch() {
	git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Get current git commit SHA (short)
get_git_sha() {
	git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Get current git tag if exists
get_git_tag() {
	git -C "$PROJECT_ROOT" describe --tags --exact-match 2>/dev/null || echo ""
}

# Generate a version string
get_version() {
	local tag
	tag=$(get_git_tag)
	if [[ -n "$tag" ]]; then
		echo "$tag"
	else
		echo "$(get_git_branch)-$(get_git_sha)"
	fi
}

# Get timestamp for backups/releases
get_timestamp() {
	date +"%Y%m%d_%H%M%S"
}

# Check if there are uncommitted changes
has_uncommitted_changes() {
	! git -C "$PROJECT_ROOT" diff-index --quiet HEAD -- 2>/dev/null
}

# Export version info
VERSION=$(get_version)
GIT_SHA=$(get_git_sha)
GIT_BRANCH=$(get_git_branch)
TIMESTAMP=$(get_timestamp)

export VERSION GIT_SHA GIT_BRANCH TIMESTAMP

# =============================================================================
# ENVIRONMENT MANAGEMENT
# =============================================================================

# Load environment variables from a file
load_env_file() {
	local env_file="$1"

	if [[ ! -f "$env_file" ]]; then
		log_warn "Environment file not found: $env_file"
		return 1
	fi

	log_info "Loading environment from: $env_file"

	set -a
	# shellcheck source=/dev/null
	source "$env_file"
	set +a
}

# Validate required environment variables
validate_env_vars() {
	local missing=()

	for var in "$@"; do
		if [[ -z "${!var:-}" ]]; then
			missing+=("$var")
		fi
	done

	if [[ ${#missing[@]} -gt 0 ]]; then
		log_error "Missing required environment variables:"
		for var in "${missing[@]}"; do
			log_error "  - $var"
		done
		return 1
	fi
}

# =============================================================================
# PYTHON / UV UTILITIES
# =============================================================================

# Install Python dependencies with UV
uv_install() {
	log_step "Installing Python dependencies with UV"

	cd "$PROJECT_ROOT"

	if ! command_exists uv; then
		log_error "UV not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
		return 1
	fi

	uv sync

	log_success "Python dependencies installed"
}

# Run Python tests
python_test() {
	log_step "Running Python tests"

	cd "$PROJECT_ROOT"
	uv run pytest -vxs tests/ci

	log_success "Python tests passed"
}

# =============================================================================
# NODE.JS / NPM UTILITIES
# =============================================================================

# Install frontend dependencies
npm_install() {
	log_step "Installing frontend dependencies"

	cd "$FRONTEND_DIR"

	if is_ci; then
		npm ci --prefer-offline
	else
		npm install
	fi

	log_success "Frontend dependencies installed"
}

# Build the Next.js application
npm_build() {
	log_step "Building Next.js application"

	cd "$FRONTEND_DIR"
	npm run build

	log_success "Frontend build completed"
}

# Run frontend tests
npm_test() {
	log_step "Running frontend tests"

	cd "$FRONTEND_DIR"
	npm run test -- --run

	log_success "Frontend tests passed"
}

# Run frontend linting
npm_lint() {
	log_step "Running frontend linting"

	cd "$FRONTEND_DIR"
	npm run lint

	log_success "Frontend linting passed"
}

# =============================================================================
# PM2 UTILITIES
# =============================================================================

# Check if PM2 is installed
require_pm2() {
	require_command pm2 "npm install -g pm2"
}

# Start application with PM2
pm2_start() {
	local app_name="$1"
	local ecosystem_file="$2"

	log_step "Starting $app_name with PM2"

	pm2 start "$ecosystem_file" --only "$app_name"

	log_success "Started $app_name"
}

# Stop application with PM2
pm2_stop() {
	local app_name="$1"

	log_step "Stopping $app_name"

	pm2 stop "$app_name" 2>/dev/null || log_warn "$app_name was not running"

	log_success "Stopped $app_name"
}

# Restart application with PM2
pm2_restart() {
	local app_name="$1"

	log_step "Restarting $app_name"

	pm2 restart "$app_name"

	log_success "Restarted $app_name"
}

# Reload application with zero downtime
pm2_reload() {
	local app_name="$1"

	log_step "Reloading $app_name (zero downtime)"

	pm2 reload "$app_name"

	log_success "Reloaded $app_name"
}

# Delete application from PM2
pm2_delete() {
	local app_name="$1"

	log_step "Deleting $app_name from PM2"

	pm2 delete "$app_name" 2>/dev/null || log_warn "$app_name was not in PM2"

	log_success "Deleted $app_name"
}

# Show PM2 status
pm2_status() {
	pm2 status
}

# Show PM2 logs
pm2_logs() {
	local app_name="${1:-}"
	local lines="${2:-100}"

	if [[ -n "$app_name" ]]; then
		pm2 logs "$app_name" --lines "$lines"
	else
		pm2 logs --lines "$lines"
	fi
}

# Save PM2 process list for startup
pm2_save() {
	log_info "Saving PM2 process list"
	pm2 save
}

# Setup PM2 startup script
pm2_startup() {
	log_info "Setting up PM2 startup"
	pm2 startup
}

# =============================================================================
# HEALTH CHECK UTILITIES
# =============================================================================

# HTTP health check with retries
http_health_check() {
	local url="$1"
	local max_attempts="${2:-30}"
	local interval="${3:-2}"
	local expected_status="${4:-200}"

	log_info "Checking health of: $url"

	local attempt=1
	while [[ $attempt -le $max_attempts ]]; do
		local status
		status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

		if [[ "$status" == "$expected_status" ]]; then
			log_success "Health check passed (HTTP $status)"
			return 0
		fi

		log_info "Health check: HTTP $status (attempt $attempt/$max_attempts)"
		sleep "$interval"
		((attempt++))
	done

	log_error "Health check failed after $max_attempts attempts"
	return 1
}

# Check if a port is in use
port_in_use() {
	local port="$1"
	lsof -i :"$port" &>/dev/null
}

# Wait for a port to become available
wait_for_port() {
	local port="$1"
	local max_attempts="${2:-30}"
	local interval="${3:-1}"

	log_info "Waiting for port $port..."

	local attempt=1
	while [[ $attempt -le $max_attempts ]]; do
		if port_in_use "$port"; then
			log_success "Port $port is now available"
			return 0
		fi

		sleep "$interval"
		((attempt++))
	done

	log_error "Timeout waiting for port $port"
	return 1
}

# =============================================================================
# RSYNC / SSH DEPLOYMENT
# =============================================================================

# Deploy to remote server via rsync
rsync_deploy() {
	local source_dir="$1"
	local remote_host="$2"
	local remote_path="$3"
	local exclude_file="${4:-}"

	log_step "Deploying to $remote_host:$remote_path"

	local rsync_opts=(
		-avz
		--delete
		--progress
		--compress
	)

	if [[ -n "$exclude_file" && -f "$exclude_file" ]]; then
		rsync_opts+=(--exclude-from="$exclude_file")
	fi

	rsync_opts+=(
		--exclude='.git'
		--exclude='node_modules'
		--exclude='.venv'
		--exclude='__pycache__'
		--exclude='.pytest_cache'
		--exclude='.next'
		--exclude='*.pyc'
		--exclude='.env.local'
		--exclude='.env.*.local'
	)

	rsync "${rsync_opts[@]}" "$source_dir/" "$remote_host:$remote_path/"

	log_success "Deployment to $remote_host completed"
}

# Execute command on remote server
ssh_exec() {
	local remote_host="$1"
	shift
	local command="$*"

	log_info "Executing on $remote_host: $command"
	ssh -o StrictHostKeyChecking=no "$remote_host" "$command"
}

# =============================================================================
# BACKUP UTILITIES
# =============================================================================

# Create a backup of a directory
create_backup() {
	local source_dir="$1"
	local backup_dir="$2"
	local name="${3:-backup}"

	local backup_file="$backup_dir/${name}_${TIMESTAMP}.tar.gz"

	log_step "Creating backup: $backup_file"

	mkdir -p "$backup_dir"
	tar -czf "$backup_file" -C "$(dirname "$source_dir")" "$(basename "$source_dir")"

	log_success "Backup created: $backup_file"
	echo "$backup_file"
}

# Cleanup old backups
cleanup_old_backups() {
	local backup_dir="$1"
	local pattern="$2"
	local keep="${3:-5}"

	log_info "Cleaning up old backups (keeping $keep most recent)"

	find "$backup_dir" -name "$pattern" -type f | \
		sort -r | \
		tail -n +"$((keep + 1))" | \
		xargs -r rm -f

	log_success "Backup cleanup completed"
}

# =============================================================================
# NOTIFICATION UTILITIES
# =============================================================================

# Send Slack notification
notify_slack() {
	local message="$1"
	local status="${2:-info}"

	if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
		return 0
	fi

	local color
	case "$status" in
		success) color="good" ;;
		warning) color="warning" ;;
		error) color="danger" ;;
		*) color="#439FE0" ;;
	esac

	curl -s -X POST -H 'Content-type: application/json' \
		--data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\",\"footer\":\"DocFusion | $VERSION\"}]}" \
		"$SLACK_WEBHOOK_URL" >/dev/null
}

# =============================================================================
# TRAP HANDLERS
# =============================================================================

cleanup_on_exit() {
	local exit_code=$?

	if [[ $exit_code -ne 0 ]]; then
		log_error "Script failed with exit code: $exit_code"
		notify_slack "Deployment failed with exit code $exit_code" "error"
	fi

	return $exit_code
}

setup_trap() {
	trap cleanup_on_exit EXIT
}

log_info "Common utilities loaded (version: $VERSION)"
