# DocFusion Technical Debt Remediation Plan

**Date**: 2026-03-20
**Reference**: [findings.md](./findings.md)
**Principle**: Don't add new tools — use the existing ones consistently.

---

## Plan Structure

Work is organized into **6 phases** over 6 sprints. Each phase targets a coherent theme. Within each phase, tasks are ordered by dependency (earlier tasks unblock later ones). Each task includes:

- **Ref**: Finding ID from `findings.md`
- **Effort**: T-shirt size (S: <4h, M: 4-16h, L: 16-40h, XL: 40+h)
- **Files**: Primary files affected
- **Verification**: How to confirm the fix is correct

---

## Phase 1: Security Hardening (Sprint 1)

**Goal**: Eliminate all CRITICAL and HIGH security vulnerabilities before any other work.

### Task 1.1 — Replace unsafe code evaluation with safe expression parser

- **Ref**: S1
- **Effort**: S (2-4h)
- **Files**: `src/docfusion/composition/runner.py`
- **Plan**:
  1. Add `simpleeval` to project dependencies: `uv add simpleeval`
  2. Replace the unsafe evaluation call at line 589-593 with `simpleeval.simple_eval(condition, names={"context": context.variables})`
  3. Add explicit exception handling for `simpleeval.InvalidExpression`, `NameNotDefined`, `FunctionNotDefined`
  4. Add unit test: `tests/ci/test_composition_safe_eval.py` verifying:
     - Valid conditions evaluate correctly
     - Malicious conditions (file access, imports, subprocess) raise errors
     - Missing variables return False gracefully
- **Verification**: `uv run pytest tests/ci/test_composition_safe_eval.py -vxs`

### Task 1.2 — Fix CORS configuration across all services

- **Ref**: S2
- **Effort**: S (2-4h)
- **Files**: `backend/stealth-scraper/server.py`, `src/docfusion/api/main.py`, `src/docfusion/api/app.py`, `src/docfusion/api/middleware/cors_middleware.py`
- **Plan**:
  1. Create a shared `ALLOWED_ORIGINS` constant loaded from environment variable `CORS_ALLOWED_ORIGINS` (comma-separated)
  2. Default to `["http://localhost:3000"]` in development
  3. Replace all wildcard origin configurations with the environment-loaded list
  4. Add validation: if credentials are allowed, assert wildcard is not in origins
  5. Add integration test verifying CORS headers are correct
- **Verification**: `curl -v -H "Origin: http://evil.com" http://localhost:8000/api/health` should NOT return a matching Access-Control-Allow-Origin header

### Task 1.3 — Load JWT secret from environment variable

- **Ref**: S3
- **Effort**: S (1-2h)
- **Files**: `src/docfusion/api/middleware/authentication_middleware.py`
- **Plan**:
  1. Replace runtime secret generation with `os.environ.get("JWT_SECRET")`
  2. Add startup validation: if `JWT_SECRET` not set, raise `RuntimeError("JWT_SECRET environment variable required")`
  3. Add `JWT_SECRET` to all `.env.example` files with a generated placeholder
  4. Update deployment scripts to include `JWT_SECRET` in environment
- **Verification**: Application refuses to start without `JWT_SECRET` set.

### Task 1.4 — Sanitize all unsafe innerHTML usage

- **Ref**: S4
- **Effort**: M (4-8h)
- **Files**: 9 component files (see S4 in findings.md)
- **Plan**:
  1. Add `dompurify` and `@types/dompurify` to frontend dependencies
  2. Create utility: `frontend/lib/utils/sanitize.ts` with a `sanitizeHTML()` function using DOMPurify with HTML profile
  3. Wrap every unsafe innerHTML usage with the sanitize utility
  4. Add ESLint rule or grep-based CI check to flag unsanitized innerHTML usage
- **Verification**: `grep -r "dangerouslySetInnerHTML" frontend/components/ | grep -v "sanitizeHTML"` returns 0 results

### Task 1.5 — Move CI secrets to GitHub Secrets

- **Ref**: S5
- **Effort**: S (30min)
- **Files**: `.github/workflows/airflow-dag-check.yml`
- **Plan**:
  1. Add `AIRFLOW_SECRET_KEY` and `AIRFLOW_FERNET_KEY` to GitHub repository secrets
  2. Replace hardcoded values with `${{ secrets.AIRFLOW_SECRET_KEY }}`
- **Verification**: Workflow passes with secrets from GitHub, no hardcoded values in YAML

### Task 1.6 — Guard database handle exposure

- **Ref**: S7
- **Effort**: S (30min)
- **Files**: `frontend/lib/hdsi/db.ts`
- **Plan**:
  1. Wrap the window assignment with `if (process.env.NODE_ENV === "development")`
- **Verification**: Database handle is `undefined` on window object in production build

### Task 1.7 — Remove config logging in production

- **Ref**: S8
- **Effort**: S (1h)
- **Files**: `frontend/lib/ai/config.ts`
- **Plan**:
  1. Guard all 7 `console.log` calls with `if (process.env.NODE_ENV === "development")`
  2. Or replace with the debug-logger utility that already exists
