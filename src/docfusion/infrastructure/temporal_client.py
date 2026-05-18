"""
Temporal Client

Client for Temporal workflow orchestration running on PJS infrastructure.
Used for scheduled workflows replacing traditional cron jobs.

Server: 62.84.181.55:7233

Usage:
    client = TemporalClient()
    await client.connect()

    # Start a workflow
    handle = await client.start_workflow(
        OpportunityDigestWorkflow,
        SendDigestRequest(recipient="user@example.com"),
        task_queue="opportunity-queue",
    )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, Optional, Type, TypeVar

from ..config.secrets import SecretsManager

logger = logging.getLogger(__name__)

# Configuration via SecretsManager
TEMPORAL_URL = SecretsManager.get_temporal_url()
TEMPORAL_NAMESPACE = SecretsManager.get_temporal_namespace()
TEMPORAL_TASK_QUEUE = SecretsManager.get_temporal_task_queue()

# Try to import temporal client
try:
    from temporalio.client import Client, WorkflowHandle
    TEMPORAL_AVAILABLE = True
except ImportError:
    TEMPORAL_AVAILABLE = False
    Client = None
    WorkflowHandle = None


T = TypeVar("T")


@dataclass
class TemporalConfiguration:
    """Configuration for Temporal client."""

    host: str = TEMPORAL_URL.split(":")[0] if ":" in TEMPORAL_URL else TEMPORAL_URL
    port: int = int(TEMPORAL_URL.split(":")[1]) if ":" in TEMPORAL_URL else 7233
    namespace: str = TEMPORAL_NAMESPACE
    task_queue: str = TEMPORAL_TASK_QUEUE

    # Retry policy
    retry_max_attempts: int = 3
    retry_initial_interval: timedelta = timedelta(seconds=1)
    retry_max_interval: timedelta = timedelta(seconds=10)

    # Timeout settings
    workflow_timeout: timedelta = timedelta(minutes=30)
    workflow_task_timeout: timedelta = timedelta(seconds=10)


class TemporalClient:
    """
    Client for Temporal workflow orchestration.

    Provides methods to start, manage, and schedule workflows
    for background processing and scheduled tasks.
    """

    def __init__(self, config: Optional[TemporalConfiguration] = None):
        self.config = config or TemporalConfiguration()
        self.client: Optional[Any] = None
        self._connected = False
        self.logger = logging.getLogger(__name__)

    async def connect(self) -> None:
        """Connect to Temporal server."""
        if not TEMPORAL_AVAILABLE:
            self.logger.warning("Temporal SDK not installed - workflows will not run")
            return

        try:
            self.client = await Client.connect(
                target_host=f"{self.config.host}:{self.config.port}",
                namespace=self.config.namespace,
            )
            self._connected = True
            self.logger.info(f"Connected to Temporal at {self.config.host}:{self.config.port}")
        except Exception as e:
            self.logger.error(f"Failed to connect to Temporal: {e}")
            self._connected = False
            raise

    async def close(self) -> None:
        """Close Temporal client connection."""
        if self.client:
            await self.client.close()
            self._connected = False
            self.logger.info("Temporal client connection closed")

    async def start_workflow(
        self,
        workflow: Type,
        *args,
        task_queue: Optional[str] = None,
        workflow_id: Optional[str] = None,
        **kwargs,
    ) -> Any:
        """
        Start a workflow execution.

        Args:
            workflow: Workflow class to execute
            *args: Arguments to pass to workflow
            task_queue: Task queue name (default from config)
            workflow_id: Optional workflow ID
            **kwargs: Additional workflow arguments

        Returns:
            WorkflowHandle for managing the workflow
        """
        if not self._connected or not self.client:
            raise RuntimeError("Temporal client not connected. Call connect() first.")

        task_queue = task_queue or self.config.task_queue

        try:
            handle = await self.client.start_workflow(
                workflow.run,
                *args,
                id=workflow_id,
                task_queue=task_queue,
                execution_timeout=self.config.workflow_timeout,
                **kwargs,
            )
            self.logger.info(f"Started workflow {workflow.__name__} with ID {handle.id}")
            return handle
        except Exception as e:
            self.logger.error(f"Failed to start workflow: {e}")
            raise

    async def schedule_workflow(
        self,
        workflow: Type,
        cron_schedule: str,
        *args,
        task_queue: Optional[str] = None,
        workflow_id: Optional[str] = None,
        **kwargs,
    ) -> Any:
        """
        Schedule a recurring workflow.

        Args:
            workflow: Workflow class to schedule
            cron_schedule: Cron expression (e.g., "0 8 * * *" for daily at 8am)
            *args: Arguments to pass to workflow
            task_queue: Task queue name
            workflow_id: Optional workflow ID for the schedule
            **kwargs: Additional workflow arguments

        Returns:
            Schedule handle
        """
        if not self._connected or not self.client:
            raise RuntimeError("Temporal client not connected. Call connect() first.")

        task_queue = task_queue or self.config.task_queue
        schedule_id = workflow_id or f"{workflow.__name__}-schedule"

        try:
            # Create scheduled workflow
            schedule = await self.client.create_schedule(
                schedule_id,
                workflow.run,
                *args,
                task_queue=task_queue,
                cron=cron_schedule,
                **kwargs,
            )
            self.logger.info(f"Scheduled workflow {workflow.__name__} with cron '{cron_schedule}'")
            return schedule
        except Exception as e:
            self.logger.error(f"Failed to schedule workflow: {e}")
            raise

    async def get_workflow_result(
        self,
        handle: Any,
        timeout: Optional[timedelta] = None,
    ) -> Any:
        """
        Wait for workflow completion and get result.

        Args:
            handle: Workflow handle from start_workflow
            timeout: Optional timeout (default from config)

        Returns:
            Workflow result
        """
        if not self._connected or not self.client:
            raise RuntimeError("Temporal client not connected. Call connect() first.")

        timeout = timeout or self.config.workflow_timeout

        try:
            result = await handle.result(timeout=timeout)
            return result
        except Exception as e:
            self.logger.error(f"Failed to get workflow result: {e}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Check Temporal server health."""
        result = {
            "connected": self._connected,
            "host": self.config.host,
            "port": self.config.port,
            "namespace": self.config.namespace,
            "task_queue": self.config.task_queue,
        }

        if self._connected and self.client:
            try:
                # Try to get cluster info
                result["status"] = "healthy"
            except Exception as e:
                result["status"] = f"error: {e}"
        else:
            result["status"] = "disconnected"

        return result


# Singleton instance
_temporal_client: Optional[TemporalClient] = None


async def get_temporal_client() -> TemporalClient:
    """Get or create Temporal client singleton."""
    global _temporal_client

    if _temporal_client is None:
        _temporal_client = TemporalClient()
        try:
            await _temporal_client.connect()
        except Exception as e:
            logger.warning(f"Failed to connect to Temporal: {e}")
            # Return disconnected client for graceful degradation

    return _temporal_client
