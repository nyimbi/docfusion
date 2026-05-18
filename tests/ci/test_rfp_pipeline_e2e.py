#!/usr/bin/env python3
"""End-to-end: upload -> parse-enqueue -> requirements -> compliance -> discovery ingest.

W3c contract:
  * ``/upload``, ``/requirements``, ``/compliance-matrix``, and the
    entry PATCH route stay synchronous and DB-backed.
  * ``/parse`` no longer runs inline. The handler validates tenancy,
    flips the document to ``parsing_status='queued'``, and hands the
    parse to a Temporal workflow. These tests stub
    :func:`docfusion.workers.rfp_parse.client.enqueue_rfp_parse` so
    the suite stays hermetic — no Temporal cluster, no Docling.
    Activity-level coverage of the actual parse pipeline lives in
    ``test_rfp_parse_activity.py``.

Cross-tenant assertions are first-class: every state-mutating handler
is exercised with a second ``x-docfusion-organization-id`` header and
must return 404 (never 200).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from docfusion.api.dependencies import build_signed_tenant_headers
from docfusion.api.endpoints.rfp_endpoints import router as rfp_router
from docfusion.api.endpoints.discovery_endpoints import router as discovery_router
from docfusion.core.database.session import get_async_db_session


TENANT_SECRET = "test-tenant-secret"


def _tenant_headers(user_id: str, organization_id: str, method: str, path: str) -> dict[str, str]:
	return build_signed_tenant_headers(
		method=method,
		path=path,
		user_id=user_id,
		organization_id=organization_id,
		secret=TENANT_SECRET,
	)


def _headers_for(method: str, path: str) -> dict[str, str]:
	return _tenant_headers("test-user", "test-org", method, path)


def _other_headers_for(method: str, path: str) -> dict[str, str]:
	return _tenant_headers("other-user", "other-org", method, path)


# ---------------------------------------------------------------------------
# In-memory fake AsyncSession.
#
# We model just enough of SQLAlchemy's interface for the W3b handlers:
# - ``execute(text(sql), params)`` returns a result whose ``.mappings()``
#   exposes ``.first()`` and ``.all()`` against an in-memory store.
# - ``commit()`` and ``rollback()`` are no-ops.
#
# The fake recognises the exact SQL the handlers emit. We match on
# ``substring`` rather than full equality because SQLAlchemy's
# ``text()`` preserves whitespace and the handler indentation is
# load-bearing. A broken SQL string would surface as a missing match
# and a clear "unhandled statement" error rather than silent passes.
# ---------------------------------------------------------------------------


class _Result:
	"""Mimics the slice of SQLAlchemy's Result we touch in handlers."""

	def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
		self._rows = rows or []

	def mappings(self) -> "_Mappings":
		return _Mappings(self._rows)


class _Mappings:
	def __init__(self, rows: list[dict[str, Any]]) -> None:
		self._rows = rows

	def first(self) -> dict[str, Any] | None:
		return self._rows[0] if self._rows else None

	def all(self) -> list[dict[str, Any]]:
		return list(self._rows)


