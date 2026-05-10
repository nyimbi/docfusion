"""
Tests for RenderRequest.content_override (A.2).

The render endpoint historically pulled body content from storage only, so
unsaved edits in the document UI silently disappeared from PDF/DOCX exports.
A.2 adds a `content_override` field on RenderRequest that the editor passes
when calling /render. When present, it replaces the stored body in the
content_data dict the DocumentEngine renders from; title and metadata still
come from storage.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from docfusion.api.endpoints.document_endpoints import DocumentEndpoints
from docfusion.api.serializers.document_serializers import (
	OutputFormat,
	RenderRequest,
)


# ---------------------------------------------------------------------------
# Schema-level validation
# ---------------------------------------------------------------------------


class TestRenderRequestSchema:
	def test_accepts_content_override(self):
		req = RenderRequest(
			output_format=OutputFormat.PDF,
			content_override="<h1>Live editor HTML</h1>",
		)
		assert req.content_override == "<h1>Live editor HTML</h1>"

	def test_content_override_optional(self):
		req = RenderRequest(output_format=OutputFormat.PDF)
		assert req.content_override is None

	def test_rejects_empty_content_override(self):
		# Empty string is meaningless — caller should omit the field
		# entirely rather than send "". min_length=1 enforces this.
		with pytest.raises(ValidationError):
			RenderRequest(output_format=OutputFormat.PDF, content_override="")

	def test_rejects_oversized_content_override(self):
		# max_length caps render-time work. 2_000_001 chars exceeds the
		# 2MB bound and should be rejected at schema validation, well
		# before the renderer gets a chance to chew on it.
		huge = "a" * 2_000_001
		with pytest.raises(ValidationError):
			RenderRequest(output_format=OutputFormat.PDF, content_override=huge)

	def test_accepts_content_override_at_max_length(self):
		# Boundary case — exactly 2_000_000 chars is allowed.
		at_limit = "a" * 2_000_000
		req = RenderRequest(
			output_format=OutputFormat.PDF, content_override=at_limit
		)
		assert req.content_override is not None
		assert len(req.content_override) == 2_000_000

	def test_extra_fields_still_forbidden(self):
		# Guards against the original Bug 1 fix path where callers might
		# try to pass arbitrary keys hoping the backend reads them.
		with pytest.raises(ValidationError):
			RenderRequest(  # type: ignore[call-arg]
				output_format=OutputFormat.PDF,
				bogus_field="should-fail",
			)


# ---------------------------------------------------------------------------
# Handler behaviour — uses override when present, storage otherwise
# ---------------------------------------------------------------------------


STORED_DOC: dict[str, Any] = {
	"title": "Quarterly Report",
	"content": "Stored body — predates the unsaved edits.",
	"metadata": {"category": "report"},
}


class _StorageStub:
	"""Minimal SecureStorageService stand-in for handler-only tests."""

	async def get_document(self, **kwargs: Any) -> dict[str, Any]:
		return {"success": True, "document": STORED_DOC, "permission_level": "owner"}


class _EngineStub:
	"""Captures the content_data passed to generate_document so the test
	can assert which body the handler chose."""

	def __init__(self) -> None:
		self.last_content_data: dict[str, Any] | None = None

	async def generate_document(self, **kwargs: Any) -> dict[str, Any]:
		self.last_content_data = kwargs.get("content_data")
		return {"success": True, "rendered_bytes": b"%PDF-1.4 fake render bytes"}


def _make_endpoints() -> DocumentEndpoints:
	# DocumentEndpoints.__init__ calls _register_endpoints which expects
	# concrete services, but the handler methods we exercise only touch
	# self.storage and self.document_engine — the rest can be None.
	endpoints = DocumentEndpoints.__new__(DocumentEndpoints)
	endpoints.storage = _StorageStub()  # type: ignore[assignment]
	endpoints.document_engine = _EngineStub()  # type: ignore[assignment]
	endpoints.security = None  # type: ignore[assignment]
	import logging

	endpoints.logger = logging.getLogger("test")
	return endpoints


CURRENT_USER = {
	"user_id": "u-1",
	"organization_id": "o-1",
	"roles": [],
}


class TestRenderHandlerContentOverride:
	async def test_uses_override_when_provided(self):
		endpoints = _make_endpoints()
		live_html = "<h1>Unsaved edits</h1><p>Body changed in the editor.</p>"

		req = RenderRequest(
			output_format=OutputFormat.PDF, content_override=live_html
		)

		await endpoints.render_document_handler("doc-1", req, CURRENT_USER)

		captured = endpoints.document_engine.last_content_data  # type: ignore[attr-defined]
		assert captured is not None
		assert captured["content"] == live_html, (
			"content_override must replace the stored body when present"
		)
		# Title and metadata always come from storage even with override.
		assert captured["title"] == STORED_DOC["title"]
		assert captured["metadata"] == STORED_DOC["metadata"]

	async def test_falls_back_to_stored_content(self):
		endpoints = _make_endpoints()
		req = RenderRequest(output_format=OutputFormat.PDF)

		await endpoints.render_document_handler("doc-1", req, CURRENT_USER)

		captured = endpoints.document_engine.last_content_data  # type: ignore[attr-defined]
		assert captured is not None
		assert captured["content"] == STORED_DOC["content"]
