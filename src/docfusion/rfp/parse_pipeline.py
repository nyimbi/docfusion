#!/usr/bin/env python3
"""Tenant-scoped RFP parse pipeline.

This module hosts the side-effect-laden parse logic that used to live
inline inside ``POST /rfp/{rfp_id}/parse``. Pulling it out gives us a
single canonical implementation that:

  * the FastAPI route can still call directly (it does not, post-W3c),
  * the Temporal activity in
    ``src/docfusion/workers/rfp_parse/activities.py`` calls so the
    worker pool can drain the queue.

Every read **and** every write here scopes by ``organization_id``. The
caller passes the tenant context in explicitly — there is no implicit
auth here, because the activity runs on a worker thread without
request-scoped state. Cross-tenant parse attempts return ``None``
from :func:`load_rfp_document` so the caller decides whether to 404
(FastAPI) or raise (Temporal activity, where the workflow records the
failure).

Status transitions emitted by :func:`execute_parse_pipeline`::

	pending|queued -> processing -> completed
	                              \\-> failed (on analyzer / IO error)

The function returns a small :class:`ParsePipelineResult` so callers
can shape the response without re-querying the row.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.utils import uuid7str
from ..storage.blob_store import BlobStore, LocalBlobStore
from .requirement_extractor import (
	RequirementCategory,
	RequirementModality,
	RequirementType,
)
from .rfp_analyzer import RFPAnalyzer

logger = logging.getLogger(__name__)

_LOCAL_STORAGE_ROOT = Path("./storage/rfp")


def _local_storage_path(key: str) -> Path:
	"""Resolve a storage key under the local RFP storage root."""
	relative = key[len("orgs/"):] if key.startswith("orgs/") else key
	return _LOCAL_STORAGE_ROOT / relative


# ---------------------------------------------------------------------------
# Schema-vocabulary mappings.
#
# These mirror what rfp_endpoints used to hold inline. Centralising them
# here means the activity, the route, and any future batch importer all
# emit the same DB shape.
# ---------------------------------------------------------------------------
_REQ_TYPE_TO_VERB: dict[str, str] = {
	"functional": "shall",
	"technical": "shall",
	"performance": "shall",
	"security": "shall",
	"compliance": "shall",
	"deliverable": "shall",
	"evaluation": "shall",
	"contract": "shall",
	"administrative": "shall",
	"unknown": "shall",
}


def _requirement_type_to_verb(req_type: RequirementType) -> str:
	"""Coerce the analyzer's RequirementType enum into the schema's verb vocabulary."""
	return _REQ_TYPE_TO_VERB.get(req_type.value, "shall")


def _modality_to_priority(modality: RequirementModality) -> str:
	"""Map analyzer modality (mandatory/optional/conditional) to schema priority."""
	if modality == RequirementModality.MANDATORY:
		return "mandatory"
	if modality == RequirementModality.OPTIONAL:
		return "optional"
	# conditional collapses to ``preferred`` so a reviewer still sees it
	# as non-mandatory but distinct from a hard "optional" tag.
	return "preferred"


# ---------------------------------------------------------------------------
# Result shape returned to callers.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ParsePipelineResult:
	"""Summary returned once the pipeline finishes (success or failure).

	Both branches return the same shape so callers can render a uniform
	status payload. ``status`` is one of ``"completed"`` or ``"failed"``;
	any unexpected analyzer state is normalised before this object is
	constructed.
	"""

	rfp_id: str
	organization_id: str
	requirements_extracted: int
	status: str
	error: str | None = None


# ---------------------------------------------------------------------------
# DB readers — small, focused, organization-scoped.
# ---------------------------------------------------------------------------


async def load_rfp_document(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
) -> dict[str, Any] | None:
	"""Return the rfp_documents row for ``(rfp_id, organization_id)`` or None.

	Returning ``None`` instead of raising lets the FastAPI route emit a
	404 and the Temporal activity emit a domain-specific exception. The
	tenancy predicate is always present — this is the canonical way to
	check "does this RFP belong to this org".
	"""
	row = (
		await session.execute(
			text(
				"""
				SELECT id, organization_id, filename, file_type, storage_path
				FROM rfp_documents
				WHERE id = :rfp_id AND organization_id = :org_id
				"""
			),
			{"rfp_id": rfp_id, "org_id": organization_id},
		)
	).mappings().first()
	if row is None:
		return None
	return dict(row)


# ---------------------------------------------------------------------------
# Status transitions.
# ---------------------------------------------------------------------------


async def mark_parse_processing(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
) -> None:
	"""Move the row from ``pending``/``queued`` to ``processing``."""
	now = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'processing',
				parsing_started_at = :started,
				updated_at = :started
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{"rfp_id": rfp_id, "org_id": organization_id, "started": now},
	)
	await session.commit()


async def mark_parse_failed(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
	error: str,
) -> None:
	"""Record a parse failure on the document row and commit.

	Truncates the error string at 4 KB so a stray analyzer traceback
	cannot blow up the column. ``updated_at`` is always written so list
	views still order correctly.
	"""
	now = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'failed',
				parsing_error = :err,
				updated_at = :now
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{
			"rfp_id": rfp_id,
			"org_id": organization_id,
			"err": (error or "unknown")[:4000],
			"now": now,
		},
	)
	await session.commit()


async def mark_parse_queued(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
) -> None:
	"""Flip the document to ``queued`` immediately after enqueueing.

	The FastAPI route calls this so polling clients can see the
	transition out of ``pending`` even before the worker picks the
	workflow up. The worker itself moves to ``processing`` via
	:func:`mark_parse_processing` once the activity actually runs.
	"""
	now = datetime.now(timezone.utc)
	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'queued',
				updated_at = :now
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{"rfp_id": rfp_id, "org_id": organization_id, "now": now},
	)
	await session.commit()


# ---------------------------------------------------------------------------
# Analyzer dispatcher.
# ---------------------------------------------------------------------------


async def run_analysis(
	analyzer: RFPAnalyzer,
	contents: bytes,
	file_type: str,
) -> Any:
	"""Pick the right analyzer entry point for the file type.

	Centralised so the FastAPI route stays readable, and so the Temporal
	activity can call into the same dispatcher without copy-pasting the
	file-type table.
	"""
	if file_type == "pdf":
		return await analyzer.analyze_pdf(contents)
	if file_type == "docx":
		return await analyzer.analyze_docx(contents)
	# txt/html/bin — try to decode as text. Anything that survives
	# round-tripping through utf-8 is fed to ``analyze_text``.
	try:
		text_payload = contents.decode("utf-8", errors="replace")
	except Exception as exc:  # pragma: no cover — replace cannot raise
		raise RuntimeError(f"Cannot decode RFP bytes as text: {exc}") from exc
	return await analyzer.analyze_text(text_payload)


# ---------------------------------------------------------------------------
# Top-level pipeline.
# ---------------------------------------------------------------------------


async def execute_parse_pipeline(
	session: AsyncSession,
	rfp_id: str,
	organization_id: str,
	blob_store: BlobStore | None = None,
) -> ParsePipelineResult:
	"""Run the full parse pipeline against ``(rfp_id, organization_id)``.

	Steps:
	  1. Load the document row, scoped by tenant. Missing -> raise
	     :class:`RfpDocumentNotFoundError` so the caller can map to 404
	     or to a workflow failure.
	  2. Read the staged bytes off local disk (the W3c blob-storage
	     swap reuses the same key).
	  3. Mark the row ``processing``.
	  4. Run :class:`RFPAnalyzer` over the bytes.
	  5. Persist requirements with ``organization_id`` and
	     ``rfp_document_id`` set on every row.
	  6. Mark the row ``completed`` (or ``failed`` if the analyzer
	     reported errors).

	Returns a :class:`ParsePipelineResult` summarising the outcome. The
	caller decides whether to surface the result as an HTTP 200/500 or
	as a workflow result/exception.
	"""
	assert rfp_id, "rfp_id is required"
	assert organization_id, "organization_id is required"

	row = await load_rfp_document(session, rfp_id, organization_id)
	if row is None:
		raise RfpDocumentNotFoundError(rfp_id=rfp_id, organization_id=organization_id)

	storage_path = row["storage_path"]
	file_type = (row["file_type"] or "").lower()
	store = blob_store if blob_store is not None else LocalBlobStore(root=_LOCAL_STORAGE_ROOT)
	contents = await store.retrieve(storage_path)

	if contents is None:
		# Bytes vanished between upload and parse. Mark failed so the
		# UI can surface the state and re-prompt for upload.
		await mark_parse_failed(
			session,
			rfp_id,
			organization_id,
			"stored bytes missing",
		)
		raise RfpStagedBytesMissingError(rfp_id=rfp_id, organization_id=organization_id)

	# Hop the row out of pending|queued before doing the heavy work so
	# concurrent pollers can see ``processing``.
	await mark_parse_processing(session, rfp_id, organization_id)

	analyzer = RFPAnalyzer(config={"ai_enhancement": False})
	try:
		analysis = await run_analysis(analyzer, contents, file_type)
	except Exception as exc:  # noqa: BLE001 — explicit broad catch so we record failure
		logger.exception(
			"parse_pipeline analyzer failure rfp_id=%s org=%s",
			rfp_id,
			organization_id,
		)
		await mark_parse_failed(session, rfp_id, organization_id, str(exc))
		# Re-raise so the caller (route or activity) can decide error
		# semantics. The DB row is already marked ``failed``.
		raise
	finally:
		await analyzer.close()

	if not analysis.success:
		joined = "; ".join(analysis.errors) or "unknown analyzer failure"
		await mark_parse_failed(session, rfp_id, organization_id, joined)
		return ParsePipelineResult(
			rfp_id=rfp_id,
			organization_id=organization_id,
			requirements_extracted=0,
			status="failed",
			error=joined,
		)

	# Persist requirements. Each row gets a fresh server-side UUID so
	# the row id is independent of whatever the in-memory pipeline
	# picked.
	now_completed = datetime.now(timezone.utc)
	for index, req in enumerate(analysis.requirements, start=1):
		await session.execute(
			text(
				"""
				INSERT INTO rfp_requirements (
					id, organization_id, rfp_document_id,
					requirement_number, requirement_text, source_quote,
					source_page, source_section,
					category, requirement_type, priority,
					extraction_confidence,
					compliance_status,
					tags, clarification_questions, related_requirements, key_terms,
					created_at, updated_at
				) VALUES (
					:id, :organization_id, :rfp_document_id,
					:requirement_number, :requirement_text, :source_quote,
					:source_page, :source_section,
					:category, :requirement_type, :priority,
					:extraction_confidence,
					'not_addressed',
					CAST('[]' AS JSONB), CAST('[]' AS JSONB),
					CAST('[]' AS JSONB), CAST('[]' AS JSONB),
					:created_at, :updated_at
				)
				ON CONFLICT (rfp_document_id, requirement_text) DO NOTHING
				"""
			),
			{
				"id": uuid7str(),
				"organization_id": organization_id,
				"rfp_document_id": rfp_id,
				"requirement_number": f"REQ-{index:03d}",
				"requirement_text": req.text,
				"source_quote": req.text[:1000],
				"source_page": req.page_number,
				"source_section": req.section or None,
				"category": (
					req.category.value
					if isinstance(req.category, RequirementCategory)
					else None
				),
				"requirement_type": _requirement_type_to_verb(req.requirement_type),
				"priority": _modality_to_priority(req.modality),
				"extraction_confidence": req.confidence,
				"created_at": now_completed,
				"updated_at": now_completed,
			},
		)

	await session.execute(
		text(
			"""
			UPDATE rfp_documents
			SET parsing_status = 'completed',
				parsing_progress = 100,
				parsing_completed_at = :completed,
				updated_at = :completed
			WHERE id = :rfp_id AND organization_id = :org_id
			"""
		),
		{"rfp_id": rfp_id, "org_id": organization_id, "completed": now_completed},
	)
	await session.commit()

	logger.info(
		"parse_pipeline completed rfp_id=%s org=%s requirements=%d",
		rfp_id,
		organization_id,
		len(analysis.requirements),
	)
	return ParsePipelineResult(
		rfp_id=rfp_id,
		organization_id=organization_id,
		requirements_extracted=len(analysis.requirements),
		status="completed",
	)


# ---------------------------------------------------------------------------
# Domain exceptions — used by the activity to signal "give up cleanly"
# instead of relying on HTTP semantics.
# ---------------------------------------------------------------------------


class ParsePipelineError(Exception):
	"""Base class for parse-pipeline domain errors.

	The activity converts these into Temporal application failures so
	the workflow can decide retry vs. terminal failure based on the
	subclass.
	"""


class RfpDocumentNotFoundError(ParsePipelineError):
	"""Raised when the requested ``(rfp_id, organization_id)`` does not exist.

	The FastAPI route should map this to 404. The Temporal activity
	maps it to a non-retryable failure — re-running the workflow won't
	make a missing row appear.
	"""

	def __init__(self, *, rfp_id: str, organization_id: str) -> None:
		super().__init__(
			f"RFP document not found: rfp_id={rfp_id} organization_id={organization_id}"
		)
		self.rfp_id = rfp_id
		self.organization_id = organization_id


class RfpStagedBytesMissingError(ParsePipelineError):
	"""Raised when the uploaded bytes are missing from staging.

	The route surfaces 410 (Gone). The activity treats this as
	non-retryable — the bytes won't reappear without a fresh upload.
	"""

	def __init__(self, *, rfp_id: str, organization_id: str) -> None:
		super().__init__(
			f"Staged RFP bytes missing: rfp_id={rfp_id} organization_id={organization_id}"
		)
		self.rfp_id = rfp_id
		self.organization_id = organization_id