- **Verification**: Production build produces no AI config console output

### Task 1.8 — Parameterize SQL schema names

- **Ref**: S6
- **Effort**: M (4-8h)
- **Files**: `src/docfusion/storage/rag/database.py`, `discovery/crawlers/source_databases/global_source_db.py`
- **Plan**:
  1. Create an allowlist of valid schema names
  2. Validate `self.config.schema_name` against allowlist before query construction
  3. Use `psycopg2.sql.Identifier()` for schema name in queries instead of f-strings
- **Verification**: Attempting to set schema_name to a SQL injection payload raises ValueError

---

## Phase 2: Error Handling & Type Safety (Sprint 2)

**Goal**: Make failures visible. Replace silent swallowing with specific exception handling.

### Task 2.1 — Replace all bare `except:` blocks with specific exceptions

- **Ref**: Q10
- **Effort**: L (16-24h)
- **Files**: 33 Python files with 65+ bare except blocks
- **Plan**:
  1. Start with highest-impact files:
     - `opportunity_analyzer.py` (16 instances) — replace with `except (ValueError, TypeError, KeyError) as e: logger.warning(...)`
     - `agents/core/agent.py` (4 instances) — replace with `except ImportError as e: logger.info(f"Optional module not available: {e}")`
     - `agents/execution/service_coordinator.py` (3 instances)
     - `agents/tools/publishing_tools.py` (3 instances)
  2. For import fallbacks: replace bare except with `except ImportError`
  3. For data processing: replace with `except (ValueError, TypeError, AttributeError) as e:` and add logging
  4. For I/O operations: replace with `except (IOError, ConnectionError) as e:`
  5. Never silently return None — log the error at minimum
- **Verification**: `grep -rn "except:" src/docfusion/ --include="*.py" | grep -v "except Exception" | grep -v "except ImportError" | grep -v "except ("` returns 0 results

### Task 2.2 — Refactor fallback import anti-pattern

- **Ref**: Q11
- **Effort**: M (8-16h)
- **Files**: `src/docfusion/agents/core/agent.py`, any file using the pattern
- **Plan**:
  1. Create `src/docfusion/agents/utils/optional_imports.py` with a `try_import()` helper that catches `ImportError` specifically and logs it
  2. Replace inline fallback classes with explicit None checks at usage sites
  3. Add runtime assertions at function start when a dependency IS required
- **Verification**: No inline class definitions after bare except blocks remain

### Task 2.3 — Reduce TypeScript `any` usage from 196 to <30

- **Ref**: T3
- **Effort**: L (16-24h)
- **Files**: 64 TypeScript files
- **Plan**:
  1. **Tier 1 — Easy fixes (est. 100 removals)**:
     - `seed-templates-professional.ts` (29): Define `TemplateData` interface
     - `hdsi/types.ts` (9): Replace `Promise<any>` with typed return
     - `hdsi/hooks.ts` (2): Type the `compareVersions` return
  2. **Tier 2 — External library bridges (est. 50 removals)**:
     - `speech-to-text.ts` (10): Add `@types/dom-speech-recognition` or local .d.ts
     - `pptx-export.ts` (17): Type PptxGenJS dynamic import with proper interfaces
  3. **Tier 3 — Data parsing (est. 20 removals)**:
     - `scrapers/parsers/llm-extractor.ts` (6): Define LLM response shape
     - `actions/scraper-sources.ts` (5): Type scraper config
  4. Leave `any` only where truly unavoidable (untyped third-party libs)
- **Verification**: `grep -rn ": any\|as any\|<any>" frontend/lib --include="*.ts" --include="*.tsx" | wc -l` returns <30

### Task 2.4 — Replace `console.*` with structured logger (697 instances)

- **Ref**: Q12
- **Effort**: L (16-24h)
- **Files**: 66 frontend TypeScript files
- **Plan**:
  1. Create `frontend/lib/utils/logger.ts` with log level filtering (debug/info/warn/error) that suppresses debug/info in production
  2. Batch replace across files: `console.error` to `logger.error`, `console.warn` to `logger.warn`, `console.log` to `logger.debug`
  3. Remove `console.log` calls that leak config/env details entirely
- **Verification**: `grep -rn "console\.\(log\|warn\|error\|debug\)" frontend/lib --include="*.ts" | wc -l` returns 0

### Task 2.5 — Replace deprecated `datetime.utcnow()` (30+ calls)

- **Ref**: Q15
- **Effort**: S (2h)
- **Files**: All Python in `backend/`
- **Plan**:
  1. Find-and-replace: `datetime.utcnow()` to `datetime.now(timezone.utc)`
  2. Add import `from datetime import timezone` where missing
  3. Enable Ruff rule `DTZ005` (remove from ignore list in pyproject.toml)
- **Verification**: `grep -rn "utcnow()" backend/ --include="*.py" | wc -l` returns 0

---

