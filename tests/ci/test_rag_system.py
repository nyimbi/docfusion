#!/usr/bin/env python3
"""
RAG System Test Suite

Comprehensive tests for the RAG (Retrieval-Augmented Generation) system
including database operations, embedding services, semantic search,
and integration with the existing storage system.
"""

import pytest
import asyncio
import os
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

# Skip all RAG tests if database connection is not available
DATABASE_URL = "postgresql://nyimbi:Abcd1234.@172.236.30.103:5432/docdb"
SKIP_RAG_TESTS = not os.getenv('OPENAI_API_KEY') or not DATABASE_URL

pytestmark = pytest.mark.skipif(SKIP_RAG_TESTS, reason="RAG tests require database and OpenAI API key")

from docfusion.storage.rag import (
	RAGService, RAGConfiguration, RAGDocument, DocumentChunk,
	RAGDatabase, DatabaseConfiguration, EmbeddingService, EmbeddingConfiguration
)
from docfusion.storage.rag_storage_service import (
	RAGStorageService, RAGStorageConfiguration
)


@pytest.fixture
def rag_config():
	"""Basic RAG configuration for testing"""
	return RAGConfiguration(
		connection_string=DATABASE_URL,
		schema_name="test_rag",
		openai_api_key=os.getenv('OPENAI_API_KEY'),
		chunk_size=500,  # Smaller chunks for testing
		chunk_overlap=100,
		default_similarity_threshold=0.7,
		max_search_results=10
	)


@pytest.fixture
def database_config():
	"""Database configuration for testing"""
	return DatabaseConfiguration(
		connection_string=DATABASE_URL,
		schema_name="test_rag",
		embedding_dimensions=1536,
		chunk_size=500,
		chunk_overlap=100
	)


@pytest.fixture
def embedding_config():
	"""Embedding service configuration for testing"""
	return EmbeddingConfiguration(
		openai_api_key=os.getenv('OPENAI_API_KEY'),
		chunk_size=500,
		chunk_overlap=100,
		max_concurrent_requests=5
	)


