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

import os

from temporalio.client import Client

from .workflow import RfpParseWorkflow, RfpParseWorkflowInput

_DEFAULT_ADDRESS = "localhost:7233"
_DEFAULT_NAMESPACE = "default"

# Single canonical task-queue name. Workers register on this; the
# enqueue helper publishes to it. Keeping the constant in one place
# makes it impossible for the producer and consumer to disagree.
TASK_QUEUE = "rfp-parse"


async def get_temporal_client() -> Client:
	"""Connect to the Temporal cluster.

	Reads ``TEMPORAL_ADDRESS`` and ``TEMPORAL_NAMESPACE`` from the
	environment, falling back to ``localhost:7233`` / ``default`` for
	local development.
	"""
	address = os.environ.get("TEMPORAL_ADDRESS", _DEFAULT_ADDRESS)
	namespace = os.environ.get("TEMPORAL_NAMESPACE", _DEFAULT_NAMESPACE)
	return await Client.connect(address, namespace=namespace)


async def enqueue_rfp_parse(
	rfp_id: str,
	organization_id: str,
	user_id: str,
) -> tuple[str, str]:
	"""Submit an RFP parse workflow.

	Returns ``(workflow_id, run_id)``. ``workflow_id`` is derived from
	``rfp_id`` so duplicate enqueue attempts collapse onto the same
	workflow execution — Temporal's ID-reuse policy then decides
	whether to start a new run or reject. ``run_id`` is the new run's
	id (empty string if the SDK hands back ``None``, which can happen
	on certain reuse policies).
	"""
	assert rfp_id, "rfp_id is required"
	assert organization_id, "organization_id is required"
	assert user_id, "user_id is required"

	client = await get_temporal_client()
	workflow_id = f"rfp-parse-{rfp_id}"
	handle = await client.start_workflow(
		RfpParseWorkflow.run,
		RfpParseWorkflowInput(
			rfp_id=rfp_id,
			organization_id=organization_id,
			user_id=user_id,
		),
		id=workflow_id,
		task_queue=TASK_QUEUE,
	)
	# ``first_execution_run_id`` is None when the server reused an
	# existing workflow id; coalesce to "" so the FastAPI response
	# stays a plain string and never leaks JSON-null shape changes.
	return workflow_id, handle.first_execution_run_id or ""