## Phase 3: Testing Infrastructure (Sprint 3)

**Goal**: Raise frontend test coverage from 0.66% to meaningful levels. Focus on highest-risk untested code.

### Task 3.1 — Create shared test utilities for server actions

- **Effort**: M (8h)
- **Files**: `frontend/__tests__/utils/`
- **Plan**:
  1. Create `frontend/__tests__/utils/db-mock.ts` — mock Drizzle `db` object
  2. Create `frontend/__tests__/utils/action-helpers.ts` — helpers for testing server actions
  3. Create `frontend/__tests__/utils/fixtures.ts` — factory functions for test data (Opportunity, Document, Template, etc.)
  4. Update `vitest.config.ts` with path aliases and coverage configuration
- **Verification**: Utility files importable from test files

### Task 3.2 — Add tests for opportunity actions (highest risk)

- **Ref**: T1
- **Effort**: L (16-24h)
- **Files**: `frontend/__tests__/actions/opportunities.test.ts`
- **Plan**:
  1. Test `getOpportunities` with various filter combinations
  2. Test `getOpportunityStats` returns correct aggregate counts
  3. Test `searchOpportunities` handles search terms correctly
  4. Test `createOpportunity` / `updateOpportunity` validate inputs
  5. Test `savedSearchesStore` behavior (document the in-memory limitation)
  6. Test edge cases: empty filters, invalid dates, injection attempts in search
- **Verification**: `npx vitest run --reporter=verbose frontend/__tests__/actions/opportunities.test.ts`

### Task 3.3 — Add tests for pricing actions (financial data risk)

- **Ref**: T1
- **Effort**: L (16-24h)
- **Files**: `frontend/__tests__/actions/pricing.test.ts`
- **Plan**: Test all CRUD operations, calculations, rounding behavior, currency handling
- **Verification**: `npx vitest run frontend/__tests__/actions/pricing.test.ts`

### Task 3.4 — Add tests for import pipeline

- **Ref**: T1, Q4
- **Effort**: M (8-16h)
- **Files**: `frontend/__tests__/actions/import-opportunities.test.ts`
- **Plan**: Test both `importFromFile` and `importFromBuffer`, verify deduplication, validation, error cases
- **Verification**: `npx vitest run frontend/__tests__/actions/import-opportunities.test.ts`

### Task 3.5 — Add tests for evidence, competitive, and review actions

- **Ref**: T1
- **Effort**: L (24-40h)
- **Files**: `frontend/__tests__/actions/evidence.test.ts`, `competitive.test.ts`, `reviews.test.ts`
- **Plan**: Test CRUD for each domain, verify data integrity constraints
- **Verification**: All test files pass

### Task 3.6 — Add Python tests for untested critical modules

- **Ref**: T2
- **Effort**: XL (40+h)
- **Files**: `tests/ci/test_notifications.py`, `tests/ci/test_agent_orchestration.py`, `tests/ci/test_composition_pipeline.py`
- **Plan**:
  1. Notification channels: test message formatting, delivery failures, retry logic
  2. Agent orchestration: test task assignment, crew coordination, failure recovery
  3. Composition pipeline: test parsing, interpretation, running with various inputs
- **Verification**: `uv run pytest tests/ci/ -vxs --tb=short`

### Task 3.7 — Add frontend tests to CI pipeline

- **Ref**: CI findings
- **Effort**: S (2h)
- **Files**: `.github/workflows/ci.yml`
- **Plan**:
  1. Add job: `frontend-tests` that runs `cd frontend && npm ci && npm test`
  2. Make `build-package` job depend on `frontend-tests`
  3. Add coverage threshold (start at 10%, increase incrementally)
- **Verification**: CI pipeline runs frontend tests on PR

---

## Phase 4: Code Quality & Deduplication (Sprint 4)

**Goal**: Eliminate duplication, extract shared logic, enforce complexity limits.

### Task 4.1 — Extract shared opportunity filter builder

- **Ref**: Q3
- **Effort**: M (8-16h)
- **Files**: `frontend/lib/actions/opportunities.ts`
- **Plan**:
  1. Create `frontend/lib/actions/opportunity-filters.ts` with a `buildOpportunityConditions(filters)` function that returns SQL conditions array
  2. Refactor all 4 functions to use `buildOpportunityConditions()`
  3. Reduces ~400 lines of duplication to ~100 lines shared
- **Verification**: All existing tests pass. Each function produces identical query results as before.

### Task 4.2 — Extract shared import pipeline

- **Ref**: Q4
- **Effort**: M (4-8h)
- **Files**: `frontend/lib/actions/import-opportunities.ts`
- **Plan**:
  1. Extract `async function executeImport(sheets, filename, config): Promise<ImportResult>`
  2. Both `importFromFile` and `importFromBuffer` call `executeImport` after parsing their inputs
- **Verification**: Import tests from Task 3.4 still pass

### Task 4.3 — Consolidate category detection to single source of truth

