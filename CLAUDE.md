# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **DocuFusion** - an AI-powered document intelligence platform focused on RFP (Request for Proposal) response automation and intelligent document composition. The system transforms documents from static artifacts into strategic assets using generative AI, embedded workflows, and predictive compliance.

### Core Architecture

- **Primary Language**: Python 3.10+ with modern typing (`str | None`, `list[str]`, etc.)
- **Package Manager**: UV (ultra-fast Rust-based Python package manager)
- **Code Quality**: Ruff (linting + formatting), MyPy (type checking), pytest (testing)
- **Workflow Orchestration**: Apache Airflow 3.0+ integration
- **Web Framework**: Flask-AppBuilder (enterprise web application framework)
- **Project Structure**: src-layout (`src/docfusion/`)

## Development Commands

### Core Development Workflow
```bash
# Environment setup (one-time)
make dev-setup                 # Complete development environment setup
make validate-env              # Validate environment configuration

# Daily development
make quality-check             # Run comprehensive quality pipeline (lint, type-check, test, security)
make test-coverage             # Run tests with coverage analysis
make format                    # Format code with Ruff
make lint                      # Comprehensive linting
make type-check                # Static type checking with MyPy
```

### Testing Commands
```bash
# Test execution
make test                      # Basic test run
make test-parallel             # Parallel execution (faster)
make test-watch                # Continuous testing (watch mode)
make benchmark                 # Performance benchmarks

# Coverage and reports
make test-coverage             # Tests with coverage analysis (minimum 80%)
make test-reports              # Generate comprehensive test reports
```

### Dependency Management (UV)
```bash
# Package management
make uv-add PACKAGE=name       # Add production dependency
make uv-add-dev PACKAGE=name   # Add development dependency
make uv-remove PACKAGE=name    # Remove dependency
make deps-update               # Update all dependencies
make deps-tree                 # Show dependency tree
make deps-audit                # Security audit dependencies
```

### Security and Quality
```bash
make security-scan             # Multi-layer security scanning (Bandit, Safety, pip-audit)
make pre-commit-run            # Run pre-commit hooks manually
make complexity                # Code complexity analysis
```

### Documentation
```bash
make docs                      # Generate documentation with Sphinx
make docs-serve                # Serve docs locally at http://localhost:8000
make docs-clean                # Clean documentation build
```

### Airflow Integration
```bash
make airflow-setup             # Initialize Airflow environment
make airflow-init              # Initialize Airflow database
make airflow-start             # Start Airflow services
make airflow-stop              # Stop Airflow services
make airflow-test              # Validate DAG files
```

### Build and Distribution
```bash
make build                     # Build distribution packages
make docker-build              # Build Docker image
make docker-run                # Run in Docker container
```

## Project Structure Philosophy

### Multi-Component Architecture
This project follows a sophisticated multi-component structure designed for enterprise-scale document intelligence:

```
docfusion/
├── src/docfusion/       # Core Python package (minimal starter implementation)
├── app/                       # Flask-AppBuilder web application
│   ├── api/                   # RESTful API endpoints
│   ├── models/                # Data models and database schemas
│   ├── views/                 # Web interface views
│   ├── auth/                  # Authentication and authorization
│   └── blueprints/            # Modular application components
├── airflow/dags/              # Workflow orchestration (ETL pipelines)
├── docs/design/               # Comprehensive design documentation
├── deployment/                # Infrastructure as code (Docker, K8s, Terraform)
└── tests/                     # Comprehensive test suite
```

### Design-Driven Development
The `docs/design/` directory contains the complete product specification:
- **design.md**: Core RFP workflow integration and generative AI features
- **docuFusion1.md**: Market positioning and competitive differentiation
- **docuFusion5.md**: Human-centered UX design and ergonomics
- **Additional design docs**: Feature specifications and technical architecture

**Important**: Always review relevant design documents before implementing features to understand the business context and user requirements. All code should be as complete as possible and fully address all edge cases. 

