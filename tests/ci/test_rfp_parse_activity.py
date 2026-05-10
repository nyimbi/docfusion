#!/usr/bin/env python3
"""Activity-level coverage of the RFP parse pipeline.

The Temporal activity ``run_rfp_parse`` is a thin wrapper around
:func:`docfusion.rfp.parse_pipeline.execute_parse_pipeline`. These
tests target the pipeline directly with the same in-memory
``FakeSession`` the FastAPI e2e suite uses, so we keep the suite
hermetic — no Postgres, no Temporal cluster, no Docling.

The W3b ``/parse`` endpoint used to run this logic inline; W3c moved
it to the activity. Coverage stayed; the assertions just point at the
extracted module instead of the route.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from docfusion.rfp import parse_pipeline as parse_pipeline_module
from docfusion.rfp.parse_pipeline import (
	ParsePipelineResult,
	RfpDocumentNotFoundError,
	RfpStagedBytesMissingError,
	execute_parse_pipeline,
)


# ---------------------------------------------------------------------------
# In-memory AsyncSession shim — same shape as test_rfp_pipeline_e2e.FakeSession
# but trimmed down to the SQL the parse pipeline actually emits. Keeping the
# two fakes separate stops the e2e suite's ``UPDATE`` semantics from being
# a load-bearing dependency of the activity tests.
# ---------------------------------------------------------------------------


class _Result:
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
	"""Minimal AsyncSession stand-in for the parse pipeline.

	Stores the document row + extracted requirements in plain dicts.
	Every ``execute`` matches on substrings of the SQL the pipeline
	emits — anything else raises so a typo'd query surfaces as a
	loud test failure instead of a silent pass.
	"""

	def __init__(self, document: dict[str, Any]) -> None:
		self.document = dict(document)
		self.requirements: dict[str, dict[str, Any]] = {}
		self.commits = 0

	async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _Result:
		sql = str(statement).lower()
		params = params or {}

		# SELECT the doc row scoped by org_id.
		if "from rfp_documents" in sql and "where id = :rfp_id" in sql:
			doc = self.document
			if (
				doc.get("id") == params.get("rfp_id")
				and doc.get("organization_id") == params.get("org_id")
			):
				return _Result([doc])
			return _Result([])

		# Status transitions.
		if "update rfp_documents" in sql:
			doc = self.document
			if doc.get("id") == params.get("rfp_id") and doc.get("organization_id") == params.get(
				"org_id"
			):
				if "parsing_status = 'queued'" in sql:
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

		# Requirement persistence.
		if "insert into rfp_requirements" in sql:
			self.requirements[params["id"]] = dict(params)
			return _Result()

		raise AssertionError(f"FakeSession got unhandled SQL: {sql[:200]!r}")

	async def commit(self) -> None:
		self.commits += 1

	async def rollback(self) -> None:  # pragma: no cover — never invoked here
		pass


# ---------------------------------------------------------------------------
# Stub analyzer — deterministic two-requirement output, no Docling.
# ---------------------------------------------------------------------------


class _StubAnalyzer:
	"""Returns a two-requirement analysis regardless of input."""

	def __init__(self, *_args: Any, **_kwargs: Any) -> None:
		pass

	async def analyze_pdf(self, content: bytes) -> SimpleNamespace:  # noqa: ARG002
		return await self.analyze_text("")

	async def analyze_docx(self, content: bytes) -> SimpleNamespace:  # noqa: ARG002
		return await self.analyze_text("")

	async def analyze_text(self, _text: str) -> SimpleNamespace:
		from docfusion.rfp.requirement_extractor import (
			Requirement,
			RequirementCategory,
			RequirementModality,
			RequirementType,
		)

		requirements = [
			Requirement(
				id="req-stub-1",
				text="The contractor shall provide 24/7 support.",
				modality=RequirementModality.MANDATORY,
				category=RequirementCategory.TECHNICAL,
				requirement_type=RequirementType.FUNCTIONAL,
				section="Section L",
				page_number=3,
				confidence=0.9,
			),
			Requirement(
				id="req-stub-2",
				text="The vendor should offer a mobile app.",
				modality=RequirementModality.OPTIONAL,
				category=RequirementCategory.TECHNICAL,
				requirement_type=RequirementType.FUNCTIONAL,
				section="Section M",
				page_number=7,
				confidence=0.7,
			),
		]
		return SimpleNamespace(
			success=True,
			requirements=requirements,
			errors=[],
			warnings=[],
		)

	async def close(self) -> None:
		pass


class _FailingAnalyzer(_StubAnalyzer):
	"""Returns ``success=False`` so we exercise the failure path."""

	async def analyze_text(self, _text: str) -> SimpleNamespace:
		return SimpleNamespace(
			success=False,
			requirements=[],
			errors=["analyzer disagreed with the document"],
			warnings=[],
		)


@pytest.fixture
def staged_doc(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
	"""Stage a fake RFP under a tmp storage root and return its row dict."""
	# Redirect the pipeline's storage root to tmp_path.
	monkeypatch.setattr(parse_pipeline_module, "_LOCAL_STORAGE_ROOT", tmp_path / "rfp")

	rfp_id = "rfp-activity-test-1"
	organization_id = "test-org"
	storage_path = f"orgs/{organization_id}/rfp/{rfp_id}/sample.pdf"
	# The pipeline strips the ``orgs/`` prefix when resolving locally.
	local_path = (tmp_path / "rfp") / storage_path[len("orgs/") :]
	local_path.parent.mkdir(parents=True, exist_ok=True)
	local_path.write_bytes(b"%PDF-1.4 fake content")

	return {
		"id": rfp_id,
		"organization_id": organization_id,
		"filename": "sample.pdf",
		"file_type": "pdf",
		"storage_path": storage_path,
		"parsing_status": "queued",
	}


def test_pipeline_extracts_requirements(
	staged_doc: dict[str, Any],
	monkeypatch: pytest.MonkeyPatch,
) -> None:
	"""Happy path: analyzer succeeds, requirements persisted, status completed."""
	monkeypatch.setattr(parse_pipeline_module, "RFPAnalyzer", _StubAnalyzer)
	session = FakeSession(staged_doc)

	loop = asyncio.new_event_loop()
	try:
		result = loop.run_until_complete(
			execute_parse_pipeline(
				session,
				rfp_id=staged_doc["id"],
				organization_id=staged_doc["organization_id"],
			)
		)
	finally:
		loop.close()

	assert isinstance(result, ParsePipelineResult)
	assert result.status == "completed"
	assert result.rfp_id == staged_doc["id"]
	assert result.organization_id == "test-org"
	assert result.requirements_extracted == 2
	# Document row moved through processing -> completed.
	assert session.document["parsing_status"] == "completed"
	# Each requirement is org-scoped and tied to the document.
	assert len(session.requirements) == 2
	for row in session.requirements.values():
		assert row["organization_id"] == "test-org"
		assert row["rfp_document_id"] == staged_doc["id"]
		# Schema vocabulary mapping.
		assert row["requirement_type"] == "shall"


def test_pipeline_404_for_cross_tenant(
	staged_doc: dict[str, Any],
	monkeypatch: pytest.MonkeyPatch,
) -> None:
	"""Wrong organization_id raises RfpDocumentNotFoundError."""
	monkeypatch.setattr(parse_pipeline_module, "RFPAnalyzer", _StubAnalyzer)
	session = FakeSession(staged_doc)

	loop = asyncio.new_event_loop()
	try:
		with pytest.raises(RfpDocumentNotFoundError):
			loop.run_until_complete(
				execute_parse_pipeline(
					session,
					rfp_id=staged_doc["id"],
					organization_id="other-org",
				)
			)
	finally:
		loop.close()
	# No requirements written, no status flip — the pipeline bailed before
	# the staging-bytes read.
	assert session.requirements == {}


def test_pipeline_410_when_bytes_missing(
	staged_doc: dict[str, Any],
	monkeypatch: pytest.MonkeyPatch,
	tmp_path: Path,
) -> None:
	"""Missing staged bytes flag the row failed and raise RfpStagedBytesMissingError."""
	monkeypatch.setattr(parse_pipeline_module, "RFPAnalyzer", _StubAnalyzer)
	# Wipe the staged file so the existence check fails.
	from docfusion.rfp.parse_pipeline import _local_storage_path

	local_path = _local_storage_path(staged_doc["storage_path"])
	local_path.unlink()

	session = FakeSession(staged_doc)

	loop = asyncio.new_event_loop()
	try:
		with pytest.raises(RfpStagedBytesMissingError):
			loop.run_until_complete(
				execute_parse_pipeline(
					session,
					rfp_id=staged_doc["id"],
					organization_id=staged_doc["organization_id"],
				)
			)
	finally:
		loop.close()

	# Row marked failed, with a stable error string.
	assert session.document["parsing_status"] == "failed"
	assert session.document["parsing_error"] == "stored bytes missing"


def test_pipeline_marks_failed_on_analyzer_no_success(
	staged_doc: dict[str, Any],
	monkeypatch: pytest.MonkeyPatch,
) -> None:
	"""Analyzer returning success=False yields a ``failed`` ParsePipelineResult."""
	monkeypatch.setattr(parse_pipeline_module, "RFPAnalyzer", _FailingAnalyzer)
	session = FakeSession(staged_doc)

	loop = asyncio.new_event_loop()
	try:
		result = loop.run_until_complete(
			execute_parse_pipeline(
				session,
				rfp_id=staged_doc["id"],
				organization_id=staged_doc["organization_id"],
			)
		)
	finally:
		loop.close()

	assert result.status == "failed"
	assert result.requirements_extracted == 0
	assert result.error == "analyzer disagreed with the document"
	assert session.document["parsing_status"] == "failed"
	# We didn't reach the INSERT loop.
	assert session.requirements == {}
