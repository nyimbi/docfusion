"""End-to-end proposal orchestration tests."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, PropertyMock

import pytest
from sqlalchemy import text

from docfusion.agents.specialists.compliance_agent import ComplianceAgent
from docfusion.agents.specialists.reviewer_agent import ReviewerAgent
from docfusion.agents.specialists.writer_agent import WriterAgent
from docfusion.orchestration.proposal_orchestrator import (
    ProposalDraft,
    ProposalOrchestrator,
)
from docfusion.rfp.compliance_matrix import (
    ComplianceMatrix,
    ComplianceMatrixGenerator,
    ComplianceStatus,
    RequirementModality,
    RequirementMapping,
    RequirementType,
)


class _MockResult:
    """Mock SQLAlchemy result with .mappings()."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def mappings(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


@pytest.fixture
def mock_session():
    """Return an AsyncMock SQLAlchemy session preconfigured for matrix ops."""
    session = AsyncMock()

    async def _execute(stmt, params=None):
        sql = str(stmt)
        if "compliance_matrices" in sql and "SELECT" in sql and "opportunity_id" in sql:
            return _MockResult([{"id": "matrix-test-uuid"}])
        if "compliance_matrices" in sql and "SELECT" in sql and "id =" in sql:
            return _MockResult([{
                "id": "matrix-test-uuid",
                "opportunity_id": "rfp-draft-test",
                "name": "Test Matrix",
                "description": "",
                "metadata": {},
                "created_at": "2026-04-22T00:00:00",
                "updated_at": "2026-04-22T00:00:00",
            }])
        if "compliance_entries" in sql:
            return _MockResult([])
        return _MockResult([])

    session.execute = _execute
    session.commit = AsyncMock(return_value=None)
    return session


@pytest.fixture
def sample_matrix():
    """Build a ComplianceMatrix with two categories."""
    matrix = ComplianceMatrix(
        id="matrix-test-uuid",
        rfp_id="rfp-draft-test",
        name="Test Matrix",
    )
    matrix.mappings = [
        RequirementMapping(
            requirement_id="req-1",
            requirement_text="The contractor shall provide 24/7 support.",
            modality=RequirementModality.MANDATORY,
            requirement_type=RequirementType.FUNCTIONAL,
            status=ComplianceStatus.NOT_ADDRESSED,
        ),
        RequirementMapping(
            requirement_id="req-2",
            requirement_text="The system must support SAML SSO.",
            modality=RequirementModality.MANDATORY,
            requirement_type=RequirementType.SECURITY,
            status=ComplianceStatus.NOT_ADDRESSED,
        ),
    ]
    return matrix


async def test_draft_proposal_produces_sections(mock_session, sample_matrix):
    """Full orchestration: writer → reviewer → compliance on a sample matrix."""
    # Seed the ComplianceMatrixGenerator in-memory cache so load_from_db
    # can reconstruct the matrix without a real DB round-trip for entries.
    # We monkey-patch load_from_db to return our sample matrix.
    original_load = ComplianceMatrixGenerator.load_from_db

    async def _mock_load(mid, session):
        return sample_matrix

    ComplianceMatrixGenerator.load_from_db = staticmethod(_mock_load)

    try:
        orchestrator = ProposalOrchestrator()
        draft = await orchestrator.draft_proposal("rfp-draft-test", mock_session)

        assert isinstance(draft, ProposalDraft)
        assert draft.rfp_id == "rfp-draft-test"
        # The matrix has 2 mappings but only one category (mandatory),
        # so we expect one section keyed by "mandatory".
        assert "mandatory" in draft.sections
        assert draft.sections["mandatory"]  # non-empty string

        # Reviewer produces one feedback item per section.
        assert len(draft.review_feedback) == len(draft.sections)
        feedback = draft.review_feedback[0]
        assert feedback["category"] == "mandatory"
        assert "overall_score" in feedback["feedback"]

        # Compliance diff is populated.
        assert draft.compliance_diff is not None
        assert draft.compliance_diff["total_requirements"] == 2
        assert draft.compliance_diff["results"]
    finally:
        ComplianceMatrixGenerator.load_from_db = original_load


async def test_load_latest_matrix_missing_raises(mock_session):
    """If no matrix exists for the RFP, draft_proposal raises ValueError."""
    # Override execute to return no matrix row.
    async def _no_matrix(stmt, params=None):
        return _MockResult([])

    mock_session.execute = _no_matrix

    orchestrator = ProposalOrchestrator()
    with pytest.raises(ValueError, match="No compliance matrix"):
        await orchestrator.draft_proposal("missing-rfp", mock_session)


async def test_compliance_check_draft_against_matrix():
    """ComplianceAgent.check_draft_against_matrix detects coverage."""
    agent = ComplianceAgent()
    matrix = ComplianceMatrix(
        id="m1",
        rfp_id="r1",
        name="M",
    )
    matrix.mappings = [
        RequirementMapping(
            requirement_id="r1",
            requirement_text="24/7 support",
            modality=RequirementModality.MANDATORY,
        ),
        RequirementMapping(
            requirement_id="r2",
            requirement_text="SAML SSO",
            modality=RequirementModality.MANDATORY,
        ),
    ]

    # Draft that mentions only one requirement.
    diff = await agent.check_draft_against_matrix(
        draft_sections={"support": "We provide 24/7 support."},
        matrix=matrix,
    )

    assert diff["total_requirements"] == 2
    assert diff["covered"] == 1
    assert diff["missing"] == 1
    assert diff["coverage_ratio"] == 0.5
    assert len(diff["results"]) == 2


async def test_orchestrator_injects_custom_agents():
    """ProposalOrchestrator accepts injected agent instances."""
    writer = WriterAgent()
    reviewer = ReviewerAgent()
    compliance = ComplianceAgent()

    orch = ProposalOrchestrator(
        writer=writer,
        reviewer=reviewer,
        compliance=compliance,
    )
    assert orch._writer is writer
    assert orch._reviewer is reviewer
    assert orch._compliance is compliance
