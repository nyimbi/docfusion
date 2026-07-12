# CLAUDE.md

**DocuFusion** — AI-powered RFP response automation and document intelligence. Python 3.10+ src-layout (`src/docfusion/`), UV, Ruff, MyPy, pytest, FastAPI backend + Next.js frontend, Airflow DAGs.

## Commands

```bash
make quality-check   # lint + type-check + test + security
make test            # basic run; test-parallel, test-coverage (80% min) also exist
make format / lint / type-check
make uv-add PACKAGE=name / uv-add-dev / uv-remove
make security-scan   # Bandit, Safety, pip-audit
make docs / docs-serve
make airflow-setup / airflow-start / airflow-test
make build / docker-build
```

## Layout

`src/docfusion/` core package · `frontend/` Next.js app · `app/` Flask-AppBuilder (legacy) · `airflow/dags/` ETL · `docs/design/` product spec · `deployment/` IaC · `tests/ci/` canonical suite

Design-first: read the relevant `docs/design/` doc before implementing features (design.md = RFP workflow + genAI; docuFusion1.md = market positioning; docuFusion5.md = UX).

## Code Style

- **Tabs for indentation** (overrides pyproject ruff config); Python 3.12+ typing; async throughout
- Pydantic v2: `model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)`
- Main logic in `service.py`, models in `views.py`; `_log_` prefixed log methods; runtime assertions at function start/end
- UUID7: `id: str = Field(default_factory=uuid7str)`
- Complete, edge-case-covering, theoretically sound code; keep source files < 25kb

## Testing

- `tests/ci/` = canonical (CI autodiscovered); no mocks except LLM — fixtures + real objects
- pytest-asyncio: plain async functions, no decorators

## Document Architecture (decided)

Git + LaTeX: each content block a separate `.tex` file version-controlled in Git; assembly via `\input{}`/`\include{}`; all proposal-writer output in LaTeX.

## Automated Operations

Permission granted for all operations within the docfusion directory — continue without asking. UV for deps; venv at repo root (Python 3.11).

<!-- BACKLOG.MD GUIDELINES START -->
# Backlog.md CLI

Tasks in `backlog/tasks/` (drafts in `backlog/drafts/`, docs in `backlog/docs/`, decisions in `backlog/decisions/`). Always use `--plain` for AI-friendly output. "Create a task" means via this CLI.

**Task shape**: Title (brief) · Description (the why, no implementation detail) · Acceptance Criteria (outcome-oriented, testable checkboxes) · Implementation Plan (added when work starts) · Implementation Notes (added when done). Tasks must be atomic, independent, never referencing future tasks.

**Workflow**:
```bash
backlog task list -s "To Do" --plain          # find work
backlog task 42 --plain                        # read task
backlog task edit 42 -a @{yourself} -s "In Progress"
backlog task edit 42 --plan "1. ...\n2. ..."
backlog task create "Title" -d "Desc" --ac "AC1,AC2"   # -p 42 for subtask, --dep task-1
backlog task edit 42 -s Done --notes "What/why"
```

**Definition of Done** (ALL required): AC checked `[x]` · plan followed or deviations noted · tests cover new logic · lint/format green · docs updated · Implementation Notes added · status Done via CLI · no regressions. Never mark Done otherwise. Do not implement beyond the AC — update AC first or file a new task.
<!-- BACKLOG.MD GUIDELINES END -->
