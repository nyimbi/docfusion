# DocuFusion: RFP Ingestion + Opportunity Discovery Pipeline

**Date**: 2026-04-16
**Status**: Approved
**Scope**: Wire existing RFP ingestion and discovery modules into working end-to-end pipelines

---

## 1. Problem Statement

DocuFusion has substantial real implementations for both RFP ingestion and opportunity discovery, but the pieces are disconnected:

- **Two separate extraction systems**: Next.js server actions call Azure OpenAI directly; Python modules use DoclingService. No bridge between them.
- **Simulated parser**: The RFP parse route uses `simulateParsingJob` with random delays instead of real processing.
- **Metadata-only uploads**: File upload stores metadata but doesn't persist actual files to storage.
- **Dual requirements tables**: `requirements` (schema.ts, 15 fields) and `rfpRequirements` (schema-rfp.ts, 30+ fields) overlap with no clear ownership.
- **No frontend pages for discovery**: Pipeline and opportunity components exist (10K+ lines) but no page routes.
- **No Python API for RFP or discovery**: FastAPI has document/template/search endpoints but nothing for RFP analysis or scraping orchestration.
- **Two parallel discovery modules**: `backend/discovery/` (operational, 7.5K lines) and `src/docfusion/discovery/` (advanced AI, 20K lines) with no interface boundary.

## 2. Architecture

### 2.1 Bridge Pattern: Direct FastAPI

The Next.js frontend calls Python FastAPI directly for heavy operations (parsing, extraction, scraping). Next.js handles CRUD via Drizzle ORM. Auth is shared via Keycloak OIDC.

**Why direct (not proxied through Next.js)**: Lower latency, better for SSE streaming, both services already reference Keycloak, and the Drizzle schema is managed from Next.js for CRUD.

### 2.2 Data Flow

**RFP Ingestion**:

```
Next.js Upload → SecureStorageService (S3/local)
  → FastAPI /api/v1/rfp/{id}/parse
  → RequirementExtractor → DoclingService
  → RFPAnalyzer → pattern detection, confidence scoring
  → PostgreSQL (rfpRequirements via asyncpg)
  → SSE progress streaming to frontend
  → ComplianceMatrixGenerator → compliance_matrices + compliance_entries
  → Drizzle ORM reads in Next.js for UI
```

**Discovery**:

```
FastAPI /api/v1/discovery/run/{source}
  → ScrapingOrchestrator → 50+ scrapers
  → Pipeline: transform → categorize → deduplicate
  → DocFusionSync → PostgreSQL (opportunities via asyncpg)
  → Drizzle ORM reads in Next.js for UI
  → User: "Convert to RFP" → download docs → enters RFP ingestion
```

### 2.3 Discovery Module Boundaries

- `backend/discovery/` = **operational engine**: scrapers, scheduling, pipeline processing, health monitoring. Called directly by FastAPI endpoints.
- `src/docfusion/discovery/` = **AI enhancement**: universal scraping, computer vision, pattern recognition, qualification analysis. Called via FastAPI for AI-specific features only.

## 3. API Design

### 3.1 RFP Endpoints (FastAPI)

| Method | Path | Purpose | Python Module |
|--------|------|---------|---------------|
| POST | /api/v1/rfp/upload | File upload → SecureStorageService | SecureStorageService |
| POST | /api/v1/rfp/{id}/parse | Trigger parsing pipeline | RequirementExtractor |
| GET | /api/v1/rfp/{id}/status | SSE progress streaming | rfp_parsing_jobs read |
| GET | /api/v1/rfp/{id}/requirements | List extracted requirements | rfpRequirements read |
| POST | /api/v1/rfp/{id}/compliance-matrix | Generate compliance matrix | ComplianceMatrixGenerator |
| PATCH | /api/v1/rfp/{id}/compliance-matrix/{mid} | Update compliance entry | ComplianceMatrixGenerator |

### 3.2 Discovery Endpoints (FastAPI)

