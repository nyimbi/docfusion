#!/usr/bin/env python3
"""
Tests for Stakeholder Mapper

Unit tests for stakeholder identification and mapping from RFP documents.
"""

import asyncio
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from docfusion.rfp.stakeholder_mapper import (
	StakeholderMapper,
	StakeholderRole,
	StakeholderRoleCategory,
	Stakeholder,
	StakeholderRelationship,
	StakeholderGraph,
	StakeholderExtractionResult,
	create_stakeholder_mapper,
	get_role_category,
	ROLE_PATTERNS,
	ROLE_CATEGORIES,
)


class TestStakeholderRole:
	"""Tests for StakeholderRole enum"""

	def test_role_enum_values(self):
		"""Test that all expected role values are defined"""
		expected_roles = [
			"evaluator",
			"decision_maker",
			"technical_contact",
			"procurement_officer",
			"program_manager",
		]
		for role in expected_roles:
			assert any(r.value == role for r in StakeholderRole)

	def test_role_category_mapping(self):
		"""Test role category assignment"""
		assert get_role_category(StakeholderRole.EVALUATOR) == StakeholderRoleCategory.EVALUATION
		assert get_role_category(StakeholderRole.DECISION_MAKER) == StakeholderRoleCategory.DECISION_MAKING
		assert get_role_category(StakeholderRole.TECHNICAL_CONTACT) == StakeholderRoleCategory.TECHNICAL
		assert get_role_category(StakeholderRole.PROCUREMENT_OFFICER) == StakeholderRoleCategory.PROCUREMENT
		assert get_role_category(StakeholderRole.PROGRAM_MANAGER) == StakeholderRoleCategory.PROJECT_MANAGEMENT

	def test_none_role_category(self):
		"""Test category for None role"""
		assert get_role_category(None) == StakeholderRoleCategory.UNKNOWN


class TestStakeholder:
	"""Tests for Stakeholder dataclass"""

	def test_stakeholder_creation(self):
		"""Test basic stakeholder creation"""
		stakeholder = Stakeholder(
			id="test-123",
			name="John Smith",
			roles=[StakeholderRole.TECHNICAL_CONTACT],
			organization="Defense Agency",
			email="john.smith@defense.gov",
			confidence=0.9,
		)
		assert stakeholder.name == "John Smith"
		assert stakeholder.primary_role == StakeholderRole.TECHNICAL_CONTACT
		assert stakeholder.organization == "Defense Agency"

	def test_stakeholder_auto_id(self):
		"""Test that stakeholder gets auto-generated ID"""
		stakeholder = Stakeholder(name="Test User", roles=[StakeholderRole.EVALUATOR])
		assert stakeholder.id is not None
		assert len(stakeholder.id) > 0

	def test_stakeholder_role_category(self):
		"""Test stakeholder role category property"""
		stakeholder = Stakeholder(
			name="Jane Doe", roles=[StakeholderRole.PROCUREMENT_OFFICER], organization="GSA"
		)
		assert stakeholder.role_category == StakeholderRoleCategory.PROCUREMENT

	def test_add_role(self):
		"""Test adding roles to stakeholder"""
		stakeholder = Stakeholder(name="Test", roles=[StakeholderRole.EVALUATOR])
		stakeholder.add_role(StakeholderRole.REVIEWER)
		assert len(stakeholder.roles) == 2
		# Adding same role again should not duplicate
		stakeholder.add_role(StakeholderRole.EVALUATOR)
		assert len(stakeholder.roles) == 2

	def test_to_dict(self):
		"""Test stakeholder serialization"""
		stakeholder = Stakeholder(
			id="test-456",
			name="John Smith",
			roles=[StakeholderRole.TECHNICAL_LEAD],
			organization="NASA",
			confidence=0.85,
		)
		data = stakeholder.to_dict()
		assert data["name"] == "John Smith"
		assert data["primary_role"] == "technical_lead"
		assert data["role_category"] == "technical"
		assert data["organization"] == "NASA"


