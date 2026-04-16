# DocuFusion: RFP Ingestion + Opportunity Discovery Pipeline

**Date**: 2026-04-16
**Status**: Draft v2 (updated with existing pipeline trace + AI enhancement scope)
**Scope**: Enhance Python RFP modules with LiteLLM AI, unify requirements tables, wire end-to-end pipelines

---

## 1. Problem Statement

DocuFusion has substantial real implementations for both RFP ingestion and opportunity discovery, but critical gaps remain:

### Architecture Gaps
- **Python RFP modules have no AI**: `RequirementExtractor` uses regex/keywords only (`ai_enhancement: False`), `RFPAnalyzer` is pure rule-based, `ComplianceMatrixGenerator` is in-memory with no DB connection
- **StakeholderMapper bypasses LiteLLM**: calls Ollama directly at `localhost:11434` instead of using the LiteLLM gateway
- **Docling URL hardcoded**: `http://20.84.71.33:3600` is hardcoded in `requirement_extractor.py` instead of being in SecretsManager
- **Simulated API route parser**: `rfp/[rfpId]/parse/route.ts` uses `simulateParsingJob` (fake 2s delays)
- **Metadata-only uploads**: File upload route doesn't persist actual files

### Data Model Gaps
- **Dual requirements tables**: `requirements` (schema.ts, 15 fields, used by opportunities UI) and `rfpRequirements` (schema-rfp.ts, 30+ fields, used by RFP pipeline) are disconnected
- **Discovery→Ingestion gap**: Downloaded opportunity documents can't flow into RFP pipeline without manual re-upload

### Missing Infrastructure
- **No FastAPI endpoints for RFP or discovery**: Python modules exist but aren't exposed via HTTP
- **No frontend pages for discovery**: Components exist but no page routes
- **Python compliance matrix is in-memory only**: Not connected to PostgreSQL tables

### Existing Working Paths (don't break)
- **Server action pipeline**: `rfp-parser.ts` → `processRfpParsingJob` reads real files, calls Azure OpenAI, stores to `rfpRequirements` — this WORKS
- **Requirements UI dialog**: `RequirementExtractor.tsx` → `extractRequirements` with AI + heuristic fallback — this WORKS
- **Document discovery agent**: 5-strategy AI document search — this WORKS

## 2. Architecture

### 2.1 Two-Tier Processing

The system has two processing tiers that must coexist:

| Tier | Location | AI Service | Storage | Status |
|------|----------|------------|---------|--------|
| Next.js | Server actions + API routes | Azure OpenAI (via ProviderManager) | Drizzle ORM | WORKING |
| Python | FastAPI (new) | LiteLLM gateway (gpt-4o/claude-sonnet) + DoclingService | asyncpg + Drizzle reads | TO BUILD |

**Rule**: Python FastAPI handles heavy/async processing (large document parsing, batch extraction, scraping). Next.js server actions remain for quick CRUD and the existing working paths. Both write to the same PostgreSQL tables.

### 2.2 Data Flow

**RFP Ingestion (Python-enhanced)**:

```
Upload (Next.js) → SecureStorageService
  → FastAPI POST /api/v1/rfp/{id}/parse
  → DoclingService (document parsing)
  → RequirementExtractor (regex patterns + LiteLLM AI enhancement)
  → RFPAnalyzer (cross-refs, compliance, risk + LiteLLM recommendations)
  → PostgreSQL (rfpRequirements via asyncpg)
  → SSE progress streaming
  → ComplianceMatrixGenerator → compliance_matrices + compliance_entries (DB, not in-memory)
  → Drizzle reads for UI
```

**Existing Next.js path (unchanged)**:

```
uploadRfpDocument → processRfpParsingJob (fire-and-forget)
  → pdf-parse/mammoth → Azure OpenAI → rfpRequirements
  → (continues to work as-is)
```

### 2.3 AI Service Architecture

```
Python RFP modules
  → LiteLLMClient (src/docfusion/infrastructure/)
  → LLMFallbackChain (circuit breakers)
  → LiteLLM gateway (http://84.247.181.100:4000)
  → Models: gpt-4o (primary), gpt-4o-mini (fast), claude-sonnet (fallback)
  → Embeddings: text-embedding-ada-002
  → SecretsManager: get_litellm_url(), get_litellm_key(), get_litellm_timeout()
```

### 2.4 Discovery Module Boundaries

- `backend/discovery/` = **operational engine**: scrapers, scheduling, pipeline. Called by FastAPI.
- `src/docfusion/discovery/` = **AI enhancement**: universal scraping, vision, patterns. Called for AI features only.

## 3. API Design

### 3.1 RFP Endpoints (FastAPI — new)

