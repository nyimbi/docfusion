# DocuFusion

[![CI/CD Pipeline](https://github.com/yourusername/docfusion/workflows/CI/badge.svg)](https://github.com/yourusername/docfusion/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **AI-Powered Document Intelligence Platform** for autonomous RFP response, proposal generation, and enterprise document workflows.

DocuFusion transforms documents from static artifacts into strategic assets using generative AI, multi-agent collaboration, predictive compliance, and real-time collaborative editing.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Core Capabilities](#core-capabilities)
  - [Document Engine](#document-engine)
  - [Discovery Engine](#discovery-engine)
  - [Multi-Agent System](#multi-agent-system)
  - [NLP & Voice DNA](#nlp--voice-dna)
  - [Intelligence System](#intelligence-system)
  - [Collaboration System](#collaboration-system)
  - [Compliance Framework](#compliance-framework)
  - [Workflow Orchestration](#workflow-orchestration)
- [API Reference](#api-reference)
- [Frontend](#frontend)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

DocuFusion is an enterprise-grade platform that revolutionizes how organizations create, manage, and optimize proposals and RFP responses. Unlike traditional document management systems, DocuFusion leverages:

- **Generative AI** for intelligent content creation and enhancement
- **Multi-Agent Orchestration** for collaborative document generation
- **Predictive Analytics** for win probability and competitive positioning
- **Real-Time Collaboration** with CRDT-based conflict resolution
- **Automated Compliance** validation against FAR/DFARS, SOC 2, and industry standards

### Who Is This For?

- **Government Contractors** requiring FAR/DFARS compliance
- **Enterprise Sales Teams** managing complex RFP responses
- **Business Development Professionals** tracking opportunity pipelines
- **Legal/Compliance Teams** managing contract workflows
- **Proposal Managers** coordinating multi-stakeholder document creation

---

## Key Features

### Document Intelligence
- Multi-format rendering (PDF, DOCX, HTML, LaTeX)
- Git-based version control for document fragments
- Cross-reference and citation management
- Automatic TOC generation and brand formatting

### AI-Powered Capabilities
- Content generation with organizational voice consistency
- Readability analysis and style recommendations
- Automatic keyword and entity extraction
- Win probability prediction using ML models

### Collaboration
- Real-time multi-user editing with presence awareness
- CRDT-based conflict-free concurrent editing
- Comment threading with resolution workflows
- Fine-grained permission management

### Opportunity Discovery
- 1000+ global procurement source database
- AI-driven web scraping with Cloudflare bypass
- Automatic opportunity qualification scoring
- Competitive landscape analysis

### Enterprise Security
- Role-based access control (RBAC)
- AES-256 encryption at rest and in transit
- Complete audit logging
- GDPR, HIPAA, SOC 2 compliance ready

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js 15 Frontend          │  Flask-AppBuilder Admin                 │
│  - React 19 Components        │  - Document Management UI               │
│  - Real-time WebSocket        │  - Opportunity Pipeline                 │
│  - TypeScript                 │  - Analytics Dashboards                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  REST API Endpoints           │  WebSocket Events                       │
│  - /api/documents             │  - document_edit                        │
│  - /api/ai_features           │  - cursor_position                      │
│  - /api/collaboration         │  - typing_indicator                     │
│  - /api/opportunities         │  - ai_analysis_request                  │
│  - /api/workflows             │  - workflow_action                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  DocumentService  │  AIService  │  CollaborationService  │  Workflow    │
│  TemplateService  │  NLPService │  ComplianceService     │  Integration │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          ENGINE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Document Engine   │  Discovery Engine  │  Agent System  │  NLP Engine  │
│  - PDF Renderer    │  - UniversalScraper│  - AgentCrew   │  - Analyzers │
│  - DOCX Renderer   │  - VisionScraper   │  - AgentSwarm  │  - Extractors│
│  - LaTeX Formatter │  - GlobalSourceDB  │  - Memory Mgr  │  - Voice DNA │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL        │  Redis Cache       │  Vector Store (RAG)           │
│  SQLAlchemy ORM    │  Session Storage   │  Semantic Search              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
docfusion/
├── src/docfusion/              # Core Python package (24.7K+ LOC)
│   ├── agents/                 # Multi-agent orchestration system
│   ├── ai_agents/              # Specialized AI agent implementations
│   ├── api/                    # API endpoint definitions
│   ├── collaboration/          # Real-time editing & CRDT
│   ├── compliance/             # Regulatory compliance framework
│   ├── composition/            # Document assembly DSL
│   ├── config/                 # Centralized LLM configuration
│   ├── discovery/              # Opportunity scraping engine
│   ├── document_engine/        # PDF/DOCX/HTML rendering
│   ├── intelligence/           # Predictive analytics & ML
│   ├── integrations/           # External system connectors
│   ├── nlp/                    # Natural language processing
│   ├── notifications/          # Multi-channel alerts
│   ├── orchestration/          # Workflow execution
│   ├── security/               # Auth, encryption, audit
│   ├── storage/                # Persistence & RAG
│   ├── visualization/          # Charts & diagrams
│   ├── voice_dna/              # Organizational voice analysis
│   └── workflow/               # Business process automation
│
├── app/                        # Flask-AppBuilder web application
│   ├── blueprints/             # API route handlers
│   ├── models.py               # SQLAlchemy ORM models
│   ├── services/               # Business logic services
│   └── websocket/              # Real-time event handlers
│
├── frontend/                   # Next.js 15 + React 19 frontend
│   ├── app/                    # Next.js App Router
│   ├── components/             # React components
│   ├── lib/                    # Utilities & API client
│   └── types/                  # TypeScript definitions
│
├── tests/                      # Test suite (64 test files)
│   ├── ci/                     # Continuous integration tests
│   ├── integration/            # Integration tests
│   ├── security/               # Security validation tests
│   └── performance/            # Benchmark tests
│
├── examples/                   # Usage examples
├── migrations/                 # Alembic database migrations
├── docs/                       # Documentation
├── infra/                      # Infrastructure as Code
│   ├── docker/                 # Docker configurations
│   ├── kubernetes/             # K8s manifests
│   ├── terraform/              # Cloud provisioning
│   └── ansible/                # Configuration management
│
├── pyproject.toml              # Python project configuration
├── Dockerfile                  # Container build
├── docker-compose.yml          # Service orchestration
└── Makefile                    # 95+ automation commands
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- PostgreSQL 14+ (production) or SQLite (development)
- Redis (optional, for caching/sessions)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/docfusion.git
cd docfusion

# Install UV (ultra-fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
uv sync --dev

# Initialize the database
uv run alembic upgrade head

# Start the backend
uv run python -m docfusion

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

### Docker Quick Start

```bash
# Build and run all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Admin Panel: http://localhost:5000/admin
```

---

## Core Capabilities

### Document Engine

The document engine provides enterprise-grade document generation with multiple output formats.

```python
from docfusion.document_engine import DocumentAssembler, PDFRenderer

# Assemble document from fragments
assembler = DocumentAssembler()
document = await assembler.assemble(
    template_id="proposal-template",
    sections=["executive_summary", "technical_approach", "pricing"],
    variables={"client_name": "Acme Corp", "project_value": 1_000_000}
)

# Render to PDF
renderer = PDFRenderer()
pdf_bytes = await renderer.render(document, style="corporate")
```

**Supported Formats:**
- PDF (via WeasyPrint/LaTeX)
- Microsoft Word (DOCX)
- HTML (web-ready)
- LaTeX (professional typesetting)

### Discovery Engine

Automated procurement opportunity discovery from 1000+ global sources.

```python
from docfusion.discovery import UniversalScraper, OpportunityAnalyzer

# Scrape opportunities
scraper = UniversalScraper()
opportunities = await scraper.discover(
    keywords=["software development", "cloud migration"],
    sources=["sam.gov", "grants.gov", "state_portals"],
    date_range=("2024-01-01", "2024-12-31")
)

# Analyze and qualify
analyzer = OpportunityAnalyzer()
for opp in opportunities:
    qualification = await analyzer.qualify(
        opportunity=opp,
        company_capabilities=my_capabilities
    )
    print(f"{opp.title}: Win Probability {qualification.win_probability:.1%}")
```

**Capabilities:**
- Multi-strategy scraping (Crawl4AI, Playwright, CloudScraper)
- Computer vision-based extraction for complex layouts
- Cloudflare bypass and anti-bot evasion
- Automatic source health monitoring

### Multi-Agent System

CrewAI-inspired swarm intelligence for collaborative document generation.

```python
from docfusion.agents import AgentCrew, ResearchAgent, WriterAgent, ReviewerAgent

# Define agent crew
crew = AgentCrew(
    agents=[
        ResearchAgent(focus="competitive_analysis"),
        WriterAgent(style="technical", voice_profile="corporate"),
        ReviewerAgent(criteria=["compliance", "quality", "consistency"])
    ]
)

# Execute collaborative workflow
result = await crew.execute(
    task="Generate proposal for cloud migration RFP",
    rfp_document=rfp_content,
    company_data=company_info
)
```

**Agent Roles:**
- **ResearchAgent**: Information gathering and competitive analysis
- **WriterAgent**: Content generation with style guidelines
- **ReviewerAgent**: Quality and compliance review
- **CoordinatorAgent**: Task orchestration
- **AnalysisAgent**: Requirements and gap analysis

### NLP & Voice DNA

Maintain organizational voice consistency across all documents.

```python
from docfusion.voice_dna import VoiceAnalyzer, VoiceValidator
from docfusion.nlp import ContentAnalyzer

# Analyze existing content to build voice profile
analyzer = VoiceAnalyzer()
voice_profile = await analyzer.build_profile(
    documents=corporate_documents,
    name="Acme Corporate Voice"
)

# Validate new content against voice profile
validator = VoiceValidator()
result = validator.validate(new_content, voice_profile)
print(f"Voice Consistency: {result.score:.1%}")
print(f"Recommendations: {result.suggestions}")

# Comprehensive NLP analysis
nlp = ContentAnalyzer()
analysis = nlp.analyze(document_text)
print(f"Readability: {analysis.readability_score}")
print(f"Sentiment: {analysis.sentiment}")
print(f"Key Topics: {analysis.topics}")
```

### Intelligence System

ML-powered predictions and recommendations.

```python
from docfusion.intelligence import WinProbabilityPredictor, ContentRecommender

# Predict win probability
predictor = WinProbabilityPredictor()
prediction = predictor.predict(
    opportunity=opportunity_data,
    proposal_draft=proposal_content,
    historical_data=past_proposals
)
print(f"Win Probability: {prediction.probability:.1%}")
print(f"Key Factors: {prediction.influencing_factors}")

# Get content recommendations
recommender = ContentRecommender()
suggestions = recommender.recommend(
    section="technical_approach",
    context=rfp_requirements,
    past_wins=winning_proposals
)
```

### Collaboration System

Real-time multi-user editing with conflict resolution.

```python
from docfusion.collaboration import CollaborativeEditor, PresenceManager

# Initialize collaborative session
editor = CollaborativeEditor(document_id="doc-123")
presence = PresenceManager()

# Handle real-time edits
@editor.on("edit")
async def handle_edit(operation, user):
    # CRDT-based conflict resolution
    merged = await editor.apply_operation(operation)
    await editor.broadcast(merged, exclude=user)

# Track active collaborators
@presence.on("join")
async def handle_join(user, document_id):
    collaborators = await presence.get_active(document_id)
    await broadcast_presence(collaborators)
```

### Compliance Framework

Automated validation against regulatory standards.

```python
from docfusion.compliance import ComplianceValidator, FAR_DFARS_Framework

# Validate document compliance
validator = ComplianceValidator(
    frameworks=[FAR_DFARS_Framework(), SOC2_Framework()]
)

result = await validator.validate(document)
print(f"Compliance Score: {result.score:.1%}")
for issue in result.issues:
    print(f"  [{issue.severity}] {issue.rule}: {issue.description}")
    print(f"    Remediation: {issue.remediation}")
```

**Supported Frameworks:**
- FAR/DFARS (Federal Acquisition Regulation)
- SOC 2 Type II
- ISO 27001
- GDPR
- HIPAA
- NIST Cybersecurity Framework

### Workflow Orchestration

Automate multi-step document processes.

```python
from docfusion.workflow import WorkflowEngine, ProcessDefinition

# Define workflow
workflow = ProcessDefinition(
    name="proposal_approval",
    steps=[
        {"name": "draft", "assignee": "writer", "action": "create"},
        {"name": "review", "assignee": "reviewer", "action": "approve_or_reject"},
        {"name": "compliance", "assignee": "compliance_officer", "action": "validate"},
        {"name": "final_approval", "assignee": "director", "action": "sign_off"},
        {"name": "submit", "action": "auto_submit"}
    ]
)

# Execute workflow
engine = WorkflowEngine()
instance = await engine.start(workflow, document_id="doc-123")

# Monitor progress
status = await engine.get_status(instance.id)
print(f"Current Step: {status.current_step}")
print(f"Progress: {status.completed_steps}/{status.total_steps}")
```

---

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET, POST | List/create documents |
| `/api/documents/<id>` | GET, PUT, DELETE | Document CRUD |
| `/api/documents/<id>/generate` | POST | Generate PDF/DOCX/HTML |
| `/api/ai_features/enhance` | POST | AI content enhancement |
| `/api/ai_features/analyze` | POST | Content analysis |
| `/api/collaboration/documents/<id>/collaborators` | GET, POST | Manage collaborators |
| `/api/opportunities` | GET, POST | Opportunity pipeline |
| `/api/opportunities/<id>/analyze` | POST | AI opportunity analysis |
| `/api/workflows/instances` | GET, POST | Workflow management |
| `/api/compliance/validate/<id>` | POST | Compliance validation |
| `/api/templates` | GET, POST | Template management |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `document_edit` | Client → Server | Send edit operation |
| `document_updated` | Server → Client | Broadcast content changes |
| `cursor_position` | Bidirectional | Collaborative cursor tracking |
| `typing_indicator` | Bidirectional | Real-time typing awareness |
| `add_comment` | Client → Server | Add comment to document |
| `ai_analysis_request` | Client → Server | Request AI analysis |
| `workflow_action` | Client → Server | Execute workflow step |

---

## Frontend

The frontend is built with Next.js 15 and React 19, providing a modern, responsive interface.

### Key Components

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page
│   ├── documents/              # Document management
│   ├── opportunities/          # Opportunity pipeline
│   └── dashboard/              # Analytics dashboard
│
├── components/
│   ├── ui/                     # Base components (Button, Input, etc.)
│   ├── editor/                 # Collaborative document editor
│   ├── ai-panel/               # AI assistance sidebar
│   └── collaboration/          # Presence & comments
│
└── lib/
    ├── api/client.ts           # API client
    └── websocket/              # WebSocket connection
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev      # Development
npm run build    # Production build
npm run test     # Run tests
```

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/docfusion

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# AI/LLM Configuration
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434  # For local embeddings

# Security
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_DISCOVERY=true
```

### LLM Configuration

DocuFusion supports multiple LLM providers via centralized configuration:

```python
# src/docfusion/config/llm_config.py
LLM_CONFIG = {
    "default_provider": "openai",
    "providers": {
        "openai": {
            "model": "gpt-4-turbo",
            "api_key": "${OPENAI_API_KEY}"
        },
        "ollama": {
            "model": "llama2",
            "base_url": "${OLLAMA_BASE_URL}"
        }
    },
    "embeddings": {
        "provider": "ollama",  # Privacy-preserving local embeddings
        "model": "nomic-embed-text"
    }
}
```

---

## Development

### Prerequisites

```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Node.js (for frontend)
# macOS: brew install node
# Linux: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
```

### Development Setup

```bash
# Backend
uv sync --dev
uv run pre-commit install

# Frontend
cd frontend && npm install
```

### Code Quality

```bash
# Format code
make format

# Lint
make lint

# Type check
make type-check

# Security scan
make security-scan

# All quality checks
make quality-check
```

### Makefile Commands

```bash
make help                # Show all available commands
make dev-setup           # Complete development setup
make test                # Run tests
make test-coverage       # Run tests with coverage
make docs                # Generate documentation
make docker-build        # Build Docker image
```

---

## Testing

```bash
# Run all tests
uv run pytest

# Run CI tests only
uv run pytest tests/ci/ -v

# Run with coverage
uv run pytest --cov=src/docfusion --cov-report=html

# Run specific test categories
uv run pytest -m "not slow"           # Skip slow tests
uv run pytest -m integration          # Integration tests only
uv run pytest -m security             # Security tests only
```

### Test Structure

- `tests/ci/` - Core functionality tests (28 files)
- `tests/integration/` - Cross-module integration tests
- `tests/security/` - Security validation tests
- `tests/performance/` - Benchmark tests

---

## Deployment

### Docker

```bash
# Build image
docker build -t docfusion:latest .

# Run with docker-compose
docker-compose up -d
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f infra/kubernetes/

# Check status
kubectl get pods -n docfusion
```

### Environment-Specific Configs

```
infra/
├── docker/
│   ├── Dockerfile.dev
│   └── Dockerfile.prod
├── kubernetes/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── terraform/
│   ├── main.tf
│   └── variables.tf
└── ansible/
    └── playbooks/
```

---

## Security

DocuFusion implements enterprise-grade security:

- **Authentication**: Database auth, SSO/OAuth2 ready
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Audit Logging**: Complete action audit trail
- **Compliance**: GDPR, HIPAA, SOC 2 ready

### Default Roles

| Role | Permissions |
|------|-------------|
| Admin | Full system access |
| DocumentEditor | Create, edit, delete documents |
| DocumentViewer | Read-only document access |
| ProjectManager | Project and opportunity management |
| ComplianceOfficer | Compliance validation and reporting |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run quality checks (`make quality-check`)
5. Commit with conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Convention

```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes (formatting, etc.)
refactor: Code refactoring
test: Add or update tests
chore: Maintenance tasks
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [UV](https://github.com/astral-sh/uv) - Ultra-fast Python package manager
- [Ruff](https://github.com/astral-sh/ruff) - Fast Python linter
- [Flask-AppBuilder](https://github.com/dpgaspar/Flask-AppBuilder) - Enterprise web framework
- [Next.js](https://nextjs.org/) - React framework
- [Crawl4AI](https://github.com/unclecode/crawl4ai) - AI-powered web scraping

---

<p align="center">
  <strong>DocuFusion</strong> - Transform documents into strategic assets
</p>
