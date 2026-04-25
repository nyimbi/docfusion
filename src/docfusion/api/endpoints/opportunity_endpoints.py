#!/usr/bin/env python3
"""FastAPI endpoints for opportunity management.

Uses raw SQL via SQLAlchemy async sessions to query the PostgreSQL
opportunities table (schema-managed by Drizzle ORM on the frontend).
"""

from __future__ import annotations

import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database.session import get_async_db_session
from ...core.utils import uuid7str
from ...rfp.rfp_analyzer import RFPAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/opportunities", tags=["opportunities"])


# ============================================================================
# Request / Response Models
# ============================================================================

class OpportunityListItem(BaseModel):
	"""Lightweight opportunity for list views."""
	model_config = ConfigDict(extra="ignore")

	id: str
	source_id: Optional[str] = None
	title: str
	category: Optional[str] = None
	country_region: Optional[str] = None
	organization: Optional[str] = None
	deadline: Optional[str] = None
	days_left: Optional[int] = None
	is_expired: bool
	budget_value: Optional[str] = None
	priority_rank: int
	fit_score: Optional[float] = None
	decision_status: str
	assigned_to: Optional[str] = None
	tags: List[str] = Field(default_factory=list)
	rfp_link: Optional[str] = None


class OpportunityDetail(BaseModel):
	"""Full opportunity detail."""
	model_config = ConfigDict(extra="ignore")

	id: str
	source_id: Optional[str] = None
	title: str
	category: Optional[str] = None
	it_category: Optional[str] = None
	sector: Optional[str] = None
	country_region: Optional[str] = None
	organization: Optional[str] = None
	funder: Optional[str] = None
	deadline: Optional[str] = None
	days_left: Optional[int] = None
	is_expired: bool
	budget_value: Optional[str] = None
	budget_numeric: Optional[float] = None
	budget_currency: Optional[str] = None
	project_summary: Optional[str] = None
	project_scope: Optional[str] = None
	key_requirements: Optional[str] = None
	technical_requirements: Optional[str] = None
	submission_method: Optional[str] = None
	submission_requirements: Optional[str] = None
	rfp_link: Optional[str] = None
	source_platform: Optional[str] = None
	source_file: Optional[str] = None
	opportunity_type: str = "rfp"
	priority_rank: int = 3
	fit_score: Optional[float] = None
	win_probability: Optional[float] = None
	revenue_potential: Optional[str] = None
	strategic_notes: Optional[str] = None
	decision_status: str = "pending"
	decision_reason: Optional[str] = None
	assigned_to: Optional[str] = None
	is_reviewed: bool = False
	tags: List[str] = Field(default_factory=list)
	notes: Optional[str] = None
	created_at: Optional[str] = None
	updated_at: Optional[str] = None


class OpportunityListResponse(BaseModel):
	"""Paginated list response."""
	data: List[OpportunityListItem]
	total: int
	page: int
	page_size: int
	total_pages: int


class StatusUpdateRequest(BaseModel):
	"""Request to update opportunity status."""
	model_config = ConfigDict(extra="forbid")
	decision_status: str
	decision_reason: Optional[str] = None


class PriorityUpdateRequest(BaseModel):
	"""Request to update opportunity priority."""
	model_config = ConfigDict(extra="forbid")
	priority_rank: int = Field(ge=1, le=5)


class AIScoreResponse(BaseModel):
	"""Response from AI scoring."""
	model_config = ConfigDict(extra="forbid")
	opportunity_id: str
	fit_score: float
	win_probability: float
	factors: List[dict[str, Any]]
	reasoning: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def _row_to_list_item(row: Any) -> OpportunityListItem:
	"""Convert a DB row to OpportunityListItem."""
	return OpportunityListItem(
		id=str(row.id),
		source_id=row.source_id,
		title=row.title,
		category=row.category,
		country_region=row.country_region,
		organization=row.organization,
		deadline=row.deadline.isoformat() if row.deadline else None,
		days_left=row.days_left,
		is_expired=row.is_expired or False,
		budget_value=row.budget_value,
		priority_rank=row.priority_rank or 3,
		fit_score=float(row.fit_score) if row.fit_score is not None else None,
		decision_status=row.decision_status or "pending",
		assigned_to=row.assigned_to,
		tags=row.tags or [],
		rfp_link=row.rfp_link,
	)


