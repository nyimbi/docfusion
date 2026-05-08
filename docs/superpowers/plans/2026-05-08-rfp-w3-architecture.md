# RFP Pipeline W3 — Architecture: Wire FastAPI to Real Modules; Move Parse to Temporal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** W0 + W1 + W2 must be merged. Tenant scoping, atomic parses, and the AI prompt envelope are assumed.

**Goal:** Stop the FastAPI handlers from being theatre and stop running the parse pipeline on the request thread. After W3 ships:
- `POST /api/v1/rfp/upload` (FastAPI side) writes the bytes to `SecureStorageService` and creates a real `rfp_documents` row.
- `POST /api/v1/rfp/{id}/parse` (FastAPI side) runs the real `RFPAnalyzer.analyze_pdf` against the stored bytes.
- `GET /api/v1/rfp/{id}/requirements` returns rows from Postgres scoped to the caller's organization.
- `POST/PATCH /api/v1/compliance-matrix/...` drive the real `ComplianceMatrixGenerator` and persist via `save_to_db`.
- The Next.js `/parse` route enqueues a Temporal workflow; a worker process executes the pipeline, surviving serverless cold-starts.
- The DoclingService client uses the correct multipart endpoint, the spaCy import bug is fixed, and `stakeholder_mapper.py` Pydantic-ifies the dataclasses that previously had ghost-field bugs.

**Architecture:**
- FastAPI handlers in `src/docfusion/api/endpoints/rfp_endpoints.py` adopt a tenant header (`x-docfusion-organization-id`) and a corresponding dependency (`require_tenant`). Every query and mutation includes the org predicate, mirroring the Next.js side.
- A new Temporal worker package `src/docfusion/workers/rfp_parse/` defines a `RfpParseWorkflow` with a single activity `parse_rfp_document`. The activity wraps the existing `processRfpParsingJob` logic — the worker calls into a Python service that owns the parse pipeline, OR a Node-side worker that imports `processRfpParsingJob` directly. The plan picks the Node-side option to minimise duplication; if the org standardises on Python workers later, the activity is small enough to port.
- The Next.js `/parse` route invokes a thin `enqueueRfpParse(...)` helper that submits a Temporal `signalWithStart` instead of running the action inline.
- DoclingService client switches to `POST /v1alpha/convert/file` with multipart `files` (matching `docling-cdn-workaround` memory note). spaCy import is corrected.

**Tech Stack:** FastAPI, Pydantic v2, psycopg, Temporal Python SDK + TypeScript SDK, docling-serve.

---

### Task 1: FastAPI — `require_tenant` dependency

**Files:**
- Create: `src/docfusion/api/dependencies/tenant.py`
- Test: `tests/ci/test_api_tenant_dependency.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_api_tenant_dependency.py
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from docfusion.api.dependencies.tenant import TenantContext, require_tenant


def _make_app():
	app = FastAPI()

	@app.get("/_t")
	def t(ctx: TenantContext = Depends(require_tenant)):
		return {"userId": ctx.user_id, "organizationId": ctx.organization_id}

	return TestClient(app)


def test_returns_401_without_user_header():
	r = _make_app().get("/_t", headers={"x-docfusion-organization-id": "o"})
	assert r.status_code == 401


def test_returns_403_without_org_header():
	r = _make_app().get("/_t", headers={"x-docfusion-user-id": "u"})
	assert r.status_code == 403


def test_returns_context_when_both_headers_set():
	r = _make_app().get(
		"/_t",
		headers={
			"x-docfusion-user-id": "u",
			"x-docfusion-organization-id": "o",
		},
	)
	assert r.status_code == 200
	assert r.json() == {"userId": "u", "organizationId": "o"}
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_api_tenant_dependency.py -v
```

- [ ] **Step 3: Implement the dependency**

```python
# src/docfusion/api/dependencies/tenant.py
"""Tenant dependency for FastAPI route handlers.

The Next.js BFF proxies requests to FastAPI and injects the resolved tenant
identity via two headers. FastAPI never inspects the user's session cookie
directly — the BFF is the trust boundary.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException, status


@dataclass(frozen=True, slots=True)
class TenantContext:
	user_id: str
	organization_id: str


def require_tenant(
	x_docfusion_user_id: str | None = Header(default=None),
	x_docfusion_organization_id: str | None = Header(default=None),
) -> TenantContext:
	"""Resolve the calling user and organization from BFF-injected headers.

	Raises 401 if user is missing, 403 if user is set but org is missing.
	"""
	if not x_docfusion_user_id:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
	if not x_docfusion_organization_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN, detail="No organization context"
		)
	return TenantContext(
		user_id=x_docfusion_user_id,
		organization_id=x_docfusion_organization_id,
	)
```

