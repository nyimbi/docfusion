---
id: task-016
title: "Phase 3: Implement workflow integration stubs"
status: To Do
phase: 3
gap_ids: [G-WF-01, G-WF-02, G-WF-03, G-WF-04, G-WF-05, G-WF-06, G-WF-07]
priority: High
dependencies: [task-014, task-015]
---

# task-016 - Phase 3: Implement workflow integration stubs

## Description (the why)

Seven `NotImplementedError` sites across three workflow-integration files block real agent↔workflow bridging: metrics, swarm creation, collaboration facilitation, stuck/failed agent recovery, and event-handler setup. Each must be filled with real logic now that Phase 3 tasks 014–015 have provided the agent primitives.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/workflow/integration/nlp_workflow_integration.py` — `_update_performance_metrics` and `_check_performance_thresholds` implemented.
- [ ] `src/docfusion/workflow/integration/agents_workflow_integration.py` — `_create_workflow_swarm`, `_facilitate_agent_collaboration`, `_resolve_stuck_agent`, `_handle_failed_agent` implemented.
- [ ] `src/docfusion/workflow/integration/workflow_document_bridge.py` — `_setup_event_handlers` implemented.
- [ ] `grep -n "NotImplementedError" src/docfusion/workflow/integration/` returns 0 lines.
- [ ] Smoke test `tests/ci/test_workflow_integration.py` exercises each method without raising.

## Implementation Plan (the how)

**Step 1: Read each file to find the surrounding class and context.**
```bash
grep -n "class \|NotImplementedError\|def " src/docfusion/workflow/integration/nlp_workflow_integration.py | head -40
grep -n "class \|NotImplementedError\|def " src/docfusion/workflow/integration/agents_workflow_integration.py | head -40
grep -n "class \|NotImplementedError\|def " src/docfusion/workflow/integration/workflow_document_bridge.py | head -40
```

**Step 2 — `_update_performance_metrics` (nlp_workflow_integration.py:1030).**

```python
async def _update_performance_metrics(
	self,
	workflow_id: str,
	metrics: dict[str, float],
) -> None:
	"""Record metrics to the agent_metrics table."""
	from sqlalchemy import text
	from docfusion.core.utils import uuid7str
	async with self._db_session_factory() as session:
		for metric_name, value in metrics.items():
			await session.execute(
				text("""
					INSERT INTO agent_metrics (id, workflow_id, metric_name, value, recorded_at)
					VALUES (:id, :wid, :name, :value, NOW())
				"""),
				{"id": uuid7str(), "wid": workflow_id, "name": metric_name, "value": value},
			)
		await session.commit()
```

If the `agent_metrics` table doesn't exist, create an Alembic migration in this task:

```python
op.create_table(
	"agent_metrics",
	sa.Column("id", sa.String, primary_key=True),
	sa.Column("workflow_id", sa.String, nullable=False),
	sa.Column("metric_name", sa.String, nullable=False),
	sa.Column("value", sa.Float, nullable=False),
	sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
)
op.create_index("ix_agent_metrics_workflow_id", "agent_metrics", ["workflow_id"])
```

**Step 3 — `_check_performance_thresholds` (nlp_workflow_integration.py:1035).**

```python
async def _check_performance_thresholds(
	self,
	workflow_id: str,
	thresholds: dict[str, float],
) -> list[dict[str, Any]]:
	"""Compare recent metrics against thresholds. Return alerts."""
	from sqlalchemy import text
	alerts: list[dict[str, Any]] = []
	async with self._db_session_factory() as session:
		for metric_name, threshold in thresholds.items():
			row = (await session.execute(
				text("""
					SELECT AVG(value) AS avg_val FROM agent_metrics
					WHERE workflow_id = :wid AND metric_name = :name
					  AND recorded_at > NOW() - INTERVAL '1 hour'
				"""),
				{"wid": workflow_id, "name": metric_name},
			)).mappings().first()
			if row and row["avg_val"] is not None and row["avg_val"] > threshold:
				alerts.append({
					"metric": metric_name,
					"observed": float(row["avg_val"]),
					"threshold": threshold,
				})
	return alerts
```

**Step 4 — `_create_workflow_swarm` (agents_workflow_integration.py:997).**

```python
async def _create_workflow_swarm(
	self,
	workflow_id: str,
	agent_specs: list[dict[str, Any]],
) -> str:
	"""Create a swarm of agents for the workflow via SwarmManager."""
	from docfusion.agents.orchestration.swarm_manager import SwarmManager
	swarm_manager = self._swarm_manager or SwarmManager()
	swarm_id = await swarm_manager.create_swarm(
		swarm_id=f"workflow-{workflow_id}",
		agent_specs=agent_specs,
	)
	self._workflow_swarms[workflow_id] = swarm_id
	return swarm_id
