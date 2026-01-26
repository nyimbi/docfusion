#!/usr/bin/env bash
# =============================================================================
# DocFusion - Local Development Deployment
# =============================================================================
# Sets up and runs DocFusion locally for development.
# Starts both backend and frontend in development mode.
# =============================================================================

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# =============================================================================
# CONFIGURATION
# =============================================================================
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
SOKETI_PORT="${SOKETI_PORT:-6001}"

# =============================================================================
# FUNCTIONS
# =============================================================================

show_help() {
	cat <<EOF
DocFusion Local Development Deployment

Usage: $(basename "$0") [command] [options]

Commands:
  start       Start all services (default)
  stop        Stop all services
  restart     Restart all services
  status      Show service status
  logs        Show logs (frontend, backend, or all)
  setup       Initial setup (install dependencies, create env files)
  clean       Clean build artifacts and caches

Options:
  -h, --help  Show this help message

Examples:
  $(basename "$0")              # Start all services
  $(basename "$0") start        # Start all services
  $(basename "$0") stop         # Stop all services
  $(basename "$0") logs backend # Show backend logs
  $(basename "$0") setup        # First-time setup
EOF
}

setup_environment() {
	log_step "Setting up local environment"

	# Create frontend .env.local if it doesn't exist
	if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
		log_substep "Creating frontend .env.local"
		cat > "$FRONTEND_DIR/.env.local" <<EOF
# DocFusion Frontend - Local Development
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}

# Real-time collaboration (Soketi)
NEXT_PUBLIC_PUSHER_KEY=app-key
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
NEXT_PUBLIC_SOKETI_HOST=localhost
NEXT_PUBLIC_SOKETI_PORT=${SOKETI_PORT}

# Feature flags
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_AI_COMMANDS=true
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true

# Debug mode
NEXT_PUBLIC_DEBUG=true
EOF
		log_success "Created frontend .env.local"
	else
		log_info "Frontend .env.local already exists"
	fi

	# Create backend .env if it doesn't exist
	if [[ ! -f "$BACKEND_DIR/.env" ]]; then
		log_substep "Creating backend .env"
		cat > "$BACKEND_DIR/.env" <<EOF
# DocFusion Backend - Local Development (FastAPI)
ENV=development
DEBUG=1
DATABASE_URL=sqlite:///./docfusion.db

# Pusher/Soketi configuration
PUSHER_APP_ID=app-id
PUSHER_KEY=app-key
PUSHER_SECRET=app-secret
PUSHER_HOST=localhost
PUSHER_PORT=${SOKETI_PORT}

# AI Configuration
OPENAI_API_KEY=your-openai-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
EOF
		log_success "Created backend .env"
	else
		log_info "Backend .env already exists"
	fi
}

install_dependencies() {
	log_step "Installing dependencies"

	# Python backend
	if [[ -f "$BACKEND_DIR/pyproject.toml" ]]; then
		log_substep "Installing Python dependencies"
		cd "$BACKEND_DIR"
		uv sync
	fi

	# Node.js frontend
	if [[ -f "$FRONTEND_DIR/package.json" ]]; then
		log_substep "Installing Node.js dependencies"
		cd "$FRONTEND_DIR"
		npm install
	fi

	log_success "Dependencies installed"
}

do_setup() {
	log_step "Running initial setup"

	require_command node "Install from https://nodejs.org/"
	require_command npm "Install from https://nodejs.org/"
	require_command uv "curl -LsSf https://astral.sh/uv/install.sh | sh"

	setup_environment
	install_dependencies

	log_success "Setup complete! Run '$(basename "$0") start' to start development servers."
}

start_backend() {
	log_substep "Starting backend server on port $BACKEND_PORT"

	cd "$BACKEND_DIR"

	# Check if port is already in use
	if port_in_use "$BACKEND_PORT"; then
		log_warn "Port $BACKEND_PORT is already in use"
		return 0
	fi

	# Start FastAPI with hypercorn in background
	uv run python -m hypercorn src.docfusion.api.app:app --bind 0.0.0.0:"$BACKEND_PORT" --reload &
	echo $! > "$BACKEND_DIR/.backend.pid"

	wait_for_port "$BACKEND_PORT" 30 1
	log_success "Backend started on http://localhost:$BACKEND_PORT"
}

