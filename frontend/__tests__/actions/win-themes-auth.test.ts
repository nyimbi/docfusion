import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: unknown) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.values = vi.fn((value: unknown) => {
		config.onValues?.(value);
		return chain;
	});
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/ai/client", () => ({
	AIClient: vi.fn(() => ({
		complete: vi.fn(async () => ({ content: "{}" })),
	})),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { createThemesFromResponseSeeds, scanForOccurrences, updateTheme } from "@/lib/actions/win-themes";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "theme-user-1",
		organizationId: "org-1",
	});
});

describe("win theme authorization", () => {
	it("creates opportunity win themes from live response package seeds", async () => {
		let insertedValues: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [{ maxOrder: 2 }] }));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{
				id: "33333333-3333-4333-8333-333333333333",
				opportunityId: "22222222-2222-4222-8222-222222222222",
				themeStatement: "Datacraft will win technical scoring with delivery proof.",
				shortVersion: "Technical scoring proof",
				themeType: "differentiator",
				priority: 3,
				supportingEvidence: ["Evaluator criterion LIVE-EVAL-001"],
				relatedProjects: [],
				evaluationCriteriaIds: ["LIVE-EVAL-001"],
				keywords: ["technical", "proof"],
				ghostTheme: null,
				targetCompetitor: null,
				isActive: true,
				createdBy: "theme-user-1",
				createdAt: new Date("2026-05-27T00:00:00.000Z"),
				updatedAt: new Date("2026-05-27T00:00:00.000Z"),
			}],
			onValues: (value) => {
				insertedValues = value;
			},
		}));

		const result = await createThemesFromResponseSeeds({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			seeds: [{
				statement: "Datacraft will win technical scoring with delivery proof.",
				shortVersion: "Technical scoring proof",
				type: "differentiator",
				priority: 1,
				evaluationCriteriaIds: ["LIVE-EVAL-001"],
				requirementIds: ["LIVE-REQ-001"],
				targetDocumentTypes: ["technical_approach"],
				supportingEvidence: ["Evaluator criterion LIVE-EVAL-001"],
				keywords: ["technical", "proof"],
				rationale: "Map technical controls to score.",
			}],
		});

		expect(result.success).toBe(true);
		expect(result.data?.created[0]?.evaluationCriteriaIds).toEqual(["LIVE-EVAL-001"]);
		expect(insertedValues).toEqual([
			expect.objectContaining({
				evaluationCriteriaIds: ["LIVE-EVAL-001"],
				targetSections: ["technical_approach"],
				variations: ["Map technical controls to score."],
				priority: 3,
			}),
		]);
	});

	it("persists only approved response win theme seed reviews", async () => {
		let insertedValues: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({ result: [{ maxOrder: 4 }] }));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{
				id: "44444444-4444-4444-8444-444444444444",
				opportunityId: "22222222-2222-4222-8222-222222222222",
				themeStatement: "Datacraft will reduce transition risk with a proven mobilisation playbook.",
				shortVersion: "Transition risk reduction",
				themeType: "risk_mitigation",
				priority: 5,
				supportingEvidence: ["Mobilisation evidence"],
				relatedProjects: [],
				evaluationCriteriaIds: ["LIVE-EVAL-010"],
				keywords: ["transition", "risk"],
				ghostTheme: null,
				targetCompetitor: null,
				isActive: true,
				createdBy: "theme-user-1",
				createdAt: new Date("2026-05-27T00:00:00.000Z"),
				updatedAt: new Date("2026-05-27T00:00:00.000Z"),
			}],
			onValues: (value) => {
				insertedValues = value;
			},
		}));

		const result = await createThemesFromResponseSeeds({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			reviewRequired: true,
			seeds: [
				{
					id: "approved-seed",
					statement: "Datacraft will reduce transition risk with a proven mobilisation playbook.",
					shortVersion: "Transition risk reduction",
					type: "risk_mitigation",
					priority: 1,
					evaluationCriteriaIds: ["LIVE-EVAL-010"],
					targetDocumentTypes: ["transition_plan"],
					supportingEvidence: ["Mobilisation evidence"],
					keywords: ["transition", "risk"],
					rationale: "Match evaluator risk scoring.",
					reviewDecision: "approve",
					reviewNote: "Strong enough for the initial strategy set.",
				},
				{
					id: "rejected-seed",
					statement: "Datacraft will win with a generic compliance theme that needs rewriting.",
					shortVersion: "Generic compliance",
					type: "value_prop",
					priority: 2,
					reviewDecision: "reject",
				},
				{
					id: "pending-seed",
					statement: "Datacraft can align training evidence to field adoption scoring.",
					shortVersion: "Training adoption evidence",
					type: "proof_point",
					priority: 3,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.data).toMatchObject({
			skipped: 0,
			rejected: 1,
			pendingReview: 1,
		});
		expect(insertedValues).toEqual([
			expect.objectContaining({
				themeStatement: "Datacraft will reduce transition risk with a proven mobilisation playbook.",
				evaluationCriteriaIds: ["LIVE-EVAL-010"],
				targetSections: ["transition_plan"],
				variations: [
					"Match evaluator risk scoring.",
					"Review note: Strong enough for the initial strategy set.",
				],
				priority: 5,
			}),
		]);
	});

	it("persists evaluation criteria mappings on theme updates", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				id: "11111111-1111-4111-8111-111111111111",
				opportunityId: "22222222-2222-4222-8222-222222222222",
				themeStatement: "Score-aware delivery certainty backed by proof.",
				shortVersion: "Score-aware delivery certainty",
				themeType: "differentiator",
				priority: 1,
				supportingEvidence: [],
				relatedProjects: [],
				evaluationCriteriaIds: ["LIVE-EVAL-001", "LIVE-EVAL-002"],
				keywords: [],
				ghostTheme: null,
				targetCompetitor: null,
				isActive: true,
				createdBy: "theme-user-1",
				createdAt: new Date("2026-05-27T00:00:00.000Z"),
				updatedAt: new Date("2026-05-27T00:00:00.000Z"),
			}],
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await updateTheme(
			"11111111-1111-4111-8111-111111111111",
			{
				evaluationCriteriaIds: ["LIVE-EVAL-001", "LIVE-EVAL-002"],
			}
		);

		expect(result.success).toBe(true);
		expect(patch).toMatchObject({
			evaluationCriteriaIds: ["LIVE-EVAL-001", "LIVE-EVAL-002"],
		});
		expect(result.data?.evaluationCriteriaIds).toEqual(["LIVE-EVAL-001", "LIVE-EVAL-002"]);
	});

	it("scopes theme updates to opportunities assigned to the actor", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateTheme(
			"11111111-1111-4111-8111-111111111111",
			{
				statement: "A differentiated delivery approach backed by evidence.",
			}
		);

		expect(result).toEqual({ success: false, error: "Theme not found" });
		const sql = collectSqlFragments(updateWhere).join(" ");
		expect(sql).toContain("opportunities.assigned_to");
		expect(sql).toContain("opportunities.organization_id");
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("scopes occurrence document scans to proposal documents on assigned opportunities", async () => {
		let docsWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({ result: [{ id: "theme-1" }] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					docsWhere = value;
				},
			}));

		const result = await scanForOccurrences("22222222-2222-4222-8222-222222222222");

		expect(result).toEqual({ success: true, count: 0 });
		const sql = collectSqlFragments(docsWhere).join(" ");
		expect(sql).toContain("opportunities.assigned_to");
		expect(sql).toContain("opportunities.organization_id");
	});
});
