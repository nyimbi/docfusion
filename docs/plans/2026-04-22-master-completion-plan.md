# DocuFusion Master Completion Plan

**Date**: 2026-04-22
**Status**: Draft v1
**Owner**: Platform engineering
**Scope**: Close every identified gap (stubbed, partial, broken, orphaned) across the platform, sequenced for low risk and cumulative value.

This plan supersedes none of the existing plans. It threads them together and adds the items they miss. It is the single source of truth for "what does 'complete' mean for DocuFusion and how do we get there."

---

## 0. Reading Order

1. §1 — Existing plans and how this one relates to them.
2. §2 — Master gap register (the authoritative list of unfinished work).
3. §3 — Phases, with explicit tasks, files, and exit criteria.
4. §4 — Cross-cutting rules (apply to every phase).
5. §5 — Verification strategy and definition of done.
6. §6 — Sequencing, effort, and timeline.
7. §7 — Risks and how we mitigate them.
8. §8 — Appendix: file-level change index.

---

## 1. Relationship to Existing Plans

| Existing plan | Treatment |
|---|---|
| `docs/plans/2026-03-01-production-readiness-implementation.md` | **Absorbed**. Phase 4 (operations) and Phase 6 (polish) reference it by task ID. No duplication. |
| `docs/plans/2026-03-01-production-readiness-design.md` | **Authoritative** for deployment architecture. Linked from §3.4. |
| `docs/superpowers/specs/2026-04-16-rfp-ingestion-discovery-design.md` | **Absorbed** as §3.2 (RFP/FastAPI bridge). Updated where reality diverged. |
| `docs/findings-plan.md` | **Absorbed**. Security/quality tasks folded into §3.1. |
| `docs/todo3.md` | **Reference only** — inventory, not remediation. |
| `HANDOVER.md` | **Reference only** — historical. |

This plan adds five areas **no existing plan covers end-to-end**:
- Agent subsystem completion (9 `NotImplementedError` stubs in agent core + communication)
- LaTeX compilation pipeline (`pdflatex` invocation, preview artifacts)
- Composition interpreter completion (`_merge_sequential_nodes`)
- SVG visualization optimizer (5 stubs)
- Workflow integration stubs (5 more stubs in `workflow/integration/`)

---

## 2. Master Gap Register

All items are **verified by direct code inspection on 2026-04-22**. Each has an ID used throughout §3.

### 2.1 Python stubs (explicit `NotImplementedError`)

| ID | File:Line | Symbol | Severity |
|---|---|---|---|
| G-AG-01 | `src/docfusion/agents/core/agent.py:53` | Fallback `OllamaClient.close` | High — swallows shutdown path |
| G-AG-02 | `src/docfusion/agents/core/agent.py:310` | `Agent.process_task` | Critical — blocks task dispatch |
| G-AG-03 | `src/docfusion/agents/core/agent.py:315` | `Agent.handle_message` | Critical — blocks inter-agent comms |
| G-AG-04 | `src/docfusion/agents/core/agent.py:320` | `Agent.get_capabilities` | High — orchestration routing |
| G-AG-05 | `src/docfusion/agents/core/agent.py:325` | `Agent.evaluate_task_fit` | High — task-fit scoring |
| G-CM-01 | `src/docfusion/agents/communication/channels.py:141` | `Channel.send_message` | Critical |
| G-CM-02 | `src/docfusion/agents/communication/channels.py:146` | `Channel.connect` | Critical |
| G-CM-03 | `src/docfusion/agents/communication/channels.py:151` | `Channel.disconnect` | High |
| G-CM-04 | `src/docfusion/agents/communication/channels.py:175` | `Channel._process_message` | Critical |
| G-CP-01 | `src/docfusion/composition/interpreter.py:435` | `_merge_sequential_nodes` | Medium — optimization path |
| G-SA-01 | `src/docfusion/document_engine/formatter/style_applier.py:842` | `_log_initialization` | Low — logging-only |
| G-WF-01 | `src/docfusion/workflow/integration/nlp_workflow_integration.py:1030` | `_update_performance_metrics` | Medium |
| G-WF-02 | `src/docfusion/workflow/integration/nlp_workflow_integration.py:1035` | `_check_performance_thresholds` | Medium |
| G-WF-03 | `src/docfusion/workflow/integration/agents_workflow_integration.py:997` | `_create_workflow_swarm` | High |
| G-WF-04 | `src/docfusion/workflow/integration/agents_workflow_integration.py:1027` | `_facilitate_agent_collaboration` | High |
| G-WF-05 | `src/docfusion/workflow/integration/agents_workflow_integration.py:1037` | `_resolve_stuck_agent` | Medium |
| G-WF-06 | `src/docfusion/workflow/integration/agents_workflow_integration.py:1042` | `_handle_failed_agent` | Medium |
| G-WF-07 | `src/docfusion/workflow/integration/workflow_document_bridge.py:889` | `_setup_event_handlers` | High |
| G-SVG-01..05 | `src/docfusion/visualization/renderers/svg_renderer.py:740-760` | `_merge_similar_elements`, `_optimize_paths`, `_remove_default_attributes`, `_compress_styles`, `_xml_to_svg_element` | Medium |
| G-HC-01 | `src/docfusion/api/health/health_checks.py:143` | anonymous health check | Low |

