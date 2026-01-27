#!/usr/bin/env bash
# =============================================================================
# DocFusion Frontend - Common Deployment Utilities
# =============================================================================
# Shared functions and variables for all deployment scripts.
# Source this file at the beginning of environment-specific scripts.
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

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Get the project root directory (parent of scripts/deploy)
get_project_root() {
	local script_dir
	script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	echo "$(cd "$script_dir/../.." && pwd)"
}

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
	git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Get current git commit SHA (short)
get_git_sha() {
	git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Get current git tag if exists
get_git_tag() {
	git describe --tags --exact-match 2>/dev/null || echo ""
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

# Check if there are uncommitted changes
has_uncommitted_changes() {
	! git diff-index --quiet HEAD -- 2>/dev/null
}

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

	# Export variables from file, ignoring comments and empty lines
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

# Create environment file from template
create_env_from_template() {
	local template="$1"
	local output="$2"

	if [[ ! -f "$template" ]]; then
		log_error "Template file not found: $template"
		return 1
	fi

	if [[ -f "$output" ]]; then
		log_warn "Environment file already exists: $output"
		return 0
	fi

	cp "$template" "$output"
	log_success "Created environment file: $output"
}

# =============================================================================
# DOCKER UTILITIES
# =============================================================================

# Build Docker image with caching
docker_build() {
	local image_name="$1"
	local dockerfile="${2:-Dockerfile}"
	local context="${3:-.}"
	local build_args=("${@:4}")

	log_step "Building Docker image: $image_name"

	local args=()
	args+=(--file "$dockerfile")
	args+=(--tag "$image_name")
	args+=(--tag "$image_name:$(get_git_sha)")

	# Add build args
	for arg in "${build_args[@]}"; do
		args+=(--build-arg "$arg")
	done

	# Enable BuildKit for better caching
	DOCKER_BUILDKIT=1 docker build "${args[@]}" "$context"

	log_success "Built image: $image_name"
}

# Push Docker image to registry
docker_push() {
	local image_name="$1"

	log_step "Pushing Docker image: $image_name"

	docker push "$image_name"
	docker push "$image_name:$(get_git_sha)"

	log_success "Pushed image: $image_name"
}

# Check if Docker container is healthy
docker_health_check() {
	local container_name="$1"
	local max_attempts="${2:-30}"
	local interval="${3:-2}"

	log_info "Waiting for container '$container_name' to be healthy..."

	local attempt=1
	while [[ $attempt -le $max_attempts ]]; do
		local status
		status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "not_found")

		case "$status" in
			healthy)
				log_success "Container '$container_name' is healthy"
				return 0
				;;
			unhealthy)
				log_error "Container '$container_name' is unhealthy"
				docker logs --tail 50 "$container_name"
				return 1
				;;
			not_found)
				log_warn "Container '$container_name' not found (attempt $attempt/$max_attempts)"
				;;
			*)
				log_info "Container status: $status (attempt $attempt/$max_attempts)"
				;;
		esac

		sleep "$interval"
		((attempt++))
	done

	log_error "Timeout waiting for container '$container_name' to be healthy"
	return 1
}

# =============================================================================
# NODE.JS / NPM UTILITIES
# =============================================================================

# Install dependencies with caching
npm_install() {
	local project_root
	project_root=$(get_project_root)

	log_step "Installing npm dependencies"

	cd "$project_root"

	# Use npm ci for reproducible builds in CI
	if is_ci; then
		npm ci --prefer-offline
	else
		npm install
	fi

	log_success "Dependencies installed"
}

# Build the Next.js application
npm_build() {
	local project_root
	project_root=$(get_project_root)

	log_step "Building Next.js application"

	cd "$project_root"
	npm run build

	log_success "Build completed"
}

# Run tests
npm_test() {
	local project_root
	project_root=$(get_project_root)

	log_step "Running tests"

	cd "$project_root"
	npm run test -- --run

	log_success "Tests passed"
}

# Run linting
npm_lint() {
	local project_root
	project_root=$(get_project_root)

	log_step "Running linter"

	cd "$project_root"
	npm run lint

	log_success "Linting passed"
}

# =============================================================================
# HEALTH CHECK UTILITIES
# =============================================================================

# HTTP health check
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

# =============================================================================
# CLEANUP UTILITIES
# =============================================================================

# Remove old Docker images
cleanup_old_images() {
	local image_name="$1"
	local keep_count="${2:-5}"

	log_step "Cleaning up old Docker images"

	# Get all tags for the image, sorted by creation date
	local images
	images=$(docker images "$image_name" --format "{{.ID}} {{.CreatedAt}}" | sort -k2 -r | tail -n +$((keep_count + 1)) | awk '{print $1}')

	if [[ -n "$images" ]]; then
		echo "$images" | xargs -r docker rmi -f
		log_success "Cleaned up old images"
	else
		log_info "No old images to clean up"
	fi
}

# Remove dangling images and volumes
cleanup_docker() {
	log_step "Cleaning up Docker resources"

	docker image prune -f
	docker volume prune -f

	log_success "Docker cleanup completed"
}

# =============================================================================
# NOTIFICATION UTILITIES
# =============================================================================

# Send Slack notification (if webhook URL is set)
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

	local payload
	payload=$(cat <<EOF
{
	"attachments": [
		{
			"color": "$color",
			"text": "$message",
			"footer": "DocFusion Deployment",
			"ts": $(date +%s)
		}
	]
}
EOF
)

	curl -s -X POST -H 'Content-type: application/json' \
		--data "$payload" \
		"$SLACK_WEBHOOK_URL" >/dev/null
}

# =============================================================================
# TRAP HANDLERS
# =============================================================================

# Cleanup function for script exit
cleanup_on_exit() {
	local exit_code=$?

	if [[ $exit_code -ne 0 ]]; then
		log_error "Script failed with exit code: $exit_code"
		notify_slack "Deployment failed with exit code $exit_code" "error"
	fi

	# Add any cleanup tasks here
	return $exit_code
}

# Set up trap for cleanup
setup_trap() {
	trap cleanup_on_exit EXIT
}

# =============================================================================
# EXPORTS
# =============================================================================
export PROJECT_ROOT
PROJECT_ROOT=$(get_project_root)
export VERSION
VERSION=$(get_version)
export GIT_SHA
GIT_SHA=$(get_git_sha)
export GIT_BRANCH
GIT_BRANCH=$(get_git_branch)
