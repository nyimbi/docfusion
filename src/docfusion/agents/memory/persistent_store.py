"""
Persistent Agent Memory Store

Simplified PostgreSQL-backed persistent storage for agent memories.
Provides CRUD operations with TTL support, designed for direct use
by the Agent class.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import asyncpg


logger = logging.getLogger(__name__)


class PersistentMemoryStore:
	"""
	PostgreSQL-backed persistent store for agent memories.

	Provides a simple interface for saving, loading, and managing
	agent memory entries with automatic TTL expiration.
	"""

	def __init__(self, pool: asyncpg.Pool):
		self._pool = pool
		self.logger = logging.getLogger(__name__)

	@classmethod
	async def create(cls, database_url: str) -> "PersistentMemoryStore":
		"""Create a new PersistentMemoryStore with a connection pool."""
		pool = await asyncpg.create_pool(
			database_url,
			min_size=1,
			max_size=10,
		)
		return cls(pool)

	async def close(self) -> None:
		"""Close the connection pool."""
		await self._pool.close()

	async def save(
		self,
		agent_id: str,
		memory_type: str,
		payload: dict[str, Any],
		scope: str = "private",
		priority: str = "medium",
		tags: Optional[list[str]] = None,
		ttl_seconds: Optional[int] = None,
	) -> str:
		"""
		Save a memory entry for an agent.

		Returns:
			The UUID of the inserted memory row.
		"""
		expires_at = None
		if ttl_seconds is not None:
			expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

		async with self._pool.acquire() as conn:
			row = await conn.fetchrow(
				"""
				INSERT INTO agent_memories
				(agent_id, memory_type, payload, scope, priority, tags, expires_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				RETURNING id
				""",
				agent_id,
				memory_type,
				json.dumps(payload),
				scope,
				priority,
				tags or [],
				expires_at,
			)
			memory_id = str(row["id"])
			self.logger.debug(f"Saved memory {memory_id} for agent {agent_id}")
			return memory_id

	async def load(
		self,
		agent_id: str,
		memory_type: Optional[str] = None,
		limit: int = 100,
	) -> list[dict[str, Any]]:
		"""
		Load memory entries for an agent.

		Filters out expired entries automatically.
		"""
		async with self._pool.acquire() as conn:
			if memory_type:
				rows = await conn.fetch(
					"""
					SELECT id, agent_id, memory_type, payload, scope, priority,
					       tags, access_count, created_at, updated_at, expires_at
					FROM agent_memories
					WHERE agent_id = $1
					  AND memory_type = $2
					  AND (expires_at IS NULL OR expires_at > NOW())
					ORDER BY created_at DESC
					LIMIT $3
					""",
					agent_id,
					memory_type,
					limit,
				)
			else:
				rows = await conn.fetch(
					"""
					SELECT id, agent_id, memory_type, payload, scope, priority,
					       tags, access_count, created_at, updated_at, expires_at
					FROM agent_memories
					WHERE agent_id = $1
					  AND (expires_at IS NULL OR expires_at > NOW())
					ORDER BY created_at DESC
					LIMIT $2
					""",
					agent_id,
					limit,
				)

			results = []
			for row in rows:
				payload = row["payload"]
				if isinstance(payload, str):
					payload = json.loads(payload)
				results.append({
					"id": str(row["id"]),
					"agent_id": row["agent_id"],
					"memory_type": row["memory_type"],
					"payload": payload,
					"scope": row["scope"],
					"priority": row["priority"],
					"tags": row["tags"] or [],
					"access_count": row["access_count"],
					"created_at": row["created_at"],
					"updated_at": row["updated_at"],
					"expires_at": row["expires_at"],
				})

			# Update access counts
			if rows:
				memory_ids = [row["id"] for row in rows]
				await conn.executemany(
					"UPDATE agent_memories SET access_count = access_count + 1 WHERE id = $1",
					[(mid,) for mid in memory_ids],
				)

			return results

	async def get(self, memory_id: str) -> Optional[dict[str, Any]]:
		"""Load a single memory entry by ID."""
		async with self._pool.acquire() as conn:
			row = await conn.fetchrow(
				"""
				SELECT id, agent_id, memory_type, payload, scope, priority,
				       tags, access_count, created_at, updated_at, expires_at
				FROM agent_memories
				WHERE id = $1
				  AND (expires_at IS NULL OR expires_at > NOW())
				""",
				memory_id,
			)
			if not row:
				return None

			await conn.execute(
				"UPDATE agent_memories SET access_count = access_count + 1 WHERE id = $1",
				memory_id,
			)

			payload = row["payload"]
			if isinstance(payload, str):
				payload = json.loads(payload)
			return {
				"id": str(row["id"]),
				"agent_id": row["agent_id"],
				"memory_type": row["memory_type"],
				"payload": payload,
				"scope": row["scope"],
				"priority": row["priority"],
				"tags": row["tags"] or [],
				"access_count": row["access_count"] + 1,
				"created_at": row["created_at"],
				"updated_at": row["updated_at"],
				"expires_at": row["expires_at"],
			}

	async def delete(self, memory_id: str) -> bool:
		"""Delete a memory entry by ID."""
		async with self._pool.acquire() as conn:
			result = await conn.execute(
				"DELETE FROM agent_memories WHERE id = $1",
				memory_id,
			)
			deleted = int(result.split()[-1]) > 0
			if deleted:
				self.logger.debug(f"Deleted memory {memory_id}")
			return deleted

	async def flush(self, agent_id: str, memory_type: Optional[str] = None) -> int:
		"""
		Delete all memory entries for an agent.

		If memory_type is specified, only delete entries of that type.
		Returns the number of rows deleted.
		"""
		async with self._pool.acquire() as conn:
			if memory_type:
				result = await conn.execute(
					"DELETE FROM agent_memories WHERE agent_id = $1 AND memory_type = $2",
					agent_id,
					memory_type,
				)
			else:
				result = await conn.execute(
					"DELETE FROM agent_memories WHERE agent_id = $1",
					agent_id,
				)
			count = int(result.split()[-1])
			self.logger.info(f"Flushed {count} memories for agent {agent_id}")
			return count

	async def cleanup_expired(self) -> int:
		"""Remove all expired memory entries. Returns count deleted."""
		async with self._pool.acquire() as conn:
			result = await conn.execute(
				"DELETE FROM agent_memories WHERE expires_at IS NOT NULL AND expires_at <= NOW()"
			)
			count = int(result.split()[-1])
			if count > 0:
				self.logger.info(f"Cleaned up {count} expired memories")
			return count

	async def count(
		self,
		agent_id: str,
		memory_type: Optional[str] = None,
	) -> int:
		"""Count memory entries for an agent."""
		async with self._pool.acquire() as conn:
			if memory_type:
				row = await conn.fetchrow(
					"""
					SELECT COUNT(*) FROM agent_memories
					WHERE agent_id = $1 AND memory_type = $2
					  AND (expires_at IS NULL OR expires_at > NOW())
					""",
					agent_id,
					memory_type,
				)
			else:
				row = await conn.fetchrow(
					"""
					SELECT COUNT(*) FROM agent_memories
					WHERE agent_id = $1
					  AND (expires_at IS NULL OR expires_at > NOW())
					""",
					agent_id,
				)
			return row["count"] if row else 0
