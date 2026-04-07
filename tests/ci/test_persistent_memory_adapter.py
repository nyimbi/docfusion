"""
Tests for Agent Memory Persistent Storage

Unit tests for the PostgreSQL schema and persistent memory adapter
for agent memory persistence.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

# Import directly from files to avoid cascading import errors
import importlib.util
import sys
import os

# Get the src directory path
_src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


def _import_module_from_file(name: str, file_path: str, deps: dict | None = None):
	"""Import a module directly from a file path with optional dependencies."""
	spec = importlib.util.spec_from_file_location(name, file_path)
	module = importlib.util.module_from_spec(spec)
	sys.modules[name] = module
	# Set dependencies before executing
	if deps:
		for dep_name, dep_module in deps.items():
			sys.modules[dep_name] = dep_module
	spec.loader.exec_module(module)
	return module


# First import schema module (no dependencies)
_schema_path = os.path.join(_src_path, 'docfusion', 'agents', 'memory', 'schema.py')
schema = _import_module_from_file('docfusion.agents.memory.schema', _schema_path)

AGENT_MEMORY_SCHEMA = schema.AGENT_MEMORY_SCHEMA
SCHEMA_VERSION = schema.SCHEMA_VERSION
DEFAULT_EMBEDDING_DIMENSIONS = schema.DEFAULT_EMBEDDING_DIMENSIONS
get_schema_sql = schema.get_schema_sql
get_migration_statements = schema.get_migration_statements


# Import memory_manager module (no dependencies)
_memory_manager_path = os.path.join(_src_path, 'docfusion', 'agents', 'memory', 'memory_manager.py')
memory_manager = _import_module_from_file('docfusion.agents.memory.memory_manager', _memory_manager_path)

MemoryEntry = memory_manager.MemoryEntry
MemoryType = memory_manager.MemoryType
MemoryScope = memory_manager.MemoryScope
MemoryPriority = memory_manager.MemoryPriority
MemoryConfig = memory_manager.MemoryConfig
MemoryIndex = memory_manager.MemoryIndex


# Import persistent_adapter module (depends on schema and memory_manager)
_persistent_adapter_path = os.path.join(_src_path, 'docfusion', 'agents', 'memory', 'persistent_adapter.py')
persistent_adapter = _import_module_from_file(
	'docfusion.agents.memory.persistent_adapter',
	_persistent_adapter_path,
	deps={
		'docfusion.agents.memory.schema': schema,
		'docfusion.agents.memory.memory_manager': memory_manager,
	}
)

PersistentMemoryAdapter = persistent_adapter.PersistentMemoryAdapter
PersistentMemoryConfig = persistent_adapter.PersistentMemoryConfig
EmbeddingClient = persistent_adapter.EmbeddingClient
MemoryCacheEntry = persistent_adapter.MemoryCacheEntry


class TestMemorySchema:
	"""Tests for memory schema module."""

	def test_schema_version_defined(self):
		"""Test that schema version is properly defined."""
		assert SCHEMA_VERSION == "1.0.0"

	def test_default_embedding_dimensions(self):
		"""Test that default embedding dimensions are set correctly."""
		assert DEFAULT_EMBEDDING_DIMENSIONS == 1536  # OpenAI ada-002

	def test_schema_contains_required_tables(self):
		"""Test that schema contains all required tables."""
		assert "agent_memories" in AGENT_MEMORY_SCHEMA
		assert "memory_relationships" in AGENT_MEMORY_SCHEMA
		assert "memory_stats" in AGENT_MEMORY_SCHEMA

	def test_schema_contains_pgvector_extension(self):
		"""Test that schema enables pgvector extension."""
		assert "CREATE EXTENSION IF NOT EXISTS vector" in AGENT_MEMORY_SCHEMA

	def test_schema_contains_indexes(self):
		"""Test that schema creates necessary indexes."""
		assert "idx_agent_memories_agent_id" in AGENT_MEMORY_SCHEMA
		assert "idx_agent_memories_embedding" in AGENT_MEMORY_SCHEMA
		assert "idx_memory_relationships_parent" in AGENT_MEMORY_SCHEMA

	def test_schema_contains_constraints(self):
		"""Test that schema defines proper constraints."""
		assert "valid_memory_type" in AGENT_MEMORY_SCHEMA
		assert "valid_scope" in AGENT_MEMORY_SCHEMA
		assert "valid_priority" in AGENT_MEMORY_SCHEMA

	def test_schema_contains_functions(self):
		"""Test that schema defines utility functions."""
		assert "find_similar_memories" in AGENT_MEMORY_SCHEMA
		assert "get_agent_memory_stats" in AGENT_MEMORY_SCHEMA
		assert "cleanup_expired_memories" in AGENT_MEMORY_SCHEMA
		assert "prune_low_priority_memories" in AGENT_MEMORY_SCHEMA

	def test_get_schema_sql_default(self):
		"""Test schema generation with default dimensions."""
		sql = get_schema_sql()
		assert "vector(1536)" in sql
		assert "CREATE TABLE IF NOT EXISTS agent_memories" in sql

	def test_get_schema_sql_custom_dimensions(self):
		"""Test schema generation with custom embedding dimensions."""
		sql = get_schema_sql(embedding_dimensions=768)
		assert "vector(768)" in sql

	def test_get_schema_sql_with_optimizations(self):
		"""Test schema generation with optimization indexes."""
		sql = get_schema_sql(include_optimizations=True)
		assert "idx_agent_memories_active" in sql
		assert "idx_agent_memories_list_cover" in sql

	def test_get_migration_statements_fresh_install(self):
		"""Test migration statements for fresh installation."""
		statements = get_migration_statements(None, "1.0.0")
		assert len(statements) == 1
		assert "CREATE TABLE" in statements[0]

	def test_get_migration_statements_same_version(self):
		"""Test migration statements for same version."""
		statements = get_migration_statements("1.0.0", "1.0.0")
		assert len(statements) == 0

	def test_get_migration_statements_unsupported_version(self):
		"""Test migration statements for unsupported version."""
		with pytest.raises(ValueError):
			get_migration_statements("0.9.0", "1.0.0")


class TestPersistentMemoryConfig:
	"""Tests for PersistentMemoryConfig."""

	def test_default_config_values(self):
		"""Test default configuration values."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		assert config.schema_name == "agent_memory"
		assert config.pool_size == 10
		assert config.max_pool_size == 20
		assert config.embedding_dimensions == 1536
		assert config.enable_embeddings is True
		assert config.enable_persistence is True
		assert config.max_memories_per_agent == 10000
		assert config.cache_size == 1000

	def test_config_custom_values(self):
		"""Test configuration with custom values."""
		config = PersistentMemoryConfig(
			database_url="postgresql://localhost/test",
			schema_name="custom_memory",
			pool_size=20,
			embedding_dimensions=768,
			enable_embeddings=False,
		)
		assert config.schema_name == "custom_memory"
		assert config.pool_size == 20
		assert config.embedding_dimensions == 768
		assert config.enable_embeddings is False

	def test_asyncpg_url_conversion(self):
		"""Test asyncpg URL conversion."""
		# Test SQLAlchemy URL conversion
		config = PersistentMemoryConfig(
			database_url="postgresql+asyncpg://user:pass@localhost/db"
		)
		assert config.asyncpg_url == "postgresql://user:pass@localhost/db"

		# Test psycopg2 URL conversion
		config2 = PersistentMemoryConfig(
			database_url="postgresql+psycopg2://user:pass@localhost/db"
		)
		assert config2.asyncpg_url == "postgresql://user:pass@localhost/db"

	def test_config_validation(self):
		"""Test configuration validation."""
		from pydantic import ValidationError

		# Test valid dimensions
		config = PersistentMemoryConfig(
			database_url="postgresql://localhost/test",
			embedding_dimensions=1024
		)
		assert config.embedding_dimensions == 1024

		# Test invalid dimensions (too small)
		with pytest.raises(ValidationError):
			PersistentMemoryConfig(
				database_url="postgresql://localhost/test",
				embedding_dimensions=64
			)

		# Test invalid dimensions (too large)
		with pytest.raises(ValidationError):
			PersistentMemoryConfig(
				database_url="postgresql://localhost/test",
				embedding_dimensions=8192
			)


