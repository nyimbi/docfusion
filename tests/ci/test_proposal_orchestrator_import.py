"""Regression coverage for the deferred RFP draft orchestration path."""

from __future__ import annotations


def test_proposal_orchestrator_instantiates_with_legacy_agent_paths():
	from docfusion.orchestration.proposal_orchestrator import ProposalOrchestrator

	orchestrator = ProposalOrchestrator()

	assert type(orchestrator).__name__ == "ProposalOrchestrator"
