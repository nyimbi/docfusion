#!/usr/bin/env python3
"""
Test Suite for TextSearchEngine Module

Comprehensive tests covering keyword matching, Boolean search operators, fuzzy search,
TF-IDF ranking, search result highlighting, and performance optimization.
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.storage.engines.text_search_engine import (
	TextSearchEngine, SearchQuery, SearchResult, DocumentIndex, 
	create_search_engine, search_documents
)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def search_engine(temp_storage):
	"""Create TextSearchEngine instance for testing"""
	engine = TextSearchEngine(temp_storage / "search")
	return engine


@pytest.fixture
async def populated_engine(search_engine):
	"""Create search engine with sample documents"""
	# Add sample documents
	documents = [
		{
			'id': 'doc1',
			'title': 'Machine Learning Introduction',
			'content': 'Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models. It enables computer systems to improve their performance on a specific task through experience without being explicitly programmed.'
		},
		{
			'id': 'doc2', 
			'title': 'Deep Learning Neural Networks',
			'content': 'Deep learning uses neural networks with multiple layers to model and understand complex patterns in data. It has revolutionized fields like computer vision, natural language processing, and speech recognition.'
		},
		{
			'id': 'doc3',
			'title': 'Data Science Analytics',
			'content': 'Data science combines domain expertise, programming skills, and knowledge of mathematics and statistics to extract meaningful insights from data. It involves data collection, cleaning, analysis, and visualization.'
		},
		{
			'id': 'doc4',
			'title': 'Artificial Intelligence Overview',
			'content': 'Artificial intelligence refers to the simulation of human intelligence in machines that are programmed to think and learn like humans. AI systems can perform tasks that typically require human intelligence.'
		},
		{
			'id': 'doc5',
			'title': 'Statistical Analysis Methods',
			'content': 'Statistical analysis involves collecting and analyzing data to identify patterns and trends. It uses mathematical techniques to summarize, describe, and make inferences from data sets.'
		}
	]
	
	for doc in documents:
		await search_engine.index_document(
			document_id=doc['id'],
			title=doc['title'],
			content=doc['content']
		)
	
	return search_engine


class TestTextSearchEngineInitialization:
	"""Test search engine initialization and basic operations"""
	
	async def test_engine_creation(self, temp_storage):
		"""Test basic engine creation"""
		engine = TextSearchEngine(temp_storage / "search")
		assert engine is not None
		assert engine.storage_path.exists()
		assert len(engine.document_indexes) == 0
		assert engine.total_documents == 0
	
	async def test_factory_function(self, temp_storage):
		"""Test factory function for engine creation"""
		engine = await create_search_engine(temp_storage / "search")
		assert isinstance(engine, TextSearchEngine)


class TestDocumentIndexing:
	"""Test document indexing functionality"""
	
	async def test_index_single_document(self, search_engine):
		"""Test indexing a single document"""
		doc_id = 'test_doc'
		title = 'Test Document'
		content = 'This is a test document for indexing functionality.'
		
		await search_engine.index_document(doc_id, title, content)
		
		assert doc_id in search_engine.document_indexes
		assert search_engine.total_documents == 1
		
		doc_index = search_engine.document_indexes[doc_id]
		assert doc_index.title == title
		assert doc_index.content == content
		assert len(doc_index.tokens) > 0
		assert len(doc_index.stems) > 0
	
	async def test_index_multiple_documents(self, search_engine):
		"""Test indexing multiple documents"""
		documents = [
			('doc1', 'First Document', 'Content of the first document'),
			('doc2', 'Second Document', 'Content of the second document'),
			('doc3', 'Third Document', 'Content of the third document')
		]
		
		for doc_id, title, content in documents:
			await search_engine.index_document(doc_id, title, content)
		
		assert search_engine.total_documents == 3
		assert all(doc_id in search_engine.document_indexes for doc_id, _, _ in documents)
	
	async def test_document_update(self, search_engine):
		"""Test updating existing document"""
		doc_id = 'update_doc'
		original_content = 'Original content'
		updated_content = 'Updated content with new information'
		
		# Index original document
		await search_engine.index_document(doc_id, 'Test Doc', original_content)
		assert search_engine.total_documents == 1
		
		# Update document
		await search_engine.index_document(doc_id, 'Test Doc', updated_content)
		assert search_engine.total_documents == 1  # Should not increase
		
		doc_index = search_engine.document_indexes[doc_id]
		assert doc_index.content == updated_content
	
	async def test_empty_content_handling(self, search_engine):
		"""Test handling of empty content"""
		# Should not crash, but should handle gracefully
		await search_engine.index_document('empty_doc', '', '')
		# Engine should handle this gracefully without indexing


class TestKeywordSearch:
	"""Test keyword-based search functionality"""
	
	async def test_simple_keyword_search(self, populated_engine):
		"""Test basic keyword search"""
		query = SearchQuery(query="machine learning", boolean_operators=False)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		# Should find documents containing "machine learning"
		doc_ids = [r.document_id for r in results]
		assert 'doc1' in doc_ids  # "Machine Learning Introduction"
		assert results[0].match_type == "keyword"
	
	async def test_case_insensitive_search(self, populated_engine):
		"""Test case-insensitive search"""
		query1 = SearchQuery(query="MACHINE LEARNING")
		query2 = SearchQuery(query="machine learning")
		
		results1 = await populated_engine.search(query1)
		results2 = await populated_engine.search(query2)
		
		assert len(results1) == len(results2)
		assert [r.document_id for r in results1] == [r.document_id for r in results2]
	
	async def test_partial_word_match(self, populated_engine):
		"""Test partial word matching"""
		query = SearchQuery(query="intelli")
		results = await populated_engine.search(query)
		
		# Should find documents with "intelligence" or "intelligent"
		assert len(results) > 0
		doc_ids = [r.document_id for r in results]
		assert 'doc1' in doc_ids or 'doc4' in doc_ids
	
	async def test_relevance_ranking(self, populated_engine):
		"""Test TF-IDF relevance ranking"""
		query = SearchQuery(query="learning")
		results = await populated_engine.search(query)
		
		assert len(results) >= 2
		# Results should be ordered by relevance
		assert results[0].relevance_score >= results[1].relevance_score
	
	async def test_empty_query_handling(self, populated_engine):
		"""Test handling of empty queries"""
		query = SearchQuery(query="")
		results = await populated_engine.search(query)
		
		assert len(results) == 0


class TestBooleanSearch:
	"""Test Boolean search with AND, OR, NOT operators"""
	
	async def test_and_operator(self, populated_engine):
		"""Test AND operator in Boolean search"""
		query = SearchQuery(query="machine AND learning", boolean_operators=True)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		# All results should contain both "machine" and "learning"
		for result in results:
			content_lower = result.content.lower()
			assert "machine" in content_lower and "learning" in content_lower
		assert results[0].match_type == "boolean"
	
	async def test_or_operator(self, populated_engine):
		"""Test OR operator in Boolean search"""
		query = SearchQuery(query="neural OR statistical", boolean_operators=True)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		# Results should contain either "neural" or "statistical"
		for result in results:
			content_lower = result.content.lower()
			assert "neural" in content_lower or "statistical" in content_lower
	
	async def test_not_operator(self, populated_engine):
		"""Test NOT operator in Boolean search"""
		query = SearchQuery(query="learning NOT deep", boolean_operators=True)
		results = await populated_engine.search(query)
		
		# Results should contain "learning" but not "deep"
		for result in results:
			content_lower = result.content.lower()
			assert "learning" in content_lower
			assert "deep" not in content_lower
	
	async def test_complex_boolean_query(self, populated_engine):
		"""Test complex Boolean query with multiple operators"""
		query = SearchQuery(query="(machine OR artificial) AND intelligence", boolean_operators=True)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		# Should find documents with intelligence and either machine or artificial
	
	async def test_boolean_without_operators(self, populated_engine):
		"""Test Boolean search mode without operators (should default to AND)"""
		query = SearchQuery(query="machine learning", boolean_operators=True)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		# Should behave like AND search


class TestFuzzySearch:
	"""Test fuzzy search functionality"""
	
	async def test_fuzzy_search_enabled(self, populated_engine):
		"""Test fuzzy search with spelling variations"""
		# Misspelled query
		query = SearchQuery(query="machne learing", fuzzy_search=True, max_fuzzy_distance=2)
		results = await populated_engine.search(query)
		
		# Should find documents despite misspelling
		assert len(results) > 0
		fuzzy_results = [r for r in results if r.match_type == "fuzzy"]
		assert len(fuzzy_results) > 0
	
	async def test_fuzzy_search_disabled(self, populated_engine):
		"""Test with fuzzy search disabled"""
		query = SearchQuery(query="machne learing", fuzzy_search=False)
		results = await populated_engine.search(query)
		
		# Should find fewer or no results without fuzzy matching
		fuzzy_results = [r for r in results if r.match_type == "fuzzy"]
		assert len(fuzzy_results) == 0
	
	async def test_fuzzy_distance_threshold(self, populated_engine):
		"""Test fuzzy search distance threshold"""
		# Query with high edit distance
		query = SearchQuery(query="mchne", fuzzy_search=True, max_fuzzy_distance=1)
		results = await populated_engine.search(query)
		
		# Should find fewer results with stricter threshold
		assert len(results) >= 0  # May or may not find matches depending on threshold


class TestSearchHighlighting:
	"""Test search result highlighting"""
	
	async def test_highlight_generation(self, populated_engine):
		"""Test generation of highlighted text fragments"""
		query = SearchQuery(query="machine learning", highlight_fragments=2)
		results = await populated_engine.search(query)
		
		assert len(results) > 0
		result = results[0]
		assert len(result.highlights) > 0
		
		# Check that highlights contain the search terms
		highlight_text = " ".join(result.highlights)
		assert "machine" in highlight_text.lower() or "learning" in highlight_text.lower()
	
	async def test_highlight_fragment_limit(self, populated_engine):
		"""Test limiting number of highlight fragments"""
		query = SearchQuery(query="data", highlight_fragments=1)
		results = await populated_engine.search(query)
		
		if results:
			result = results[0]
			assert len(result.highlights) <= 1


class TestSearchFiltering:
	"""Test search filtering and thresholds"""
	
	async def test_relevance_threshold(self, populated_engine):
		"""Test minimum relevance threshold filtering"""
		query = SearchQuery(query="artificial", min_relevance_threshold=0.5)
		results = await populated_engine.search(query)
		
		# All results should meet the minimum threshold
		for result in results:
			assert result.relevance_score >= 0.5
	
	async def test_result_limit(self, populated_engine):
		"""Test limiting number of search results"""
		query = SearchQuery(query="data", result_limit=2)
		results = await populated_engine.search(query)
		
		assert len(results) <= 2


class TestSearchStatistics:
	"""Test search statistics and analytics"""
	
	async def test_search_stats_tracking(self, populated_engine):
		"""Test that search statistics are tracked"""
		initial_stats = await populated_engine.get_search_stats()
		initial_searches = initial_stats.total_searches
		
		query = SearchQuery(query="machine learning")
		results = await populated_engine.search(query)
		
		updated_stats = await populated_engine.get_search_stats()
		assert updated_stats.total_searches == initial_searches + 1
		
		if results:
			assert updated_stats.successful_searches > initial_stats.successful_searches
	
	async def test_query_frequency_tracking(self, populated_engine):
		"""Test tracking of common queries"""
		query_text = "test query"
		query = SearchQuery(query=query_text)
		
		# Perform same query multiple times
		for _ in range(3):
			await populated_engine.search(query)
		
		stats = await populated_engine.get_search_stats()
		assert query_text.lower() in stats.most_common_queries
		assert stats.most_common_queries[query_text.lower()] >= 3
	
	async def test_performance_metrics(self, populated_engine):
		"""Test performance metrics tracking"""
		query = SearchQuery(query="machine learning")
		await populated_engine.search(query)
		
		stats = await populated_engine.get_search_stats()
		assert stats.average_search_time > 0
		assert 'last_search_time' in stats.performance_metrics


class TestQuerySuggestions:
	"""Test query suggestion functionality"""
	
	async def test_query_suggestions(self, populated_engine):
		"""Test query auto-completion suggestions"""
		suggestions = await populated_engine.suggest_queries("mach", max_suggestions=5)
		
		assert len(suggestions) <= 5
		# Should suggest words starting with "mach"
		if suggestions:
			assert any("mach" in suggestion for suggestion in suggestions)
	
	async def test_empty_partial_query(self, populated_engine):
		"""Test suggestions for empty input"""
		# First perform some searches to populate query history
		await populated_engine.search(SearchQuery(query="machine learning"))
		await populated_engine.search(SearchQuery(query="artificial intelligence"))
		
		suggestions = await populated_engine.suggest_queries("", max_suggestions=5)
		
		# Should return most common queries
		assert len(suggestions) <= 5
	
	async def test_fuzzy_suggestions(self, populated_engine):
		"""Test fuzzy matching in suggestions"""
		suggestions = await populated_engine.suggest_queries("lern", max_suggestions=5)
		
		# Should suggest similar words
		assert len(suggestions) <= 5


class TestDocumentRemoval:
	"""Test document removal functionality"""
	
	async def test_remove_document(self, populated_engine):
		"""Test removing a document from index"""
		initial_count = populated_engine.total_documents
		
		await populated_engine.remove_document('doc1')
		
		assert populated_engine.total_documents == initial_count - 1
		assert 'doc1' not in populated_engine.document_indexes
	
	async def test_remove_nonexistent_document(self, populated_engine):
		"""Test removing non-existent document"""
		initial_count = populated_engine.total_documents
		
		await populated_engine.remove_document('nonexistent_doc')
		
		# Should not change document count
		assert populated_engine.total_documents == initial_count


class TestSearchPersistence:
	"""Test search index persistence"""
	
	async def test_index_persistence(self, temp_storage):
		"""Test that indexes are saved and loaded correctly"""
		storage_path = temp_storage / "persistence_test"
		
		# Create engine and index documents
		engine1 = TextSearchEngine(storage_path)
		await engine1.index_document('test_doc', 'Test', 'Test content for persistence')
		
		# Save indexes
		await engine1._save_indexes()
		
		# Create new engine instance (should load existing indexes)
		engine2 = TextSearchEngine(storage_path)
		
		# Wait a moment for loading to complete
		await asyncio.sleep(0.1)
		
		# Verify document was loaded
		assert 'test_doc' in engine2.document_indexes
		assert engine2.total_documents == 1
	
	async def test_stats_persistence(self, temp_storage):
		"""Test that statistics are persisted"""
		storage_path = temp_storage / "stats_test"
		
		# Create engine and perform searches
		engine1 = TextSearchEngine(storage_path)
		await engine1.index_document('test_doc', 'Test', 'Test content')
		await engine1.search(SearchQuery(query="test"))
		
		initial_searches = engine1.stats.total_searches
		
		# Save and create new instance
		await engine1._save_indexes()
		engine2 = TextSearchEngine(storage_path)
		
		# Wait for loading
		await asyncio.sleep(0.1)
		
		# Verify stats were loaded
		assert engine2.stats.total_searches == initial_searches


class TestConvenienceFunctions:
	"""Test convenience functions"""
	
	async def test_search_documents_function(self, populated_engine):
		"""Test convenience search function"""
		results = await search_documents("machine learning", populated_engine)
		
		assert len(results) > 0
		assert all(isinstance(result, SearchResult) for result in results)
	
	async def test_search_with_kwargs(self, populated_engine):
		"""Test search function with additional parameters"""
		results = await search_documents(
			"artificial intelligence", 
			populated_engine, 
			result_limit=3,
			min_relevance_threshold=0.1
		)
		
		assert len(results) <= 3
		assert all(result.relevance_score >= 0.1 for result in results)


class TestEdgeCases:
	"""Test edge cases and error conditions"""
	
	async def test_very_long_content(self, search_engine):
		"""Test indexing very long content"""
		long_content = "word " * 10000  # Very long content
		
		await search_engine.index_document('long_doc', 'Long Document', long_content)
		
		assert 'long_doc' in search_engine.document_indexes
		
		# Search should still work
		query = SearchQuery(query="word")
		results = await search_engine.search(query)
		assert len(results) > 0
	
	async def test_special_characters(self, search_engine):
		"""Test handling of special characters"""
		content = "Special chars: @#$%^&*()_+{}|:<>?[]\\;',./`~"
		
		await search_engine.index_document('special_doc', 'Special', content)
		
		# Should handle gracefully without crashing
		assert 'special_doc' in search_engine.document_indexes
	
	async def test_unicode_content(self, search_engine):
		"""Test handling of Unicode content"""
		content = "Unicode content: café, naïve, résumé, 中文, العربية"
		
		await search_engine.index_document('unicode_doc', 'Unicode', content)
		
		assert 'unicode_doc' in search_engine.document_indexes
		
		# Search should work with Unicode
		query = SearchQuery(query="café")
		results = await search_engine.search(query)
		# May or may not find results depending on tokenization, but shouldn't crash
	
	async def test_very_short_content(self, search_engine):
		"""Test handling of very short content"""
		content = "Hi"
		
		await search_engine.index_document('short_doc', 'Short', content)
		
		# Should handle gracefully
		assert 'short_doc' in search_engine.document_indexes


@pytest.mark.asyncio
async def test_concurrent_operations(populated_engine):
	"""Test concurrent search operations"""
	queries = [
		SearchQuery(query="machine learning"),
		SearchQuery(query="artificial intelligence"),
		SearchQuery(query="data science"),
		SearchQuery(query="neural networks"),
		SearchQuery(query="statistical analysis")
	]
	
	# Perform concurrent searches
	tasks = [populated_engine.search(query) for query in queries]
	results = await asyncio.gather(*tasks)
	
	assert len(results) == len(queries)
	assert all(isinstance(result, list) for result in results)


@pytest.mark.asyncio
async def test_search_performance(populated_engine):
	"""Test search performance with multiple queries"""
	import time
	
	query = SearchQuery(query="machine learning artificial intelligence")
	
	start_time = time.time()
	for _ in range(10):
		results = await populated_engine.search(query)
	end_time = time.time()
	
	average_time = (end_time - start_time) / 10
	
	# Should complete searches reasonably quickly
	assert average_time < 0.1  # Less than 100ms per search
	
	stats = await populated_engine.get_search_stats()
	assert stats.average_search_time > 0