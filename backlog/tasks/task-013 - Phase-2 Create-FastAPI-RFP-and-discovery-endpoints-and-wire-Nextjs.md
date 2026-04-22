---
id: task-013
title: "Phase 2: Create FastAPI RFP + discovery endpoints and wire Next.js to them"
status: To Do
phase: 2
gap_ids: [G-API-01, G-API-02, G-API-03, G-DATA-02]
priority: Critical
dependencies: [task-008, task-009, task-010, task-011, task-012]
---

# task-013 - Phase 2: Create FastAPI RFP + discovery endpoints and wire Next.js to them

## Description (the why)

Python RFP modules today are isolated from the web tier. Next.js uses a `simulateParsingJob` stub instead of calling Python. This task exposes the RFP and discovery pipelines over HTTP and replaces the simulation. It also wires a discovery→ingestion bridge so downloaded opportunity documents can flow into RFP parsing without a manual re-upload.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/api/endpoints/rfp_endpoints.py` exists with six endpoints (see plan §3.1).
- [ ] `src/docfusion/api/endpoints/discovery_endpoints.py` exists with six endpoints (see plan §3.2).
- [ ] Both routers are registered in `src/docfusion/api/dependencies.py` and `src/docfusion/api/main.py`.
- [ ] `frontend/app/api/v1/rfp/upload/route.ts` proxies file uploads to `POST /api/v1/rfp/upload` on FastAPI.
- [ ] `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` calls `POST /api/v1/rfp/{id}/parse` — `simulateParsingJob` is deleted.
- [ ] Feature flag `USE_PYTHON_RFP=true` (default true) selects the Python path; `=false` keeps the legacy server-action fallback.
- [ ] End-to-end test in `tests/ci/test_rfp_pipeline_e2e.py` runs: upload → parse → requirements populated → compliance matrix generated → discovery ingest into RFP.

## Implementation Plan (the how)

**Step 1: Create `src/docfusion/api/endpoints/rfp_endpoints.py`.**

```python
"""FastAPI endpoints for the RFP ingestion pipeline."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from docfusion.core.utils import uuid7str
from docfusion.rfp.requirement_extractor import RequirementExtractor
from docfusion.rfp.rfp_analyzer import RFPAnalyzer
from docfusion.rfp.compliance_matrix import ComplianceMatrixGenerator
from docfusion.storage.secure_storage import SecureStorageService
from docfusion.api.dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/v1/rfp", tags=["rfp"])


class UploadResponse(BaseModel):
	model_config = ConfigDict(extra='forbid')
	rfp_id: str
	filename: str
	size: int


@router.post("/upload", response_model=UploadResponse)
async def upload_rfp(
	file: UploadFile = File(...),
	user: dict = Depends(get_current_user),
	session: AsyncSession = Depends(get_db),
	storage: SecureStorageService = Depends(),
) -> UploadResponse:
	rfp_id = uuid7str()
	contents = await file.read()
	await storage.put(f"rfp/{rfp_id}/{file.filename}", contents)
	# Persist the rfp_documents row — adjust column names to match schema.
	# ...
	return UploadResponse(rfp_id=rfp_id, filename=file.filename, size=len(contents))


@router.post("/{rfp_id}/parse")
async def parse_rfp(
	rfp_id: str,
	session: AsyncSession = Depends(get_db),
) -> dict:
	# 1. Load document text via DoclingService.
	# 2. Extract requirements.
	extractor = RequirementExtractor(ai_enhancement=True)
	text = await _load_rfp_text(rfp_id, session)
	requirements = await extractor.extract(text)

	# 3. Persist requirements.
	await _persist_requirements(rfp_id, requirements, session)

	# 4. Analyze.
	analyzer = RFPAnalyzer(ai_enhancement=True)
	analysis = await analyzer.analyze(text, requirements)

	return {"rfp_id": rfp_id, "requirement_count": len(requirements), "analysis_id": analysis.id}


@router.get("/{rfp_id}/status")
async def stream_status(rfp_id: str):
	async def event_stream():
		# Yield SSE events reading rfp_parsing_jobs rows.
		yield f"data: {{'rfp_id': '{rfp_id}', 'status': 'ready'}}\n\n"
	return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{rfp_id}/requirements")
async def list_requirements(rfp_id: str, session: AsyncSession = Depends(get_db)) -> list[dict]:
	from sqlalchemy import text
	rows = await session.execute(
		text("SELECT * FROM rfp_requirements WHERE rfp_document_id = :rid"),
		{"rid": rfp_id},
	)
	return [dict(r) for r in rows.mappings().all()]


@router.post("/{rfp_id}/compliance-matrix")
async def generate_matrix(rfp_id: str, session: AsyncSession = Depends(get_db)) -> dict:
	requirements = await _load_requirements(rfp_id, session)
	gen = ComplianceMatrixGenerator(rfp_id=rfp_id)
	gen.generate_from_requirements(requirements)
	matrix_id = await gen.save_to_db(session)
	return {"matrix_id": matrix_id, "entry_count": len(gen.entries)}


@router.patch("/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}")
async def update_entry(
	rfp_id: str,
	matrix_id: str,
	entry_id: str,
	update: dict,
	session: AsyncSession = Depends(get_db),
) -> dict:
	from sqlalchemy import text
	await session.execute(
		text("UPDATE compliance_entries SET status = :s, response = :r WHERE id = :eid"),
		{"s": update.get("status"), "r": update.get("response"), "eid": entry_id},
	)
	await session.commit()
	return {"ok": True}


async def _load_rfp_text(rfp_id: str, session: AsyncSession) -> str:
	# Implementation left as helper — delegate to DoclingService on the file you stored in /upload.
	...


async def _persist_requirements(rfp_id: str, requirements, session: AsyncSession) -> None:
	...


async def _load_requirements(rfp_id: str, session: AsyncSession):
	...
```

Fill in the `...` helpers using the patterns established in tasks 008-011.

**Step 2: Create `src/docfusion/api/endpoints/discovery_endpoints.py`.**

```python
"""FastAPI endpoints for opportunity discovery."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from docfusion.api.dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/v1/discovery", tags=["discovery"])