class FakeSession:
	"""In-memory stand-in for an AsyncSession.

	Stores everything in plain dicts keyed by row id. Every SELECT
	filters by ``organization_id`` so cross-tenant tests get the same
	404 they would against Postgres.
	"""

	def __init__(self) -> None:
		self.documents: dict[str, dict[str, Any]] = {}
		self.requirements: dict[str, dict[str, Any]] = {}
		self.matrices: dict[str, dict[str, Any]] = {}
		self.entries: dict[str, dict[str, Any]] = {}
		self.commits = 0

	async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _Result:
		sql = str(statement).lower()
		params = params or {}

		# --- INSERTs --------------------------------------------------
		if "insert into rfp_documents" in sql:
			self.documents[params["id"]] = {
				**params,
				"parsing_status": "pending",
				"parsing_progress": 0,
				"parsing_started_at": None,
				"parsing_completed_at": None,
				"parsing_error": None,
			}
			return _Result()

		if "insert into rfp_requirements" in sql:
			self.requirements[params["id"]] = {
				**params,
				"compliance_status": "not_addressed",
				"title": None,
				"subcategory": None,
				"risk_level": "medium",
				"response_strategy": None,
				"assigned_to": None,
				"due_date": None,
				"response_section": None,
				"notes": None,
			}
			return _Result()

		if "insert into compliance_matrices" in sql:
			self.matrices[params["id"]] = {**params}
			return _Result()

		if "delete from compliance_entries" in sql:
			# Atomic replace — drop everything for this matrix.
			to_drop = [eid for eid, e in self.entries.items() if e["matrix_id"] == params["mid"]]
			for eid in to_drop:
				del self.entries[eid]
			return _Result()

		if "insert into compliance_entries" in sql:
			self.entries[params["id"]] = {**params}
			return _Result()

		# --- SELECTs --------------------------------------------------
		# Defense-in-depth: every read against an RFP-domain table MUST scope
		# by organization_id in its SQL predicate, even when the params dict
		# happens to be filtered the right way. A future handler that drops
		# the WHERE clause but keeps a structurally-correct params dict
		# would otherwise pass these tests silently.
		if any(t in sql for t in (
			"from rfp_documents",
			"from rfp_requirements",
			"from compliance_entries",
			"from compliance_matrices",
		)):
			assert "organization_id" in sql, (
				f"FakeSession: SELECT against an RFP-domain table is missing "
				f"the organization_id predicate. SQL: {sql[:200]!r}"
			)

		# rfp_documents file-hash dedup at /upload time. The handler emits
		# this SELECT before INSERT to convert the unique-index conflict into
		# a 409 instead of letting it bubble up as a 500.
		if "from rfp_documents" in sql and "file_hash = :file_hash" in sql:
			match = next(
				(
					row
					for row in self.documents.values()
					if row.get("organization_id") == params.get("organization_id")
					and row.get("file_hash") == params.get("file_hash")
				),
				None,
			)
			if match is None:
				return _Result([])
			return _Result([{
				"id": match["id"],
				"filename": match["filename"],
				"storage_path": match["storage_path"],
			}])

		if "from rfp_documents" in sql and "where id = :rfp_id" in sql:
			row = self.documents.get(params["rfp_id"])
			if row and row.get("organization_id") == params["org_id"]:
				return _Result([row])
			return _Result([])

		if "from rfp_requirements" in sql:
			rows = [
				r for r in self.requirements.values()
				if r.get("rfp_document_id") == params.get("rfp_id")
				and r.get("organization_id") == params.get("org_id")
			]
			# Stable order for assertions.
			rows.sort(key=lambda r: r.get("requirement_number") or "")
			return _Result(rows)

		if "from compliance_entries" in sql and "where id = :entry_id" in sql:
			row = self.entries.get(params["entry_id"])
			if (
				row
				and row.get("matrix_id") == params["matrix_id"]
				and row.get("organization_id") == params["org_id"]
			):
				return _Result([row])
			return _Result([])

		# --- UPDATEs --------------------------------------------------
		if "update rfp_documents" in sql:
			doc = self.documents.get(params["rfp_id"])
			if doc and doc.get("organization_id") == params["org_id"]:
				if "parsing_status = 'queued'" in sql:
					# Emitted by the FastAPI /parse handler right
					# before it hands the work off to Temporal.
					doc["parsing_status"] = "queued"
				elif "parsing_status = 'processing'" in sql:
					doc["parsing_status"] = "processing"
					doc["parsing_started_at"] = params.get("started")
				elif "parsing_status = 'completed'" in sql:
					doc["parsing_status"] = "completed"
					doc["parsing_progress"] = 100
					doc["parsing_completed_at"] = params.get("completed")
				elif "parsing_status = 'failed'" in sql:
					doc["parsing_status"] = "failed"
					doc["parsing_error"] = params.get("err")
			return _Result()

		if "update compliance_entries" in sql:
			entry = self.entries.get(params["entry_id"])
			if (
				entry
				and entry.get("matrix_id") == params["matrix_id"]
				and entry.get("organization_id") == params["org_id"]
			):
				# Apply allow-listed updates.
				for col, value in params.items():
					if col in {"entry_id", "matrix_id", "org_id"}:
						continue
					target_col = {
						"status": "compliance_status",
						"response": "response_summary",
						"notes": "reviewer_notes",
						"assigned_to": "assigned_to",
						"updated_at": "updated_at",
					}.get(col, col)
					entry[target_col] = value
			return _Result()

		raise AssertionError(f"FakeSession got unhandled SQL: {sql[:200]!r}")

	async def commit(self) -> None:
		self.commits += 1

	async def rollback(self) -> None:
		pass


# ---------------------------------------------------------------------------
# Stub the Temporal enqueue so /parse doesn't try to reach a cluster.
#
# The handler now hands work off to ``enqueue_rfp_parse``; the real
# implementation opens a connection to the Temporal frontend. Tests
# replace it with a deterministic stub that records every call so we
# can assert the right tenant context was forwarded.
# ---------------------------------------------------------------------------


