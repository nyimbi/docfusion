import { beforeEach, describe, expect, test, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

const sessionOrganizationId = "11111111-1111-1111-1111-111111111111";
const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
const opportunityId = "33333333-3333-4333-8333-333333333333";
const debriefId = "44444444-4444-4444-8444-444444444444";
const competitorId = "55555555-5555-4555-8555-555555555555";

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

vi.mock("@/lib/db/schema-winloss", () => ({
	debriefs: {
		id: "debriefs.id",
		opportunityId: "debriefs.opportunityId",
		organizationId: "debriefs.organizationId",
		outcome: "debriefs.outcome",
		createdAt: "debriefs.createdAt",
	},
	winLossPatterns: {
		id: "winLossPatterns.id",
		organizationId: "winLossPatterns.organizationId",
		patternType: "winLossPatterns.patternType",
		isActive: "winLossPatterns.isActive",
		confidence: "winLossPatterns.confidence",
		occurrenceCount: "winLossPatterns.occurrenceCount",
	},
	proposalROI: {
		id: "proposalROI.id",
		organizationId: "proposalROI.organizationId",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		title: "opportunities.title",
		organization: "opportunities.organization",
		assignedTo: "opportunities.assignedTo",
	},
	companySettings: {
		id: "companySettings.id",
	},
}));

vi.mock("@/lib/db/schema-competitors", () => ({
	competitors: {
		id: "competitors.id",
		organizationId: "competitors.organizationId",
	},
	competitorOpportunities: {
		opportunityId: "competitorOpportunities.opportunityId",
		competitorId: "competitorOpportunities.competitorId",
	},
}));

import { getProviderManager } from "@/lib/ai/providers";
import {
	analyzeWinLossPatterns,
	calculateProposalROI,
	compareToCompetitors,
	createDebrief,
	deleteDebrief,
	getDebrief,
	getWinLossInsights,
	getPatterns,
	listDebriefs,
	updateDebrief,
} from "@/lib/actions/winloss";

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "orderBy", "leftJoin", "values", "returning", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain as Record<string, unknown>).then = (resolve: (value: unknown) => void) =>
		Promise.resolve(Array.isArray(returnValue) ? returnValue : [returnValue]).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "winloss-user-1",
		organizationId: sessionOrganizationId,
	});
	dbMock.select.mockImplementation(() => createChainableQuery([]));
	dbMock.insert.mockImplementation(() => createChainableQuery([]));
	dbMock.update.mockImplementation(() => createChainableQuery([]));
	dbMock.delete.mockImplementation(() => createChainableQuery([]));
});