- [ ] **Step 4: Run test to verify PASS**

```bash
uv run pytest tests/ci/test_api_tenant_dependency.py -v
```

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/api/dependencies/tenant.py tests/ci/test_api_tenant_dependency.py
git commit -m "feat(api): add require_tenant FastAPI dependency"
```

---

### Task 2: FastAPI `/upload` — real storage + real DB insert

**Files:**
- Modify: `src/docfusion/api/endpoints/rfp_endpoints.py` (`upload_rfp`, lines 47-...)
- Test: `tests/ci/test_rfp_endpoints_upload.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_rfp_endpoints_upload.py
import io

from fastapi.testclient import TestClient

from docfusion.api.main import app


def test_upload_persists_bytes_and_creates_row(monkeypatch):
	stored: dict[str, bytes] = {}

	# Patch SecureStorageService.write so we don't hit real object storage.
	from docfusion.storage import secure_storage_service

	async def fake_write(self, *, key, data, content_type):
		stored[key] = data
		return {"key": key, "etag": "test", "size": len(data)}

	monkeypatch.setattr(
		secure_storage_service.SecureStorageService, "write", fake_write
	)

	client = TestClient(app)
	r = client.post(
		"/api/v1/rfp/upload",
		headers={
			"x-docfusion-user-id": "u",
			"x-docfusion-organization-id": "o",
		},
		files={"file": ("rfp.pdf", b"%PDF-1.4 hello", "application/pdf")},
	)
	assert r.status_code == 201, r.text
	body = r.json()
	assert body["organizationId"] == "o"
	assert body["filename"] == "rfp.pdf"
	assert any(v == b"%PDF-1.4 hello" for v in stored.values())
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_rfp_endpoints_upload.py -v
```

- [ ] **Step 3: Replace the stub upload handler**

In `src/docfusion/api/endpoints/rfp_endpoints.py`:

```python
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..dependencies.tenant import TenantContext, require_tenant
from ...core.utils import uuid7str
from ...storage.secure_storage_service import SecureStorageService

# (keep existing imports above)


@rfp_router.post("/upload", status_code=201)
async def upload_rfp(
	file: UploadFile = File(...),
	ctx: TenantContext = Depends(require_tenant),
):
	"""Persist the uploaded RFP bytes and create the rfp_documents row."""
	if not file.filename:
		raise HTTPException(status_code=400, detail="filename is required")

	data = await file.read()
	if len(data) == 0:
		raise HTTPException(status_code=400, detail="file is empty")

	file_hash = hashlib.sha256(data).hexdigest()
	doc_id = uuid7str()
	storage_key = f"orgs/{ctx.organization_id}/rfp/{doc_id}/{file.filename}"

	storage = SecureStorageService()
	await storage.write(
		key=storage_key, data=data, content_type=file.content_type or "application/octet-stream"
	)

	# Insert via the existing async DB helper used elsewhere in the project.
	from ...db.session import get_pool

	pool = await get_pool()
	async with pool.connection() as conn:
		await conn.execute(
			"""
			INSERT INTO rfp_documents (
				id, organization_id, filename, file_type, file_size,
				storage_path, file_hash, parsing_status, uploaded_by,
				created_at, updated_at
			) VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)
			""",
			(
				doc_id,
				ctx.organization_id,
				file.filename,
				(file.content_type or "application/octet-stream").split("/")[-1],
				len(data),
				storage_key,
				file_hash,
				ctx.user_id,
				datetime.now(timezone.utc),
				datetime.now(timezone.utc),
			),
		)
		await conn.commit()

	return {
		"rfpDocumentId": doc_id,
		"organizationId": ctx.organization_id,
		"filename": file.filename,
		"fileSize": len(data),
		"storagePath": storage_key,
		"fileHash": file_hash,
	}
