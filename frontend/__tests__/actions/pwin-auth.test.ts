import { beforeEach, describe, expect, test, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

const sessionOrganizationId = "11111111-1111-1111-1111-111111111111";
const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
const opportunityId = "33333333-3333-3333-3333-333333333333";
const factorId = "44444444-4444-4444-4444-444444444444";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		initialize: vi.fn(),
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "[]" })),
	})),
}));

vi.mock("@/lib/db/schema-pwin", () => ({
	pwinFactors: {
		id: "pwinFactors.id",
		organizationId: "pwinFactors.organizationId",
		isActive: "pwinFactors.isActive",
		factorName: "pwinFactors.factorName",
		weight: "pwinFactors.weight",
	},
	pwinAssessments: {
		id: "pwinAssessments.id",
		opportunityId: "pwinAssessments.opportunityId",
		organizationId: "pwinAssessments.organizationId",
		assessedAt: "pwinAssessments.assessedAt",
	},
	pwinModelPerformance: {
		id: "pwinModelPerformance.id",
		organizationId: "pwinModelPerformance.organizationId",
		isActive: "pwinModelPerformance.isActive",
		trainedAt: "pwinModelPerformance.trainedAt",
	},
	portfolioOptimizations: {
		id: "portfolioOptimizations.id",
		organizationId: "portfolioOptimizations.organizationId",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		assignedTo: "opportunities.assigned_to",
		title: "opportunities.title",
		isExpired: "opportunities.isExpired",
		winProbability: "opportunities.winProbability",
		budgetNumeric: "opportunities.budgetNumeric",
		category: "opportunities.category",
		createdAt: "opportunities.createdAt",
	},
}));

vi.mock("@/lib/db/schema-winloss", () => ({
	debriefs: {
		opportunityId: "debriefs.opportunityId",
		organizationId: "debriefs.organizationId",
		outcome: "debriefs.outcome",
		createdAt: "debriefs.createdAt",
	},
}));

import {
	assessPwin,
	createPwinFactor,
	initializeDefaultFactors,
	listPwinFactors,
	optimizePortfolio,
	trainPwinModel,
} from "@/lib/actions/pwin";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "pwin-user-1",
		organizationId: sessionOrganizationId,
	});
});

describe("PWin action auth", () => {
	test("requires a session before listing factors", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await listPwinFactors();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before listing factors", async () => {
		const result = await listPwinFactors(otherOrganizationId);

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before creating factors", async () => {
		const result = await createPwinFactor({
			factorName: "Capture access",
			factorCategory: "customer",
			weight: 2,
			minScore: 0,
			maxScore: 10,
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before initializing defaults", async () => {
		const result = await initializeDefaultFactors(otherOrganizationId);

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before assessing PWin", async () => {
		const result = await assessPwin(
			opportunityId,
			[
				{
					factorId,
					factorName: "Capture access",
					score: 6,
					weight: 2,
				},
			],
			{ organizationId: otherOrganizationId }
		);

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before portfolio optimization", async () => {
		const result = await optimizePortfolio({
			optimizationType: "balanced",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before model training", async () => {
		const result = await trainPwinModel({
			modelType: "weighted_avg",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});