describe("Win/loss action auth", () => {
	test("requires a session before listing debriefs", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await listDebriefs();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before listing debriefs", async () => {
		const result = await listDebriefs({ organizationId: otherOrganizationId });

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before creating debriefs", async () => {
		const result = await createDebrief({
			opportunityId,
			outcome: "loss",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before updating debriefs", async () => {
		const result = await updateDebrief(debriefId, {
			outcome: "win",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	test("requires a session before calculating ROI", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await calculateProposalROI();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("requires a session before competitor comparison", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await compareToCompetitors(competitorId);

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("requires a session before listing patterns", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await getPatterns();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("scopes debrief creation opportunity reads and status updates by assignment", async () => {
		let opportunityWhere: unknown;
		let updateWhere: unknown;
		const opportunityChain = createChainableQuery([{ id: opportunityId }]);
		(opportunityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			opportunityWhere = value;
			return opportunityChain;
		});
		const updateChain = createChainableQuery([]);
		(updateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWhere = value;
			return updateChain;
		});
		dbMock.select
			.mockImplementationOnce(() => opportunityChain)
			.mockImplementationOnce(() => createChainableQuery([]));
		dbMock.insert.mockImplementationOnce(() => createChainableQuery([{ id: debriefId, opportunityId }]));
		dbMock.update.mockImplementationOnce(() => updateChain);

		const result = await createDebrief({ opportunityId, outcome: "loss" });

		expect(result.success).toBe(true);
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assignedTo");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assignedTo");
	});

	test("scopes debrief opportunity hydration by assignment", async () => {
		let opportunityWhere: unknown;
		const opportunityChain = createChainableQuery([{ id: opportunityId }]);
		(opportunityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			opportunityWhere = value;
			return opportunityChain;
		});
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([{ id: debriefId, opportunityId }]))
			.mockImplementationOnce(() => opportunityChain);

		const result = await getDebrief(debriefId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assignedTo");
	});

	test("scopes debrief deletion opportunity reset by assignment", async () => {
		let updateWhere: unknown;
		const updateChain = createChainableQuery([]);
		(updateChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			updateWhere = value;
			return updateChain;
		});
		dbMock.select.mockImplementationOnce(() => createChainableQuery([{ id: debriefId, opportunityId }]));
		dbMock.delete.mockImplementationOnce(() => createChainableQuery([]));
		dbMock.update.mockImplementationOnce(() => updateChain);

		const result = await deleteDebrief(debriefId);

		expect(result.success).toBe(true);
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assignedTo");
	});

	test("scopes opportunity-specific insights by assignment", async () => {
		let opportunityWhere: unknown;
		const opportunityChain = createChainableQuery([]);
		(opportunityChain.where as ReturnType<typeof vi.fn>).mockImplementation((value: unknown) => {
			opportunityWhere = value;
			return opportunityChain;
		});
		dbMock.select.mockImplementationOnce(() => opportunityChain);

		const result = await getWinLossInsights(opportunityId);

		expect(result.success).toBe(false);
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assignedTo");
	});

	test("falls back to heuristic win/loss insights when AI output is malformed", async () => {
		vi.mocked(getProviderManager).mockReturnValue({
			initialize: vi.fn(async () => undefined),
			isAvailable: vi.fn(async () => true),
			complete: vi.fn(async () => ({ content: "not json" })),
		} as unknown as ReturnType<typeof getProviderManager>);
		dbMock.select
			.mockImplementationOnce(() => createChainableQuery([
				{ outcome: "win" },
				{ outcome: "loss" },
			]))
			.mockImplementationOnce(() => createChainableQuery([
				{ patternName: "Past performance gap" },
				{ patternName: "Pricing strength" },
			]));

		const result = await getWinLossInsights();

		expect(result).toEqual({
			success: true,
			data: [
				"Recent win rate: 50%",
				"2 active patterns identified",
			],
		});
		expect(result.success && result.data.join(" ")).not.toContain("Unable to generate AI insights");
	});

	test("derives heuristic pattern confidence from observed win/loss evidence", async () => {
		const insertedPatterns: Record<string, unknown>[] = [];
		dbMock.select.mockImplementationOnce(() => createChainableQuery([
			{
				debrief: {
					id: "debrief-win-1",
					outcome: "win",
					strengthsIdentified: ["agency experience"],
					weaknessesIdentified: [],
					costScore: 88,
				},
				opportunity: null,
			},
			{
				debrief: {
					id: "debrief-win-2",
					outcome: "win",
					strengthsIdentified: ["agency experience"],
					weaknessesIdentified: ["thin staffing"],
					costScore: 82,
				},
				opportunity: null,
			},
			{
				debrief: {
					id: "debrief-loss-1",
					outcome: "loss",
					strengthsIdentified: [],
					weaknessesIdentified: ["thin staffing"],
					costScore: 45,
				},
				opportunity: null,
			},
		]));
		dbMock.insert.mockImplementation(() => {
			const chain = createChainableQuery([]);
			(chain.values as ReturnType<typeof vi.fn>).mockImplementation((value: Record<string, unknown>) => {
				insertedPatterns.push(value);
				return chain;
			});
			(chain.returning as ReturnType<typeof vi.fn>).mockImplementation(async () => [
				{ id: `pattern-${insertedPatterns.length}`, ...insertedPatterns[insertedPatterns.length - 1] },
			]);
			return chain;
		});

		const result = await analyzeWinLossPatterns();

		expect(result.success).toBe(true);
		expect(insertedPatterns).toHaveLength(3);
		expect(insertedPatterns[0]).toMatchObject({
			patternName: "Strong agency experience",
			winCorrelation: 0.8,
			confidence: 0.63,
		});
		expect(insertedPatterns[0].description).toContain("2 win(s) and 0 loss(es)");
		expect(insertedPatterns[1]).toMatchObject({
			patternName: "Recurring thin staffing Issue",
			winCorrelation: -0.5,
			confidence: 0.63,
		});
		expect(insertedPatterns[2]).toMatchObject({
			patternName: "Cost Competitiveness",
			confidence: 0.77,
		});
		if (result.success) {
			expect(result.data.confidence).toBe(0.68);
		}
	});
});