- **Ref**: Q5
- **Effort**: M (4-8h)
- **Files**: `backend/discovery/pipeline/categorizer.py`, `backend/discovery/scrapers/base.py`, `data/Opportunities/TenderSourceMax/update_africa_rfps.py`
- **Plan**:
  1. Keep `categorizer.py` as canonical implementation (it uses regex, more robust)
  2. In `base.py`: import and delegate to `OpportunityCategorizer`
  3. Remove duplicate in `update_africa_rfps.py`
- **Verification**: Scraper tests pass with consolidated categorizer

### Task 4.4 — Extract magic numbers to named constants

- **Ref**: Q6
- **Effort**: M (8-16h)
- **Files**: Multiple Python and TypeScript files
- **Plan**:
  1. Create `backend/discovery/constants.py` for scoring thresholds and weights
  2. Create `frontend/lib/render/pptx-constants.ts` for slide layout values
  3. Create `frontend/lib/ai/constants.ts` for AI thresholds
  4. Replace raw numbers with named constants throughout
- **Verification**: Grep for common magic numbers returns only the constants files

### Task 4.5 — Persist saved searches to database

- **Ref**: Q7
- **Effort**: M (4-8h)
- **Files**: `frontend/lib/actions/opportunities.ts`, `frontend/lib/db/schema.ts`
- **Plan**:
  1. Add `saved_searches` table to schema (userId, name, filters JSON, createdAt)
  2. Replace in-memory `Map` with database CRUD
  3. Add migration: `frontend/drizzle/0012_saved_searches.sql`
- **Verification**: Saved searches persist across server restarts

### Task 4.6 — Re-enable disabled Ruff complexity rules

- **Ref**: Q2
- **Effort**: S (2h) for enabling; L (ongoing) for fixing violations
- **Files**: `pyproject.toml`
- **Plan**:
  1. Remove `C901`, `PLR0912`, `PLR0913`, `PLR0915` from ignore list
  2. Run `uv run ruff check src/` to see current violations
  3. Set initial thresholds: `max-complexity = 15` (default is 10, relax initially)
  4. Add per-file ignores for files that will be refactored in Phase 5
  5. Gradually lower thresholds as files are split
- **Verification**: `uv run ruff check src/` passes with new thresholds

### Task 4.7 — Fix 26-parameter SQL INSERT

- **Ref**: Q9
- **Effort**: M (4-8h)
- **Files**: `backend/discovery/pipeline/docfusion_sync.py`
- **Plan**:
  1. Replace positional parameters with named parameter dict approach where column names and values are paired explicitly
  2. This makes field ordering self-documenting and prevents silent corruption
- **Verification**: Sync tests pass with new parameter format

### Task 4.8 — Add content truncation warning

- **Ref**: Q8
- **Effort**: S (1h)
- **Files**: `backend/stealth-scraper/server.py`
- **Plan**:
  1. Add logging when truncation occurs with original vs truncated length
  2. Include truncation flag in response metadata
  3. Extract the hardcoded limit to a named constant `MAX_CONTENT_LENGTH`
- **Verification**: Truncated pages produce log warning

### Task 4.9 — Remove duplicate Zustand store methods

- **Ref**: Q13
- **Effort**: S (2h)
- **Files**: `frontend/lib/stores/import-store.ts`
- **Plan**:
  1. Remove `previousStep` (keep `prevStep`)
  2. Remove `setIsLoading` (keep `setLoading`)
  3. Remove `setImportResult` (keep `setResult`)
  4. Update all call sites
- **Verification**: Grep for removed method names returns 0 results

### Task 4.10 — Fix Pydantic v1 to v2

- **Ref**: Q14
- **Effort**: S (1h)
- **Files**: `backend/stealth-scraper/server.py`
- **Plan**: Replace `class Config:` with `model_config = ConfigDict(...)` on all Pydantic models
- **Verification**: Stealth scraper starts without deprecation warnings

### Task 4.11 — Fix O(n²) algorithm in unflattenNodes

- **Ref**: Q16
- **Effort**: S (2h)
- **Files**: `frontend/lib/hdsi/db.ts`
- **Plan**:
  1. Build a `hasParent = new Set<string>()` in a single pass during the linking phase
  2. For each node, add all its children IDs to `hasParent`
  3. Replace the nested `.some()` check with `if (!hasParent.has(node.id))` to find roots
  4. Reduces from O(n²) to O(n)
- **Verification**: Profile with a 200-section document. `unflattenNodes` completes in <5ms.

### Task 4.12 — Split largest files (>2000 lines)

- **Ref**: Q1
- **Effort**: XL (40+h, incremental across multiple sprints)
- **Files**: `document_formatter.py` (3099), `publishing_tools.py` (2963), `block_manager.py` (2203), `content_generator.py` (2129), `pricing.ts` (4092), `opportunities/page.tsx` (1773)
- **Plan**:
  1. **`document_formatter.py`**: Split into `text_formatter.py`, `table_formatter.py`, `list_formatter.py`, `heading_formatter.py`. Keep `document_formatter.py` as orchestrator.
  2. **`publishing_tools.py`**: Split by tool category — `export_tools.py`, `render_tools.py`, `template_tools.py`
  3. **`pricing.ts`**: Split into `pricing-queries.ts` (read), `pricing-mutations.ts` (write), `pricing-calculations.ts` (compute)
  4. **`opportunities/page.tsx`**: Extract `OpportunityFilters`, `OpportunityTable`, `BulkActions`, `VotingSummary` into separate components
  5. Apply to remaining files iteratively, targeting <500 lines per file