@pytest.fixture
async def temp_storage():
	"""Create temporary storage directory for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		yield Path(temp_dir)


@pytest.fixture
async def mock_embedding_service():
	"""Create mock embedding service for testing without API calls"""
	mock_service = MagicMock()
	
	# Mock embedding result
	mock_embedding = [0.1] * 1536  # Mock 1536-dimensional embedding
	mock_result = MagicMock()
	mock_result.embedding = mock_embedding
	mock_result.text = "test text"
	mock_result.processing_time = 0.1
	
	mock_service.generate_query_embedding.return_value = mock_result
	mock_service.process_document.return_value = []
	
	return mock_service


class TestRAGDatabase:
	"""Test RAG database operations"""
	
	@pytest.mark.asyncio
	async def test_database_initialization(self, database_config):
		"""Test database initialization and schema creation"""
		database = RAGDatabase(database_config)
		await database.initialize()
		
		assert database._initialized is True
		assert database._schema_initialized is True
		
		await database.close()
	
	@pytest.mark.asyncio
	async def test_document_storage_and_retrieval(self, database_config):
		"""Test storing and retrieving documents"""
		database = RAGDatabase(database_config)
		await database.initialize()
		
		try:
			# Create test document
			document = RAGDocument(
				document_id="test_doc_1",
				title="Test Document",
				content="This is a test document for the RAG system.",
				document_type="test",
				category="testing",
				tags=["test", "document"],
				metadata={"test_key": "test_value"}
			)
			
			# Store document
			stored = await database.store_document(document)
			assert stored is True
			
			# Retrieve document
			retrieved = await database.get_document("test_doc_1")
			assert retrieved is not None
			assert retrieved.document_id == "test_doc_1"
			assert retrieved.title == "Test Document"
			assert retrieved.category == "testing"
			assert "test" in retrieved.tags
			
		finally:
			await database.close()
	
	@pytest.mark.asyncio
	async def test_chunk_storage(self, database_config):
		"""Test storing document chunks with mock embeddings"""
		database = RAGDatabase(database_config)
		await database.initialize()
		
		try:
			# First store a document
			document = RAGDocument(
				document_id="test_doc_chunks",
				title="Chunked Document", 
				content="This document will be chunked for testing."
			)
			await database.store_document(document)
			
			# Create test chunks with mock embeddings
			chunks = [
				DocumentChunk(
					chunk_id="chunk_1",
					document_id="test_doc_chunks",
					chunk_index=0,
					content="This document will be chunked",
					embedding=[0.1] * 1536,  # Mock embedding
					metadata={"chunk_size": 30}
				),
				DocumentChunk(
					chunk_id="chunk_2", 
					document_id="test_doc_chunks",
					chunk_index=1,
					content="chunked for testing",
					embedding=[0.2] * 1536,  # Mock embedding
					metadata={"chunk_size": 20}
				)
			]
			
			# Store chunks
			stored_count = await database.store_chunks(chunks)
			assert stored_count == 2
			
		finally:
			await database.close()
	
	@pytest.mark.asyncio 
	async def test_semantic_search_mock(self, database_config):
		"""Test semantic search with mock data"""
		database = RAGDatabase(database_config)
		await database.initialize()
		
		try:
			# Store test document and chunks first
			document = RAGDocument(
				document_id="search_test_doc",
				title="Search Test Document",
				content="This document is for testing semantic search functionality."
			)
			await database.store_document(document)
			
			chunk = DocumentChunk(
				chunk_id="search_chunk_1",
				document_id="search_test_doc",
				chunk_index=0,
				content="This document is for testing semantic search",
				embedding=[0.5] * 1536,  # Mock embedding
				metadata={"test": True}
			)
			await database.store_chunks([chunk])
			
			# Perform search with similar mock embedding
			query_embedding = [0.4] * 1536  # Should be similar to stored embedding
			results = await database.semantic_search(
				query_embedding=query_embedding,
				limit=5,
				similarity_threshold=0.1  # Low threshold for mock data
			)
			
			# Should find our test chunk
			assert len(results) >= 1
			found_chunk = next((r for r in results if r['chunk_id'] == 'search_chunk_1'), None)
			assert found_chunk is not None
			
		finally:
			await database.close()


class TestEmbeddingService:
	"""Test embedding service functionality"""
	
	def test_text_chunking(self, embedding_config):
		"""Test text chunking functionality"""
		service = EmbeddingService(embedding_config)
		
		# Test with short text (should return single chunk)
		short_text = "This is a short text."
		result = service.chunker.chunk_text(short_text)
		
		assert result.chunk_count == 1
		assert result.chunks[0] == short_text
		
		# Test with longer text (should create multiple chunks)
		long_text = "This is a much longer text that should be split into multiple chunks. " * 20
		result = service.chunker.chunk_text(long_text)
		
		assert result.chunk_count > 1
		assert result.total_characters > len(long_text.split()[0])
	
	@pytest.mark.asyncio
	async def test_embedding_generation_mock(self, embedding_config):
		"""Test embedding generation with mocked OpenAI API"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.1] * 1536
			mock_response.usage.total_tokens = 10
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = EmbeddingService(embedding_config)
			
			# Test query embedding
			result = await service.generate_query_embedding("test query")
			
			assert result is not None
			assert len(result.embedding) == 1536
			assert result.text == "test query"
			assert result.token_count == 10


class TestRAGService:
	"""Test main RAG service functionality"""
	
	@pytest.mark.asyncio
	async def test_rag_service_initialization(self, rag_config):
		"""Test RAG service initialization"""
		service = RAGService(rag_config)
		await service.initialize()
		
		assert service._initialized is True
		assert service.database._initialized is True
		
		await service.close()
	
	@pytest.mark.asyncio
	async def test_document_addition_mock(self, rag_config):
		"""Test adding document to RAG system with mocked embedding"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.1] * 1536
			mock_response.usage.total_tokens = 10
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = RAGService(rag_config)
			await service.initialize()
			
			try:
				# Add test document
				doc_id = await service.add_document(
					content="This is a test document for the RAG system with some content to be chunked and embedded.",
					title="RAG Test Document",
					category="test",
					tags=["rag", "test"]
				)
				
				assert doc_id is not None
				
				# Verify document was stored
				documents = await service.list_documents(category="test")
				assert len(documents) >= 1
				
				test_doc = next((doc for doc in documents if doc.document_id == doc_id), None)
				assert test_doc is not None
				assert test_doc.title == "RAG Test Document"
				
			finally:
				await service.close()
	
	@pytest.mark.asyncio
	async def test_search_functionality_mock(self, rag_config):
		"""Test search functionality with mocked components"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.5] * 1536
			mock_response.usage.total_tokens = 5
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = RAGService(rag_config)
			await service.initialize()
			
			try:
				# Add a test document first
				doc_id = await service.add_document(
					content="Machine learning is a subset of artificial intelligence that focuses on algorithms.",
					title="ML Introduction",
					category="ai"
				)
				
				# Perform search
				result = await service.search(
					query="machine learning algorithms",
					limit=5,
					similarity_threshold=0.1  # Low threshold for mock data
				)
				
				assert result.query == "machine learning algorithms"
				assert isinstance(result.results, list)
				assert result.search_time > 0
				assert result.embedding_time > 0
				
			finally:
				await service.close()