### 2.2 Partial / disconnected subsystems

| ID | Area | Current state | Target state |
|---|---|---|---|
| G-RFP-01 | `src/docfusion/rfp/requirement_extractor.py` | Regex-only, AI flag off, hardcoded Docling URL | LiteLLM-enhanced extraction via `SecretsManager.get_docling_url()` |
| G-RFP-02 | `src/docfusion/rfp/rfp_analyzer.py` | Rule-based only | Hybrid rule + LiteLLM analysis |
| G-RFP-03 | `src/docfusion/rfp/compliance_matrix.py` | In-memory only | Persisted to `compliance_matrices` + `compliance_entries` via asyncpg |
| G-RFP-04 | `src/docfusion/rfp/stakeholder_mapper.py` | Direct Ollama call at `localhost:11434` | Route through `LiteLLMClient` |
| G-API-01 | `src/docfusion/api/endpoints/` | No `rfp_endpoints.py`, no `discovery_endpoints.py` | Both created and registered |
| G-API-02 | `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` | Calls `simulateParsingJob` (fake) | Calls FastAPI `/api/v1/rfp/{id}/parse` |
| G-API-03 | `frontend/app/api/v1/rfp/upload/route.ts` | File persistence commented out | Proxies to `SecureStorageService` via FastAPI |
| G-DATA-01 | `frontend/lib/db/schema*.ts` | Two requirements tables (`requirements`, `rfpRequirements`) | Unified to `rfpRequirements` with `aiAnalysis jsonb` added |
| G-DATA-02 | Discovery → Ingestion | No bridge; manual re-upload | `/opportunities/{id}/ingest` endpoint copies `opportunity_documents` → `rfp_documents` |
| G-DOC-01 | `src/docfusion/document_engine/git_latex_manager.py` | References `pdflatex`/`xelatex`, does not invoke | Async subprocess pipeline with error capture, artifact caching, timeout |
| G-DOC-02 | `src/docfusion/api/endpoints/template_endpoints.py` | Static templates | Dynamic population via composition runner |
| G-DISC-01 | `src/docfusion/discovery/__init__.py` | Optional imports silently fail | Explicit capability flags exposed to healthcheck |
| G-AI-01 | `src/docfusion/ai_agents/` | README only | Either deleted or backed by `specialists/` re-export layer; decision recorded in ADR |
| G-MEM-01 | Agent memory | In-memory, lost on restart | Persisted to PostgreSQL via `agent_memory` table |
| G-FB-01 | LLM fallback | Exists in `infrastructure/llm_fallback.py` but not wired through all agents | Every LLM caller routed through `LLMFallbackChain` |

### 2.3 Operational / orphaned

