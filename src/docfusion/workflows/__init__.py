"""
DocuFusion Workflow Module

Temporal workflows for background processing and scheduled tasks.
"""

from .opportunity_digest import (
	OpportunityDigest,
	SendDigestRequest,
	ScheduleDigestRequest,
	DigestResult,
	EmailService,
	OpportunityDiscovery,
	DigestActivities,
	send_opportunity_digest,
	schedule_daily_digest,
)

__all__ = [
	"OpportunityDigest",
	"SendDigestRequest",
	"ScheduleDigestRequest",
	"DigestResult",
	"EmailService",
	"OpportunityDiscovery",
	"DigestActivities",
	"send_opportunity_digest",
	"schedule_daily_digest",
]