```

If `db.session.get_pool` does not exist in the codebase, use whichever async psycopg / asyncpg pool the project already exposes (look at `src/docfusion/api/main.py` for the canonical pattern). Do not introduce a new pool here.

- [ ] **Step 4: Run test to verify PASS**

```bash
uv run pytest tests/ci/test_rfp_endpoints_upload.py -v
```

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/api/endpoints/rfp_endpoints.py tests/ci/test_rfp_endpoints_upload.py
git commit -m "feat(api): wire /rfp/upload to real storage + DB"
```

---

### Task 3: FastAPI `/parse` — real RFPAnalyzer call against stored bytes

**Files:**
- Modify: `src/docfusion/api/endpoints/rfp_endpoints.py` (`parse_rfp`)
- Test: `tests/ci/test_rfp_endpoints_parse.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_rfp_endpoints_parse.py
from fastapi.testclient import TestClient

from docfusion.api.main import app


def test_parse_runs_real_analyzer(monkeypatch, tmp_path):
	# Stub the storage read to return a small text RFP.
	from docfusion.storage import secure_storage_service

	async def fake_read(self, *, key):
		return b"Section L.1 The contractor shall provide 24/7 support."

	monkeypatch.setattr(
		secure_storage_service.SecureStorageService, "read", fake_read
	)

	# Stub the analyzer to a deterministic result so the test does not depend on AI.
	from docfusion.rfp import rfp_analyzer

	async def fake_analyze(self, text, **_kw):
		from docfusion.rfp.rfp_analyzer import RFPAnalysisResult
		from docfusion.rfp.requirement_extractor import (
			Requirement, RequirementModality, RequirementCategory,
		)
		return RFPAnalysisResult(
			success=True,
			requirements=[
				Requirement(
					text="The contractor shall provide 24/7 support",
					modality=RequirementModality.MANDATORY,
					category=RequirementCategory.TECHNICAL,
				)
			],
		)

	monkeypatch.setattr(rfp_analyzer.RFPAnalyzer, "analyze_text", fake_analyze)

	client = TestClient(app)
	r = client.post(
		"/api/v1/rfp/some-doc-id/parse",
		headers={
			"x-docfusion-user-id": "u",
			"x-docfusion-organization-id": "o",
		},
	)
	assert r.status_code in (200, 202), r.text
	body = r.json()
	assert body["requirementsExtracted"] >= 1
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_rfp_endpoints_parse.py -v
```

- [ ] **Step 3: Replace the fixture-returning stub**

```python
@rfp_router.post("/{rfp_id}/parse")
async def parse_rfp(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
):
	from ...db.session import get_pool

	pool = await get_pool()
	async with pool.connection() as conn:
		row = await (
			await conn.execute(
				"SELECT storage_path FROM rfp_documents WHERE id = %s AND organization_id = %s",
				(rfp_id, ctx.organization_id),
			)
		).fetchone()
		if row is None:
			raise HTTPException(status_code=404, detail="Not found")
		storage_path = row[0]

	storage = SecureStorageService()
	raw = await storage.read(key=storage_path)
	text = raw.decode("utf-8", errors="replace")

	from ...rfp.rfp_analyzer import RFPAnalyzer

	analyzer = RFPAnalyzer(config={"ai_enhancement": True})
	result = await analyzer.analyze_text(text)

	# Persist requirements with org scoping.
	async with pool.connection() as conn:
		async with conn.transaction():
			await conn.execute(
				"DELETE FROM rfp_requirements WHERE rfp_document_id = %s AND organization_id = %s",
				(rfp_id, ctx.organization_id),
			)
			for req in result.requirements:
				await conn.execute(
					"""
					INSERT INTO rfp_requirements (
						id, organization_id, rfp_document_id, requirement_text,
						priority, category, compliance_status, created_at, updated_at
					) VALUES (%s, %s, %s, %s, %s, %s, 'not_addressed', NOW(), NOW())
					""",
					(
						req.id,
						ctx.organization_id,
						rfp_id,
						req.text,
						req.modality.value,  # modality maps to TS `priority`
						req.category.value,
					),
				)

	return {
		"rfpDocumentId": rfp_id,
		"requirementsExtracted": len(result.requirements),
	}
```

Note the deliberate `req.modality.value → priority` and `req.category.value → category` mapping — this is the contract W0 set up.

- [ ] **Step 4: Run test to verify PASS**

