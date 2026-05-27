import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalProgress, ResponsePackageReadinessSummary } from "@/lib/types/opportunity";
import type { ResponseWinThemeSeedReviewData } from "@/lib/types/win-themes";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
	getProposalDocuments: vi.fn(),
	getProposalProgress: vi.fn(),
	getResponsePackageReadiness: vi.fn(),
	getResponseWinThemeSeedReview: vi.fn(),
	createThemesFromResponseSeeds: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mocks.push,
		refresh: mocks.refresh,
	}),
}));

vi.mock("@/lib/actions/proposal-documents", () => ({
	getProposalDocuments: mocks.getProposalDocuments,
	getProposalProgress: mocks.getProposalProgress,
	getResponsePackageReadiness: mocks.getResponsePackageReadiness,
}));

vi.mock("@/lib/actions/win-themes", () => ({
	createThemesFromResponseSeeds: mocks.createThemesFromResponseSeeds,
	getResponseWinThemeSeedReview: mocks.getResponseWinThemeSeedReview,
}));

vi.mock("@/components/proposals/ProposalDocumentList", () => ({
	ProposalDocumentList: () => React.createElement("div", { "data-testid": "proposal-document-list" }, "proposal documents"),
}));

vi.mock("@/components/proposals/CreateProposalDialog", () => ({
	CreateProposalDialog: () => null,
}));

import { ProposalDocumentsClientPage } from "@/app/(app)/opportunities/[id]/documents/ProposalDocumentsClientPage";

const progress: ProposalProgress = {
	opportunityId: "opp-doc-review",
	totalDocuments: 1,
	byStatus: {
		not_started: 0,
		drafting: 0,
		in_review: 0,
		revising: 0,
		approved: 1,
		final: 0,
	},
	completionPercentage: 80,
	documentsOnTrack: 1,
	documentsOverdue: 0,
	documentsAtRisk: 0,
	nextDeadline: null,
	averageAiScore: null,
};

const readiness: ResponsePackageReadinessSummary = {
	status: "ready_for_review",
	workflowInstanceId: "workflow-response-1",
	state: "ready_for_review",
	metrics: {
		acceptedRequirementCount: 2,
		draftedRequirementCount: 2,
		requirementCoverage: 1,
		documentsDrafted: 1,
		sectionsDrafted: 4,
		complianceEntriesCreated: 2,
		totalDraftWordCount: 2400,
		minDocumentDraftWordCount: 1200,
		reviewGateCoverage: 1,
		winThemeCoverage: 0.5,
		evidenceChecklistCoverage: 1,
		unresolvedPlaceholderCount: 0,
	},
	blockers: [],
	warnings: [],
	missingRequirementIds: [],
};

const seedReview: ResponseWinThemeSeedReviewData = {
	acceptedRequirementCount: 2,
	evaluationCriteriaCount: 2,
	seeds: [
		{
			id: "seed-response-strategy",
			shortVersion: "Evaluator-aligned delivery proof",
			statement: "Datacraft maps accepted requirements to evaluator-visible delivery evidence.",
			type: "proof_point",
			priority: 5,
			evaluationCriteriaIds: ["EVAL-TECH-1", "EVAL-DELIVERY-2"],
			requirementIds: ["req-1", "req-2"],
			targetDocumentTypes: ["technical_approach", "management_plan"],
			supportingEvidence: ["Production platform receipts", "Audit-ready workflow evidence"],
		},
	],
};

function renderDocumentsPageHtml() {
	return renderToStaticMarkup(
		React.createElement(ProposalDocumentsClientPage, {
			opportunityId: "opp-doc-review",
			initialDocuments: [],
			initialProgress: progress,
			initialResponsePackageReadiness: readiness,
			initialWinThemeSeedReview: seedReview,
		})
	);
}

describe("proposal documents response win-theme seed review", () => {
	beforeEach(() => {
		mocks.getProposalDocuments.mockResolvedValue([]);
		mocks.getProposalProgress.mockResolvedValue(progress);
		mocks.getResponsePackageReadiness.mockResolvedValue(readiness);
		mocks.getResponseWinThemeSeedReview.mockResolvedValue({
			success: true,
			data: { ...seedReview, seeds: [] },
		});
	});

	it("renders pending generated win-theme review on the response package documents surface", () => {
		const html = renderDocumentsPageHtml();

		expect(html).toContain("Response win-theme seed review");
		expect(html).toContain("Evaluator-aligned delivery proof");
		expect(html).toContain("EVAL-TECH-1");
		expect(html).toContain("EVAL-DELIVERY-2");
		expect(html).toContain("Requirements: req-1, req-2");
		expect(html).toContain("Targets: technical_approach, management_plan");
		expect(html).toContain("0 approved");
		expect(html).toContain("1 pending");
		expect(html).toContain("proposal documents");
		expect(mocks.createThemesFromResponseSeeds).not.toHaveBeenCalled();
	});
});
