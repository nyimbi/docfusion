#!/usr/bin/env python3
"""Tests for PersistentMemoryStore."""

import json
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg

from docfusion.agents.memory.persistent_store import PersistentMemoryStore


def _make_mock_pool():
	"""Create a mock asyncpg pool with fetch/fetchrow/execute support."""
	pool = AsyncMock()
	conn = AsyncMock()

	# Default fetchrow returns a mock row
	mock_row = {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"agent_id": "agent-1",
		"memory_type": "working",
		"payload": {"key": "value"},
		"scope": "private",
		"priority": "medium",
		"tags": ["tag1"],
		"access_count": 0,
		"created_at": datetime.now(timezone.utc),
		"updated_at": datetime.now(timezone.utc),
		"expires_at": None,
	}
	conn.fetchrow.return_value = mock_row
	conn.fetch.return_value = [mock_row]
	conn.execute.return_value = "DELETE 1"

	# Create an async context manager for pool.acquire()
	class _AsyncCtx:
		async def __aenter__(self):
			return conn
		async def __aexit__(self, *args):
			return False

	# pool.acquire must return the context manager directly (not a coroutine)
	# because it's used as: async with pool.acquire() as conn:
	pool.acquire = MagicMock(return_value=_AsyncCtx())

	return pool, conn


class TestPersistentMemoryStore:
	"""Tests for PersistentMemoryStore CRUD operations."""

	@pytest.fixture
	def store(self):
		pool, conn = _make_mock_pool()
		return PersistentMemoryStore(pool), conn

	@pytest.mark.asyncio
	async def test_save_memory(self, store):
		store_instance, conn = store
		mid = await store_instance.save(
			agent_id="agent-1",
			memory_type="working",
			payload={"task": "demo"},
			ttl_seconds=3600,
		)
		assert mid == "550e8400-e29b-41d4-a716-446655440000"
		conn.fetchrow.assert_awaited_once()

	@pytest.mark.asyncio
	async def test_save_without_ttl(self, store):
		store_instance, conn = store
		await store_instance.save(
			agent_id="agent-1",
			memory_type="working",
			payload={"task": "demo"},
		)
		call_args = conn.fetchrow.call_args
		assert call_args[0][7] is None  # expires_at is None

	@pytest.mark.asyncio
	async def test_load_all_memories(self, store):
		store_instance, conn = store
		results = await store_instance.load("agent-1")
		assert len(results) == 1
		assert results[0]["agent_id"] == "agent-1"
		assert results[0]["payload"] == {"key": "value"}
		conn.fetch.assert_awaited_once()

	@pytest.mark.asyncio
	async def test_load_by_memory_type(self, store):
		store_instance, conn = store
		await store_instance.load("agent-1", memory_type="episodic")
		call_args = conn.fetch.call_args
		assert "memory_type = $2" in call_args[0][0]

	@pytest.mark.asyncio
	async def test_get_memory_by_id(self, store):
		store_instance, conn = store
		result = await store_instance.get("550e8400-e29b-41d4-a716-446655440000")
		assert result is not None
		assert result["id"] == "550e8400-e29b-41d4-a716-446655440000"
		# Should increment access count
		conn.execute.assert_awaited()

	@pytest.mark.asyncio
	async def test_get_missing_memory(self, store):
		store_instance, conn = store
		conn.fetchrow.return_value = None
		result = await store_instance.get("missing-id")
		assert result is None

	@pytest.mark.asyncio
	async def test_delete_memory(self, store):
		store_instance, conn = store
		deleted = await store_instance.delete("550e8400-e29b-41d4-a716-446655440000")
		assert deleted is True

	@pytest.mark.asyncio
	async def test_delete_memory_not_found(self, store):
		store_instance, conn = store
		conn.execute.return_value = "DELETE 0"
		deleted = await store_instance.delete("missing-id")
		assert deleted is False

	@pytest.mark.asyncio
	async def test_flush_all_for_agent(self, store):
		store_instance, conn = store
		conn.execute.return_value = "DELETE 5"
		count = await store_instance.flush("agent-1")
		assert count == 5
		assert "agent_id = $1" in conn.execute.call_args[0][0]

	@pytest.mark.asyncio
	async def test_flush_by_memory_type(self, store):
		store_instance, conn = store
		conn.execute.return_value = "DELETE 3"
		count = await store_instance.flush("agent-1", memory_type="working")
		assert count == 3
		assert "memory_type = $2" in conn.execute.call_args[0][0]

	@pytest.mark.asyncio
	async def test_cleanup_expired(self, store):
		store_instance, conn = store
		conn.execute.return_value = "DELETE 10"
		count = await store_instance.cleanup_expired()
		assert count == 10
		assert "expires_at <= NOW()" in conn.execute.call_args[0][0]

	@pytest.mark.asyncio
	async def test_count_memories(self, store):
		store_instance, conn = store
		mock_count = MagicMock()
		mock_count.__getitem__ = lambda self, k: 42 if k == "count" else None
		conn.fetchrow.return_value = mock_count
		count = await store_instance.count("agent-1")
		assert count == 42

	@pytest.mark.asyncio
	async def test_count_by_type(self, store):
		store_instance, conn = store
		mock_count = MagicMock()
		mock_count.__getitem__ = lambda self, k: 7 if k == "count" else None
		conn.fetchrow.return_value = mock_count
		count = await store_instance.count("agent-1", memory_type="working")
		assert count == 7
		assert "memory_type = $2" in conn.fetchrow.call_args[0][0]

	@pytest.mark.asyncio
	async def test_load_increments_access_count(self, store):
		store_instance, conn = store
		await store_instance.load("agent-1")
		# executemany should be called with access_count update
		assert conn.executemany.called

	@pytest.mark.asyncio
	async def test_close_pool(self, store):
		store_instance, conn = store
		await store_instance.close()
		store_instance._pool.close.assert_awaited_once()


class TestPersistentMemoryStoreCreate:
	"""Tests for the factory method."""

	@pytest.mark.asyncio
	async def test_create_factory(self):
		mock_pool = AsyncMock()
		with patch(
			"docfusion.agents.memory.persistent_store.asyncpg.create_pool",
			new_callable=AsyncMock,
			return_value=mock_pool,
		):
			store = await PersistentMemoryStore.create("postgresql://localhost/test")
			assert isinstance(store, PersistentMemoryStore)
			mock_pool.close.assert_not_called()


class TestPayloadSerialization:
	"""Tests for JSON payload handling."""

	@pytest.mark.asyncio
	async def test_payload_string_deserialization(self):
		"""Test that string payloads are deserialized to dict."""
		pool, conn = _make_mock_pool()
		store = PersistentMemoryStore(pool)

		mock_row = {
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"agent_id": "agent-1",
			"memory_type": "working",
			"payload": '{"nested": {"key": "value"}}',
			"scope": "private",
			"priority": "medium",
			"tags": [],
			"access_count": 0,
			"created_at": datetime.now(timezone.utc),
			"updated_at": datetime.now(timezone.utc),
			"expires_at": None,
		}
		conn.fetchrow.return_value = mock_row

		result = await store.get("some-id")
		assert result["payload"] == {"nested": {"key": "value"}}


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