| ID | Area | Action |
|---|---|---|
| G-OP-01 | `ai_agents/` placeholder | Delete or ADR-document |
| G-OP-02 | Missing `__init__.py` in 6 collaboration subdirs | Add explicit `__init__.py` |
| G-OP-03 | 524 commented assignment lines | Delete in a dedicated cleanup pass |
| G-OP-04 | No coverage enforcement in CI | Add `--cov-fail-under` after baseline measured |
| G-OP-05 | Dual schema drift (Python Pydantic vs TS Drizzle) | Generated-types parity test |
| G-OP-06 | Test count skewed to `tests/ci` without e2e | Add Playwright e2e suite for ingest → compose → render golden path |

### 2.4 Security / hardening remnants

From `HANDOVER.md`: items 1–4 in "Remaining Issues" — still open:
- `asyncio.get_event_loop()` residue in discovery/nlp
- Pyright import-resolution for `core.utils`
- Auth + workflow modules at 0% test coverage
- Background-agent uncommitted changes

---

## 3. Phased Plan

Six phases. Each phase is a merge-gate: the phase is only "done" when its exit criteria pass on `main`.

### Phase 1 — Foundation Hardening (complete the audit)

**Goal**: Zero residual hardening debt from iterations 1–5 before we bolt on new capability. Two weeks.

| Task | IDs addressed | Files | Notes |
|---|---|---|---|
| 1.1 Eliminate remaining `asyncio.get_event_loop()` | HANDOVER #1 | `src/docfusion/discovery/**`, `src/docfusion/nlp/**` | Find & replace with `asyncio.get_running_loop()` inside async context, `asyncio.new_event_loop()` only at entrypoints |
| 1.2 Fix pyright `core.utils` resolution | HANDOVER #2 | `pyrightconfig.json`, `src/docfusion/core/utils.py` | Add `include` root and `extraPaths`; verify with `uv run pyright` |
| 1.3 Add minimal coverage for auth + workflow | HANDOVER #3 | `tests/ci/test_auth_flows.py`, `tests/ci/test_workflow_core.py` | Real objects, real DB via fixture, LLM-only mocks |
| 1.4 Reclaim background-agent changes | HANDOVER #4 | `/private/tmp/` | Diff, triage, commit or drop — record decision in `docs/audit/` |
| 1.5 Address 11 TODO/FIXME markers | register | grep targets | Resolve or convert to tickets in `backlog/` |
| 1.6 Verify no new `datetime.utcnow()` or bare `except:` introduced since iter 5 | findings-plan Q10, Q15 | full tree | CI lint gate |

**Exit criteria**
- `uv run pyright` returns zero errors for `src/docfusion/core/utils.py` consumers.
- `grep -rn "asyncio.get_event_loop" src/docfusion/ --include="*.py"` returns 0.
- `tests/ci/` covers at least one happy-path and one failure-path for every `src/docfusion/security/` and `src/docfusion/workflow/` top-level module.

---

### Phase 2 — RFP Pipeline Unification (single processing tier)

**Goal**: One canonical RFP path, Python-heavy, Next.js as UI. Absorbs `2026-04-16-rfp-ingestion-discovery-design.md`. Three weeks.

**Step 2.1 — Centralize infrastructure config**
- Modify `src/docfusion/config/secrets.py`: add `get_docling_url()`, `get_docling_timeout()`, `get_litellm_url()`, `get_litellm_key()` if any of these are missing.
- Remove hardcoded `http://20.84.71.33:3600` in `requirement_extractor.py`.
- **ID coverage**: G-RFP-01 (infra half).

**Step 2.2 — Enable AI enhancement in Python RFP modules**
- `src/docfusion/rfp/requirement_extractor.py`: add `_extract_with_ai(text, sections)` using `LiteLLMClient.chat_completion()` + `LLMFallbackChain`. Regex runs first; AI refines ambiguous rows.
- `src/docfusion/rfp/rfp_analyzer.py`: add `_analyze_with_ai(requirements, text)` producing compliance narrative + risk commentary.
- `src/docfusion/rfp/stakeholder_mapper.py`: replace direct `httpx.AsyncClient` against `localhost:11434` with `LiteLLMClient`.
- **ID coverage**: G-RFP-01, G-RFP-02, G-RFP-04, G-FB-01.

