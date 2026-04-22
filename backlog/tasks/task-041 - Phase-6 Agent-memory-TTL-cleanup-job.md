---
id: task-041
title: "Phase 6: Agent memory TTL cleanup job"
status: To Do
phase: 6
gap_ids: [master-plan-§3.4-tail]
priority: Low
dependencies: [task-017]
---

# task-041 - Phase 6: Agent memory TTL cleanup job

## Description (the why)

Task-017 added agent memory with TTL columns. Without a periodic cleanup, expired rows accumulate. We schedule a nightly cleanup via systemd timer (deploy) and a pytest-covered command.

## Acceptance Criteria (the what)

- [ ] CLI command `uv run docfusion-cleanup-memory` invokes `PersistentMemoryStore.cleanup_expired` and reports the count removed.
- [ ] Systemd timer and service files exist in `deployment/systemd/` for nightly execution.
- [ ] Test `tests/ci/test_cleanup_command.py` verifies the command runs and reports cleanup counts correctly.

## Implementation Plan (the how)

**Step 1: Add CLI entry point.** In `pyproject.toml`:

```toml
[project.scripts]
docfusion-cleanup-memory = "docfusion.cli.cleanup:cleanup_agent_memory"
```

**Step 2: Create the CLI command.**

```python
# src/docfusion/cli/cleanup.py
"""CLI entry point for scheduled cleanups."""

from __future__ import annotations

import asyncio
import sys

from docfusion.agents.memory.persistent_store import PersistentMemoryStore
from docfusion.config.database import get_session_factory


async def _cleanup() -> int:
	store = PersistentMemoryStore(get_session_factory())
	removed = await store.cleanup_expired()
	print(f"Removed {removed} expired agent memory entries")
	return removed


def cleanup_agent_memory() -> None:
	"""Sync wrapper for the CLI entry point."""
	removed = asyncio.run(_cleanup())
	sys.exit(0 if removed >= 0 else 1)
```

Adjust `get_session_factory` import to match the real database module.

**Step 3: Systemd files.**

```ini
# deployment/systemd/docfusion-cleanup-memory.timer
[Unit]
Description=DocuFusion agent memory cleanup (daily)

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=600

[Install]
WantedBy=timers.target
```

```ini
# deployment/systemd/docfusion-cleanup-memory.service
[Unit]
Description=DocuFusion agent memory cleanup
After=network.target postgresql.service

[Service]
Type=oneshot
User=azureuser
WorkingDirectory=/home/azureuser/docfusion
EnvironmentFile=/home/azureuser/docfusion/.env
ExecStart=/home/azureuser/docfusion/.venv/bin/docfusion-cleanup-memory
StandardOutput=journal
StandardError=journal
SyslogIdentifier=docfusion-cleanup-memory
```

**Step 4: Test.**

```python
# tests/ci/test_cleanup_command.py
"""Verify the cleanup command runs end-to-end."""

import asyncio

import pytest

from docfusion.cli.cleanup import _cleanup
from docfusion.agents.memory.persistent_store import PersistentMemoryStore


async def test_cleanup_returns_count(db_session_factory):
	store = PersistentMemoryStore(db_session_factory)
	await store.put("agent-x", "test", {"a": 1}, ttl_seconds=1)
	await asyncio.sleep(1.5)
	removed = await _cleanup()
	assert removed >= 1
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_cleanup_command.py -vxs
uv run docfusion-cleanup-memory
# Should print "Removed N expired agent memory entries" and exit 0.

git add pyproject.toml src/docfusion/cli/ deployment/systemd/ tests/ci/test_cleanup_command.py
git commit -m "feat(ops): nightly agent memory cleanup [master-plan-§3.4]"
```

## Notes for less-capable agents

- Don't run the cleanup from an ad-hoc script. Systemd is the operational pattern used by the rest of the scheduled jobs.
- The CLI command prints a human-readable line; systemd captures it to journal.
