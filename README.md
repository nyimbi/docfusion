# DocuFusion

[![CI/CD Pipeline](https://github.com/yourusername/docfusion/workflows/CI/badge.svg)](https://github.com/yourusername/docfusion/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Code Style: Ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![Type Checked: MyPy](https://img.shields.io/badge/type%20checked-mypy-blue.svg)](https://mypy-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **AI-Powered Document Intelligence Platform** for autonomous RFP response, proposal generation, and enterprise document workflows.

DocuFusion transforms documents from static artifacts into strategic assets using generative AI, multi-agent collaboration, predictive compliance, and real-time collaborative editing.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
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
- [Monitoring & Observability](#monitoring--observability)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Performance Considerations](#performance-considerations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ](#faq)

---

## Overview

DocuFusion is an enterprise-grade platform that revolutionizes how organizations create, manage, and optimize proposals and RFP responses. Unlike traditional document management systems, DocuFusion leverages:

- **Generative AI** for intelligent content creation and enhancement
- **Multi-Agent Orchestration** for collaborative document generation
- **Predictive Analytics** for win probability and competitive positioning
- **Real-Time Collaboration** with CRDT-based conflict resolution
- **Automated Compliance** validation against FAR/DFARS, SOC 2, and industry standards
- **Git + LaTeX** for professional document versioning and typesetting

### Who Is This For?

| User Type | Primary Use Cases |
|-----------|-------------------|
| **Government Contractors** | FAR/DFARS compliance, proposal generation, compliance validation |
| **Enterprise Sales Teams** | Complex RFP responses, competitive analysis, win probability |
| **Business Development** | Opportunity tracking, pipeline management, qualification scoring |
| **Legal/Compliance Teams** | Contract workflows, audit trails, regulatory compliance |
| **Proposal Managers** | Multi-stakeholder coordination, deadline management, review workflows |

---

## Key Features

### Document Intelligence
- Multi-format rendering (PDF, DOCX, HTML, LaTeX)
- Git-based version control for document fragments and templates
- Cross-reference and citation management
- Automatic TOC generation and brand formatting
- LaTeX typesetting for professional output

### AI-Powered Capabilities
- Content generation with organizational voice consistency (Voice DNA)
- Readability analysis and style recommendations
- Automatic keyword and entity extraction
- Win probability prediction using ML models (XGBoost, scikit-learn)
- RAG-powered context retrieval

### Collaboration
- Real-time multi-user editing with presence awareness
- CRDT-based conflict-free concurrent editing (Yjs)
- Comment threading with resolution workflows
- Fine-grained permission management (RBAC)
- Activity audit logging

### Opportunity Discovery
- 1000+ global procurement source databases
- AI-driven web scraping with Cloudflare bypass
- Automatic opportunity qualification scoring
- Competitive landscape analysis
- Source health monitoring

### Enterprise Security
- Role-based access control (RBAC)
- AES-256 encryption at rest and in transit
- Complete audit logging
- GDPR, HIPAA, SOC 2, ISO 27001 compliance ready
- JWT-based authentication with session management

---

## Technology Stack

### Backend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Runtime** | Python | 3.10+ | Core application runtime |
| **Web Framework** | FastAPI | 0.100+ | Async REST API |
| **Admin UI** | Flask-AppBuilder | 4.0+ | Enterprise admin interface |
| **Database** | PostgreSQL | 15+ | Primary data store |
| **ORM** | SQLAlchemy | 2.0+ | Database abstraction |
| **Migrations** | Alembic | 1.12+ | Schema versioning |
| **Cache** | Redis | 7+ | Sessions, caching, pub/sub |
| **Task Queue** | Celery | 5.3+ | Background job processing |
| **AI/LLM** | OpenAI, Ollama | - | Content generation |
| **ML** | scikit-learn, XGBoost | - | Predictive analytics |
| **NLP** | NLTK, Transformers | - | Text analysis |
| **Scraping** | Crawl4AI, Playwright | - | Opportunity discovery |

### Frontend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | Next.js | 15 | React meta-framework |
| **UI Library** | React | 19 | Component architecture |
| **Language** | TypeScript | 5 | Type safety |
| **Styling** | Tailwind CSS | 3 | Utility-first CSS |
| **Components** | Radix UI | - | Accessible primitives |
| **Editor** | TipTap | 2.0+ | Rich text editing |
| **Collaboration** | Yjs | - | CRDT sync engine |
| **State** | Zustand | - | Global state management |
| **Data Fetching** | React Query | 5 | Server state management |
| **Database ORM** | Drizzle | - | Type-safe SQL |
| **Real-time** | Pusher.js | - | WebSocket communication |

### Infrastructure

| Category | Technology | Purpose |
|----------|------------|---------|
| **Containerization** | Docker | Application packaging |
| **Orchestration** | Docker Compose, Kubernetes | Service management |
| **Reverse Proxy** | Traefik | SSL termination, routing |
| **Monitoring** | Prometheus | Metrics collection |
| **Visualization** | Grafana | Dashboards |
| **IaC** | Terraform, Ansible | Infrastructure provisioning |

### Development Tools

| Category | Technology | Purpose |
|----------|------------|---------|
| **Package Manager** | UV | Fast Python dependency management |
| **Linting** | Ruff | Python linting & formatting |
| **Type Checking** | MyPy | Static type analysis |
| **Testing** | pytest | Test framework |
| **Security** | Bandit, Safety | Vulnerability scanning |
| **Pre-commit** | pre-commit | Git hooks |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Next.js 15 Frontend              │  Flask-AppBuilder Admin                 │
│  ├─ React 19 Components           │  ├─ Document Management UI              │
│  ├─ TipTap Collaborative Editor   │  ├─ Opportunity Pipeline                │
│  ├─ Yjs CRDT Sync                 │  ├─ Analytics Dashboards                │
│  ├─ Pusher.js WebSocket           │  └─ User/Role Administration            │
│  └─ Zustand State Management      │                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  REST API Endpoints               │  WebSocket Events                        │
│  ├─ /api/documents                │  ├─ document_edit                        │
│  ├─ /api/ai_features              │  ├─ cursor_position                      │
│  ├─ /api/collaboration            │  ├─ typing_indicator                     │
│  ├─ /api/opportunities            │  ├─ presence_update                      │
│  ├─ /api/workflows                │  ├─ ai_analysis_request                  │
│  ├─ /api/compliance               │  └─ workflow_action                      │
│  └─ /api/templates                │                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  DocumentService    │  AIService       │  CollaborationService │  Workflow  │
│  TemplateService    │  NLPService      │  ComplianceService    │ Integration│
│  DiscoveryService   │  VoiceDNAService │  NotificationService  │ Orchestrat │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENGINE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Document Engine      │  Discovery Engine   │  Agent System   │  NLP Engine │
│  ├─ PDFRenderer       │  ├─ UniversalScraper│  ├─ AgentCrew   │  ├─ Analyzers│
│  ├─ DOCXRenderer      │  ├─ VisionScraper   │  ├─ AgentSwarm  │  ├─ Extractors
│  ├─ HTMLRenderer      │  ├─ CloudScraper    │  ├─ MemoryMgr   │  ├─ Generators
│  ├─ LaTeXFormatter    │  └─ GlobalSourceDB  │  └─ ToolSystem  │  └─ VoiceDNA │
│  └─ BrandFormatter    │                     │                 │              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL           │  Redis               │  Vector Store (RAG)           │
│  ├─ SQLAlchemy ORM    │  ├─ Session Storage  │  ├─ Semantic Search           │
│  ├─ Alembic Migrations│  ├─ Cache Layer      │  ├─ Embeddings (Ollama)       │
│  └─ asyncpg Driver    │  └─ Pub/Sub          │  └─ pgai Extensions           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Docker/Kubernetes    │  Traefik           │  Celery Workers                 │
│  ├─ Multi-stage Build │  ├─ SSL/TLS        │  ├─ Background Tasks            │
│  ├─ Health Checks     │  ├─ Load Balancing │  ├─ Scheduled Jobs (Beat)       │
│  └─ dumb-init         │  └─ Auto Certs     │  └─ Priority Queues             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
                    ┌──────────────┐
                    │    User      │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │  Frontend │   │    API    │   │  WebSocket│
    │ (Next.js) │   │ (FastAPI) │   │ (Pusher)  │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                  ┌───────────────┐
                  │   Services    │
                  │    Layer      │
                  └───────┬───────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Document  │  │    AI      │  │  Discovery │
   │   Engine   │  │   Agents   │  │   Engine   │
   └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ PostgreSQL │  │   Redis    │  │   Vector   │
   │            │  │            │  │   Store    │
   └────────────┘  └────────────┘  └────────────┘
```

---

## Project Structure

```
docfusion/
├── src/docfusion/              # Core Python package (367 files, ~25K+ LOC)
│   ├── agents/                 # Multi-agent orchestration system
│   │   ├── core/               # Core agent execution logic
│   │   ├── orchestration/      # Agent coordination
│   │   ├── specialists/        # Specialized agent types
│   │   ├── llm/                # LLM provider integration
│   │   ├── memory/             # Agent memory management
│   │   └── tools/              # Tool definitions
│   │
│   ├── ai_agents/              # Advanced AI agent implementations
│   │   ├── execution/          # Execution strategies
│   │   ├── orchestration/      # Orchestration patterns
│   │   └── reasoning/          # Reasoning engines
│   │
│   ├── api/                    # API layer
│   │   ├── endpoints/          # Route handlers
│   │   ├── graphql/            # GraphQL schema (optional)
│   │   ├── middleware/         # Request middleware
│   │   └── validators/         # Input validation
│   │
│   ├── collaboration/          # Real-time collaboration
│   │   ├── editing/            # CRDT operations
│   │   ├── versioning/         # Version control
│   │   ├── conflicts/          # Conflict resolution
│   │   ├── permissions/        # Access control
│   │   └── presence/           # User presence tracking
│   │
│   ├── compliance/             # Regulatory compliance
│   │   ├── frameworks/         # FAR/DFARS, SOC 2, GDPR, HIPAA
│   │   ├── validators/         # Compliance checkers
│   │   ├── evidence/           # Evidence collection
│   │   └── reporting/          # Compliance reports
│   │
│   ├── composition/            # Document composition DSL
│   │
│   ├── discovery/              # Opportunity discovery
│   │   ├── crawlers/           # Web scraping strategies
│   │   │   ├── commercial/     # Commercial databases
│   │   │   ├── government/     # Government portals (SAM.gov, etc.)
│   │   │   └── ai_driven/      # AI-powered intelligent scrapers
│   │   ├── analyzers/          # Content analysis
│   │   └── matchers/           # Opportunity matching
│   │
│   ├── document_engine/        # Document generation
│   │   ├── assembler/          # Fragment assembly
│   │   ├── formatter/          # Brand formatting
│   │   └── renderer/           # PDF, DOCX, HTML, LaTeX rendering
│   │
│   ├── intelligence/           # Predictive analytics
│   │   ├── analyzers/          # Document analysis
│   │   ├── predictors/         # ML models (win probability)
│   │   └── recommenders/       # Content recommendations
│   │
│   ├── integrations/           # External connectors
│   │   ├── connectors/         # CRM/ERP (Salesforce, HubSpot)
│   │   └── sync/               # Data synchronization
│   │
│   ├── nlp/                    # Natural language processing
│   │   ├── analyzers/          # Readability, sentiment
│   │   ├── extractors/         # Entity, keyword extraction
│   │   └── generators/         # Text generation
│   │
│   ├── notifications/          # Multi-channel notifications
│   │   ├── channels/           # Email, Slack, SMS
│   │   └── delivery/           # Delivery management
│   │
│   ├── security/               # Security & auth
│   │   ├── authentication/     # JWT, OAuth
│   │   ├── authorization/      # RBAC
│   │   ├── encryption/         # AES-256
│   │   └── audit/              # Audit logging
│   │
│   ├── storage/                # Data persistence
│   │   ├── engines/            # Storage backends
│   │   ├── rag/                # Retrieval-augmented generation
│   │   └── retrievers/         # Document retrieval
│   │
│   ├── visualization/          # Charts & diagrams
│   │
│   ├── voice_dna/              # Organizational voice analysis
│   │   ├── analyzer/           # Voice style analysis
│   │   ├── profiler/           # Voice DNA profiling
│   │   └── validator/          # Consistency validation
│   │
│   ├── workflow/               # Business process automation
│   │   ├── automation/         # Workflow automation
│   │   ├── processes/          # Process definitions
│   │   └── monitoring/         # Workflow monitoring
│   │
│   ├── cli/                    # Command-line interface
│   ├── config/                 # Configuration management
│   ├── core/                   # Core utilities
│   └── models/                 # Shared data models
│
├── app/                        # Flask-AppBuilder web application
│   ├── blueprints/             # Modular routes
│   ├── models.py               # SQLAlchemy models
│   ├── services/               # Business logic
│   └── websocket/              # Real-time handlers
│
├── frontend/                   # Next.js 15 + React 19 frontend
│   ├── app/                    # App Router pages
│   │   ├── (app)/              # Authenticated pages
│   │   │   ├── documents/      # Document management
│   │   │   ├── opportunities/  # Opportunity pipeline
│   │   │   ├── templates/      # Template management
│   │   │   ├── calendar/       # Deadline calendar
│   │   │   └── settings/       # User settings
│   │   ├── (auth)/             # Auth pages (sign-in, sign-up)
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI (Button, Card, Input, etc.)
│   │   └── ...                 # Feature components
│   ├── lib/                    # Utilities
│   │   ├── stores/             # Zustand stores
│   │   ├── hooks/              # Custom React hooks
│   │   ├── db/                 # Drizzle ORM
│   │   └── types/              # TypeScript definitions
│   ├── styles/                 # Tailwind CSS
│   └── drizzle/                # Database migrations
│
├── tests/                      # Test suite (70 test files)
│   ├── ci/                     # CI tests (auto-discovered)
│   ├── integration/            # Integration tests
│   ├── security/               # Security tests
│   └── performance/            # Benchmarks
│
├── docs/                       # Documentation
│   ├── design/                 # Product specifications
│   ├── api/                    # API documentation
│   ├── technical/              # Technical deep-dives
│   └── user/                   # User guides
│
├── infra/                      # Infrastructure as Code
│   ├── docker/                 # Docker configurations
│   ├── kubernetes/             # K8s manifests
│   ├── terraform/              # Cloud provisioning
│   └── ansible/                # Configuration management
│
├── config/                     # Environment configs
│   ├── dev/                    # Development
│   ├── staging/                # Staging
│   └── prod/                   # Production
│
├── migrations/                 # Alembic migrations
├── examples/                   # Usage examples
│
├── pyproject.toml              # Python project config
├── uv.lock                     # UV lockfile
├── Dockerfile                  # Multi-stage container build
├── docker-compose.yml          # Service orchestration
├── Makefile                    # 95+ automation commands
└── CLAUDE.md                   # AI assistant instructions
```

---

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.10+ | 3.12 recommended |
| Node.js | 18+ | 20 LTS recommended |
| PostgreSQL | 14+ | 15 recommended |
| Redis | 6+ | Optional, for caching |
| UV | Latest | Python package manager |

### Installation

#### Option 1: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/docfusion.git
cd docfusion

# Install UV (ultra-fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
uv sync --dev

# Install pre-commit hooks
uv run pre-commit install

# Initialize the database
uv run alembic upgrade head

# Start the backend
uv run python -m docfusion

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

#### Option 2: Docker Development

```bash
# Build and run all services
docker-compose up -d

# Watch logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Admin Panel: http://localhost:5000/admin
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```

#### Option 3: Using Make

```bash
# Complete development setup
make dev-setup

# Validate environment
make validate-env

# Run the application
make run-dev
```

### First Steps After Installation

1. **Create an admin user**:
   ```bash
   uv run flask fab create-admin
   ```

2. **Access the admin panel**: http://localhost:5000/admin

3. **Create your first document**: Navigate to Documents → Create New

4. **Configure AI**: Set your `OPENAI_API_KEY` in `.env` or use local Ollama

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

# Render to PDF with brand styling
renderer = PDFRenderer()
pdf_bytes = await renderer.render(document, style="corporate")
```

**Supported Formats:**

| Format | Engine | Use Case |
|--------|--------|----------|
| PDF | WeasyPrint/LaTeX | Final deliverables, printing |
| DOCX | python-docx | Client collaboration, editing |
| HTML | Jinja2 | Web preview, email |
| LaTeX | TeX Live | Academic, professional typesetting |

**Key Features:**
- Git-based fragment versioning
- Cross-reference resolution
- Automatic TOC generation
- Brand asset management
- Multi-language support

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

**Scraping Strategies:**

| Strategy | Technology | Use Case |
|----------|------------|----------|
| Universal | Crawl4AI | Standard websites |
| Vision | Playwright + CV | Complex layouts |
| Cloud | CloudScraper | Cloudflare-protected |
| AI-Driven | LLM + Vision | Unstructured content |

**Source Categories:**
- Government portals (SAM.gov, grants.gov)
- State procurement databases
- Commercial RFP databases
- Foundation grant portals
- International procurement

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

**Agent Types:**

| Agent | Role | Capabilities |
|-------|------|--------------|
| ResearchAgent | Information gathering | Web search, document analysis, competitive intelligence |
| WriterAgent | Content generation | Voice-consistent drafting, style adherence |
| ReviewerAgent | Quality assurance | Compliance check, grammar, consistency |
| CoordinatorAgent | Orchestration | Task distribution, conflict resolution |
| AnalysisAgent | Requirements analysis | Gap detection, scope validation |

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
print(f"Readability: {analysis.readability_score}")  # Flesch-Kincaid
print(f"Sentiment: {analysis.sentiment}")
print(f"Key Topics: {analysis.topics}")
```

**Voice DNA Features:**
- Tone analysis (formal, casual, technical)
- Vocabulary fingerprinting
- Sentence structure patterns
- Industry jargon detection
- Consistency scoring

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

**ML Models:**
- XGBoost for win probability
- TF-IDF + similarity for content matching
- Clustering for opportunity segmentation
- Time series for deadline forecasting

### Collaboration System

Real-time multi-user editing with conflict resolution.

```python
from docfusion.collaboration import CollaborativeEditor, PresenceManager

# Initialize collaborative session
editor = CollaborativeEditor(document_id="doc-123")
presence = PresenceManager()

# Handle real-time edits (CRDT operations)
@editor.on("edit")
async def handle_edit(operation, user):
    merged = await editor.apply_operation(operation)
    await editor.broadcast(merged, exclude=user)

# Track active collaborators
@presence.on("join")
async def handle_join(user, document_id):
    collaborators = await presence.get_active(document_id)
    await broadcast_presence(collaborators)
```

**Collaboration Features:**
- Conflict-free concurrent editing (Yjs CRDT)
- Real-time cursor tracking
- User presence indicators
- Comment threads with @mentions
- Change attribution and history
- Offline editing with sync

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

| Framework | Coverage | Use Case |
|-----------|----------|----------|
| FAR/DFARS | Federal Acquisition Regulation | Government contracting |
| SOC 2 Type II | Security controls | SaaS, data handling |
| ISO 27001 | Information security | Enterprise security |
| GDPR | Data protection | EU operations |
| HIPAA | Healthcare data | Healthcare sector |
| NIST CSF | Cybersecurity | Critical infrastructure |

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

**Workflow Features:**
- Visual workflow designer
- Conditional branching
- Parallel execution
- SLA monitoring
- Escalation rules
- Email/Slack notifications

---

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET, POST | List/create documents |
| `/api/documents/<id>` | GET, PUT, DELETE | Document CRUD |
| `/api/documents/<id>/generate` | POST | Generate PDF/DOCX/HTML |
| `/api/documents/<id>/versions` | GET | Version history |
| `/api/ai_features/enhance` | POST | AI content enhancement |
| `/api/ai_features/analyze` | POST | Content analysis |
| `/api/ai_features/suggest` | POST | Content suggestions |
| `/api/collaboration/documents/<id>/collaborators` | GET, POST | Manage collaborators |
| `/api/collaboration/documents/<id>/comments` | GET, POST | Comment threads |
| `/api/opportunities` | GET, POST | Opportunity pipeline |
| `/api/opportunities/<id>/analyze` | POST | AI opportunity analysis |
| `/api/opportunities/<id>/qualify` | POST | Qualification scoring |
| `/api/workflows/instances` | GET, POST | Workflow management |
| `/api/workflows/instances/<id>/actions` | POST | Execute workflow action |
| `/api/compliance/validate/<id>` | POST | Compliance validation |
| `/api/templates` | GET, POST | Template management |
| `/api/templates/<id>/fragments` | GET, POST | Template fragments |
| `/api/voice-profiles` | GET, POST | Voice DNA profiles |
| `/api/health` | GET | Health check |

### WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `document_edit` | Client → Server | `{op, pos, content}` | Send edit operation |
| `document_updated` | Server → Client | `{ops[], version}` | Broadcast content changes |
| `cursor_position` | Bidirectional | `{user, pos}` | Collaborative cursor tracking |
| `typing_indicator` | Bidirectional | `{user, isTyping}` | Real-time typing awareness |
| `presence_join` | Client → Server | `{documentId}` | User joins document |
| `presence_update` | Server → Client | `{users[]}` | Active users update |
| `add_comment` | Client → Server | `{pos, text}` | Add comment to document |
| `resolve_comment` | Client → Server | `{commentId}` | Resolve comment thread |
| `ai_analysis_request` | Client → Server | `{type, selection}` | Request AI analysis |
| `ai_analysis_complete` | Server → Client | `{result}` | AI analysis result |
| `workflow_action` | Client → Server | `{instanceId, action}` | Execute workflow step |

---

## Frontend

The frontend is built with Next.js 15 and React 19, providing a modern, responsive interface.

### Key Technologies

| Technology | Purpose |
|------------|---------|
| Next.js 15 | Server components, App Router |
| React 19 | UI components |
| TypeScript 5 | Type safety |
| Tailwind CSS 3 | Styling |
| Radix UI | Accessible primitives |
| TipTap | Rich text editor |
| Yjs | CRDT collaboration |
| Zustand | State management |
| React Query | Server state |
| Drizzle | Type-safe ORM |
| Pusher.js | Real-time sync |

### Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page
│   ├── (app)/                  # Authenticated routes
│   │   ├── layout.tsx          # App shell with sidebar
│   │   ├── documents/          # Document management
│   │   │   ├── page.tsx        # Document list
│   │   │   └── [id]/page.tsx   # Document editor
│   │   ├── opportunities/      # Opportunity pipeline
│   │   ├── templates/          # Template management
│   │   ├── calendar/           # Deadline tracking
│   │   ├── partners/           # Team collaboration
│   │   └── settings/           # User preferences
│   ├── (auth)/                 # Authentication
│   │   ├── sign-in/            # Login
│   │   ├── sign-up/            # Registration
│   │   └── reset-password/     # Password recovery
│   └── api/                    # API routes
│
├── components/
│   ├── ui/                     # Base components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── editor/                 # TipTap editor
│   ├── collaboration/          # Presence, comments
│   └── dashboard/              # Analytics widgets
│
└── lib/
    ├── auth-client.ts          # Auth SDK
    ├── auth-provider.tsx       # Auth context
    ├── theme-provider.tsx      # Dark/light mode
    ├── stores/                 # Zustand stores
    │   └── ai-store.ts         # AI state
    ├── hooks/                  # Custom hooks
    ├── db/                     # Drizzle config
    ├── api/                    # API client
    └── utils.ts                # Utilities
```

### Running the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Environment Variables

Create `frontend/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=ws://localhost:5000/ws

# Authentication
NEXT_PUBLIC_AUTH_URL=http://localhost:5000/auth
BETTER_AUTH_SECRET=your-secret-key

# Real-time (Pusher)
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2

# Database (for Drizzle)
DATABASE_URL=postgresql://user:pass@localhost:5432/docfusion_frontend

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
NEXT_PUBLIC_ENABLE_COLLABORATION=true
```

---

## Configuration

### Environment Variables

#### Backend Configuration

```bash
# Core
SECRET_KEY=your-secret-key-min-32-chars
DEBUG=false
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/docfusion
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://localhost:6379/0

# AI/LLM Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Security
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your-32-byte-key

# Document Generation
LATEX_ENGINE=xelatex
PDF_FONT_PATH=/usr/share/fonts

# Discovery
DISCOVERY_ENABLED=true
SCRAPING_RATE_LIMIT=10

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_DISCOVERY=true
ENABLE_COLLABORATION=true
ENABLE_COMPLIANCE=true

# Observability
LOG_LEVEL=INFO
SENTRY_DSN=https://...
PROMETHEUS_ENABLED=true

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-password
```

### LLM Provider Configuration

DocuFusion supports multiple LLM providers:

```python
# src/docfusion/config/llm_config.py
LLM_CONFIG = {
    "default_provider": "openai",
    "providers": {
        "openai": {
            "model": "gpt-4-turbo",
            "api_key": "${OPENAI_API_KEY}",
            "max_tokens": 4096,
            "temperature": 0.7
        },
        "azure_openai": {
            "model": "gpt-4",
            "api_key": "${AZURE_OPENAI_API_KEY}",
            "endpoint": "${AZURE_OPENAI_ENDPOINT}",
            "api_version": "2024-02-01"
        },
        "ollama": {
            "model": "llama3",
            "base_url": "${OLLAMA_BASE_URL}",
            "context_window": 8192
        }
    },
    "embeddings": {
        "provider": "ollama",  # Privacy-preserving local embeddings
        "model": "nomic-embed-text",
        "dimensions": 768
    },
    "rate_limits": {
        "requests_per_minute": 60,
        "tokens_per_minute": 90000
    }
}
```

### Database Configuration

```python
# Async PostgreSQL with connection pooling
DATABASE_CONFIG = {
    "url": "${DATABASE_URL}",
    "pool_size": 20,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "echo": False,  # Set True for SQL debugging
}
```

---

## Development

### Development Setup

```bash
# Backend
uv sync --dev
uv run pre-commit install

# Frontend
cd frontend && npm install
```

### Code Quality Commands

| Command | Description |
|---------|-------------|
| `make format` | Format code with Ruff |
| `make lint` | Run Ruff linting |
| `make type-check` | MyPy static analysis |
| `make security-scan` | Bandit + Safety scan |
| `make quality-check` | All quality checks |
| `make pre-commit-run` | Run pre-commit hooks |
| `make complexity` | Code complexity analysis |

### Makefile Reference

```bash
# Show all available commands
make help

# Development
make dev-setup           # Complete development setup
make validate-env        # Validate environment
make run-dev             # Run development server

# Testing
make test                # Run tests
make test-coverage       # Tests with coverage (80% min)
make test-parallel       # Parallel test execution
make test-watch          # Continuous testing
make benchmark           # Performance benchmarks

# Code Quality
make format              # Format code
make lint                # Lint code
make type-check          # Type checking
make quality-check       # All quality checks

# Dependencies
make uv-add PACKAGE=name     # Add production dependency
make uv-add-dev PACKAGE=name # Add dev dependency
make deps-update             # Update all dependencies
make deps-tree               # Show dependency tree
make deps-audit              # Security audit

# Documentation
make docs                # Generate Sphinx docs
make docs-serve          # Serve docs locally

# Docker
make docker-build        # Build image
make docker-run          # Run container
make docker-clean        # Clean images

# Database
make db-migrate          # Run migrations
make db-rollback         # Rollback last migration
make db-reset            # Reset database
```

### Code Style

#### Python
- Modern typing: `str | None`, `list[str]`, `dict[str, Any]`
- Async throughout with `async/await`
- Pydantic v2 for validation:
  ```python
  model_config = ConfigDict(extra='forbid', validate_by_name=True)
  ```
- UUID7 for IDs: `id: str = Field(default_factory=uuid7str)`
- Logging methods prefixed with `_log_`

#### TypeScript
- Strict mode enabled
- React 19 patterns (Server Components, Suspense)
- Tailwind CSS for styling
- Zod for runtime validation

### Pre-commit Hooks

The project uses pre-commit hooks for quality enforcement:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    hooks:
      - id: mypy
  - repo: https://github.com/PyCQA/bandit
    hooks:
      - id: bandit
  - repo: https://github.com/commitizen-tools/commitizen
    hooks:
      - id: commitizen
```

---

## Testing

### Running Tests

```bash
# Run all tests
uv run pytest

# Run CI tests only (auto-discovered)
uv run pytest tests/ci/ -v

# Run with coverage
uv run pytest --cov=src/docfusion --cov-report=html

# Run specific test categories
uv run pytest -m "not slow"           # Skip slow tests
uv run pytest -m integration          # Integration tests only
uv run pytest -m security             # Security tests only
uv run pytest -m performance          # Performance tests only

# Parallel execution (faster)
uv run pytest -n auto

# Watch mode (re-run on changes)
uv run pytest-watch
```

### Test Structure

```
tests/
├── ci/                     # CI tests (auto-discovered, 28 files)
│   ├── test_document_engine_assembler.py
│   ├── test_document_engine_formatter.py
│   ├── test_document_engine_renderer.py
│   ├── test_discovery_crawlers.py
│   ├── test_discovery_analyzers.py
│   ├── test_storage_engines.py
│   ├── test_nlp_analyzers.py
│   └── ...
├── integration/            # Cross-module tests
│   ├── test_document_workflow.py
│   ├── test_collaboration_flow.py
│   └── test_api_endpoints.py
├── security/               # Security validation (4 files)
│   ├── test_authentication_security.py
│   ├── test_authorization_security.py
│   ├── test_data_protection.py
│   └── test_security_simple.py
├── performance/            # Benchmarks
│   ├── test_rendering_performance.py
│   └── test_scraping_performance.py
├── fixtures/               # Test fixtures
│   ├── sample_documents/
│   ├── mock_responses/
│   └── conftest.py
└── conftest.py            # Global pytest config
```

### Test Guidelines

- **No mocks** except for LLM calls
- Use pytest fixtures with real objects
- Async tests: no `@pytest.mark.asyncio` decorators needed
- Tests in `tests/ci/` are auto-discovered by CI
- Minimum 80% code coverage required

### Frontend Testing

```bash
cd frontend

# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## Deployment

### Docker Production Build

```bash
# Build production image
docker build -t docfusion:latest --target production .

# Run with environment file
docker run -d \
  --name docfusion \
  --env-file .env.production \
  -p 5000:5000 \
  docfusion:latest
```

### Docker Compose (Full Stack)

```bash
# Start all services
docker-compose up -d

# Services started:
# - docfusion-app (port 5000)
# - postgres (port 5432)
# - redis (port 6379)
# - prometheus (port 9090)
# - grafana (port 3001)
# - traefik (ports 80, 443)
# - celery-worker
# - celery-beat

# View logs
docker-compose logs -f docfusion-app

# Stop all services
docker-compose down
```

### Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f infra/kubernetes/

# Verify deployment
kubectl get pods -n docfusion
kubectl get services -n docfusion

# Check logs
kubectl logs -f deployment/docfusion-app -n docfusion
```

### Environment-Specific Configuration

```
config/
├── dev/
│   ├── .env
│   └── docker-compose.override.yml
├── staging/
│   ├── .env
│   └── values.yaml  # Helm values
└── prod/
    ├── .env
    └── values.yaml
```

### Health Checks

The application exposes health endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic health check |
| `/health/ready` | Readiness probe (DB, Redis) |
| `/health/live` | Liveness probe |
| `/metrics` | Prometheus metrics |

---

## Monitoring & Observability

### Metrics (Prometheus)

DocuFusion exports Prometheus metrics at `/metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `docfusion_requests_total` | Counter | Total HTTP requests |
| `docfusion_request_duration_seconds` | Histogram | Request latency |
| `docfusion_documents_generated_total` | Counter | Documents generated |
| `docfusion_ai_requests_total` | Counter | AI API calls |
| `docfusion_collaboration_sessions_active` | Gauge | Active collaboration sessions |
| `docfusion_celery_tasks_total` | Counter | Background tasks processed |

### Logging

Structured JSON logging with configurable levels:

```python
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "message": "Document generated",
    "document_id": "doc-123",
    "format": "pdf",
    "duration_ms": 1234,
    "user_id": "user-456"
}
```

### Distributed Tracing

OpenTelemetry support for request tracing:

```bash
# Enable tracing
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
```

### Grafana Dashboards

Pre-configured dashboards available:

- **Application Overview**: Request rate, latency, errors
- **Document Generation**: Render times, format distribution
- **AI Usage**: Token consumption, latency, costs
- **Collaboration**: Active sessions, conflict rate
- **Infrastructure**: CPU, memory, disk usage

---

## Security

DocuFusion implements enterprise-grade security:

### Authentication

| Method | Description |
|--------|-------------|
| JWT | Stateless API authentication |
| Session | Server-side session with Redis |
| OAuth2 | SSO integration (Google, Microsoft) |
| API Keys | Service-to-service auth |

### Authorization (RBAC)

| Role | Permissions |
|------|-------------|
| Admin | Full system access |
| DocumentEditor | Create, edit, delete own documents |
| DocumentViewer | Read-only document access |
| ProjectManager | Project and opportunity management |
| ComplianceOfficer | Compliance validation and reporting |
| TemplateManager | Template CRUD operations |

### Encryption

| Layer | Algorithm | Key Size |
|-------|-----------|----------|
| At Rest | AES-256-GCM | 256 bits |
| In Transit | TLS 1.3 | 256 bits |
| Passwords | bcrypt | 12 rounds |
| API Keys | HMAC-SHA256 | 256 bits |

### Audit Logging

All sensitive actions are logged:

```python
{
    "timestamp": "2024-01-15T10:30:00Z",
    "action": "document.download",
    "actor": "user-123",
    "resource": "doc-456",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "result": "success"
}
```

### Security Scanning

```bash
# Run security scan
make security-scan

# Scans include:
# - Bandit (Python AST analysis)
# - Safety (dependency vulnerabilities)
# - pip-audit (PyPI security advisories)
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failures

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify connection
uv run python -c "from docfusion.core.database import engine; print(engine.url)"

# Reset database
make db-reset
```

#### Redis Connection Issues

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

#### AI/LLM Errors

```bash
# Verify OpenAI API key
echo $OPENAI_API_KEY | head -c 10

# Test Ollama connection
curl http://localhost:11434/api/tags

# Check rate limits
# If hitting limits, reduce OPENAI_MAX_REQUESTS_PER_MINUTE
```

#### Document Generation Failures

```bash
# Check LaTeX installation
xelatex --version

# Verify fonts
fc-list | grep -i arial

# Check logs for specific errors
docker-compose logs docfusion-app | grep -i "render"
```

#### Collaboration Sync Issues

```bash
# Check WebSocket connection
curl -i http://localhost:5000/ws/health

# Verify Pusher credentials
echo $PUSHER_APP_KEY

# Check client console for errors
# Open browser DevTools → Console
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=DEBUG uv run python -m docfusion

# Enable SQL query logging
DATABASE_ECHO=true uv run python -m docfusion

# Enable async tracing
PYTHONASYNCIODEBUG=1 uv run python -m docfusion
```

### Getting Help

1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/yourusername/docfusion/issues)
3. Enable debug logging and capture relevant logs
4. Open a new issue with:
   - DocuFusion version
   - Python version
   - Operating system
   - Steps to reproduce
   - Error messages and logs

---

## Performance Considerations

### Database Optimization

- **Connection Pooling**: Default pool size is 20 with 10 overflow
- **Indexes**: Ensure indexes on frequently queried columns
- **Query Optimization**: Use `EXPLAIN ANALYZE` for slow queries
- **Partitioning**: Consider partitioning large tables (documents, audit_logs)

### Caching Strategy

| Cache Layer | TTL | Use Case |
|-------------|-----|----------|
| Redis | 5 min | API responses |
| Application | 1 min | Computed values |
| CDN | 24 hr | Static assets |

### AI Cost Optimization

- Use Ollama for embeddings (free, local)
- Cache AI responses where appropriate
- Batch similar requests
- Use smaller models for simple tasks

### Scaling Recommendations

| Component | Horizontal | Vertical |
|-----------|------------|----------|
| API Server | ✅ Multiple instances | ✅ More CPU |
| Celery Workers | ✅ More workers | ✅ More RAM |
| PostgreSQL | ⚠️ Read replicas | ✅ More RAM, SSD |
| Redis | ⚠️ Cluster mode | ✅ More RAM |

---

## Roadmap

### Current Version (v1.0)
- ✅ Document engine with multi-format rendering
- ✅ Real-time collaboration with CRDT
- ✅ Opportunity discovery engine
- ✅ Multi-agent content generation
- ✅ Compliance validation framework
- ✅ Voice DNA analysis

### Upcoming (v1.1)
- 🔄 Enhanced predictive analytics dashboard
- 🔄 Advanced workflow automation
- 🔄 Extended CRM integrations (Salesforce, HubSpot)
- 🔄 Mobile-responsive improvements

### Future (v2.0)
- 📋 Native mobile applications
- 📋 Advanced AI reasoning capabilities
- 📋 Marketplace for templates and plugins
- 📋 Multi-tenant SaaS deployment
- 📋 GraphQL API

---

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the [code style](#code-style)
4. Run quality checks: `make quality-check`
5. Write/update tests (80% coverage minimum)
6. Commit with conventional commits: `git commit -m 'feat: add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Commit Convention

```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes (formatting, etc.)
refactor: Code refactoring
test: Add or update tests
chore: Maintenance tasks
perf: Performance improvements
ci: CI/CD changes
```

### Pull Request Guidelines

- Keep PRs focused and reasonably sized
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass
- Request review from maintainers

---

## FAQ

### What makes DocuFusion different from other document tools?

DocuFusion combines AI-powered content generation, real-time collaboration, and automated compliance validation in a single platform. Unlike traditional tools that just store documents, DocuFusion actively helps create winning proposals.

### Can I use DocuFusion without cloud AI services?

Yes! DocuFusion supports Ollama for fully local AI inference. You can run embeddings and smaller models entirely on your own infrastructure.

### How does the pricing work for AI features?

DocuFusion passes through AI provider costs. You configure your own API keys (OpenAI, Azure, etc.) and pay those providers directly. Ollama usage is free.

### Is DocuFusion suitable for regulated industries?

Yes. DocuFusion includes compliance frameworks for FAR/DFARS, SOC 2, HIPAA, GDPR, and ISO 27001. All data is encrypted at rest and in transit, with complete audit logging.

### Can I self-host DocuFusion?

Absolutely. DocuFusion is designed for on-premise deployment with Docker and Kubernetes support. All dependencies can run locally.

### How many concurrent users can DocuFusion support?

The architecture scales horizontally. A single server instance comfortably handles 50+ concurrent collaborators. For larger deployments, add more API servers behind a load balancer.

### What document formats are supported?

DocuFusion can generate PDF, DOCX, HTML, and LaTeX. It can import from plain text, Markdown, DOCX, and HTML.

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
- [TipTap](https://tiptap.dev/) - Headless editor framework
- [Yjs](https://yjs.dev/) - CRDT implementation
- [Radix UI](https://radix-ui.com/) - Accessible component primitives

---

<p align="center">
  <strong>DocuFusion</strong> - Transform documents into strategic assets
</p>

<p align="center">
  <a href="https://github.com/yourusername/docfusion">GitHub</a> •
  <a href="https://docfusion.dev/docs">Documentation</a> •
  <a href="https://github.com/yourusername/docfusion/issues">Issues</a>
</p>