- **Verification**: No file in the active codebase exceeds 1500 lines. All tests pass after each split.

### Task 4.13 — Remove redundant database driver

- **Ref**: A11
- **Effort**: S (1h)
- **Files**: `pyproject.toml`
- **Plan**:
  1. Determine which driver is actually used (`asyncpg` for async, `psycopg2-binary` for sync)
  2. If only async is used, remove `psycopg2-binary`
  3. If both are needed (migration scripts vs runtime), document why in pyproject.toml comment
- **Verification**: `uv run pytest tests/ci/ -vxs` passes. Application starts correctly.

---

## Phase 5: Architecture Improvements (Sprint 5)

**Goal**: Reduce coupling, establish clean boundaries, consolidate schemas.

### Task 5.1 — Consolidate schema files from 25 to 5 domains

- **Ref**: A1
- **Effort**: L (24-40h)
- **Files**: All 25 `frontend/lib/db/schema-*.ts` files
- **Plan**:
  1. Consolidate into 5 domain schemas:
     - `schema-core.ts` — opportunities, documents, templates, users
     - `schema-crm.ts` — accounts, contacts, deals, activities (keep as-is)
     - `schema-workflow.ts` — pipeline, reviews, approvals, comments, tasks
     - `schema-intelligence.ts` — pricing, pwin, competitive, evidence, win-themes
     - `schema-integration.ts` — scrapers, imports, partners
  2. Re-export all from `schema.ts` (backward compatible)
  3. Align TypeScript types in `types/` with schema shapes
  4. Run all migrations to verify schema integrity
- **Verification**: `npm run db:push` succeeds. All existing queries work unchanged.

### Task 5.2 — Introduce repository pattern for top 5 action files

- **Ref**: A2
- **Effort**: L (24-40h)
- **Files**: New `frontend/lib/repositories/` directory
- **Plan**:
  1. Start with the 5 most-used action domains:
     - `repositories/opportunity-repository.ts`
     - `repositories/pricing-repository.ts`
     - `repositories/evidence-repository.ts`
     - `repositories/competitive-repository.ts`
     - `repositories/template-repository.ts`
  2. Each repository encapsulates Drizzle queries for its domain
  3. Action files call repository methods instead of constructing queries
  4. Repository methods are independently testable with mock DB
  5. Remaining 30 action files converted incrementally in future sprints
- **Verification**: Action files no longer import `db` directly. Tests pass with mock repositories.

### Task 5.3 — Resolve circular Python imports

- **Ref**: A3
- **Effort**: M (8-16h)
- **Files**: `src/docfusion/intelligence/`, `src/docfusion/discovery/`
- **Plan**:
  1. Extract shared types to `src/docfusion/core/types/` (used by both intelligence and discovery)
  2. Move `OpportunityData` and other shared models to `core/types/opportunity.py`
  3. Both `intelligence/` and `discovery/` import from `core/types/`
  4. Re-enable commented-out imports in `intelligence/__init__.py`
- **Verification**: `python -c "from docfusion.intelligence import *; from docfusion.discovery import *"` succeeds without ImportError

### Task 5.4 — Standardize Tiptap to single major version

- **Ref**: A4
- **Effort**: M (4-8h)
- **Files**: `frontend/package.json`
- **Plan**:
  1. Check Tiptap v3 migration guide for breaking changes
  2. If v3 is stable: upgrade all v2 packages to v3
  3. If v3 is unstable: pin v3 packages to their v2 equivalents
  4. Run editor integration tests to verify collaboration still works
- **Verification**: All Tiptap extensions on same major version. Editor loads and saves correctly.

### Task 5.5 — Split HDSI module into focused submodules

- **Ref**: A5
- **Effort**: L (16-24h)
- **Files**: `frontend/lib/hdsi/`
- **Plan**:
  1. Split into:
     - `hdsi/core/` — types, DB, hooks (foundation)
     - `hdsi/ai/` — AI generation, domain models, predictive
     - `hdsi/collaboration/` — real-time, presence, streaming
     - `hdsi/content/` — content parsing, organization, bidirectional links
  2. Keep `hdsi/index.ts` re-exporting everything (backward compatible)
  3. Gradually update import paths in consuming code
- **Verification**: All existing imports work. No circular dependency errors.

### Task 5.6 — Merge overlapping Zustand stores

