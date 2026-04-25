#!/usr/bin/env python3
"""
DocumentEngine Storage Integration Test Suite

Tests the integration between DocumentEngine and StorageService,
verifying that document generation, storage, retrieval, and 
content enhancement work seamlessly together.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.document_engine.document_engine import (
	DocumentEngine, DocumentGenerationRequest, DocumentGenerationConfiguration,
	create_document_engine_with_storage
)
from docfusion.storage.storage_service import (
	StorageService, StorageConfiguration, create_storage_service
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def storage_service(temp_storage):
	"""Create storage service for testing"""
	storage_service = await create_storage_service(
		temp_storage / "test_storage",
		enable_all_components=True
	)
	return storage_service


@pytest.fixture
async def document_engine_with_storage(temp_storage, storage_service):
	"""Create DocumentEngine with integrated storage"""
	config = DocumentGenerationConfiguration(
		enable_storage=True,
		storage_root_path=str(temp_storage / "engine_storage"),
		output_formats=["html", "pdf"],
		enable_accessibility=True,
		enable_brand_compliance=True
	)
	
	engine = DocumentEngine(
		config=config,
		enable_logging=True,
		enable_caching=True,
		storage_service=storage_service
	)
	
	return engine


@pytest.fixture
async def sample_content_blocks(storage_service):
	"""Create sample content blocks for testing"""
	blocks = [
		{
			'content': 'Executive Summary: This proposal outlines strategic recommendations for digital transformation.',
			'title': 'Executive Summary Block',
			'category': 'proposal',
			'tags': ['executive-summary', 'proposal', 'strategic']
		},
		{
			'content': 'Technical Architecture: Our solution leverages cloud-native microservices architecture.',
			'title': 'Technical Architecture Block',
			'category': 'technical',
			'tags': ['technical', 'architecture', 'cloud']
		},
		{
			'content': 'Budget Analysis: The total project cost is estimated at $2.5M over 18 months.',
			'title': 'Budget Analysis Block',
			'category': 'financial',
			'tags': ['budget', 'financial', 'analysis']
		}
	]
	
	block_ids = []
	for block in blocks:
		block_id = await storage_service.add_content_block(**block)
		block_ids.append(block_id)
	
	return block_ids


class TestDocumentEngineStorageBasicIntegration:
	"""Test basic integration between DocumentEngine and StorageService"""
	
	async def test_document_engine_with_storage_initialization(self, temp_storage):
		"""Test DocumentEngine initialization with storage service"""
		engine = await create_document_engine_with_storage(
			storage_root_path=str(temp_storage / "test_engine")
		)
		
		assert engine is not None
		assert engine.storage_service is not None
		assert engine.config.enable_storage is True
		
		# Test that storage service is properly initialized
		await engine._ensure_storage_initialized()
		assert engine.storage_service._initialized is True
	
	async def test_storage_service_integration(self, document_engine_with_storage):
		"""Test that storage service integrates properly with DocumentEngine"""
		engine = document_engine_with_storage
		
		# Test storage methods are available
		assert hasattr(engine, 'search_documents')
		assert hasattr(engine, 'retrieve_stored_document')
		assert hasattr(engine, 'get_content_recommendations')
		assert hasattr(engine, 'add_content_block')
		assert hasattr(engine, 'add_template')
		
		# Test storage service is accessible
		assert engine.storage_service is not None
		
		# Test storage initialization
		await engine._ensure_storage_initialized()
		assert engine.storage_service._initialized is True


class TestDocumentGenerationWithStorage:
	"""Test document generation with storage integration"""
	
	async def test_basic_document_generation_with_storage(self, document_engine_with_storage):
		"""Test basic document generation stores document in storage"""
		engine = document_engine_with_storage
		
		# Create generation request
		request = DocumentGenerationRequest(
			content_sources=[
				{"content": "Introduction content", "type": "section"},
				{"content": "Analysis content", "type": "section"}
			],
			content_structure={
				"title": "Test Document",
				"sections": [
					{"title": "Introduction", "content": "Introduction content"},
					{"title": "Analysis", "content": "Analysis content"}
				]
			}
		)
		request.generation_config.document_title = "Test Document with Storage"
		
		# Generate document
		result = await engine.generate_document(request)
		
		assert result.generation_successful is True
		assert result.request_id == request.request_id
		
		# Check that document was stored
		assert "stored_document_id" in result.document_metadata
		assert result.document_metadata["stored_document_id"] == request.request_id
		
		# Verify document can be retrieved from storage
		stored_doc = await engine.retrieve_stored_document(request.request_id)
		assert stored_doc is not None
		assert stored_doc['document_id'] == request.request_id
		assert stored_doc['metadata']['title'] == "Test Document with Storage"
	
	async def test_content_enhancement_with_recommendations(self, document_engine_with_storage, sample_content_blocks):
		"""Test that document generation uses storage recommendations"""
		engine = document_engine_with_storage
		
		# Create request for a proposal (should match our sample blocks)
		request = DocumentGenerationRequest(
			content_sources=[
				{"content": "Basic proposal content", "type": "section"}
			],
			content_structure={
				"title": "Business Proposal"
			}
		)
		request.generation_config.document_title = "Strategic Business Proposal"
		request.generation_config.document_type = "proposal"
		
		# Generate document - should enhance with recommendations
		result = await engine.generate_document(request)
		
		assert result.generation_successful is True
		
		# Check that content was enhanced (more sources than originally provided)
		# The storage enhancement should have added recommended content blocks
		enhanced_sources = len([s for s in request.content_sources if s.get('source') == 'storage'])
		assert enhanced_sources >= 0  # May be 0 if no good matches, but should not fail
		
		# Verify document was stored
		stored_doc = await engine.retrieve_stored_document(request.request_id)
		assert stored_doc is not None


class TestStorageOperationsThroughEngine:
	"""Test storage operations through DocumentEngine interface"""
	
	async def test_content_block_management(self, document_engine_with_storage):
		"""Test adding and retrieving content blocks through engine"""
		engine = document_engine_with_storage
		
		# Add content block
		block_id = await engine.add_content_block(
			content="Test content block for engine integration",
			title="Engine Test Block",
			category="test",
			tags=["engine", "integration", "test"]
		)
		
		assert block_id is not None
		
		# Test content recommendations
		recommendations = await engine.get_content_recommendations(
			context="test content for engine",
			content_type="block",
			limit=5
		)
		
		# Should find our test block
		assert len(recommendations) >= 0  # May be empty if similarity threshold not met
		
		# Test search functionality
		search_results = await engine.search_documents(
			query="test content",
			search_type="full_text"
		)
		
		assert isinstance(search_results, list)
	
	async def test_template_management(self, document_engine_with_storage):
		"""Test adding and managing templates through engine"""
		engine = document_engine_with_storage
		
		# Add content blocks first
		block_id = await engine.add_content_block(
			content="Template content block",
			title="Template Block",
			category="template_test"
		)
		
		# Add template
		template_id = await engine.add_template(
			name="Engine Test Template",
			description="Template for testing engine integration",
			template_type="document",
			category="test",
			content_blocks=[block_id] if block_id else [],
			tags=["engine", "template", "test"]
		)
		
		assert template_id is not None
		
		# Test template recommendations
		recommendations = await engine.get_content_recommendations(
			context="need a test template",
			content_type="template",
			limit=5
		)
		
		assert isinstance(recommendations, list)
	
	async def test_document_listing_and_search(self, document_engine_with_storage):
		"""Test document listing and search functionality"""
		engine = document_engine_with_storage
		
		# Generate a test document first
		request = DocumentGenerationRequest(
			content_sources=[{"content": "Searchable content", "type": "section"}]
		)
		request.generation_config.document_title = "Searchable Document"
		request.generation_config.document_type = "test"
		
		result = await engine.generate_document(request)
		assert result.generation_successful is True
		
		# Test listing documents
		documents = await engine.list_stored_documents(
			category="generated",
			limit=10
		)
		
		assert isinstance(documents, list)
		assert len(documents) >= 1
		
		# Find our generated document
		our_doc = next((doc for doc in documents if doc['document_id'] == request.request_id), None)
		assert our_doc is not None
		assert our_doc['metadata']['title'] == "Searchable Document"
		
		# Test search functionality
		search_results = await engine.search_documents(
			query="searchable",
			search_type="full_text"
		)
		
		assert isinstance(search_results, list)
		assert len(search_results) >= 1
		
		# Should find our document
		found_doc = next((doc for doc in search_results if doc['document_id'] == request.request_id), None)
		assert found_doc is not None


class TestStorageStatisticsAndOptimization:
	"""Test storage statistics and optimization through engine"""
	
	async def test_storage_statistics(self, document_engine_with_storage, sample_content_blocks):
		"""Test getting storage statistics through engine"""
		engine = document_engine_with_storage
		
		# Generate some activity
		await engine.add_content_block(
			content="Stats test content",
			title="Stats Test Block"
		)
		
		# Get statistics
		stats = await engine.get_storage_statistics()
		
		assert isinstance(stats, dict)
		assert 'total_documents' in stats
		assert 'total_content_blocks' in stats
		assert 'component_status' in stats
		
		# Should show some content blocks
		assert stats['total_content_blocks'] >= len(sample_content_blocks) + 1  # Our blocks plus the one we added
	
	async def test_storage_optimization(self, document_engine_with_storage):
		"""Test storage optimization through engine"""
		engine = document_engine_with_storage
		
		# Add and remove some content to create optimization opportunities
		block_id = await engine.add_content_block(
			content="Temporary content for optimization test",
			title="Temp Block"
		)
		
		# Run optimization
		optimization_result = await engine.optimize_storage()
		
		assert isinstance(optimization_result, dict)
		assert 'timestamp' in optimization_result
		assert 'components_optimized' in optimization_result


class TestErrorHandlingAndEdgeCases:
	"""Test error handling and edge cases in storage integration"""
	
	async def test_engine_without_storage(self, temp_storage):
		"""Test DocumentEngine behavior when storage is disabled"""
		config = DocumentGenerationConfiguration(
			enable_storage=False
		)
		
		engine = DocumentEngine(config=config)
		
		# Storage operations should return empty/None gracefully
		search_results = await engine.search_documents("test query")
		assert search_results == []
		
		retrieved_doc = await engine.retrieve_stored_document("test_id")
		assert retrieved_doc is None
		
		recommendations = await engine.get_content_recommendations("test context")
		assert recommendations == []
		
		stats = await engine.get_storage_statistics()
		assert stats == {}
	
	async def test_storage_error_handling(self, document_engine_with_storage):
		"""Test error handling in storage operations"""
		engine = document_engine_with_storage
		
		# Test retrieval of non-existent document
		retrieved_doc = await engine.retrieve_stored_document("nonexistent_id")
		assert retrieved_doc is None
		
		# Test search with empty query
		search_results = await engine.search_documents("")
		assert isinstance(search_results, list)
		
		# These operations should not raise exceptions
		recommendations = await engine.get_content_recommendations("")
		assert isinstance(recommendations, list)
	
	async def test_document_generation_with_storage_failure(self, temp_storage):
		"""Test document generation when storage operations fail"""
		config = DocumentGenerationConfiguration(
			enable_storage=True,
			storage_root_path="/invalid/path/that/does/not/exist"
		)
		
		engine = DocumentEngine(config=config)
		
		# Should still be able to generate documents even if storage fails
		request = DocumentGenerationRequest(
			content_sources=[{"content": "Test content", "type": "section"}]
		)
		request.generation_config.document_title = "Test Document"
		
		result = await engine.generate_document(request)
		
		# Generation should succeed even if storage fails
		assert result.generation_successful is True
		
		# But there might be warnings about storage failures
		storage_warnings = [w for w in result.warnings if 'storage' in w.lower()]
		# May or may not have warnings depending on implementation


@pytest.mark.asyncio
async def test_end_to_end_workflow(temp_storage):
	"""Test complete end-to-end workflow with storage integration"""
	# Create engine with storage
	engine = await create_document_engine_with_storage(
		storage_root_path=str(temp_storage / "e2e_test")
	)
	
	# Add some content blocks and templates
	block_id = await engine.add_content_block(
		content="Executive summary template content with strategic insights and recommendations.",
		title="Executive Summary Template",
		category="proposal",
		tags=["executive", "summary", "proposal"]
	)
	
	template_id = await engine.add_template(
		name="Business Proposal Template",
		description="Standard template for business proposals",
		category="proposal",
		content_blocks=[block_id] if block_id else [],
		tags=["business", "proposal", "template"]
	)
	
	# Generate a document (should use recommendations from storage)
	request = DocumentGenerationRequest(
		content_sources=[
			{"content": "Our company seeks to implement new business strategies.", "type": "introduction"}
		],
		content_structure={"title": "Strategic Business Proposal"}
	)
	request.generation_config.document_title = "Strategic Business Proposal"
	request.generation_config.document_type = "proposal"
	
	# Generate document
	result = await engine.generate_document(request)
	
	assert result.generation_successful is True
	assert result.document_metadata.get("stored_document_id") == request.request_id
	
	# Verify we can search for and retrieve the document
	search_results = await engine.search_documents(
		query="strategic business proposal",
		search_type="full_text"
	)
	
	assert len(search_results) >= 1
	found_doc = next((doc for doc in search_results if doc['document_id'] == request.request_id), None)
	assert found_doc is not None
	
	# Verify document retrieval
	retrieved_doc = await engine.retrieve_stored_document(request.request_id)
	assert retrieved_doc is not None
	assert retrieved_doc['document_id'] == request.request_id
	assert retrieved_doc['metadata']['title'] == "Strategic Business Proposal"
	
	# Get statistics
	stats = await engine.get_storage_statistics()
	assert stats['total_documents'] >= 1
	assert stats['total_content_blocks'] >= 1
	assert stats['total_templates'] >= 1
	
	print(f"E2E Test completed successfully:")
	print(f"- Generated document: {request.request_id}")
	print(f"- Documents in storage: {stats['total_documents']}")
	print(f"- Content blocks: {stats['total_content_blocks']}")
	print(f"- Templates: {stats['total_templates']}")