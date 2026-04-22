
## Implementation Notes

**Approach:**
- Created `src/docfusion/api/endpoints/rfp_endpoints.py` with 6 endpoints: upload, parse, status (SSE), requirements list, compliance matrix generation, and entry update.
- Created `src/docfusion/api/endpoints/discovery_endpoints.py` with 6 endpoints: run source, list opportunities, get opportunity, ingest opportunity, list sources, and health.
- Registered both routers in `src/docfusion/api/main.py` via `app.include_router()`.
- Added `CAPABILITIES` dict to `src/docfusion/discovery/__init__.py` with dynamic capability detection based on import outcomes.
- Updated `frontend/app/api/v1/rfp/upload/route.ts` to proxy to FastAPI when `USE_PYTHON_RFP` is not `false`, with fallback to existing Drizzle logic.
- Updated `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` to call FastAPI `/api/v1/rfp/{id}/parse` when `USE_PYTHON_RFP` is enabled, falling back to `processRfpParsingJob` server action when disabled.
- Removed `simulateParsingJob` from the parse route entirely.
- Created `tests/ci/test_rfp_pipeline_e2e.py` with 8 passing tests covering all RFP and discovery endpoints.

**Files touched:**
- `src/docfusion/api/endpoints/rfp_endpoints.py` — new
- `src/docfusion/api/endpoints/discovery_endpoints.py` — new
- `src/docfusion/api/main.py` — router registration
- `src/docfusion/discovery/__init__.py` — CAPABILITIES export
- `frontend/app/api/v1/rfp/upload/route.ts` — FastAPI proxy
- `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` — FastAPI proxy + fallback
- `tests/ci/test_rfp_pipeline_e2e.py` — 8 e2e tests

**Unexpected findings:**
- `APIApplication.create_app()` fails to import due to missing `create_security_manager` in `docfusion.security`. Worked around by testing routers directly against a plain `FastAPI()` app.
- `processRfpParsingJob` already existed in `frontend/lib/actions/rfp-parser.ts` — the parse route now delegates to it for the legacy fallback path.

**Deviations from plan:**
- Used plain `APIRouter` function-based endpoints instead of class-based `DocumentEndpoints` pattern, since the RFP endpoints don't require injected service instances.
- SSE status endpoint returns a single "ready" event as a placeholder; full job-status streaming deferred to a follow-up task.
