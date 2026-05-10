"""Temporal workflow for RFP parsing.

The workflow is a thin orchestration shim: it forwards the tenant
context to the ``run_rfp_parse`` activity and applies a retry policy
suited to the parse pipeline (long DB-bound work that occasionally
trips on transient network/AI failures, but should never retry on
bad input).

Activity vs. workflow boundary:
  * The workflow is deterministic — never imports SQLAlchemy, never
    touches the filesystem.
  * All side effects live inside the activity (see
    :mod:`activities`). That's why the activity import sits inside
    ``workflow.unsafe.imports_passed_through`` — Temporal allows
    non-deterministic dependencies to be referenced from a workflow
    file as long as we promise we only invoke them via the activity
    boundary.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
	from .activities import RfpParseInput, RfpParseResult, run_rfp_parse


@dataclass
class RfpParseWorkflowInput:
	"""Workflow input — mirrors :class:`RfpParseInput` plus user_id.

	``user_id`` is forwarded so the activity can stamp audit fields if
	we ever add them to the parse pipeline. It is **not** an auth
	credential — the BFF + FastAPI layer is responsible for proving
	the user is allowed to enqueue a parse before this workflow is
	started.
	"""

	rfp_id: str
	organization_id: str
	user_id: str


@workflow.defn(name="RfpParseWorkflow")
class RfpParseWorkflow:
	"""Single-step workflow that drives :func:`run_rfp_parse`.

	The retry policy is intentionally conservative:

	  * 30s initial interval — gives transient analyzer/AI hiccups
	    time to clear without burning workflow history.
	  * 5 min max interval — caps the back-off on persistent flakes.
	  * 3 attempts — ``RfpDocumentNotFoundError`` and
	    ``RfpStagedBytesMissingError`` are already non-retryable from
	    inside the activity, so this only affects soft failures.
	"""

	@workflow.run
	async def run(self, input: RfpParseWorkflowInput) -> RfpParseResult:
		return await workflow.execute_activity(
			run_rfp_parse,
			RfpParseInput(
				rfp_id=input.rfp_id,
				organization_id=input.organization_id,
				user_id=input.user_id,
			),
			start_to_close_timeout=timedelta(minutes=30),
			retry_policy=RetryPolicy(
				initial_interval=timedelta(seconds=30),
				maximum_interval=timedelta(minutes=5),
				maximum_attempts=3,
			),
		)