| Method | Path | Purpose | Calls |
|--------|------|---------|-------|
| POST | /api/v1/rfp/upload | File upload → storage | SecureStorageService |
| POST | /api/v1/rfp/{id}/parse | Trigger parsing | DoclingService → RequirementExtractor (AI-enhanced) |
| GET | /api/v1/rfp/{id}/status | SSE progress | rfp_parsing_jobs read |
| GET | /api/v1/rfp/{id}/requirements | List requirements | rfpRequirements read |
| POST | /api/v1/rfp/{id}/compliance-matrix | Generate matrix | ComplianceMatrixGenerator → DB |
| PATCH | /api/v1/rfp/{id}/compliance-matrix/{mid} | Update entry | compliance_entries write |

### 3.2 Discovery Endpoints (FastAPI — new)

| Method | Path | Purpose | Calls |
|--------|------|---------|-------|
| POST | /api/v1/discovery/run/{source} | Trigger scraper | ScrapingOrchestrator |
| GET | /api/v1/discovery/opportunities | List opportunities | DocFusionSync |
| GET | /api/v1/discovery/opportunities/{id} | Detail | DocFusionSync |
| POST | /api/v1/discovery/opportunities/{id}/ingest | Convert to RFP | download → RFP pipeline |
| GET | /api/v1/discovery/sources | Available sources | GlobalSourceDB |
| GET | /api/v1/discovery/health | Pipeline health | HealthChecker |

## 4. Data Model

### 4.1 Requirements Table Unification

Merge `requirements` (base schema) into `rfpRequirements` (RFP schema). Target: single source of truth.

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
3. Update all server actions and components to reference `rfpRequirements`
4. Drop `requirements` table (deferred: after production verification)

### 4.2 File Storage

Use `SecureStorageService` (already has S3 support). Local filesystem fallback for dev.

### 4.3 Centralize Docling Config

Add to `SecretsManager`:
- `get_docling_url()` → `http://20.84.71.33:3600` (from env with default)
- `get_docling_timeout()` → 120 (from env with default)

## 5. Python AI Enhancement

### 5.1 RequirementExtractor: Enable AI Enhancement

Current state: `ai_enhancement: False`, no `_extract_with_ai()` method.

**Implementation**:
- Add `_extract_with_ai(text: str, sections: list)` method using `LiteLLMClient.chat_completion()`
- AI enhances regex results by: classifying ambiguous requirements, improving confidence scores, detecting implicit requirements, identifying cross-references that pattern matching misses
- Use `LLMFallbackChain` for resilient AI calls (Azure → Anthropic → Ollama)
- Set `ai_enhancement: True` by default when LiteLLM is reachable
- Regex extraction runs first (fast, deterministic), then AI refines results (slower, higher quality)

### 5.2 RFPAnalyzer: Add AI-Powered Analysis

Current state: Pure rule-based (keyword matching for compliance, risk, cross-refs).

**Implementation**:
- Add `_analyze_with_ai(requirements, text)` method using `LiteLLMClient.analyze_document()`
- AI generates: nuanced compliance assessment, risk narratives, strategic recommendations
- Rule-based analysis runs first, AI enriches with context-aware insights
- LiteLLM model: `gpt-4o-mini` for speed, `gpt-4o` for complex documents

### 5.3 ComplianceMatrixGenerator: Connect to Database

Current state: In-memory dict only, not connected to PostgreSQL.

**Implementation**:
- Add async DB persistence: `save_to_db()` writes to `compliance_matrices` + `compliance_entries`
- Add `load_from_db(matrix_id)` to read existing matrices
- Keep in-memory generation for speed, persist after generation
- Wire through FastAPI endpoints

### 5.4 StakeholderMapper: Route Through LiteLLM

Current state: Calls Ollama directly at `localhost:11434` with `llama3.2:3b`.

**Implementation**:
- Replace `httpx.AsyncClient(base_url="http://localhost:11434")` with `LiteLLMClient`
- Change from Ollama-native `/api/generate` to OpenAI-compatible `/v1/chat/completions` format
- Benefits: automatic failover, Redis caching, cost tracking, no local Ollama dependency

## 6. Implementation Plan

### Phase 1: Python AI Enhancement (Steps 1-3)

**Step 1: Infrastructure Wiring**
- Modify: `src/docfusion/config/secrets.py` — add `get_docling_url()`, `get_docling_timeout()`
- Modify: `src/docfusion/rfp/requirement_extractor.py` — replace hardcoded Docling URL with SecretsManager
- Modify: `src/docfusion/rfp/requirement_extractor.py` — add LiteLLMClient import, implement `_extract_with_ai()`
- Test: Requirement extraction with AI enhancement on a real PDF

**Step 2: RFPAnalyzer + ComplianceMatrix Enhancement**
- Modify: `src/docfusion/rfp/rfp_analyzer.py` — add `_analyze_with_ai()` using LiteLLMClient
- Modify: `src/docfusion/rfp/compliance_matrix.py` — add async DB persistence (save_to_db, load_from_db)
- Modify: `src/docfusion/rfp/stakeholder_mapper.py` — route through LiteLLM instead of direct Ollama
- Test: Full Python analysis pipeline with AI on a real RFP document