def _row_to_detail(row: Any) -> OpportunityDetail:
	"""Convert a DB row to OpportunityDetail."""
	return OpportunityDetail(
		id=str(row.id),
		source_id=row.source_id,
		title=row.title,
		category=row.category,
		it_category=row.it_category,
		sector=row.sector,
		country_region=row.country_region,
		organization=row.organization,
		funder=row.funder,
		deadline=row.deadline.isoformat() if row.deadline else None,
		days_left=row.days_left,
		is_expired=row.is_expired or False,
		budget_value=row.budget_value,
		budget_numeric=float(row.budget_numeric) if row.budget_numeric is not None else None,
		budget_currency=row.budget_currency,
		project_summary=row.project_summary,
		project_scope=row.project_scope,
		key_requirements=row.key_requirements,
		technical_requirements=row.technical_requirements,
		submission_method=row.submission_method,
		submission_requirements=row.submission_requirements,
		rfp_link=row.rfp_link,
		source_platform=row.source_platform,
		source_file=row.source_file,
		opportunity_type=row.opportunity_type or "rfp",
		priority_rank=row.priority_rank or 3,
		fit_score=float(row.fit_score) if row.fit_score is not None else None,
		win_probability=float(row.win_probability) if row.win_probability is not None else None,
		revenue_potential=row.revenue_potential,
		strategic_notes=row.strategic_notes,
		decision_status=row.decision_status or "pending",
		decision_reason=row.decision_reason,
		assigned_to=row.assigned_to,
		is_reviewed=row.is_reviewed or False,
		tags=row.tags or [],
		notes=row.notes,
		created_at=row.created_at.isoformat() if row.created_at else None,
		updated_at=row.updated_at.isoformat() if row.updated_at else None,
	)


# ============================================================================
# Endpoints
# ============================================================================

@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
	db: AsyncSession = Depends(get_async_db_session),
	search: Optional[str] = Query(None, description="Full-text search query"),
	decision_status: Optional[str] = Query(None, description="Filter by decision status"),
	category: Optional[str] = Query(None, description="Filter by category"),
	country_region: Optional[str] = Query(None, description="Filter by country/region"),
	organization: Optional[str] = Query(None, description="Filter by organization"),
	priority_min: Optional[int] = Query(None, ge=1, le=5),
	priority_max: Optional[int] = Query(None, ge=1, le=5),
	fit_score_min: Optional[float] = Query(None, ge=0, le=100),
	fit_score_max: Optional[float] = Query(None, ge=0, le=100),
	sort_field: str = Query("deadline", description="Field to sort by"),
	sort_direction: str = Query("asc", description="Sort direction: asc or desc"),
	page: int = Query(1, ge=1, description="Page number"),
	page_size: int = Query(25, ge=1, le=100, description="Items per page"),
) -> OpportunityListResponse:
	"""List opportunities with filtering, sorting, and pagination."""
	# Build WHERE clauses
	where_clauses: List[str] = ["is_expired = false"]
	params: dict[str, Any] = {}

	if search:
		where_clauses.append(
			"(search_vector @@ plainto_tsquery('english', :search) OR "
			"title ILIKE :search_like OR organization ILIKE :search_like)"
		)
		params["search"] = search
		params["search_like"] = f"%{search}%"

	if decision_status:
		where_clauses.append("decision_status = :decision_status")
		params["decision_status"] = decision_status

	if category:
		where_clauses.append("category = :category")
		params["category"] = category

	if country_region:
		where_clauses.append("country_region = :country_region")
		params["country_region"] = country_region

	if organization:
		where_clauses.append("organization ILIKE :organization")
		params["organization"] = f"%{organization}%"

	if priority_min is not None:
		where_clauses.append("priority_rank >= :priority_min")
		params["priority_min"] = priority_min

	if priority_max is not None:
		where_clauses.append("priority_rank <= :priority_max")
		params["priority_max"] = priority_max

	if fit_score_min is not None:
		where_clauses.append("fit_score >= :fit_score_min")
		params["fit_score_min"] = fit_score_min

	if fit_score_max is not None:
		where_clauses.append("fit_score <= :fit_score_max")
		params["fit_score_max"] = fit_score_max

	where_sql = " AND ".join(where_clauses)

	# Validate sort field to prevent SQL injection
	allowed_sort_fields = {
		"deadline", "priority_rank", "fit_score", "budget_numeric",
		"title", "organization", "category", "country_region", "created_at", "updated_at"
	}
	if sort_field not in allowed_sort_fields:
		sort_field = "deadline"
	sort_dir = "DESC" if sort_direction.lower() == "desc" else "ASC"

	# Count query
	count_sql = text(f"SELECT COUNT(*) FROM opportunities WHERE {where_sql}")
	count_result = await db.execute(count_sql, params)
	total = count_result.scalar() or 0

	# Data query
	params["limit"] = page_size
	params["offset"] = (page - 1) * page_size

	data_sql = text(
		f"""
		SELECT
			id, source_id, title, category, country_region, organization,
			deadline, days_left, is_expired, budget_value, priority_rank,
			fit_score, decision_status, assigned_to, tags, rfp_link
		FROM opportunities
		WHERE {where_sql}
		ORDER BY {sort_field} {sort_dir}
		LIMIT :limit OFFSET :offset
		"""
	)
	result = await db.execute(data_sql, params)
	rows = result.all()

	items = [_row_to_list_item(row) for row in rows]
	total_pages = (total + page_size - 1) // page_size

	return OpportunityListResponse(
		data=items,
		total=total,
		page=page,
		page_size=page_size,
		total_pages=total_pages,
	)


