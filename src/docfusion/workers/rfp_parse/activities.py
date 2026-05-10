"""Temporal activities for the RFP parse workflow.

The activity is a thin wrapper around
:func:`docfusion.rfp.parse_pipeline.execute_parse_pipeline`. The
pipeline is the same DB-backed code path the FastAPI ``/parse``
handler used to run inline — by W3c it is the *only* implementation
both the route and the worker call.

The activity is deliberately stateless: it takes the tenant context
on every invocation (``rfp_id`` + ``organization_id`` + ``user_id``)
and never reads ambient request state. A worker thread that picked
this up has no auth context to lean on, so we pass it explicitly.
Persisted writes inside the pipeline are scoped by ``organization_id``
end-to-end.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ...core.database.session import get_async_db_session
from ...rfp.parse_pipeline import (
	RfpDocumentNotFoundError,
	RfpStagedBytesMissingError,
	execute_parse_pipeline,
)

logger = logging.getLogger(__name__)


@dataclass
class RfpParseInput:
	"""Input contract for :func:`run_rfp_parse`.

	Carries the tenant identity explicitly because the activity has no
	implicit request scope. The workflow forwards these straight from
	its own input.
	"""

	rfp_id: str
	organization_id: str
	user_id: str


@dataclass
class RfpParseResult:
	"""Result contract returned to the workflow.

	``status`` is one of ``"completed"`` or ``"failed"``. The workflow
	usually returns this verbatim to the client; the FastAPI route
	doesn't poll the workflow result, but other future callers might.
	"""

	rfp_id: str
	requirements_extracted: int
	status: str


@activity.defn(name="run_rfp_parse")
async def run_rfp_parse(input: RfpParseInput) -> RfpParseResult:
	"""Execute the RFP parse pipeline against ``input.rfp_id``.

	Acquires a fresh async DB session for the activity invocation —
	Temporal does not own the session lifecycle, so we mirror the
	``yield``-style dependency the FastAPI side uses.

	Domain errors are converted to non-retryable
	:class:`ApplicationError` instances so the workflow's retry policy
	doesn't waste attempts on missing rows or missing bytes:

	  * :class:`RfpDocumentNotFoundError` -> ``rfp_not_found`` (non-retryable)
	  * :class:`RfpStagedBytesMissingError` -> ``rfp_bytes_missing`` (non-retryable)

	Any other exception bubbles up so Temporal applies the configured
	retry policy.
	"""
	assert input.rfp_id, "RfpParseInput.rfp_id is required"
	assert input.organization_id, "RfpParseInput.organization_id is required"

	logger.info(
		"run_rfp_parse start rfp_id=%s org=%s user=%s",
		input.rfp_id,
		input.organization_id,
		input.user_id,
	)

	# ``get_async_db_session`` is an async generator that owns the
	# session lifecycle. Drive it manually so the activity stays a
	# regular async function and Temporal can inspect the return type.
	session_gen = get_async_db_session()
	session = await session_gen.__anext__()
	try:
		try:
			result = await execute_parse_pipeline(
				session,
				rfp_id=input.rfp_id,
				organization_id=input.organization_id,
			)
		except RfpDocumentNotFoundError as exc:
			# Non-retryable: re-running won't conjure the row back.
			raise ApplicationError(
				str(exc),
				type="rfp_not_found",
				non_retryable=True,
			) from exc
		except RfpStagedBytesMissingError as exc:
			# Non-retryable: bytes won't reappear without a fresh upload.
			raise ApplicationError(
				str(exc),
				type="rfp_bytes_missing",
				non_retryable=True,
			) from exc
	finally:
		# Close the generator so the session manager can release the
		# connection. Swallow StopAsyncIteration; that's the normal exit.
		try:
			await session_gen.aclose()
		except Exception:  # pragma: no cover — defensive
			logger.exception("run_rfp_parse session close failed")

	logger.info(
		"run_rfp_parse done rfp_id=%s org=%s status=%s requirements=%d",
		input.rfp_id,
		input.organization_id,
		result.status,
		result.requirements_extracted,
	)
	return RfpParseResult(
		rfp_id=result.rfp_id,
		requirements_extracted=result.requirements_extracted,
		status=result.status,
	)
