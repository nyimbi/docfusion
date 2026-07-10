---
id: task-041
title: 'Phase 6: Nightly agent memory cleanup job'
status: Done
assignee: []
created_date: ''
updated_date: '2026-06-02 08:29'
labels: []
dependencies:
  - task-017
priority: low
---

# task-041 - Phase 6: Nightly agent memory cleanup job

## Description (the why)

The `agent_memory` table from task-017 has a TTL column but no scheduled cleanup. Left alone, expired rows accumulate forever. A nightly job calls `PersistentMemoryStore.cleanup_expired()`.

## Acceptance Criteria (the what)

- [ ] A systemd timer + service (or cron entry) runs `python -m docfusion.agents.memory.cleanup` nightly at 03:00 UTC.
- [ ] The entry point logs the number of rows removed.
- [ ] Test `tests/ci/test_agent_memory_cleanup.py` exercises the entry point end-to-end.
- [ ] Deployment docs include installation instructions.

## Implementation Plan (the how)

**Step 1: Create the entry point.**

```python
# src/docfusion/agents/memory/cleanup.py
"""Nightly cleanup of expired agent memory rows."""

from __future__ import annotations

import asyncio
import logging

from docfusion.agents.memory.persistent_store import PersistentMemoryStore
from docfusion.storage.database import get_session_factory

logger = logging.getLogger(__name__)

async def main() -> int:
	store = PersistentMemoryStore(get_session_factory())
	removed = await store.cleanup_expired()
	logger.info("Agent memory cleanup removed %d expired rows", removed)
	return removed

if __name__ == "__main__":
	import logging as _log
	_log.basicConfig(level=_log.INFO)
	asyncio.run(main())
```

**Step 2: systemd timer + service.**

`deployment/systemd/docfusion-memory-cleanup.timer`:

```ini
[Unit]
Description=DocuFusion agent memory cleanup (nightly)

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

`deployment/systemd/docfusion-memory-cleanup.service`:

```ini
[Unit]
Description=DocuFusion agent memory cleanup
After=network.target postgresql.service

[Service]
Type=oneshot
# Retired Azure server note (2026-06-16): previous Azure app-server user/path settings were removed.
StandardOutput=journal
StandardError=journal
TimeoutSec=600
```

**Step 3: Test.**

```python
# tests/ci/test_agent_memory_cleanup.py
import asyncio

import pytest

from docfusion.agents.memory.cleanup import main as cleanup_main
from docfusion.agents.memory.persistent_store import PersistentMemoryStore

async def test_cleanup_removes_expired(db_session_factory):
	store = PersistentMemoryStore(db_session_factory)
	await store.put("agent-x", "short", {"k": "v"}, ttl_seconds=1)
	await asyncio.sleep(1.5)
	# Call the entry point.
	removed = await cleanup_main()
	assert removed >= 1
```

**Step 4: Documentation.** Add to `deployment/README.md`:

```markdown
## Scheduled jobs

### Agent memory cleanup (nightly)

Install:

    sudo cp deployment/systemd/docfusion-memory-cleanup.* /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now docfusion-memory-cleanup.timer
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_agent_memory_cleanup.py -vxs
git add src/docfusion/agents/memory/cleanup.py deployment/systemd/ deployment/README.md tests/ci/test_agent_memory_cleanup.py
git commit -m "feat(agents): nightly memory cleanup job [master-plan-risks]"
```

## Notes for less-capable agents

- If systemd isn't the scheduling mechanism in your deployment (maybe Kubernetes CronJob), adapt the concept: one cron-like resource running the same entry point nightly.
- Do NOT run cleanup inside the FastAPI process. It would lock rows during an API request.
- `get_session_factory()` may not exist by that exact name — find the equivalent in `src/docfusion/storage/` or `src/docfusion/database.py`.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented cleanup_job.py fix (PersistentMemoryStore.create(dsn) pattern), systemd timer/service files in deployment/systemd/, and deployment/README.md installation docs. Test passes.
<!-- SECTION:NOTES:END -->
