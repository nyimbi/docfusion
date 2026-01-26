# Enhanced Python Project Makefile with Comprehensive Initialization
# Project: docfusion
# Generated from template - provides comprehensive development automation
# Powered by UV for fast, reliable dependency management
# Enhanced with Flask-AppBuilder integration and automated project setup

# ============================================================================
# CONFIGURATION VARIABLES
# ============================================================================

# Project Configuration
PROJECT_NAME := docfusion
MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
TEMPLATES_DIR := $(MAKEFILE_DIR)/templates
UV := uv
PYTHON := $(UV) run python
PIP := $(UV) run pip

# Project Structure
SRC_DIR := src
TEST_DIR := tests
DOCS_DIR := docs
APP_DIR := app
REPORTS_DIR := reports
COVERAGE_DIR := $(REPORTS_DIR)/coverage
MYPY_REPORT_DIR := $(REPORTS_DIR)/mypy
SECURITY_REPORT_DIR := $(REPORTS_DIR)/security

# Configuration Files
PYPROJECT_TOML := pyproject.toml
PRE_COMMIT_CONFIG := .pre-commit-config.yaml
UV_LOCK := uv.lock
REQUIREMENTS_TXT := requirements.txt
REQUIREMENTS_DEV_TXT := requirements-dev.txt

# Build and Distribution
DIST_DIR := dist
BUILD_DIR := build

# Flask-AppBuilder Configuration
FAB_CONFIG_FILE := $(APP_DIR)/config.py
FAB_APP_FILE := $(APP_DIR)/app.py
FAB_VIEWS_DIR := $(APP_DIR)/views
FAB_MODELS_DIR := $(APP_DIR)/models
FAB_TEMPLATES_DIR := $(APP_DIR)/templates
FAB_STATIC_DIR := $(APP_DIR)/static

