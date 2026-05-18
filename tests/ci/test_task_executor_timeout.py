import asyncio

import pytest

from docfusion.agents.execution.task_executor import (
    TaskDefinition,
    TaskExecutor,
    TaskStatus,
)


@pytest.mark.asyncio
async def test_execute_task_enforces_task_timeout() -> None:
    executor = TaskExecutor()
    task = TaskDefinition(name="slow_task", function="slow", timeout_seconds=1)

    async def slow_task(_task_def: TaskDefinition) -> dict[str, str]:
        await asyncio.sleep(10)
        return {"status": "should not finish"}

    executor._execute_task_function = slow_task  # type: ignore[method-assign]

    result = await executor.execute_task(task)

    assert result.status is TaskStatus.TIMEOUT
    assert result.error == "Task execution timed out"
    assert executor.execution_stats["timeout_tasks"] == 1
    assert executor.execution_stats["completed_tasks"] == 0
