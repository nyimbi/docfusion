# Suggested Commands

## Daily Development
```bash
# Environment setup (one-time)
make dev-setup

# Quality pipeline (lint, type-check, test, security)
make quality-check

# Testing
make test                    # Basic test run
make test-coverage          # Tests with coverage analysis
make test-parallel          # Parallel execution (faster)
uv run pytest -vxs tests/ci # CI tests specifically

# Formatting and Linting
make format                 # Format code with Ruff
make lint                   # Comprehensive linting
uv run ruff format          # Direct Ruff format
uv run ruff check           # Direct Ruff lint

# Type Checking
uv run pyright              # Type checking with Pyright
uv run mypy                 # Type checking with MyPy
make type-check             # Project type check command

# Security
make security-scan          # Bandit + Safety + pip-audit
```

## Dependency Management (UV)
```bash
# Add/remove dependencies
make uv-add PACKAGE=name
make uv-add-dev PACKAGE=name
make uv-remove PACKAGE=name

# Update dependencies
make deps-update            # Update all dependencies
make deps-tree              # Show dependency tree
make deps-audit             # Security audit dependencies

# Sync environment
uv sync                     # Sync to lock file
uv sync --all-extras --dev  # Full sync with all extras
```

## Flask-AppBuilder
```bash
make flask-init             # Initialize database
make flask-create-admin     # Create admin user
make flask-run-debug        # Run Flask in debug mode
make flask-db-migrate       # Create migration
make flask-db-upgrade       # Apply migrations
```

## Airflow Integration
```bash
make airflow-setup          # Initialize Airflow environment
make airflow-init           # Initialize Airflow database
make airflow-start          # Start Airflow services
make airflow-stop           # Stop Airflow services
make airflow-test           # Validate DAG files
```

## Discovery System (RFP Scraping)
```bash
# Run scrapers
python -m backend.discovery.scheduler.orchestrator --tier tier1
python -m backend.discovery.scheduler.orchestrator --source ungm
python -m backend.discovery.scheduler.scraper_runner --tier tier1 --dry-run
```

## Documentation
```bash
make docs                   # Generate docs with Sphinx
make docs-serve             # Serve docs at http://localhost:8000
```

## Git Commands (Darwin/macOS)
```bash
git status                  # Check status
git diff                    # View changes
git add -A && git commit    # Stage and commit
git log --oneline -10       # Recent commits
```

## System Utilities (Darwin)
```bash
ls -la                      # List files
find . -name "*.py"          # Find Python files
grep -r "pattern" src/      # Search in source
```

## Important Notes
- **Docker is NOT used** in this project - all services run natively
- Database migrations use Alembic directly
- Services are managed via systemd or direct execution