```

**Step 5 — `_facilitate_agent_collaboration` (agents_workflow_integration.py:1027).**

```python
async def _facilitate_agent_collaboration(
	self,
	workflow_id: str,
	task: dict[str, Any],
) -> dict[str, Any]:
	"""Route a task through the CoordinatorAgent for multi-agent execution."""
	swarm_id = self._workflow_swarms.get(workflow_id)
	if swarm_id is None:
		raise ValueError(f"No swarm exists for workflow {workflow_id}")
	from docfusion.agents.specialists.coordinator_agent import CoordinatorAgent
	coordinator = self._coordinator_for_swarm(swarm_id)
	return await coordinator.coordinate(task)
```

`_coordinator_for_swarm` returns the coordinator agent the swarm already contains, or instantiates one.

**Step 6 — `_resolve_stuck_agent` (agents_workflow_integration.py:1037).**

```python
async def _resolve_stuck_agent(
	self,
	agent_id: str,
	task_id: str,
	stuck_duration_seconds: int,
) -> dict[str, Any]:
	"""Retry, reassign, or escalate a stuck agent."""
	if stuck_duration_seconds < 60:
		return {"action": "waiting", "agent_id": agent_id}
	if stuck_duration_seconds < 300:
		return await self._retry_task(agent_id, task_id)
	if stuck_duration_seconds < 900:
		return await self._reassign_task(task_id)
	return await self._escalate(agent_id, task_id)
```

Helper methods `_retry_task`, `_reassign_task`, `_escalate` should already exist on this class or be straightforward to add. If they don't exist, add them as 3-line methods that log the action and emit a message via the channel from task-015.

**Step 7 — `_handle_failed_agent` (agents_workflow_integration.py:1042).**

```python
async def _handle_failed_agent(
	self,
	agent_id: str,
	failure: Exception,
) -> dict[str, Any]:
	"""Mark an agent failed, reassign its tasks, record in metrics."""
	self.logger.error("Agent %s failed: %s", agent_id, failure)
	await self._update_performance_metrics(
		workflow_id=self._workflow_for_agent(agent_id),
		metrics={"agent_failure": 1.0},
	)
	pending = await self._pending_tasks_for_agent(agent_id)
	for task in pending:
		await self._reassign_task(task["id"])
	return {"agent_id": agent_id, "reassigned_count": len(pending)}
```

**Step 8 — `_setup_event_handlers` (workflow_document_bridge.py:889).**

```python
async def _setup_event_handlers(self) -> None:
	"""Wire workflow event bus to document lifecycle handlers."""
	self._event_bus.on("workflow.started", self._on_workflow_started)
	self._event_bus.on("workflow.step_completed", self._on_step_completed)
	self._event_bus.on("workflow.failed", self._on_workflow_failed)
	self._event_bus.on("document.published", self._on_document_published)
	self._event_handlers_ready = True
```

The four handler methods should exist or be stubbed trivially (log + record metric).

**Step 9: Test.**

```python
# tests/ci/test_workflow_integration.py
"""Smoke coverage for workflow integration methods."""

import pytest

from docfusion.workflow.integration.nlp_workflow_integration import NLPWorkflowIntegration
from docfusion.workflow.integration.agents_workflow_integration import AgentsWorkflowIntegration
from docfusion.workflow.integration.workflow_document_bridge import WorkflowDocumentBridge


async def test_update_performance_metrics_writes_row(db_session):
	integ = NLPWorkflowIntegration(db_session_factory=lambda: db_session)
	await integ._update_performance_metrics("wf-1", {"latency_ms": 123.4})
	# Read it back.
	from sqlalchemy import text
	rows = (await db_session.execute(
		text("SELECT * FROM agent_metrics WHERE workflow_id = 'wf-1'")
	)).mappings().all()
	assert len(rows) == 1
	assert rows[0]["value"] == pytest.approx(123.4)


async def test_check_performance_thresholds_detects_breach(db_session):
	integ = NLPWorkflowIntegration(db_session_factory=lambda: db_session)
	await integ._update_performance_metrics("wf-2", {"error_rate": 0.9})
	alerts = await integ._check_performance_thresholds("wf-2", {"error_rate": 0.1})
	assert len(alerts) == 1
	assert alerts[0]["metric"] == "error_rate"


async def test_resolve_stuck_agent_waits_under_one_minute():
	integ = AgentsWorkflowIntegration()
	result = await integ._resolve_stuck_agent("agent-1", "task-1", stuck_duration_seconds=30)
	assert result["action"] == "waiting"
```

**Step 10: Verify + commit.**
```bash
uv run pytest tests/ci/test_workflow_integration.py -vxs
grep -n "NotImplementedError" src/docfusion/workflow/integration/
# Must be 0 lines.

git add src/docfusion/workflow/integration/ migrations/ tests/ci/test_workflow_integration.py
git commit -m "feat(workflow): implement integration stubs [G-WF-01..07]"
```

## Notes for less-capable agents

- If `self._db_session_factory` doesn't exist on the class, either add it as a constructor param or swap the async block for whatever DB accessor the class already has.
- The "escalate" path can be a stub for now that logs and creates a follow-up task — don't let scope creep block this.
- If a helper (`_retry_task`, `_reassign_task`) already has a different signature, match it — don't force a rewrite.
