import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Requirement, RequirementStats } from "@/lib/types/opportunity";
import type { ResponseWinThemeSeedReviewData, WinTheme } from "@/lib/types/win-themes";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
	createThemesFromResponseSeeds: vi.fn(),
	getResponseWinThemeSeedReview: vi.fn(),
	getRequirements: vi.fn(),
	getRequirementStats: vi.fn(),
	listComplianceMatrices: vi.fn(),
	createAndDraftStandardProposalSet: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
	toastInfo: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mocks.push,
		refresh: mocks.refresh,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		info: mocks.toastInfo,
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}));

vi.mock("@/lib/actions/requirements", () => ({
	acceptParsedRequirementsForResponsePlan: vi.fn(),
	getRequirements: mocks.getRequirements,
	getRequirementStats: mocks.getRequirementStats,
}));

vi.mock("@/lib/actions/rfp-parser", () => ({
	listComplianceMatrices: mocks.listComplianceMatrices,
	reviewRfpParseConfidence: vi.fn(),
}));

vi.mock("@/lib/actions/proposal-documents", () => ({
	createAndDraftStandardProposalSet: mocks.createAndDraftStandardProposalSet,
}));

vi.mock("@/lib/actions/win-themes", () => ({
	createThemesFromResponseSeeds: mocks.createThemesFromResponseSeeds,
	getResponseWinThemeSeedReview: mocks.getResponseWinThemeSeedReview,
}));

vi.mock("@/components/requirements/RequirementsTable", () => ({
	RequirementsTable: ({ requirements }: { requirements: Requirement[] }) => (
		React.createElement("div", { "data-testid": "requirements-table" }, `${requirements.length} requirements`)
	),
}));

vi.mock("@/components/requirements/RequirementDetail", () => ({
	RequirementDetail: () => null,
}));

vi.mock("@/components/rfp/ComplianceMatrix", () => ({
	ComplianceMatrix: ({ matrixId }: { matrixId: string }) => (
		React.createElement("div", { "data-testid": "compliance-matrix" }, matrixId)
	),
}));

vi.mock("@/app/(app)/opportunities/[id]/requirements/RequirementExtractor", () => ({
	RequirementExtractor: () => null,
}));

import { RequirementsClientPage } from "@/app/(app)/opportunities/[id]/requirements/RequirementsClientPage";

const acceptedRequirement: Requirement = {
	id: "req-technical-cloud",
	opportunityId: "opp-seed-review",
	requirementId: "REQ-001",
	category: "technical",
	subcategory: null,
	text: "Provide a cloud migration approach with evidence of regulated delivery.",
	source: "Offerors must describe their cloud migration approach.",
	sourcePageRef: "4.2",
	priority: "mandatory",
	complianceStatus: "partial",
	responseStrategy: null,
	assignedTo: "capture-lead",
	dueDate: null,
	notes: null,
	riskLevel: "medium",
	aiAnalysis: null,
	workflowState: "accepted",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-02T00:00:00.000Z"),
};

const stats: RequirementStats = {
	total: 1,
	byCategory: { technical: 1 },
	byPriority: {
		mandatory: 1,
		preferred: 0,
		optional: 0,
	},
	byStatus: {
		not_addressed: 0,
		partial: 1,
		compliant: 0,
		non_compliant: 0,
		not_applicable: 0,
	},
	byRiskLevel: {
		low: 0,
		medium: 1,
		high: 0,
		critical: 0,
	},
	compliancePercentage: 50,
	overdueCount: 0,
	unassignedCount: 0,
};

const seedReview: ResponseWinThemeSeedReviewData = {
	acceptedRequirementCount: 1,
	evaluationCriteriaCount: 1,
	seeds: [
		{
			id: "seed-platform-fit",
			shortVersion: "African-first platform fit",
			statement: "Datacraft reduces delivery risk with proven African institutional platform experience.",
			type: "value_prop",
			priority: 5,
			evaluationCriteriaIds: ["EVAL-TECH-1"],
			requirementIds: ["req-technical-cloud"],
			targetDocumentTypes: ["technical"],
			supportingEvidence: ["Lindela and MeGuard production evidence"],
			rationale: "Maps the accepted technical requirement to a differentiated response strategy.",
		},
		{
			id: "seed-delivery-risk",
			shortVersion: "Migration delivery control",
			statement: "Datacraft controls migration risk through staged governance and audit-ready workflows.",
			type: "risk_mitigation",
			priority: 4,
			evaluationCriteriaIds: ["EVAL-TECH-2"],
			requirementIds: ["req-technical-cloud"],
		},
	],
};

function renderRequirementsPageHtml() {
	return renderToStaticMarkup(
		React.createElement(RequirementsClientPage, {
			opportunityId: "opp-seed-review",
			initialRequirements: [acceptedRequirement],
			initialStats: stats,
			initialRfpDocuments: [],
			initialComplianceMatrices: [],
			initialWinThemeSeedReview: seedReview,
		})
	);
}

describe("requirements page response win-theme seed review", () => {
	beforeEach(() => {
		mocks.createThemesFromResponseSeeds.mockResolvedValue({
			success: true,
			data: {
				created: [
					{
						id: "theme-1",
						opportunityId: "opp-seed-review",
						statement: seedReview.seeds[0].statement,
						shortVersion: seedReview.seeds[0].shortVersion,
						type: "value_prop",
						priority: 5,
						status: "draft",
						displayOrder: 0,
						supportingEvidence: [],
						relatedProjectIds: [],
						evaluationCriteriaIds: ["EVAL-TECH-1"],
						keywords: [],
						createdBy: "capture-lead",
						createdAt: new Date("2026-05-02T00:00:00.000Z"),
						updatedAt: new Date("2026-05-02T00:00:00.000Z"),
					} satisfies WinTheme,
				],
				skipped: 0,
				rejected: 1,
				pendingReview: 0,
			},
		});
		mocks.getRequirements.mockResolvedValue({ data: [acceptedRequirement] });
		mocks.getRequirementStats.mockResolvedValue(stats);
		mocks.listComplianceMatrices.mockResolvedValue({ matrices: [] });
		mocks.getResponseWinThemeSeedReview.mockResolvedValue({
			success: true,
			data: { ...seedReview, seeds: [] },
		});
	});

	it("renders generated seed review evidence inside the requirements workflow", () => {
		const html = renderRequirementsPageHtml();

		expect(html).toContain("Response win-theme seed review");
		expect(html).toContain("African-first platform fit");
		expect(html).toContain("Migration delivery control");
		expect(html).toContain("EVAL-TECH-1");
		expect(html).toContain("EVAL-TECH-2");
		expect(html).toContain("Requirements: req-technical-cloud");
		expect(html).toContain("Targets: technical");
		expect(html).toContain("0 approved");
		expect(html).toContain("2 pending");
		expect(html).toContain("Persist approved");
		expect(html).toContain("disabled");
		expect(mocks.createThemesFromResponseSeeds).not.toHaveBeenCalled();
		expect(mocks.push).not.toHaveBeenCalled();
	});
});