@router.get("/{opportunity_id}", response_model=OpportunityDetail)
async def get_opportunity(
	opportunity_id: str,
	db: AsyncSession = Depends(get_async_db_session),
) -> OpportunityDetail:
	"""Get a single opportunity by ID."""
	sql = text("""
		SELECT * FROM opportunities WHERE id = :opportunity_id LIMIT 1
	""")
	result = await db.execute(sql, {"opportunity_id": opportunity_id})
	row = result.first()

	if not row:
		raise HTTPException(status_code=404, detail="Opportunity not found")

	return _row_to_detail(row)


@router.patch("/{opportunity_id}/status")
async def update_opportunity_status(
	opportunity_id: str,
	request: StatusUpdateRequest,
	db: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
	"""Update an opportunity's decision status."""
	valid_statuses = {
		"pending", "interested", "shortlisted", "pursuing",
		"submitted", "won", "lost", "declined", "expired"
	}
	if request.decision_status not in valid_statuses:
		raise HTTPException(
			status_code=400,
			detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
		)

	sql = text("""
		UPDATE opportunities
		SET decision_status = :status, decision_reason = :reason, updated_at = NOW()
		WHERE id = :opportunity_id
		RETURNING id
	""")
	result = await db.execute(sql, {
		"opportunity_id": opportunity_id,
		"status": request.decision_status,
		"reason": request.decision_reason,
	})
	row = result.first()
	if not row:
		raise HTTPException(status_code=404, detail="Opportunity not found")

	await db.commit()
	return {
		"id": opportunity_id,
		"decision_status": request.decision_status,
		"updated": True,
	}


@router.patch("/{opportunity_id}/priority")
async def update_opportunity_priority(
	opportunity_id: str,
	request: PriorityUpdateRequest,
	db: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
	"""Update an opportunity's priority rank."""
	sql = text("""
		UPDATE opportunities
		SET priority_rank = :priority, updated_at = NOW()
		WHERE id = :opportunity_id
		RETURNING id
	""")
	result = await db.execute(sql, {
		"opportunity_id": opportunity_id,
		"priority": request.priority_rank,
	})
	row = result.first()
	if not row:
		raise HTTPException(status_code=404, detail="Opportunity not found")

	await db.commit()
	return {
		"id": opportunity_id,
		"priority_rank": request.priority_rank,
		"updated": True,
	}


@router.post("/{opportunity_id}/analyze", response_model=AIScoreResponse)
async def analyze_opportunity(
	opportunity_id: str,
	db: AsyncSession = Depends(get_async_db_session),
) -> AIScoreResponse:
	"""Run AI analysis on an opportunity and store scores."""
	# Fetch opportunity text
	sql = text("""
		SELECT title, project_summary, key_requirements, technical_requirements
		FROM opportunities WHERE id = :opportunity_id LIMIT 1
	""")
	result = await db.execute(sql, {"opportunity_id": opportunity_id})
	row = result.first()
	if not row:
		raise HTTPException(status_code=404, detail="Opportunity not found")

	text_to_analyze = " ".join(filter(None, [
		row.title, row.project_summary, row.key_requirements, row.technical_requirements
	]))

	# Run RFP analyzer
	analyzer = RFPAnalyzer(config={"ai_enhancement": True})
	analysis = await analyzer.analyze_text(text_to_analyze)

	# Derive scores from analysis
	fit_score = 50.0
	win_probability = 50.0
	factors: List[dict[str, Any]] = []

	if analysis.success:
		# Fit score based on requirement count and compliance indicators
		req_count = len(analysis.requirements)
		compliance_score = len(analysis.compliance_indicators)
		fit_score = min(100.0, max(0.0, 30.0 + req_count * 2.0 + compliance_score * 5.0))

		# Win probability based on risk assessment
		risk_level = analysis.risk_assessment.get("overall_risk", "medium")
		risk_map = {"low": 75.0, "medium": 50.0, "high": 25.0}
		win_probability = risk_map.get(risk_level, 50.0)

		factors = [
			{
				"factor": "requirement_complexity",
				"impact": "positive" if req_count < 20 else "neutral" if req_count < 50 else "negative",
				"weight": 0.3,
				"score": min(100.0, req_count * 2.0),
				"rationale": f"{req_count} requirements identified",
			},
			{
				"factor": "compliance_burden",
				"impact": "positive" if compliance_score < 3 else "negative",
				"weight": 0.2,
				"score": min(100.0, compliance_score * 15.0),
				"rationale": f"{compliance_score} compliance frameworks required",
			},
			{
				"factor": "risk_level",
				"impact": "positive" if risk_level == "low" else "negative" if risk_level == "high" else "neutral",
				"weight": 0.5,
				"score": win_probability,
				"rationale": f"Overall risk assessed as {risk_level}",
			},
		]

	# Store scores in database
	insert_sql = text("""
		INSERT INTO opportunity_ai_scores
		(opportunity_id, score_type, score, factors, reasoning, model_version)
		VALUES
		(:opportunity_id, 'fit', :fit_score, :factors, :reasoning, 'rfp_analyzer_v1'),
		(:opportunity_id, 'win_probability', :win_probability, :factors, :reasoning, 'rfp_analyzer_v1')
		ON CONFLICT DO NOTHING
	""")
	await db.execute(insert_sql, {
		"opportunity_id": opportunity_id,
		"fit_score": fit_score,
		"win_probability": win_probability,
		"factors": factors,
		"reasoning": analysis.compliance_narrative or "Analysis complete",
	})

	# Update opportunity fit_score and win_probability
	update_sql = text("""
		UPDATE opportunities
		SET fit_score = :fit_score, win_probability = :win_probability, updated_at = NOW()
		WHERE id = :opportunity_id
	""")
	await db.execute(update_sql, {
		"opportunity_id": opportunity_id,
		"fit_score": fit_score,
		"win_probability": win_probability,
	})
	await db.commit()

	return AIScoreResponse(
		opportunity_id=opportunity_id,
		fit_score=fit_score,
		win_probability=win_probability,
		factors=factors,
		reasoning=analysis.compliance_narrative,
	)


@router.get("/{opportunity_id}/scores")
async def get_opportunity_scores(
	opportunity_id: str,
	db: AsyncSession = Depends(get_async_db_session),
) -> List[dict[str, Any]]:
	"""Get all AI scores for an opportunity."""
	sql = text("""
		SELECT score_type, score, factors, reasoning, model_version, created_at
		FROM opportunity_ai_scores
		WHERE opportunity_id = :opportunity_id
		ORDER BY created_at DESC
	""")
	result = await db.execute(sql, {"opportunity_id": opportunity_id})
	rows = result.all()

	return [
		{
			"score_type": row.score_type,
			"score": float(row.score) if row.score is not None else None,
			"factors": row.factors or [],
			"reasoning": row.reasoning,
			"model_version": row.model_version,
			"created_at": row.created_at.isoformat() if row.created_at else None,
		}
		for row in rows
	]