class _EnqueueRecorder:
	"""Captures the (rfp_id, organization_id, user_id) tuples seen by /parse."""

	def __init__(self) -> None:
		self.calls: list[dict[str, str]] = []
		self.workflow_id: str = "wf-stub"
		self.run_id: str = "run-stub"
		# Override return shape per-test by mutating .next_return.
		self.next_return: tuple[str, str] | None = None

	async def __call__(
		self,
		rfp_id: str,
		organization_id: str,
		user_id: str,
	) -> tuple[str, str]:
		self.calls.append(
			{
				"rfp_id": rfp_id,
				"organization_id": organization_id,
				"user_id": user_id,
			}
		)
		if self.next_return is not None:
			return self.next_return
		return (f"{self.workflow_id}-{rfp_id}", self.run_id)


@pytest.fixture
def fake_session() -> FakeSession:
	return FakeSession()


@pytest.fixture
def enqueue_recorder() -> _EnqueueRecorder:
	return _EnqueueRecorder()


@pytest.fixture
def client(
	fake_session: FakeSession,
	enqueue_recorder: _EnqueueRecorder,
	monkeypatch: pytest.MonkeyPatch,
	tmp_path: Path,
):
	# Redirect the local-bytes staging area into ``tmp_path`` so each
	# test starts with a clean disk. Both /upload and the (now removed)
	# inline parse path used the same constant; only /upload still
	# touches it now.
	monkeypatch.setattr(
		"docfusion.api.endpoints.rfp_endpoints._LOCAL_STORAGE_ROOT",
		tmp_path / "rfp",
	)
	# Replace the Temporal enqueue helper so we don't open a TCP
	# connection during tests. The handler imports it as a name
	# local to ``rfp_endpoints``; patch that exact name so the route
	# sees the stub even when the real module is also loaded.
	monkeypatch.setattr(
		"docfusion.api.endpoints.rfp_endpoints.enqueue_rfp_parse",
		enqueue_recorder,
	)
	monkeypatch.setenv("DOCFUSION_TENANT_HEADER_SECRET", TENANT_SECRET)

	app = FastAPI()
	app.include_router(rfp_router)
	app.include_router(discovery_router)

	async def _override_session():
		yield fake_session

	app.dependency_overrides[get_async_db_session] = _override_session
	yield TestClient(app)
	app.dependency_overrides.clear()


def _seed_requirements(fake_session: FakeSession, rfp_id: str, org_id: str) -> None:
	"""Inject two stub requirements straight into the FakeSession.

	W3b's /parse handler used to populate these synchronously. Under W3c
	the parse runs on a Temporal worker that is intentionally absent
	from this hermetic test suite, so we seed the rows the matrix /
	requirements endpoints expect to read. Activity-level coverage of
	the persistence path lives in ``test_rfp_parse_activity.py``.
	"""
	from docfusion.core.utils import uuid7str

	for index, modality, page in (
		(1, "mandatory", 3),
		(2, "optional", 7),
	):
		req_id = uuid7str()
		fake_session.requirements[req_id] = {
			"id": req_id,
			"organization_id": org_id,
			"rfp_document_id": rfp_id,
			"requirement_number": f"REQ-{index:03d}",
			"requirement_text": f"Stub requirement {index}",
			"source_quote": f"Stub requirement {index}",
			"source_page": page,
			"source_section": f"Section {index}",
			"category": "technical",
			"requirement_type": "shall",
			"priority": modality,
			"extraction_confidence": 0.8,
			"compliance_status": "not_addressed",
			"title": None,
			"subcategory": None,
			"risk_level": "medium",
			"response_strategy": None,
			"assigned_to": None,
			"due_date": None,
			"response_section": None,
			"notes": None,
		}


