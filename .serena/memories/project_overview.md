# DocuFusion Project Overview

## Purpose
DocuFusion is an AI-powered document intelligence platform focused on RFP (Request for Proposal) response automation and intelligent document composition. The system transforms documents from static artifacts into strategic assets using generative AI, embedded workflows, and predictive compliance.

## Core Architecture
- **Primary Language**: Python 3.10+ (backend) with TypeScript/Next.js 15 (frontend)
- **Package Manager**: UV (ultra-fast Rust-based Python package manager)
- **Code Quality**: Ruff (linting + formatting), MyPy (type checking), pytest (testing)
- **Workflow Orchestration**: Apache Airflow 3.0+ integration
- **Web Framework**: Flask-AppBuilder (enterprise web application framework)
- **Project Structure**: src-layout (`src/docfusion/`)

## Key Components
1. **Discovery System** (`backend/discovery/`) - RFP/tender scraping pipeline
   - Source Registry (YAML configuration)
   - Scrapers (UNGM, AfDB, World Bank, government portals)
   - Pipeline (transform → categorize → deduplicate → sync)

2. **Document Engine** (`src/docfusion/document_engine/`) - LaTeX-based document composition

3. **AI Agents** (`src/docfusion/agents/`) - Intelligent document processing (ai_agents/ reserved for future)

4. **Frontend** (`frontend/`) - Next.js 15 with React 19, TailwindCSS, TipTap editor

## Design Decisions
- **Git + LaTeX**: Document versioning via Git, rendering via LaTeX
- **File-based approach**: Content blocks as separate .tex files
- **Industry standards**: Leverage proven tools instead of custom version management

## Why DocuFusion?
- **Beyond Templates**: Generative AI creates contextual content
- **Embedded Workflows**: E-signatures and payments by milestones
- **Competitive Intelligence**: AI-powered market analysis
- **Human-Centered Design**: Cognitive load management, flow state preservation