| Method | Path | Purpose | Python Module |
|--------|------|---------|---------------|
| POST | /api/v1/discovery/run/{source} | Trigger scraper | ScrapingOrchestrator |
| GET | /api/v1/discovery/opportunities | List opportunities | DocFusionSync |
| GET | /api/v1/discovery/opportunities/{id} | Opportunity detail | DocFusionSync |
| POST | /api/v1/discovery/opportunities/{id}/ingest | Convert to RFP | download + RFPAnalyzer |
| GET | /api/v1/discovery/sources | Available sources | GlobalSourceDB |
| GET | /api/v1/discovery/health | Pipeline health | HealthChecker |

## 4. Data Model

### 4.1 Requirements Consolidation

Merge `requirements` table into `rfpRequirements`. The RFP table is a strict superset.

**Column mapping**:

| requirements (old) | rfpRequirements (target) | Action |
|---------------------|--------------------------|--------|
| opportunityId | opportunityId | direct match |
| requirementId | requirementNumber | rename |
| text | requirementText | rename |
| source | sourceQuote | rename |
| sourcePageRef | sourcePage | rename (varchar → integer) |
| priority | priority | direct match |
| complianceStatus | complianceStatus | direct match |
| responseStrategy | responseStrategy | direct match |
| assignedTo | assignedTo | direct match |
| riskLevel | riskLevel | direct match |
| aiAnalysis | — | add jsonb column to rfpRequirements |
| — | rfpDocumentId | RFP-specific, nullable |

**Migration steps**:
1. Add `aiAnalysis` jsonb column to `rfpRequirements`
2. Copy `requirements` rows into `rfpRequirements` (column mapping)
3. Update server actions and components to reference `rfpRequirements`
4. Drop `requirements` table (deferred: only after all references migrated and verified in production)

### 4.2 Existing Schema (No Changes Needed)

These tables already support the full pipeline:
- `rfp_documents` — uploaded RFP files with parsing metadata
- `rfp_parsing_jobs` — async job tracking with progress
- `rfpRequirements` — extracted requirements with embeddings (pgvector)
- `compliance_matrices` + `compliance_entries` — compliance tracking
- `opportunities` — discovered opportunities
- `opportunity_documents` — downloaded documents linked to opportunities
- `saved_searches` — persistent discovery queries
- `content_suggestions` — AI-powered content recommendations

### 4.3 File Storage

Use existing `SecureStorageService` from `src/docfusion/storage/` (already has S3 support). Local filesystem fallback for development.

## 5. Implementation Plan

### Phase 1: RFP Ingestion (Steps 1-4)

**Step 1: File Storage Implementation**
- Modify: `frontend/app/api/v1/rfp/upload/route.ts` — proxy file upload to FastAPI
- Create: `src/docfusion/api/endpoints/rfp_endpoints.py` — upload endpoint using SecureStorageService
- Modify: `src/docfusion/api/dependencies.py` — register RFP endpoints in ServiceContainer
- Test: Upload PDF → verify file in storage → verify DB row

