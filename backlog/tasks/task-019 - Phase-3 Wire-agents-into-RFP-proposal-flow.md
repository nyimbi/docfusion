---
id: task-019
title: "Phase 3: Wire agents into RFP proposal flow"
status: To Do
phase: 3
gap_ids: [master-plan-§3.6]
priority: High
dependencies: [task-013, task-014, task-015, task-016, task-017]
---

# task-019 - Phase 3: Wire agents into RFP proposal flow

## Description (the why)

Phase 2 unified the RFP ingestion path. Phase 3 tasks 014–017 made the agent subsystem real. This task connects them: WriterAgent drafts response sections from the compliance matrix, ReviewerAgent validates against requirements, ComplianceAgent runs a draft-vs-matrix diff. The integration point is a new `ProposalOrchestrator`.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/orchestration/proposal_orchestrator.py` exists.
- [ ] `ProposalOrchestrator.draft_proposal(rfp_id)` orchestrates: load matrix → WriterAgent → ReviewerAgent → ComplianceAgent → return draft + diff.
- [ ] A FastAPI endpoint `POST /api/v1/rfp/{rfp_id}/draft` triggers the orchestrator.
- [ ] End-to-end test `tests/ci/test_proposal_orchestration.py` runs the full flow against a sample compliance matrix and confirms the draft contains at least one section per requirement category.

## Implementation Plan (the how)

**Step 1: Read the specialists.**
```bash
ls src/docfusion/agents/specialists/
grep -n "class\|def generate\|def review\|def check" src/docfusion/agents/specialists/writer_agent.py | head
grep -n "class\|def review" src/docfusion/agents/specialists/reviewer_agent.py | head
grep -n "class\|def check" src/docfusion/agents/specialists/compliance_agent.py | head
```

Note the primary method each specialist exposes. You want the "main entry point" for each.

**Step 2: Create `src/docfusion/orchestration/proposal_orchestrator.py`.**

```python
"""Orchestrates a proposal draft from an RFP's compliance matrix."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from docfusion.rfp.compliance_matrix import ComplianceMatrixGenerator
from docfusion.agents.specialists.writer_agent import WriterAgent
from docfusion.agents.specialists.reviewer_agent import ReviewerAgent
from docfusion.agents.specialists.compliance_agent import ComplianceAgent


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
		self._writer = writer or WriterAgent(agent_id="proposal-writer")
		self._reviewer = reviewer or ReviewerAgent(agent_id="proposal-reviewer")
		self._compliance = compliance or ComplianceAgent(agent_id="proposal-compliance")

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

	async def _load_latest_matrix(self, rfp_id: str, session: AsyncSession) -> ComplianceMatrixGenerator:
		from sqlalchemy import text
		row = (await session.execute(
			text("""
				SELECT id FROM compliance_matrices
				WHERE rfp_id = :rid ORDER BY generated_at DESC LIMIT 1
			"""),
			{"rid": rfp_id},
		)).mappings().first()
		if row is None:
			raise ValueError(f"No compliance matrix for RFP {rfp_id}")
		return await ComplianceMatrixGenerator.load_from_db(row["id"], session)

	async def _draft_sections(
		self,
		matrix: ComplianceMatrixGenerator,
	) -> dict[str, str]:
		sections: dict[str, str] = {}
		categories: dict[str, list] = {}
		for entry in matrix.entries:
			cat = self._category_for(entry)
			categories.setdefault(cat, []).append(entry)

		for category, entries in categories.items():
			task = {
				"id": f"section-{category}",
				"prompt": self._build_section_prompt(category, entries),
			}
			result = await self._writer.process_task(task)
			if result.get("status") == "completed":
				sections[category] = result["result"]
		return sections

	async def _review_drafts(
		self,
		sections: dict[str, str],
		matrix: ComplianceMatrixGenerator,
	) -> list[dict[str, Any]]:
		feedback: list[dict[str, Any]] = []
		for category, text in sections.items():
			task = {
				"id": f"review-{category}",
				"prompt": f"Review this proposal section for quality and fit:\n\n{text}",
			}
			result = await self._reviewer.process_task(task)
			feedback.append({"category": category, "feedback": result.get("result")})
		return feedback

	def _category_for(self, entry) -> str:
		return getattr(entry, "category", None) or "general"

	def _build_section_prompt(self, category: str, entries: list) -> str:
		requirements = "\n".join(f"- {e.requirement_text}" for e in entries)
		return (
			f"Draft the '{category}' section of an RFP response addressing these "
			f"requirements:\n{requirements}"
		)
```

**Step 3: Add the FastAPI endpoint.** In `src/docfusion/api/endpoints/rfp_endpoints.py`:

```python
from docfusion.orchestration.proposal_orchestrator import ProposalOrchestrator


@router.post("/{rfp_id}/draft")
async def draft_proposal(
	rfp_id: str,
	session: AsyncSession = Depends(get_db),
) -> dict:
	orchestrator = ProposalOrchestrator()
	draft = await orchestrator.draft_proposal(rfp_id, session)
	return {
		"rfp_id": rfp_id,
		"sections": draft.sections,
		"review_feedback": draft.review_feedback,
		"compliance_diff": draft.compliance_diff,
	}
```

**Step 4: Test.**

```python
# tests/ci/test_proposal_orchestration.py
"""End-to-end proposal drafting."""

import pytest

from docfusion.orchestration.proposal_orchestrator import ProposalOrchestrator
from docfusion.rfp.compliance_matrix import ComplianceMatrixGenerator


async def test_draft_proposal_produces_sections(db_session, mock_litellm_gateway):
	matrix = ComplianceMatrixGenerator(rfp_id="rfp-draft-test", title="Test RFP")
	matrix.add_entry(requirement_text="24/7 support", category="support")
	matrix.add_entry(requirement_text="SAML SSO", category="security")
	await matrix.save_to_db(db_session)

	orchestrator = ProposalOrchestrator()
	draft = await orchestrator.draft_proposal("rfp-draft-test", db_session)

	assert "support" in draft.sections or "general" in draft.sections
	assert "security" in draft.sections or "general" in draft.sections
	assert len(draft.review_feedback) == len(draft.sections)
	assert draft.compliance_diff is not None
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_proposal_orchestration.py -vxs
git add src/docfusion/orchestration/proposal_orchestrator.py src/docfusion/api/endpoints/rfp_endpoints.py tests/ci/test_proposal_orchestration.py
git commit -m "feat(orchestration): proposal orchestrator wiring agents to RFP [master-plan-§3.6]"
```

## Notes for less-capable agents

- If `ComplianceAgent` doesn't have a `check_draft_against_matrix` method, add one that does a simple substring check: for each matrix entry, assert the entry's requirement text (or a key phrase) appears in some drafted section. Report missing coverage.
- If specialist constructors require different kwargs, match their real signatures. Don't force a rewrite.
- `_category_for` is a placeholder — the real categorization may come from the `ComplianceEntry.category` column added in task-011.