class TestEmbeddingClient:
	"""Tests for EmbeddingClient."""

	@pytest.mark.asyncio
	async def test_generate_embedding_no_service(self):
		"""Test embedding generation without service configured."""
		client = EmbeddingClient(embedding_service=None)
		result = await client.generate_embedding("test text")
		assert result is None

	@pytest.mark.asyncio
	async def test_generate_embeddings_batch_no_service(self):
		"""Test batch embedding generation without service."""
		client = EmbeddingClient(embedding_service=None)
		results = await client.generate_embeddings_batch(["text1", "text2"])
		assert results == [None, None]

	@pytest.mark.asyncio
	async def test_generate_embedding_with_service(self):
		"""Test embedding generation with mock service."""
		# Create mock embedding service
		mock_service = MagicMock()
		mock_result = MagicMock()
		mock_result.embedding = [0.1, 0.2, 0.3]
		mock_service.generate_query_embedding = AsyncMock(return_value=mock_result)

		client = EmbeddingClient(embedding_service=mock_service)
		result = await client.generate_embedding("test text")
		assert result == [0.1, 0.2, 0.3]
		mock_service.generate_query_embedding.assert_called_once_with("test text")


class TestMemoryCacheEntry:
	"""Tests for MemoryCacheEntry."""

	def test_cache_entry_creation(self):
		"""Test creating a cache entry."""
		entry = MemoryEntry(content="test")
		cache_entry = MemoryCacheEntry(entry=entry)
		assert cache_entry.entry == entry
		assert cache_entry.access_count == 0

	def test_cache_entry_expiration(self):
		"""Test cache entry expiration check."""
		entry = MemoryEntry(content="test")
		cache_entry = MemoryCacheEntry(entry=entry)

		# Should not be expired immediately
		assert not cache_entry.is_expired(ttl_minutes=60)