Write comprehensive, detailed, fully commented code. It should exhaustively address the domain the code covers - no sophomoric code. Write at the lvel of a 10x google engineer. The ncode should be theoretically sound and fully implement best practice.

## Code Style and Conventions

### Python Standards
- Use **tabs for indentation** (not spaces) - this overrides the pyproject.toml ruff configuration
- Modern Python 3.12+ typing: `str | None`, `list[str]`, `dict[str, Any]`
- Async Python throughout
- Pydantic v2 models with strict validation:
  ```python
  model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
  ```

### Project Organization
- Main logic in `service.py` files
- Pydantic models in `views.py` files
- Separate logging methods prefixed with `_log_...`
- Runtime assertions at function start/end for constraint enforcement
- UUID generation: `from uuid_extension import uuid7str` + `id: str = Field(default_factory=uuid7str)`

### Testing Standards
- Tests in `tests/ci/` are the canonical test suite (auto-discovered by CI)
- No mocks except for LLM calls - use pytest fixtures with real objects
- Modern pytest-asyncio: no `@pytest.mark.asyncio` decorators needed
- Use `loop = asyncio.get_event_loop()` inside tests when needed

## Quality Standards

### Strict Requirements
- **Type Coverage**: 100% with MyPy strict mode
- **Test Coverage**: Minimum 80% (configurable in pyproject.toml)
- **Security**: Multi-tool scanning (Bandit, Safety, pip-audit)
- **Code Quality**: Comprehensive Ruff linting (500+ rules)

### Pre-commit Hooks
Automatically enforced quality gates:
- Code formatting and import sorting (Ruff)
- Type checking (MyPy)
- Security scanning (Bandit)
- Conventional commits validation

## Business Context

### Product Mission
DocuFusion transforms RFP response from reactive documentation to strategic capability delivery through:
- **AI-Powered Document Composition**: Generative drafting of text, diagrams, and compliance matrices
- **Predictive Compliance**: Scoring against evaluation criteria using historical data
- **Autonomous Workflows**: End-to-end RFP discovery, analysis, and response generation
- **Enterprise Integration**: CRM connectivity, e-signatures, and payment orchestration

### Key Differentiators
- **Beyond Templates**: Generative AI creates contextual content, not just data merging
- **Embedded Workflows**: E-signatures and payments triggered by document milestones
- **Competitive Intelligence**: AI-powered analysis of market positioning and pricing
- **Human-Centered Design**: Cognitive load management and flow state preservation

### Target Users
- Government contractors requiring FAR/DFARS compliance
- Enterprise sales teams with complex RFP responses
- Legal/compliance teams managing contract workflows
- Business development professionals managing opportunity pipelines

## Development Principles

1. **Design-First Implementation**: Reference design docs before coding
2. **Quality Over Speed**: All quality gates must pass before merging
3. **Enterprise-Grade Security**: Multiple security scanning layers
4. **Modern Tooling**: Leverage UV, Ruff, and other cutting-edge tools
5. **Documentation Coverage**: Maintain high documentation standards with Sphinx

## Flask-AppBuilder Integration

This project includes enterprise web application capabilities:
```bash
make flask-init                # Initialize Flask-AppBuilder application
make flask-create-admin        # Create admin user
make flask-db-init             # Initialize database
make flask-run-debug           # Run Flask app in debug mode
```

The Flask-AppBuilder integration provides enterprise features like role-based access control, database management, and comprehensive admin interfaces for the document intelligence platform.

We will use git for version control of document fragments and templates. We will use LaTeX for document formatting and rendering.

## Document Architecture Decision
**IMPORTANT**: DocuFusion uses Git + LaTeX for document part versioning and layout:
- **Git**: Version control for all document fragments, content blocks, and templates
- **LaTeX**: Professional typesetting, layout, and rendering engine
- **File-based approach**: Each content block is a separate .tex file managed by Git
- **LaTeX includes**: Document assembly via \input{} and \include{} commands
- **Industry standards**: Leverage proven tools instead of custom version management

## Guidance for Automated Operations

