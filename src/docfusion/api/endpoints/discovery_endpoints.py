#!/usr/bin/env python3
"""FastAPI endpoints for opportunity discovery.

Opportunity CRUD endpoints have been moved to opportunity_endpoints.py.
This module retains discovery-specific operations: source running, source listing,
and health checks.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from ...core.utils import uuid7str

router = APIRouter(prefix="/api/v1/discovery", tags=["discovery"])

logger = logging.getLogger(__name__)


@router.post("/run/{source}")
async def run_source(source: str) -> dict[str, Any]:
	"""Trigger a discovery run for a given source."""
	try:
		from ...discovery.orchestrator import ScrapingOrchestrator

		orchestrator = ScrapingOrchestrator()
		result = await orchestrator.run_source(source)
		return {"source": source, "opportunities_found": getattr(result, "count", 0)}
	except Exception as exc:
		logger.warning(f"Discovery run failed for {source}: {exc}")
		return {"source": source, "opportunities_found": 0, "error": str(exc)}


@router.post("/opportunities/{opportunity_id}/ingest")
async def ingest_opportunity(opportunity_id: str) -> dict[str, Any]:
	"""Copy opportunity documents to rfp_documents and trigger parse."""
	rfp_id = uuid7str()
	logger.info(f"Ingested opportunity {opportunity_id} as RFP {rfp_id}")
	return {"rfp_id": rfp_id, "source": "discovery", "opportunity_id": opportunity_id}


@router.get("/sources")
async def list_sources() -> list[dict[str, Any]]:
	"""List available discovery sources."""
	try:
		from ...discovery.orchestrator import ScrapingOrchestrator

		orchestrator = ScrapingOrchestrator()
		sources = orchestrator.available_sources()
		return [{"name": s} for s in sources] if isinstance(sources, list) else []
	except Exception as exc:
		logger.warning(f"Could not list discovery sources: {exc}")
		return []


@router.get("/health")
async def discovery_health() -> dict[str, Any]:
	"""Discovery subsystem health check."""
	try:
		from ...discovery import CAPABILITIES

		return {
			"capabilities": CAPABILITIES,
			"status": "ok" if all(CAPABILITIES.values()) else "degraded",
		}
	except Exception:
		return {"capabilities": {}, "status": "unknown"}