**Step 2.3 — Persist compliance matrix**
- `src/docfusion/rfp/compliance_matrix.py`: add async `save_to_db(session)` + `load_from_db(matrix_id)` writing to `compliance_matrices` and `compliance_entries`.
- Add migration `migrations/versions/NNNN_compliance_matrix_tables.py` if tables don't already exist.
- **ID coverage**: G-RFP-03.

**Step 2.4 — Unify requirements tables**
- Drizzle migration `frontend/drizzle/XXXX_unify_requirements.sql`: add `aiAnalysis jsonb` to `rfpRequirements`; copy from `requirements` table with explicit column map.
- Update every reader/writer in `frontend/lib/actions/requirements.ts` and pages under `frontend/app/(app)/opportunities/[id]/requirements/`.
- Keep old `requirements` table in place behind a feature flag for 2 weeks; drop in Phase 4.
- **ID coverage**: G-DATA-01.

**Step 2.5 — FastAPI endpoints**
- Create `src/docfusion/api/endpoints/rfp_endpoints.py` with the six endpoints from the v2 spec (§3.1 of that doc).
- Create `src/docfusion/api/endpoints/discovery_endpoints.py` with the six discovery endpoints (§3.2).
- Register both in `src/docfusion/api/dependencies.py` and `main.py`.
- Auth: reuse Keycloak OIDC middleware already present.
- **ID coverage**: G-API-01.

**Step 2.6 — Replace Next.js simulate with real pipeline**
- `frontend/app/api/v1/rfp/upload/route.ts`: stream uploaded file to FastAPI `/api/v1/rfp/upload`; stop writing to `/tmp`.
- `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`: call FastAPI `/api/v1/rfp/{id}/parse`; remove `simulateParsingJob`. Keep `processRfpParsingJob` (server action) available behind a `USE_PYTHON_RFP=false` flag as fallback.
- **ID coverage**: G-API-02, G-API-03.

**Step 2.7 — Discovery→Ingestion bridge**
- Endpoint `POST /api/v1/discovery/opportunities/{id}/ingest` in `discovery_endpoints.py`: copies the most recent `opportunity_documents` row into `rfp_documents`, then kicks off the parse pipeline.
- UI button in `frontend/components/opportunities/OpportunityHeaderActions.tsx`.
- **ID coverage**: G-DATA-02.

**Exit criteria**
- End-to-end test: discover opportunity → convert → parse → extract requirements → populate compliance matrix. Lives in `tests/ci/test_rfp_pipeline_e2e.py`.
- Flag `USE_PYTHON_RFP=true` is the default after 7 days of production soak.
- No references to `simulateParsingJob` remain outside tests.

---

### Phase 3 — Agent Subsystem Completion (make orchestration real)

**Goal**: Move agents from "skeletal" to a working internal capability used by the RFP writer and reviewer flows. Three weeks.

**Step 3.1 — Define protocols and kill `NotImplementedError`**
- Replace the current abstract `Agent` contract with `Protocol` classes (`TaskHandler`, `MessageHandler`, `CapabilityProvider`). Concrete base `BaseAgent` implements the five methods as defaults where sensible (e.g. `get_capabilities` returns `self.capabilities`, `evaluate_task_fit` uses role+capability matching).
- Files: `src/docfusion/agents/core/agent.py`, new `src/docfusion/agents/core/protocols.py`.
- **ID coverage**: G-AG-01..05.

**Step 3.2 — Implement communication channels**
- `src/docfusion/agents/communication/channels.py`: implement `InProcessChannel` (asyncio `Queue`-backed), `RedisChannel` (pub/sub), and `WebSocketChannel`. `Channel` becomes abstract-but-with-defaults; concrete classes remove the `NotImplementedError` bodies.
- **ID coverage**: G-CM-01..04.

**Step 3.3 — Workflow integration stubs**
- Implement the seven methods in `workflow/integration/*.py`:
  - `_create_workflow_swarm` → delegate to `SwarmManager.create_swarm`
  - `_facilitate_agent_collaboration` → use `CoordinatorAgent`
  - `_resolve_stuck_agent`, `_handle_failed_agent` → state machine: retry → reassign → escalate
  - `_update_performance_metrics`, `_check_performance_thresholds` → write to `agent_metrics` table
  - `_setup_event_handlers` → subscribe to workflow event bus
