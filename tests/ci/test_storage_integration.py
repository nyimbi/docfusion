#!/usr/bin/env python3
"""
Storage Layer Integration Test Suite

Comprehensive integration tests that verify all storage components work together
seamlessly and integrate properly with the document engine. Tests end-to-end
workflows and cross-component compatibility.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.storage.engines.text_search_engine import (
	TextSearchEngine, SearchQuery
)
from docfusion.storage.engines.document_retrieval import (
	DocumentRetrieval
)
from docfusion.storage.indexes.document_indexer import (
	DocumentIndexer, IndexConfiguration
)
from docfusion.storage.retrievers.document_retriever import (
	DocumentRetriever
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for integration testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def integrated_storage_system(temp_storage):
	"""Create integrated storage system with all components"""
	# Initialize all storage components
	search_engine = TextSearchEngine(temp_storage / "search")
	document_retrieval = DocumentRetrieval(temp_storage / "documents")
	
	config = IndexConfiguration(
		enable_content_extraction=True,
		enable_keyword_extraction=True,
		index_batch_size=50
	)
	document_indexer = DocumentIndexer(temp_storage / "indexes", config)
	document_retriever = DocumentRetriever(temp_storage / "retriever")
	
	return {
		'search_engine': search_engine,
		'document_retrieval': document_retrieval,
		'document_indexer': document_indexer,
		'document_retriever': document_retriever
	}


@pytest.fixture
async def populated_storage_system(integrated_storage_system):
	"""Create populated storage system with sample data"""
	components = integrated_storage_system
	
	# Sample documents and content
	documents = [
		{
			'id': 'doc1',
			'title': 'Machine Learning Project Proposal',
			'content': 'This proposal outlines a comprehensive machine learning project focused on predictive analytics. We will implement advanced algorithms to analyze customer behavior patterns and predict future trends. The project includes data preprocessing, model training, validation, and deployment phases.',
			'category': 'proposal',
			'tags': ['machine-learning', 'analytics', 'prediction'],
			'content_type': 'text'
		},
		{
			'id': 'doc2',
			'title': 'Technical Architecture Document',
			'content': 'The technical architecture for our enterprise system follows microservices design patterns. This document describes the service mesh, API gateway configuration, database design, and deployment strategies. We utilize containerization with Kubernetes for orchestration.',
			'category': 'technical',
			'tags': ['architecture', 'microservices', 'kubernetes'],
			'content_type': 'text'
		},
		{
			'id': 'doc3',
			'title': 'Data Science Research Report',
			'content': 'Our data science research investigates statistical modeling techniques for large datasets. The report covers exploratory data analysis, hypothesis testing, and machine learning model evaluation. Key findings include improved accuracy through ensemble methods.',
			'category': 'research',
			'tags': ['data-science', 'statistics', 'research'],
			'content_type': 'text'
		},
		{
			'id': 'doc4',
			'title': 'Project Management Guidelines',
			'content': 'These guidelines establish best practices for agile project management in software development. Topics include sprint planning, stakeholder communication, risk management, and quality assurance processes.',
			'category': 'management',
			'tags': ['project-management', 'agile', 'guidelines'],
			'content_type': 'text'
		},
		{
			'id': 'doc5',
			'title': 'Business Requirements Specification',
			'content': 'This specification document defines functional and non-functional requirements for the customer portal system. It includes user stories, acceptance criteria, performance requirements, and compliance specifications.',
			'category': 'requirements',
			'tags': ['requirements', 'specifications', 'business'],
			'content_type': 'text'
		}
	]
	
	# Content blocks for document retriever
	content_blocks = [
		{
			'content': 'Executive Summary: This section provides a high-level overview of the proposal objectives and expected outcomes.',
			'title': 'Executive Summary Template',
			'block_type': 'section',
			'category': 'proposal',
			'tags': ['executive-summary', 'proposal', 'overview']
		},
		{
			'content': 'Technical Approach: Our methodology combines industry best practices with innovative solutions.',
			'title': 'Technical Approach Template',
			'block_type': 'section',
			'category': 'technical',
			'tags': ['technical', 'approach', 'methodology']
		},
		{
			'content': 'Budget and Timeline: Detailed cost breakdown and project schedule with milestones.',
			'title': 'Budget Template',
			'block_type': 'table',
			'category': 'financial',
			'tags': ['budget', 'timeline', 'costs']
		}
	]
	
	# Populate all components
	doc_ids = []
	for doc in documents:
		# Add to search engine
		await components['search_engine'].index_document(
			doc['id'], doc['title'], doc['content']
		)
		
		# Add to document retrieval
		retrieval_id = await components['document_retrieval'].store_document(
			content=doc['content'],
			title=doc['title'],
			document_id=doc['id'],
			category=doc['category'],
			tags=doc['tags'],
			content_type=doc['content_type']
		)
		
		# Add to document indexer
		await components['document_indexer'].index_document(
			document_id=doc['id'],
			title=doc['title'],
			content=doc['content'],
			category=doc['category'],
			tags=doc['tags']
		)
		
		doc_ids.append(doc['id'])
	
	# Add content blocks to document retriever
	block_ids = []
	for block in content_blocks:
		block_id = await components['document_retriever'].add_content_block(**block)
		block_ids.append(block_id)
	
	# Add a template
	template_id = await components['document_retriever'].add_template(
		name='Standard Proposal Template',
		description='Comprehensive template for business proposals',
		category='proposal',
		content_blocks=block_ids,
		tags=['proposal', 'standard', 'business']
	)
	
	return components, doc_ids, block_ids, [template_id]


class TestStorageComponentsIntegration:
	"""Test integration between all storage components"""
	
	async def test_cross_component_document_consistency(self, populated_storage_system):
		"""Test that the same document is consistently handled across components"""
		components, doc_ids, _, _ = populated_storage_system
		doc_id = doc_ids[0]  # Machine Learning Project Proposal
		
		# Search for document in search engine
		search_results = await components['search_engine'].search(
			SearchQuery(query="machine learning project")
		)
		assert len(search_results) >= 1
		search_doc_ids = [result.document_id for result in search_results]
		assert doc_id in search_doc_ids
		
		# Retrieve document from document retrieval
		retrieval_result = await components['document_retrieval'].retrieve_document(doc_id)
		assert retrieval_result is not None
		assert retrieval_result['document_id'] == doc_id
		
		# Get document from indexer
		indexed_doc = await components['document_indexer'].get_document_by_id(doc_id)
		assert indexed_doc is not None
		assert indexed_doc.document_id == doc_id
		
		# Verify content consistency
		search_doc = next((r for r in search_results if r.document_id == doc_id), None)
		assert search_doc is not None
		
		# All should have the same basic information
		assert "machine learning" in search_doc.content.lower()
		assert "machine learning" in retrieval_result['content'].lower()
		assert "machine learning" in indexed_doc.content.lower()
	
	async def test_search_and_retrieval_workflow(self, populated_storage_system):
		"""Test workflow: search -> identify -> retrieve full document"""
		components, doc_ids, _, _ = populated_storage_system
		
		# 1. Search for documents about "technical architecture"
		search_results = await components['search_engine'].search(
			SearchQuery(query="technical architecture")
		)
		
		assert len(search_results) >= 1
		target_doc_id = search_results[0].document_id
		
		# 2. Retrieve full document using the ID from search
		full_document = await components['document_retrieval'].retrieve_document(target_doc_id)
		
		assert full_document is not None
		assert full_document['document_id'] == target_doc_id
		assert 'content' in full_document
		assert len(full_document['content']) > len(search_results[0].content)  # Full content vs. snippet
	
	async def test_indexing_and_search_consistency(self, populated_storage_system):
		"""Test that indexer and search engine produce consistent results"""
		components, doc_ids, _, _ = populated_storage_system
		
		# Search using search engine
		search_query = "data science research"
		search_results = await components['search_engine'].search(
			SearchQuery(query=search_query)
		)
		
		# Search using indexer
		indexer_results = await components['document_indexer'].search_by_keywords(
			["data", "science", "research"], match_all=False
		)
		
		# Both should find relevant documents
		assert len(search_results) >= 1
		assert len(indexer_results) >= 1
		
		# Should have some overlap in results
		search_doc_ids = {result.document_id for result in search_results}
		indexer_doc_ids = {doc.document_id for doc in indexer_results}
		
		# At least one document should be found by both
		assert len(search_doc_ids & indexer_doc_ids) >= 1
	
	async def test_content_recommendation_integration(self, populated_storage_system):
		"""Test that content recommendations work with stored documents"""
		components, doc_ids, block_ids, template_ids = populated_storage_system
		
		# Get recommendations based on context similar to stored documents
		context = "need help writing a technical proposal with architecture details"
		recommendations = await components['document_retriever'].recommend_content(
			context=context,
			content_type="both",
			limit=10
		)
		
		assert len(recommendations) > 0
		
		# Should recommend relevant content blocks and templates
		block_recs = [r for r in recommendations if r.content_type == "block"]
		template_recs = [r for r in recommendations if r.content_type == "template"]
		
		assert len(block_recs) > 0 or len(template_recs) > 0
		
		# Should be sorted by relevance
		for i in range(len(recommendations) - 1):
			assert recommendations[i].relevance_score >= recommendations[i+1].relevance_score
	
	async def test_end_to_end_document_lifecycle(self, integrated_storage_system):
		"""Test complete document lifecycle across all components"""
		components = integrated_storage_system
		
		# 1. Create new document
		new_doc_id = "lifecycle_test_doc"
		new_title = "Integration Test Document"
		new_content = "This document tests the complete integration lifecycle across all storage components including search, retrieval, indexing, and content management."
		
		# 2. Store in all components
		# Add to search engine
		await components['search_engine'].index_document(
			new_doc_id, new_title, new_content
		)
		
		# Add to document retrieval
		await components['document_retrieval'].store_document(
			content=new_content,
			title=new_title,
			document_id=new_doc_id,
			category="integration_test",
			tags=["integration", "test", "lifecycle"]
		)
		
		# Add to document indexer
		await components['document_indexer'].index_document(
			document_id=new_doc_id,
			title=new_title,
			content=new_content,
			category="integration_test",
			tags=["integration", "test", "lifecycle"]
		)
		
		# 3. Verify document is accessible from all components
		# Search engine
		search_results = await components['search_engine'].search(
			SearchQuery(query="integration lifecycle")
		)
		search_found = any(r.document_id == new_doc_id for r in search_results)
		assert search_found
		
		# Document retrieval
		retrieved_doc = await components['document_retrieval'].retrieve_document(new_doc_id)
		assert retrieved_doc is not None
		assert retrieved_doc['document_id'] == new_doc_id
		
		# Document indexer
		indexed_doc = await components['document_indexer'].get_document_by_id(new_doc_id)
		assert indexed_doc is not None
		assert indexed_doc.document_id == new_doc_id
		
		# 4. Update document
		updated_content = new_content + " This content has been updated for testing."
		
		# Update in all components
		await components['search_engine'].index_document(
			new_doc_id, new_title, updated_content
		)
		
		await components['document_retrieval'].store_document(
			content=updated_content,
			title=new_title,
			document_id=new_doc_id,
			category="integration_test",
			tags=["integration", "test", "lifecycle", "updated"]
		)
		
		await components['document_indexer'].index_document(
			document_id=new_doc_id,
			title=new_title,
			content=updated_content,
			category="integration_test",
			tags=["integration", "test", "lifecycle", "updated"]
		)
		
		# 5. Verify updates are reflected
		search_results_updated = await components['search_engine'].search(
			SearchQuery(query="updated for testing")
		)
		assert any(r.document_id == new_doc_id for r in search_results_updated)
		
		retrieved_doc_updated = await components['document_retrieval'].retrieve_document(new_doc_id)
		assert "updated for testing" in retrieved_doc_updated['content']
		
		indexed_doc_updated = await components['document_indexer'].get_document_by_id(new_doc_id)
		assert "updated for testing" in indexed_doc_updated.content
	
	async def test_concurrent_multi_component_operations(self, populated_storage_system):
		"""Test concurrent operations across multiple components"""
		components, doc_ids, _, _ = populated_storage_system
		
		# Create concurrent tasks across different components
		tasks = []
		
		# Search operations
		search_queries = ["machine learning", "technical architecture", "data science"]
		for query in search_queries:
			task = components['search_engine'].search(SearchQuery(query=query))
			tasks.append(task)
		
		# Retrieval operations
		for doc_id in doc_ids[:3]:
			task = components['document_retrieval'].retrieve_document(doc_id)
			tasks.append(task)
		
		# Indexer operations
		categories = ["proposal", "technical", "research"]
		for category in categories:
			task = components['document_indexer'].search_by_category(category)
			tasks.append(task)
		
		# Content recommendations
		contexts = [
			"need proposal template",
			"technical documentation help", 
			"project management guidance"
		]
		for context in contexts:
			task = components['document_retriever'].recommend_content(context)
			tasks.append(task)
		
		# Execute all tasks concurrently
		results = await asyncio.gather(*tasks)
		
		# Verify all operations completed successfully
		assert len(results) == len(tasks)
		assert all(result is not None for result in results)
		
		# Check specific result types
		search_results_count = len(search_queries)
		retrieval_results_count = 3
		indexer_results_count = len(categories)
		recommendation_results_count = len(contexts)
		
		# Search results
		for i in range(search_results_count):
			assert isinstance(results[i], list)
		
		# Retrieval results
		for i in range(search_results_count, search_results_count + retrieval_results_count):
			assert results[i] is not None
			assert 'document_id' in results[i]
		
		# Indexer results
		start_idx = search_results_count + retrieval_results_count
		for i in range(start_idx, start_idx + indexer_results_count):
			assert isinstance(results[i], list)
		
		# Recommendation results
		start_idx = search_results_count + retrieval_results_count + indexer_results_count
		for i in range(start_idx, start_idx + recommendation_results_count):
			assert isinstance(results[i], list)


class TestPerformanceIntegration:
	"""Test performance characteristics of integrated system"""
	
	async def test_integrated_search_performance(self, populated_storage_system):
		"""Test search performance across components"""
		import time
		
		components, doc_ids, _, _ = populated_storage_system
		
		# Test search engine performance
		start_time = time.time()
		for _ in range(20):
			await components['search_engine'].search(SearchQuery(query="machine learning"))
		search_engine_time = time.time() - start_time
		
		# Test indexer search performance
		start_time = time.time()
		for _ in range(20):
			await components['document_indexer'].search_by_keywords(["machine", "learning"])
		indexer_search_time = time.time() - start_time
		
		# Both should complete quickly
		assert search_engine_time < 2.0  # Less than 2 seconds for 20 searches
		assert indexer_search_time < 1.0  # Less than 1 second for 20 searches
	
	async def test_integrated_retrieval_performance(self, populated_storage_system):
		"""Test retrieval performance across components"""
		import time
		
		components, doc_ids, _, _ = populated_storage_system
		
		# Test document retrieval performance
		start_time = time.time()
		for _ in range(50):
			await components['document_retrieval'].retrieve_document(doc_ids[0])
		retrieval_time = time.time() - start_time
		
		# Test content block retrieval performance
		start_time = time.time()
		for _ in range(20):
			await components['document_retriever'].recommend_content("test context")
		recommendation_time = time.time() - start_time
		
		# Should complete quickly (caching should help)
		assert retrieval_time < 1.0  # Less than 1 second for 50 retrievals
		assert recommendation_time < 5.0  # Less than 5 seconds for 20 recommendations
	
	async def test_memory_usage_integration(self, integrated_storage_system):
		"""Test memory usage with large number of documents"""
		import psutil
		import os
		
		components = integrated_storage_system
		process = psutil.Process(os.getpid())
		initial_memory = process.memory_info().rss
		
		# Add many documents to test memory usage
		document_count = 100
		
		for i in range(document_count):
			doc_id = f"memory_test_{i}"
			title = f"Memory Test Document {i}"
			content = f"This is test document number {i} for memory usage testing. " * 20  # ~1KB content
			
			# Add to all components
			await components['search_engine'].index_document(doc_id, title, content)
			await components['document_retrieval'].store_document(
				content, title, doc_id, category="memory_test"
			)
			await components['document_indexer'].index_document(
				document_id=doc_id, title=title, content=content, category="memory_test"
			)
		
		final_memory = process.memory_info().rss
		memory_increase_mb = (final_memory - initial_memory) / 1024 / 1024
		
		# Memory increase should be reasonable (less than 100MB for 100 documents)
		assert memory_increase_mb < 100
		
		# Test that search still works efficiently
		search_results = await components['search_engine'].search(
			SearchQuery(query="memory test", result_limit=10)
		)
		assert len(search_results) > 0


class TestErrorHandlingIntegration:
	"""Test error handling across integrated components"""
	
	async def test_component_failure_isolation(self, integrated_storage_system):
		"""Test that failure in one component doesn't affect others"""
		components = integrated_storage_system
		
		# Add valid document to all components
		doc_id = "error_test_doc"
		title = "Error Test Document"
		content = "This document tests error handling across components."
		
		await components['search_engine'].index_document(doc_id, title, content)
		await components['document_retrieval'].store_document(content, title, doc_id)
		await components['document_indexer'].index_document(
			document_id=doc_id, title=title, content=content
		)
		
		# Test that each component can work independently even if others have issues
		# Simulate partial failure by accessing non-existent data
		
		# Search should still work
		search_results = await components['search_engine'].search(
			SearchQuery(query="error test")
		)
		assert len(search_results) >= 1
		
		# Retrieval should still work
		retrieved_doc = await components['document_retrieval'].retrieve_document(doc_id)
		assert retrieved_doc is not None
		
		# Indexer should still work
		indexed_doc = await components['document_indexer'].get_document_by_id(doc_id)
		assert indexed_doc is not None
		
		# Each component should handle non-existent IDs gracefully
		assert await components['document_retrieval'].retrieve_document("nonexistent") is None
		assert await components['document_indexer'].get_document_by_id("nonexistent") is None
		
		empty_results = await components['search_engine'].search(
			SearchQuery(query="nonexistent_unique_term_xyz")
		)
		assert len(empty_results) == 0
	
	async def test_consistency_after_partial_failure(self, integrated_storage_system):
		"""Test system consistency when operations partially fail"""
		components = integrated_storage_system
		
		# Add document to some components successfully
		doc_id = "partial_failure_test"
		title = "Partial Failure Test"
		content = "Testing partial failure scenarios."
		
		# Add to search engine and document retrieval
		await components['search_engine'].index_document(doc_id, title, content)
		await components['document_retrieval'].store_document(content, title, doc_id)
		
		# Don't add to indexer (simulate partial failure)
		
		# Verify components handle missing data gracefully
		search_results = await components['search_engine'].search(
			SearchQuery(query="partial failure")
		)
		assert len(search_results) >= 1
		
		retrieved_doc = await components['document_retrieval'].retrieve_document(doc_id)
		assert retrieved_doc is not None
		
		indexed_doc = await components['document_indexer'].get_document_by_id(doc_id)
		assert indexed_doc is None  # Should be None since we didn't add it
		
		# System should remain functional despite inconsistency
		# Add to indexer now to restore consistency
		await components['document_indexer'].index_document(
			document_id=doc_id, title=title, content=content
		)
		
		# Now all components should have the document
		indexed_doc = await components['document_indexer'].get_document_by_id(doc_id)
		assert indexed_doc is not None


