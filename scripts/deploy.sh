#!/usr/bin/env bash
# =============================================================================
# DocFusion Deployment Entry Point
# =============================================================================
# Convenience wrapper for environment-specific deployment scripts.
# Usage: ./scripts/deploy.sh [local|staging|production] [command] [options]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
	cat <<EOF
DocFusion Deployment

Usage: $(basename "$0") <environment> [command] [options]

Environments:
  local       Local development environment
  staging     Staging server (20.63.27.56:10101)
  production  Production server

Commands (vary by environment):
  start       Start services
  stop        Stop services
  restart     Restart services
  status      Show service status
  health      Run health checks
  logs        Show logs [frontend|backend|errors]
  deploy      Full deployment (staging/production)
  sync        Sync files only without restart
  rollback    Rollback to previous version (staging/production)
  backup      Create backup (production only)
  setup       Initial setup

Examples:
  $(basename "$0") local                    # Start local dev servers
  $(basename "$0") local stop               # Stop local servers
  $(basename "$0") staging deploy           # Deploy to staging
  $(basename "$0") staging status           # Check staging status
  $(basename "$0") staging health           # Run staging health checks
  $(basename "$0") staging logs frontend    # View staging frontend logs
  $(basename "$0") staging logs errors      # View error logs
  $(basename "$0") staging stop             # Stop staging services
  $(basename "$0") staging start            # Start staging services
  $(basename "$0") production deploy        # Deploy to production
  $(basename "$0") production status        # Check production status
  $(basename "$0") production rollback      # Rollback production

For detailed help on a specific environment:
  $(basename "$0") local --help
  $(basename "$0") staging --help
  $(basename "$0") production --help
EOF
}

main() {
	if [[ $# -eq 0 ]]; then
		show_help
		exit 0
	fi

	local environment="$1"
	shift

	case "$environment" in
		local|dev|development)
			"$SCRIPT_DIR/deploy/local.sh" "$@"
			;;
		staging|stage)
			"$SCRIPT_DIR/deploy/staging.sh" "$@"
			;;
		production|prod)
			"$SCRIPT_DIR/deploy/production.sh" "$@"
			;;
		-h|--help|help)
			show_help
			;;
		*)
			echo "Unknown environment: $environment"
			echo ""
			show_help
			exit 1
			;;
	esac
}

main "$@"