start_frontend() {
	log_substep "Starting frontend server on port $FRONTEND_PORT"

	cd "$FRONTEND_DIR"

	if port_in_use "$FRONTEND_PORT"; then
		log_warn "Port $FRONTEND_PORT is already in use"
		return 0
	fi

	PORT="$FRONTEND_PORT" npm run dev &
	echo $! > "$FRONTEND_DIR/.frontend.pid"

	wait_for_port "$FRONTEND_PORT" 60 1
	log_success "Frontend started on http://localhost:$FRONTEND_PORT"
}

start_services() {
	log_step "Starting DocFusion development servers"

	setup_environment

	start_backend
	start_frontend

	echo ""
	log_success "All services started!"
	echo ""
	echo -e "  ${CYAN}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
	echo -e "  ${CYAN}Backend:${NC}   http://localhost:$BACKEND_PORT"
	echo -e "  ${CYAN}API Docs:${NC}  http://localhost:$BACKEND_PORT/docs"
	echo ""
	log_info "Press Ctrl+C to stop all services"

	# Wait for interrupt
	wait
}

stop_services() {
	log_step "Stopping DocFusion services"

	# Stop frontend
	if [[ -f "$FRONTEND_DIR/.frontend.pid" ]]; then
		local pid
		pid=$(cat "$FRONTEND_DIR/.frontend.pid")
		if kill -0 "$pid" 2>/dev/null; then
			log_substep "Stopping frontend (PID: $pid)"
			kill "$pid" 2>/dev/null || true
		fi
		rm -f "$FRONTEND_DIR/.frontend.pid"
	fi

	# Stop backend
	if [[ -f "$BACKEND_DIR/.backend.pid" ]]; then
		local pid
		pid=$(cat "$BACKEND_DIR/.backend.pid")
		if kill -0 "$pid" 2>/dev/null; then
			log_substep "Stopping backend (PID: $pid)"
			kill "$pid" 2>/dev/null || true
		fi
		rm -f "$BACKEND_DIR/.backend.pid"
	fi

	# Kill any remaining processes on the ports
	if port_in_use "$FRONTEND_PORT"; then
		log_substep "Force stopping process on port $FRONTEND_PORT"
		lsof -ti :"$FRONTEND_PORT" | xargs -r kill -9 2>/dev/null || true
	fi

	if port_in_use "$BACKEND_PORT"; then
		log_substep "Force stopping process on port $BACKEND_PORT"
		lsof -ti :"$BACKEND_PORT" | xargs -r kill -9 2>/dev/null || true
	fi

	log_success "All services stopped"
}

show_status() {
	log_step "Service Status"

	echo ""
	echo -e "  ${BOLD}Backend (port $BACKEND_PORT):${NC}"
	if port_in_use "$BACKEND_PORT"; then
		echo -e "    Status: ${GREEN}Running${NC}"
	else
		echo -e "    Status: ${RED}Stopped${NC}"
	fi

	echo ""
	echo -e "  ${BOLD}Frontend (port $FRONTEND_PORT):${NC}"
	if port_in_use "$FRONTEND_PORT"; then
		echo -e "    Status: ${GREEN}Running${NC}"
	else
		echo -e "    Status: ${RED}Stopped${NC}"
	fi
	echo ""
}

show_logs() {
	local service="${1:-all}"

	case "$service" in
		backend)
			log_step "Backend logs"
			if [[ -f "$BACKEND_DIR/logs/app.log" ]]; then
				tail -f "$BACKEND_DIR/logs/app.log"
			else
				log_warn "No backend log file found"
			fi
			;;
		frontend)
			log_step "Frontend logs"
			log_info "Frontend logs are in the terminal where 'npm run dev' is running"
			;;
		*)
			show_status
			;;
	esac
}

do_clean() {
	log_step "Cleaning build artifacts"

	# Frontend
	log_substep "Cleaning frontend"
	rm -rf "$FRONTEND_DIR/.next"
	rm -rf "$FRONTEND_DIR/node_modules/.cache"

	# Backend
	log_substep "Cleaning backend"
	find "$BACKEND_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find "$BACKEND_DIR" -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	rm -rf "$BACKEND_DIR/.ruff_cache"

	log_success "Cleanup complete"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
	local command="${1:-start}"

	case "$command" in
		start)
			start_services
			;;
		stop)
			stop_services
			;;
		restart)
			stop_services
			sleep 2
			start_services
			;;
		status)
			show_status
			;;
		logs)
			show_logs "${2:-all}"
			;;
		setup)
			do_setup
			;;
		clean)
			do_clean
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
