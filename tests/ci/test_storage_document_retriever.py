#!/usr/bin/env python3
"""
Test Suite for DocumentRetriever Module

Comprehensive tests covering template library management, content block retrieval,
smart content recommendations, and intelligent content discovery functionality.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

from docfusion.storage.retrievers.document_retriever import (
	DocumentRetriever, ContentBlock, Template, ContentRecommendation,
	create_document_retriever, add_boilerplate_content
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def document_retriever(temp_storage):
	"""Create DocumentRetriever instance for testing"""
	retriever = DocumentRetriever(temp_storage / "retriever")
	return retriever


@pytest.fixture
async def populated_retriever(document_retriever):
	"""Create retriever with sample content blocks and templates"""
	# Add content blocks
	block_data = [
		{
			'content': 'Executive Summary: This section provides a high-level overview of the proposal, highlighting key benefits and recommendations.',
			'title': 'Executive Summary Block',
			'block_type': 'section',
			'category': 'proposal',
			'tags': ['executive-summary', 'overview', 'proposal'],
			'author': 'template_system'
		},
		{
			'content': 'Technical Approach: Our methodology combines industry best practices with innovative solutions to deliver exceptional results.',
			'title': 'Technical Approach Block',
			'block_type': 'section',
			'category': 'technical',
			'tags': ['technical', 'methodology', 'approach'],
			'author': 'technical_team'
		},
		{
			'content': 'Budget Analysis: The following table outlines the projected costs and resource allocation for the project timeline.',
			'title': 'Budget Analysis Block',
			'block_type': 'table',
			'category': 'financial',
			'tags': ['budget', 'analysis', 'financial', 'costs'],
			'author': 'financial_team'
		},
		{
			'content': '## Company Background\n\nOur company has over 15 years of experience in delivering enterprise solutions to Fortune 500 clients.',
			'title': 'Company Background',
			'content_type': 'markdown',
			'block_type': 'paragraph',
			'category': 'company',
			'tags': ['background', 'company', 'experience'],
			'author': 'marketing_team'
		}
	]
	
	block_ids = []
	for block in block_data:
		block_id = await document_retriever.add_content_block(**block)
		block_ids.append(block_id)
	
	# Add templates
	template_data = [
		{
			'name': 'Standard Proposal Template',
			'description': 'Comprehensive template for standard business proposals with all required sections.',
			'template_type': 'document',
			'category': 'proposal',
			'content_blocks': block_ids[:3],  # Use first 3 blocks
			'variables': {'client_name': 'Client Name', 'project_title': 'Project Title'},
			'tags': ['proposal', 'business', 'standard'],
			'author': 'template_team'
		},
		{
			'name': 'Technical Documentation Template',
			'description': 'Template for technical documentation and specifications.',
			'template_type': 'document',
			'category': 'technical',
			'content_blocks': [block_ids[1]],  # Use technical block
			'variables': {'system_name': 'System Name', 'version': 'Version'},
			'tags': ['technical', 'documentation', 'specs'],
			'author': 'technical_team'
		}
	]
	
	template_ids = []
	for template in template_data:
		template_id = await document_retriever.add_template(**template)
		template_ids.append(template_id)
	
	return document_retriever, block_ids, template_ids


class TestDocumentRetrieverInitialization:
	"""Test DocumentRetriever initialization and setup"""
	
	async def test_retriever_creation(self, temp_storage):
		"""Test basic retriever creation"""
		retriever = DocumentRetriever(temp_storage / "test_retriever")
		
		assert retriever is not None
		assert retriever.storage_path.exists()
		assert retriever.blocks_path.exists()
		assert retriever.templates_path.exists()
		assert retriever.cache_path.exists()
		assert len(retriever.content_blocks) == 0
		assert len(retriever.templates) == 0
	
	async def test_factory_function(self, temp_storage):
		"""Test factory function for retriever creation"""
		retriever = await create_document_retriever(temp_storage / "factory_test")
		assert isinstance(retriever, DocumentRetriever)


class TestContentBlockManagement:
	"""Test content block management functionality"""
	
	async def test_add_content_block_basic(self, document_retriever):
		"""Test adding a basic content block"""
		content = "This is a test content block with important information."
		title = "Test Block"
		
		block_id = await document_retriever.add_content_block(
			content=content,
			title=title,
			content_type="text"
		)
		
		assert block_id is not None
		assert block_id in document_retriever.content_blocks
		
		block = document_retriever.content_blocks[block_id]
		assert block.title == title
		assert block.content == content
		assert block.content_type == "text"
		assert len(block.keywords) > 0  # Keywords should be extracted
	
	async def test_add_content_block_comprehensive(self, document_retriever):
		"""Test adding content block with comprehensive metadata"""
		block_data = {
			'content': 'Comprehensive content block with detailed metadata and custom fields.',
			'title': 'Comprehensive Block',
			'content_type': 'markdown',
			'block_type': 'section',
			'category': 'test',
			'subcategory': 'comprehensive',
			'tags': ['test', 'comprehensive', 'detailed'],
			'author': 'test_author',
			'variables': {'var1': 'value1', 'var2': 'value2'},
			'metadata': {'priority': 'high', 'department': 'engineering'}
		}
		
		block_id = await document_retriever.add_content_block(**block_data)
		
		block = document_retriever.content_blocks[block_id]
		assert block.content_type == 'markdown'
		assert block.block_type == 'section'
		assert block.category == 'test'
		assert block.subcategory == 'comprehensive'
		assert block.tags == ['test', 'comprehensive', 'detailed']
		assert block.author == 'test_author'
		assert block.variables == {'var1': 'value1', 'var2': 'value2'}
		assert block.metadata == {'priority': 'high', 'department': 'engineering'}
	
	async def test_convenience_function_boilerplate(self, document_retriever):
		"""Test convenience function for adding boilerplate content"""
		content = "Standard boilerplate text for legal disclaimers."
		title = "Legal Disclaimer"
		
		block_id = await add_boilerplate_content(
			document_retriever,
			content,
			title,
			tags=['legal', 'disclaimer']
		)
		
		assert block_id in document_retriever.content_blocks
		block = document_retriever.content_blocks[block_id]
		assert block.title == title
		assert block.category == "boilerplate"
		assert block.block_type == "boilerplate"
		assert 'legal' in block.tags
	
	async def test_retrieve_content_block(self, populated_retriever):
		"""Test retrieving content blocks by ID"""
		document_retriever, block_ids, _ = populated_retriever
		block_id = block_ids[0]
		
		block = await document_retriever.retrieve_content_block(block_id)
		
		assert block is not None
		assert block.block_id == block_id
		assert block.title == 'Executive Summary Block'
		assert block.usage_count == 1  # Should be incremented
	
	async def test_retrieve_nonexistent_block(self, document_retriever):
		"""Test retrieving non-existent content block"""
		block = await document_retriever.retrieve_content_block("nonexistent_id")
		
		assert block is None
	
	async def test_retrieve_without_usage_tracking(self, populated_retriever):
		"""Test retrieving block without tracking usage"""
		document_retriever, block_ids, _ = populated_retriever
		block_id = block_ids[0]
		
		initial_block = document_retriever.content_blocks[block_id]
		initial_usage = initial_block.usage_count
		
		block = await document_retriever.retrieve_content_block(block_id, track_usage=False)
		
		assert block is not None
		assert block.usage_count == initial_usage  # Should not be incremented


class TestTemplateManagement:
	"""Test template management functionality"""
	
	async def test_add_template_basic(self, document_retriever):
		"""Test adding a basic template"""
		template_data = {
			'name': 'Basic Template',
			'description': 'A simple template for testing',
			'template_type': 'document',
			'category': 'test'
		}
		
		template_id = await document_retriever.add_template(**template_data)
		
		assert template_id is not None
		assert template_id in document_retriever.templates
		
		template = document_retriever.templates[template_id]
		assert template.name == 'Basic Template'
		assert template.description == 'A simple template for testing'
		assert template.template_type == 'document'
		assert template.category == 'test'
	
	async def test_add_template_with_blocks(self, populated_retriever):
		"""Test adding template with content blocks"""
		document_retriever, block_ids, _ = populated_retriever
		
		template_data = {
			'name': 'Block-Based Template',
			'description': 'Template with associated content blocks',
			'content_blocks': block_ids[:2],  # Use first 2 blocks
			'variables': {'title': 'Template Title'},
			'tags': ['test', 'blocks']
		}
		
		template_id = await document_retriever.add_template(**template_data)
		
		template = document_retriever.templates[template_id]
		assert len(template.content_blocks) == 2
		assert template.content_blocks == block_ids[:2]
		assert template.variables == {'title': 'Template Title'}
		assert 'test' in template.tags
	
	async def test_add_template_with_invalid_blocks(self, document_retriever):
		"""Test adding template with invalid block references"""
		template_data = {
			'name': 'Invalid Blocks Template',
			'description': 'Template with invalid block IDs',
			'content_blocks': ['invalid_id_1', 'invalid_id_2']
		}
		
		template_id = await document_retriever.add_template(**template_data)
		
		template = document_retriever.templates[template_id]
		assert len(template.content_blocks) == 0  # Invalid blocks should be filtered out
	
	async def test_retrieve_template(self, populated_retriever):
		"""Test retrieving templates by ID"""
		document_retriever, _, template_ids = populated_retriever
		template_id = template_ids[0]
		
		template = await document_retriever.retrieve_template(template_id)
		
		assert template is not None
		assert template.template_id == template_id
		assert template.name == 'Standard Proposal Template'
		assert template.usage_count == 1  # Should be incremented
	
	async def test_retrieve_nonexistent_template(self, document_retriever):
		"""Test retrieving non-existent template"""
		template = await document_retriever.retrieve_template("nonexistent_id")
		
		assert template is None


class TestContentSearch:
	"""Test content search functionality"""
	
	async def test_search_content_blocks_by_query(self, populated_retriever):
		"""Test searching content blocks by text query"""
		document_retriever, block_ids, _ = populated_retriever
		
		results = await document_retriever.search_content_blocks(query="executive summary")
		
		assert len(results) >= 1
		assert any(block.title == 'Executive Summary Block' for block in results)
		
		# Results should be sorted by relevance
		if len(results) > 1:
			assert results[0].usage_count >= 0  # Basic ordering check
	
	async def test_search_content_blocks_by_category(self, populated_retriever):
		"""Test searching content blocks by category"""
		document_retriever, block_ids, _ = populated_retriever
		
		proposal_blocks = await document_retriever.search_content_blocks(category="proposal")
		technical_blocks = await document_retriever.search_content_blocks(category="technical")
		
		assert len(proposal_blocks) == 1
		assert len(technical_blocks) == 1
		assert proposal_blocks[0].category == "proposal"
		assert technical_blocks[0].category == "technical"
	
	async def test_search_content_blocks_by_type(self, populated_retriever):
		"""Test searching content blocks by block type"""
		document_retriever, block_ids, _ = populated_retriever
		
		section_blocks = await document_retriever.search_content_blocks(block_type="section")
		table_blocks = await document_retriever.search_content_blocks(block_type="table")
		
		assert len(section_blocks) == 2  # Executive Summary and Technical Approach
		assert len(table_blocks) == 1   # Budget Analysis
		assert all(block.block_type == "section" for block in section_blocks)
		assert all(block.block_type == "table" for block in table_blocks)
	
	async def test_search_content_blocks_by_tags(self, populated_retriever):
		"""Test searching content blocks by tags"""
		document_retriever, block_ids, _ = populated_retriever
		
		proposal_tagged = await document_retriever.search_content_blocks(tags=["proposal"])
		financial_tagged = await document_retriever.search_content_blocks(tags=["financial"])
		
		assert len(proposal_tagged) == 1
		assert len(financial_tagged) == 1
		assert "proposal" in proposal_tagged[0].tags
		assert "financial" in financial_tagged[0].tags
	
	async def test_search_content_blocks_combined_filters(self, populated_retriever):
		"""Test searching with multiple filters combined"""
		document_retriever, block_ids, _ = populated_retriever
		
		results = await document_retriever.search_content_blocks(
			query="analysis",
			category="financial",
			block_type="table"
		)
		
		assert len(results) == 1
		assert results[0].title == "Budget Analysis Block"
		assert results[0].category == "financial"
		assert results[0].block_type == "table"
	
	async def test_search_templates_by_query(self, populated_retriever):
		"""Test searching templates by text query"""
		document_retriever, _, template_ids = populated_retriever
		
		results = await document_retriever.search_templates(query="proposal")
		
		assert len(results) >= 1
		assert any(template.name == 'Standard Proposal Template' for template in results)
	
	async def test_search_templates_by_category(self, populated_retriever):
		"""Test searching templates by category"""
		document_retriever, _, template_ids = populated_retriever
		
		proposal_templates = await document_retriever.search_templates(category="proposal")
		technical_templates = await document_retriever.search_templates(category="technical")
		
		assert len(proposal_templates) == 1
		assert len(technical_templates) == 1
		assert proposal_templates[0].category == "proposal"
		assert technical_templates[0].category == "technical"
	
	async def test_search_templates_by_type(self, populated_retriever):
		"""Test searching templates by template type"""
		document_retriever, _, template_ids = populated_retriever
		
		document_templates = await document_retriever.search_templates(template_type="document")
		
		assert len(document_templates) == 2  # Both templates are document type
		assert all(template.template_type == "document" for template in document_templates)


class TestContentRecommendations:
	"""Test smart content recommendation functionality"""
	
	async def test_recommend_content_basic(self, populated_retriever):
		"""Test basic content recommendations"""
		document_retriever, block_ids, _ = populated_retriever
		
		context = "I need help creating a business proposal with executive summary"
		recommendations = await document_retriever.recommend_content(
			context=context,
			content_type="both",
			limit=5
		)
		
		assert len(recommendations) > 0
		assert all(isinstance(rec, ContentRecommendation) for rec in recommendations)
		
		# Should find executive summary block
		titles = [rec.title for rec in recommendations]
		assert any("Executive Summary" in title for title in titles)
		
		# Should be sorted by relevance
		for i in range(len(recommendations) - 1):
			assert recommendations[i].relevance_score >= recommendations[i+1].relevance_score
	
	async def test_recommend_blocks_only(self, populated_retriever):
		"""Test recommending only content blocks"""
		document_retriever, block_ids, _ = populated_retriever
		
		recommendations = await document_retriever.recommend_content(
			context="technical methodology and approach",
			content_type="block",
			limit=5
		)
		
		assert len(recommendations) > 0
		assert all(rec.content_type == "block" for rec in recommendations)
		
		# Should find technical approach block
		titles = [rec.title for rec in recommendations]
		assert any("Technical Approach" in title for title in titles)
	
	async def test_recommend_templates_only(self, populated_retriever):
		"""Test recommending only templates"""
		document_retriever, block_ids, _ = populated_retriever
		
		recommendations = await document_retriever.recommend_content(
			context="need a proposal template",
			content_type="template",
			limit=5
		)
		
		assert len(recommendations) > 0
		assert all(rec.content_type == "template" for rec in recommendations)
		
		# Should find proposal template
		titles = [rec.title for rec in recommendations]
		assert any("Proposal Template" in title for title in titles)
	
	async def test_recommend_with_category_filter(self, populated_retriever):
		"""Test recommendations with category filtering"""
		document_retriever, block_ids, _ = populated_retriever
		
		recommendations = await document_retriever.recommend_content(
			context="financial analysis and budget",
			content_type="block",
			category="financial",
			limit=5
		)
		
		assert len(recommendations) > 0
		financial_recs = [rec for rec in recommendations if rec.metadata.get('category') == 'financial']
		assert len(financial_recs) > 0
	
	async def test_recommend_with_relevance_threshold(self, populated_retriever):
		"""Test recommendations with minimum relevance threshold"""
		document_retriever, block_ids, _ = populated_retriever
		
		recommendations = await document_retriever.recommend_content(
			context="unrelated random context xyz",
			content_type="both",
			min_relevance=0.8,  # High threshold
			limit=10
		)
		
		# Should return fewer or no results due to high threshold
		assert all(rec.relevance_score >= 0.8 for rec in recommendations)
	
	async def test_recommendation_caching(self, populated_retriever):
		"""Test that recommendations are cached"""
		document_retriever, block_ids, _ = populated_retriever
		
		context = "executive summary for proposal"
		
		# First request (cache miss)
		recs1 = await document_retriever.recommend_content(context)
		initial_cache_misses = document_retriever.stats.cache_misses
		
		# Second request (should be cache hit)
		recs2 = await document_retriever.recommend_content(context)
		
		assert len(recs1) == len(recs2)
		assert document_retriever.stats.cache_hits > 0
		assert document_retriever.stats.cache_misses == initial_cache_misses


class TestContentCategorization:
	"""Test content categorization and organization"""
	
	async def test_get_content_block_by_category(self, populated_retriever):
		"""Test retrieving content blocks by category"""
		document_retriever, block_ids, _ = populated_retriever
		
		proposal_blocks = await document_retriever.get_content_block_by_category("proposal")
		technical_blocks = await document_retriever.get_content_block_by_category("technical")
		financial_blocks = await document_retriever.get_content_block_by_category("financial")
		
		assert len(proposal_blocks) == 1
		assert len(technical_blocks) == 1
		assert len(financial_blocks) == 1
		
		assert proposal_blocks[0].category == "proposal"
		assert technical_blocks[0].category == "technical"
		assert financial_blocks[0].category == "financial"
	
	async def test_get_templates_by_type(self, populated_retriever):
		"""Test retrieving templates by type"""
		document_retriever, _, template_ids = populated_retriever
		
		document_templates = await document_retriever.get_templates_by_type("document")
		
		assert len(document_templates) == 2
		assert all(template.template_type == "document" for template in document_templates)
	
	async def test_get_popular_content_blocks(self, populated_retriever):
		"""Test retrieving popular content blocks"""
		document_retriever, block_ids, _ = populated_retriever
		
		# Access some blocks to increase usage count
		await document_retriever.retrieve_content_block(block_ids[0])
		await document_retriever.retrieve_content_block(block_ids[0])  # Access twice
		await document_retriever.retrieve_content_block(block_ids[1])
		
		popular_blocks = await document_retriever.get_popular_content(
			content_type="block",
			limit=5
		)
		
		assert len(popular_blocks) > 0
		# First block should be most popular (accessed twice)
		assert popular_blocks[0].block_id == block_ids[0]
		assert popular_blocks[0].usage_count >= 2
	
	async def test_get_popular_mixed_content(self, populated_retriever):
		"""Test retrieving popular mixed content (blocks and templates)"""
		document_retriever, block_ids, template_ids = populated_retriever
		
		# Access some content to create usage patterns
		await document_retriever.retrieve_content_block(block_ids[0])
		await document_retriever.retrieve_template(template_ids[0])
		
		popular_content = await document_retriever.get_popular_content(
			content_type="both",
			limit=10
		)
		
		assert len(popular_content) > 0
		# Should include both blocks and templates
		content_types = set()
		for item in popular_content:
			if hasattr(item, 'block_id'):
				content_types.add('block')
			elif hasattr(item, 'template_id'):
				content_types.add('template')
		
		assert len(content_types) >= 1  # At least one type should be present


class TestStatisticsAndAnalytics:
	"""Test retrieval statistics and analytics"""
	
	async def test_retrieval_stats_tracking(self, populated_retriever):
		"""Test that retrieval statistics are tracked"""
		document_retriever, block_ids, template_ids = populated_retriever
		
		initial_stats = await document_retriever.get_retrieval_stats()
		initial_retrievals = initial_stats.total_retrievals
		
		# Perform some retrievals
		await document_retriever.retrieve_content_block(block_ids[0])
		await document_retriever.retrieve_template(template_ids[0])
		
		updated_stats = await document_retriever.get_retrieval_stats()
		
		assert updated_stats.total_retrievals == initial_retrievals + 2
		assert updated_stats.block_retrievals == initial_stats.block_retrievals + 1
		assert updated_stats.template_retrievals == initial_stats.template_retrievals + 1
	
	async def test_recommendation_stats_tracking(self, populated_retriever):
		"""Test recommendation statistics tracking"""
		document_retriever, block_ids, _ = populated_retriever
		
		initial_stats = await document_retriever.get_retrieval_stats()
		initial_requests = initial_stats.recommendation_requests
		
		await document_retriever.recommend_content("test context")
		
		updated_stats = await document_retriever.get_retrieval_stats()
		assert updated_stats.recommendation_requests == initial_requests + 1
	
	async def test_performance_metrics_tracking(self, populated_retriever):
		"""Test performance metrics tracking"""
		document_retriever, block_ids, _ = populated_retriever
		
		await document_retriever.retrieve_content_block(block_ids[0])
		
		stats = await document_retriever.get_retrieval_stats()
		assert stats.average_retrieval_time > 0
		assert 'last_block_retrieval_time' in stats.performance_metrics


class TestCacheManagement:
	"""Test cache management functionality"""
	
	async def test_clear_cache(self, populated_retriever):
		"""Test manual cache clearing"""
		document_retriever, block_ids, _ = populated_retriever
		
		# Populate cache with recommendations
		await document_retriever.recommend_content("test context")
		assert len(document_retriever.recommendation_cache) > 0
		
		# Clear cache
		await document_retriever.clear_cache()
		assert len(document_retriever.recommendation_cache) == 0
	
	async def test_cache_ttl_expiration(self, populated_retriever):
		"""Test cache TTL expiration"""
		document_retriever, block_ids, _ = populated_retriever
		
		# Set very short TTL for testing
		document_retriever.cache_ttl = timedelta(seconds=0.1)
		
		# Make recommendation to populate cache
		recs1 = await document_retriever.recommend_content("test context")
		assert len(document_retriever.recommendation_cache) > 0
		
		# Wait for cache to expire
		await asyncio.sleep(0.2)
		
		# Make same recommendation (should be cache miss due to expiration)
		recs2 = await document_retriever.recommend_content("test context")
		
		# Should get fresh results (cache was expired)
		assert len(recs1) == len(recs2)


class TestContentPersistence:
	"""Test content persistence and loading"""
	
	async def test_content_block_persistence(self, temp_storage):
		"""Test that content blocks are persisted and loaded"""
		storage_path = temp_storage / "persistence_test"
		
		# Create retriever and add content block
		retriever1 = DocumentRetriever(storage_path)
		block_id = await retriever1.add_content_block(
			content="Persistent content block",
			title="Persistent Block",
			category="test_category",
			tags=["persistent", "test"]
		)
		
		# Wait for async operations
		await asyncio.sleep(0.1)
		
		# Create new retriever instance
		retriever2 = DocumentRetriever(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Verify content block was loaded
		assert block_id in retriever2.content_blocks
		loaded_block = retriever2.content_blocks[block_id]
		assert loaded_block.title == "Persistent Block"
		assert loaded_block.category == "test_category"
		assert loaded_block.tags == ["persistent", "test"]
	
	async def test_template_persistence(self, temp_storage):
		"""Test that templates are persisted and loaded"""
		storage_path = temp_storage / "template_persistence_test"
		
		# Create retriever and add template
		retriever1 = DocumentRetriever(storage_path)
		template_id = await retriever1.add_template(
			name="Persistent Template",
			description="Template for persistence testing",
			category="test_category",
			tags=["persistent", "template"]
		)
		
		# Wait for async operations
		await asyncio.sleep(0.1)
		
		# Create new retriever instance
		retriever2 = DocumentRetriever(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Verify template was loaded
		assert template_id in retriever2.templates
		loaded_template = retriever2.templates[template_id]
		assert loaded_template.name == "Persistent Template"
		assert loaded_template.category == "test_category"
		assert loaded_template.tags == ["persistent", "template"]


class TestEdgeCases:
	"""Test edge cases and error conditions"""
	
	async def test_empty_content_block(self, document_retriever):
		"""Test adding content block with empty content"""
		block_id = await document_retriever.add_content_block(
			content="",
			title="Empty Block"
		)
		
		assert block_id in document_retriever.content_blocks
		block = document_retriever.content_blocks[block_id]
		assert block.content == ""
		assert len(block.keywords) == 0
	
	async def test_large_content_handling(self, document_retriever):
		"""Test handling of large content blocks"""
		large_content = "Large content block " * 1000  # ~20KB
		
		block_id = await document_retriever.add_content_block(
			content=large_content,
			title="Large Block"
		)
		
		assert block_id in document_retriever.content_blocks
		block = document_retriever.content_blocks[block_id]
		assert len(block.content) == len(large_content)
		assert len(block.keywords) > 0
	
	async def test_special_characters_in_content(self, document_retriever):
		"""Test handling of special characters"""
		special_content = "Special chars: @#$%^&*()_+{}|:<>?[]\\;',./`~"
		
		block_id = await document_retriever.add_content_block(
			content=special_content,
			title="Special Characters"
		)
		
		assert block_id in document_retriever.content_blocks
		block = document_retriever.content_blocks[block_id]
		assert block.content == special_content
	
	async def test_unicode_content_handling(self, document_retriever):
		"""Test handling of Unicode content"""
		unicode_content = "Unicode: café, naïve, résumé, 中文, العربية"
		
		block_id = await document_retriever.add_content_block(
			content=unicode_content,
			title="Unicode Block"
		)
		
		assert block_id in document_retriever.content_blocks
		block = document_retriever.content_blocks[block_id]
		assert block.content == unicode_content
	
	async def test_search_with_no_results(self, document_retriever):
		"""Test searching with queries that return no results"""
		blocks = await document_retriever.search_content_blocks(query="nonexistent_keyword")
		templates = await document_retriever.search_templates(query="nonexistent_template")
		
		assert len(blocks) == 0
		assert len(templates) == 0
	
	async def test_recommend_with_empty_context(self, populated_retriever):
		"""Test recommendations with empty context"""
		document_retriever, block_ids, _ = populated_retriever
		
		recommendations = await document_retriever.recommend_content(
			context="",
			limit=5
		)
		
		# Should still return some recommendations based on usage/quality
		assert len(recommendations) >= 0


@pytest.mark.asyncio
async def test_concurrent_operations(populated_retriever):
	"""Test concurrent content operations"""
	document_retriever, block_ids, template_ids = populated_retriever
	
	# Concurrent retrievals
	tasks = []
	
	# Add block retrieval tasks
	for block_id in block_ids:
		tasks.append(document_retriever.retrieve_content_block(block_id))
	
	# Add template retrieval tasks
	for template_id in template_ids:
		tasks.append(document_retriever.retrieve_template(template_id))
	
	# Add recommendation tasks
	contexts = ["executive summary", "technical approach", "budget analysis"]
	for context in contexts:
		tasks.append(document_retriever.recommend_content(context))
	
	results = await asyncio.gather(*tasks)
	
	# Verify all operations completed successfully
	assert len(results) == len(block_ids) + len(template_ids) + len(contexts)
	
	# Check block and template retrievals
	for i, result in enumerate(results[:len(block_ids) + len(template_ids)]):
		assert result is not None
	
	# Check recommendation results
	for result in results[len(block_ids) + len(template_ids):]:
		assert isinstance(result, list)


@pytest.mark.asyncio
async def test_retrieval_performance(populated_retriever):
	"""Test retrieval and recommendation performance"""
	import time
	
	document_retriever, block_ids, template_ids = populated_retriever
	
	# Test content block retrieval performance
	start_time = time.time()
	for _ in range(50):
		await document_retriever.retrieve_content_block(block_ids[0])
	block_time = time.time() - start_time
	
	# Test template retrieval performance
	start_time = time.time()
	for _ in range(50):
		await document_retriever.retrieve_template(template_ids[0])
	template_time = time.time() - start_time
	
	# Test recommendation performance
	start_time = time.time()
	for _ in range(10):
		await document_retriever.recommend_content("executive summary")
	recommendation_time = time.time() - start_time
	
	# Should complete operations quickly
	assert block_time < 1.0  # Less than 1s for 50 block retrievals
	assert template_time < 1.0  # Less than 1s for 50 template retrievals
	assert recommendation_time < 2.0  # Less than 2s for 10 recommendations
	
	stats = await document_retriever.get_retrieval_stats()
	assert stats.average_retrieval_time > 0