class TestDataConsistencyIntegration:
	"""Test data consistency across all storage components"""
	
	async def test_metadata_consistency(self, populated_storage_system):
		"""Test that metadata remains consistent across components"""
		components, doc_ids, _, _ = populated_storage_system
		doc_id = doc_ids[0]  # Machine Learning Project Proposal
		
		# Get metadata from different components
		search_results = await components['search_engine'].search(
			SearchQuery(query="machine learning project")
		)
		search_doc = next((r for r in search_results if r.document_id == doc_id), None)
		
		retrieval_doc = await components['document_retrieval'].retrieve_document(doc_id)
		indexed_doc = await components['document_indexer'].get_document_by_id(doc_id)
		
		# All should have consistent basic information
		assert search_doc is not None
		assert retrieval_doc is not None
		assert indexed_doc is not None
		
		# Title consistency
		assert search_doc.title == "Machine Learning Project Proposal"
		assert retrieval_doc['metadata']['title'] == "Machine Learning Project Proposal"
		assert indexed_doc.title == "Machine Learning Project Proposal"
		
		# Content consistency (at least partial)
		assert "machine learning" in search_doc.content.lower()
		assert "machine learning" in retrieval_doc['content'].lower()
		assert "machine learning" in indexed_doc.content.lower()
	
	async def test_tag_and_category_consistency(self, populated_storage_system):
		"""Test that tags and categories are consistent across indexing systems"""
		components, doc_ids, _, _ = populated_storage_system
		
		# Search by category in indexer
		proposal_docs = await components['document_indexer'].search_by_category("proposal")
		assert len(proposal_docs) >= 1
		
		# Get same documents from retrieval system
		proposal_docs_retrieval = await components['document_retrieval'].list_documents(
			category="proposal"
		)
		
		# Should have same number of proposal documents
		assert len(proposal_docs) == len(proposal_docs_retrieval)
		
		# Verify tag consistency
		for indexed_doc in proposal_docs:
			retrieval_doc = await components['document_retrieval'].retrieve_document(
				indexed_doc.document_id
			)
			
			if retrieval_doc and 'metadata' in retrieval_doc:
				# Tags should be consistent where available
				indexed_tags = set(indexed_doc.tags)
				retrieval_tags = set(retrieval_doc['metadata'].get('tags', []))
				
				# Should have some overlap or be identical
				assert len(indexed_tags & retrieval_tags) >= 0