class TestPersistentMemoryAdapterInit:
	"""Tests for PersistentMemoryAdapter initialization."""

	def test_adapter_creation(self):
		"""Test creating adapter instance."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(
			agent_id="test-agent",
			config=config,
		)
		assert adapter.agent_id == "test-agent"
		assert adapter.config == config
		assert adapter.pool is None
		assert adapter._initialized is False

	def test_adapter_with_embedding_service(self):
		"""Test creating adapter with embedding service."""
		mock_service = MagicMock()
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(
			agent_id="test-agent",
			config=config,
			embedding_service=mock_service,
		)
		assert adapter.embedding_client.embedding_service == mock_service


class TestContentHashing:
	"""Tests for content hashing."""

	def test_generate_content_hash_string(self):
		"""Test hash generation for string content."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		hash1 = adapter._generate_content_hash("test content")
		hash2 = adapter._generate_content_hash("test content")
		hash3 = adapter._generate_content_hash("different content")

		assert hash1 == hash2  # Same content = same hash
		assert hash1 != hash3  # Different content = different hash

	def test_generate_content_hash_dict(self):
		"""Test hash generation for dict content."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		hash1 = adapter._generate_content_hash({"key": "value"})
		assert len(hash1) == 32  # MD5 hash length

	def test_generate_content_hash_list(self):
		"""Test hash generation for list content."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		hash1 = adapter._generate_content_hash([1, 2, 3])
		assert len(hash1) == 32  # MD5 hash length