- **ID coverage**: G-WF-01..07.

**Step 3.4 — Agent memory persistence**
- New `src/docfusion/agents/memory/persistent_store.py` backed by PostgreSQL (`agent_memory` table with `agent_id`, `memory_type`, `payload jsonb`, `ttl`).
- Replace all in-process memory dicts in `agents/memory/` with the persistent store. Load on agent start, flush on task completion.
- **ID coverage**: G-MEM-01.

**Step 3.5 — Dispose of `ai_agents/` placeholder**
- Write ADR `docs/technical/design_decisions/2026-04-22-ai-agents-placeholder.md`: decide to either remove or rename to `agents/reasoning/` with a re-export shim.
- Execute the decision.
- **ID coverage**: G-AI-01, G-OP-01.

**Step 3.6 — Wire agents into RFP flow**
- `WriterAgent` consumes compliance-matrix output from Phase 2, drafts response sections.
- `ReviewerAgent` validates against requirements.
- `ComplianceAgent` runs the matrix-vs-draft diff.
- Integration point: `src/docfusion/orchestration/proposal_orchestrator.py` (new).

**Exit criteria**
- `grep -rn "NotImplementedError" src/docfusion/agents src/docfusion/workflow/integration` returns 0.
- Smoke test `tests/ci/test_agent_dispatch.py`: dispatches a task, agent claims it, emits message, writes memory, completes — all against a real test Redis + PostgreSQL.

---

### Phase 4 — Document Engine Completion (generate real output)

**Goal**: Turn the document engine from "substantial but won't produce a PDF" into an end-to-end renderer. Two weeks.

**Step 4.1 — LaTeX compilation pipeline**
- `src/docfusion/document_engine/latex/compiler.py` (new): async subprocess wrapper around `pdflatex`/`xelatex`/`lualatex` with:
  - Temp working directory per job
  - Timeout (default 120s, configurable via `SecretsManager.get_latex_timeout()`)
  - Two-pass run for cross-references
  - Structured error parsing (`.log` → `LatexError` with line numbers)
  - Output caching keyed on SHA256 of `.tex` input
- Wire into `git_latex_manager.py` where compilation is currently referenced.
- **ID coverage**: G-DOC-01.

**Step 4.2 — Template dynamic population**
- `src/docfusion/api/endpoints/template_endpoints.py`: accept `variables` payload, invoke composition runner, return populated document.
- **ID coverage**: G-DOC-02.

**Step 4.3 — Composition interpreter sequential-node merge**
- Implement `_merge_sequential_nodes` in `src/docfusion/composition/interpreter.py:435`. Merges adjacent nodes of the same type to reduce AST size.
- **ID coverage**: G-CP-01.

**Step 4.4 — SVG optimizer completion**
- Implement all five stubs in `src/docfusion/visualization/renderers/svg_renderer.py`:
  - `_merge_similar_elements`: group by attribute signature
  - `_optimize_paths`: simplify using Ramer–Douglas–Peucker
  - `_remove_default_attributes`: per-element defaults table
  - `_compress_styles`: dedupe into CSS classes
  - `_xml_to_svg_element`: ElementTree → domain object
- **ID coverage**: G-SVG-01..05.

**Step 4.5 — Logging stub**
- Implement `_log_initialization` in `style_applier.py:842` (one-liner structured log).
- **ID coverage**: G-SA-01.

**Step 4.6 — Healthcheck stub**
- `src/docfusion/api/health/health_checks.py:143`: implement the missing checker (Docling reachability) or remove the abstract method if unused.
- **ID coverage**: G-HC-01.

**Step 4.7 — Discovery capability flags**
- `src/docfusion/discovery/__init__.py`: surface `CAPABILITIES = {"playwright": bool, "crawl4ai": bool, ...}` derived from import outcomes, rather than silent fallback. Hook into `/api/v1/discovery/health`.
- **ID coverage**: G-DISC-01.

