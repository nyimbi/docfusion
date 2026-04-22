"""Orchestrates a proposal draft from an RFP's compliance matrix."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from docfusion.agents.specialists.compliance_agent import ComplianceAgent
from docfusion.agents.specialists.reviewer_agent import ReviewerAgent, ReviewTask
from docfusion.agents.specialists.writer_agent import WriterAgent, WritingTask
from docfusion.rfp.compliance_matrix import (
    ComplianceMatrix,
    ComplianceMatrixGenerator,
    ComplianceStatus,
    RequirementCategory,
    RequirementMapping,
    RequirementType,
)


class ProposalDraft:
    """Result of a proposal orchestration run."""

    def __init__(
        self,
        rfp_id: str,
        sections: dict[str, str],
        review_feedback: list[dict[str, Any]],
        compliance_diff: dict[str, Any],
    ) -> None:
        self.rfp_id = rfp_id
        self.sections = sections
        self.review_feedback = review_feedback
        self.compliance_diff = compliance_diff


class ProposalOrchestrator:
    """Wires writer + reviewer + compliance agents over a compliance matrix."""

    def __init__(
        self,
        writer: WriterAgent | None = None,
        reviewer: ReviewerAgent | None = None,
        compliance: ComplianceAgent | None = None,
    ) -> None:
        self._writer = writer or WriterAgent()
        self._reviewer = reviewer or ReviewerAgent()
        self._compliance = compliance or ComplianceAgent()

    async def draft_proposal(self, rfp_id: str, session: AsyncSession) -> ProposalDraft:
        """Orchestrate a full draft for the given RFP."""
        assert rfp_id, "rfp_id required"

        # 1. Load the compliance matrix produced in Phase 2.
        matrix = await self._load_latest_matrix(rfp_id, session)

        # 2. Writer drafts one section per requirement category.
        sections = await self._draft_sections(matrix)

        # 3. Reviewer critiques the drafts.
        review = await self._review_drafts(sections, matrix)

        # 4. Compliance agent runs a draft-vs-matrix diff.
        compliance_diff = await self._compliance.check_draft_against_matrix(
            draft_sections=sections,
            matrix=matrix,
        )

        assert isinstance(sections, dict) and sections
        return ProposalDraft(rfp_id, sections, review, compliance_diff)

    async def _load_latest_matrix(self, rfp_id: str, session: AsyncSession) -> ComplianceMatrix:
        row = (await session.execute(
            text("""
                SELECT id FROM compliance_matrices
                WHERE opportunity_id = :rid ORDER BY updated_at DESC LIMIT 1
            """),
            {"rid": rfp_id},
        )).mappings().first()
        if row is None:
            raise ValueError(f"No compliance matrix for RFP {rfp_id}")
        return await ComplianceMatrixGenerator.load_from_db(str(row["id"]), session)

    async def _draft_sections(
        self,
        matrix: ComplianceMatrix,
    ) -> dict[str, str]:
        sections: dict[str, str] = {}
        categories: dict[str, list[RequirementMapping]] = {}
        for entry in matrix.mappings:
            cat = self._category_for(entry)
            categories.setdefault(cat, []).append(entry)

        for category, entries in categories.items():
            task = WritingTask(
                task_id=f"section-{category}",
                content_type="proposal",
                topic=f"{category} section",
                requirements={
                    "category": category,
                    "entries": [
                        {
                            "text": e.requirement_text,
                            "type": e.requirement_type.value if e.requirement_type else "unknown",
                        }
                        for e in entries
                    ],
                },
            )
            result = await self._writer.process_task(task)
            sections[category] = result.generated_content.get("main_content", "")
        return sections

    async def _review_drafts(
        self,
        sections: dict[str, str],
        matrix: ComplianceMatrix,
    ) -> list[dict[str, Any]]:
        feedback: list[dict[str, Any]] = []
        for category, content in sections.items():
            task = ReviewTask(
                task_id=f"review-{category}",
                content=content,
                review_type="comprehensive",
                criteria={},
                standards=self._reviewer.review_standards,
            )
            result = await self._reviewer.process_task(task)
            feedback.append({
                "category": category,
                "feedback": {
                    "overall_score": result.overall_score,
                    "approved": result.approved,
                    "suggestions": [s.get("description", "") for s in result.improvement_suggestions],
                },
            })
        return feedback

    def _category_for(self, entry: RequirementMapping) -> str:
        if entry.category:
            return entry.category.value
        return "general"