@router.post("/run/{source}")
async def run_source(source: str, user: dict = Depends(get_current_user)) -> dict:
	from docfusion.discovery.orchestrator import ScrapingOrchestrator
	orchestrator = ScrapingOrchestrator()
	result = await orchestrator.run_source(source)
	return {"source": source, "opportunities_found": result.count}


@router.get("/opportunities")
async def list_opportunities(session: AsyncSession = Depends(get_db)) -> list[dict]:
	from sqlalchemy import text
	rows = await session.execute(text("SELECT * FROM opportunities ORDER BY created_at DESC LIMIT 100"))
	return [dict(r) for r in rows.mappings().all()]


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity(opportunity_id: str, session: AsyncSession = Depends(get_db)) -> dict:
	from sqlalchemy import text
	row = (await session.execute(
		text("SELECT * FROM opportunities WHERE id = :oid"),
		{"oid": opportunity_id},
	)).mappings().first()
	if row is None:
		from fastapi import HTTPException
		raise HTTPException(404, "Not found")
	return dict(row)


@router.post("/opportunities/{opportunity_id}/ingest")
async def ingest_opportunity(
	opportunity_id: str,
	session: AsyncSession = Depends(get_db),
) -> dict:
	"""Copy opportunity_documents to rfp_documents and trigger parse."""
	from sqlalchemy import text
	doc = (await session.execute(
		text("""
			SELECT * FROM opportunity_documents
			WHERE opportunity_id = :oid
			ORDER BY created_at DESC LIMIT 1
		"""),
		{"oid": opportunity_id},
	)).mappings().first()
	if doc is None:
		from fastapi import HTTPException
		raise HTTPException(404, "No documents for opportunity")

	from docfusion.core.utils import uuid7str
	rfp_id = uuid7str()
	await session.execute(
		text("""
			INSERT INTO rfp_documents (id, opportunity_id, filename, content, extracted_text)
			VALUES (:id, :oid, :fn, :content, :text)
		"""),
		{"id": rfp_id, "oid": opportunity_id, "fn": doc["filename"], "content": doc["content"], "text": doc["extracted_text"]},
	)
	await session.commit()
	# Trigger parse asynchronously (fire and forget).
	# ...
	return {"rfp_id": rfp_id, "source": "discovery"}