**Step 2: Parse Bridge**
- Add to `rfp_endpoints.py`: POST /api/v1/rfp/{id}/parse calling RequirementExtractor
- Add to `rfp_endpoints.py`: GET /api/v1/rfp/{id}/status SSE endpoint
- Modify: `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — replace simulateParsingJob with FastAPI call
- Wire: RequirementExtractor → DoclingService → rfp_documents update via asyncpg
- Test: Upload → parse → verify extracted text + sections in DB

**Step 3: Requirements Extraction**
- Add to `rfp_endpoints.py`: GET /api/v1/rfp/{id}/requirements endpoint
- Create: Drizzle migration adding `aiAnalysis` column to `rfpRequirements`
- Modify: `frontend/lib/actions/requirements.ts` — redirect to rfpRequirements
- Wire: Python extraction results → asyncpg write → Drizzle reads
- Test: Parse → verify requirements in DB → verify frontend display

**Step 4: Compliance Matrix**
- Add to `rfp_endpoints.py`: compliance matrix endpoints
- Wire: ComplianceMatrixGenerator → compliance_matrices + compliance_entries
- Modify: `frontend/lib/actions/rfp-parser.ts` — FastAPI bridge for matrix generation
- Test: Full pipeline: upload → parse → extract → compliance matrix with coverage scores

### Phase 2: Discovery (Steps 5-7)

**Step 5: Discovery API Bridge**
- Create: `src/docfusion/api/endpoints/discovery_endpoints.py`
- Wire: ScrapingOrchestrator → DocFusionSync → PostgreSQL
- Modify: `src/docfusion/api/dependencies.py` — register discovery endpoints
- Test: Trigger scrape → verify opportunities in DB

**Step 6: Frontend Pages**
- Create: `frontend/app/(app)/opportunities/page.tsx` — list using existing OpportunityTable/Grid
- Create: `frontend/app/(app)/opportunities/[id]/page.tsx` — detail using OpportunityDetailView
- Create: `frontend/app/(app)/discovery/page.tsx` — dashboard with source management
- Create: `frontend/app/(app)/pipeline/page.tsx` — board using PipelineBoard component
- Test: Navigate pages → verify components render with real data

**Step 7: Discovery → Ingestion Bridge**
- Add to `discovery_endpoints.py`: POST /opportunities/{id}/ingest
- Wire: opportunity_documents download → rfp_documents creation → trigger parse
- Modify: `frontend/components/opportunities/OpportunityHeaderActions.tsx` — add "Convert to RFP" button
- Test: Discover → convert → full RFP pipeline

## 6. Testing Strategy

Per CLAUDE.md: no mocks (except LLM calls), real objects, pytest fixtures.

- **Python**: FastAPI TestClient for endpoint tests, real PostgreSQL for integration tests
- **Frontend**: Server action tests against running FastAPI, Playwright for E2E
- **Tests location**: `tests/ci/` for CI auto-discovery
- **Coverage target**: 80% minimum (per pyproject.toml)

## 7. Security Considerations

- File uploads validated (type, size, extension) — existing validation in upload route
- SecureStorageService handles file system isolation
- Keycloak OIDC auth shared between Next.js and FastAPI
- CORS already configured in FastAPI via SecretsManager
- Rate limiting via existing middleware
- SSE connections timeout after 30 minutes
- asyncpg connections use SecretsManager for DB credentials

## 8. Files Summary

### Create (5 files)
1. `src/docfusion/api/endpoints/rfp_endpoints.py`
2. `src/docfusion/api/endpoints/discovery_endpoints.py`
3. `frontend/app/(app)/opportunities/page.tsx`
4. `frontend/app/(app)/opportunities/[id]/page.tsx`
5. `frontend/app/(app)/discovery/page.tsx`

### Modify (7 files)
1. `src/docfusion/api/dependencies.py` — register endpoints
2. `frontend/app/api/v1/rfp/upload/route.ts` — real storage
3. `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — real parser
4. `frontend/lib/actions/requirements.ts` — use rfpRequirements
5. `frontend/lib/actions/rfp-parser.ts` — FastAPI bridge
6. `frontend/components/opportunities/OpportunityHeaderActions.tsx` — ingest button
7. Drizzle migration for aiAnalysis column

### Existing Code Leveraged (no changes)
- `src/docfusion/rfp/rfp_analyzer.py` (612 lines)
- `src/docfusion/rfp/requirement_extractor.py` (1,087 lines)
- `src/docfusion/rfp/compliance_matrix.py` (1,080 lines)
- `backend/discovery/pipeline/` (transformer, categorizer, deduplicator, sync)
- `backend/discovery/scheduler/scraper_runner.py` (814 lines)
- `backend/discovery/scrapers/` (50+ scrapers)
- `frontend/components/opportunities/` (3,907 lines)
- `frontend/components/pipeline/` (5,967 lines)
- `frontend/lib/types/rfp.ts` (490 lines)
- `frontend/lib/types/opportunity.ts` (1,825 lines)