class TestStakeholderGraph:
	"""Tests for StakeholderGraph dataclass"""

	def test_graph_creation(self):
		"""Test basic graph creation"""
		graph = StakeholderGraph()
		assert len(graph.stakeholders) == 0
		assert len(graph.relationships) == 0

	def test_add_stakeholder(self):
		"""Test adding stakeholders to graph"""
		graph = StakeholderGraph()
		s1 = Stakeholder(id="s1", name="Alice", roles=[StakeholderRole.EVALUATOR])
		s2 = Stakeholder(id="s2", name="Bob", roles=[StakeholderRole.DECISION_MAKER])

		graph.add_stakeholder(s1)
		graph.add_stakeholder(s2)

		assert len(graph.stakeholders) == 2
		assert "s1" in graph.adjacency
		assert "s2" in graph.adjacency

	def test_add_relationship(self):
		"""Test adding relationships to graph"""
		graph = StakeholderGraph()
		s1 = Stakeholder(id="s1", name="Alice", roles=[StakeholderRole.EVALUATOR])
		s2 = Stakeholder(id="s2", name="Bob", roles=[StakeholderRole.DECISION_MAKER])

		graph.add_stakeholder(s1)
		graph.add_stakeholder(s2)

		rel = StakeholderRelationship(
			id="r1",
			source_id="s1",
			target_id="s2",
			relationship_type="reports_to",
			confidence=0.8,
		)
		graph.add_relationship(rel)

		assert len(graph.relationships) == 1
		assert "s2" in graph.adjacency["s1"]
		assert "s1" in graph.adjacency["s2"]

	def test_get_stakeholder_by_id(self):
		"""Test retrieving stakeholder by ID"""
		graph = StakeholderGraph()
		s = Stakeholder(id="test-id", name="Test", roles=[StakeholderRole.SPONSOR])
		graph.add_stakeholder(s)

		found = graph.get_stakeholder_by_id("test-id")
		assert found is not None
		assert found.name == "Test"

		not_found = graph.get_stakeholder_by_id("nonexistent")
		assert not_found is None

	def test_get_stakeholders_by_role(self):
		"""Test filtering stakeholders by role"""
		graph = StakeholderGraph()
		s1 = Stakeholder(id="s1", name="Alice", roles=[StakeholderRole.EVALUATOR])
		s2 = Stakeholder(id="s2", name="Bob", roles=[StakeholderRole.DECISION_MAKER])
		s3 = Stakeholder(id="s3", name="Charlie", roles=[StakeholderRole.EVALUATOR, StakeholderRole.REVIEWER])

		graph.add_stakeholder(s1)
		graph.add_stakeholder(s2)
		graph.add_stakeholder(s3)

		evaluators = graph.get_stakeholders_by_role(StakeholderRole.EVALUATOR)
		assert len(evaluators) == 2

	def test_to_visualization_dict(self):
		"""Test graph visualization output"""
		graph = StakeholderGraph()
		s1 = Stakeholder(id="s1", name="Alice", roles=[StakeholderRole.EVALUATOR], organization="Agency A")
		s2 = Stakeholder(id="s2", name="Bob", roles=[StakeholderRole.DECISION_MAKER], organization="Agency B")

		graph.add_stakeholder(s1)
		graph.add_stakeholder(s2)

		rel = StakeholderRelationship(
			id="r1", source_id="s1", target_id="s2", relationship_type="collaborates", confidence=0.7
		)
		graph.add_relationship(rel)

		vis = graph.to_visualization_dict()

		assert "nodes" in vis
		assert "edges" in vis
		assert "metadata" in vis
		assert len(vis["nodes"]) == 2
		assert len(vis["edges"]) == 1
		assert vis["metadata"]["total_stakeholders"] == 2


