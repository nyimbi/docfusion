---
id: TASK-017
title: 'Phase 3: Add persistent agent memory store'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 23:04'
labels: []
dependencies:
  - task-014
priority: high
---

# task-017 - Phase 3: Add persistent agent memory store

## Description (the why)

Agent memory today lives in process dicts — lost on restart. For any long-running agent behavior (learning, context retention), we need durable PostgreSQL persistence with TTL for expiry.

## Acceptance Criteria (the what)

- [ ] New `src/docfusion/agents/memory/persistent_store.py` with a `PersistentMemoryStore` class.
- [ ] Alembic migration creates `agent_memory` table with `id`, `agent_id`, `memory_type`, `payload jsonb`, `ttl`, `created_at`.
- [ ] All in-process memory dicts in `src/docfusion/agents/memory/` are replaced or backed by `PersistentMemoryStore`.
- [ ] TTL expiry works: a memory past its TTL is not returned by `get`.
- [ ] Tests `tests/ci/test_agent_memory.py` cover store/retrieve/expire scenarios.

## Implementation Plan (the how)

**Step 1: Survey current memory code.**
```bash
ls src/docfusion/agents/memory/
grep -rn "memory\s*=\s*{}\|self\._memory\s*=" src/docfusion/agents/memory/ --include="*.py" | head -20
```

**Step 2: Alembic migration.**
```bash
uv run alembic revision -m "add agent_memory table"
```

In the generated file:

```python
def upgrade() -> None:
	op.create_table(
		"agent_memory",
		sa.Column("id", sa.String, primary_key=True),
		sa.Column("agent_id", sa.String, nullable=False),
		sa.Column("memory_type", sa.String, nullable=False),
		sa.Column("payload", postgresql.JSONB, nullable=False),
		sa.Column("ttl", sa.DateTime(timezone=True), nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
	)
	op.create_index("ix_agent_memory_agent_id", "agent_memory", ["agent_id"])
	op.create_index("ix_agent_memory_ttl", "agent_memory", ["ttl"])
```

Run: `uv run alembic upgrade head`.

**Step 3: Write `PersistentMemoryStore`.**

```python
# src/docfusion/agents/memory/persistent_store.py
"""PostgreSQL-backed memory store for agents."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from docfusion.core.utils import uuid7str

class PersistentMemoryStore:
	"""Durable agent memory with TTL."""

	def __init__(self, session_factory) -> None:
		self._session_factory = session_factory

	async def put(
		self,
		agent_id: str,
		memory_type: str,
		payload: dict[str, Any],
		ttl_seconds: int | None = None,
	) -> str:
		"""Store a memory entry. Returns its id."""
		assert isinstance(payload, dict), "payload must be a dict"
		entry_id = uuid7str()
		ttl = (
			datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
			if ttl_seconds is not None
			else None
		)
		async with self._session_factory() as session:
			await session.execute(
				text("""
					INSERT INTO agent_memory (id, agent_id, memory_type, payload, ttl)
					VALUES (:id, :agent_id, :memory_type, CAST(:payload AS JSONB), :ttl)
				"""),
				{
					"id": entry_id,
					"agent_id": agent_id,
					"memory_type": memory_type,
					"payload": json.dumps(payload),
					"ttl": ttl,
				},
			)
			await session.commit()
		return entry_id

	async def get(
		self,
		agent_id: str,
		memory_type: str | None = None,
		limit: int = 100,
	) -> list[dict[str, Any]]:
		"""Fetch non-expired memories for an agent."""
		now = datetime.now(timezone.utc)
		query = """
			SELECT id, memory_type, payload, created_at
			FROM agent_memory
			WHERE agent_id = :agent_id
			  AND (ttl IS NULL OR ttl > :now)
		"""
		params: dict[str, Any] = {"agent_id": agent_id, "now": now}
		if memory_type is not None:
			query += " AND memory_type = :memory_type"
			params["memory_type"] = memory_type
		query += " ORDER BY created_at DESC LIMIT :limit"
		params["limit"] = limit

		async with self._session_factory() as session:
			rows = (await session.execute(text(query), params)).mappings().all()
		return [dict(r) for r in rows]

	async def delete(self, entry_id: str) -> None:
		async with self._session_factory() as session:
			await session.execute(
				text("DELETE FROM agent_memory WHERE id = :id"),
				{"id": entry_id},
			)
			await session.commit()

	async def cleanup_expired(self) -> int:
		"""Remove expired entries. Returns number deleted."""
		now = datetime.now(timezone.utc)
		async with self._session_factory() as session:
			result = await session.execute(
				text("DELETE FROM agent_memory WHERE ttl IS NOT NULL AND ttl <= :now"),
				{"now": now},
			)
			await session.commit()
			return result.rowcount or 0
```

**Step 4: Replace in-process dicts.**

For each file in `src/docfusion/agents/memory/` that holds a `{}` or `dict()` as memory:

- Accept a `store: PersistentMemoryStore` parameter (or create a default).
- Replace `self._memory[key] = value` with `await self._store.put(self.agent_id, key, value)`.
- Replace `self._memory.get(key)` with `await self._store.get(self.agent_id, memory_type=key)`.

If migrating all call sites is too large, do the replacement for the primary memory classes only and open follow-up tasks for the rest.

**Step 5: Test.**

```python
# tests/ci/test_agent_memory.py
"""Persistent agent memory coverage."""

import asyncio
import pytest

from docfusion.agents.memory.persistent_store import PersistentMemoryStore

async def test_put_and_get_roundtrips(db_session_factory):
	store = PersistentMemoryStore(db_session_factory)
	await store.put("agent-a", "note", {"content": "remember this"})
	entries = await store.get("agent-a")
	assert len(entries) == 1
	assert entries[0]["payload"]["content"] == "remember this"

async def test_expired_entries_not_returned(db_session_factory):
	store = PersistentMemoryStore(db_session_factory)
	await store.put("agent-b", "short", {"x": 1}, ttl_seconds=1)
	await asyncio.sleep(1.5)
	entries = await store.get("agent-b")
	assert len(entries) == 0

async def test_cleanup_removes_expired(db_session_factory):
	store = PersistentMemoryStore(db_session_factory)
	await store.put("agent-c", "t1", {"y": 2}, ttl_seconds=1)
	await asyncio.sleep(1.5)
	removed = await store.cleanup_expired()
	assert removed >= 1
```

**Step 6: Verify + commit.**
```bash
uv run pytest tests/ci/test_agent_memory.py -vxs
git add migrations/ src/docfusion/agents/memory/ tests/ci/test_agent_memory.py
git commit -m "feat(agents): persistent memory store with TTL [G-MEM-01]"
```

## Notes for less-capable agents

- Do NOT drop or rename existing in-process memory classes. Wrap them. Many callers rely on the old interface.
- If `db_session_factory` fixture doesn't exist, add it to `tests/ci/conftest.py` — it should yield a per-test session that rolls back.
- TTL cleanup should run nightly. That's a separate task (task-041 in Phase 6).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created PersistentMemoryStore with save/load/delete/flush/cleanup operations; created Alembic migration for agent_memories table; exported from agents.memory; 17 tests pass
<!-- SECTION:NOTES:END -->