```bash
uv run pytest tests/ci/test_rfp_endpoints_parse.py -v
```

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/api/endpoints/rfp_endpoints.py tests/ci/test_rfp_endpoints_parse.py
git commit -m "feat(api): wire /rfp/{id}/parse to RFPAnalyzer + DB"
```

---

### Task 4: FastAPI `/{id}/requirements` and compliance-matrix — real DB queries

**Files:**
- Modify: `src/docfusion/api/endpoints/rfp_endpoints.py` (`list_requirements`, compliance handlers)
- Test: `tests/ci/test_rfp_endpoints_reads.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/ci/test_rfp_endpoints_reads.py
from fastapi.testclient import TestClient
from docfusion.api.main import app


def test_list_requirements_returns_db_rows(seeded_db):  # fixture inserts 2 reqs
	client = TestClient(app)
	r = client.get(
		f"/api/v1/rfp/{seeded_db.rfp_id}/requirements",
		headers={
			"x-docfusion-user-id": seeded_db.user_id,
			"x-docfusion-organization-id": seeded_db.organization_id,
		},
	)
	assert r.status_code == 200
	body = r.json()
	assert body["total"] == 2
	assert len(body["requirements"]) == 2


def test_list_requirements_returns_empty_for_other_org():
	client = TestClient(app)
	r = client.get(
		"/api/v1/rfp/nonexistent/requirements",
		headers={
			"x-docfusion-user-id": "u",
			"x-docfusion-organization-id": "different-org",
		},
	)
	assert r.status_code == 404
```

The `seeded_db` fixture should live in `tests/ci/conftest.py` and insert minimal `rfp_documents` + `rfp_requirements` rows scoped to a known org.

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_rfp_endpoints_reads.py -v
```

- [ ] **Step 3: Implement real handlers**

```python
@rfp_router.get("/{rfp_id}/requirements")
async def list_requirements(
	rfp_id: str,
	page: int = 1,
	page_size: int = 50,
	ctx: TenantContext = Depends(require_tenant),
):
	from ...db.session import get_pool

	pool = await get_pool()
	async with pool.connection() as conn:
		# Confirm the document is in the caller's org.
		exists = await (
			await conn.execute(
				"SELECT 1 FROM rfp_documents WHERE id = %s AND organization_id = %s",
				(rfp_id, ctx.organization_id),
			)
		).fetchone()
		if not exists:
			raise HTTPException(status_code=404, detail="Not found")

		total_row = await (
			await conn.execute(
				"SELECT COUNT(*) FROM rfp_requirements WHERE rfp_document_id = %s AND organization_id = %s",
				(rfp_id, ctx.organization_id),
			)
		).fetchone()
		total = int(total_row[0])

		rows = await (
			await conn.execute(
				"""
				SELECT id, requirement_number, title, requirement_text,
				       category, priority, compliance_status, extraction_confidence
				FROM rfp_requirements
				WHERE rfp_document_id = %s AND organization_id = %s
				ORDER BY requirement_number NULLS LAST
				LIMIT %s OFFSET %s
				""",
				(rfp_id, ctx.organization_id, page_size, (page - 1) * page_size),
			)
		).fetchall()

	return {
		"total": total,
		"page": page,
		"pageSize": page_size,
		"requirements": [
			{
				"id": r[0],
				"requirementNumber": r[1],
				"title": r[2],
				"requirementText": r[3],
				"category": r[4],
				"priority": r[5],
				"complianceStatus": r[6],
				"extractionConfidence": float(r[7]) if r[7] is not None else None,
			}
			for r in rows
		],
	}
```

For the compliance-matrix endpoints, replace the in-memory stubs with calls to `ComplianceMatrixGenerator` and persist via `save_to_db`. Pattern:

```python
@rfp_router.post("/{rfp_id}/compliance-matrix")
async def create_compliance_matrix(
	rfp_id: str,
	ctx: TenantContext = Depends(require_tenant),
):
	from ...rfp.compliance_matrix import ComplianceMatrixGenerator

	gen = ComplianceMatrixGenerator()
	matrix = await gen.generate_for_document(
		rfp_document_id=rfp_id, organization_id=ctx.organization_id
	)
	await gen.save_to_db(matrix, organization_id=ctx.organization_id)
	return {"matrixId": matrix.id, "entryCount": len(matrix.entries)}


@rfp_router.patch("/compliance-matrix/{matrix_id}/entries/{entry_id}")
async def update_compliance_entry(
	matrix_id: str,
	entry_id: str,
	body: dict,
	ctx: TenantContext = Depends(require_tenant),
):
	from ...rfp.compliance_matrix import ComplianceMatrixGenerator

	gen = ComplianceMatrixGenerator()
	updated = await gen.update_entry_persistent(
		matrix_id=matrix_id,
		entry_id=entry_id,
		patch=body,
		organization_id=ctx.organization_id,
	)
	if updated is None:
		raise HTTPException(status_code=404, detail="Not found")
	return updated.model_dump()
```