- **Ref**: A6
- **Effort**: M (8-16h)
- **Files**: 5 store files
- **Plan**:
  1. Merge `editor-store.ts` and `collaboration-store.ts` into `document-store.ts`
  2. Keep `ai-store.ts` separate (different lifecycle)
  3. Keep `import-store.ts` separate (wizard-specific state)
  4. Remove `comment-store.ts` (merge into document-store)
  5. Define clear state boundaries in code comments
- **Verification**: All editor, collaboration, and comment features work unchanged.

### Task 5.7 — Decouple Document Engine from concrete implementations

- **Ref**: A7
- **Effort**: L (16-24h)
- **Files**: `src/docfusion/document_engine/document_engine.py`
- **Plan**:
  1. Define abstract interfaces: `RendererProtocol`, `FormatterProtocol`, `AssemblerProtocol` using Python `Protocol` classes
  2. Inject dependencies via constructor instead of hardcoded imports:
     ```python
     class DocumentEngine:
         def __init__(self, renderer: RendererProtocol, formatter: FormatterProtocol, assembler: AssemblerProtocol): ...
     ```
  3. Create a factory function `create_default_engine()` that wires up the current concrete implementations
  4. Existing code calls the factory; tests can inject mocks
- **Verification**: `DocumentEngine` can be instantiated with mock renderer/formatter. All existing tests pass via factory.

### Task 5.8 — Create LLM provider abstraction layer

- **Ref**: A8
- **Effort**: L (16-24h)
- **Files**: `frontend/lib/ai/providers/`, new `frontend/lib/ai/llm-provider.ts`
- **Plan**:
  1. Define `LLMProvider` interface:
     ```typescript
     interface LLMProvider {
       complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
       stream(prompt: string, options?: CompletionOptions): AsyncIterable<StreamChunk>;
       embeddings(texts: string[]): Promise<number[][]>;
     }
     ```
  2. Implement for each provider: `AzureOpenAIProvider`, `OllamaProvider`
  3. Create `ProviderRegistry` that selects provider based on config
  4. Refactor all direct provider calls to go through the registry
  5. Firecrawl: wrap in `ScrapingProvider` interface similarly
- **Verification**: Switching `LLM_PROVIDER=ollama` to `LLM_PROVIDER=azure` in env changes provider without code changes.

### Task 5.9 — Unify data fetching strategy

- **Ref**: A9
- **Effort**: M (8-16h)
- **Files**: `frontend/lib/query/`, `frontend/lib/actions/`
- **Plan**:
  1. Establish convention: **Server actions** for mutations (create/update/delete), **React Query + server actions** for reads
  2. Remove direct `fetch()` calls from components — wrap in React Query hooks
  3. Create standard query key factory: `queryKeys.opportunities.list(filters)`, `queryKeys.opportunities.detail(id)`
  4. Document the pattern in a `frontend/lib/query/README.md`
- **Verification**: No direct `fetch()` calls in components. All reads go through React Query hooks.

### Task 5.10 — Introduce Python service layer for agents

- **Ref**: A10
- **Effort**: L (16-24h)
- **Files**: `src/docfusion/agents/specialists/`, new `src/docfusion/services/`
- **Plan**:
  1. Create service interfaces in `src/docfusion/services/`:
     - `intelligence_service.py` — wraps intelligence module
     - `discovery_service.py` — wraps discovery module
     - `analysis_service.py` — wraps analyzers
  2. Agent specialists depend on service interfaces, not concrete modules
  3. Services are injected via constructor or factory
- **Verification**: Agents can be instantiated with mock services for testing.

### Task 5.11 — Decouple scraper runtime into composable parts

- **Ref**: A12
- **Effort**: M (8-16h)
- **Files**: `frontend/lib/scrapers/runtime.ts`
- **Plan**:
  1. Split into:
     - `scrapers/fetcher.ts` — page fetching (Firecrawl wrapper)
     - `scrapers/extractor.ts` — content extraction (LLM wrapper)
     - `scrapers/deduplicator.ts` — dedup logic
     - `scrapers/persister.ts` — database writes
  2. `runtime.ts` becomes a thin orchestrator composing these parts
  3. Each part is independently testable
- **Verification**: Each module has unit tests. `runtime.ts` < 200 lines.

### Task 5.12 — Normalize field naming across stack

- **Ref**: A13
- **Effort**: M (4-8h)
- **Files**: `frontend/lib/types/opportunity.ts`, `backend/discovery/pipeline/docfusion_sync.py`, `frontend/lib/db/schema.ts`
- **Plan**:
  1. Choose canonical names: `countryRegion` (TS) / `country_region` (Python/SQL)
  2. Update Python sync mapping to use `country_region` consistently
  3. Update filter types to use `countryRegions` (plural) instead of `countries`
  4. Add a mapping reference comment in the sync file
- **Verification**: `grep -rn '"country"' backend/discovery/ --include="*.py"` returns 0 (all use `country_region`)

### Task 5.13 — Unify Opportunity data model across layers

