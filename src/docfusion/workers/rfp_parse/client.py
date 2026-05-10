"""Temporal client helpers for the RFP parse workflow.

The FastAPI route imports :func:`enqueue_rfp_parse` to hand off a
parse request to the worker pool. The worker entry point (see
:mod:`worker`) imports :func:`get_temporal_client` and the
``TASK_QUEUE`` constant to wire itself onto the same queue.

Cluster address resolution is environment-driven so production,
staging, and local-dev all use the same code path:

  * ``TEMPORAL_ADDRESS`` — host:port of the Temporal frontend
    (default ``localhost:7233``; production is ``62.84.181.55:7233``).
  * ``TEMPORAL_NAMESPACE`` — the Temporal namespace (default
    ``default``).
"""

from __future__ import annotations

import asyncio
import logging
import os

from temporalio.client import (
	Client,
	WorkflowExecutionStatus,
	WorkflowFailureError,
)
from temporalio.common import WorkflowIDReusePolicy

from .workflow import RfpParseWorkflow, RfpParseWorkflowInput

_DEFAULT_ADDRESS = "localhost:7233"
_DEFAULT_NAMESPACE = "default"
_CONNECT_TIMEOUT_SECONDS = 5.0

# Single canonical task-queue name. Workers register on this; the
# enqueue helper publishes to it. Keeping the constant in one place
# makes it impossible for the producer and consumer to disagree.
TASK_QUEUE = "rfp-parse"

logger = logging.getLogger(__name__)

# Process-global cached client. Each /parse request would otherwise open
# a fresh gRPC channel and tear it down — under load this is measurable
# latency tax. The lock prevents two concurrent first-callers from
# racing to set it. The cache is intentionally per-process: workers and
# FastAPI processes each maintain their own client.
_client_lock = asyncio.Lock()
_cached_client: Client | None = None


async def get_temporal_client() -> Client:
	"""Connect to the Temporal cluster, caching the channel.

	The cluster address comes from ``TEMPORAL_ADDRESS`` (default
	``localhost:7233``) and the namespace from ``TEMPORAL_NAMESPACE``
	(default ``default``). The connect call is bounded by a five-second
	timeout so a misconfigured / unreachable cluster surfaces as a clear
	error instead of hanging the FastAPI request thread for the SDK's
	default exponential backoff.
	"""
	global _cached_client
	if _cached_client is not None:
		return _cached_client

	async with _client_lock:
		if _cached_client is not None:
			return _cached_client
		address = os.environ.get("TEMPORAL_ADDRESS", _DEFAULT_ADDRESS)
		namespace = os.environ.get("TEMPORAL_NAMESPACE", _DEFAULT_NAMESPACE)
		try:
			_cached_client = await asyncio.wait_for(
				Client.connect(address, namespace=namespace),
				timeout=_CONNECT_TIMEOUT_SECONDS,
			)
		except asyncio.TimeoutError as exc:
			raise TemporalUnreachableError(
				f"Temporal connect to {address} timed out after {_CONNECT_TIMEOUT_SECONDS}s"
			) from exc
		return _cached_client


async def reset_temporal_client_for_test() -> None:
	"""Drop the cached client. Useful for tests that want a fresh channel."""
	global _cached_client
	async with _client_lock:
		_cached_client = None


class TemporalUnreachableError(Exception):
	"""Raised when ``get_temporal_client`` cannot reach the cluster."""


class WorkflowAlreadyEnqueuedError(Exception):
	"""Raised when a duplicate enqueue collides with an in-flight workflow.

	Carries the existing ``workflow_id`` and ``run_id`` so the caller can
	surface them to the client (and avoid double-counting parses).
	"""

	def __init__(self, workflow_id: str, run_id: str) -> None:
		super().__init__(
			f"Workflow {workflow_id} is already running (run_id={run_id})"
		)
		self.workflow_id = workflow_id
		self.run_id = run_id


async def enqueue_rfp_parse(
	rfp_id: str,
	organization_id: str,
	user_id: str,
) -> tuple[str, str]:
	"""Submit an RFP parse workflow.

	Returns ``(workflow_id, run_id)``. ``workflow_id`` is derived from
	``rfp_id`` so the same RFP cannot have two concurrent parses in
	flight. The ``REJECT_DUPLICATE`` reuse policy prevents the SDK's
	default ALLOW_DUPLICATE behaviour, which would happily start a fresh
	run after a previous completion and cause the activity to re-insert
	requirements (the activity is INSERT-only, not upsert).

	If a workflow with the same id is already running, raises
	:class:`WorkflowAlreadyEnqueuedError` carrying the existing handle so
	the caller can return 200 with the existing run instead of treating
	it as a server error.
	"""
	assert rfp_id, "rfp_id is required"
	assert organization_id, "organization_id is required"
	assert user_id, "user_id is required"

	from temporalio.service import RPCError, RPCStatusCode

	client = await get_temporal_client()
	workflow_id = f"rfp-parse-{rfp_id}"
	try:
		handle = await client.start_workflow(
			RfpParseWorkflow.run,
			RfpParseWorkflowInput(
				rfp_id=rfp_id,
				organization_id=organization_id,
				user_id=user_id,
			),
			id=workflow_id,
			task_queue=TASK_QUEUE,
			id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
		)
	except RPCError as exc:
		# WorkflowAlreadyStartedError surfaces as ALREADY_EXISTS at the
		# RPC layer with the SDK we depend on; bridge it to the caller's
		# typed error so the route can return 200 instead of 5xx.
		if getattr(exc, "status", None) == RPCStatusCode.ALREADY_EXISTS:
			existing = client.get_workflow_handle(workflow_id)
			described = await existing.describe()
			run_id = described.run_id or ""
			logger.info(
				"Re-enqueue collided with in-flight workflow %s (run_id=%s, status=%s)",
				workflow_id,
				run_id,
				described.status,
			)
			raise WorkflowAlreadyEnqueuedError(workflow_id, run_id) from exc
		raise

	# ``first_execution_run_id`` is None when the server reused an
	# existing workflow id; coalesce to "" so the FastAPI response
	# stays a plain string and never leaks JSON-null shape changes.
	return workflow_id, handle.first_execution_run_id or ""


__all__ = [
	"TASK_QUEUE",
	"TemporalUnreachableError",
	"WorkflowAlreadyEnqueuedError",
	"WorkflowExecutionStatus",
	"WorkflowFailureError",
	"enqueue_rfp_parse",
	"get_temporal_client",
	"reset_temporal_client_for_test",
]