If `ComplianceMatrixGenerator` does not yet expose `generate_for_document` / `update_entry_persistent` accepting `organization_id`, add them — the persistence routines already exist (`save_to_db` at `compliance_matrix.py:1075`); the wrapper is small.

- [ ] **Step 4: Run tests + the broader API suite**

```bash
uv run pytest tests/ci/test_rfp_endpoints_reads.py tests/ci/test_rfp_endpoints_parse.py tests/ci/test_rfp_endpoints_upload.py -v
```

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/api/endpoints/rfp_endpoints.py \
        src/docfusion/rfp/compliance_matrix.py \
        tests/ci/test_rfp_endpoints_reads.py \
        tests/ci/conftest.py
git commit -m "feat(api): wire /requirements + compliance-matrix to DB + generator"
```

---

### Task 5: BFF — pass tenant headers through to FastAPI

**Files:**
- Modify: `frontend/app/api/v1/rfp/upload/route.ts` (already passes `x-docfusion-user-id`; add org header)
- Modify: `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`
- Modify: any other Next.js call site that proxies to `${FASTAPI_URL}/api/v1/rfp/...`

- [ ] **Step 1: Add `x-docfusion-organization-id` header on every proxy call**

For each call site, wherever the fetch builds headers, add:

```typescript
headers: {
	"x-docfusion-user-id": ctx.userId,
	"x-docfusion-organization-id": ctx.organizationId,
	"content-type": request.headers.get("content-type") ?? "application/octet-stream",
},
```

The audit High #10 specifically called out `parse/route.ts:68-74` for forwarding without `x-docfusion-user-id`. After this task, both headers are mandatory on every FastAPI proxy.

- [ ] **Step 2: Add a regression test**

```typescript
// frontend/__tests__/api/rfp-fastapi-headers.test.ts
import { describe, it, expect, vi } from "vitest";

describe("FastAPI proxy headers", () => {
	it("/parse proxy forwards both tenant headers", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({}), { status: 200 }),
		);

		const { setupRfpDoc, callParse } = await import("@/__tests__/helpers/rfp");
		const { docId, ctx } = await setupRfpDoc({ requireFastApi: true });
		await callParse({ docId, ctx });

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const h = new Headers(init.headers);
		expect(h.get("x-docfusion-user-id")).toBe(ctx.userId);
		expect(h.get("x-docfusion-organization-id")).toBe(ctx.organizationId);
	});
});
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx vitest run __tests__/api/rfp-fastapi-headers.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/v1/rfp/upload/route.ts \
        frontend/app/api/v1/rfp/[rfpId]/parse/route.ts \
        frontend/__tests__/api/rfp-fastapi-headers.test.ts
git commit -m "feat(rfp): BFF forwards tenant headers to FastAPI"
```

---

### Task 6: DoclingService client — correct multipart endpoint

**Files:**
- Modify: `src/docfusion/rfp/requirement_extractor.py` (around the existing line 537 `httpx.post`)
- Test: `tests/ci/test_docling_client.py`

- [ ] **Step 1: Write the failing test using `respx`/`pytest-httpserver`**

```python
# tests/ci/test_docling_client.py
import pytest
from pytest_httpserver import HTTPServer

from docfusion.rfp.requirement_extractor import RequirementExtractor