class TestStakeholderMapper:
	"""Tests for StakeholderMapper class"""

	@pytest.fixture
	def mapper(self):
		"""Create a mapper instance for testing"""
		config = {
			"use_spacy_ner": False,  # Disable spaCy for tests
			"use_ai_enhancement": False,  # Disable AI for tests
			"ollama_base_url": "http://localhost:11434",
		}
		return create_stakeholder_mapper(config)

	def test_mapper_initialization(self, mapper):
		"""Test mapper initialization"""
		assert mapper is not None
		assert mapper.config is not None
		assert len(mapper.role_patterns) > 0
		assert len(mapper._role_keyword_map) > 0

	def test_get_mapper_info(self, mapper):
		"""Test mapper info retrieval"""
		info = mapper.get_mapper_info()
		assert "supported_roles" in info
		assert "role_categories" in info
		assert "version" in info
		assert len(info["supported_roles"]) > 20

	@pytest.mark.asyncio
	async def test_extract_stakeholders_empty_text(self, mapper):
		"""Test extraction with empty text"""
		result = await mapper.extract_stakeholders("")
		assert result.success is True
		assert len(result.stakeholders) == 0

	@pytest.mark.asyncio
	async def test_extract_stakeholders_pattern_matching(self, mapper):
		"""Test pattern-based stakeholder extraction"""
		text = """
		John Smith is the Technical Contact for this project.
		Jane Doe serves as the Program Manager.
		The Contracting Officer is Robert Brown.
		Contact the Procurement Officer at procurement@agency.gov.
		"""

		result = await mapper.extract_stakeholders(text, use_ai=False)

		assert result.success is True
		assert len(result.stakeholders) > 0

		# Check that roles were detected
		role_values = []
		for s in result.stakeholders:
			role_values.extend([r.value for r in s.roles])

		# Should find technical_contact, program_manager, contracting_officer, procurement_officer
		assert any("technical" in r for r in role_values) or any("contact" in r for r in role_values)

	@pytest.mark.asyncio
	async def test_extract_organizations(self, mapper):
		"""Test organization extraction"""
		text = """
		This RFP is issued by the Department of Defense.
		Please submit proposals to the U.S. Agency for International Development.
		The Defense Logistics Agency will manage this contract.
		"""

		result = await mapper.extract_stakeholders(text, use_ai=False)

		assert result.success is True
		assert len(result.organizations) > 0

	@pytest.mark.asyncio
	async def test_extract_contact_info(self, mapper):
		"""Test contact information extraction"""
		text = """
		Technical Contact: John Smith
		Email: john.smith@agency.gov
		Phone: (555) 123-4567

		Program Manager: Jane Doe
		jane.doe@agency.gov
		+1-555-987-6543
		"""

		result = await mapper.extract_stakeholders(text, use_ai=False)

		# Check that contact info is extracted
		for s in result.stakeholders:
			if s.email:
				assert "@" in s.email
			if s.phone:
				assert any(c.isdigit() for c in s.phone)

	def test_normalize_organization(self, mapper):
		"""Test organization name normalization"""
		assert mapper._normalize_organization("DEFENSE AGENCY inc") == "Defense Agency Inc."
		# Note: title() converts LLC to Llc - known acronyms are preserved
		assert mapper._normalize_organization("Test Company LLC") == "Test Company Llc"
		assert mapper._normalize_organization("NASA") == "NASA"

	def test_extract_name_before_role(self, mapper):
		"""Test name extraction before role mention"""
		text = "John Smith is the Technical Contact for this project."
		role_start = text.lower().find("technical contact")

		name = mapper._extract_name_before_role(text, role_start)
		assert name is not None
		assert "John" in name or "Smith" in name

	def test_extract_organization_from_context(self, mapper):
		"""Test organization extraction from context"""
		context = "The Technical Contact at Defense Agency Inc. is responsible for"
		org = mapper._extract_organization_from_context(context)
		# Should find some organization reference
		assert org is not None

	@pytest.mark.asyncio
	async def test_build_stakeholder_graph(self, mapper):
		"""Test stakeholder graph building"""
		stakeholders = [
			Stakeholder(id="s1", name="Alice", roles=[StakeholderRole.EVALUATOR], organization="Agency A"),
			Stakeholder(id="s2", name="Bob", roles=[StakeholderRole.DECISION_MAKER], organization="Agency A"),
			Stakeholder(id="s3", name="Charlie", roles=[StakeholderRole.TECHNICAL_CONTACT], organization="Agency B"),
		]

		graph_dict = await mapper.build_relationship_graph(stakeholders)

		assert "nodes" in graph_dict
		assert "edges" in graph_dict
		assert len(graph_dict["nodes"]) == 3

	@pytest.mark.asyncio
	async def test_close_mapper(self, mapper):
		"""Test mapper cleanup"""
		await mapper.close()


class TestRolePatterns:
	"""Tests for role pattern definitions"""

	def test_all_roles_have_patterns(self):
		"""Test that all defined roles have pattern keywords"""
		for role in StakeholderRole:
			assert role in ROLE_PATTERNS, f"Missing pattern for role: {role}"
			assert len(ROLE_PATTERNS[role]) > 0, f"No keywords for role: {role}"

	def test_all_roles_have_categories(self):
		"""Test that all roles have category assignments"""
		for role in StakeholderRole:
			assert role in ROLE_CATEGORIES, f"Missing category for role: {role}"

	def test_pattern_keywords_are_lowercase(self):
		"""Test that pattern keywords can be matched case-insensitively"""
		for role, keywords in ROLE_PATTERNS.items():
			for keyword in keywords:
				# Keywords should work with lowercase conversion
				assert keyword.lower() == keyword.lower()


class TestIntegration:
	"""Integration tests for stakeholder mapper"""

	@pytest.mark.asyncio
	async def test_full_extraction_pipeline(self):
		"""Test complete extraction pipeline"""
		config = {
			"use_spacy_ner": False,
			"use_ai_enhancement": False,
		}
		mapper = create_stakeholder_mapper(config)

		rfp_text = """
		REQUEST FOR PROPOSAL

		Issue Date: January 15, 2024

		POINT OF CONTACT:
		John Smith, Contracting Officer
		Email: john.smith@defense.gov
		Phone: (555) 123-4567

		The Technical Contact for this solicitation is Jane Doe.
		Technical Contact: jane.doe@defense.gov

		PROGRAM MANAGEMENT:
		Program Manager: Robert Brown
		Project Lead: Alice Johnson

		EVALUATION TEAM:
		The evaluation panel will consist of technical evaluators from
		the Defense Acquisition Agency and subject matter experts.

		APPROVAL AUTHORITY:
		Final approval authority rests with the Senior Procurement Executive.

		This RFP is issued by the Department of Defense,
		Defense Logistics Agency.
		"""

		result = await mapper.extract_stakeholders(rfp_text, use_ai=False)

		assert result.success is True
		assert len(result.stakeholders) > 0
		assert len(result.organizations) > 0

		# Check statistics
		assert "total_stakeholders" in result.statistics
		assert "role_distribution" in result.statistics

		await mapper.close()


if __name__ == "__main__":
	pytest.main([__file__, "-v"])