class TestInMemorySearch:
	"""Tests for in-memory search functionality."""

	def test_in_memory_search_by_type(self):
		"""Test searching by memory type."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		# Add entries to cache
		entry1 = MemoryEntry(
			content="short term memory",
			memory_type=MemoryType.SHORT_TERM,
		)
		entry1.entry_id = "entry1"
		adapter._add_to_cache(entry1)

		entry2 = MemoryEntry(
			content="long term memory",
			memory_type=MemoryType.LONG_TERM,
		)
		entry2.entry_id = "entry2"
		adapter._add_to_cache(entry2)

		# Search for short_term
		results = adapter._in_memory_search(
			query=None,
			tags=None,
			memory_type=MemoryType.SHORT_TERM,
			scope=None,
			date_range=None,
			limit=10,
		)
		assert len(results) == 1
		assert results[0].content == "short term memory"

	def test_in_memory_search_by_scope(self):
		"""Test searching by scope."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		# Add entries to cache
		entry1 = MemoryEntry(
			content="private memory",
			scope=MemoryScope.PRIVATE,
		)
		entry1.entry_id = "entry1"
		adapter._add_to_cache(entry1)

		entry2 = MemoryEntry(
			content="global memory",
			scope=MemoryScope.GLOBAL,
		)
		entry2.entry_id = "entry2"
		adapter._add_to_cache(entry2)

		# Search for global scope
		results = adapter._in_memory_search(
			query=None,
			tags=None,
			memory_type=None,
			scope=MemoryScope.GLOBAL,
			date_range=None,
			limit=10,
		)
		assert len(results) == 1
		assert results[0].content == "global memory"

	def test_in_memory_search_by_tags(self):
		"""Test searching by tags."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		# Add entries to cache
		entry1 = MemoryEntry(
			content="tagged memory",
			tags={"important", "work"},
		)
		entry1.entry_id = "entry1"
		adapter._add_to_cache(entry1)

		entry2 = MemoryEntry(
			content="other memory",
			tags={"personal"},
		)
		entry2.entry_id = "entry2"
		adapter._add_to_cache(entry2)

		# Search for "important" tag
		results = adapter._in_memory_search(
			query=None,
			tags={"important"},
			memory_type=None,
			scope=None,
			date_range=None,
			limit=10,
		)
		assert len(results) == 1
		assert "important" in results[0].tags

	def test_in_memory_search_text_query(self):
		"""Test text search in content."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		# Add entries to cache
		entry1 = MemoryEntry(content="This is a test memory about cats")
		entry1.entry_id = "entry1"
		adapter._add_to_cache(entry1)

		entry2 = MemoryEntry(content="This is about dogs")
		entry2.entry_id = "entry2"
		adapter._add_to_cache(entry2)

		# Search for "cats"
		results = adapter._in_memory_search(
			query="cats",
			tags=None,
			memory_type=None,
			scope=None,
			date_range=None,
			limit=10,
		)
		assert len(results) == 1
		assert "cats" in results[0].content


class TestQueryMatching:
	"""Tests for query matching functionality."""

	def test_matches_query_in_content(self):
		"""Test query matching in content."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		entry = MemoryEntry(content="This is a test memory")
		assert adapter._matches_query(entry, "test")
		assert adapter._matches_query(entry, "TEST")  # Case insensitive
		assert not adapter._matches_query(entry, "nonexistent")

	def test_matches_query_in_tags(self):
		"""Test query matching in tags."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		entry = MemoryEntry(
			content="test",
			tags={"important", "work", "project"},
		)
		assert adapter._matches_query(entry, "important")
		assert adapter._matches_query(entry, "WORK")
		assert not adapter._matches_query(entry, "personal")

	def test_matches_query_in_context(self):
		"""Test query matching in context."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		entry = MemoryEntry(
			content="test",
			context={"source": "email", "priority": "high"},
		)
		assert adapter._matches_query(entry, "email")
		assert adapter._matches_query(entry, "HIGH")
		assert not adapter._matches_query(entry, "phone")


class TestStatistics:
	"""Tests for statistics functionality."""

	def test_get_memory_stats(self):
		"""Test getting memory statistics."""
		config = PersistentMemoryConfig(database_url="postgresql://localhost/test")
		adapter = PersistentMemoryAdapter(agent_id="test", config=config)

		# Add some entries
		entry1 = MemoryEntry(
			content="test1",
			memory_type=MemoryType.SHORT_TERM,
			scope=MemoryScope.PRIVATE,
		)
		entry1.entry_id = "entry1"
		adapter._add_to_cache(entry1)

		entry2 = MemoryEntry(
			content="test2",
			memory_type=MemoryType.LONG_TERM,
			scope=MemoryScope.GLOBAL,
		)
		entry2.entry_id = "entry2"
		adapter._add_to_cache(entry2)

		stats = adapter.get_memory_stats()
		assert stats["total_entries"] == 2
		assert stats["entries_by_type"][MemoryType.SHORT_TERM] == 1
		assert stats["entries_by_type"][MemoryType.LONG_TERM] == 1
		assert stats["entries_by_scope"][MemoryScope.PRIVATE] == 1
		assert stats["entries_by_scope"][MemoryScope.GLOBAL] == 1


if __name__ == "__main__":
	pytest.main([__file__, "-v"])