@pytest.mark.asyncio
async def test_uses_v1alpha_convert_endpoint_with_multipart(httpserver: HTTPServer):
	httpserver.expect_request(
		"/v1alpha/convert/file", method="POST"
	).respond_with_json({"document": {"text": "extracted body"}})

	extractor = RequirementExtractor(
		config={"docling_url": httpserver.url_for("").rstrip("/")}
	)
	text = await extractor._call_docling(b"%PDF-1.4 test", filename="t.pdf")
	assert text == "extracted body"
	# Confirm the request was multipart, not raw bytes.
	last = httpserver.log[-1][0]
	assert last.headers.get("content-type", "").startswith("multipart/form-data")
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
uv run pytest tests/ci/test_docling_client.py -v
```

- [ ] **Step 3: Replace the wrong endpoint + payload shape**

In `requirement_extractor.py`, find the existing `httpx.AsyncClient().post(...)` call to docling (around line 537). Replace with:

```python
async def _call_docling(self, pdf_bytes: bytes, *, filename: str = "document.pdf") -> str:
	"""POST the document to docling-serve via multipart and extract the body text."""
	url = self._docling_url.rstrip("/") + "/v1alpha/convert/file"
	files = {"files": (filename, pdf_bytes, "application/pdf")}
	async with httpx.AsyncClient(timeout=60.0) as client:
		resp = await client.post(url, files=files)
		resp.raise_for_status()
		payload = resp.json()
	# docling-serve returns {"document": {"text": "..."}} (or similar) — be defensive.
	doc = payload.get("document") or payload
	return doc.get("text") or doc.get("body", "") or ""
```

Add a `_docling_url` attribute initialised from `config['docling_url']` falling back to `SecretsManager.get('DOCLING_URL', default='http://20.84.71.33:3600')` so existing env hygiene continues to work.

- [ ] **Step 4: Run test to verify PASS**

```bash
uv run pytest tests/ci/test_docling_client.py -v
```

- [ ] **Step 5: Commit**

```bash
git add src/docfusion/rfp/requirement_extractor.py tests/ci/test_docling_client.py
git commit -m "fix(rfp): docling client uses /v1alpha/convert/file multipart"
```

---

### Task 7: spaCy import bug + dataclass→Pydantic in `stakeholder_mapper.py`

**Files:**
- Modify: `src/docfusion/rfp/stakeholder_mapper.py`
- Test: `tests/ci/test_stakeholder_mapper_spacy.py`

- [ ] **Step 1: Fix the import**

At the top of `stakeholder_mapper.py`, replace:

```python
from spacy.matcher import PhraseMatch
```

with:

```python
from spacy.matcher import PhraseMatcher
```

Add a regression test:

```python
# tests/ci/test_stakeholder_mapper_spacy.py
def test_spacy_phrase_matcher_imports_cleanly():
	from docfusion.rfp import stakeholder_mapper

	# When spaCy is installed, HAS_SPACY_SUPPORT must be True.
	import importlib

	spec = importlib.util.find_spec("spacy")
	if spec is None:
		import pytest
		pytest.skip("spaCy not installed")
	assert stakeholder_mapper.HAS_SPACY_SUPPORT is True
```

- [ ] **Step 2: Convert the dataclass shells to Pydantic v2**

Find each `@dataclass` declaration in `stakeholder_mapper.py` (Stakeholder, StakeholderRelationship, StakeholderGraph, StakeholderExtractionResult). For each:

```python
class Stakeholder(BaseModel):
	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	# Keep the existing fields, but make annotations-only fields explicit:
	# the old `methods_used: list[str] = []` outside __init__ becomes:
	# methods_used: list[str] = Field(default_factory=list)
```

Specifically for `StakeholderExtractionResult` (the audit-flagged ghost-fields class):

```python
class StakeholderExtractionResult(BaseModel):
	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	success: bool = False
	stakeholders: list[Stakeholder] = Field(default_factory=list)
	relationships: list[StakeholderRelationship] = Field(default_factory=list)
	graph: StakeholderGraph | None = None
	methods_used: list[str] = Field(default_factory=list)
	statistics: dict[str, Any] = Field(default_factory=dict)
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	processing_time: float = 0.0
```

The line-776 monkey-patch (`result.methods_used = ...`) now writes to a real declared field, so it stops being fragile.

- [ ] **Step 3: Run tests**

```bash
uv run pytest tests/ci/test_stakeholder_mapper_spacy.py tests/ci/test_stakeholder_mapper_litellm.py -v
```

- [ ] **Step 4: Commit**

```bash
git add src/docfusion/rfp/stakeholder_mapper.py tests/ci/test_stakeholder_mapper_spacy.py
git commit -m "fix(rfp): spaCy import + Pydantic-ify stakeholder dataclasses"
```

---

### Task 8: Temporal worker — `RfpParseWorkflow` skeleton

**Files:**
- Create: `frontend/lib/temporal/client.ts` (or extend an existing one if `frontend/lib/temporal/` exists)
- Create: `frontend/lib/temporal/workflows/rfp-parse.ts`
- Create: `frontend/lib/temporal/activities/rfp-parse.ts`
- Create: `frontend/scripts/temporal-worker.ts` (the worker entry point)
- Test: `frontend/__tests__/temporal/rfp-parse-workflow.test.ts`

- [ ] **Step 1: Check whether Temporal is already wired into the project**

```bash
grep -rn "temporal" frontend/package.json frontend/lib --include="*.ts" --include="*.json" | head -20
```

If Temporal is already present (the project's infra docs reference it), use the existing client + worker. If not, add `@temporalio/client`, `@temporalio/worker`, and `@temporalio/workflow` to `frontend/package.json`.

- [ ] **Step 2: Define the workflow**

```typescript
// frontend/lib/temporal/workflows/rfp-parse.ts
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/rfp-parse";

