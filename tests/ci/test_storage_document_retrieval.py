#!/usr/bin/env python3
"""
Test Suite for DocumentRetrieval Module

Comprehensive tests covering file system-based storage, document caching,
version management, metadata tracking, and performance optimization.
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta

from docfusion.storage.engines.document_retrieval import (
	DocumentRetrieval, DocumentMetadata, DocumentVersion, LRUCache,
	create_document_retrieval, store_text_document
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def document_retrieval(temp_storage):
	"""Create DocumentRetrieval instance for testing"""
	retrieval = DocumentRetrieval(temp_storage / "documents", cache_size=100)
	return retrieval


@pytest.fixture
async def populated_retrieval(document_retrieval):
	"""Create document retrieval with sample documents"""
	documents = [
		{
			'content': 'This is the first test document with important information.',
			'title': 'First Document',
			'content_type': 'text',
			'category': 'test',
			'tags': ['test', 'sample', 'first']
		},
		{
			'content': 'This is the second test document with different content.',
			'title': 'Second Document',
			'content_type': 'text',
			'category': 'test',
			'tags': ['test', 'sample', 'second']
		},
		{
			'content': '# Markdown Document\n\nThis is a **markdown** document with *formatting*.',
			'title': 'Markdown Test',
			'content_type': 'markdown',
			'category': 'markdown',
			'tags': ['markdown', 'formatted']
		}
	]
	
	doc_ids = []
	for doc in documents:
		doc_id = await document_retrieval.store_document(**doc)
		doc_ids.append(doc_id)
	
	return document_retrieval, doc_ids


class TestLRUCache:
	"""Test LRU Cache functionality"""
	
	def test_cache_creation(self):
		"""Test cache creation with size limits"""
		cache = LRUCache(max_size=10, max_memory_mb=1)
		assert cache.max_size == 10
		assert cache.max_memory_bytes == 1 * 1024 * 1024
		assert cache.size() == 0
	
	def test_cache_put_get(self):
		"""Test basic put and get operations"""
		cache = LRUCache(max_size=5)
		
		test_data = {'key': 'value', 'data': 'test data'}
		cache.put('test_key', test_data)
		
		assert cache.size() == 1
		retrieved = cache.get('test_key')
		assert retrieved == test_data
	
	def test_cache_lru_eviction(self):
		"""Test LRU eviction when cache is full"""
		cache = LRUCache(max_size=3)
		
		# Fill cache
		for i in range(3):
			cache.put(f'key{i}', {'data': f'value{i}'})
		
		assert cache.size() == 3
		
		# Add one more item (should evict oldest)
		cache.put('key3', {'data': 'value3'})
		
		assert cache.size() == 3
		assert cache.get('key0') is None  # Should be evicted
		assert cache.get('key3') is not None
	
	def test_cache_access_order(self):
		"""Test that access updates LRU order"""
		cache = LRUCache(max_size=3)
		
		# Fill cache
		for i in range(3):
			cache.put(f'key{i}', {'data': f'value{i}'})
		
		# Access key0 to move it to end
		cache.get('key0')
		
		# Add new item (should evict key1, not key0)
		cache.put('key3', {'data': 'value3'})
		
		assert cache.get('key0') is not None
		assert cache.get('key1') is None  # Should be evicted
	
	def test_cache_clear(self):
		"""Test cache clearing"""
		cache = LRUCache(max_size=5)
		
		cache.put('key1', {'data': 'value1'})
		cache.put('key2', {'data': 'value2'})
		
		assert cache.size() == 2
		
		cache.clear()
		
		assert cache.size() == 0
		assert cache.get('key1') is None


class TestDocumentRetrievalInitialization:
	"""Test DocumentRetrieval initialization and setup"""
	
	async def test_retrieval_creation(self, temp_storage):
		"""Test basic retrieval system creation"""
		retrieval = DocumentRetrieval(temp_storage / "test_retrieval")
		
		assert retrieval is not None
		assert retrieval.storage_path.exists()
		assert retrieval.documents_path.exists()
		assert retrieval.metadata_path.exists()
		assert retrieval.versions_path.exists()
		assert len(retrieval.document_index) == 0
	
	async def test_factory_function(self, temp_storage):
		"""Test factory function for retrieval creation"""
		retrieval = await create_document_retrieval(temp_storage / "test_factory")
		assert isinstance(retrieval, DocumentRetrieval)


class TestDocumentStorage:
	"""Test document storage functionality"""
	
	async def test_store_simple_document(self, document_retrieval):
		"""Test storing a simple text document"""
		content = "This is a test document content."
		title = "Test Document"
		
		doc_id = await document_retrieval.store_document(
			content=content,
			title=title,
			content_type="text"
		)
		
		assert doc_id is not None
		assert doc_id in document_retrieval.document_index
		
		metadata = document_retrieval.document_index[doc_id]
		assert metadata.title == title
		assert metadata.content_type == "text"
		assert metadata.checksum is not None
		assert metadata.file_size == len(content.encode('utf-8'))
	
	async def test_store_document_with_metadata(self, document_retrieval):
		"""Test storing document with comprehensive metadata"""
		content = "Document with full metadata"
		metadata_dict = {
			'title': 'Full Metadata Test',
			'content_type': 'text',
			'author': 'test_author',
			'tags': ['test', 'metadata', 'comprehensive'],
			'category': 'test_category',
			'custom_metadata': {'priority': 'high', 'department': 'engineering'}
		}
		
		doc_id = await document_retrieval.store_document(content, **metadata_dict)
		
		assert doc_id in document_retrieval.document_index
		
		stored_metadata = document_retrieval.document_index[doc_id]
		assert stored_metadata.title == metadata_dict['title']
		assert stored_metadata.author == metadata_dict['author']
		assert stored_metadata.tags == metadata_dict['tags']
		assert stored_metadata.category == metadata_dict['category']
		assert stored_metadata.custom_metadata == metadata_dict['custom_metadata']
	
	async def test_store_document_auto_id(self, document_retrieval):
		"""Test automatic document ID generation"""
		content = "Document with auto-generated ID"
		
		doc_id = await document_retrieval.store_document(content, title="Auto ID Test")
		
		assert doc_id is not None
		assert len(doc_id) > 10  # UUID7 should be longer
		assert doc_id in document_retrieval.document_index
	
	async def test_store_document_custom_id(self, document_retrieval):
		"""Test storing document with custom ID"""
		content = "Document with custom ID"
		custom_id = "custom_document_id"
		
		doc_id = await document_retrieval.store_document(
			content, 
			title="Custom ID Test",
			document_id=custom_id
		)
		
		assert doc_id == custom_id
		assert custom_id in document_retrieval.document_index
	
	async def test_convenience_function(self, document_retrieval):
		"""Test convenience function for storing text documents"""
		content = "Test content via convenience function"
		title = "Convenience Test"
		
		doc_id = await store_text_document(document_retrieval, content, title)
		
		assert doc_id is not None
		assert doc_id in document_retrieval.document_index
		
		metadata = document_retrieval.document_index[doc_id]
		assert metadata.title == title
		assert metadata.content_type == "text"


class TestDocumentRetrieval:
	"""Test document retrieval functionality"""
	
	async def test_retrieve_existing_document(self, populated_retrieval):
		"""Test retrieving an existing document"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		result = await document_retrieval.retrieve_document(doc_id)
		
		assert result is not None
		assert result['document_id'] == doc_id
		assert 'content' in result
		assert 'metadata' in result
		assert result['content'] == 'This is the first test document with important information.'
	
	async def test_retrieve_nonexistent_document(self, document_retrieval):
		"""Test retrieving non-existent document"""
		result = await document_retrieval.retrieve_document('nonexistent_id')
		
		assert result is None
	
	async def test_retrieve_with_access_tracking(self, populated_retrieval):
		"""Test that retrieval updates access statistics"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		# Get initial access count
		initial_metadata = document_retrieval.document_index[doc_id]
		initial_count = initial_metadata.access_count
		initial_accessed_at = initial_metadata.accessed_at
		
		# Retrieve document
		await document_retrieval.retrieve_document(doc_id, update_access_time=True)
		
		# Check updated access count
		updated_metadata = document_retrieval.document_index[doc_id]
		assert updated_metadata.access_count == initial_count + 1
		assert updated_metadata.accessed_at > initial_accessed_at
	
	async def test_retrieve_without_access_tracking(self, populated_retrieval):
		"""Test retrieving without updating access statistics"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		initial_metadata = document_retrieval.document_index[doc_id]
		initial_count = initial_metadata.access_count
		
		await document_retrieval.retrieve_document(doc_id, update_access_time=False)
		
		# Access count should not change
		updated_metadata = document_retrieval.document_index[doc_id]
		assert updated_metadata.access_count == initial_count
	
	async def test_cache_effectiveness(self, populated_retrieval):
		"""Test that caching improves retrieval performance"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		# First retrieval (cache miss)
		result1 = await document_retrieval.retrieve_document(doc_id)
		initial_cache_misses = document_retrieval.stats.cache_misses
		
		# Second retrieval (should be cache hit)
		result2 = await document_retrieval.retrieve_document(doc_id)
		
		assert result1 == result2
		assert document_retrieval.stats.cache_hits > 0
		assert document_retrieval.stats.cache_misses == initial_cache_misses


class TestDocumentVersioning:
	"""Test document versioning functionality"""
	
	async def test_document_versioning(self, document_retrieval):
		"""Test creating document versions"""
		content_v1 = "This is version 1 of the document"
		content_v2 = "This is version 2 of the document with updates"
		
		# Store initial version
		doc_id = await document_retrieval.store_document(
			content_v1, 
			title="Versioned Document",
			document_id="versioned_doc"
		)
		
		initial_metadata = document_retrieval.document_index[doc_id]
		assert initial_metadata.version == "1.0.0"
		
		# Update document (should create new version)
		await document_retrieval.store_document(
			content_v2,
			title="Versioned Document",
			document_id="versioned_doc"
		)
		
		updated_metadata = document_retrieval.document_index[doc_id]
		assert updated_metadata.version == "1.0.1"
		assert updated_metadata.parent_version == "1.0.0"
	
	async def test_version_history_retrieval(self, document_retrieval):
		"""Test retrieving version history"""
		doc_id = "history_test"
		
		# Create multiple versions
		for i in range(3):
			await document_retrieval.store_document(
				f"Content version {i+1}",
				title=f"Version {i+1}",
				document_id=doc_id
			)
		
		version_history = await document_retrieval.get_version_history(doc_id)
		
		assert len(version_history) == 3
		assert all(isinstance(version, DocumentVersion) for version in version_history)
		assert version_history[0].version == "1.0.0"
		assert version_history[1].version == "1.0.1"
		assert version_history[2].version == "1.0.2"


class TestDocumentMetadata:
	"""Test document metadata operations"""
	
	async def test_get_document_metadata(self, populated_retrieval):
		"""Test retrieving document metadata without content"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		metadata = await document_retrieval.get_document_metadata(doc_id)
		
		assert metadata is not None
		assert isinstance(metadata, DocumentMetadata)
		assert metadata.document_id == doc_id
		assert metadata.title == "First Document"
		assert metadata.content_type == "text"
	
	async def test_metadata_persistence(self, temp_storage):
		"""Test that metadata is persisted across instances"""
		storage_path = temp_storage / "persistence_test"
		
		# Create first instance and store document
		retrieval1 = DocumentRetrieval(storage_path)
		doc_id = await retrieval1.store_document(
			"Persistent document", 
			title="Persistence Test",
			author="test_author",
			tags=["persistent", "test"]
		)
		
		# Wait for async operations
		await asyncio.sleep(0.1)
		
		# Create second instance (should load existing metadata)
		retrieval2 = DocumentRetrieval(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Verify document was loaded
		assert doc_id in retrieval2.document_index
		metadata = retrieval2.document_index[doc_id]
		assert metadata.title == "Persistence Test"
		assert metadata.author == "test_author"
		assert metadata.tags == ["persistent", "test"]


class TestDocumentSearch:
	"""Test document search and filtering"""
	
	async def test_list_documents_basic(self, populated_retrieval):
		"""Test basic document listing"""
		document_retrieval, doc_ids = populated_retrieval
		
		documents = await document_retrieval.list_documents()
		
		assert len(documents) == 3
		assert all(isinstance(doc, DocumentMetadata) for doc in documents)
		
		# Should be sorted by updated_at descending
		for i in range(len(documents) - 1):
			assert documents[i].updated_at >= documents[i+1].updated_at
	
	async def test_list_documents_with_filters(self, populated_retrieval):
		"""Test document listing with filters"""
		document_retrieval, doc_ids = populated_retrieval
		
		# Filter by category
		test_docs = await document_retrieval.list_documents(category="test")
		assert len(test_docs) == 2
		assert all(doc.category == "test" for doc in test_docs)
		
		# Filter by content type
		text_docs = await document_retrieval.list_documents(content_type="text")
		assert len(text_docs) == 2
		assert all(doc.content_type == "text" for doc in text_docs)
		
		# Filter by tags
		tagged_docs = await document_retrieval.list_documents(tags=["markdown"])
		assert len(tagged_docs) == 1
		assert "markdown" in tagged_docs[0].tags
	
	async def test_list_documents_pagination(self, populated_retrieval):
		"""Test document listing pagination"""
		document_retrieval, doc_ids = populated_retrieval
		
		# First page
		page1 = await document_retrieval.list_documents(limit=2, offset=0)
		assert len(page1) == 2
		
		# Second page
		page2 = await document_retrieval.list_documents(limit=2, offset=2)
		assert len(page2) == 1
		
		# No overlap between pages
		page1_ids = {doc.document_id for doc in page1}
		page2_ids = {doc.document_id for doc in page2}
		assert len(page1_ids & page2_ids) == 0
	
	async def test_search_documents(self, populated_retrieval):
		"""Test document search functionality"""
		document_retrieval, doc_ids = populated_retrieval
		
		# Search by title
		results = await document_retrieval.search_documents("First Document")
		assert len(results) == 1
		assert results[0].title == "First Document"
		
		# Search by content
		results = await document_retrieval.search_documents("markdown")
		assert len(results) == 1
		assert results[0].content_type == "markdown"
		
		# Search by tags
		results = await document_retrieval.search_documents("sample")
		assert len(results) == 2  # Both test documents have "sample" tag
	
	async def test_search_with_filters(self, populated_retrieval):
		"""Test document search with additional filters"""
		document_retrieval, doc_ids = populated_retrieval
		
		# Search with content type filter
		results = await document_retrieval.search_documents(
			"test", 
			content_types=["markdown"]
		)
		# Should only return markdown documents containing "test"
		assert all(doc.content_type == "markdown" for doc in results)
		
		# Search with category filter
		results = await document_retrieval.search_documents(
			"Document",
			categories=["test"]
		)
		assert all(doc.category == "test" for doc in results)


class TestDocumentDeletion:
	"""Test document deletion functionality"""
	
	async def test_delete_single_document(self, populated_retrieval):
		"""Test deleting a single document"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		initial_count = len(document_retrieval.document_index)
		
		success = await document_retrieval.delete_document(doc_id)
		
		assert success is True
		assert doc_id not in document_retrieval.document_index
		assert len(document_retrieval.document_index) == initial_count - 1
	
	async def test_delete_nonexistent_document(self, document_retrieval):
		"""Test deleting non-existent document"""
		success = await document_retrieval.delete_document("nonexistent_id")
		
		assert success is False
	
	async def test_delete_all_versions(self, document_retrieval):
		"""Test deleting document with all versions"""
		doc_id = "versioned_delete_test"
		
		# Create multiple versions
		for i in range(3):
			await document_retrieval.store_document(
				f"Version {i+1} content",
				title=f"Version {i+1}",
				document_id=doc_id
			)
		
		# Verify versions exist
		versions = await document_retrieval.get_version_history(doc_id)
		assert len(versions) == 3
		
		# Delete all versions
		success = await document_retrieval.delete_document(doc_id, delete_all_versions=True)
		
		assert success is True
		assert doc_id not in document_retrieval.document_index
		
		# Version history should be cleared
		versions_after = await document_retrieval.get_version_history(doc_id)
		assert len(versions_after) == 0


class TestPerformanceAndStatistics:
	"""Test performance monitoring and statistics"""
	
	async def test_storage_statistics(self, populated_retrieval):
		"""Test storage statistics collection"""
		document_retrieval, doc_ids = populated_retrieval
		
		stats = await document_retrieval.get_storage_stats()
		
		assert stats['total_documents'] == 3
		assert stats['total_storage_bytes'] > 0
		assert stats['total_storage_mb'] > 0
		assert stats['cache_size'] >= 0
		assert 'retrieval_stats' in stats
		assert 'most_accessed_documents' in stats
	
	async def test_retrieval_performance_tracking(self, populated_retrieval):
		"""Test that retrieval performance is tracked"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		initial_retrievals = document_retrieval.stats.total_retrievals
		
		await document_retrieval.retrieve_document(doc_id)
		
		assert document_retrieval.stats.total_retrievals == initial_retrievals + 1
		assert document_retrieval.stats.average_retrieval_time > 0
		assert doc_id in document_retrieval.stats.most_used_content
	
	async def test_cache_statistics(self, populated_retrieval):
		"""Test cache performance statistics"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		# First retrieval (cache miss)
		await document_retrieval.retrieve_document(doc_id)
		initial_misses = document_retrieval.stats.cache_misses
		
		# Second retrieval (cache hit)
		await document_retrieval.retrieve_document(doc_id)
		
		stats = await document_retrieval.get_storage_stats()
		assert stats['cache_hit_rate'] > 0
		assert document_retrieval.stats.cache_hits > 0
		assert document_retrieval.stats.cache_misses == initial_misses  # Should not increase


class TestCacheManagement:
	"""Test cache management functionality"""
	
	async def test_clear_cache(self, populated_retrieval):
		"""Test manual cache clearing"""
		document_retrieval, doc_ids = populated_retrieval
		doc_id = doc_ids[0]
		
		# Populate cache
		await document_retrieval.retrieve_document(doc_id)
		assert document_retrieval.cache.size() > 0
		
		# Clear cache
		await document_retrieval.clear_cache()
		assert document_retrieval.cache.size() == 0
	
	async def test_cache_memory_management(self, temp_storage):
		"""Test cache memory limits"""
		# Create retrieval with small cache
		retrieval = DocumentRetrieval(
			temp_storage / "cache_test", 
			cache_size=2  # Very small cache
		)
		
		# Store multiple documents
		doc_ids = []
		for i in range(5):
			doc_id = await retrieval.store_document(
				f"Content for document {i}",
				title=f"Document {i}"
			)
			doc_ids.append(doc_id)
		
		# Retrieve all documents (should trigger cache eviction)
		for doc_id in doc_ids:
			await retrieval.retrieve_document(doc_id)
		
		# Cache should not exceed size limit
		assert retrieval.cache.size() <= 2


class TestStorageOptimization:
	"""Test storage optimization features"""
	
	async def test_storage_optimization(self, populated_retrieval):
		"""Test storage optimization functionality"""
		document_retrieval, doc_ids = populated_retrieval
		
		# Create some orphaned files manually (for testing)
		orphaned_file = document_retrieval.documents_path / "orphaned_file.txt"
		orphaned_file.write_text("Orphaned content")
		
		optimization_stats = await document_retrieval.optimize_storage()
		
		assert 'orphaned_files_removed' in optimization_stats
		assert 'space_recovered_bytes' in optimization_stats
		assert 'errors' in optimization_stats
		
		# Orphaned file should be removed
		assert not orphaned_file.exists()


class TestEdgeCases:
	"""Test edge cases and error conditions"""
	
	async def test_empty_content_storage(self, document_retrieval):
		"""Test storing document with empty content"""
		doc_id = await document_retrieval.store_document(
			"", 
			title="Empty Document"
		)
		
		assert doc_id in document_retrieval.document_index
		
		result = await document_retrieval.retrieve_document(doc_id)
		assert result is not None
		assert result['content'] == ""
	
	async def test_large_document_handling(self, document_retrieval):
		"""Test handling of large documents"""
		large_content = "Large content " * 10000  # ~130KB
		
		doc_id = await document_retrieval.store_document(
			large_content,
			title="Large Document"
		)
		
		assert doc_id in document_retrieval.document_index
		
		result = await document_retrieval.retrieve_document(doc_id)
		assert result is not None
		assert len(result['content']) == len(large_content)
	
	async def test_special_characters_in_content(self, document_retrieval):
		"""Test handling of special characters"""
		special_content = "Special chars: @#$%^&*()_+{}|:<>?[]\\;',./`~\n\t\r"
		
		doc_id = await document_retrieval.store_document(
			special_content,
			title="Special Characters"
		)
		
		result = await document_retrieval.retrieve_document(doc_id)
		assert result is not None
		assert result['content'] == special_content
	
	async def test_unicode_content_handling(self, document_retrieval):
		"""Test handling of Unicode content"""
		unicode_content = "Unicode: café, naïve, résumé, 中文, العربية, 🚀"
		
		doc_id = await document_retrieval.store_document(
			unicode_content,
			title="Unicode Document"
		)
		
		result = await document_retrieval.retrieve_document(doc_id)
		assert result is not None
		assert result['content'] == unicode_content


@pytest.mark.asyncio
async def test_concurrent_operations(populated_retrieval):
	"""Test concurrent document operations"""
	document_retrieval, doc_ids = populated_retrieval
	
	# Concurrent retrievals
	tasks = [
		document_retrieval.retrieve_document(doc_id) 
		for doc_id in doc_ids
	]
	
	results = await asyncio.gather(*tasks)
	
	assert len(results) == len(doc_ids)
	assert all(result is not None for result in results)
	assert all(result['document_id'] in doc_ids for result in results)


@pytest.mark.asyncio
async def test_retrieval_performance(populated_retrieval):
	"""Test retrieval performance"""
	import time
	
	document_retrieval, doc_ids = populated_retrieval
	doc_id = doc_ids[0]
	
	# Time multiple retrievals
	start_time = time.time()
	for _ in range(10):
		await document_retrieval.retrieve_document(doc_id)
	end_time = time.time()
	
	average_time = (end_time - start_time) / 10
	
	# Should complete retrievals quickly (especially with caching)
	assert average_time < 0.01  # Less than 10ms per retrieval