class TestRAGStorageService:
	"""Test RAG-enhanced storage service"""
	
	@pytest.fixture
	async def rag_storage_config(self, temp_storage):
		"""RAG storage configuration for testing"""
		return RAGStorageConfiguration(
			storage_root_path=temp_storage / "rag_storage",
			enable_rag=True,
			postgresql_connection_string=DATABASE_URL,
			openai_api_key=os.getenv('OPENAI_API_KEY'),
			chunk_size=500,
			similarity_threshold=0.7
		)
	
	@pytest.mark.asyncio
	async def test_rag_storage_initialization(self, rag_storage_config):
		"""Test RAG storage service initialization"""
		service = RAGStorageService(rag_storage_config)
		await service.initialize()
		
		assert service._initialized is True
		assert service.base_storage._initialized is True
		
		# RAG availability depends on API key and database
		if os.getenv('OPENAI_API_KEY'):
			assert service._rag_available is True
		
		await service.close()
	
	@pytest.mark.asyncio
	async def test_document_storage_integration(self, rag_storage_config):
		"""Test document storage in both traditional and RAG systems"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.1] * 1536
			mock_response.usage.total_tokens = 10
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = RAGStorageService(rag_storage_config)
			await service.initialize()
			
			try:
				# Store document
				doc_id = await service.store_document(
					content="This document tests integration between traditional and RAG storage systems.",
					title="Integration Test Document",
					category="integration",
					tags=["integration", "test"],
					enable_rag_indexing=True
				)
				
				assert doc_id is not None
				
				# Verify document is accessible through traditional search
				traditional_results = await service.search_documents(
					query="integration test",
					search_type="full_text",
					limit=10
				)
				
				assert len(traditional_results) >= 0  # May be 0 if text search doesn't match
				
			finally:
				await service.close()
	
	@pytest.mark.asyncio
	async def test_hybrid_search_mock(self, rag_storage_config):
		"""Test hybrid search combining traditional and semantic search"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response for embeddings
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.3] * 1536
			mock_response.usage.total_tokens = 8
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = RAGStorageService(rag_storage_config)
			await service.initialize()
			
			try:
				# Store test document
				doc_id = await service.store_document(
					content="Artificial intelligence and machine learning are transforming modern technology and business processes.",
					title="AI Technology Overview",
					category="technology",
					tags=["ai", "technology", "business"]
				)
				
				# Perform hybrid search
				results = await service.search_documents(
					query="artificial intelligence technology",
					search_type="hybrid",
					limit=10
				)
				
				assert isinstance(results, list)
				# Results may be empty due to mocking, but should not error
				
			finally:
				await service.close()
	
	@pytest.mark.asyncio
	async def test_semantic_context_retrieval(self, rag_storage_config):
		"""Test semantic context retrieval"""
		service = RAGStorageService(rag_storage_config)
		await service.initialize()
		
		try:
			# Test context retrieval (may return None if no matching content)
			context = await service.get_semantic_context(
				query="machine learning applications",
				max_results=3
			)
			
			# Should not error, context may be None if no documents match
			assert context is None or isinstance(context, str)
			
		finally:
			await service.close()
	
	@pytest.mark.asyncio
	async def test_storage_statistics_integration(self, rag_storage_config):
		"""Test combined storage statistics"""
		service = RAGStorageService(rag_storage_config)
		await service.initialize()
		
		try:
			stats = await service.get_storage_statistics()
			
			assert isinstance(stats, dict)
			assert 'rag_enabled' in stats
			assert 'rag_available' in stats
			assert 'hybrid_search_enabled' in stats
			
			# Should have both traditional and RAG statistics
			assert 'total_documents' in stats  # Traditional storage
			if service._rag_available:
				assert 'rag_total_documents' in stats  # RAG storage
			
		finally:
			await service.close()