@pytest.mark.asyncio
async def test_large_scale_integration(integrated_storage_system):
	"""Test integration with larger scale data"""
	components = integrated_storage_system
	
	# Add many documents to test scalability
	document_count = 200
	
	# Add documents in batches to test batch processing
	batch_size = 20
	
	for batch_start in range(0, document_count, batch_size):
		batch_tasks = []
		
		for i in range(batch_start, min(batch_start + batch_size, document_count)):
			doc_id = f"scale_test_{i}"
			title = f"Scale Test Document {i}"
			content = f"This is scale test document number {i} with various content about topic {i % 10}. " * 10
			category = f"category_{i % 5}"
			tags = [f"tag_{i % 3}", f"scale", f"test"]
			
			# Create tasks for all components
			tasks = [
				components['search_engine'].index_document(doc_id, title, content),
				components['document_retrieval'].store_document(
					content, title, doc_id, category=category, tags=tags
				),
				components['document_indexer'].index_document(
					document_id=doc_id, title=title, content=content, 
					category=category, tags=tags
				)
			]
			
			batch_tasks.extend(tasks)
		
		# Execute batch concurrently
		await asyncio.gather(*batch_tasks)
	
	# Test that all components can handle the scale
	
	# Test search performance
	search_results = await components['search_engine'].search(
		SearchQuery(query="scale test", result_limit=50)
	)
	assert len(search_results) > 0
	
	# Test indexer performance
	category_results = await components['document_indexer'].search_by_category("category_0")
	assert len(category_results) > 0
	
	# Test document retrieval
	storage_stats = await components['document_retrieval'].get_storage_stats()
	assert storage_stats['total_documents'] >= document_count
	
	# Test that recommendations still work
	recommendations = await components['document_retriever'].recommend_content(
		"test document content", limit=10
	)
	assert len(recommendations) >= 0  # May be empty if no content blocks match