const { runRfpParse } = proxyActivities<typeof activities>({
	startToCloseTimeout: "30 minutes",
	retry: {
		initialInterval: "30 seconds",
		maximumInterval: "5 minutes",
		maximumAttempts: 3,
	},
});

export interface RfpParseWorkflowInput {
	jobId: string;
	rfpDocumentId: string;
	tenantContext: { userId: string; organizationId: string };
}

export async function rfpParseWorkflow(input: RfpParseWorkflowInput): Promise<void> {
	await runRfpParse(input);
}
```

- [ ] **Step 3: Define the activity**

```typescript
// frontend/lib/temporal/activities/rfp-parse.ts
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";
import type { RfpParseWorkflowInput } from "../workflows/rfp-parse";

export async function runRfpParse(input: RfpParseWorkflowInput): Promise<void> {
	await processRfpParsingJob(input);
}
```

- [ ] **Step 4: Define the worker entry**

```typescript
// frontend/scripts/temporal-worker.ts
import { Worker } from "@temporalio/worker";
import * as activities from "@/lib/temporal/activities/rfp-parse";

async function main() {
	const worker = await Worker.create({
		workflowsPath: require.resolve("@/lib/temporal/workflows/rfp-parse"),
		activities,
		taskQueue: "rfp-parse",
	});
	console.log("RFP parse worker starting...");
	await worker.run();
}

main().catch((err) => {
	console.error("Worker fatal", err);
	process.exit(1);
});
```

Add a `package.json` script: `"worker:rfp-parse": "tsx scripts/temporal-worker.ts"`.

- [ ] **Step 5: Define the client helper**

```typescript
// frontend/lib/temporal/client.ts (or extend if it exists)
import { Client, Connection } from "@temporalio/client";

let _client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
	if (_client) return _client;
	const connection = await Connection.connect({
		address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
	});
	_client = new Client({
		connection,
		namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
	});
	return _client;
}

export interface EnqueueRfpParseInput {
	jobId: string;
	rfpDocumentId: string;
	tenantContext: { userId: string; organizationId: string };
}

export async function enqueueRfpParse(input: EnqueueRfpParseInput): Promise<string> {
	const client = await getTemporalClient();
	const handle = await client.workflow.start("rfpParseWorkflow", {
		taskQueue: "rfp-parse",
		workflowId: `rfp-parse-${input.jobId}`,
		args: [input],
	});
	return handle.workflowId;
}
```

- [ ] **Step 6: Add a unit test for the workflow shape**

```typescript
// frontend/__tests__/temporal/rfp-parse-workflow.test.ts
import { describe, it, expect, vi } from "vitest";

describe("rfpParseWorkflow", () => {
	it("calls runRfpParse activity once with the input", async () => {
		const calls: unknown[] = [];
		vi.doMock("../activities/rfp-parse", () => ({
			runRfpParse: async (input: unknown) => {
				calls.push(input);
			},
		}));
		const { rfpParseWorkflow } = await import("@/lib/temporal/workflows/rfp-parse");
		await rfpParseWorkflow({
			jobId: "j",
			rfpDocumentId: "d",
			tenantContext: { userId: "u", organizationId: "o" },
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ jobId: "j", rfpDocumentId: "d" });
	});
});
```

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/temporal frontend/scripts/temporal-worker.ts \
        frontend/__tests__/temporal frontend/package.json
git commit -m "feat(rfp): Temporal RfpParseWorkflow + worker entry"
```

---

### Task 9: `/parse` route — replace fire-and-forget with `enqueueRfpParse`

