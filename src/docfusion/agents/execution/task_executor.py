"""
Task Executor

Task execution engine with timeout handling, service coordination,
and result validation for AI agent orchestration.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"

class TaskPriority(str, Enum):
    """Task execution priority levels"""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class TaskResult:
    """Task execution result"""

    task_id: str
    status: TaskStatus
    result: Any = None
    error: Optional[str] = None
    execution_time: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "execution_time": self.execution_time,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "metadata": self.metadata,
        }

class TaskDefinition(BaseModel):
    """Task definition for execution"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    task_id: str = Field(default_factory=uuid7str)
    name: str
    function: str  # Function name or callable reference
    parameters: Dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout_seconds: int = 300  # 5 minutes default
    retry_attempts: int = 3
    dependencies: List[str] = Field(default_factory=list)
    service_requirements: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.now)
    scheduled_at: Optional[datetime] = None

class TaskExecutor:
    """
    Task execution engine with timeout handling and service coordination

    Manages task execution lifecycle, resource allocation, and monitoring
    for AI agent orchestration workflows.
    """

    def __init__(self, max_concurrent_tasks: int = 10):
        self.max_concurrent_tasks = max_concurrent_tasks

        # Task tracking
        self.pending_tasks: List[TaskDefinition] = []
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.completed_tasks: Dict[str, TaskResult] = {}

        # Service registry and coordination
        self.service_registry: Dict[str, Any] = {}
        self.service_health: Dict[str, bool] = {}

        # Execution metrics
        self.execution_stats = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "timeout_tasks": 0,
            "average_execution_time": 0.0,
        }

        # Configuration
        self.health_check_interval = 30  # seconds
        self.cleanup_interval = 300  # 5 minutes

        self.logger = logging.getLogger("task_executor")
        self.logger.info("TaskExecutor initialized")

        # Background tasks
        self._health_check_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start the task executor"""
        if self._running:
            return

        self._running = True

        # Start background tasks
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self.logger.info("TaskExecutor started")

    async def stop(self) -> None:
        """Stop the task executor"""
        if not self._running:
            return

        self._running = False

        # Cancel running tasks
        for task_id, task in list(self.running_tasks.items()):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Cancel background tasks
        if self._health_check_task:
            self._health_check_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        self.logger.info("TaskExecutor stopped")

    def register_service(self, name: str, service: Any) -> None:
        """Register a service for task coordination"""
        self.service_registry[name] = service
        self.service_health[name] = True
        self.logger.info(f"Registered service: {name}")

    def unregister_service(self, name: str) -> None:
        """Unregister a service"""
        if name in self.service_registry:
            del self.service_registry[name]
            del self.service_health[name]
            self.logger.info(f"Unregistered service: {name}")

    async def submit_task(self, task_def: TaskDefinition) -> str:
        """
        Submit a task for execution

        Args:
                task_def: Task definition

        Returns:
                Task ID for tracking
        """
        # Validate service requirements
        missing_services = []
        for service_name in task_def.service_requirements:
            if service_name not in self.service_registry:
                missing_services.append(service_name)

        if missing_services:
            raise ValueError(f"Required services not available: {missing_services}")

        # Add to pending queue
        self.pending_tasks.append(task_def)
        self.execution_stats["total_tasks"] += 1

        # Sort by priority
        self.pending_tasks.sort(
            key=lambda t: self._get_priority_value(t.priority), reverse=True
        )

        self.logger.info(f"Task submitted: {task_def.task_id} ({task_def.name})")

        # Try to execute immediately if capacity available
        await self._execute_pending_tasks()

        return task_def.task_id

    async def execute_task(self, task_def: TaskDefinition) -> TaskResult:
        """
        Execute a single task immediately

        Args:
                task_def: Task definition

        Returns:
                Task execution result
        """
        task_id = task_def.task_id
        started_at = datetime.now()

        try:
            # Check service requirements
            await self._validate_service_requirements(task_def)

            # Execute the task function within the task-specific timeout.
            result = await asyncio.wait_for(
                self._execute_task_function(task_def),
                timeout=task_def.timeout_seconds,
            )

            # Create success result
            completed_at = datetime.now()
            execution_time = (completed_at - started_at).total_seconds()

            task_result = TaskResult(
                task_id=task_id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_time=execution_time,
                started_at=started_at,
                completed_at=completed_at,
            )

            self.execution_stats["completed_tasks"] += 1
            self._update_average_execution_time(execution_time)

            self.logger.info(f"Task completed: {task_id} in {execution_time:.2f}s")

            return task_result

        except asyncio.TimeoutError:
            task_result = TaskResult(
                task_id=task_id,
                status=TaskStatus.TIMEOUT,
                error="Task execution timed out",
                execution_time=(datetime.now() - started_at).total_seconds(),
                started_at=started_at,
                completed_at=datetime.now(),
            )

            self.execution_stats["timeout_tasks"] += 1
            self.logger.warning(f"Task timeout: {task_id}")

            return task_result

        except Exception as e:
            task_result = TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_time=(datetime.now() - started_at).total_seconds(),
                started_at=started_at,
                completed_at=datetime.now(),
            )

            self.execution_stats["failed_tasks"] += 1
            self.logger.error(f"Task failed: {task_id} - {e}")

            return task_result

    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get the status of a task"""
        # Check running tasks
        if task_id in self.running_tasks:
            return TaskStatus.RUNNING

        # Check completed tasks
        if task_id in self.completed_tasks:
            return self.completed_tasks[task_id].status

        # Check pending tasks
        for task_def in self.pending_tasks:
            if task_def.task_id == task_id:
                return TaskStatus.PENDING

        return None

    async def get_task_result(self, task_id: str) -> Optional[TaskResult]:
        """Get the result of a completed task"""
        return self.completed_tasks.get(task_id)

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending or running task"""
        # Cancel running task
        if task_id in self.running_tasks:
            task = self.running_tasks[task_id]
            task.cancel()

            # Create cancelled result
            result = TaskResult(
                task_id=task_id,
                status=TaskStatus.CANCELLED,
                completed_at=datetime.now(),
            )
            self.completed_tasks[task_id] = result

            del self.running_tasks[task_id]
            self.logger.info(f"Task cancelled: {task_id}")
            return True

        # Remove from pending tasks
        for i, task_def in enumerate(self.pending_tasks):
            if task_def.task_id == task_id:
                del self.pending_tasks[i]

                # Create cancelled result
                result = TaskResult(
                    task_id=task_id,
                    status=TaskStatus.CANCELLED,
                    completed_at=datetime.now(),
                )
                self.completed_tasks[task_id] = result

                self.logger.info(f"Pending task cancelled: {task_id}")
                return True

        return False

    async def wait_for_task(
        self, task_id: str, timeout_seconds: Optional[int] = None
    ) -> TaskResult:
        """
        Wait for a task to complete

        Args:
                task_id: Task ID to wait for
                timeout_seconds: Maximum time to wait

        Returns:
                Task result when completed
        """
        start_time = time.time()

        while True:
            # Check if task is completed
            if task_id in self.completed_tasks:
                return self.completed_tasks[task_id]

            # Check timeout
            if timeout_seconds and (time.time() - start_time) > timeout_seconds:
                raise asyncio.TimeoutError(f"Timeout waiting for task {task_id}")

            # Wait a bit before checking again
            await asyncio.sleep(0.1)

    async def get_execution_metrics(self) -> Dict[str, Any]:
        """Get execution metrics and statistics"""
        return {
            **self.execution_stats,
            "pending_tasks": len(self.pending_tasks),
            "running_tasks": len(self.running_tasks),
            "completed_tasks_count": len(self.completed_tasks),
            "service_health": dict(self.service_health),
            "uptime": time.time() if self._running else 0,
        }

    async def _execute_pending_tasks(self) -> None:
        """Execute pending tasks up to max concurrent limit"""
        while (
            len(self.running_tasks) < self.max_concurrent_tasks
            and self.pending_tasks
            and self._running
        ):
            task_def = self.pending_tasks.pop(0)

            # Start task execution
            task = asyncio.create_task(self._execute_task_with_tracking(task_def))
            self.running_tasks[task_def.task_id] = task

    async def _execute_task_with_tracking(self, task_def: TaskDefinition) -> None:
        """Execute a task with proper tracking and cleanup"""
        task_id = task_def.task_id

        try:
            # Execute the task
            result = await self.execute_task(task_def)

            # Store result
            self.completed_tasks[task_id] = result

        except Exception as e:
            # Handle unexpected errors
            result = TaskResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                error=f"Execution error: {e}",
                completed_at=datetime.now(),
            )
            self.completed_tasks[task_id] = result

            self.logger.error(f"Task execution error: {task_id} - {e}")

        finally:
            # Clean up running task reference
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]

            # Continue executing pending tasks
            await self._execute_pending_tasks()

    async def _execute_task_function(self, task_def: TaskDefinition) -> Any:
        """Execute the actual task function with timeout"""
        # This would be implemented to call the actual function
        # For now, return a mock result based on task name
        await asyncio.sleep(0.1)  # Simulate work

        if task_def.name == "generate_content":
            return {"content": "Generated content", "word_count": 500}
        elif task_def.name == "analyze_document":
            return {"analysis": "Document analysis results", "score": 85.5}
        elif task_def.name == "format_document":
            return {"formatted": True, "pages": 10, "format": "PDF"}
        else:
            return {"status": "completed", "result": f"Task {task_def.name} completed"}

    async def _validate_service_requirements(self, task_def: TaskDefinition) -> None:
        """Validate that required services are healthy and available"""
        for service_name in task_def.service_requirements:
            if service_name not in self.service_registry:
                raise ValueError(f"Required service not available: {service_name}")

            if not self.service_health.get(service_name, False):
                raise ValueError(f"Required service unhealthy: {service_name}")

    def _get_priority_value(self, priority: TaskPriority) -> int:
        """Get numeric value for priority sorting"""
        priority_values = {
            TaskPriority.CRITICAL: 4,
            TaskPriority.HIGH: 3,
            TaskPriority.NORMAL: 2,
            TaskPriority.LOW: 1,
        }
        return priority_values.get(priority, 2)

    def _update_average_execution_time(self, execution_time: float) -> None:
        """Update running average execution time"""
        completed = self.execution_stats["completed_tasks"]
        current_avg = self.execution_stats["average_execution_time"]

        # Calculate new average
        new_avg = ((current_avg * (completed - 1)) + execution_time) / completed
        self.execution_stats["average_execution_time"] = new_avg

    async def _health_check_loop(self) -> None:
        """Background health check for services"""
        while self._running:
            try:
                await self._perform_service_health_checks()
                await asyncio.sleep(self.health_check_interval)
            except Exception as e:
                self.logger.error(f"Health check error: {e}")
                await asyncio.sleep(60)

    async def _perform_service_health_checks(self) -> None:
        """Check health of all registered services"""
        for service_name, service in self.service_registry.items():
            try:
                # Simple health check - try to access the service
                if hasattr(service, "health_check"):
                    if asyncio.iscoroutinefunction(service.health_check):
                        healthy = await service.health_check()
                    else:
                        healthy = service.health_check()
                else:
                    # Basic existence check
                    healthy = service is not None

                self.service_health[service_name] = healthy

            except Exception as e:
                self.service_health[service_name] = False
                self.logger.warning(
                    f"Service health check failed for {service_name}: {e}"
                )

    async def _cleanup_loop(self) -> None:
        """Background cleanup of old completed tasks"""
        while self._running:
            try:
                await self._cleanup_old_tasks()
                await asyncio.sleep(self.cleanup_interval)
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
                await asyncio.sleep(300)

    async def _cleanup_old_tasks(self) -> None:
        """Clean up old completed tasks to prevent memory growth"""
        cutoff_time = datetime.now() - timedelta(hours=24)  # Keep 24 hours of history

        tasks_to_remove = []
        for task_id, result in self.completed_tasks.items():
            if result.completed_at and result.completed_at < cutoff_time:
                tasks_to_remove.append(task_id)

        for task_id in tasks_to_remove:
            del self.completed_tasks[task_id]

        if tasks_to_remove:
            self.logger.info(f"Cleaned up {len(tasks_to_remove)} old task results")