### Permitted Actions
- **IMPORTANT**: Permission is granted for all operations within the docfusion directory
- Use UV (ultra-fast Rust-based Python package manager) for dependency management
- Continue executing tasks without stopping or asking for additional permission
- Utilize Python 3.11 with the existing UV-created virtual environment located at /Users/nyimbiodero/src/pjs/docfusion
- All documents created by the proposal writer will be in LaTeX format
Keep source files small, less than 25kb each

<!-- BACKLOG.MD GUIDELINES START -->
# Instructions for the usage of Backlog.md CLI Tool

## 1. Source of Truth

- Tasks live under **`backlog/tasks/`** (drafts under **`backlog/drafts/`**).
- Every implementation decision starts with reading the corresponding Markdown task file.
- Project documentation is in **`backlog/docs/`**.
- Project decisions are in **`backlog/decisions/`**.

## 2. Defining Tasks

### **Title**

Use a clear brief title that summarizes the task.

### **Description**: (The **"why"**)

Provide a concise summary of the task purpose and its goal. Do not add implementation details here. It
should explain the purpose and context of the task. Code snippets should be avoided.

### **Acceptance Criteria**: (The **"what"**)

List specific, measurable outcomes that define what means to reach the goal from the description. Use checkboxes (`- [ ]`) for tracking.
When defining `## Acceptance Criteria` for a task, focus on **outcomes, behaviors, and verifiable requirements** rather
than step-by-step implementation details.
Acceptance Criteria (AC) define *what* conditions must be met for the task to be considered complete.
They should be testable and confirm that the core purpose of the task is achieved.
**Key Principles for Good ACs:**

- **Outcome-Oriented:** Focus on the result, not the method.
- **Testable/Verifiable:** Each criterion should be something that can be objectively tested or verified.
- **Clear and Concise:** Unambiguous language.
- **Complete:** Collectively, ACs should cover the scope of the task.
- **User-Focused (where applicable):** Frame ACs from the perspective of the end-user or the system's external behavior.

    - *Good Example:* "- [ ] User can successfully log in with valid credentials."
    - *Good Example:* "- [ ] System processes 1000 requests per second without errors."
    - *Bad Example (Implementation Step):* "- [ ] Add a new function `handleLogin()` in `auth.ts`."

### Task file

Once a task is created it will be stored in `backlog/tasks/` directory as a Markdown file with the format
`task-<id> - <title>.md` (e.g. `task-42 - Add GraphQL resolver.md`).

### Additional task requirements

- Tasks must be **atomic** and **testable**. If a task is too large, break it down into smaller subtasks.
  Each task should represent a single unit of work that can be completed in a single PR.

- **Never** reference tasks that are to be done in the future or that are not yet created. You can only reference
  previous
  tasks (id < current task id).

- When creating multiple tasks, ensure they are **independent** and they do not depend on future tasks.   
  Example of wrong tasks splitting: task 1: "Add API endpoint for user data", task 2: "Define the user model and DB
  schema".  
  Example of correct tasks splitting: task 1: "Add system for handling API requests", task 2: "Add user model and DB
  schema", task 3: "Add API endpoint for user data".

## 3. Recommended Task Anatomy

```markdown
# task‑42 - Add GraphQL resolver

## Description (the why)

Short, imperative explanation of the goal of the task and why it is needed.

## Acceptance Criteria (the what)

- [ ] Resolver returns correct data for happy path
- [ ] Error response matches REST
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Plan (the how) (added after starting work on a task)

1. Research existing GraphQL resolver patterns
2. Implement basic resolver with error handling
3. Add performance monitoring
4. Write unit and integration tests
5. Benchmark performance under load

## Implementation Notes (only added after finishing work on a task)

- Approach taken
- Features implemented or modified
- Technical decisions and trade-offs
- Modified or added files
```

## 6. Implementing Tasks

Mandatory sections for every task:

- **Implementation Plan**: (The **"how"**) Outline the steps to achieve the task. Because the implementation details may
  change after the task is created, **the implementation plan must be added only after putting the task in progress**
  and before starting working on the task.
