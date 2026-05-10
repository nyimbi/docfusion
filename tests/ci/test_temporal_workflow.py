#!/usr/bin/env python3
"""Workflow-shape coverage for ``RfpParseWorkflow``.

This test boots an ephemeral Temporal time-skipping environment via
``temporalio.testing.WorkflowEnvironment``, registers
:class:`RfpParseWorkflow` and a stub activity, and proves the workflow
plumbing is callable end-to-end. We do not run the real DB-backed
parse pipeline here — that's covered by
:mod:`tests.ci.test_rfp_parse_activity`. What we want here is the
contract:

  * Inputs: a fully-formed :class:`RfpParseWorkflowInput` is accepted.
  * Activity dispatch: the workflow forwards every field of its input
    to the activity unchanged.
  * Output: the activity's :class:`RfpParseResult` flows back through
    the workflow result.

If ``temporalio`` is not installed (e.g. a stripped-down CI image
without the Rust toolchain), the file skips itself rather than
breaking the broader suite.
"""

from __future__ import annotations

import asyncio

import pytest

# Skip the whole module if temporalio isn't installed. The Temporal SDK
# bundles a Rust binary, so some environments deliberately omit it.
pytest.importorskip("temporalio")

from temporalio import activity  # noqa: E402 — import after importorskip
from temporalio.client import WorkflowFailureError  # noqa: E402
from temporalio.testing import WorkflowEnvironment  # noqa: E402
from temporalio.worker import Worker  # noqa: E402

from docfusion.workers.rfp_parse.activities import (  # noqa: E402
	RfpParseInput,
	RfpParseResult,
)
from docfusion.workers.rfp_parse.client import TASK_QUEUE  # noqa: E402
from docfusion.workers.rfp_parse.workflow import (  # noqa: E402
	RfpParseWorkflow,
	RfpParseWorkflowInput,
)


# ---------------------------------------------------------------------------
# Stub activity. Same name + signature as the production
# ``run_rfp_parse`` so the workflow's ``execute_activity`` call binds
# to it without changes.
# ---------------------------------------------------------------------------
_RECORDED_INPUTS: list[RfpParseInput] = []


@activity.defn(name="run_rfp_parse")
async def _stub_run_rfp_parse(input: RfpParseInput) -> RfpParseResult:
	"""Record the input and return a deterministic result."""
	_RECORDED_INPUTS.append(input)
	return RfpParseResult(
		rfp_id=input.rfp_id,
		requirements_extracted=42,
		status="completed",
	)


def test_workflow_dispatches_to_activity_with_full_tenant_context() -> None:
	"""End-to-end: start workflow, drain activity, verify result + payload.

	The workflow must hand every field of its input to the activity,
	and the activity's result must flow back unchanged. If any of
	those break (renamed fields, dropped tenant context, etc.) the
	assertions catch it.
	"""
	_RECORDED_INPUTS.clear()

	async def _run() -> RfpParseResult:
		# ``time_skipping`` boots a local Temporal server in-process.
		async with await WorkflowEnvironment.start_time_skipping() as env:
			async with Worker(
				env.client,
				task_queue=TASK_QUEUE,
				workflows=[RfpParseWorkflow],
				activities=[_stub_run_rfp_parse],
			):
				return await env.client.execute_workflow(
					RfpParseWorkflow.run,
					RfpParseWorkflowInput(
						rfp_id="rfp-temp-1",
						organization_id="org-temp-1",
						user_id="user-temp-1",
					),
					id="rfp-parse-temp-1",
					task_queue=TASK_QUEUE,
				)

	loop = asyncio.new_event_loop()
	try:
		result = loop.run_until_complete(_run())
	finally:
		loop.close()

	assert isinstance(result, RfpParseResult)
	assert result.rfp_id == "rfp-temp-1"
	assert result.requirements_extracted == 42
	assert result.status == "completed"

	# Activity received the tenant context unchanged.
	assert len(_RECORDED_INPUTS) == 1
	captured = _RECORDED_INPUTS[0]
	assert captured.rfp_id == "rfp-temp-1"
	assert captured.organization_id == "org-temp-1"
	assert captured.user_id == "user-temp-1"


def test_workflow_surfaces_activity_failure() -> None:
	"""If the activity raises, the workflow run fails — not silently passes.

	Guards against a regression where someone wraps ``execute_activity``
	in a swallow-all try/except.
	"""

	@activity.defn(name="run_rfp_parse")
	async def _boom(_input: RfpParseInput) -> RfpParseResult:
		raise RuntimeError("simulated analyzer crash")

	async def _run() -> None:
		async with await WorkflowEnvironment.start_time_skipping() as env:
			async with Worker(
				env.client,
				task_queue=TASK_QUEUE,
				workflows=[RfpParseWorkflow],
				activities=[_boom],
			):
				await env.client.execute_workflow(
					RfpParseWorkflow.run,
					RfpParseWorkflowInput(
						rfp_id="rfp-temp-2",
						organization_id="org-temp-2",
						user_id="user-temp-2",
					),
					id="rfp-parse-temp-2",
					task_queue=TASK_QUEUE,
				)

	loop = asyncio.new_event_loop()
	try:
		with pytest.raises(WorkflowFailureError):
			loop.run_until_complete(_run())
	finally:
		loop.close()