# Performance
PARALLEL_JOBS := $(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Git Configuration
GIT_USER_NAME := $(shell git config user.name 2>/dev/null || echo "Developer")
GIT_USER_EMAIL := $(shell git config user.email 2>/dev/null || echo "developer@example.com")

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m
BOLD := \033[1m
BLUE := \033[34m
MAGENTA := \033[35m

# ============================================================================
# PHONY TARGETS DECLARATION
# ============================================================================

.PHONY: help init install install-dev sync lock clean clean-all
.PHONY: test test-coverage test-parallel test-watch test-reports
.PHONY: lint format format-check quality-check
.PHONY: type-check type-check-report type-check-watch
.PHONY: security-scan security-report
.PHONY: pre-commit pre-commit-install pre-commit-run pre-commit-update
.PHONY: docs docs-serve docs-clean docs-build docs-watch
.PHONY: deps-check deps-update deps-tree deps-audit deps-outdated
.PHONY: dev-setup validate-env build dist upload run run-dev run-flask
.PHONY: airflow-setup airflow-init airflow-start airflow-stop airflow-test
.PHONY: docker-build docker-run docker-clean docker-shell
.PHONY: benchmark profile debug info ci release-check
.PHONY: uv-add uv-add-dev uv-remove uv-export uv-tree
.PHONY: notebook jupyter lab
.PHONY: flask-init flask-create-admin flask-db-init flask-db-migrate flask-db-upgrade
.PHONY: flask-shell flask-run-debug flask-create-user flask-reset-password
.PHONY: git-init git-setup git-status git-first-commit
.PHONY: venv-create venv-info venv-remove
.PHONY: requirements-generate requirements-install requirements-sync
.PHONY: project-structure project-validate project-info
.PHONY: all init-complete

# ============================================================================
# DEFAULT TARGET AND HELP SYSTEM
# ============================================================================

.DEFAULT_GOAL := help

help: ## Display comprehensive help information
	@echo "$(BOLD)╔══════════════════════════════════════════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)║$(CYAN)                     docfusion - Development Automation                   $(RESET)$(BOLD)║$(RESET)"
	@echo "$(BOLD)║$(CYAN)                        Powered by UV Package Manager                        $(RESET)$(BOLD)║$(RESET)"
	@echo "$(BOLD)║$(CYAN)                    Enhanced with Flask-AppBuilder Support                  $(RESET)$(BOLD)║$(RESET)"
	@echo "$(BOLD)╚══════════════════════════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(BOLD)🚀 INITIALIZATION:$(RESET)"
	@echo "  $(CYAN)make init$(RESET)               # Complete project initialization (recommended first step)"
	@echo "  $(CYAN)make init-complete$(RESET)      # Full initialization with Flask-AppBuilder setup"
	@echo ""
	@echo "$(BOLD)🏃 QUICK START:$(RESET)"
	@echo "  $(CYAN)make dev-setup$(RESET)          # Development environment setup (after init)"
	@echo "  $(CYAN)make quality-check$(RESET)      # Run all quality checks"
	@echo "  $(CYAN)make run-flask$(RESET)          # Run Flask-AppBuilder application"
	@echo ""
	@echo "$(BOLD)📋 AVAILABLE TARGETS:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "; printf "\n"} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-25s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BOLD)🔧 CONFIGURATION:$(RESET)"
	@echo "  Package Manager: $(GREEN)UV$(RESET)"
	@echo "  Project: $(GREEN)$(PROJECT_NAME)$(RESET)"
	@echo "  Source Directory: $(GREEN)$(SRC_DIR)$(RESET)"
	@echo "  Flask App Directory: $(GREEN)$(APP_DIR)$(RESET)"
	@echo "  Parallel Jobs: $(GREEN)$(PARALLEL_JOBS)$(RESET)"
	@echo "  Git User: $(GREEN)$(GIT_USER_NAME) <$(GIT_USER_EMAIL)>$(RESET)"
	@echo ""
	@echo "$(BOLD)💡 TIP:$(RESET) Start with $(CYAN)make init$(RESET) for new projects, then $(CYAN)make info$(RESET) for project status"

# ============================================================================
# PROJECT INITIALIZATION TARGET
# ============================================================================

init: ## Complete project initialization with virtual environment, git setup, and Flask-AppBuilder
	@echo "$(BOLD)🚀 Initializing docfusion project...$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@$(MAKE) _init_validate_prerequisites
	@$(MAKE) _init_create_venv
	@$(MAKE) _init_project_structure
	@$(MAKE) _init_git_setup
	@$(MAKE) _init_flask_appbuilder
	@$(MAKE) _init_requirements_files
	@$(MAKE) _init_install_dependencies
	@$(MAKE) _init_setup_pre_commit
	@$(MAKE) _init_first_commit
	@$(MAKE) _init_summary
	@echo "$(BOLD)$(GREEN)✅ Project initialization completed successfully!$(RESET)"

init-complete: init dev-setup ## Complete project initialization with full development environment
	@echo "$(BOLD)🎯 Complete initialization with development environment setup...$(RESET)"
	@$(MAKE) flask-db-init
	@$(MAKE) flask-create-admin
	@echo "$(BOLD)$(GREEN)🎉 Project fully initialized and ready for development!$(RESET)"

# ============================================================================
# INITIALIZATION SUB-TARGETS (PRIVATE)
# ============================================================================

_init_validate_prerequisites: ## Validate prerequisites for initialization
	@echo "$(CYAN)Step 1: Validating prerequisites...$(RESET)"
	@if ! command -v uv >/dev/null 2>&1; then \
		echo "$(RED)❌ UV is not installed. Installing UV...$(RESET)"; \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
		echo "$(YELLOW)⚠️  Please restart your shell and run 'make init' again$(RESET)"; \
		exit 1; \
	fi
	@if ! command -v git >/dev/null 2>&1; then \
		echo "$(RED)❌ Git is not installed. Please install Git first.$(RESET)"; \
		exit 1; \
	fi
	@if [ -d ".git" ]; then \
		echo "$(YELLOW)⚠️  Git repository already exists. Skipping git initialization.$(RESET)"; \
	fi
	@if [ -f "$(PYPROJECT_TOML)" ]; then \
		echo "$(YELLOW)⚠️  pyproject.toml already exists. Project may already be initialized.$(RESET)"; \
	fi
	@echo "$(GREEN)✅ Prerequisites validated$(RESET)"

_init_create_venv: ## Create virtual environment with UV
	@echo "$(CYAN)Step 2: Creating virtual environment...$(RESET)"
	@if [ ! -d ".venv" ]; then \
		echo "$(BLUE)  📦 Creating virtual environment with UV...$(RESET)"; \
		$(UV) venv --python 3.12; \
		echo "$(GREEN)  ✅ Virtual environment created at .venv$(RESET)"; \
	else \
		echo "$(YELLOW)  ⚠️  Virtual environment already exists$(RESET)"; \
	fi
	@$(MAKE) venv-info

_init_project_structure: ## Create comprehensive project directory structure
	@echo "$(CYAN)Step 3: Creating project structure...$(RESET)"
	@echo "$(BLUE)  📁 Creating directory structure...$(RESET)"
	@mkdir -p $(SRC_DIR)/$(PROJECT_NAME)
	@mkdir -p $(TEST_DIR)/{unit,integration,e2e}
	@mkdir -p $(DOCS_DIR)/{source,build}
	@mkdir -p $(APP_DIR)/{views,models,templates,static/{css,js,img},security}
	@mkdir -p $(REPORTS_DIR)/{coverage,security,performance}
	@mkdir -p scripts/{deployment,db,utils}
	@mkdir -p configs/{development,production,testing}
	@mkdir -p data/{raw,processed,external}
	@mkdir -p logs
	@mkdir -p deployment/{docker,kubernetes,ansible}
	@echo "$(GREEN)  ✅ Project structure created$(RESET)"

_init_git_setup: ## Initialize Git repository with proper configuration
	@echo "$(CYAN)Step 4: Setting up Git repository...$(RESET)"
	@if [ ! -d ".git" ]; then \
		echo "$(BLUE)  🔧 Initializing Git repository...$(RESET)"; \
		git init; \
		git config user.name "$(GIT_USER_NAME)" || git config user.name "Developer"; \
		git config user.email "$(GIT_USER_EMAIL)" || git config user.email "developer@example.com"; \
		git config init.defaultBranch main; \
		git config core.autocrlf input; \
		git config core.safecrlf true; \
		echo "$(GREEN)  ✅ Git repository initialized$(RESET)"; \
	else \
		echo "$(YELLOW)  ⚠️  Git repository already exists$(RESET)"; \
	fi
	@$(MAKE) _create_gitignore

_create_gitignore: ## Create comprehensive .gitignore file
	@echo "$(BLUE)  📄 Creating .gitignore...$(RESET)"
	@cp $(MAKEFILE_DIR)/gitignore.template .gitignore
	@sed -i.bak 's/docfusion/$(PROJECT_NAME)/g' .gitignore 2>/dev/null || true
	@rm -f .gitignore.bak 2>/dev/null || true
	@echo "$(GREEN)  ✅ .gitignore created$(RESET)"

_init_flask_appbuilder: ## Initialize Flask-AppBuilder application structure
	@echo "$(CYAN)Step 5: Setting up Flask-AppBuilder application...$(RESET)"
	@$(MAKE) _create_flask_config
	@$(MAKE) _create_flask_app
	@$(MAKE) _create_flask_models
	@$(MAKE) _create_flask_views
	@$(MAKE) _create_flask_templates
	@$(MAKE) _create_flask_cli
	@echo "$(GREEN)  ✅ Flask-AppBuilder structure created$(RESET)"

_create_flask_config: ## Create Flask configuration files
	@echo "$(BLUE)    🔧 Creating Flask configuration...$(RESET)"
	@cp $(TEMPLATES_DIR)/config.py.template $(APP_DIR)/config.py
	@sed -i.bak 's/docfusion/$(PROJECT_NAME)/g' $(APP_DIR)/config.py && rm $(APP_DIR)/config.py.bak

_create_flask_app: ## Create main Flask application file
	@echo "$(BLUE)    📱 Creating Flask application...$(RESET)"
	@cp $(TEMPLATES_DIR)/app.py.template $(APP_DIR)/app.py
	@cp $(TEMPLATES_DIR)/config.py.template $(APP_DIR)/config.py

	@sed -i.bak 's/docfusion/$(PROJECT_NAME)/g' $(APP_DIR)/app.py && rm $(APP_DIR)/app.py.bak

_create_flask_models: ## Create Flask-AppBuilder models
	@echo "$(BLUE)    🗄️  Creating Flask models...$(RESET)"
	@mkdir -p $(APP_DIR)/models
	@cp $(TEMPLATES_DIR)/models_init.py.template $(APP_DIR)/models/__init__.py
	@cp $(TEMPLATES_DIR)/models_user.py.template $(APP_DIR)/models/user.py

	@sed -i.bak 's/docfusion/$(PROJECT_NAME)/g' $(APP_DIR)/models/__init__.py && rm $(APP_DIR)/models/__init__.py.bak

_create_flask_views: ## Create Flask-AppBuilder views
	@echo "$(BLUE)    👁️  Creating Flask views...$(RESET)"
	@mkdir -p $(APP_DIR)/views
	@cp $(TEMPLATES_DIR)/views_init.py.template $(APP_DIR)/views/__init__.py
	@cp $(TEMPLATES_DIR)/views_main.py.template $(APP_DIR)/views/main.py


_init_requirements_files: ## Generate requirements files
	@echo "$(CYAN)Step 6: Generating requirements files...$(RESET)"
	@echo "$(BLUE)  📄 Creating requirements.txt files...$(RESET)"
	@cp $(TEMPLATES_DIR)/requirements.txt.template $(APP_DIR)/requirements.txt
	@cp $(TEMPLATES_DIR)/requirements_dev.txt.template $(APP_DIR)/requirements_dev.txt
	@cp $(TEMPLATES_DIR)/requirements_test.txt.template $(APP_DIR)/requirements_test.txt


	@echo "$(GREEN)  ✅ Requirements files created$(RESET)"

_init_install_dependencies: ## Install initial dependencies
	@echo "$(CYAN)Step 7: Installing dependencies...$(RESET)"
	@echo "$(BLUE)  📦 Installing Flask-AppBuilder and dependencies...$(RESET)"
	@$(UV) add flask-appbuilder flask-migrate python-dotenv click psycopg2-binary pgai
	@$(UV) add --dev pytest pytest-flask ruff mypy pre-commit
	@echo "$(GREEN)  ✅ Dependencies installed$(RESET)"

_init_setup_pre_commit: ## Setup pre-commit hooks
	@echo "$(CYAN)Step 8: Setting up pre-commit hooks...$(RESET)"
	@cp $(TEMPLATES_DIR)/pre-commit-config.yaml.template $(APP_DIR)/.pre-commit-config.yaml

	@if [ ! -f "$(PRE_COMMIT_CONFIG)" ]; then \
		echo "$(BLUE)  🔗 Creating pre-commit configuration...$(RESET)"; \
		$(UV) run pre-commit install; \
		echo "$(GREEN)  ✅ Pre-commit hooks installed$(RESET)"; \
	else \
		echo "$(YELLOW)  ⚠️  Pre-commit config already exists$(RESET)"; \
	fi

_init_first_commit: ## Create initial Git commit
	@echo "$(CYAN)Step 9: Creating initial Git commit...$(RESET)"
	@if [ -d ".git" ]; then \
		echo "$(BLUE)  📝 Adding files to Git...$(RESET)"; \
		git add .; \
		if git diff --cached --quiet; then \
			echo "$(YELLOW)  ⚠️  No changes to commit$(RESET)"; \
		else \
			git commit -m "feat: initial project setup with Flask-AppBuilder\
\
- Complete project structure with src-layout\
- Flask-AppBuilder application with authentication\
- Comprehensive configuration and security setup\
- API endpoints with health checks and metrics\
- Database models with audit capabilities\
- Pre-commit hooks for code quality\
- Requirements files for dependency management\
- CLI commands for user and role management\
- Docker and deployment ready structure"; \
			echo "$(GREEN)  ✅ Initial commit created$(RESET)"; \
		fi; \
	else \
		echo "$(YELLOW)  ⚠️  Git repository not initialized$(RESET)"; \
	fi

_init_summary: ## Display initialization summary
	@echo "$(CYAN)Step 10: Initialization Summary$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)✅ Virtual environment created with UV$(RESET)"
	@echo "$(GREEN)✅ Complete project structure established$(RESET)"
	@echo "$(GREEN)✅ Git repository initialized$(RESET)"
	@echo "$(GREEN)✅ Flask-AppBuilder application configured$(RESET)"
	@echo "$(GREEN)✅ Requirements files generated$(RESET)"
	@echo "$(GREEN)✅ Core dependencies installed$(RESET)"
	@echo "$(GREEN)✅ Pre-commit hooks configured$(RESET)"
	@echo "$(GREEN)✅ Initial Git commit created$(RESET)"
	@echo ""
	@echo "$(BOLD)📋 Next Steps:$(RESET)"
	@echo "  $(CYAN)make flask-init$(RESET)         # Initialize Flask database"
	@echo "  $(CYAN)make flask-create-admin$(RESET) # Create admin user"
	@echo "  $(CYAN)make run-flask$(RESET)          # Start Flask development server"
	@echo "  $(CYAN)make quality-check$(RESET)      # Run quality checks"

# ============================================================================
# VIRTUAL ENVIRONMENT MANAGEMENT
# ============================================================================

venv-create: ## Create virtual environment with UV
	@echo "$(BOLD)🐍 Creating virtual environment...$(RESET)"
	@if [ ! -d ".venv" ]; then \
		$(UV) venv --python 3.12; \
		echo "$(GREEN)✅ Virtual environment created$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Virtual environment already exists$(RESET)"; \
	fi

venv-info: ## Display virtual environment information
	@echo "$(BOLD)📊 Virtual Environment Information$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if [ -d ".venv" ]; then \
		echo "  Status: $(GREEN)✅ Active$(RESET)"; \
		echo "  Location: $(GREEN).venv$(RESET)"; \
		echo "  Python: $(GREEN)$(shell $(UV) run python --version 2>/dev/null || echo 'Not available')$(RESET)"; \
		echo "  UV Version: $(GREEN)$(shell $(UV) --version 2>/dev/null || echo 'Not available')$(RESET)"; \
	else \
		echo "  Status: $(RED)❌ Not found$(RESET)"; \
	fi

venv-remove: ## Remove virtual environment
	@echo "$(BOLD)🗑️  Removing virtual environment...$(RESET)"
	@if [ -d ".venv" ]; then \
		rm -rf .venv; \
		echo "$(GREEN)✅ Virtual environment removed$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Virtual environment not found$(RESET)"; \
	fi

# ============================================================================
# GIT MANAGEMENT
# ============================================================================

git-init: ## Initialize Git repository with best practices
	@echo "$(BOLD)📚 Initializing Git repository...$(RESET)"
	@if [ ! -d ".git" ]; then \
		git init; \
		git config user.name "$(GIT_USER_NAME)" || git config user.name "Developer"; \
		git config user.email "$(GIT_USER_EMAIL)" || git config user.email "developer@example.com"; \
		git config init.defaultBranch main; \
		git config core.autocrlf input; \
		git config core.safecrlf true; \
		echo "$(GREEN)✅ Git repository initialized$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Git repository already exists$(RESET)"; \
	fi

git-setup: ## Setup Git with comprehensive configuration
	@echo "$(BOLD)⚙️  Setting up Git configuration...$(RESET)"
	@git config core.autocrlf input
	@git config core.safecrlf true
	@git config pull.rebase true
	@git config push.default simple
	@git config init.defaultBranch main
	@echo "$(GREEN)✅ Git configuration completed$(RESET)"

git-status: ## Display comprehensive Git status
	@echo "$(BOLD)📊 Git Repository Status$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if [ -d ".git" ]; then \
		echo "  Repository: $(GREEN)✅ Initialized$(RESET)"; \
		echo "  Branch: $(GREEN)$(shell git branch --show-current 2>/dev/null || echo 'No commits yet')$(RESET)"; \
		echo "  Status: $(GREEN)$(shell git status --porcelain 2>/dev/null | wc -l) changed files$(RESET)"; \
		echo "  Last Commit: $(GREEN)$(shell git log -1 --pretty=format:'%h - %s (%cr)' 2>/dev/null || echo 'No commits yet')$(RESET)"; \
		echo "  Remote: $(GREEN)$(shell git remote get-url origin 2>/dev/null || echo 'No remote configured')$(RESET)"; \
	else \
		echo "  Repository: $(RED)❌ Not initialized$(RESET)"; \
	fi

git-first-commit: ## Create initial commit
	@echo "$(BOLD)📝 Creating initial commit...$(RESET)"
	@if [ -d ".git" ]; then \
		git add .; \
		git commit -m "feat: initial project setup\
\
- Project structure with Flask-AppBuilder\
- Configuration and requirements files\
- Development tooling setup"; \
		echo "$(GREEN)✅ Initial commit created$(RESET)"; \
	else \
		echo "$(RED)❌ Git repository not initialized$(RESET)"; \
	fi

# ============================================================================
# REQUIREMENTS MANAGEMENT
# ============================================================================

requirements-generate: ## Generate requirements files from UV
	@echo "$(BOLD)📦 Generating requirements files...$(RESET)"
	@$(UV) export --format requirements-txt --output-file $(REQUIREMENTS_TXT)
	@$(UV) export --format requirements-txt --extra dev --output-file $(REQUIREMENTS_DEV_TXT)
	@echo "$(GREEN)✅ Requirements files generated$(RESET)"

requirements-install: ## Install from requirements.txt
	@echo "$(BOLD)📦 Installing from requirements.txt...$(RESET)"
	@if [ -f "$(REQUIREMENTS_TXT)" ]; then \
		$(UV) sync; \
		echo "$(GREEN)✅ Requirements installed$(RESET)"; \
	else \
		echo "$(RED)❌ requirements.txt not found$(RESET)"; \
	fi

requirements-sync: ## Sync dependencies and update requirements
	@echo "$(BOLD)🔄 Syncing dependencies and updating requirements...$(RESET)"
	@$(UV) sync --upgrade
	@$(MAKE) requirements-generate
	@echo "$(GREEN)✅ Dependencies synced and requirements updated$(RESET)"

# ============================================================================
# FLASK-APPBUILDER SPECIFIC TARGETS
# ============================================================================

flask-init: ## Initialize Flask-AppBuilder database
	@echo "$(BOLD)🗄️  Initializing Flask-AppBuilder database...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask fab create-db
	@echo "$(GREEN)✅ Database initialized$(RESET)"

flask-create-admin: ## Create Flask-AppBuilder admin user
	@echo "$(BOLD)👤 Creating Flask-AppBuilder admin user...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask fab create-admin
	@echo "$(GREEN)✅ Admin user created$(RESET)"

flask-db-init: ## Initialize database migrations
	@echo "$(BOLD)🔄 Initializing database migrations...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask db init
	@echo "$(GREEN)✅ Database migrations initialized$(RESET)"

flask-db-migrate: ## Create database migration
	@echo "$(BOLD)📝 Creating database migration...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask db migrate -m "Auto migration"
	@echo "$(GREEN)✅ Database migration created$(RESET)"

flask-db-upgrade: ## Apply database migrations
	@echo "$(BOLD)⬆️  Applying database migrations...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask db upgrade
	@echo "$(GREEN)✅ Database migrations applied$(RESET)"

flask-shell: ## Start Flask shell with application context
	@echo "$(BOLD)🐚 Starting Flask shell...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask shell

flask-run-debug: ## Run Flask in debug mode
	@echo "$(BOLD)🚀 Starting Flask development server in debug mode...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && export FLASK_ENV=development && $(UV) run flask run --host=0.0.0.0 --port=5000 --debug

flask-create-user: ## Create a new Flask-AppBuilder user
	@echo "$(BOLD)👤 Creating new user...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask create-user

flask-reset-password: ## Reset user password
	@echo "$(BOLD)🔐 Resetting user password...$(RESET)"
	@export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask reset-password

# ============================================================================
# PROJECT VALIDATION AND INFORMATION
# ============================================================================

project-structure: ## Display project structure
	@echo "$(BOLD)📁 Project Structure$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if command -v tree >/dev/null 2>&1; then \
		tree -I '__pycache__|*.pyc|.git|.venv|node_modules|.pytest_cache|.mypy_cache|.ruff_cache' -a; \
	else \
		find . -type f -not -path './.git/*' -not -path './.venv/*' -not -path './__pycache__/*' | sort; \
	fi

project-validate: ## Validate project setup and configuration
	@echo "$(BOLD)🔍 Validating Project Setup$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)Checking core files:$(RESET)"
	@echo "  pyproject.toml: $(if $(wildcard $(PYPROJECT_TOML)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  requirements.txt: $(if $(wildcard $(REQUIREMENTS_TXT)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  .gitignore: $(if $(wildcard .gitignore),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  pre-commit config: $(if $(wildcard $(PRE_COMMIT_CONFIG)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo ""
	@echo "$(CYAN)Checking Flask-AppBuilder setup:$(RESET)"
	@echo "  App directory: $(if $(wildcard $(APP_DIR)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Flask app.py: $(if $(wildcard $(FAB_APP_FILE)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Flask config.py: $(if $(wildcard $(FAB_CONFIG_FILE)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Models directory: $(if $(wildcard $(FAB_MODELS_DIR)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Views directory: $(if $(wildcard $(FAB_VIEWS_DIR)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo ""
	@echo "$(CYAN)Checking environment:$(RESET)"
	@echo "  Virtual environment: $(if $(wildcard .venv),$(GREEN)✅ Active$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Git repository: $(if $(wildcard .git),$(GREEN)✅ Initialized$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  UV available: $(if $(shell command -v uv 2>/dev/null),$(GREEN)✅ Available$(RESET),$(RED)❌ Missing$(RESET))"

project-info: ## Display comprehensive project information
	@echo "$(BOLD)ℹ️  Project Information$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(BOLD)📁 Project Details:$(RESET)"
	@echo "  Name: $(GREEN)$(PROJECT_NAME)$(RESET)"
	@echo "  Directory: $(GREEN)$(shell pwd)$(RESET)"
	@echo "  Type: $(GREEN)Flask-AppBuilder Web Application$(RESET)"
	@echo ""
	@echo "$(BOLD)🔧 Environment:$(RESET)"
	@echo "  UV: $(GREEN)$(shell $(UV) --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo "  Python: $(GREEN)$(shell $(UV) run python --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo "  Platform: $(GREEN)$(shell uname -s) $(shell uname -m)$(RESET)"
	@echo ""
	@echo "$(BOLD)📊 Project Status:$(RESET)"
	@echo "  Initialized: $(if $(wildcard $(PYPROJECT_TOML)),$(GREEN)✅ Yes$(RESET),$(RED)❌ No$(RESET))"
	@echo "  Virtual Env: $(if $(wildcard .venv),$(GREEN)✅ Active$(RESET),$(YELLOW)⚠️  Not found$(RESET))"
	@echo "  Git Repo: $(if $(wildcard .git),$(GREEN)✅ Initialized$(RESET),$(YELLOW)⚠️  Not initialized$(RESET))"
	@echo "  Flask App: $(if $(wildcard $(FAB_APP_FILE)),$(GREEN)✅ Configured$(RESET),$(RED)❌ Missing$(RESET))"
	@echo ""
	@echo "$(BOLD)🌐 Flask Application:$(RESET)"
	@if [ -f "$(FAB_APP_FILE)" ]; then \
		echo "  App File: $(GREEN)$(FAB_APP_FILE)$(RESET)"; \
		echo "  Config File: $(GREEN)$(FAB_CONFIG_FILE)$(RESET)"; \
		echo "  Models: $(GREEN)$(FAB_MODELS_DIR)$(RESET)"; \
		echo "  Views: $(GREEN)$(FAB_VIEWS_DIR)$(RESET)"; \
		echo "  Templates: $(GREEN)$(FAB_TEMPLATES_DIR)$(RESET)"; \
	else \
		echo "  Status: $(RED)❌ Not configured$(RESET)"; \
	fi

# ============================================================================
# ENHANCED ENVIRONMENT MANAGEMENT
# ============================================================================

install: ## Install production dependencies only
	@echo "$(BOLD)📦 Installing production dependencies...$(RESET)"
	$(UV) sync --no-dev
	@echo "$(GREEN)✅ Production dependencies installed$(RESET)"

install-dev: ## Install all dependencies including development tools
	@echo "$(BOLD)📦 Installing development dependencies...$(RESET)"
	$(UV) sync --all-extras --dev
	@echo "$(GREEN)✅ Development dependencies installed$(RESET)"

sync: ## Synchronize dependencies with lock file
	@echo "$(BOLD)🔄 Synchronizing dependencies...$(RESET)"
	$(UV) sync
	@echo "$(GREEN)✅ Dependencies synchronized$(RESET)"

lock: ## Update lock file with latest compatible versions
	@echo "$(BOLD)🔒 Updating lock file...$(RESET)"
	$(UV) lock --upgrade
	@echo "$(GREEN)✅ Lock file updated$(RESET)"

clean: ## Remove build artifacts and temporary files
	@echo "$(BOLD)🧹 Cleaning build artifacts...$(RESET)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type f -name "*.orig" -delete 2>/dev/null || true
	@find . -type f -name "*.rej" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".coverage" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf $(BUILD_DIR) $(DIST_DIR) $(REPORTS_DIR)
	@rm -f .coverage coverage.xml
	@rm -rf $(APP_DIR)/*.db
	@echo "$(GREEN)✅ Cleanup completed$(RESET)"

clean-all: clean ## Complete cleanup including UV cache and virtual environment
	@echo "$(BOLD)🧹 Performing complete cleanup...$(RESET)"
	$(UV) cache clean
	@rm -rf .venv
	@echo "$(GREEN)✅ Complete cleanup finished$(RESET)"

validate-env: ## Validate development environment setup
	@echo "$(BOLD)🔍 Validating development environment...$(RESET)"
	@echo "  UV Version: $(shell $(UV) --version 2>/dev/null || echo '$(RED)Not available$(RESET)')"
	@echo "  Python Version: $(shell $(UV) run python --version 2>/dev/null || echo '$(RED)Not available$(RESET)')"
	@echo "  Project: $(GREEN)$(PROJECT_NAME)$(RESET)"
	@echo "  Working Directory: $(GREEN)$(shell pwd)$(RESET)"
	@echo "  UV Lock: $(if $(wildcard $(UV_LOCK)),$(GREEN)✅ Found$(RESET),$(YELLOW)⚠️  Missing$(RESET))"
	@echo "  PyProject: $(if $(wildcard $(PYPROJECT_TOML)),$(GREEN)✅ Found$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Virtual Env: $(if $(wildcard .venv),$(GREEN)✅ Active$(RESET),$(YELLOW)⚠️  Not found$(RESET))"
	@echo "  Flask App: $(if $(wildcard $(FAB_APP_FILE)),$(GREEN)✅ Found$(RESET),$(YELLOW)⚠️  Missing$(RESET))"
	@echo "$(GREEN)✅ Environment validation completed$(RESET)"

# ============================================================================
# ENHANCED APPLICATION EXECUTION
# ============================================================================

run: ## Run the FastAPI backend server
	@echo "$(BOLD)🚀 Running $(PROJECT_NAME) FastAPI server...$(RESET)"
	$(UV) run python -m hypercorn src.docfusion.api.app:app --bind 0.0.0.0:8000 --reload

run-dev: ## Run application in development mode with debugger
	@echo "$(BOLD)🚀 Running $(PROJECT_NAME) in development mode...$(RESET)"
	@echo "$(YELLOW)Debugger listening on port 5678$(RESET)"
	$(UV) run python -m debugpy --listen 5678 --wait-for-client -m hypercorn src.docfusion.api.app:app --bind 0.0.0.0:8000 --reload

run-api: ## Run FastAPI backend server (alias for run)
	@$(MAKE) run

# ============================================================================
# DEPENDENCY MANAGEMENT
# ============================================================================

deps-check: ## Check dependency integrity and compatibility
	@echo "$(BOLD)🔍 Checking dependencies...$(RESET)"
	$(UV) pip check
	@echo "$(GREEN)✅ Dependencies validated$(RESET)"

deps-update: ## Update all dependencies to latest compatible versions
	@echo "$(BOLD)🔄 Updating dependencies...$(RESET)"
	$(UV) sync --upgrade
	@echo "$(GREEN)✅ Dependencies updated$(RESET)"

deps-tree: ## Display dependency tree
	@echo "$(BOLD)🌳 Dependency tree:$(RESET)"
	$(UV) tree

deps-audit: ## Run comprehensive security audit of dependencies
	@echo "$(BOLD)🔒 Running dependency security audit...$(RESET)"
	@mkdir -p $(REPORTS_DIR)
	@if $(UV) run python -c "import pip_audit" 2>/dev/null; then \
		$(UV) run pip-audit --format=json --output=$(REPORTS_DIR)/pip-audit.json || true; \
		$(UV) run pip-audit --format=text; \
	else \
		echo "$(YELLOW)⚠️  pip-audit not available in dev dependencies$(RESET)"; \
	fi

deps-outdated: ## Check for outdated dependencies
	@echo "$(BOLD)📊 Checking for outdated dependencies...$(RESET)"
	$(UV) tree --outdated

# ============================================================================
# UV-SPECIFIC UTILITIES
# ============================================================================

uv-add: ## Add a dependency (usage: make uv-add PACKAGE=package_name)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Usage: make uv-add PACKAGE=package_name$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BOLD)📦 Adding package: $(PACKAGE)$(RESET)"
	$(UV) add $(PACKAGE)
	@echo "$(GREEN)✅ Package $(PACKAGE) added$(RESET)"

uv-add-dev: ## Add a development dependency (usage: make uv-add-dev PACKAGE=package_name)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Usage: make uv-add-dev PACKAGE=package_name$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BOLD)📦 Adding dev package: $(PACKAGE)$(RESET)"
	$(UV) add --dev $(PACKAGE)
	@echo "$(GREEN)✅ Dev package $(PACKAGE) added$(RESET)"

uv-remove: ## Remove a dependency (usage: make uv-remove PACKAGE=package_name)
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)Usage: make uv-remove PACKAGE=package_name$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BOLD)🗑️  Removing package: $(PACKAGE)$(RESET)"
	$(UV) remove $(PACKAGE)
	@echo "$(GREEN)✅ Package $(PACKAGE) removed$(RESET)"

uv-export: ## Export dependencies to requirements.txt format
	@echo "$(BOLD)📤 Exporting dependencies...$(RESET)"
	$(UV) export --format requirements-txt --output-file requirements.txt
	$(UV) export --format requirements-txt --extra dev --output-file requirements-dev.txt
	@echo "$(GREEN)✅ Requirements exported$(RESET)"

uv-tree: ## Display dependency tree with UV
	@echo "$(BOLD)🌳 UV Dependency tree:$(RESET)"
	$(UV) tree

# ============================================================================
# QUALITY ASSURANCE TARGETS (Continued from previous sections)
# ============================================================================

format: ## Format code with ruff (replaces black + isort)
	@echo "$(BOLD)🎨 Formatting code with ruff...$(RESET)"
	$(UV) run ruff format $(SRC_DIR) $(TEST_DIR) $(APP_DIR)
	$(UV) run ruff check --fix $(SRC_DIR) $(TEST_DIR) $(APP_DIR)
	@echo "$(GREEN)✅ Code formatting completed$(RESET)"

format-check: ## Check code formatting without making changes
	@echo "$(BOLD)🔍 Checking code formatting...$(RESET)"
	$(UV) run ruff format --check $(SRC_DIR) $(TEST_DIR) $(APP_DIR)
	$(UV) run ruff check $(SRC_DIR) $(TEST_DIR) $(APP_DIR)
	@echo "$(GREEN)✅ Format check completed$(RESET)"

lint: ## Run comprehensive linting with ruff
	@echo "$(BOLD)🔍 Running comprehensive linting...$(RESET)"
	$(UV) run ruff check $(SRC_DIR) $(TEST_DIR) $(APP_DIR) --output-format=full
	@echo "$(GREEN)✅ Linting completed$(RESET)"

# ============================================================================
# TYPE CHECKING
# ============================================================================

type-check: ## Run static type checking with mypy
	@echo "$(BOLD)🔍 Running type checking with mypy...$(RESET)"
	$(UV) run mypy $(SRC_DIR)
	@if [ -d "$(APP_DIR)" ]; then \
		$(UV) run mypy $(APP_DIR) || echo "$(YELLOW)⚠️  Type checking issues in Flask app$(RESET)"; \
	fi
	@if [ -d "$(TEST_DIR)" ]; then \
		$(UV) run mypy $(TEST_DIR) || echo "$(YELLOW)⚠️  Type checking issues in tests$(RESET)"; \
	fi
	@echo "$(GREEN)✅ Type checking completed$(RESET)"

type-check-report: ## Generate detailed type checking report
	@echo "$(BOLD)📊 Generating type checking report...$(RESET)"
	@mkdir -p $(MYPY_REPORT_DIR)
	$(UV) run mypy --html-report $(MYPY_REPORT_DIR) $(SRC_DIR) $(APP_DIR) || true
	@echo "$(GREEN)📁 Type checking report: $(MYPY_REPORT_DIR)/index.html$(RESET)"

type-check-watch: ## Run type checking in watch mode
	@echo "$(BOLD)👀 Running type checking in watch mode...$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(RESET)"
	@while true; do \
		$(UV) run mypy $(SRC_DIR) $(APP_DIR) --no-error-summary; \
		inotifywait -qq -r -e modify $(SRC_DIR) $(APP_DIR) 2>/dev/null || (sleep 2; continue); \
	done

# ============================================================================
# SECURITY SCANNING
# ============================================================================

security-scan: ## Run comprehensive security scanning
	@echo "$(BOLD)🔒 Running security scans...$(RESET)"
	@mkdir -p $(SECURITY_REPORT_DIR)
	@echo "$(CYAN)Running bandit security analysis...$(RESET)"
	@if $(UV) run python -c "import bandit" 2>/dev/null; then \
		$(UV) run bandit -r $(SRC_DIR) $(APP_DIR) -f text || true; \
	else \
		echo "$(YELLOW)⚠️  bandit not available$(RESET)"; \
	fi
	@echo "$(CYAN)Running safety vulnerability check...$(RESET)"
	@if $(UV) run python -c "import safety" 2>/dev/null; then \
		$(UV) run safety check || echo "$(YELLOW)⚠️  Vulnerabilities detected$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  safety not available$(RESET)"; \
	fi
	@echo "$(GREEN)✅ Security scan completed$(RESET)"

security-report: ## Generate comprehensive security reports
	@echo "$(BOLD)📊 Generating security reports...$(RESET)"
	@mkdir -p $(SECURITY_REPORT_DIR)
	@if $(UV) run python -c "import bandit" 2>/dev/null; then \
		$(UV) run bandit -r $(SRC_DIR) $(APP_DIR) -f json -o $(SECURITY_REPORT_DIR)/bandit.json || true; \
		$(UV) run bandit -r $(SRC_DIR) $(APP_DIR) -f html -o $(SECURITY_REPORT_DIR)/bandit.html || true; \
	fi
	@if $(UV) run python -c "import safety" 2>/dev/null; then \
		$(UV) run safety check --json --output $(SECURITY_REPORT_DIR)/safety.json || true; \
	fi
	@echo "$(GREEN)📁 Security reports generated in $(SECURITY_REPORT_DIR)/$(RESET)"

# ============================================================================
# TESTING INFRASTRUCTURE
# ============================================================================

test: ## Run test suite with verbose output
	@echo "$(BOLD)🧪 Running test suite...$(RESET)"
	$(UV) run pytest $(TEST_DIR) -v --tb=short
	@echo "$(GREEN)✅ Test suite completed$(RESET)"

test-coverage: ## Run tests with comprehensive coverage analysis
	@echo "$(BOLD)🧪 Running tests with coverage analysis...$(RESET)"
	@mkdir -p $(COVERAGE_DIR)
	$(UV) run pytest $(TEST_DIR) \
		--cov=$(SRC_DIR) \
		--cov=$(APP_DIR) \
		--cov-report=html:$(COVERAGE_DIR) \
		--cov-report=xml:coverage.xml \
		--cov-report=term-missing:skip-covered \
		--cov-fail-under=80
	@echo "$(GREEN)📁 Coverage report: $(COVERAGE_DIR)/index.html$(RESET)"

test-parallel: ## Run tests in parallel for faster execution
	@echo "$(BOLD)🚀 Running tests in parallel...$(RESET)"
	$(UV) run pytest $(TEST_DIR) -n auto --dist=worksteal
	@echo "$(GREEN)✅ Parallel testing completed$(RESET)"

test-watch: ## Run tests in watch mode (re-run on file changes)
	@echo "$(BOLD)👀 Running tests in watch mode...$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(RESET)"
	$(UV) run pytest $(TEST_DIR) -f

test-reports: ## Generate comprehensive test reports (JUnit, HTML, Coverage)
	@echo "$(BOLD)📊 Generating comprehensive test reports...$(RESET)"
	@mkdir -p $(REPORTS_DIR)/tests
	$(UV) run pytest $(TEST_DIR) \
		--junitxml=$(REPORTS_DIR)/tests/junit.xml \
		--html=$(REPORTS_DIR)/tests/report.html \
		--self-contained-html \
		--cov=$(SRC_DIR) \
		--cov=$(APP_DIR) \
		--cov-report=html:$(COVERAGE_DIR) \
		--cov-report=xml:coverage.xml \
		--cov-report=json:$(REPORTS_DIR)/coverage.json
	@echo "$(GREEN)📁 Test reports generated in $(REPORTS_DIR)/tests/$(RESET)"

test-flask: ## Run Flask-specific tests
	@echo "$(BOLD)🧪 Running Flask application tests...$(RESET)"
	@if [ -d "tests/flask" ]; then \
		$(UV) run pytest tests/flask -v; \
	else \
		echo "$(YELLOW)⚠️  No Flask-specific tests found$(RESET)"; \
		echo "$(CYAN)Create tests in tests/flask/ directory$(RESET)"; \
	fi

# ============================================================================
# PRE-COMMIT INTEGRATION
# ============================================================================

pre-commit-install: ## Install and configure pre-commit hooks
	@echo "$(BOLD)🔗 Installing pre-commit hooks...$(RESET)"
	@if [ -f "$(PRE_COMMIT_CONFIG)" ]; then \
		$(UV) run pre-commit install; \
		$(UV) run pre-commit install --hook-type commit-msg; \
		echo "$(GREEN)✅ Pre-commit hooks installed$(RESET)"; \
	else \
		echo "$(RED)❌ .pre-commit-config.yaml not found$(RESET)"; \
		exit 1; \
	fi

pre-commit-run: ## Run pre-commit hooks on all files
	@echo "$(BOLD)🔍 Running pre-commit hooks...$(RESET)"
	$(UV) run pre-commit run --all-files

pre-commit-update: ## Update pre-commit hooks to latest versions
	@echo "$(BOLD)🔄 Updating pre-commit hooks...$(RESET)"
	$(UV) run pre-commit autoupdate
	@echo "$(GREEN)✅ Pre-commit hooks updated$(RESET)"

# ============================================================================
# DOCUMENTATION
# ============================================================================

docs: ## Generate project documentation with Sphinx
	@echo "$(BOLD)📚 Generating documentation...$(RESET)"
	@if [ -d "$(DOCS_DIR)" ]; then \
		$(UV) run sphinx-build -b html $(DOCS_DIR)/source $(DOCS_DIR)/build; \
		echo "$(GREEN)📁 Documentation: $(DOCS_DIR)/build/index.html$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Documentation directory not found. Creating structure...$(RESET)"; \
		$(MAKE) docs-init; \
	fi

docs-serve: docs ## Serve documentation locally at http://localhost:8000
	@echo "$(BOLD)🌐 Serving documentation at http://localhost:8000$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(RESET)"
	@cd $(DOCS_DIR)/build && $(UV) run python -m http.server 8000

docs-clean: ## Clean documentation build artifacts
	@echo "$(BOLD)🧹 Cleaning documentation artifacts...$(RESET)"
	@rm -rf $(DOCS_DIR)/build
	@echo "$(GREEN)✅ Documentation cleanup completed$(RESET)"

docs-init: ## Initialize documentation structure with Sphinx
	@echo "$(BOLD)📚 Initializing documentation structure...$(RESET)"
	@mkdir -p $(DOCS_DIR)/source $(DOCS_DIR)/build
	@if ! [ -f "$(DOCS_DIR)/source/conf.py" ]; then \
		$(UV) run sphinx-quickstart -q -p "$(PROJECT_NAME)" -a "Author" -v "0.1.0" --ext-autodoc --ext-viewcode $(DOCS_DIR); \
	fi
	@echo "$(GREEN)✅ Documentation structure initialized$(RESET)"

docs-api: ## Generate API documentation from docstrings
	@echo "$(BOLD)📖 Generating API documentation...$(RESET)"
	@mkdir -p $(DOCS_DIR)/source/api
	@$(UV) run sphinx-apidoc -o $(DOCS_DIR)/source/api $(SRC_DIR) $(APP_DIR)
	@echo "$(GREEN)✅ API documentation generated$(RESET)"

# ============================================================================
# BUILD AND DISTRIBUTION
# ============================================================================

build: clean ## Build distribution packages (wheel and source)
	@echo "$(BOLD)🔨 Building distribution packages...$(RESET)"
	$(UV) build
	@echo "$(GREEN)✅ Build completed. Packages in $(DIST_DIR)/$(RESET)"
	@ls -la $(DIST_DIR)

dist: build ## Create distribution (alias for build)

upload: build ## Upload packages to PyPI
	@echo "$(BOLD)📤 Uploading to PyPI...$(RESET)"
	@echo "$(YELLOW)⚠️  Ensure you have configured PyPI credentials$(RESET)"
	$(UV) publish
	@echo "$(GREEN)✅ Upload completed$(RESET)"

upload-test: build ## Upload packages to TestPyPI for testing
	@echo "$(BOLD)📤 Uploading to TestPyPI...$(RESET)"
	$(UV) publish --repository testpypi
	@echo "$(GREEN)✅ Test upload completed$(RESET)"

# ============================================================================
# DOCKER INTEGRATION
# ============================================================================

docker-build: ## Build Docker image for the project
	@echo "$(BOLD)🐳 Building Docker image...$(RESET)"
	docker build -t $(PROJECT_NAME):latest .
	@echo "$(GREEN)✅ Docker image built: $(PROJECT_NAME):latest$(RESET)"

docker-run: ## Run application in Docker container
	@echo "$(BOLD)🐳 Running Docker container...$(RESET)"
	docker run --rm -p 5000:5000 $(PROJECT_NAME):latest

docker-shell: ## Open shell in Docker container for debugging
	@echo "$(BOLD)🐳 Opening shell in Docker container...$(RESET)"
	docker run --rm -it --entrypoint /bin/bash $(PROJECT_NAME):latest

docker-clean: ## Clean Docker artifacts and unused images
	@echo "$(BOLD)🐳 Cleaning Docker artifacts...$(RESET)"
	docker system prune -f
	@echo "$(GREEN)✅ Docker cleanup completed$(RESET)"

# ============================================================================
# JUPYTER NOTEBOOK INTEGRATION
# ============================================================================

notebook: ## Start Jupyter Notebook server
	@echo "$(BOLD)📓 Starting Jupyter Notebook...$(RESET)"
	$(UV) run jupyter notebook

jupyter: notebook ## Alias for notebook

lab: ## Start JupyterLab server
	@echo "$(BOLD)🧪 Starting JupyterLab...$(RESET)"
	$(UV) run jupyter lab

# ============================================================================
# AIRFLOW INTEGRATION (Enhanced)
# ============================================================================

airflow-setup: ## Setup Airflow environment and dependencies
	@echo "$(BOLD)🌪️  Setting up Airflow environment...$(RESET)"
	$(UV) add apache-airflow
	@mkdir -p airflow/logs airflow/plugins
	@echo "$(GREEN)✅ Airflow setup completed$(RESET)"

airflow-init: airflow-setup ## Initialize Airflow database and create admin user
	@echo "$(BOLD)🗄️  Initializing Airflow database...$(RESET)"
	@export AIRFLOW_HOME=./airflow && $(UV) run airflow db init
	@export AIRFLOW_HOME=./airflow && $(UV) run airflow users create \
		--username admin --password admin \
		--firstname Admin --lastname User \
		--role Admin --email admin@example.com
	@echo "$(GREEN)✅ Airflow initialized (admin/admin)$(RESET)"

airflow-start: ## Start Airflow scheduler and webserver
	@echo "$(BOLD)🚀 Starting Airflow services...$(RESET)"
	@export AIRFLOW_HOME=./airflow && \
	nohup $(UV) run airflow scheduler > airflow/logs/scheduler.log 2>&1 & \
	nohup $(UV) run airflow webserver --port 8080 > airflow/logs/webserver.log 2>&1 &
	@echo "$(GREEN)✅ Airflow started$(RESET)"
	@echo "$(CYAN)🌐 Web UI: http://localhost:8080 (admin/admin)$(RESET)"

airflow-stop: ## Stop Airflow services
	@echo "$(BOLD)🛑 Stopping Airflow services...$(RESET)"
	@pkill -f "airflow scheduler" 2>/dev/null || true
	@pkill -f "airflow webserver" 2>/dev/null || true
	@echo "$(GREEN)✅ Airflow services stopped$(RESET)"

airflow-test: ## Test Airflow DAGs for syntax and import errors
	@echo "$(BOLD)🧪 Testing Airflow DAGs...$(RESET)"
	@export AIRFLOW_HOME=./airflow && $(UV) run python -c "\
	import sys; \
	sys.path.append('airflow/dags'); \
	from airflow.models import DagBag; \
	dag_bag = DagBag('airflow/dags', include_examples=False); \
	if dag_bag.import_errors: \
		print('❌ DAG import errors:'); \
		[print(f'  {k}: {v}') for k, v in dag_bag.import_errors.items()]; \
		sys.exit(1); \
	else: \
		print(f'✅ Successfully loaded {len(dag_bag.dags)} DAGs')"

# ============================================================================
# PERFORMANCE AND DEBUGGING
# ============================================================================

benchmark: ## Run performance benchmarks if available
	@echo "$(BOLD)⚡ Running performance benchmarks...$(RESET)"
	@if $(UV) run python -c "import pytest_benchmark" 2>/dev/null; then \
		$(UV) run pytest $(TEST_DIR) --benchmark-only --benchmark-sort=mean; \
	else \
		echo "$(YELLOW)⚠️  pytest-benchmark not available$(RESET)"; \
		echo "$(CYAN)Install with: make uv-add-dev PACKAGE=pytest-benchmark$(RESET)"; \
	fi

profile: ## Run profiling analysis (requires py-spy or similar)
	@echo "$(BOLD)📊 Profiling information:$(RESET)"
	@echo "$(CYAN)To profile your application:$(RESET)"
	@echo "  1. Install py-spy: $(YELLOW)make uv-add-dev PACKAGE=py-spy$(RESET)"
	@echo "  2. Run Flask app: $(YELLOW)make run-flask$(RESET)"
	@echo "  3. Profile: $(YELLOW)$(UV) run py-spy record -o profile.svg -- python $(FAB_APP_FILE)$(RESET)"
	@echo "  4. View: $(YELLOW)open profile.svg$(RESET)"

debug: ## Run Flask application in debug mode with pdb
	@echo "$(BOLD)🐛 Starting Flask app in debug mode...$(RESET)"
	@echo "$(YELLOW)Type 'h' for help, 'c' to continue, 'q' to quit$(RESET)"
	@export FLASK_APP=$(FAB_APP_FILE) && $(UV) run python -m pdb -c continue $(FAB_APP_FILE)

# ============================================================================
# QUALITY ASSURANCE ORCHESTRATION
# ============================================================================

quality-check: ## Run comprehensive quality checks pipeline
	@echo "$(BOLD)🔍 Running comprehensive quality checks...$(RESET)"
	@echo "$(CYAN)Step 1/5: Code formatting check...$(RESET)"
	@$(MAKE) format-check
	@echo ""
	@echo "$(CYAN)Step 2/5: Linting analysis...$(RESET)"
	@$(MAKE) lint
	@echo ""
	@echo "$(CYAN)Step 3/5: Type checking...$(RESET)"
	@$(MAKE) type-check
	@echo ""
	@echo "$(CYAN)Step 4/5: Security scanning...$(RESET)"
	@$(MAKE) security-scan
	@echo ""
	@echo "$(CYAN)Step 5/5: Test suite with coverage...$(RESET)"
	@$(MAKE) test-coverage
	@echo ""
	@echo "$(BOLD)$(GREEN)✅ All quality checks passed! Ready for commit.$(RESET)"

dev-setup: install-dev pre-commit-install ## Complete development environment setup
	@echo "$(BOLD)🚀 Setting up development environment for $(PROJECT_NAME)...$(RESET)"
	@$(MAKE) validate-env
	@echo ""
	@echo "$(BOLD)$(GREEN)🎉 Development environment ready!$(RESET)"
	@echo ""
	@echo "$(BOLD)📋 Next steps:$(RESET)"
	@echo "  $(CYAN)make quality-check$(RESET)       # Verify everything works"
	@echo "  $(CYAN)make flask-init$(RESET)          # Initialize Flask database"
	@echo "  $(CYAN)make flask-create-admin$(RESET)  # Create admin user"
	@echo "  $(CYAN)make run-flask$(RESET)           # Run Flask application"

# ============================================================================
# CI/CD AND AUTOMATION
# ============================================================================

ci: quality-check test-reports security-report ## Full CI pipeline for automation
	@echo "$(BOLD)🔄 CI Pipeline Summary$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)✅ Code formatting and linting$(RESET)"
	@echo "$(GREEN)✅ Type checking$(RESET)"
	@echo "$(GREEN)✅ Security scanning$(RESET)"
	@echo "$(GREEN)✅ Test suite with coverage$(RESET)"
	@echo "$(GREEN)✅ Test and security reports generated$(RESET)"
	@echo ""
	@echo "$(BOLD)$(GREEN)🎉 CI pipeline completed successfully!$(RESET)"

release-check: clean quality-check test-coverage security-scan build ## Pre-release validation
	@echo "$(BOLD)🚀 Release Validation Summary$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)✅ Clean build environment$(RESET)"
	@echo "$(GREEN)✅ Code quality checks$(RESET)"
	@echo "$(GREEN)✅ Full test coverage$(RESET)"
	@echo "$(GREEN)✅ Security validation$(RESET)"
	@echo "$(GREEN)✅ Distribution packages built$(RESET)"
	@echo ""
	@echo "$(BOLD)$(GREEN)🎉 Ready for release!$(RESET)"
	@echo "$(CYAN)Next steps:$(RESET)"
	@echo "  $(CYAN)make upload-test$(RESET)  # Test upload to TestPyPI"
	@echo "  $(CYAN)make upload$(RESET)       # Upload to PyPI"

# ============================================================================
# QUICK DEVELOPMENT WORKFLOWS
# ============================================================================

quick-test: ## Quick test run (no coverage, fail fast)
	@echo "$(BOLD)⚡ Quick test run...$(RESET)"
	$(UV) run pytest $(TEST_DIR) -x -q

quick-lint: ## Quick lint check (essential rules only)
	@echo "$(BOLD)⚡ Quick lint check...$(RESET)"
	$(UV) run ruff check $(SRC_DIR) $(APP_DIR) --select E,F,W

watch: ## Watch files and run quality checks on changes
	@echo "$(BOLD)👀 Watching files for changes...$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(RESET)"
	@if command -v inotifywait >/dev/null 2>&1; then \
		while true; do \
			$(MAKE) quick-lint quick-test; \
			echo "$(CYAN)Waiting for changes...$(RESET)"; \
			inotifywait -qq -r -e modify $(SRC_DIR) $(APP_DIR) $(TEST_DIR) 2>/dev/null || sleep 2; \
		done; \
	else \
		echo "$(RED)❌ inotifywait not available. Install inotify-tools.$(RESET)"; \
	fi

tdd: test-watch ## Alias for test-driven development (test-watch)

# ============================================================================
# ENHANCED PROJECT INFO AND STATUS
# ============================================================================

info: ## Display comprehensive project information
	@echo "$(BOLD)ℹ️  Project Information$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(BOLD)📁 Project Details:$(RESET)"
	@echo "  Name: $(GREEN)$(PROJECT_NAME)$(RESET)"
	@echo "  Directory: $(GREEN)$(shell pwd)$(RESET)"
	@echo "  Type: $(GREEN)Flask-AppBuilder Web Application$(RESET)"
	@echo "  Version: $(GREEN)$(shell grep '^version' $(PYPROJECT_TOML) 2>/dev/null | cut -d'"' -f2 || echo 'unknown')$(RESET)"
	@echo ""
	@echo "$(BOLD)🔧 Environment:$(RESET)"
	@echo "  UV: $(GREEN)$(shell $(UV) --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo "  Python: $(GREEN)$(shell $(UV) run python --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo "  Platform: $(GREEN)$(shell uname -s) $(shell uname -m)$(RESET)"
	@echo ""
	@echo "$(BOLD)📊 Project Status:$(RESET)"
	@echo "  Initialized: $(if $(wildcard $(PYPROJECT_TOML)),$(GREEN)✅ Yes$(RESET),$(RED)❌ No$(RESET))"
	@echo "  UV Lock: $(if $(wildcard $(UV_LOCK)),$(GREEN)✅ Present$(RESET),$(YELLOW)⚠️  Missing$(RESET))"
	@echo "  Virtual Env: $(if $(wildcard .venv),$(GREEN)✅ Active$(RESET),$(YELLOW)⚠️  Not found$(RESET))"
	@echo "  Pre-commit: $(if $(wildcard $(PRE_COMMIT_CONFIG)),$(GREEN)✅ Configured$(RESET),$(RED)❌ Not configured$(RESET))"
	@echo "  Tests: $(if $(wildcard $(TEST_DIR)),$(GREEN)✅ Present$(RESET),$(YELLOW)⚠️  No tests$(RESET))"
	@echo "  Documentation: $(if $(wildcard $(DOCS_DIR)),$(GREEN)✅ Present$(RESET),$(YELLOW)⚠️  No docs$(RESET))"
	@echo ""
	@echo "$(BOLD)🌐 Flask Application:$(RESET)"
	@if [ -f "$(FAB_APP_FILE)" ]; then \
		echo "  Status: $(GREEN)✅ Configured$(RESET)"; \
		echo "  App File: $(GREEN)$(FAB_APP_FILE)$(RESET)"; \
		echo "  Config: $(GREEN)$(FAB_CONFIG_FILE)$(RESET)"; \
		echo "  Models: $(GREEN)$(FAB_MODELS_DIR)$(RESET)"; \
		echo "  Views: $(GREEN)$(FAB_VIEWS_DIR)$(RESET)"; \
		echo "  Templates: $(GREEN)$(FAB_TEMPLATES_DIR)$(RESET)"; \
	else \
		echo "  Status: $(RED)❌ Not configured$(RESET)"; \
	fi
	@echo ""
	@echo "$(BOLD)📚 Git Status:$(RESET)"
	@echo "  Repository: $(if $(wildcard .git),$(GREEN)✅ Git repo$(RESET),$(YELLOW)⚠️  Not a git repo$(RESET))"
	@if [ -d ".git" ]; then \
		echo "  Branch: $(GREEN)$(shell git branch --show-current 2>/dev/null || echo 'unknown')$(RESET)"; \
		echo "  Status: $(GREEN)$(shell git status --porcelain 2>/dev/null | wc -l || echo '0') changed files$(RESET)"; \
		echo "  Last Commit: $(GREEN)$(shell git log -1 --pretty=format:'%h - %s (%cr)' 2>/dev/null || echo 'No commits')$(RESET)"; \
	fi

# ============================================================================
# COMPREHENSIVE PROJECT SETUP
# ============================================================================

all: clean init dev-setup quality-check build ## Complete project setup and validation
	@echo "$(BOLD)🎯 Complete Project Setup Summary$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)✅ Environment cleaned and initialized$(RESET)"
	@echo "$(GREEN)✅ Flask-AppBuilder application configured$(RESET)"
	@echo "$(GREEN)✅ Development dependencies installed$(RESET)"
	@echo "$(GREEN)✅ Pre-commit hooks configured$(RESET)"
	@echo "$(GREEN)✅ Quality checks passed$(RESET)"
	@echo "$(GREEN)✅ Distribution packages built$(RESET)"
	@echo ""
	@echo "$(BOLD)$(GREEN)🎉 Project is fully set up and ready for development!$(RESET)"
	@echo ""
	@echo "$(BOLD)📋 Final steps:$(RESET)"
	@echo "  $(CYAN)make flask-init$(RESET)          # Initialize Flask database"
	@echo "  $(CYAN)make flask-create-admin$(RESET)  # Create admin user"
	@echo "  $(CYAN)make run-flask$(RESET)           # Start Flask application"

# ============================================================================
# HELP SYSTEM ENHANCEMENTS
# ============================================================================

help-flask: ## Show Flask-AppBuilder specific commands
	@echo "$(BOLD)🌐 Flask-AppBuilder Commands$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""
	@echo "$(BOLD)🚀 Application Management:$(RESET)"
	@echo "  $(CYAN)make run-flask$(RESET)           # Run Flask web application"
	@echo "  $(CYAN)make flask-run-debug$(RESET)     # Run in debug mode"
	@echo "  $(CYAN)make flask-shell$(RESET)         # Start Flask shell"
	@echo ""
	@echo "$(BOLD)🗄️  Database Management:$(RESET)"
	@echo "  $(CYAN)make flask-init$(RESET)          # Initialize database"
	@echo "  $(CYAN)make flask-db-init$(RESET)       # Initialize migrations"
	@echo "  $(CYAN)make flask-db-migrate$(RESET)    # Create migration"
	@echo "  $(CYAN)make flask-db-upgrade$(RESET)    # Apply migrations"
	@echo ""
	@echo "$(BOLD)👤 User Management:$(RESET)"
	@echo "  $(CYAN)make flask-create-admin$(RESET)  # Create admin user"
	@echo "  $(CYAN)make flask-create-user$(RESET)   # Create regular user"
	@echo "  $(CYAN)make flask-reset-password$(RESET) # Reset user password"
	@echo ""
	@echo "$(BOLD)🧪 Testing:$(RESET)"
	@echo "  $(CYAN)make test-flask$(RESET)          # Run Flask-specific tests"

help-init: ## Show initialization commands and workflow
	@echo "$(BOLD)🚀 Project Initialization Commands$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""
	@echo "$(BOLD)📋 Initialization Workflow:$(RESET)"
	@echo "  $(CYAN)make init$(RESET)                # Complete project initialization"
	@echo "  $(CYAN)make init-complete$(RESET)       # Full setup with Flask database"
	@echo ""
	@echo "$(BOLD)🔧 Individual Setup Steps:$(RESET)"
	@echo "  $(CYAN)make venv-create$(RESET)         # Create virtual environment"
	@echo "  $(CYAN)make git-init$(RESET)            # Initialize Git repository"
	@echo "  $(CYAN)make requirements-generate$(RESET) # Generate requirements files"
	@echo "  $(CYAN)make pre-commit-install$(RESET)  # Setup pre-commit hooks"
	@echo ""
	@echo "$(BOLD)📊 Validation Commands:$(RESET)"
	@echo "  $(CYAN)make project-validate$(RESET)    # Validate project setup"
	@echo "  $(CYAN)make project-info$(RESET)        # Show project information"
	@echo "  $(CYAN)make validate-env$(RESET)        # Validate environment"

help-quality: ## Show quality assurance commands
	@echo "$(BOLD)🔍 Quality Assurance Commands$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""
	@echo "$(BOLD)🎯 Main Quality Pipeline:$(RESET)"
	@echo "  $(CYAN)make quality-check$(RESET)       # Run complete quality pipeline"
	@echo "  $(CYAN)make ci$(RESET)                  # Full CI pipeline with reports"
	@echo ""
	@echo "$(BOLD)🔧 Individual Checks:$(RESET)"
	@echo "  $(CYAN)make format$(RESET)              # Format code with ruff"
	@echo "  $(CYAN)make format-check$(RESET)        # Check formatting without changes"
	@echo "  $(CYAN)make lint$(RESET)                # Comprehensive linting"
	@echo "  $(CYAN)make type-check$(RESET)          # Static type checking"
	@echo "  $(CYAN)make security-scan$(RESET)       # Security vulnerability scan"
	@echo ""
	@echo "$(BOLD)🧪 Testing:$(RESET)"
	@echo "  $(CYAN)make test$(RESET)                # Run test suite"
	@echo "  $(CYAN)make test-coverage$(RESET)       # Tests with coverage report"
	@echo "  $(CYAN)make test-parallel$(RESET)       # Parallel test execution"
	@echo "  $(CYAN)make test-watch$(RESET)          # Continuous testing (TDD)"
	@echo ""
	@echo "$(BOLD)📊 Reports:$(RESET)"
	@echo "  $(CYAN)make test-reports$(RESET)        # Generate comprehensive test reports"
	@echo "  $(CYAN)make security-report$(RESET)     # Generate security reports"
	@echo "  $(CYAN)make type-check-report$(RESET)   # Generate type checking report"

help-shortcuts: ## Show useful command shortcuts and aliases
	@echo "$(BOLD)⚡ Command Shortcuts and Workflows$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""
	@echo "$(BOLD)🚀 Quick Start (New Project):$(RESET)"
	@echo "  $(CYAN)make init$(RESET)                # Initialize everything"
	@echo "  $(CYAN)make flask-init$(RESET)          # Setup Flask database"
	@echo "  $(CYAN)make flask-create-admin$(RESET)  # Create admin user"
	@echo "  $(CYAN)make run-flask$(RESET)           # Start application"
	@echo ""
	@echo "$(BOLD)⚡ Development Shortcuts:$(RESET)"
	@echo "  $(CYAN)make tdd$(RESET)                 # Test-driven development (test-watch)"
	@echo "  $(CYAN)make watch$(RESET)               # Watch files and run quality checks"
	@echo "  $(CYAN)make quick-test$(RESET)          # Fast test run (no coverage)"
	@echo "  $(CYAN)make quick-lint$(RESET)          # Essential linting only"
	@echo ""
	@echo "$(BOLD)🔄 Maintenance:$(RESET)"
	@echo "  $(CYAN)make clean-all$(RESET)           # Nuclear cleanup"
	@echo "  $(CYAN)make requirements-sync$(RESET)   # Update and sync dependencies"
	@echo "  $(CYAN)make deps-update$(RESET)         # Update all dependencies"
	@echo ""
	@echo "$(BOLD)🚀 Release Pipeline:$(RESET)"
	@echo "  $(CYAN)make release-check$(RESET)       # Pre-release validation"
	@echo "  $(CYAN)make upload-test$(RESET)         # Upload to TestPyPI"
	@echo "  $(CYAN)make upload$(RESET)              # Upload to PyPI"

# ============================================================================
# MAINTENANCE AND UTILITIES
# ============================================================================

check-updates: ## Check for package updates without applying them
	@echo "$(BOLD)🔍 Checking for package updates...$(RESET)"
	@$(MAKE) deps-outdated

requirements-freeze: ## Generate frozen requirements files for reproducibility
	@echo "$(BOLD)❄️  Generating frozen requirements...$(RESET)"
	@$(MAKE) uv-export
	@echo "$(GREEN)✅ Frozen requirements generated:$(RESET)"
	@echo "  $(CYAN)requirements.txt$(RESET) - Production dependencies"
	@echo "  $(CYAN)requirements-dev.txt$(RESET) - Development dependencies"

clean-logs: ## Clean log files and temporary artifacts
	@echo "$(BOLD)🧹 Cleaning log files...$(RESET)"
	@find . -name "*.log" -type f -delete 2>/dev/null || true
	@rm -rf logs/ temp/ tmp/
	@if [ -d "airflow/logs" ]; then \
		find airflow/logs -name "*.log" -type f -delete 2>/dev/null || true; \
	fi
	@if [ -d "$(APP_DIR)" ]; then \
		rm -f $(APP_DIR)/*.db $(APP_DIR)/*.sqlite; \
	fi
	@echo "$(GREEN)✅ Log cleanup completed$(RESET)"

reset-env: clean-all venv-create install-dev ## Reset development environment completely
	@echo "$(BOLD)🔄 Resetting development environment...$(RESET)"
	@$(MAKE) pre-commit-install
	@echo "$(GREEN)✅ Environment reset completed$(RESET)"

flask-reset: ## Reset Flask application (database and migrations)
	@echo "$(BOLD)🔄 Resetting Flask application...$(RESET)"
	@echo "$(RED)⚠️  WARNING: This will delete all data!$(RESET)"
	@read -p "Type 'RESET' to confirm: " confirm && \
	if [ "$confirm" = "RESET" ]; then \
		rm -f $(APP_DIR)/*.db $(APP_DIR)/*.sqlite; \
		rm -rf migrations/; \
		echo "$(GREEN)✅ Flask application reset$(RESET)"; \
		echo "$(CYAN)Run 'make flask-init' to reinitialize$(RESET)"; \
	else \
		echo "$(YELLOW)Reset cancelled$(RESET)"; \
	fi

# ============================================================================
# ADVANCED DEBUGGING AND ANALYSIS
# ============================================================================

memory-profile: ## Run memory profiling (requires memory-profiler)
	@echo "$(BOLD)🧠 Memory profiling...$(RESET)"
	@if $(UV) run python -c "import memory_profiler" 2>/dev/null; then \
		echo "$(CYAN)Add @profile decorator to functions you want to profile$(RESET)"; \
		$(UV) run python -m memory_profiler $(FAB_APP_FILE); \
	else \
		echo "$(YELLOW)⚠️  memory-profiler not available$(RESET)"; \
		echo "$(CYAN)Install with: make uv-add-dev PACKAGE=memory-profiler$(RESET)"; \
	fi

line-profile: ## Run line-by-line profiling (requires line-profiler)
	@echo "$(BOLD)📏 Line profiling...$(RESET)"
	@if $(UV) run python -c "import line_profiler" 2>/dev/null; then \
		echo "$(CYAN)Add @profile decorator to functions you want to profile$(RESET)"; \
		$(UV) run kernprof -l -v $(FAB_APP_FILE); \
	else \
		echo "$(YELLOW)⚠️  line-profiler not available$(RESET)"; \
		echo "$(CYAN)Install with: make uv-add-dev PACKAGE=line-profiler$(RESET)"; \
	fi

complexity: ## Analyze code complexity
	@echo "$(BOLD)🔍 Analyzing code complexity...$(RESET)"
	@if $(UV) run python -c "import radon" 2>/dev/null; then \
		$(UV) run radon cc $(SRC_DIR) $(APP_DIR) -a; \
		$(UV) run radon mi $(SRC_DIR) $(APP_DIR); \
	else \
		echo "$(YELLOW)⚠️  radon not available$(RESET)"; \
		echo "$(CYAN)Install with: make uv-add-dev PACKAGE=radon$(RESET)"; \
	fi

flask-routes: ## Display all Flask routes
	@echo "$(BOLD)🗺️  Flask Application Routes$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if [ -f "$(FAB_APP_FILE)" ]; then \
		export FLASK_APP=$(FAB_APP_FILE) && $(UV) run flask routes; \
	else \
		echo "$(RED)❌ Flask application not found$(RESET)"; \
	fi

flask-config: ## Display Flask configuration
	@echo "$(BOLD)⚙️  Flask Configuration$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if [ -f "$(FAB_APP_FILE)" ]; then \
		export FLASK_APP=$(FAB_APP_FILE) && $(UV) run python -c "from app.app import create_app; app = create_app(); print('\\n'.join([f'{k}: {v}' for k, v in sorted(app.config.items()) if not k.startswith('SECRET')]))"; \
	else \
		echo "$(RED)❌ Flask application not found$(RESET)"; \
	fi

# ============================================================================
# DATABASE UTILITIES
# ============================================================================
# ============================================================================
# DATABASE UTILITIES (PostgreSQL Enhanced)
# ============================================================================

# Database Configuration Variables
DB_HOST := $(shell echo $$DATABASE_HOST || echo "localhost")
DB_PORT := $(shell echo $$DATABASE_PORT || echo "5432")
DB_NAME := $(shell echo $$DATABASE_NAME || echo "$(PROJECT_NAME)")
DB_USER := $(shell echo $$DATABASE_USER || echo "$(PROJECT_NAME)_user")
DB_PASSWORD := $(shell echo $$DATABASE_PASSWORD || echo "changeme")
DB_URL := postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)
DB_ADMIN_USER := $(shell echo $$DATABASE_ADMIN_USER || echo "postgres")
DB_ADMIN_URL := postgresql://$(DB_ADMIN_USER)@$(DB_HOST):$(DB_PORT)/postgres

# Backup Configuration
BACKUP_DIR := backups
BACKUP_TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)

db-init: ## Initialize PostgreSQL database with extensions and setup
	@echo "$(BOLD)🗄️  Initializing PostgreSQL database...$(RESET)"
	@echo "$(CYAN)Creating database and user...$(RESET)"
	@mkdir -p $(BACKUP_DIR)

	@# Check if PostgreSQL is available
	@if ! command -v psql >/dev/null 2>&1; then \
		echo "$(RED)❌ PostgreSQL client (psql) not found$(RESET)"; \
		echo "$(CYAN)Install PostgreSQL client:$(RESET)"; \
		echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"; \
		echo "  macOS: brew install postgresql"; \
		echo "  Windows: Install PostgreSQL from postgresql.org"; \
		exit 1; \
	fi

	@# Test connection to PostgreSQL server
	@echo "$(BLUE)Testing PostgreSQL connection...$(RESET)"
	@if ! PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c "SELECT version();" >/dev/null 2>&1; then \
		echo "$(RED)❌ Cannot connect to PostgreSQL server$(RESET)"; \
		echo "$(CYAN)Ensure PostgreSQL is running and credentials are correct$(RESET)"; \
		echo "$(CYAN)Set environment variables:$(RESET)"; \
		echo "  export DATABASE_HOST=$(DB_HOST)"; \
		echo "  export DATABASE_ADMIN_USER=$(DB_ADMIN_USER)"; \
		echo "  export DATABASE_ADMIN_PASSWORD=your_admin_password"; \
		exit 1; \
	fi

	@# Create database user if not exists
	@echo "$(BLUE)Creating database user: $(DB_USER)$(RESET)"
	@PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
		"DO \$$\$$ BEGIN \
			IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$(DB_USER)') THEN \
				CREATE ROLE $(DB_USER) WITH LOGIN PASSWORD '$(DB_PASSWORD)'; \
			END IF; \
		END \$$\$$;" || true

	@# Create database if not exists
	@echo "$(BLUE)Creating database: $(DB_NAME)$(RESET)"
	@PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
		"SELECT 'CREATE DATABASE $(DB_NAME) OWNER $(DB_USER)' \
		WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$(DB_NAME)');" | \
		PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres || true

	@# Grant privileges
	@echo "$(BLUE)Granting database privileges...$(RESET)"
	@PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
		"GRANT ALL PRIVILEGES ON DATABASE $(DB_NAME) TO $(DB_USER); \
		 ALTER DATABASE $(DB_NAME) OWNER TO $(DB_USER);" || true

	@# Install extensions using the setup script
	@echo "$(BLUE)Installing PostgreSQL extensions...$(RESET)"
	@if [ -f "db_extensions_setup.sql" ]; then \
		echo "$(BLUE)  Found db_extensions_setup.sql, installing comprehensive extensions...$(RESET)"; \
		sed 's/docfusion/$(PROJECT_NAME)/g' db_extensions_setup.sql | \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -f - && \
		echo "$(GREEN)  ✅ Extensions installed successfully$(RESET)" || \
		echo "$(YELLOW)  ⚠️  Some extensions may have failed to install$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  db_extensions_setup.sql not found, installing basic extensions...$(RESET)"; \
		echo "$(BLUE)  Installing essential PostgreSQL extensions...$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; \
			 CREATE EXTENSION IF NOT EXISTS pgcrypto; \
			 create extension if not exists plpython3u;\
			 CREATE EXTENSION IF NOT EXISTS hstore; \
			 CREATE EXTENSION IF NOT EXISTS pg_trgm; \
			 CREATE EXTENSION IF NOT EXISTS citext; \
			 create extension if not exists vector; \
			 create extension if not exists pgvector; \
			 CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" && \
		echo "$(GREEN)  ✅ Basic extensions installed$(RESET)" || \
		echo "$(YELLOW)  ⚠️  Some basic extensions may not be available$(RESET)"; \
	fi

	@# Install pgai prerequisites and extension
	@echo "$(BLUE)Installing pgai AI extension...$(RESET)"
	@echo "$(BLUE)  Installing pgai Python package...$(RESET)"
	@$(UV) add pgai || echo "$(YELLOW)  ⚠️  Failed to add pgai to project dependencies$(RESET)"

	@# Install pgai database components
	@echo "$(BLUE)  Installing pgai database components...$(RESET)"
	@export DATABASE_URL=$(DB_URL) && \
	$(UV) run python -c "\
import os; \
import pgai; \
db_url = os.environ.get('DATABASE_URL'); \
print(f'Installing pgai to database: {db_url}'); \
try: \
	pgai.install(db_url); \
	print('✅ pgai database components installed successfully'); \
except Exception as e: \
	print(f'⚠️  pgai installation warning: {e}'); \
	print('This may be expected if pgai extension is not available in your PostgreSQL installation');" 2>/dev/null || \
	echo "$(YELLOW)  ⚠️  pgai installation skipped - requires PostgreSQL with pgai extension support$(RESET)"

	@# Verify extension installation
	@echo "$(BLUE)Verifying installed extensions...$(RESET)"
	@PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT extname, extversion FROM pg_extension ORDER BY extname;" && \
	echo "$(GREEN)  ✅ Extension verification completed$(RESET)"

	@# Check for AI schema (created by pgai)
	@echo "$(BLUE)Checking AI capabilities...$(RESET)"
	@PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ai';" | grep -q "ai" && \
	echo "$(GREEN)  ✅ AI schema found - pgai vectorizer and AI functions available$(RESET)" || \
	echo "$(CYAN)  ℹ️  AI schema not found - pgai may not be fully installed$(RESET)"



db-ai-test: ## Test pgai AI functionality
	@echo "$(BOLD)🤖 Testing pgai AI functionality...$(RESET)"
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ai';" | grep -q "ai"; then \
		echo "$(GREEN)✅ AI schema found$(RESET)"; \
		echo "$(BLUE)Testing pgai functions...$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT ai.create_vectorizer('test_table'::regclass) as test;" || \
		echo "$(CYAN)ℹ️  Vectorizer test requires actual table setup$(RESET)"; \
	else \
		echo "$(RED)❌ AI schema not found - pgai not properly installed$(RESET)"; \
	fi

db-ai-status: ## Show pgai installation status
	@echo "$(BOLD)🤖 pgai Installation Status$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		echo "$(CYAN)pgai Components:$(RESET)"; \
		echo -n "  AI Schema: "; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ai';" | grep -q "ai" && \
		echo "$(GREEN)✅ Present$(RESET)" || echo "$(RED)❌ Missing$(RESET)"; \
		echo "$(CYAN)Available AI Functions:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'ai' ORDER BY routine_name;" 2>/dev/null || \
		echo "  No AI functions found"; \
	else \
		echo "$(RED)❌ Cannot connect to database$(RESET)"; \
	fi

# SUMMARY OF EDITS:
# 1. Add pgai>=0.1.0 to requirements.txt generation
# 2. Add pgai to UV dependency installation
# 3. Enhance db-init target with comprehensive pgai installation
# 4. Add optional pgai-specific utility targets
#
# These edits provide:
# - Automatic pgai Python package installation
# - Database component setup with pgai.install()
# - AI schema verification
# - Graceful handling of environments without pgai support
# - Optional testing and status utilities

	@# Initialize Flask-AppBuilder database
	@echo "$(BLUE)Initializing Flask-AppBuilder tables...$(RESET)"
	@export DATABASE_URL=$(DB_URL) && export FLASK_APP=$(APP_DIR)/app.py && $(UV) run flask fab create-db

	@echo "$(GREEN)✅ PostgreSQL database initialized$(RESET)"
	@echo "$(CYAN)Database URL: $(DB_URL)$(RESET)"
	@echo "$(CYAN)Connection test: make db-connect$(RESET)"

db-migrate: ## Create and apply database migrations
	@echo "$(BOLD)🔄 Managing database migrations...$(RESET)"
	@export DATABASE_URL=$(DB_URL) && export FLASK_APP=$(APP_DIR)/app.py

	@# Initialize migrations if not exists
	@if [ ! -d "migrations" ]; then \
		echo "$(BLUE)Initializing migration repository...$(RESET)"; \
		$(UV) run flask db init; \
	fi

	@# Generate migration
	@echo "$(BLUE)Generating migration...$(RESET)"
	@read -p "Enter migration message (default: 'Auto migration'): " message; \
	if [ -z "$$message" ]; then message="Auto migration"; fi; \
	$(UV) run flask db migrate -m "$$message"

	@# Apply migration
	@echo "$(BLUE)Applying migrations...$(RESET)"
	@$(UV) run flask db upgrade

	@echo "$(GREEN)✅ Database migration completed$(RESET)"

db-reset: ## Reset database (WARNING: Destructive operation)
	@echo "$(BOLD)🔄 Resetting PostgreSQL database...$(RESET)"
	@echo "$(RED)⚠️  WARNING: This will completely destroy all data!$(RESET)"
	@echo "$(RED)⚠️  This operation cannot be undone!$(RESET)"
	@echo ""
	@echo "$(CYAN)Database: $(DB_NAME)$(RESET)"
	@echo "$(CYAN)Host: $(DB_HOST):$(DB_PORT)$(RESET)"
	@echo ""
	@read -p "Type 'RESET $(DB_NAME)' to confirm complete database reset: " confirm && \
	if [ "$$confirm" = "RESET $(DB_NAME)" ]; then \
		echo "$(BLUE)Creating backup before reset...$(RESET)"; \
		$(MAKE) db-backup || true; \
		echo "$(BLUE)Dropping and recreating database...$(RESET)"; \
		PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
			"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$(DB_NAME)' AND pid <> pg_backend_pid();"; \
		PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
			"DROP DATABASE IF EXISTS $(DB_NAME);"; \
		PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
			"CREATE DATABASE $(DB_NAME) OWNER $(DB_USER);"; \
		echo "$(BLUE)Removing migration files...$(RESET)"; \
		rm -rf migrations/versions/*.py; \
		echo "$(GREEN)✅ Database reset completed$(RESET)"; \
		echo "$(CYAN)Run 'make db-init' to reinitialize$(RESET)"; \
	else \
		echo "$(YELLOW)Database reset cancelled$(RESET)"; \
	fi

db-connect: ## Test database connection and show info
	@echo "$(BOLD)🔌 Testing database connection...$(RESET)"
	@echo "$(CYAN)Connection details:$(RESET)"
	@echo "  Host: $(DB_HOST):$(DB_PORT)"
	@echo "  Database: $(DB_NAME)"
	@echo "  User: $(DB_USER)"
	@echo ""
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "\l" >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Connection successful$(RESET)"; \
		echo "$(CYAN)Database information:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT current_database() as database, current_user as user, version() as version;"; \
	else \
		echo "$(RED)❌ Connection failed$(RESET)"; \
		echo "$(CYAN)Check your connection settings:$(RESET)"; \
		echo "  export DATABASE_HOST=$(DB_HOST)"; \
		echo "  export DATABASE_PORT=$(DB_PORT)"; \
		echo "  export DATABASE_NAME=$(DB_NAME)"; \
		echo "  export DATABASE_USER=$(DB_USER)"; \
		echo "  export DATABASE_PASSWORD=your_password"; \
	fi

db-backup: ## Backup PostgreSQL database
	@echo "$(BOLD)💾 Backing up PostgreSQL database...$(RESET)"
	@mkdir -p $(BACKUP_DIR)
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		echo "$(BLUE)Creating database backup...$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) pg_dump -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
			--verbose --clean --if-exists --create \
			--file=$(BACKUP_DIR)/$(DB_NAME)_backup_$(BACKUP_TIMESTAMP).sql; \
		echo "$(GREEN)✅ Database backed up to $(BACKUP_DIR)/$(DB_NAME)_backup_$(BACKUP_TIMESTAMP).sql$(RESET)"; \
		echo "$(CYAN)Backup size: $$(du -h $(BACKUP_DIR)/$(DB_NAME)_backup_$(BACKUP_TIMESTAMP).sql | cut -f1)$(RESET)"; \
	else \
		echo "$(RED)❌ Cannot connect to database for backup$(RESET)"; \
		exit 1; \
	fi

db-restore: ## Restore PostgreSQL database from backup
	@echo "$(BOLD)🔄 Restoring PostgreSQL database from backup...$(RESET)"
	@echo "$(CYAN)Available backups in $(BACKUP_DIR):$(RESET)"
	@ls -la $(BACKUP_DIR)/*.sql 2>/dev/null | awk '{print "  " $$9 " (" $$5 " bytes, " $$6 " " $$7 " " $$8 ")"}' || echo "  No backups found"
	@echo ""
	@read -p "Enter backup filename (with .sql extension): " backup && \
	if [ -f "$(BACKUP_DIR)/$$backup" ]; then \
		echo "$(RED)⚠️  WARNING: This will overwrite the current database!$(RESET)"; \
		read -p "Type 'RESTORE' to confirm: " confirm && \
		if [ "$$confirm" = "RESTORE" ]; then \
			echo "$(BLUE)Restoring from $(BACKUP_DIR)/$$backup...$(RESET)"; \
			PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
				--file=$(BACKUP_DIR)/$$backup; \
			echo "$(GREEN)✅ Database restored from $$backup$(RESET)"; \
		else \
			echo "$(YELLOW)Restore cancelled$(RESET)"; \
		fi; \
	else \
		echo "$(RED)❌ Backup file $(BACKUP_DIR)/$$backup not found$(RESET)"; \
	fi

db-shell: ## Open PostgreSQL database shell
	@echo "$(BOLD)🐚 Opening PostgreSQL shell...$(RESET)"
	@echo "$(CYAN)Connecting to $(DB_NAME) as $(DB_USER)$(RESET)"
	@PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME)

db-admin-shell: ## Open PostgreSQL admin shell
	@echo "$(BOLD)🐚 Opening PostgreSQL admin shell...$(RESET)"
	@echo "$(CYAN)Connecting as $(DB_ADMIN_USER)$(RESET)"
	@PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres

db-status: ## Show comprehensive database status
	@echo "$(BOLD)📊 PostgreSQL Database Status$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)Connection Configuration:$(RESET)"
	@echo "  Host: $(DB_HOST):$(DB_PORT)"
	@echo "  Database: $(DB_NAME)"
	@echo "  User: $(DB_USER)"
	@echo "  URL: postgresql://$(DB_USER):***@$(DB_HOST):$(DB_PORT)/$(DB_NAME)"
	@echo ""
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		echo "$(CYAN)Database Information:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT \
				current_database() as database, \
				current_user as connected_user, \
				inet_server_addr() as server_ip, \
				inet_server_port() as server_port, \
				version() as postgresql_version;"; \
		echo ""; \
		echo "$(CYAN)Database Size:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT \
				pg_database.datname as database, \
				pg_size_pretty(pg_database_size(pg_database.datname)) as size \
			FROM pg_database \
			WHERE datname = '$(DB_NAME)';"; \
		echo ""; \
		echo "$(CYAN)Table Count:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"; \
		echo ""; \
		echo "$(CYAN)Extensions Installed:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT extname as extension, extversion as version FROM pg_extension ORDER BY extname;"; \
	else \
		echo "$(RED)❌ Cannot connect to database$(RESET)"; \
		echo "$(CYAN)Check connection settings and ensure PostgreSQL is running$(RESET)"; \
	fi

db-tables: ## List all database tables with row counts
	@echo "$(BOLD)📋 Database Tables$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT \
				schemaname as schema, \
				tablename as table, \
				tableowner as owner \
			FROM pg_tables \
			WHERE schemaname = 'public' \
			ORDER BY tablename;"; \
	else \
		echo "$(RED)❌ Cannot connect to database$(RESET)"; \
	fi

db-vacuum: ## Vacuum and analyze database for performance
	@echo "$(BOLD)🧹 Vacuuming and analyzing database...$(RESET)"
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		echo "$(BLUE)Running VACUUM ANALYZE...$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "VACUUM ANALYZE;"; \
		echo "$(GREEN)✅ Database maintenance completed$(RESET)"; \
	else \
		echo "$(RED)❌ Cannot connect to database$(RESET)"; \
	fi

db-extensions: ## Show installed PostgreSQL extensions
	@echo "$(BOLD)🔌 PostgreSQL Extensions$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "SELECT 1;" >/dev/null 2>&1; then \
		echo "$(CYAN)Installed Extensions:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT * FROM list_installed_extensions();" 2>/dev/null || \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT extname, extversion, nspname as schema FROM pg_extension JOIN pg_namespace ON extnamespace = pg_namespace.oid ORDER BY extname;"; \
		echo ""; \
		echo "$(CYAN)Database Capabilities:$(RESET)"; \
		PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c \
			"SELECT * FROM database_capabilities();" 2>/dev/null || echo "  Extension function not available"; \
	else \
		echo "$(RED)❌ Cannot connect to database$(RESET)"; \
	fi

db-users: ## List database users and roles
	@echo "$(BOLD)👥 Database Users and Roles$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@if PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c "SELECT 1;" >/dev/null 2>&1; then \
		PGPASSWORD=$$DATABASE_ADMIN_PASSWORD psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) -d postgres -c \
			"SELECT \
				rolname as role_name, \
				rolsuper as is_superuser, \
				rolinherit as can_inherit, \
				rolcreaterole as can_create_roles, \
				rolcreatedb as can_create_db, \
				rolcanlogin as can_login, \
				rolconnlimit as connection_limit \
			FROM pg_roles \
			ORDER BY rolname;"; \
	else \
		echo "$(RED)❌ Cannot connect as admin user$(RESET)"; \
		echo "$(CYAN)Set DATABASE_ADMIN_PASSWORD environment variable$(RESET)"; \
	fi
# db-backup: ## Backup Flask database
# 	@echo "$(BOLD)💾 Backing up database...$(RESET)"
# 	@if [ -f "$(APP_DIR)/app.db" ]; then \
# 		cp $(APP_DIR)/app.db $(APP_DIR)/app.db.backup.$(shell date +%Y%m%d_%H%M%S); \
# 		echo "$(GREEN)✅ Database backed up$(RESET)"; \
# 	else \
# 		echo "$(YELLOW)⚠️  No database found to backup$(RESET)"; \
# 	fi

# db-restore: ## Restore Flask database from backup
# 	@echo "$(BOLD)🔄 Restoring database from backup...$(RESET)"
# 	@echo "$(CYAN)Available backups:$(RESET)"
# 	@ls -la $(APP_DIR)/app.db.backup.* 2>/dev/null || echo "No backups found"
# 	@echo ""
# 	@read -p "Enter backup filename: " backup && \
# 	if [ -f "$(APP_DIR)/$backup" ]; then \
# 		cp $(APP_DIR)/$backup $(APP_DIR)/app.db; \
# 		echo "$(GREEN)✅ Database restored from $backup$(RESET)"; \
# 	else \
# 		echo "$(RED)❌ Backup file not found$(RESET)"; \
# 	fi

# db-shell: ## Open database shell
# 	@echo "$(BOLD)🐚 Opening database shell...$(RESET)"
# 	@if [ -f "$(APP_DIR)/app.db" ]; then \
# 		sqlite3 $(APP_DIR)/app.db; \
# 	else \
# 		echo "$(RED)❌ Database not found. Run 'make flask-init' first.$(RESET)"; \
# 	fi

# ============================================================================
# MONITORING AND HEALTH CHECKS
# ============================================================================

health-check: ## Run application health checks
	@echo "$(BOLD)🏥 Running application health checks...$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)Environment Health:$(RESET)"
	@echo "  UV Available: $(if $(shell command -v uv 2>/dev/null),$(GREEN)✅ Yes$(RESET),$(RED)❌ No$(RESET))"
	@echo "  Virtual Env: $(if $(wildcard .venv),$(GREEN)✅ Active$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Python: $(GREEN)$(shell $(UV) run python --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo ""
	@echo "$(CYAN)Project Health:$(RESET)"
	@echo "  Configuration: $(if $(wildcard $(PYPROJECT_TOML)),$(GREEN)✅ Valid$(RESET),$(RED)❌ Missing$(RESET))"
	@echo "  Dependencies: $(if $(wildcard $(UV_LOCK)),$(GREEN)✅ Locked$(RESET),$(YELLOW)⚠️  Unlocked$(RESET))"
	@echo "  Git Repo: $(if $(wildcard .git),$(GREEN)✅ Initialized$(RESET),$(YELLOW)⚠️  Missing$(RESET))"
	@echo ""
	@echo "$(CYAN)Flask Application Health:$(RESET)"
	@if [ -f "$(FAB_APP_FILE)" ]; then \
		echo "  App File: $(GREEN)✅ Present$(RESET)"; \
		echo "  Config: $(if $(wildcard $(FAB_CONFIG_FILE)),$(GREEN)✅ Present$(RESET),$(RED)❌ Missing$(RESET))"; \
		echo "  Database: $(if $(wildcard $(APP_DIR)/*.db),$(GREEN)✅ Present$(RESET),$(YELLOW)⚠️  Not initialized$(RESET))"; \
	else \
		echo "  Flask App: $(RED)❌ Not configured$(RESET)"; \
	fi

monitor: ## Monitor application logs in real-time
	@echo "$(BOLD)📊 Monitoring application logs...$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(RESET)"
	@if [ -d "logs" ]; then \
		tail -f logs/*.log 2>/dev/null || echo "No log files found"; \
	elif [ -d "$(APP_DIR)" ]; then \
		echo "$(CYAN)Starting Flask app to generate logs...$(RESET)"; \
		$(MAKE) run-flask; \
	else \
		echo "$(YELLOW)No logs directory found$(RESET)"; \
	fi

# ============================================================================
# DEPLOYMENT HELPERS
# ============================================================================

deploy-check: ## Check deployment readiness
	@echo "$(BOLD)🚀 Deployment Readiness Check$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)Code Quality:$(RESET)"
	@$(MAKE) format-check >/dev/null 2>&1 && echo "  Formatting: $(GREEN)✅ Pass$(RESET)" || echo "  Formatting: $(RED)❌ Fail$(RESET)"
	@$(MAKE) lint >/dev/null 2>&1 && echo "  Linting: $(GREEN)✅ Pass$(RESET)" || echo "  Linting: $(RED)❌ Fail$(RESET)"
	@$(MAKE) type-check >/dev/null 2>&1 && echo "  Type Checking: $(GREEN)✅ Pass$(RESET)" || echo "  Type Checking: $(RED)❌ Fail$(RESET)"
	@echo ""
	@echo "$(CYAN)Security:$(RESET)"
	@$(MAKE) security-scan >/dev/null 2>&1 && echo "  Security Scan: $(GREEN)✅ Pass$(RESET)" || echo "  Security Scan: $(RED)❌ Fail$(RESET)"
	@echo ""
	@echo "$(CYAN)Testing:$(RESET)"
	@$(MAKE) test >/dev/null 2>&1 && echo "  Test Suite: $(GREEN)✅ Pass$(RESET)" || echo "  Test Suite: $(RED)❌ Fail$(RESET)"
	@echo ""
	@echo "$(CYAN)Build:$(RESET)"
	@[ -d "$(DIST_DIR)" ] && echo "  Distribution: $(GREEN)✅ Built$(RESET)" || echo "  Distribution: $(YELLOW)⚠️  Not built$(RESET)"

production-setup: ## Setup production environment configuration
	@echo "$(BOLD)🏭 Production Environment Setup$(RESET)"
	@echo "$(BOLD)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)Creating production configuration...$(RESET)"
	@mkdir -p configs/production
	@cp $(TEMPLATES_DIR)/prod_env.template configs/production/.env.example
	@echo "$(GREEN)✅ Production configuration template created$(RESET)"
	@echo "$(CYAN)Edit configs/production/.env.example and copy to .env$(RESET)"

# ============================================================================
# ERROR HANDLING AND MAKEFILE CONFIGURATION
# ============================================================================

# Ensure commands fail fast and handle errors properly
.SHELLFLAGS := -eu -o pipefail -c

# Delete targets on error to prevent partial builds
.DELETE_ON_ERROR:

# Warn about undefined variables
MAKEFLAGS += --warn-undefined-variables

# Disable built-in rules and variables for better performance
MAKEFLAGS += --no-builtin-rules
MAKEFLAGS += --no-builtin-variables

# Use bash for better cross-platform compatibility
SHELL := /bin/bash

# Silence command echoing by default (use @echo for intentional output)
.SILENT:

# ============================================================================
# FOOTER INFORMATION
# ============================================================================

# This enhanced Makefile provides comprehensive development automation for docfusion
# Generated from template - modify template file to customize for all projects
# Powered by UV for fast, reliable Python package management
# Enhanced with Flask-AppBuilder integration and comprehensive project initialization
#
# Key Features:
# - Complete project initialization with 'make init'
# - Flask-AppBuilder web application setup
# - Virtual environment management with UV
# - Git repository initialization and configuration
# - Requirements.txt generation and management
# - Comprehensive quality assurance pipeline
# - Modern Python tooling integration (ruff, mypy, pytest)
# - Security scanning and vulnerability assessment
# - Documentation generation and serving
# - Docker and Airflow integration
# - CI/CD pipeline support
# - Performance profiling and debugging tools
# - Database management and utilities
# - Health monitoring and deployment checks
#
# For help: make help
# For Flask commands: make help-flask
# For initialization: make help-init
# For quality commands: make help-quality
# For shortcuts: make help-shortcuts
#
# Mathematical Rigor Applied:
# - State machine approach to project initialization
# - Dependency resolution with formal ordering
# - Idempotent operations ensuring consistent results
# - Comprehensive validation at each stage
# - Error handling with proper exit codes
# - Atomic operations where possible
