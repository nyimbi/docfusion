"""
Opportunity Data Models

Canonical data model for procurement opportunities used across the discovery
and intelligence modules. This module is the single source of truth for
the OpportunityData schema -- both discovery/ and intelligence/ import from
here, which breaks the circular dependency that would otherwise occur if
either module defined the model and the other tried to import it.

Fields are derived from the union of all access patterns across:
  - discovery/analyzers/opportunity_analyzer.py
  - discovery/analyzers/qualification_analyzer.py
  - discovery/matchers/relevance_filter.py
  - discovery/integrations/notification_service.py
  - discovery/integrations/nlp_integration.py
  - discovery/integrations/storage_integration.py
  - intelligence/integrations/discovery_integration.py
  - intelligence/analyzers/competitive_analyzer.py
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict


class OpportunityData(BaseModel):
	"""
	Core opportunity data model shared across discovery and intelligence modules.

	Represents a single procurement / RFP opportunity with all the metadata
	needed for analysis, qualification, competitive intelligence, and storage.
	Uses extra='allow' to tolerate ad-hoc attributes added during pipeline
	processing without requiring a schema migration every time a new analyzer
	attaches transient data.
	"""

	model_config = ConfigDict(
		extra="allow",
		validate_by_name=True,
		validate_by_alias=True,
	)

	# -- Identity ----------------------------------------------------------
	id: str = Field(
		default_factory=lambda: str(uuid4()),
		description="Unique opportunity identifier",
	)

	# -- Core content ------------------------------------------------------
	title: str = Field(description="Opportunity title / solicitation name")
	description: str = Field(
		default="",
		description="Full description of the opportunity",
	)
	requirements: str = Field(
		default="",
		description="Stated requirements (certifications, experience, etc.)",
	)
	scope_of_work: str = Field(
		default="",
		description="Scope of work narrative",
	)

	# -- Financial ---------------------------------------------------------
	estimated_value: Optional[float] = Field(
		None,
		description="Estimated contract value in USD",
	)

	# -- Timeline ----------------------------------------------------------
	submission_deadline: Optional[datetime] = Field(
		None,
		description="Proposal submission deadline",
	)
	publication_date: Optional[datetime] = Field(
		None,
		description="Date the opportunity was published / discovered",
	)

	# -- Classification ----------------------------------------------------
	industry: Optional[str] = Field(
		None,
		description="Industry sector (e.g. 'IT', 'Healthcare')",
	)
	status: Optional[str] = Field(
		None,
		description="Opportunity lifecycle status (e.g. 'open', 'closed')",
	)
	source: Optional[str] = Field(
		None,
		description="Originating source (website, feed, etc.)",
	)
	source_url: Optional[str] = Field(
		None,
		description="URL where the opportunity was found",
	)

	# -- Attachments / supplementary docs ----------------------------------
	documents: List[Dict[str, Any]] = Field(
		default_factory=list,
		description=(
			"Attached or referenced documents. Each dict should contain "
			"at minimum a 'content' key with the extracted text."
		),
	)

	# -- Extensible metadata -----------------------------------------------
	tags: List[str] = Field(
		default_factory=list,
		description="Free-form tags for categorisation",
	)