**Exit criteria**
- Golden test `tests/ci/test_latex_render.py` compiles a known-good `.tex` to `.pdf` in under 15s.
- `grep -rn "NotImplementedError" src/docfusion/` returns 0.
- Healthcheck endpoint returns component-by-component status.

---

### Phase 5 — Quality, Schema, and Architecture Debt

**Goal**: Execute the tail of `findings-plan.md` that has not shipped. Three weeks.

| Task | Source | Files |
|---|---|---|
| 5.1 Repository pattern (top 5 domains) | findings-plan 5.2 | `frontend/lib/repositories/` |
| 5.2 Schema consolidation (25 → 5) | findings-plan 5.1 | `frontend/lib/db/schema-*.ts` |
| 5.3 Generated-types parity test | G-OP-05 | `tests/ci/test_schema_parity.py` |
| 5.4 Circular import resolution | findings-plan 5.3 | `src/docfusion/intelligence/`, `src/docfusion/discovery/` |
| 5.5 File splits for > 1500-line files | findings-plan 4.12 | `document_formatter.py`, `publishing_tools.py`, etc. |
| 5.6 Dedupe + magic-number extraction | findings-plan 4.1–4.4 | opportunity filters, import pipeline, categorizer |
| 5.7 Reinstate Ruff complexity rules | findings-plan 4.6 | `pyproject.toml` |
| 5.8 Missing `__init__.py` cleanup | G-OP-02 | `collaboration/**/` |
| 5.9 Commented-code sweep | G-OP-03 | full tree |

**Exit criteria**
- `uv run ruff check src/` passes with `C901`, `PLR0912`, `PLR0913`, `PLR0915` unignored at `max-complexity = 15`.
- No file in active codebase exceeds 1,500 lines.
- `python -c "from docfusion.intelligence import *; from docfusion.discovery import *"` succeeds.
- Schema parity test runs in CI and passes.

---

### Phase 6 — Production Readiness and Ops

**Goal**: Execute `2026-03-01-production-readiness-implementation.md`. Do not restate it; inherit its tasks. Four weeks.

Inherited tasks: scraper runner + systemd timers, notifications (email, web-push), PAdES e-signature, nginx + PM2 deployment, frontend Vitest coverage > 15%, Sentry integration, Playwright e2e.

**Additional items this plan adds on top:**

| Task | ID |
|---|---|
| 6.1 Coverage gate in CI (`pytest --cov-fail-under` + Vitest threshold) | G-OP-04 |
| 6.2 Playwright e2e golden path: upload RFP → compliance matrix → export PDF | G-OP-06 |
| 6.3 `alembic upgrade head` check in CI | new |
| 6.4 Drop legacy `requirements` table (scheduled from Phase 2.4) | G-DATA-01 (tail) |
| 6.5 Runtime observability dashboards (Prometheus + Grafana) for FastAPI, PostgreSQL, LiteLLM | new |

**Exit criteria**
- CI coverage gate enforced; build fails if coverage < 25% Python / < 15% frontend.
- Playwright e2e runs in CI on every PR.
- Staging deploy produces a render-complete RFP response artifact from a real opportunity.

---

## 4. Cross-Cutting Rules

These apply to every phase. They exist because we've already paid for them in audit iterations 1–5 and don't want to pay again.

1. **No new `NotImplementedError`**. If a placeholder is unavoidable, raise `PendingImplementationError` (new in `core/errors.py`) with an open ticket ID in the message.
2. **No new `asyncio.get_event_loop()`**. Use `asyncio.get_running_loop()` inside async, `asyncio.new_event_loop()` at entrypoints only.
3. **No new `datetime.utcnow()`**. Always `datetime.now(timezone.utc)`.
4. **No direct `os.environ.get()`**. Always `SecretsManager`.
5. **Pydantic v2** everywhere (`model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)`).
6. **Tabs, not spaces**, in Python (overrides pyproject).
7. **Tests go in `tests/ci/`**. Real objects. LLM-only mocks.
8. **Source files under 25 KB**. Enforced in CI via file-size lint.
9. **All LLM calls through `LiteLLMClient` + `LLMFallbackChain`**. No direct provider clients.
10. **Every persistent write flows through asyncpg**. No sync PostgreSQL drivers outside Alembic.
11. **UUID7** for all new IDs (`uuid7str`).
12. **Every new module ships with at least one CI test.**