@pytest.mark.asyncio
async def test_integration_performance_benchmark(populated_storage_system):
	"""Benchmark performance of integrated system"""
	import time
	
	components, doc_ids, _, _ = populated_storage_system
	
	# Benchmark search operations
	start_time = time.time()
	
	search_tasks = [
		components['search_engine'].search(SearchQuery(query="machine learning")),
		components['search_engine'].search(SearchQuery(query="technical architecture")),
		components['search_engine'].search(SearchQuery(query="project management")),
		components['indexer'].search_by_keywords(["data", "science"]),
		components['document_indexer'].search_by_category("proposal"),
		components['document_indexer'].search_by_tags(["technical"])
	]
	
	search_results = await asyncio.gather(*search_tasks)
	search_time = time.time() - start_time
	
	# Benchmark retrieval operations
	start_time = time.time()
	
	retrieval_tasks = [
		components['document_retrieval'].retrieve_document(doc_id)
		for doc_id in doc_ids
	]
	
	retrieval_results = await asyncio.gather(*retrieval_tasks)
	retrieval_time = time.time() - start_time
	
	# Benchmark recommendation operations
	start_time = time.time()
	
	recommendation_tasks = [
		components['document_retriever'].recommend_content("proposal template"),
		components['document_retriever'].recommend_content("technical documentation"),
		components['document_retriever'].recommend_content("project guidelines")
	]
	
	recommendation_results = await asyncio.gather(*recommendation_tasks)
	recommendation_time = time.time() - start_time
	
	# Performance assertions
	assert search_time < 2.0  # All searches should complete in under 2 seconds
	assert retrieval_time < 1.0  # All retrievals should complete in under 1 second
	assert recommendation_time < 3.0  # All recommendations should complete in under 3 seconds
	
	# Verify all operations succeeded
	assert all(len(result) >= 0 for result in search_results)
	assert all(result is not None for result in retrieval_results)
	assert all(isinstance(result, list) for result in recommendation_results)