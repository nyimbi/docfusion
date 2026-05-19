import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "pricing-lead-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "pricing-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "pricing-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import {
	transitionCostElementPricingWorkflow,
	transitionPricingPackageWorkflow,
} from "@/lib/actions/pricing-approval-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseCostElement = {
	id: "cost-1",
	opportunityId: "opp-1",
	wbsCode: "1.2.3",
	wbsTitle: "Data platform implementation",
	technicalSectionId: "11111111-1111-1111-1111-111111111111",
	elementType: "labor",
	laborCategoryId: null,
	laborCategoryName: "Senior Data Engineer",
	hours: 120,
	rate: 125,
	laborCost: 15000,
	odcType: null,
	odcAmount: null,
	odcDescription: null,
	odcVendor: null,
	odcQuoteReference: null,
	subcontractorId: null,
	subcontractorName: null,
	subcontractorCost: null,
	subcontractorRole: null,
	travelDescription: null,
	travelTrips: null,
	travelDaysPerTrip: null,
	travelCostPerTrip: null,
	travelCost: null,
	materialDescription: null,
	materialCost: null,
	totalCost: 15000,
	periodNumber: 1,
	periodType: "base",
	periodStartDate: null,
	periodEndDate: null,
	boeNarrative: "Senior engineering hours are derived from the implementation work breakdown.",
	assumptions: ["One sprint for integration hardening"],
	riskFactors: [],
	status: "draft",
	approvedBy: null,
	approvedAt: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const pricingSummary = {
	id: "pricing-1",
	opportunityId: "opp-1",
	periodSummaries: [],
	totalLaborCost: 15000,
	totalOdcCost: 0,
	totalSubcontractCost: 0,
	totalTravelCost: 0,
	totalMaterialCost: 0,
	grandTotalDirectCost: 15000,
	grandTotalPrice: 21600,
	overheadRate: 0.2,
	gaRate: 0.12,
	feeRate: 0.08,
	costPerFte: 180000,
	averageLaborRate: 125,
	laborMixAnalysis: [],
	calculatedAt: new Date("2026-05-02T00:00:00.000Z"),
	calculatedBy: "pricing-engine",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const criticalTrackingRow = {
	id: "tracking-1",
	opportunityId: "opp-1",
	technicalSectionId: "11111111-1111-1111-1111-111111111111",
	sectionName: "Implementation approach",
	sectionContent: "The approach requires continuous senior engineering support.",
	linkedCostElementIds: ["cost-1"],
	hasMatchingCost: true,
	alignmentScore: 40,
	alignmentIssues: [
		{
			issue: "The technical narrative implies additional senior coverage not in the cost volume.",
			severity: "critical",
			suggestion: "Add matching labor or revise the technical staffing claim.",
		},
	],
	impliedStaffing: [],
	analyzedAt: new Date("2026-05-03T00:00:00.000Z"),
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "pricing-lead-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("pricing approval workflow", () => {
	it("requires organization context before cost element pricing transitions", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "pricing-lead-1",
			organizationId: "",
		});

		await expect(transitionCostElementPricingWorkflow({
			costElementId: "cost-1",
			action: "submit_review",
			reason: "BOE is ready for price review",
		})).rejects.toThrow("No organization context");
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("requires organization context before pricing package transitions", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "pricing-lead-1",
			organizationId: "",
		});

		await expect(transitionPricingPackageWorkflow({
			pricingSummaryId: "pricing-1",
			action: "request_review",
			reason: "Package is ready",
		})).rejects.toThrow("No organization context");
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("submits a cost element for BOE review and projects reviewer work", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseCostElement] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseCostElement, status: "pending_review" }],
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionCostElementPricingWorkflow({
			costElementId: "cost-1",
			action: "submit_review",
			reason: "BOE is ready for price review",
			assignedTo: "reviewer-1",
		});

		expect(result).toMatchObject({
			subjectId: "cost-1",
			opportunityId: "opp-1",
			fromState: "draft",
			toState: "pending_review",
			taskProjected: true,
		});
		expect(patch).toMatchObject({
			status: "pending_review",
			boeNarrative: baseCostElement.boeNarrative,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "cost_element_pricing_approval",
				subjectType: "cost_element",
				eventType: "cost_element_pricing_submit_review",
				assignedRole: "pricing_reviewer",
				terminal: false,
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "pricing-cost-element:cost-1",
				state: "open",
				assignedRole: "pricing_reviewer",
			})
		);
	});

	it("requires pricing authority before approving a cost element", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ ...baseCostElement, status: "pending_review" }],
		}));

		await expect(transitionCostElementPricingWorkflow({
			costElementId: "cost-1",
			action: "approve",
			reason: "Approve price basis",
		})).rejects.toThrow("pricing authority");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("approves a cost element with authority and completes the projected task", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ ...baseCostElement, status: "pending_review" }],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseCostElement,
				status: "approved",
				approvedBy: "pricing-lead-1",
				approvedAt: new Date("2026-05-04T00:00:00.000Z"),
			}],
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionCostElementPricingWorkflow({
			costElementId: "cost-1",
			action: "approve",
			reason: "BOE supports the proposed cost",
			authorityRole: "pricing_approver",
		});

		expect(result.toState).toBe("approved");
		expect(patch).toMatchObject({
			status: "approved",
			approvedBy: "pricing-lead-1",
		});
		expect(patch?.approvedAt).toBeInstanceOf(Date);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				toState: "approved",
				terminal: true,
				authorityPolicy: { requiredRoles: ["pricing_approver"] },
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				state: "completed",
				assignedRole: null,
			})
		);
	});

	it("blocks package lock until every cost element is approved", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [pricingSummary] }))
			.mockReturnValueOnce(createChain({
				result: [
					{ ...baseCostElement, status: "approved" },
					{ ...baseCostElement, id: "cost-2", status: "pending_review" },
				],
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		await expect(transitionPricingPackageWorkflow({
			pricingSummaryId: "pricing-1",
			action: "approve_lock",
			reason: "Lock final price",
			authorityRole: "pricing_approver",
		})).rejects.toThrow("all cost elements to be approved");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("blocks package lock on critical cost-technical issues without an authority waiver", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [pricingSummary] }))
			.mockReturnValueOnce(createChain({ result: [{ ...baseCostElement, status: "approved" }] }))
			.mockReturnValueOnce(createChain({ result: [criticalTrackingRow] }));

		await expect(transitionPricingPackageWorkflow({
			pricingSummaryId: "pricing-1",
			action: "approve_lock",
			reason: "Lock final price",
			authorityRole: "pricing_approver",
		})).rejects.toThrow("critical cost-technical issues");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("locks the pricing package when approved costs and authorized waiver gates pass", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [pricingSummary] }))
			.mockReturnValueOnce(createChain({ result: [{ ...baseCostElement, status: "approved" }] }))
			.mockReturnValueOnce(createChain({ result: [criticalTrackingRow] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...pricingSummary, calculatedBy: "pricing-lead-1" }],
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionPricingPackageWorkflow({
			pricingSummaryId: "pricing-1",
			action: "approve_lock",
			reason: "Executive approval accepts the technical-cost waiver",
			authorityRole: "pricing_approver",
			waiveCriticalAlignment: true,
		});

		expect(result).toMatchObject({
			subjectId: "pricing-1",
			opportunityId: "opp-1",
			fromState: "all_cost_elements_approved",
			toState: "locked",
		});
		expect(patch).toMatchObject({
			calculatedBy: "pricing-lead-1",
		});
		expect(patch?.calculatedAt).toBeInstanceOf(Date);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "pricing_package_approval",
				subjectType: "pricing_summary",
				toState: "locked",
				terminal: true,
				metadata: expect.objectContaining({
					criticalAlignmentIssueCount: 1,
					criticalAlignmentWaived: true,
				}),
			})
		);
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(
			expect.objectContaining({
				taskKey: "pricing-package:pricing-1",
				state: "completed",
			})
		);
	});

	it("requires a reason before changing pricing workflow state", async () => {
		await expect(transitionPricingPackageWorkflow({
			pricingSummaryId: "pricing-1",
			action: "request_review",
			reason: " ",
		})).rejects.toThrow("Pricing package transitions require a reason");
		expect(dbMock.select).not.toHaveBeenCalled();
	});
});