Pre-commit hook additions in Phase 1:
- Regex rule against `NotImplementedError`, `asyncio.get_event_loop`, `datetime.utcnow`, `os.environ.get`.
- File size check: 25 KB ceiling, warning at 20 KB.

---

## 5. Verification Strategy

Each phase has two verification gates: **component** (does the unit work) and **integration** (does it work inside the platform).

| Gate | How |
|---|---|
| Component | `uv run pytest tests/ci/<module> -vxs` |
| Integration | `uv run pytest tests/ci/test_*_e2e.py -vxs` against a real PostgreSQL + Redis (docker-compose service) |
| Lint | `uv run ruff check src/`, `uv run pyright`, `cd frontend && npx next lint` |
| Security | `bandit -r src/`, `safety check`, `pip-audit`, npm audit |
| Coverage | `uv run pytest --cov=docfusion --cov-report=term` and Vitest coverage; see thresholds in Phase 6 |
| E2E | `playwright test` against `docker-compose up` full stack |

**Definition of Done (whole platform)**
- Every ID in §2 closed with a commit reference.
- All six phase exit criteria green.
- Coverage gates enforced and passing.
- A real RFP document can be uploaded, parsed, analyzed, drafted, reviewed, compiled to PDF, and e-signed in staging without manual intervention.

---

## 6. Sequencing, Effort, Timeline

Sequential, because later phases depend on earlier ones. Parallelism happens **within** a phase, not across.

| Phase | Theme | Duration | Dependencies |
|---|---|---|---|
| 1 | Foundation hardening | 2 weeks | — |
| 2 | RFP pipeline unification | 3 weeks | Phase 1 |
| 3 | Agent subsystem | 3 weeks | Phase 1 (not 2; can run partly in parallel with Phase 2 tail) |
| 4 | Document engine | 2 weeks | Phase 3 (for writer/reviewer wiring) |
| 5 | Quality/arch debt | 3 weeks | Phases 1–4 (touches their code) |
| 6 | Production readiness | 4 weeks | Phases 1–5 |
| **Total** | | **~17 weeks** | ~4 months end-to-end |

Parallelism budget: Phase 2.5 (FastAPI endpoints) and Phase 3.1–3.3 (agent core + channels) can run on separate branches for ~1 week of overlap.

Effort sizing per phase (engineer-weeks):
- Phase 1: 3 ew
- Phase 2: 6 ew
- Phase 3: 6 ew
- Phase 4: 4 ew
- Phase 5: 6 ew
- Phase 6: 8 ew (includes e-signature + deployment scripting)
- **Total: ~33 engineer-weeks** for a two-engineer team on Phases 1–5 plus one platform engineer on Phase 6.

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LiteLLM gateway outage breaks RFP Phase 2 | Medium | High | `LLMFallbackChain` with circuit breakers, Phase 2.2 already routes through it |
| Drizzle → asyncpg dual-writer skew during requirements unification | Medium | High | Phase 2.4 uses shadow-write for 14 days before cutover |
| LaTeX environment drift between dev/staging/prod | High | Medium | Ship `latex/Dockerfile` with pinned TeX Live version; run in CI |
| Agent memory table growth unbounded | Medium | Medium | `ttl` column + nightly cleanup job (Phase 3.4) |
| Production soak reveals performance regressions | Medium | High | Phase 6.5 adds Prometheus dashboards; roll back is one env-var flip (`USE_PYTHON_RFP=false`) |
| Schema parity test blocks deploys too aggressively | Low | Medium | Warn-mode first, hard-fail after 2 weeks |
| Commented-code sweep (5.9) removes live code | Low | High | Run behind a branch; require a second-pair review on every deletion |

---

## 8. Appendix: File-Level Change Index

