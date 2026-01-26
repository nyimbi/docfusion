#!/usr/bin/env python3
"""
Test Suite for DocumentIndexer Module

Comprehensive tests covering file-based document catalog, metadata extraction,
incremental indexing, index optimization, and performance monitoring.
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from datetime import datetime

from docfusion.storage.indexes.document_indexer import (
	DocumentIndexer, IndexedDocument, IndexConfiguration, IndexStats,
	create_document_indexer, index_text_document
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def temp_files(temp_storage):
	"""Create temporary files for testing file indexing"""
	files_dir = temp_storage / "test_files"
	files_dir.mkdir()
	
	files = {
		'test1.txt': 'This is the first test file with some content about machine learning.',
		'test2.md': '# Markdown File\n\nThis is a **markdown** file with *formatting* and data science content.',
		'test3.py': 'def hello_world():\n    """A simple Python function"""\n    print("Hello, World!")',
		'test4.log': '[2024-01-01] INFO: Application started successfully\n[2024-01-01] DEBUG: Processing user request',
		'test5.json': '{"name": "test", "type": "json", "data": {"items": [1, 2, 3]}}'
	}
	
	file_paths = []
	for filename, content in files.items():
		file_path = files_dir / filename
		file_path.write_text(content)
		file_paths.append(file_path)
	
	return files_dir, file_paths


@pytest.fixture
async def document_indexer(temp_storage):
	"""Create DocumentIndexer instance for testing"""
	config = IndexConfiguration(
		enable_content_extraction=True,
		enable_keyword_extraction=True,
		max_content_length=100000,
		index_batch_size=10
	)
	indexer = DocumentIndexer(temp_storage / "indexes", config)
	return indexer


@pytest.fixture
async def populated_indexer(document_indexer):
	"""Create indexer with sample documents"""
	documents = [
		{
			'title': 'Machine Learning Introduction',
			'content': 'Machine learning is a subset of artificial intelligence. It focuses on algorithms that can learn from data without being explicitly programmed.',
			'content_type': 'text',
			'category': 'ai',
			'tags': ['machine-learning', 'ai', 'algorithms']
		},
		{
			'title': 'Data Science Overview', 
			'content': 'Data science combines statistics, programming, and domain expertise to extract insights from data. It uses scientific methods to analyze data.',
			'content_type': 'text',
			'category': 'data',
			'tags': ['data-science', 'statistics', 'analytics']
		},
		{
			'title': 'Python Programming',
			'content': 'Python is a high-level programming language known for its simplicity and readability. It is widely used in web development and data analysis.',
			'content_type': 'code',
			'category': 'programming',
			'tags': ['python', 'programming', 'development']
		}
	]
	
	doc_ids = []
	for doc in documents:
		doc_id = await document_indexer.index_document(**doc)
		doc_ids.append(doc_id)
	
	return document_indexer, doc_ids


class TestIndexConfiguration:
	"""Test indexing configuration"""
	
	def test_default_configuration(self):
		"""Test default configuration values"""
		config = IndexConfiguration()
		
		assert config.enable_content_extraction is True
		assert config.enable_keyword_extraction is True
		assert config.enable_entity_extraction is False
		assert config.max_content_length == 1_000_000
		assert config.index_batch_size == 100
		assert config.enable_incremental_indexing is True
		assert '.txt' in config.supported_file_types
		assert '.md' in config.supported_file_types
	
	def test_custom_configuration(self):
		"""Test custom configuration"""
		config = IndexConfiguration(
			enable_content_extraction=False,
			max_content_length=50000,
			index_batch_size=50,
			supported_file_types={'.txt', '.pdf'}
		)
		
		assert config.enable_content_extraction is False
		assert config.max_content_length == 50000
		assert config.index_batch_size == 50
		assert config.supported_file_types == {'.txt', '.pdf'}


class TestDocumentIndexerInitialization:
	"""Test DocumentIndexer initialization"""
	
	async def test_indexer_creation(self, temp_storage):
		"""Test basic indexer creation"""
		indexer = DocumentIndexer(temp_storage / "test_indexer")
		
		assert indexer is not None
		assert indexer.storage_path.exists()
		assert indexer.catalog_path.exists()
		assert indexer.metadata_path.exists()
		assert indexer.indexes_path.exists()
		assert len(indexer.document_catalog) == 0
	
	async def test_factory_function(self, temp_storage):
		"""Test factory function for indexer creation"""
		config = IndexConfiguration(max_content_length=50000)
		indexer = await create_document_indexer(temp_storage / "factory_test", config)
		
		assert isinstance(indexer, DocumentIndexer)
		assert indexer.config.max_content_length == 50000
	
	async def test_indexer_with_custom_config(self, temp_storage):
		"""Test indexer creation with custom configuration"""
		config = IndexConfiguration(
			enable_keyword_extraction=False,
			index_batch_size=25
		)
		
		indexer = DocumentIndexer(temp_storage / "custom_config", config)
		
		assert indexer.config.enable_keyword_extraction is False
		assert indexer.config.index_batch_size == 25


class TestDocumentIndexing:
	"""Test document indexing functionality"""
	
	async def test_index_simple_document(self, document_indexer):
		"""Test indexing a simple text document"""
		title = "Test Document"
		content = "This is a test document with some content for indexing."
		
		doc_id = await document_indexer.index_document(
			title=title,
			content=content,
			content_type="text"
		)
		
		assert doc_id is not None
		assert doc_id in document_indexer.document_catalog
		
		indexed_doc = document_indexer.document_catalog[doc_id]
		assert indexed_doc.title == title
		assert indexed_doc.content == content
		assert indexed_doc.content_type == "text"
		assert indexed_doc.word_count > 0
		assert indexed_doc.char_count == len(content)
		assert len(indexed_doc.extracted_keywords) > 0
	
	async def test_index_document_with_metadata(self, document_indexer):
		"""Test indexing document with comprehensive metadata"""
		doc_data = {
			'title': 'Comprehensive Test',
			'content': 'This document has comprehensive metadata including tags, category, and custom fields.',
			'content_type': 'text',
			'category': 'test',
			'author': 'test_author',
			'tags': ['test', 'comprehensive', 'metadata'],
			'custom_fields': {'priority': 'high', 'department': 'engineering'}
		}
		
		doc_id = await document_indexer.index_document(**doc_data)
		
		indexed_doc = document_indexer.document_catalog[doc_id]
		assert indexed_doc.title == doc_data['title']
		assert indexed_doc.category == doc_data['category']
		assert indexed_doc.author == doc_data['author']
		assert indexed_doc.tags == doc_data['tags']
		assert indexed_doc.custom_fields == doc_data['custom_fields']
	
	async def test_index_file_based_document(self, document_indexer, temp_files):
		"""Test indexing document from file"""
		files_dir, file_paths = temp_files
		text_file = file_paths[0]  # test1.txt
		
		doc_id = await document_indexer.index_document(
			file_path=text_file,
			category="file_test"
		)
		
		assert doc_id is not None
		assert doc_id in document_indexer.document_catalog
		
		indexed_doc = document_indexer.document_catalog[doc_id]
		assert indexed_doc.title == text_file.stem
		assert indexed_doc.file_path == str(text_file)
		assert indexed_doc.category == "file_test"
		assert "machine learning" in indexed_doc.content.lower()
	
	async def test_index_document_update(self, document_indexer):
		"""Test updating existing document"""
		doc_id = "update_test"
		original_content = "Original content for update test"
		updated_content = "Updated content with new information for testing"
		
		# Index original document
		await document_indexer.index_document(
			document_id=doc_id,
			title="Update Test",
			content=original_content
		)
		
		original_doc = document_indexer.document_catalog[doc_id]
		original_word_count = original_doc.word_count
		
		# Update document
		await document_indexer.index_document(
			document_id=doc_id,
			title="Update Test",
			content=updated_content
		)
		
		updated_doc = document_indexer.document_catalog[doc_id]
		assert updated_doc.content == updated_content
		assert updated_doc.word_count != original_word_count
		assert updated_doc.last_updated > original_doc.last_updated
	
	async def test_convenience_function(self, document_indexer):
		"""Test convenience function for indexing text documents"""
		content = "Content indexed via convenience function"
		title = "Convenience Test"
		
		doc_id = await index_text_document(document_indexer, content, title)
		
		assert doc_id in document_indexer.document_catalog
		indexed_doc = document_indexer.document_catalog[doc_id]
		assert indexed_doc.title == title
		assert indexed_doc.content_type == "text"


class TestDirectoryIndexing:
	"""Test directory indexing functionality"""
	
	async def test_index_directory_basic(self, document_indexer, temp_files):
		"""Test basic directory indexing"""
		files_dir, file_paths = temp_files
		
		results = await document_indexer.index_directory(files_dir, recursive=False)
		
		assert results['indexed_files'] > 0
		assert results['indexed_files'] <= len(file_paths)
		assert len(results['indexed_documents']) == results['indexed_files']
		assert results['skipped_files'] >= 0
		assert len(results['errors']) == 0
	
	async def test_index_directory_with_category(self, document_indexer, temp_files):
		"""Test directory indexing with custom category"""
		files_dir, file_paths = temp_files
		
		results = await document_indexer.index_directory(
			files_dir, 
			category="directory_test",
			batch_size=2
		)
		
		assert results['indexed_files'] > 0
		
		# Check that documents have the correct category
		for doc_id in results['indexed_documents']:
			doc = document_indexer.document_catalog[doc_id]
			assert doc.category == "directory_test"
	
	async def test_index_directory_recursive(self, document_indexer, temp_storage):
		"""Test recursive directory indexing"""
		# Create nested directory structure
		root_dir = temp_storage / "recursive_test"
		root_dir.mkdir()
		
		sub_dir1 = root_dir / "subdir1"
		sub_dir1.mkdir()
		sub_dir2 = root_dir / "subdir2"
		sub_dir2.mkdir()
		
		# Create files in different directories
		files = [
			(root_dir / "root.txt", "Root level file"),
			(sub_dir1 / "sub1.txt", "Subdirectory 1 file"), 
			(sub_dir2 / "sub2.md", "# Subdirectory 2 markdown file")
		]
		
		for file_path, content in files:
			file_path.write_text(content)
		
		results = await document_indexer.index_directory(root_dir, recursive=True)
		
		assert results['indexed_files'] == 3
		assert len(results['indexed_documents']) == 3
	
	async def test_index_directory_incremental(self, document_indexer, temp_files):
		"""Test incremental directory indexing"""
		files_dir, file_paths = temp_files
		
		# First indexing
		results1 = await document_indexer.index_directory(files_dir)
		initial_indexed = results1['indexed_files']
		
		# Second indexing (should skip already indexed files)
		results2 = await document_indexer.index_directory(files_dir)
		
		assert results2['skipped_files'] >= initial_indexed
		assert results2['indexed_files'] == 0  # No new files to index


class TestSearchAndRetrieval:
	"""Test document search and retrieval functionality"""
	
	async def test_get_document_by_id(self, populated_indexer):
		"""Test retrieving document by ID"""
		document_indexer, doc_ids = populated_indexer
		doc_id = doc_ids[0]
		
		doc = await document_indexer.get_document_by_id(doc_id)
		
		assert doc is not None
		assert doc.document_id == doc_id
		assert doc.title == "Machine Learning Introduction"
	
	async def test_get_nonexistent_document(self, document_indexer):
		"""Test retrieving non-existent document"""
		doc = await document_indexer.get_document_by_id("nonexistent_id")
		
		assert doc is None
	
	async def test_search_by_category(self, populated_indexer):
		"""Test searching documents by category"""
		document_indexer, doc_ids = populated_indexer
		
		ai_docs = await document_indexer.search_by_category("ai")
		assert len(ai_docs) == 1
		assert ai_docs[0].category == "ai"
		assert ai_docs[0].title == "Machine Learning Introduction"
		
		data_docs = await document_indexer.search_by_category("data")
		assert len(data_docs) == 1
		assert data_docs[0].category == "data"
	
	async def test_search_by_content_type(self, populated_indexer):
		"""Test searching documents by content type"""
		document_indexer, doc_ids = populated_indexer
		
		text_docs = await document_indexer.search_by_content_type("text")
		assert len(text_docs) == 2
		assert all(doc.content_type == "text" for doc in text_docs)
		
		code_docs = await document_indexer.search_by_content_type("code")
		assert len(code_docs) == 1
		assert code_docs[0].content_type == "code"
	
	async def test_search_by_tags(self, populated_indexer):
		"""Test searching documents by tags"""
		document_indexer, doc_ids = populated_indexer
		
		# Search with single tag
		ai_tagged = await document_indexer.search_by_tags(["ai"])
		assert len(ai_tagged) == 1
		assert "ai" in ai_tagged[0].tags
		
		# Search with multiple tags (match any)
		prog_tagged = await document_indexer.search_by_tags(
			["programming", "machine-learning"], 
			match_all=False
		)
		assert len(prog_tagged) == 2  # Should find both programming and ML docs
		
		# Search with multiple tags (match all)
		specific_tagged = await document_indexer.search_by_tags(
			["python", "programming"], 
			match_all=True
		)
		assert len(specific_tagged) == 1  # Only Python doc has both tags
	
	async def test_search_by_keywords(self, populated_indexer):
		"""Test searching documents by extracted keywords"""
		document_indexer, doc_ids = populated_indexer
		
		# Search with single keyword
		keyword_docs = await document_indexer.search_by_keywords(["learning"])
		assert len(keyword_docs) >= 1
		
		# Search with multiple keywords (match any)
		multi_keyword_docs = await document_indexer.search_by_keywords(
			["python", "data"], 
			match_all=False
		)
		assert len(multi_keyword_docs) >= 2


class TestDocumentRemoval:
	"""Test document removal functionality"""
	
	async def test_remove_document(self, populated_indexer):
		"""Test removing a document from index"""
		document_indexer, doc_ids = populated_indexer
		doc_id = doc_ids[0]
		initial_count = len(document_indexer.document_catalog)
		
		success = await document_indexer.remove_document(doc_id)
		
		assert success is True
		assert doc_id not in document_indexer.document_catalog
		assert len(document_indexer.document_catalog) == initial_count - 1
		
		# Check that secondary indexes were updated
		ai_docs = await document_indexer.search_by_category("ai")
		assert len(ai_docs) == 0
	
	async def test_remove_nonexistent_document(self, document_indexer):
		"""Test removing non-existent document"""
		success = await document_indexer.remove_document("nonexistent_id")
		
		assert success is False


class TestIndexOptimization:
	"""Test index optimization functionality"""
	
	async def test_optimize_indexes(self, populated_indexer):
		"""Test index optimization"""
		document_indexer, doc_ids = populated_indexer
		
		# Remove a document to create empty index entries
		await document_indexer.remove_document(doc_ids[0])
		
		optimization_stats = await document_indexer.optimize_indexes()
		
		assert 'removed_empty_categories' in optimization_stats
		assert 'removed_empty_tags' in optimization_stats
		assert 'removed_empty_keywords' in optimization_stats
		assert 'compacted_indexes' in optimization_stats
		assert optimization_stats['compacted_indexes'] > 0


class TestReindexing:
	"""Test document reindexing functionality"""
	
	async def test_reindex_file_based_document(self, document_indexer, temp_files):
		"""Test reindexing file-based document"""
		files_dir, file_paths = temp_files
		text_file = file_paths[0]  # test1.txt
		
		# Index file
		doc_id = await document_indexer.index_document(file_path=text_file)
		original_doc = document_indexer.document_catalog[doc_id]
		
		# Modify file content
		new_content = "Updated content for reindexing test"
		text_file.write_text(new_content)
		
		# Reindex document
		success = await document_indexer.reindex_document(doc_id)
		
		assert success is True
		
		updated_doc = document_indexer.document_catalog[doc_id]
		assert updated_doc.content == new_content
		assert updated_doc.last_modified > original_doc.last_modified
	
	async def test_reindex_nonexistent_document(self, document_indexer):
		"""Test reindexing non-existent document"""
		success = await document_indexer.reindex_document("nonexistent_id")
		
		assert success is False
	
	async def test_reindex_memory_only_document(self, document_indexer):
		"""Test reindexing document with no file path"""
		doc_id = await document_indexer.index_document(
			title="Memory Only",
			content="This document has no file path"
		)
		
		success = await document_indexer.reindex_document(doc_id)
		
		assert success is False  # Cannot reindex without file path


class TestStatisticsAndAnalytics:
	"""Test indexing statistics and analytics"""
	
	async def test_index_statistics(self, populated_indexer):
		"""Test index statistics collection"""
		document_indexer, doc_ids = populated_indexer
		
		stats = await document_indexer.get_index_statistics()
		
		assert isinstance(stats, IndexStats)
		assert stats.total_documents == 3
		assert stats.total_size_bytes > 0
		assert len(stats.documents_by_type) > 0
		assert len(stats.documents_by_category) > 0
		assert 'text' in stats.documents_by_type
		assert stats.documents_by_type['text'] == 2
	
	async def test_statistics_persistence(self, temp_storage):
		"""Test that statistics are persisted"""
		storage_path = temp_storage / "stats_test"
		
		# Create indexer and add document
		indexer1 = DocumentIndexer(storage_path)
		await indexer1.index_document(
			title="Stats Test",
			content="Content for statistics test"
		)
		
		# Save indexes
		await indexer1._save_all_indexes()
		
		# Create new indexer instance
		indexer2 = DocumentIndexer(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Check that statistics were loaded
		stats = await indexer2.get_index_statistics()
		assert stats.total_documents == 1


class TestKeywordExtraction:
	"""Test keyword extraction functionality"""
	
	async def test_keyword_extraction_enabled(self, temp_storage):
		"""Test keyword extraction when enabled"""
		config = IndexConfiguration(enable_keyword_extraction=True)
		indexer = DocumentIndexer(temp_storage / "keyword_test", config)
		
		content = "Machine learning algorithms analyze data patterns to make predictions and classifications"
		doc_id = await indexer.index_document(
			title="Keyword Test",
			content=content
		)
		
		doc = indexer.document_catalog[doc_id]
		assert len(doc.extracted_keywords) > 0
		
		# Should contain relevant keywords
		keywords_text = " ".join(doc.extracted_keywords)
		assert "machine" in keywords_text or "learning" in keywords_text
	
	async def test_keyword_extraction_disabled(self, temp_storage):
		"""Test keyword extraction when disabled"""
		config = IndexConfiguration(enable_keyword_extraction=False)
		indexer = DocumentIndexer(temp_storage / "no_keyword_test", config)
		
		content = "Machine learning algorithms analyze data patterns"
		doc_id = await indexer.index_document(
			title="No Keyword Test",
			content=content
		)
		
		doc = indexer.document_catalog[doc_id]
		assert len(doc.extracted_keywords) == 0


class TestContentExtraction:
	"""Test content extraction from files"""
	
	async def test_text_file_extraction(self, document_indexer, temp_storage):
		"""Test extracting content from text file"""
		text_file = temp_storage / "test.txt"
		content = "This is a test text file for content extraction"
		text_file.write_text(content)
		
		doc_id = await document_indexer.index_document(file_path=text_file)
		
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == content
		assert doc.content_type == "text"
	
	async def test_markdown_file_extraction(self, document_indexer, temp_storage):
		"""Test extracting content from markdown file"""
		md_file = temp_storage / "test.md"
		content = "# Markdown Title\n\nThis is **bold** text"
		md_file.write_text(content)
		
		doc_id = await document_indexer.index_document(file_path=md_file)
		
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == content
		assert doc.content_type == "text"  # Markdown treated as text
	
	async def test_json_file_extraction(self, document_indexer, temp_storage):
		"""Test extracting content from JSON file"""
		json_file = temp_storage / "test.json"
		content = '{"name": "test", "data": [1, 2, 3]}'
		json_file.write_text(content)
		
		doc_id = await document_indexer.index_document(file_path=json_file)
		
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == content
		assert doc.content_type == "json"


class TestIndexPersistence:
	"""Test index persistence and loading"""
	
	async def test_document_catalog_persistence(self, temp_storage):
		"""Test that document catalog is persisted and loaded"""
		storage_path = temp_storage / "persistence_test"
		
		# Create indexer and add documents
		indexer1 = DocumentIndexer(storage_path)
		doc_id1 = await indexer1.index_document(
			title="Persistent Doc 1",
			content="Content for persistence test 1"
		)
		doc_id2 = await indexer1.index_document(
			title="Persistent Doc 2", 
			content="Content for persistence test 2"
		)
		
		# Save indexes
		await indexer1._save_all_indexes()
		
		# Create new indexer instance
		indexer2 = DocumentIndexer(storage_path)
		
		# Wait for loading to complete
		await asyncio.sleep(0.1)
		
		# Verify documents were loaded
		assert doc_id1 in indexer2.document_catalog
		assert doc_id2 in indexer2.document_catalog
		assert len(indexer2.document_catalog) == 2
		
		doc1 = indexer2.document_catalog[doc_id1]
		assert doc1.title == "Persistent Doc 1"
	
	async def test_secondary_indexes_persistence(self, temp_storage):
		"""Test that secondary indexes are persisted and loaded"""
		storage_path = temp_storage / "secondary_persistence_test"
		
		# Create indexer and add document with specific category/tags
		indexer1 = DocumentIndexer(storage_path)
		doc_id = await indexer1.index_document(
			title="Tagged Document",
			content="Content with tags",
			category="test_category",
			tags=["test", "persistence"]
		)
		
		# Save indexes
		await indexer1._save_all_indexes()
		
		# Create new indexer instance
		indexer2 = DocumentIndexer(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Test that secondary indexes work
		category_docs = await indexer2.search_by_category("test_category")
		assert len(category_docs) == 1
		assert category_docs[0].document_id == doc_id
		
		tag_docs = await indexer2.search_by_tags(["test"])
		assert len(tag_docs) == 1
		assert tag_docs[0].document_id == doc_id


class TestEdgeCases:
	"""Test edge cases and error conditions"""
	
	async def test_empty_content_indexing(self, document_indexer):
		"""Test indexing document with empty content"""
		doc_id = await document_indexer.index_document(
			title="Empty Content",
			content="",
			content_type="text"
		)
		
		assert doc_id in document_indexer.document_catalog
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == ""
		assert doc.word_count == 0
		assert doc.char_count == 0
	
	async def test_large_content_handling(self, document_indexer):
		"""Test handling of large content"""
		large_content = "Large content " * 10000  # ~130KB
		
		doc_id = await document_indexer.index_document(
			title="Large Document",
			content=large_content
		)
		
		doc = document_indexer.document_catalog[doc_id]
		assert doc_id in document_indexer.document_catalog
		assert doc.word_count > 0
	
	async def test_special_characters_in_content(self, document_indexer):
		"""Test handling of special characters"""
		special_content = "Special chars: @#$%^&*()_+{}|:<>?[]\\;',./`~"
		
		doc_id = await document_indexer.index_document(
			title="Special Characters",
			content=special_content
		)
		
		assert doc_id in document_indexer.document_catalog
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == special_content
	
	async def test_unicode_content_handling(self, document_indexer):
		"""Test handling of Unicode content"""
		unicode_content = "Unicode: café, naïve, résumé, 中文, العربية"
		
		doc_id = await document_indexer.index_document(
			title="Unicode Document",
			content=unicode_content
		)
		
		assert doc_id in document_indexer.document_catalog
		doc = document_indexer.document_catalog[doc_id]
		assert doc.content == unicode_content
	
	async def test_nonexistent_file_indexing(self, document_indexer, temp_storage):
		"""Test indexing non-existent file"""
		nonexistent_file = temp_storage / "nonexistent.txt"
		
		with pytest.raises(ValueError, match="File not found"):
			await document_indexer.index_document(file_path=nonexistent_file)


@pytest.mark.asyncio
async def test_concurrent_indexing(document_indexer):
	"""Test concurrent document indexing"""
	documents = [
		{
			'title': f'Concurrent Doc {i}',
			'content': f'Content for concurrent document number {i} with various keywords and information.',
			'category': f'category_{i % 3}',
			'tags': [f'tag_{i}', 'concurrent', 'test']
		}
		for i in range(10)
	]
	
	# Index documents concurrently
	tasks = [
		document_indexer.index_document(**doc) 
		for doc in documents
	]
	
	doc_ids = await asyncio.gather(*tasks)
	
	assert len(doc_ids) == 10
	assert len(set(doc_ids)) == 10  # All IDs should be unique
	assert len(document_indexer.document_catalog) == 10


@pytest.mark.asyncio
async def test_indexing_performance(document_indexer):
	"""Test indexing performance"""
	import time
	
	documents = [
		{
			'title': f'Performance Test {i}',
			'content': f'Performance testing content for document {i} with sufficient text to test indexing speed and efficiency.',
			'content_type': 'text',
			'category': 'performance',
			'tags': ['performance', 'test', f'doc{i}']
		}
		for i in range(50)  # Index 50 documents
	]
	
	start_time = time.time()
	
	for doc in documents:
		await document_indexer.index_document(**doc)
	
	end_time = time.time()
	total_time = end_time - start_time
	
	# Should index documents reasonably quickly
	assert total_time < 5.0  # Less than 5 seconds for 50 documents
	assert len(document_indexer.document_catalog) == 50
	
	# Test search performance
	start_time = time.time()
	results = await document_indexer.search_by_category("performance")
	search_time = time.time() - start_time
	
	assert len(results) == 50
	assert search_time < 0.1  # Search should be very fast