- **Ref**: T4
- **Effort**: L (16-24h)
- **Files**: `frontend/lib/types/opportunity.ts`, `frontend/lib/db/schema.ts`, `backend/discovery/models/`, Python Pydantic models
- **Plan**:
  1. Define the canonical Opportunity shape in `frontend/lib/types/opportunity.ts`
  2. Derive Drizzle schema types from the canonical shape (use `typeof opportunities.$inferSelect`)
  3. Ensure Python Pydantic model fields map 1:1 to the TypeScript type
  4. Add a sync test that compares Python model fields to TypeScript type fields
  5. Document the mapping in a shared reference
- **Verification**: Sync test passes confirming field parity. No more manual type casting when crossing the TS/Python boundary.

---

## Phase 6: UX & Performance (Sprint 6)

**Goal**: Improve user experience with loading states, error handling, and performance optimizations.

### Task 6.1 — Add `loading.tsx` to all data-heavy pages

- **Ref**: U1
- **Effort**: M (4-8h)
- **Files**: 7+ page directories
- **Plan**:
  1. Create `loading.tsx` with appropriate skeleton for each:
     - `app/(app)/opportunities/loading.tsx` — table skeleton
     - `app/(app)/crm/contacts/loading.tsx` — list skeleton
     - `app/(app)/crm/accounts/loading.tsx` — kanban skeleton
     - `app/(app)/crm/deals/loading.tsx` — list skeleton
     - `app/(app)/templates/loading.tsx` — grid skeleton
     - `app/(app)/documents/loading.tsx` — card grid skeleton
     - `app/(app)/pipeline/loading.tsx` — board skeleton
  2. Use existing skeleton components from `components/ui/skeleton.tsx`
- **Verification**: Navigate to each page — skeleton appears before data loads.

### Task 6.2 — Wrap major features in ErrorBoundary

- **Ref**: U2
- **Effort**: M (4-8h)
- **Files**: `app/(app)/layout.tsx` and major page components
- **Plan**:
  1. Wrap each major feature area in ErrorBoundary with CompactErrorFallback
  2. Priority areas: document editor, opportunity detail, CRM, pipeline board
  3. Ensure errors in one section don't crash the entire app
- **Verification**: Inject a runtime error in a component — ErrorBoundary catches it and shows fallback.

### Task 6.3 — Add empty states to all list/table views

- **Ref**: U3
- **Effort**: M (4-8h)
- **Files**: List/table components across domains
- **Plan**:
  1. Create `components/ui/empty-state.tsx` — reusable component with icon, message, optional CTA
  2. Add to: opportunities list, contacts list, accounts list, templates gallery, documents list
  3. Distinguish between "no data yet" and "no results matching filter"
- **Verification**: Each list shows helpful empty state when data is empty.

### Task 6.4 — Replace `<img>` with `next/Image`

- **Ref**: U4
- **Effort**: M (8-16h)
- **Files**: All components using `<img>` tags
- **Plan**:
  1. Search for `<img` in all .tsx files
  2. Replace with `<Image>` from `next/image` with appropriate `width`, `height`, `alt`
  3. Add meaningful alt text to all images
- **Verification**: No `<img>` tags remain outside of third-party rendered content.

### Task 6.5 — Add TTL to module-level caches

- **Ref**: P1
- **Effort**: M (4-8h)
- **Files**: `document-synthesis-engine.ts`, `scrapers/queue.ts`, `hdsi/predictive.ts`
- **Plan**:
  1. Create `frontend/lib/utils/ttl-cache.ts` with a `TTLCache<K, V>` class that:
     - Checks expiry on `get()`, evicts if stale
     - Enforces max size on `set()`, evicts oldest if over limit
  2. Replace all `new Map()` caches with `new TTLCache(5 * 60 * 1000, 500)` (5 min TTL, 500 max entries)
- **Verification**: Cache entries expire after TTL. Cache size stays bounded.

### Task 6.6 — Optimize `getOpportunityStats` to fewer queries

- **Ref**: P2
- **Effort**: M (4-8h)
- **Files**: `frontend/lib/actions/opportunities.ts`
- **Plan**:
  1. Combine 8 aggregate queries into 2-3 using Drizzle subqueries or raw SQL CTEs
  2. Single query for all counts (status, priority, category, country)
  3. Single query for value aggregates (total, active, expired, avg fit)
- **Verification**: Stats page loads with same data, fewer DB round-trips (verify with query logging).

### Task 6.7 — Apply React.memo to heavy list item components

- **Ref**: U7
- **Effort**: M (4-8h)
- **Files**: List item components across domains
- **Plan**:
  1. Identify components rendered inside `.map()` loops
  2. Apply `React.memo` to: `OpportunityRow`, `DocumentCard`, `TemplateCard`, `ContactCard`, `PipelineCard`
  3. Memoize callback props passed to these components with `useCallback`
- **Verification**: React DevTools Profiler shows reduced re-renders in list views.

### Task 6.8 — Use existing virtualized-list for long lists

- **Ref**: U7 (related)
- **Effort**: M (4-8h)
- **Files**: `components/ui/virtualized-list.tsx`, list page components
- **Plan**:
  1. Apply `VirtualizedList` to opportunities list (potentially 1000+ items)
  2. Apply to contacts list, documents list
  3. Only render visible items + buffer