**Create (18 files)**
1. `src/docfusion/api/endpoints/rfp_endpoints.py`
2. `src/docfusion/api/endpoints/discovery_endpoints.py`
3. `src/docfusion/agents/core/protocols.py`
4. `src/docfusion/agents/memory/persistent_store.py`
5. `src/docfusion/document_engine/latex/compiler.py`
6. `src/docfusion/orchestration/proposal_orchestrator.py`
7. `src/docfusion/core/errors.py`
8. `tests/ci/test_rfp_pipeline_e2e.py`
9. `tests/ci/test_agent_dispatch.py`
10. `tests/ci/test_latex_render.py`
11. `tests/ci/test_schema_parity.py`
12. `tests/ci/test_auth_flows.py`
13. `tests/ci/test_workflow_core.py`
14. `pyrightconfig.json`
15. `migrations/versions/NNNN_compliance_matrix_tables.py`
16. `migrations/versions/NNNN_agent_memory_table.py`
17. `frontend/drizzle/XXXX_unify_requirements.sql`
18. `docs/technical/design_decisions/2026-04-22-ai-agents-placeholder.md`

**Modify (primary targets, not exhaustive)**
1. `src/docfusion/config/secrets.py` — centralize Docling + LiteLLM config
2. `src/docfusion/rfp/requirement_extractor.py` — AI enhancement, centralized config
3. `src/docfusion/rfp/rfp_analyzer.py` — AI-powered analysis
4. `src/docfusion/rfp/compliance_matrix.py` — DB persistence
5. `src/docfusion/rfp/stakeholder_mapper.py` — LiteLLM routing
6. `src/docfusion/agents/core/agent.py` — kill 5 stubs, implement defaults
7. `src/docfusion/agents/communication/channels.py` — implement 4 channel types
8. `src/docfusion/workflow/integration/nlp_workflow_integration.py` — 2 stubs
9. `src/docfusion/workflow/integration/agents_workflow_integration.py` — 4 stubs
10. `src/docfusion/workflow/integration/workflow_document_bridge.py` — 1 stub
11. `src/docfusion/document_engine/git_latex_manager.py` — wire compiler
12. `src/docfusion/document_engine/formatter/style_applier.py` — log-init stub
13. `src/docfusion/composition/interpreter.py` — merge stub
14. `src/docfusion/visualization/renderers/svg_renderer.py` — 5 stubs
15. `src/docfusion/api/health/health_checks.py` — healthcheck stub
16. `src/docfusion/discovery/__init__.py` — capability flags
17. `src/docfusion/api/dependencies.py` — register new endpoints
18. `frontend/app/api/v1/rfp/upload/route.ts` — proxy to FastAPI
19. `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — call FastAPI, drop simulate
20. `frontend/lib/actions/requirements.ts` — target `rfpRequirements`
21. `frontend/app/(app)/opportunities/[id]/requirements/page.tsx`
22. `frontend/app/(app)/opportunities/[id]/requirements/RequirementExtractor.tsx`
23. `frontend/components/opportunities/OpportunityHeaderActions.tsx` — convert-to-RFP
24. `pyproject.toml` — complexity rules + coverage gates
25. `.pre-commit-config.yaml` — regex bans

**Delete or ADR-dispose**
- `src/docfusion/ai_agents/README.md` + directory (per ADR)
- `simulateParsingJob` in `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`
- `frontend/lib/db/schema-requirements-legacy.ts` (after Phase 6.4 soak)

---

## 9. Tracking

- Each ID in §2 becomes a Backlog task (`backlog task create ...`). Exact IDs retained as labels.
- Phase gates become Backlog milestones.
- A single `STATUS.md` at repo root tracks phase progress, updated weekly.
- Commit messages reference IDs: `feat(rfp): enable AI enhancement [G-RFP-01]`.

---

## 10. Review and Ownership

This plan is a draft until:
1. Platform engineering lead signs off on sequencing.
2. Security review signs off on Phase 1 + Phase 6 gates.
3. Product signs off on Phase 2 timeline (gated the RFP pipeline cutover).

Changes to this plan go through the same ADR process as any architectural decision. Update `docs/technical/design_decisions/` with an entry whenever a phase scope changes.
