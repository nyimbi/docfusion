#!/usr/bin/env python3
"""Round-trip persistence coverage for compliance matrices."""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.rfp.compliance_matrix import (
	ComplianceMatrix,
	ComplianceMatrixGenerator,
	ComplianceStatus,
	RequirementMapping,
)
from docfusion.rfp.requirement_extractor import RequirementCategory, RequirementType


def _make_mock_result(rows):
	"""Build a mock SQLAlchemy result from a list of dicts."""
	mock = MagicMock()
	mock.mappings.return_value.first = MagicMock(return_value=rows[0] if rows else None)
	mock.mappings.return_value.all = MagicMock(return_value=rows)
	return mock


class TestPersistence:
	"""Tests for ComplianceMatrixGenerator database persistence."""

	@pytest.fixture
	def sample_matrix(self):
		"""Create a sample compliance matrix."""
		matrix = ComplianceMatrix(
			rfp_id="rfp-123",
			name="Test Matrix",
			description="A test matrix",
		)
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-1",
			requirement_text="Must support 1000 users",
			status=ComplianceStatus.ADDRESSED,
			confidence=0.95,
			category=RequirementCategory.MANDATORY,
			requirement_type=RequirementType.PERFORMANCE,
		))
		matrix.add_mapping(RequirementMapping(
			requirement_id="req-2",
			requirement_text="Should have mobile app",
			status=ComplianceStatus.NOT_ADDRESSED,
			confidence=0.85,
			category=RequirementCategory.OPTIONAL,
			requirement_type=RequirementType.FUNCTIONAL,
		))
		return matrix

	@pytest.mark.asyncio
	async def test_save_to_db_inserts_matrix_and_entries(self, sample_matrix):
		"""Test save_to_db executes correct insert statements."""
		generator = ComplianceMatrixGenerator()
		session = AsyncMock()

		matrix_id = await generator.save_to_db(session, sample_matrix)

		assert matrix_id == sample_matrix.id
		# Should have executed: 1 upsert for matrix + 1 delete + 2 inserts for entries = 4 calls
		assert session.execute.call_count == 4
		session.commit.assert_awaited_once()

	@pytest.mark.asyncio
	async def test_load_from_db_reconstructs_matrix(self):
		"""Test load_from_db rebuilds ComplianceMatrix from DB rows."""
		generator = ComplianceMatrixGenerator()
		session = AsyncMock()

		now = datetime.now(timezone.utc)
		matrix_row = {
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"opportunity_id": "rfp-123",
			"name": "Loaded Matrix",
			"description": "Loaded description",
			"metadata": {"source": "test"},
			"created_at": now,
			"updated_at": now,
		}
		entry_rows = [
			{
				"id": "660e8400-e29b-41d4-a716-446655440001",
				"requirement_id": "req-1",
				"compliance_status": "addressed",
				"response_summary": "Section 3.1",
				"reviewer_notes": "Looks good",
				"metadata": {
					"confidence": 0.95,
					"category": "mandatory",
					"requirement_type": "performance",
					"source_section": "Technical",
					"page_number": 5,
				},
			},
		]

		# Configure mock to return matrix_row on first call, entries on second
		call_count = 0
		async def mock_execute(stmt, params=None):
			nonlocal call_count
			call_count += 1
			mock_result = MagicMock()
			if call_count == 1:
				mock_result.mappings.return_value.first = MagicMock(return_value=matrix_row)
				mock_result.mappings.return_value.all = MagicMock(return_value=[])
			else:
				mock_result.mappings.return_value.first = MagicMock(return_value=None)
				mock_result.mappings.return_value.all = MagicMock(return_value=entry_rows)
			return mock_result

		session.execute = mock_execute

		loaded = await ComplianceMatrixGenerator.load_from_db(
			"550e8400-e29b-41d4-a716-446655440000", session
		)

		assert loaded.rfp_id == "rfp-123"
		assert loaded.name == "Loaded Matrix"
		assert loaded.description == "Loaded description"
		assert loaded.metadata == {"source": "test"}
		assert len(loaded.mappings) == 1

		mapping = loaded.mappings[0]
		assert mapping.requirement_id == "req-1"
		assert mapping.status == ComplianceStatus.ADDRESSED
		assert mapping.confidence == 0.95
		assert mapping.category == RequirementCategory.MANDATORY
		assert mapping.requirement_type == RequirementType.PERFORMANCE
		assert mapping.notes == "Looks good"
		assert mapping.source_section == "Technical"
		assert mapping.page_number == 5

	@pytest.mark.asyncio
	async def test_load_from_db_missing_matrix_raises(self):
		"""Test loading a non-existent matrix raises ValueError."""
		session = AsyncMock()
		mock_result = MagicMock()
		mock_result.mappings.return_value.first = MagicMock(return_value=None)
		session.execute = AsyncMock(return_value=mock_result)

		with pytest.raises(ValueError, match="No compliance matrix with id"):
			await ComplianceMatrixGenerator.load_from_db("missing-id", session)

	@pytest.mark.asyncio
	async def test_save_overwrites_existing_entries(self, sample_matrix):
		"""Test saving twice replaces entries atomically."""
		generator = ComplianceMatrixGenerator()
		session = AsyncMock()

		# First save
		mid = await generator.save_to_db(session, sample_matrix)
		assert mid == sample_matrix.id

		# Clear mock
		session.reset_mock()

		# Second save with modified matrix
		sample_matrix.mappings[0].status = ComplianceStatus.VERIFIED
		mid2 = await generator.save_to_db(session, sample_matrix)
		assert mid2 == mid

		# Should still execute delete + inserts
		assert session.execute.call_count == 4
		session.commit.assert_awaited_once()

	@pytest.mark.asyncio
	async def test_save_calculates_counts_correctly(self, sample_matrix):
		"""Test save computes compliance counts from mappings."""
		generator = ComplianceMatrixGenerator()
		session = AsyncMock()
		calls = []

		async def capture_execute(stmt, params=None):
			calls.append(params)
			mock_result = MagicMock()
			mock_result.mappings.return_value.first = MagicMock(return_value=None)
			mock_result.mappings.return_value.all = MagicMock(return_value=[])
			return mock_result

		session.execute = capture_execute

		await generator.save_to_db(session, sample_matrix)

		# First call is the matrix upsert
		matrix_params = calls[0]
		assert matrix_params["total_requirements"] == 2
		assert matrix_params["mandatory_count"] == 1
		assert matrix_params["compliant_count"] == 1
		assert matrix_params["partial_count"] == 0
		assert matrix_params["not_addressed_count"] == 1
		assert matrix_params["compliance_score"] == 0.5
		assert matrix_params["mandatory_compliance_score"] == 1.0


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
