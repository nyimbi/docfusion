"""Tests for template population via composition runner endpoint."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from docfusion.api.endpoints.template_endpoints import TemplateEndpoints
from docfusion.api.serializers.template_serializers import (
	OutputFormat,
	TemplatePopulateRequest,
)
from docfusion.security import SecurityManager
from docfusion.storage.secure_storage_service import SecureStorageService


class MockSecurityManager:
	async def check_permission(self, user_id, resource, action, context=None):
		class Result:
			has_permission = True
		return Result()

	async def log_security_violation(self, *args, **kwargs):
		pass

	async def grant_document_access(self, *args, **kwargs):
		pass

	class audit:
		@staticmethod
		async def log_event(*args, **kwargs):
			pass


class MockStorageService:
	pass


class MockDocumentEngine:
	async def get_template_info(self, template_id, user_id, context=None):
		if template_id == "nonexistent-template":
			return {"success": False, "error": "Template not found"}
		return {
			"success": True,
			"template": {
				"template_id": template_id,
				"name": "Test Template",
				"content": "Title: {title}\\nContent: {content}\\nAuthor: {author}",
				"fields": [
					{"name": "title", "required": True},
					{"name": "content", "required": True},
					{"name": "author", "required": False},
				],
			},
		}

	async def generate_document(self, template_id, content_data, user_id, output_format="pdf", metadata=None, context=None):
		from datetime import datetime, timezone
		from docfusion.core.utils import uuid7str
		return {
			"success": True,
			"document_id": uuid7str(),
			"output_format": output_format,
			"generated_at": datetime.now(timezone.utc).isoformat(),
			"file_path": f"/generated/{uuid7str()}.{output_format}",
		}


@pytest.fixture
def endpoints():
	security = MockSecurityManager()
	storage = MockStorageService()
	engine = MockDocumentEngine()
	return TemplateEndpoints(storage, engine, security)


@pytest.fixture
def mock_user():
	return {"user_id": "user-123", "permissions": ["template:read", "template:write"]}


async def test_populate_template_missing_required_variables(endpoints, mock_user):
	request = TemplatePopulateRequest(
		variables={"title": "Test Proposal"},
		output_format=OutputFormat.PDF,
	)
	result = await endpoints.populate_template_handler(
		template_id="template_0", request=request, current_user=mock_user
	)
	assert result["success"] is False
	assert len(result["missing_variables"]) > 0
	assert "title" not in result["missing_variables"]


async def test_populate_template_success(endpoints, mock_user):
	request = TemplatePopulateRequest(
		variables={"title": "Test Proposal", "content": "Hello World", "author": "Alice"},
		output_format=OutputFormat.HTML,
	)
	result = await endpoints.populate_template_handler(
		template_id="template_0", request=request, current_user=mock_user
	)
	assert result["success"] is True
	assert result["template_id"] == "template_0"
	assert result["content"] is not None
	assert "Test Proposal" in result["content"]
	assert "Hello World" in result["content"]
	assert result["missing_variables"] == []
	assert result["errors"] == []


async def test_populate_template_not_found(endpoints, mock_user):
	request = TemplatePopulateRequest(
		variables={"title": "Test"},
		output_format=OutputFormat.PDF,
	)
	with pytest.raises(HTTPException) as exc_info:
		await endpoints.populate_template_handler(
			template_id="nonexistent-template", request=request, current_user=mock_user
		)
	assert exc_info.value.status_code == 404