- **Implementation Notes**: Document your approach, decisions, challenges, and any deviations from the plan. This
  section is added after you are done working on the task. It should summarize what you did and why you did it. Keep it
  concise but informative.

**IMPORTANT**: Do not implement anything else that deviates from the **Acceptance Criteria**. If you need to
implement something that is not in the AC, update the AC first and then implement it or create a new task for it.

## 2. Typical Workflow

```bash
# 1 Identify work
backlog task list -s "To Do" --plain

# 2 Read details & documentation
backlog task 42 --plain
# Read also all documentation files in `backlog/docs/` directory.
# Read also all decision files in `backlog/decisions/` directory.

# 3 Start work: assign yourself & move column
backlog task edit 42 -a @{yourself} -s "In Progress"

# 4 Add implementation plan before starting
backlog task edit 42 --plan "1. Analyze current implementation\n2. Identify bottlenecks\n3. Refactor in phases"

# 5 Break work down if needed by creating subtasks or additional tasks
backlog task create "Refactor DB layer" -p 42 -a @{yourself} -d "Description" --ac "Tests pass,Performance improved"

# 6 Complete and mark Done
backlog task edit 42 -s Done --notes "Implemented GraphQL resolver with error handling and performance monitoring"
```

### 7. Final Steps Before Marking a Task as Done

Always ensure you have:

1. ✅ Marked all acceptance criteria as completed (change `- [ ]` to `- [x]`)
2. ✅ Added an `## Implementation Notes` section documenting your approach
3. ✅ Run all tests and linting checks
4. ✅ Updated relevant documentation

## 8. Definition of Done (DoD)

A task is **Done** only when **ALL** of the following are complete:

1. **Acceptance criteria** checklist in the task file is fully checked (all `- [ ]` changed to `- [x]`).
2. **Implementation plan** was followed or deviations were documented in Implementation Notes.
3. **Automated tests** (unit + integration) cover new logic.
4. **Static analysis**: linter & formatter succeed.
5. **Documentation**:
    - All relevant docs updated (any relevant README file, backlog/docs, backlog/decisions, etc.).
    - Task file **MUST** have an `## Implementation Notes` section added summarising:
        - Approach taken
        - Features implemented or modified
        - Technical decisions and trade-offs
        - Modified or added files
6. **Review**: self review code.
7. **Task hygiene**: status set to **Done** via CLI (`backlog task edit <id> -s Done`).
8. **No regressions**: performance, security and licence checks green.

⚠️ **IMPORTANT**: Never mark a task as Done without completing ALL items above.

## 9. Handy CLI Commands

| Purpose          | Command                                                                |
|------------------|------------------------------------------------------------------------|
| Create task      | `backlog task create "Add OAuth"`                                      |
| Create with desc | `backlog task create "Feature" -d "Enables users to use this feature"` |
| Create with AC   | `backlog task create "Feature" --ac "Must work,Must be tested"`        |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2`                    |
| Create sub task  | `backlog task create -p 14 "Add Google auth"`                          |
| List tasks       | `backlog task list --plain`                                            |
| View detail      | `backlog task 7 --plain`                                               |
| Edit             | `backlog task edit 7 -a @{yourself} -l auth,backend`                   |
| Add plan         | `backlog task edit 7 --plan "Implementation approach"`                 |
| Add AC           | `backlog task edit 7 --ac "New criterion,Another one"`                 |
| Add deps         | `backlog task edit 7 --dep task-1,task-2`                              |
| Add notes        | `backlog task edit 7 --notes "We added this and that feature because"` |
| Mark as done     | `backlog task edit 7 -s "Done"`                                        |
| Archive          | `backlog task archive 7`                                               |
| Draft flow       | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1`   |
| Demote to draft  | `backlog task demote <task-id>`                                        |

## 10. Tips for AI Agents

- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of using Backlog.md
  interactive UI.
- When users mention to create a task, they mean to create a task using Backlog.md CLI tool.

<!-- BACKLOG.MD GUIDELINES END -->