class TestRfpPipeline:
	"""End-to-end coverage of the W3b DB-backed handlers."""

	def test_upload_persists_document(self, client: TestClient, fake_session: FakeSession):
		"""/upload returns 202 and writes a tenant-scoped row."""
		response = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 test content", "application/pdf")},
		)
		assert response.status_code == 202, response.text
		data = response.json()
		assert data["filename"] == "sample.pdf"
		assert data["size"] == len(b"%PDF-1.4 test content")
		assert data["organization_id"] == "test-org"
		assert data["parsing_status"] == "pending"
		assert data["storage_path"].startswith("orgs/test-org/rfp/")
		assert len(data["file_hash"]) == 64  # sha256 hex

		# Row must exist with the right org.
		rfp_id = data["rfp_id"]
		assert rfp_id in fake_session.documents
		assert fake_session.documents[rfp_id]["organization_id"] == "test-org"
		assert fake_session.documents[rfp_id]["uploaded_by"] == "test-user"

	def test_upload_requires_tenant_headers(self, client: TestClient):
		response = client.post(
			"/api/v1/rfp/upload",
			files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
		)
		assert response.status_code == 401

	def test_upload_dedups_within_tenant(self, client: TestClient, fake_session: FakeSession):
		"""Same bytes uploaded twice by the same org -> 409, not 500."""
		payload = b"%PDF-1.4 same bytes"
		first = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("a.pdf", payload, "application/pdf")},
		)
		assert first.status_code == 202
		first_id = first.json()["rfp_id"]

		second = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("b.pdf", payload, "application/pdf")},
		)
		assert second.status_code == 409, second.text
		detail = second.json()["detail"]
		assert detail["error"] == "duplicate"
		assert detail["existing_rfp_id"] == first_id

	def test_upload_strips_path_traversal_in_filename(
		self, client: TestClient, fake_session: FakeSession
	):
		"""Attacker-controlled filename cannot escape the per-tenant directory."""
		response = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={
				"file": (
					"../../../etc/passwd",
					b"would-be-escape",
					"application/octet-stream",
				)
			},
		)
		assert response.status_code == 202
		data = response.json()
		# Stored filename is just the basename; storage_path stays under
		# orgs/{org}/rfp/{rfp_id}/ — no parent traversal.
		assert data["filename"] == "passwd"
		assert "/etc/" not in data["storage_path"]
		assert data["storage_path"].startswith(f"orgs/test-org/rfp/{data['rfp_id']}/")

	def test_parse_enqueues_temporal_workflow(
		self,
		client: TestClient,
		fake_session: FakeSession,
		enqueue_recorder: _EnqueueRecorder,
	):
		"""/parse returns 202 with a workflow handle and flips status to queued.

		The actual analyzer no longer runs inline — the route hands the
		work to ``enqueue_rfp_parse`` and returns immediately. We verify:
		  1. The DB row's ``parsing_status`` moved from ``pending`` to
		     ``queued`` *before* the handoff so polling clients see the
		     transition even if Temporal is slow to pick up.
		  2. The enqueue helper saw the right tenant context.
		  3. The 202 response contains the workflow handle.
		"""
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hello", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		assert fake_session.documents[rfp_id]["parsing_status"] == "pending"

		# Force a deterministic return shape so the assertion is stable.
		enqueue_recorder.next_return = ("wf-fixed-id", "run-fixed-id")

		response = client.post(
			f"/api/v1/rfp/{rfp_id}/parse",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/parse"),
		)
		assert response.status_code == 202, response.text
		data = response.json()
		assert data == {
			"rfp_id": rfp_id,
			"workflow_id": "wf-fixed-id",
			"run_id": "run-fixed-id",
			"status": "queued",
		}

		# Status flipped to queued before the handoff.
		assert fake_session.documents[rfp_id]["parsing_status"] == "queued"
		# No requirements were persisted inline — that's the worker's job now.
		stored = [
			r
			for r in fake_session.requirements.values()
			if r.get("rfp_document_id") == rfp_id
		]
		assert stored == []

		# The enqueue helper got the tenant identity from headers.
		assert enqueue_recorder.calls == [
			{
				"rfp_id": rfp_id,
				"organization_id": "test-org",
				"user_id": "test-user",
			}
		]

	def test_parse_404_for_other_tenant(
		self,
		client: TestClient,
		enqueue_recorder: _EnqueueRecorder,
	):
		"""Cross-tenant /parse against an existing rfp returns 404 and never enqueues."""
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hello", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]

		response = client.post(
			f"/api/v1/rfp/{rfp_id}/parse",
			headers=_other_headers_for("POST", f"/api/v1/rfp/{rfp_id}/parse"),
		)
		assert response.status_code == 404
		# Tenancy check fails *before* the Temporal call.
		assert enqueue_recorder.calls == []

	def test_list_requirements_returns_persisted_rows(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		# /parse no longer populates rows synchronously — seed directly so
		# /requirements has rows to read. Activity-level coverage of the
		# extraction lives in test_rfp_parse_activity.py.
		_seed_requirements(fake_session, rfp_id, "test-org")

		response = client.get(
			f"/api/v1/rfp/{rfp_id}/requirements",
			headers=_headers_for("GET", f"/api/v1/rfp/{rfp_id}/requirements"),
		)
		assert response.status_code == 200
		data = response.json()
		assert data["rfp_id"] == rfp_id
		assert data["organization_id"] == "test-org"
		assert data["count"] == 2
		# Stable ordering by requirement_number.
		numbers = [r["requirement_number"] for r in data["requirements"]]
		assert numbers == sorted(numbers)

	def test_list_requirements_404_for_other_tenant(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")

		response = client.get(
			f"/api/v1/rfp/{rfp_id}/requirements",
			headers=_other_headers_for("GET", f"/api/v1/rfp/{rfp_id}/requirements"),
		)
		assert response.status_code == 404

	def test_generate_matrix_persists_entries(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")

		response = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		assert response.status_code == 200, response.text
		data = response.json()
		assert data["rfp_id"] == rfp_id
		assert data["organization_id"] == "test-org"
		assert data["entry_count"] == 2

		matrix_id = data["matrix_id"]
		assert matrix_id in fake_session.matrices
		assert fake_session.matrices[matrix_id]["organization_id"] == "test-org"
		# Entries scoped by org.
		entries = [e for e in fake_session.entries.values() if e["matrix_id"] == matrix_id]
		assert len(entries) == 2
		assert all(e["organization_id"] == "test-org" for e in entries)

	def test_generate_matrix_404_for_other_tenant(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")

		response = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_other_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		assert response.status_code == 404

	def test_generate_matrix_409_when_no_requirements(self, client: TestClient):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		# Skip seeding — no requirements yet.

		response = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		assert response.status_code == 409

	def test_update_entry_applies_allow_list(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")
		matrix_resp = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		matrix_id = matrix_resp.json()["matrix_id"]
		entry_id = next(iter(fake_session.entries.keys()))

		response = client.patch(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			headers=_headers_for(
				"PATCH",
				f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			),
			json={"status": "addressed", "response": "Section 4.2", "notes": "looks good"},
		)
		assert response.status_code == 200, response.text
		data = response.json()
		assert data["entry_id"] == entry_id
		assert data["status"] == "addressed"
		assert data["response"] == "Section 4.2"
		assert data["notes"] == "looks good"

	def test_update_entry_rejects_unknown_fields(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")
		matrix_resp = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		matrix_id = matrix_resp.json()["matrix_id"]
		entry_id = next(iter(fake_session.entries.keys()))

		# A client trying to smuggle in organization_id should fail closed.
		response = client.patch(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			headers=_headers_for(
				"PATCH",
				f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			),
			json={"organization_id": "evil-org", "status": "addressed"},
		)
		assert response.status_code == 400
		assert "Unsupported update fields" in response.json()["detail"]

	def test_update_entry_rejects_invalid_status(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")
		matrix_resp = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		matrix_id = matrix_resp.json()["matrix_id"]
		entry_id = next(iter(fake_session.entries.keys()))

		response = client.patch(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			headers=_headers_for(
				"PATCH",
				f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			),
			json={"status": "TOTALLY_BOGUS"},
		)
		assert response.status_code == 400

	def test_update_entry_404_for_other_tenant(
		self,
		client: TestClient,
		fake_session: FakeSession,
	):
		upload = client.post(
			"/api/v1/rfp/upload",
			headers=_headers_for("POST", "/api/v1/rfp/upload"),
			files={"file": ("sample.pdf", b"%PDF-1.4 hi", "application/pdf")},
		)
		rfp_id = upload.json()["rfp_id"]
		_seed_requirements(fake_session, rfp_id, "test-org")
		matrix_resp = client.post(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix",
			headers=_headers_for("POST", f"/api/v1/rfp/{rfp_id}/compliance-matrix"),
		)
		matrix_id = matrix_resp.json()["matrix_id"]
		entry_id = next(iter(fake_session.entries.keys()))

		response = client.patch(
			f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			headers=_other_headers_for(
				"PATCH",
				f"/api/v1/rfp/{rfp_id}/compliance-matrix/{matrix_id}/entries/{entry_id}",
			),
			json={"status": "addressed"},
		)
		assert response.status_code == 404

	def test_discovery_sources_endpoint(self, client: TestClient):
		response = client.get("/api/v1/discovery/sources")
		assert response.status_code == 200
		assert isinstance(response.json(), list)

	def test_discovery_health_endpoint(self, client: TestClient):
		response = client.get("/api/v1/discovery/health")
		assert response.status_code == 200
		data = response.json()
		assert "status" in data
		assert "capabilities" in data

	def test_discovery_ingest_endpoint(self, client: TestClient):
		response = client.post("/api/v1/discovery/opportunities/op-1/ingest")
		assert response.status_code == 200
		data = response.json()
		assert "rfp_id" in data
		assert data["source"] == "discovery"
		assert data["opportunity_id"] == "op-1"


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