- **Verification**: Scrolling through 1000+ items remains smooth. DOM node count stays low.

### Task 6.9 — Extend form validation to all forms

- **Ref**: U5
- **Effort**: M (8-16h)
- **Files**: All form components across CRM, pipeline, settings, templates
- **Plan**:
  1. Audit all form components: identify which lack validation
  2. For each form, define a Zod schema matching the form fields
  3. Wire up React Hook Form with the Zod resolver (pattern from `ContactForm`)
  4. Add inline error messages using the existing `FormMessage` component
  5. Priority forms: `AccountForm`, `DealForm`, `ProposalDialog`, `TemplateForm`
- **Verification**: Submit each form with invalid data — inline errors appear. Valid data submits successfully.

### Task 6.10 — Accessibility audit and remediation

- **Ref**: U6
- **Effort**: L (16-24h)
- **Files**: Components across all domains
- **Plan**:
  1. Run `axe-core` audit on all major pages using the existing Playwright setup
  2. Fix critical WCAG 2.1 AA violations:
     - Add `alt` text to all `<img>` and icon-only buttons
     - Add skip-to-content link in `app/(app)/layout.tsx`
     - Add `aria-live="polite"` regions for dynamic content (search results, notifications, toast messages)
     - Add keyboard navigation to custom select/dropdown components
     - Add `aria-label` to icon-only interactive elements
  3. Add `eslint-plugin-jsx-a11y` to ESLint config for ongoing enforcement
- **Verification**: `axe-core` audit returns 0 critical or serious violations on all major pages.

### Task 6.11 — Set up error monitoring (Sentry or equivalent)

- **Ref**: P3
- **Effort**: M (4-8h)
- **Files**: `frontend/app/layout.tsx`, `frontend/lib/utils/logger.ts`, deployment config
- **Plan**:
  1. Add Sentry SDK: `npm install @sentry/nextjs`
  2. Configure `sentry.client.config.ts` and `sentry.server.config.ts`
  3. Add `SENTRY_DSN` to environment variables
  4. Wire the logger from Task 2.4 to also report errors to Sentry at `error` level
  5. Add source maps upload in CI build step
  6. For Python backend: `uv add sentry-sdk` and initialize in API startup
- **Verification**: Trigger a test error — it appears in Sentry dashboard within 30 seconds.

---

## Execution Timeline

| Sprint | Phase | Focus | Key Deliverable |
|--------|-------|-------|-----------------|
| Sprint 1 | Phase 1 | Security | All CRITICAL/HIGH security issues resolved |
| Sprint 2 | Phase 2 | Error Handling | Bare excepts eliminated, any types reduced, logging structured |
| Sprint 3 | Phase 3 | Testing | Frontend coverage >10%, critical actions tested |
| Sprint 4 | Phase 4 | Code Quality | Duplication removed, magic numbers named, largest files split, complexity enforced |
| Sprint 5 | Phase 5 | Architecture | Schema consolidated, repo pattern, LLM abstraction, service layer, imports fixed |
| Sprint 6 | Phase 6 | UX & Perf | Loading states, error boundaries, a11y, form validation, error monitoring |

---

## Success Metrics

| Metric | Current | Target (Post-Plan) |
|--------|---------|---------------------|
| Frontend test coverage | 0.66% (6 files) | >15% (50+ files) |
| Python test coverage | 8.4% (31/367 files) | >25% (90+ files) |
| TypeScript `any` usage | 196 occurrences | <30 occurrences |
| Bare `except:` blocks | 65 instances | 0 instances |
| `console.*` calls | 697 instances | 0 in lib/ (logger only) |
| CRITICAL security issues | 3 | 0 |
| Files >1500 lines | 20+ | <10 (with plan to reduce further) |
| Ruff complexity rules | Disabled | Enabled (threshold: 15) |
| `datetime.utcnow()` calls | 30+ | 0 |
| Schema files | 25 | 5 domains |
| axe-core critical a11y violations | Unknown | 0 |
| Forms with Zod validation | 1 | All user-facing forms |
| Error monitoring | None | Sentry configured for frontend + backend |
| Opportunity model field parity (TS/Python) | Divergent | 1:1 verified by test |

---

## Monitoring & Maintenance

### After Each Sprint

1. Run full test suite: `uv run pytest tests/ci/ -vxs` and `cd frontend && npx vitest run`
2. Run linter: `uv run ruff check src/` and `cd frontend && npx next lint`
3. Run type checker: `uv run mypy` and verify no new `any` types
4. Review security scan output from CI pipeline
5. Update this plan with any deferred or newly discovered items

### Ongoing Practices

- **No new bare `except:`** — add to pre-commit hook
- **No new `any` types** — add ESLint rule
- **No new files >500 lines** — add to code review checklist
- **All new features need tests** — enforce in PR template
- **All new components need loading/error/empty states** — add to component checklist