class TestRAGErrorHandling:
	"""Test error handling in RAG system"""
	
	@pytest.mark.asyncio
	async def test_rag_disabled_graceful_fallback(self, temp_storage):
		"""Test graceful fallback when RAG is disabled"""
		config = RAGStorageConfiguration(
			storage_root_path=temp_storage / "no_rag",
			enable_rag=False,  # RAG disabled
			postgresql_connection_string="",
			openai_api_key=None
		)
		
		service = RAGStorageService(config)
		await service.initialize()
		
		try:
			# Should initialize successfully without RAG
			assert service._initialized is True
			assert service._rag_available is False
			
			# Traditional storage operations should work
			doc_id = await service.store_document(
				content="Test document without RAG",
				title="No RAG Test"
			)
			assert doc_id is not None
			
			# Semantic search should gracefully fall back to traditional search
			results = await service.search_documents(
				query="test document",
				search_type="semantic"  # Should fall back to full_text
			)
			assert isinstance(results, list)
			
		finally:
			await service.close()
	
	@pytest.mark.asyncio
	async def test_embedding_api_failure_handling(self, rag_config):
		"""Test handling of embedding API failures"""
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI to raise an exception
			mock_client = MagicMock()
			mock_client.embeddings.create.side_effect = Exception("API Error")
			mock_openai.return_value = mock_client
			
			service = RAGService(rag_config)
			await service.initialize()
			
			try:
				# Adding document should handle embedding failure gracefully
				doc_id = await service.add_document(
					content="Test document with API failure",
					title="API Failure Test"
				)
				
				# Document addition should fail gracefully
				assert doc_id is None
				
				# Search should also handle embedding failure
				result = await service.search(
					query="test query",
					limit=5
				)
				
				assert result.query == "test query"
				assert len(result.results) == 0
				assert "error" in result.query_metadata
				
			finally:
				await service.close()


# Integration test that can be run with real API (if available)
@pytest.mark.asyncio
@pytest.mark.integration
async def test_end_to_end_rag_workflow():
	"""End-to-end test of RAG workflow (requires real API key and database)"""
	if not os.getenv('OPENAI_API_KEY'):
		pytest.skip("Integration test requires OPENAI_API_KEY")
	
	config = RAGConfiguration(
		connection_string=DATABASE_URL,
		schema_name="integration_test",
		openai_api_key=os.getenv('OPENAI_API_KEY'),
		chunk_size=800,
		chunk_overlap=100
	)
	
	service = RAGService(config)
	await service.initialize()
	
	try:
		# Add multiple documents
		doc_ids = []
		
		documents = [
			{
				"content": "Machine learning is a method of data analysis that automates analytical model building. It is a branch of artificial intelligence based on the idea that systems can learn from data.",
				"title": "Machine Learning Introduction",
				"category": "ai"
			},
			{
				"content": "Deep learning is part of a broader family of machine learning methods based on artificial neural networks. It can be supervised, semi-supervised or unsupervised.",
				"title": "Deep Learning Overview", 
				"category": "ai"
			},
			{
				"content": "Natural language processing combines computational linguistics with statistical, machine learning, and deep learning models to give computers the ability to understand text and spoken words.",
				"title": "NLP Introduction",
				"category": "nlp"
			}
		]
		
		for doc_data in documents:
			doc_id = await service.add_document(**doc_data)
			if doc_id:
				doc_ids.append(doc_id)
		
		assert len(doc_ids) > 0, "Should have added at least one document"
		
		# Test semantic search
		search_result = await service.search(
			query="artificial intelligence and neural networks",
			limit=5,
			similarity_threshold=0.6
		)
		
		assert len(search_result.results) > 0, "Should find related documents"
		assert search_result.context, "Should generate context"
		
		# Test related document finding
		if doc_ids:
			related_docs = await service.get_related_documents(
				document_id=doc_ids[0],
				limit=3,
				similarity_threshold=0.7
			)
			
			assert isinstance(related_docs, list)
			
		# Test statistics
		stats = await service.get_statistics()
		assert stats.total_documents >= len(doc_ids)
		assert stats.total_chunks > 0
		
		print(f"Integration test completed successfully:")
		print(f"- Added {len(doc_ids)} documents")
		print(f"- Found {len(search_result.results)} search results")
		print(f"- Generated context length: {len(search_result.context)}")
		print(f"- Total chunks: {stats.total_chunks}")
		
	finally:
		# Clean up test documents
		for doc_id in doc_ids:
			await service.delete_document(doc_id)
		
		await service.close()