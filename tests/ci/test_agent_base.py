"""Coverage for the structured agent base protocol."""

from __future__ import annotations

from datetime import datetime

import pytest

from docfusion.agents.base import AgentResult, AgentTask, BaseAgent


class TinyBaseAgent(BaseAgent):
	async def run(self, task: AgentTask) -> AgentResult:
		return self._build_result(task, data={"ok": True})


def test_agent_task_creation_defaults():
	task = AgentTask(task_type="demo", payload={"x": 1})

	assert task.task_id
	assert task.task_type == "demo"
	assert task.payload == {"x": 1}
	assert task.context == {}
	assert isinstance(task.created_at, datetime)


def test_agent_result_fields():
	result = AgentResult(
		task_id="task-1",
		status="partial",
		data={"value": 3},
		errors=["missing optional field"],
		duration_ms=12.5,
	)

	assert result.task_id == "task-1"
	assert result.status == "partial"
	assert result.data == {"value": 3}
	assert result.errors == ["missing optional field"]
	assert result.duration_ms == 12.5


@pytest.mark.asyncio
async def test_base_agent_health_default_true():
	agent = TinyBaseAgent()

	assert await agent.health() is True