@router.get("/sources")
async def list_sources() -> list[dict]:
	from docfusion.discovery.orchestrator import ScrapingOrchestrator
	return ScrapingOrchestrator().available_sources()


@router.get("/health")
async def discovery_health() -> dict:
	from docfusion.discovery import CAPABILITIES
	return {"capabilities": CAPABILITIES, "status": "ok" if all(CAPABILITIES.values()) else "degraded"}
```

**Step 3: Register routers.** In `src/docfusion/api/main.py` or `app.py`:

```python
from docfusion.api.endpoints.rfp_endpoints import router as rfp_router
from docfusion.api.endpoints.discovery_endpoints import router as discovery_router

app.include_router(rfp_router)
app.include_router(discovery_router)
```

**Step 4: Update Next.js upload route.** Replace the file in `frontend/app/api/v1/rfp/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
	if (process.env.USE_PYTHON_RFP === 'false') {
		return NextResponse.json({ error: 'Python RFP pipeline disabled' }, { status: 503 });
	}
	const formData = await request.formData();
	const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/upload`, {
		method: 'POST',
		body: formData,
	});
	const data = await response.json();
	return NextResponse.json(data, { status: response.status });
}
```

**Step 5: Update parse route.** Replace `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processRfpParsingJob } from '@/lib/actions/rfp-parser';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(
	request: NextRequest,
	{ params }: { params: { rfpId: string } },
) {
	if (process.env.USE_PYTHON_RFP !== 'false') {
		const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/${params.rfpId}/parse`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});
		return NextResponse.json(await response.json(), { status: response.status });
	}
	// Fallback to existing server action.
	const result = await processRfpParsingJob(params.rfpId);
	return NextResponse.json(result);
}
```

Delete all references to `simulateParsingJob`. Confirm:
```bash
grep -rn "simulateParsingJob" frontend/
# Expected: 0.
```

**Step 6: End-to-end test.**

```python
# tests/ci/test_rfp_pipeline_e2e.py
"""End-to-end: upload -> parse -> requirements -> compliance -> discovery ingest."""

import pytest
from httpx import AsyncClient

from docfusion.api.main import app


async def test_full_pipeline(sample_rfp_pdf_bytes, db_session):
	async with AsyncClient(app=app, base_url="http://test") as client:
		# 1. Upload.
		files = {"file": ("sample.pdf", sample_rfp_pdf_bytes, "application/pdf")}
		upload = await client.post("/api/v1/rfp/upload", files=files)
		assert upload.status_code == 200
		rfp_id = upload.json()["rfp_id"]

		# 2. Parse.
		parse = await client.post(f"/api/v1/rfp/{rfp_id}/parse")
		assert parse.status_code == 200
		assert parse.json()["requirement_count"] > 0

		# 3. List requirements.
		reqs = await client.get(f"/api/v1/rfp/{rfp_id}/requirements")
		assert reqs.status_code == 200
		assert len(reqs.json()) > 0

		# 4. Compliance matrix.
		matrix = await client.post(f"/api/v1/rfp/{rfp_id}/compliance-matrix")
		assert matrix.status_code == 200
		assert matrix.json()["entry_count"] > 0
```

**Step 7: Verify + commit.**
```bash
uv run pytest tests/ci/test_rfp_pipeline_e2e.py -vxs

git add src/docfusion/api/ frontend/app/api/ tests/ci/test_rfp_pipeline_e2e.py
git commit -m "feat(api): FastAPI RFP+discovery endpoints and Next.js cutover [G-API-01][G-API-02][G-API-03][G-DATA-02]"
```

## Notes for less-capable agents

- If `DoclingService` is already imported in `requirement_extractor.py`, reuse it — do not re-instantiate in the endpoint.
- Keep the feature flag default `USE_PYTHON_RFP=true` in `.env.example`. Document the 7-day soak in a PR description.
- The SSE status endpoint is a placeholder. Implementing real SSE from `rfp_parsing_jobs` rows is acceptable to defer — create a follow-up task if you defer.
- Do NOT forget to add the `fastapi`, `httpx`, and `sqlalchemy[asyncio]` deps if they're missing.
