"""Temporal worker entry point for the RFP parse pool.

Run with::

	uv run python -m docfusion.workers.rfp_parse.worker

The worker registers :class:`RfpParseWorkflow` and the
:func:`run_rfp_parse` activity against the ``rfp-parse`` task queue
defined in :mod:`client`. Long-lived process — let your service
manager (systemd, k8s Deployment, etc.) restart it on crash.

Requires the Temporal cluster reachable at ``TEMPORAL_ADDRESS``
(default ``localhost:7233``).
"""

from __future__ import annotations

import asyncio
import logging

from temporalio.worker import Worker

from .activities import run_rfp_parse
from .client import TASK_QUEUE, get_temporal_client
from .workflow import RfpParseWorkflow

logger = logging.getLogger(__name__)


async def main() -> None:
	"""Boot the RFP parse worker and block on the run loop."""
	logging.basicConfig(level=logging.INFO)
	client = await get_temporal_client()
	worker = Worker(
		client,
		task_queue=TASK_QUEUE,
		workflows=[RfpParseWorkflow],
		activities=[run_rfp_parse],
	)
	logger.info("RFP parse worker starting on task queue %s", TASK_QUEUE)
	await worker.run()


if __name__ == "__main__":
	asyncio.run(main())
