# Project Structure

## Root Layout
```
docfusion/
├── src/docfusion/          # Core Python package (minimal starter)
│   ├── __init__.py
│   ├── main.py             # Entry point
│   ├── api/                # REST API endpoints
│   ├── agents/             # AI agents
│   ├── ai_agents/          # Reserved for future reasoning agents (placeholder)
│   ├── cli/                # CLI commands
│   ├── collaboration/      # Real-time collaboration
│   ├── compliance/         # Compliance checking
│   ├── composition/        # Document composition
│   ├── config/             # Configuration
│   ├── core/               # Core utilities
│   ├── discovery/          # RFP discovery crawlers
│   ├── document_engine/    # LaTeX-based document engine
│   ├── frontend/           # Frontend integration
│   ├── infrastructure/     # Infrastructure code
│   ├── integrations/       # External integrations
│   ├── intelligence/       # Intelligence features
│   ├── models/             # Data models
│   ├── nlp/                # NLP processing
│   ├── notifications/      # Notification system
│   ├── orchestration/      # Workflow orchestration
│   ├── security/            # Security features
│   ├── services/           # Business services
│   ├── storage/            # Storage layer
│   ├── utils/              # Utilities
│   ├── voice_dna/          # Voice DNA features
│   ├── workflow/           # Workflow engine
│   └── workflows/          # Workflow definitions
├── backend/                # Backend services
│   ├── discovery/          # Discovery/scraping system
│   │   ├── models/         # Data models
│   │   ├── pipeline/       # Processing pipeline
│   │   ├── schedulers/     # Scheduler
│   │   ├── scrapers/       # Web scrapers
│   │   └── sources/        # Source registry
│   └── stealth-scraper/    # Stealth scraping
├── frontend/               # Next.js 15 frontend
│   ├── app/                # App router pages
│   ├── components/         # React components
│   ├── lib/                # Utilities
│   └── public/             # Static assets
├── airflow/dags/           # Airflow DAGs (empty)
├── tests/                  # Test suite
│   └── ci/                 # CI tests (auto-discovered)
├── docs/                   # Documentation
│   └── design/             # Design documents
├── deployment/             # Deployment configs (NOT Docker)
├── data/                   # Data files
├── migrations/             # Database migrations
└── scripts/                # Utility scripts
```

## Key Directories
- `src/docfusion/`: Core Python library
- `backend/discovery/`: RFP scraping pipeline
- `frontend/`: Next.js web application
- `tests/ci/`: CI test suite
- `docs/design/`: Product specifications

## Configuration Files
- `pyproject.toml`: Python project config (UV, Ruff, MyPy, pytest)
- `Makefile`: Build automation
- `alembic.ini`: Database migrations
- `.pre-commit-config.yaml`: Git hooks

## Important Notes
- **Docker is NOT used** - services run natively or via systemd
- No `docker-compose.yml` - ignore any Docker-related Makefile targets