**Files:**
- Modify: `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`
- Modify: `frontend/lib/services/rfp-document-service.ts` (the discovery bridge call site)
- Test: `frontend/__tests__/api/rfp-parse-enqueue.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/__tests__/api/rfp-parse-enqueue.test.ts
import { describe, it, expect, vi } from "vitest";

describe("/parse enqueues to Temporal instead of running inline", () => {
	it("calls enqueueRfpParse and does NOT call processRfpParsingJob inline", async () => {
		const enqueueSpy = vi.fn().mockResolvedValue("workflow-id");
		const inlineSpy = vi.fn();
		vi.doMock("@/lib/temporal/client", () => ({ enqueueRfpParse: enqueueSpy }));
		vi.doMock("@/lib/actions/rfp-parser", async (orig) => ({
			...(await orig<typeof import("@/lib/actions/rfp-parser")>()),
			processRfpParsingJob: inlineSpy,
		}));

		const { setupRfpDoc, callParse } = await import("@/__tests__/helpers/rfp");
		const { docId, ctx } = await setupRfpDoc();
		const res = await callParse({ docId, ctx });

		expect(res.status).toBe(202);
		expect(enqueueSpy).toHaveBeenCalledOnce();
		expect(inlineSpy).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
cd frontend && npx vitest run __tests__/api/rfp-parse-enqueue.test.ts
```

- [ ] **Step 3: Replace the inline call**

In `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`, replace the existing:

```typescript
processRfpParsingJob({
	jobId: job.id,
	rfpDocumentId: rfpId,
	tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
}).catch((err) => console.error("processRfpParsingJob failed", err));
```

with:

```typescript
import { enqueueRfpParse } from "@/lib/temporal/client";

await enqueueRfpParse({
	jobId: job.id,
	rfpDocumentId: rfpId,
	tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
});
```

The `await` is intentional — we want the route to fail loudly if Temporal is unreachable instead of silently dropping work. The 202 still represents "accepted for processing" rather than "completed".

In `frontend/lib/services/rfp-document-service.ts` (the discovery bridge at line ~1113), do the same replacement.

- [ ] **Step 4: Run test to verify PASS + run the broader parse suite**

```bash
cd frontend && npx vitest run __tests__/api/rfp-parse-enqueue.test.ts __tests__/api/rfp-parse-concurrent.test.ts
```

- [ ] **Step 5: Document the new ops dependency**

Add to `backlog/decisions/`:

```markdown
# RFP parse runs on Temporal, not the request thread

After audit Critical #8: the previous fire-and-forget pattern was killed by serverless cold-starts.
- Temporal address: `TEMPORAL_ADDRESS` env (default `localhost:7233`).
- Worker: `pnpm --filter frontend worker:rfp-parse` (or equivalent).
- Failure mode: `enqueueRfpParse` await means a Temporal outage returns 5xx on /parse — preferred over silent loss.
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/v1/rfp/[rfpId]/parse/route.ts \
        frontend/lib/services/rfp-document-service.ts \
        frontend/__tests__/api/rfp-parse-enqueue.test.ts \
        backlog/decisions/2026-05-08-rfp-parse-on-temporal.md
git commit -m "feat(rfp): /parse enqueues Temporal workflow instead of inline run"
```

---

## Wave-completion gate

Before declaring W3 done:

- [ ] All nine tasks committed.
- [ ] `uv run pytest tests/ci -k "rfp_endpoints or docling or stakeholder_mapper or api_tenant"` — all green.
- [ ] `cd frontend && npx vitest run __tests__/api __tests__/temporal` — all green.
- [ ] Worker boots: `pnpm --filter frontend worker:rfp-parse` shows "RFP parse worker starting..." and stays up.
- [ ] End-to-end smoke test:
  - User uploads an RFP via the Next.js UI.
  - Browser receives 201 from `/upload`.
  - User triggers parse; receives 202 with a `jobId`.
  - Within ~5 minutes, `/status` reports `parsingStatus: "completed"`.
  - `/requirements` returns the extracted requirements.
  - The same flow against another tenant returns 404 / empty.
- [ ] FastAPI handlers are no longer theatre: `grep -n "hardcoded\|TODO\|simulate\|fake" src/docfusion/api/endpoints/rfp_endpoints.py` returns nothing.

After the gate, all 12 critical findings from the original audit are closed. The pipeline runs real bytes through real modules, with tenant isolation, idempotency, atomic state transitions, prompt hardening, and queue-backed durability. The remaining audit High and Medium findings can be sequenced into a follow-up plan or a tech-debt sprint.