**Step 3: Requirements Table Unification**
- Create: Drizzle migration adding `aiAnalysis` jsonb column to `rfpRequirements`
- Modify: `frontend/lib/actions/requirements.ts` — redirect all reads/writes to `rfpRequirements`
- Modify: `frontend/app/(app)/opportunities/[id]/requirements/page.tsx` — use rfpRequirements
- Modify: `frontend/app/(app)/opportunities/[id]/requirements/RequirementExtractor.tsx` — save to rfpRequirements
- Test: Existing UI still works, new requirements go to unified table

### Phase 2: FastAPI Bridge (Steps 4-5)

**Step 4: RFP Endpoints**
- Create: `src/docfusion/api/endpoints/rfp_endpoints.py` — all 6 RFP endpoints
- Modify: `src/docfusion/api/dependencies.py` — register RFP endpoints
- Modify: `frontend/app/api/v1/rfp/upload/route.ts` — proxy upload to FastAPI SecureStorageService
- Modify: `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — replace simulateParsingJob with FastAPI call (server action path in `rfp-parser.ts` remains as fallback)
- Test: Upload → FastAPI parse → SSE progress → requirements in DB → frontend display

**Step 5: Discovery Endpoints**
- Create: `src/docfusion/api/endpoints/discovery_endpoints.py`
- Modify: `src/docfusion/api/dependencies.py` — register discovery endpoints
- Wire: ScrapingOrchestrator → DocFusionSync → PostgreSQL
- Test: Trigger scrape → opportunities in DB

### Phase 3: Frontend + Integration (Steps 6-7)

**Step 6: Frontend Pages**
- Create: `frontend/app/(app)/opportunities/page.tsx`
- Create: `frontend/app/(app)/opportunities/[id]/page.tsx`
- Create: `frontend/app/(app)/discovery/page.tsx`
- Create: `frontend/app/(app)/pipeline/page.tsx`
- Test: Pages render with real data

**Step 7: Discovery → Ingestion Bridge**
- Add to `discovery_endpoints.py`: POST /opportunities/{id}/ingest
- Wire: opportunity_documents → rfp_documents → trigger parse pipeline
- Modify: `frontend/components/opportunities/OpportunityHeaderActions.tsx` — add "Convert to RFP" button
- Test: End-to-end: discover → convert → parse → extract → compliance matrix

## 7. Testing Strategy

Per CLAUDE.md: no mocks (except LLM calls), real objects, pytest fixtures.

- **Python AI enhancement**: Test with real LiteLLM gateway (gpt-4o-mini for speed), mock only for offline CI
- **Python DB persistence**: Real PostgreSQL with asyncpg
- **FastAPI endpoints**: TestClient for unit tests, real DB for integration
- **Frontend**: Server actions against running FastAPI, Playwright E2E
- **Tests location**: `tests/ci/` for CI auto-discovery
- **Coverage target**: 80% minimum

## 8. Security

- File uploads validated (type, size, extension) — existing
- SecureStorageService for file system isolation
- Keycloak OIDC auth shared between Next.js and FastAPI
- LiteLLM master key managed via SecretsManager
- CORS via SecretsManager
- Rate limiting via existing middleware
- Docling URL centralized (no more hardcoded IPs)

## 9. Files Summary

### Create (7 files)
1. `src/docfusion/api/endpoints/rfp_endpoints.py`
2. `src/docfusion/api/endpoints/discovery_endpoints.py`
3. `frontend/app/(app)/opportunities/page.tsx`
4. `frontend/app/(app)/opportunities/[id]/page.tsx`
5. `frontend/app/(app)/discovery/page.tsx`
6. `frontend/app/(app)/pipeline/page.tsx`
7. Drizzle migration for aiAnalysis column + requirements table merge

### Modify (9 files)
1. `src/docfusion/config/secrets.py` — add get_docling_url(), get_docling_timeout()
2. `src/docfusion/rfp/requirement_extractor.py` — AI enhancement via LiteLLM, centralized Docling config
3. `src/docfusion/rfp/rfp_analyzer.py` — add AI-powered analysis
4. `src/docfusion/rfp/compliance_matrix.py` — add DB persistence
5. `src/docfusion/rfp/stakeholder_mapper.py` — route through LiteLLM
6. `src/docfusion/api/dependencies.py` — register endpoints
7. `frontend/lib/actions/requirements.ts` — use rfpRequirements
8. `frontend/app/api/v1/rfp/upload/route.ts` — proxy to FastAPI
9. `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — call FastAPI instead of simulate

### Existing Code Leveraged (no changes)
- `src/docfusion/infrastructure/litellm_client.py` — LiteLLMClient with chat/stream/embeddings
- `src/docfusion/infrastructure/llm_fallback.py` — LLMFallbackChain with circuit breakers
- `backend/discovery/` — scrapers, pipeline, scheduler, sync
- `frontend/components/opportunities/` (3,907 lines)
- `frontend/components/pipeline/` (5,967 lines)
- `frontend/lib/actions/rfp-parser.ts` — existing working pipeline (kept as fallback)