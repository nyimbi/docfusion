import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const aiCompleteMock = vi.hoisted(() => vi.fn(async () => ({ content: "{}" })));

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
		complete: aiCompleteMock,
	})),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { createThemesFromResponseSeeds, generateGhostThemeSuggestions, generateInjectionSuggestions, generateReinforcementText, generateThemeSuggestions, getResponseWinThemeSeedReview, getThemeSuggestions, scanForOccurrences, suggestCriteriaMappings, updateTheme } from "@/lib/actions/win-themes";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "theme-user-1",
		organizationId: "org-1",
	});
});

describe("win theme authorization", () => {
	it("returns pending theme suggestions from accepted requirements", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "22222222-2222-4222-8222-222222222222",
					title: "Digital public records platform",
					organization: "Ministry of ICT",
					sourceId: "rfp-ict-001",
					deadline: null,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [
					{
						id: "55555555-5555-4555-8555-555555555555",
						requirementNumber: "M.2.1",
						title: "Technical evaluation approach",
						requirementText: "Evaluation criteria: technical approach carries 40 percent of the score.",
						sourceSection: "Section M.2.1",
						category: "technical",
						subcategory: null,
						priority: "mandatory",
						evaluationWeight: 40,
						responseStrategy: "Tie technical controls to delivery evidence and measurable risk reduction.",
						complianceStatus: "partial",
						metadata: { workflow: { state: "accepted" } },
					},
					{
						id: "66666666-6666-4666-8666-666666666666",
						requirementNumber: "L.3.4",
						title: "Implementation work plan",
						requirementText: "Provide a detailed work plan with milestones and risk controls.",
						sourceSection: "Section L.3.4",
						category: "management",
						subcategory: null,
						priority: "mandatory",
						evaluationWeight: null,
						responseStrategy: "Show governance, schedule control, and delivery assurance.",
						complianceStatus: "partial",
						metadata: { workflow: { state: "accepted" } },
					},
				],
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await getThemeSuggestions("22222222-2222-4222-8222-222222222222");

		expect(result.success).toBe(true);
		expect(result.data?.[0]).toMatchObject({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			status: "pending",
			type: "differentiator",
			suggestedKeywords: expect.arrayContaining(["technical"]),
		});
		expect(result.data?.[0]?.statement).toContain("Datacraft will win Technical evaluation approach");
		expect(result.data?.[0]?.confidence).toBeGreaterThan(0.8);
		expect(result.data?.[0]?.sources).toEqual(expect.arrayContaining([
			expect.objectContaining({
				sectionId: "55555555-5555-4555-8555-555555555555",
				excerpt: expect.stringContaining("Evaluator criterion 55555555-5555-4555-8555-555555555555"),
			}),
		]));
	});

	it("returns deterministic theme suggestions when AI output is malformed", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not json" });
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "competitor-1",
					competitorName: "IncumbentCo",
					competitorWeaknesses: ["slow mobilization"],
				}],
			}));

		const result = await generateThemeSuggestions({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			count: 3,
			additionalContext: "Past performance proof, cost efficiency, and local certified delivery team.",
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toEqual(expect.arrayContaining([
			expect.objectContaining({
				statement: expect.stringContaining("slow mobilization"),
				type: "risk_mitigation",
				status: "pending",
			}),
			expect.objectContaining({
				shortVersion: "Verifiable delivery proof",
				type: "proof_point",
			}),
		]));
		expect(result.data?.[0]?.suggestedKeywords.length).toBeGreaterThan(0);
	});

	it("returns deterministic reinforcement text when AI output is malformed", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not json" });
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: "theme-1",
				themeStatement: "validated transition governance",
				shortVersion: "Transition governance",
				supportingEvidence: ["two prior transition programs"],
			}],
		}));

		const result = await generateReinforcementText({
			themeId: "theme-1",
			sectionId: "section-1",
			tone: "technical",
			optionCount: 2,
			targetWordCount: 40,
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		const data = result.data;
		expect(data?.options).toHaveLength(2);
		expect(data?.options[0]).toMatchObject({
			tone: "technical",
			wordCount: expect.any(Number),
		});
		expect(data?.options[0]?.text).toContain("validated transition governance");
		expect(data?.options[0]?.text).toContain("two prior transition programs");
		expect(data?.placementSuggestion).toContain("section opening");
	});

	it("returns deterministic ghost themes when AI output is malformed", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not json" });
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "competitor-1",
					competitorName: "IncumbentCo",
					competitorWeaknesses: ["slow mobilization"],
					ourDifferentiators: ["rapid transition governance"],
					isIncumbent: true,
				}],
			}));

		const result = await generateGhostThemeSuggestions("22222222-2222-4222-8222-222222222222");

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data?.[0]).toMatchObject({
			competitorId: "competitor-1",
			competitorName: "IncumbentCo",
			subtletyLevel: 2,
			status: "pending",
		});
		expect(result.data?.[0]?.statement).toContain("rapid transition governance");
		expect(result.data?.[0]?.statement).toContain("slow mobilization");
		expect(result.data?.[0]?.phrasings.length).toBeGreaterThan(1);
	});

	it("does not suggest win themes for evaluation criteria already covered by existing themes", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "22222222-2222-4222-8222-222222222222",
					title: "Digital public records platform",
					organization: "Ministry of ICT",
					sourceId: "rfp-ict-001",
					deadline: null,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "55555555-5555-4555-8555-555555555555",
					requirementNumber: "M.2.1",
					title: "Technical evaluation approach",
					requirementText: "Evaluation criteria: technical approach carries 40 percent of the score.",
					sourceSection: "Section M.2.1",
					category: "technical",
					subcategory: null,
					priority: "mandatory",
					evaluationWeight: 40,
					responseStrategy: null,
					complianceStatus: "partial",
					metadata: { workflow: { state: "accepted" } },
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "11111111-1111-4111-8111-111111111111",
					themeStatement: "Existing technical score theme.",
					evaluationCriteriaIds: ["55555555-5555-4555-8555-555555555555"],
				}],
			}));

		const result = await getThemeSuggestions("22222222-2222-4222-8222-222222222222");

		expect(result.success).toBe(true);
		expect(result.data).toEqual([]);
	});

	it("builds reviewable response win theme seeds from accepted requirements", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "22222222-2222-4222-8222-222222222222",
					title: "Digital public records platform",
					organization: "Ministry of ICT",
					sourceId: "rfp-ict-001",
					deadline: null,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [
					{
						id: "55555555-5555-4555-8555-555555555555",
						requirementNumber: "M.2.1",
						title: "Technical evaluation approach",
						requirementText: "Evaluation criteria: technical approach carries 40 percent of the score.",
						sourceSection: "Section M.2.1",
						category: "technical",
						subcategory: null,
						priority: "mandatory",
						evaluationWeight: 40,
						responseStrategy: null,
						complianceStatus: "partial",
						metadata: { workflow: { state: "accepted" } },
					},
					{
						id: "66666666-6666-4666-8666-666666666666",
						requirementNumber: "L.3.4",
						title: "Implementation work plan",
						requirementText: "Provide a detailed work plan with milestones and risk controls.",
						sourceSection: "Section L.3.4",
						category: "management",
						subcategory: null,
						priority: "mandatory",
						evaluationWeight: null,
						responseStrategy: "Show governance, schedule control, and delivery assurance.",
						complianceStatus: "partial",
						metadata: { workflow: { state: "accepted" } },
					},
				],
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await getResponseWinThemeSeedReview("22222222-2222-4222-8222-222222222222");

		expect(result.success).toBe(true);
		expect(result.data).toMatchObject({
			acceptedRequirementCount: 2,
			evaluationCriteriaCount: 1,
		});
		expect(result.data?.seeds[0]).toMatchObject({
			evaluationCriteriaIds: ["55555555-5555-4555-8555-555555555555"],
			requirementIds: expect.arrayContaining([
				"55555555-5555-4555-8555-555555555555",
			]),
			targetDocumentTypes: ["technical_approach"],
		});
		expect(result.data?.seeds[0]?.supportingEvidence?.join("\n")).toContain("Evaluator criterion 55555555-5555-4555-8555-555555555555");
	});

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

	it("suggests criteria mappings from accepted evaluation requirements and active themes", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "55555555-5555-4555-8555-555555555555",
					requirementNumber: "M.2.1",
					title: "Technical evaluation approach",
					requirementText: "Evaluation criteria: technical approach carries 40 percent of the score.",
					sourceSection: "Section M.2.1",
					category: "technical",
					subcategory: null,
					priority: "mandatory",
					evaluationWeight: 40,
					responseStrategy: "Tie technical controls to delivery evidence and measurable risk reduction.",
					complianceStatus: "partial",
					metadata: { workflow: { state: "accepted" } },
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [
					{
						id: "11111111-1111-4111-8111-111111111111",
						themeStatement: "Technical delivery proof backed by measurable controls.",
						shortVersion: "Technical delivery proof",
						themeType: "proof_point",
						supportingEvidence: ["Delivery evidence and technical controls reduce evaluator risk."],
						evaluationCriteriaIds: [],
						keywords: ["technical", "delivery", "evidence"],
						isActive: true,
					},
					{
						id: "33333333-3333-4333-8333-333333333333",
						themeStatement: "Already mapped technical score certainty.",
						shortVersion: "Mapped technical score",
						themeType: "differentiator",
						supportingEvidence: ["Evaluator criterion 55555555-5555-4555-8555-555555555555"],
						evaluationCriteriaIds: ["55555555-5555-4555-8555-555555555555"],
						keywords: ["technical"],
						isActive: true,
					},
				],
			}));

		const result = await suggestCriteriaMappings("22222222-2222-4222-8222-222222222222");

		expect(result.success).toBe(true);
		expect(result.data?.[0]).toMatchObject({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			criteriaId: "55555555-5555-4555-8555-555555555555",
			criteriaName: "Section M.2.1: Technical evaluation approach",
			criteriaWeight: 40,
			isAdequate: true,
		});
		expect(result.data?.[0]?.mappedThemes).toEqual([
			{
				themeId: "33333333-3333-4333-8333-333333333333",
				relevanceScore: 100,
				notes: "Already mapped to this evaluator criterion.",
			},
			expect.objectContaining({
				themeId: "11111111-1111-4111-8111-111111111111",
				relevanceScore: expect.any(Number),
				notes: expect.stringContaining("technical"),
			}),
		]);
	});

	it("falls back to deterministic injection suggestions when AI output is malformed", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not json" });
		const insertedValues: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ id: "22222222-2222-4222-8222-222222222222" }] }))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "33333333-3333-4333-8333-333333333333",
					opportunityId: "22222222-2222-4222-8222-222222222222",
					themeStatement: "Datacraft reduces delivery risk with proven implementation controls.",
					shortVersion: "Proven delivery controls",
					themeType: "risk_mitigation",
					supportingEvidence: ["Three similar migrations completed on time", "ISO 27001 delivery governance"],
					keywords: ["risk", "delivery", "controls"],
					evaluationCriteriaIds: ["criteria-1"],
					targetSections: ["Technical Approach", "Transition Plan"],
					isActive: true,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "occ-1",
					themeId: "33333333-3333-4333-8333-333333333333",
					sectionName: "Technical Approach",
					textExcerpt: "Existing delivery controls mention.",
				}],
			}));
		dbMock.insert.mockImplementation(() => createChain({
			onValues: (value) => insertedValues.push(value),
			result: [{
				id: "injection-1",
				themeId: "33333333-3333-4333-8333-333333333333",
				documentId: "22222222-2222-4222-8222-222222222222",
				sectionId: "transition-plan",
				sectionName: "Transition Plan",
				pageNumber: 1,
				textContext: "Transition Plan section context for deterministic win-theme reinforcement.",
				suggestedText: "Proven delivery controls Proof: Three similar migrations completed on time; ISO 27001 delivery governance.",
				injectionType: "enhance",
				rationale: "Deterministic fallback from active win theme with keywords: risk, delivery, controls.",
				impactScore: 0.86,
				status: "pending",
				createdAt: new Date("2026-05-27T00:00:00.000Z"),
			}],
		}));

		const result = await generateInjectionSuggestions({
			opportunityId: "22222222-2222-4222-8222-222222222222",
			maxSuggestions: 1,
		});

		expect(result.success).toBe(true);
		expect(insertedValues).toEqual([
			expect.objectContaining({
				sectionId: "transition-plan",
				sectionName: "Transition Plan",
				injectionType: "enhance",
				status: "pending",
				suggestedText: expect.stringContaining("Proven delivery controls"),
				rationale: expect.stringContaining("Deterministic fallback"),
			}),
		]);
		expect(result.data?.[0]).toMatchObject({
			themeId: "33333333-3333-4333-8333-333333333333",
			sectionName: "Transition Plan",
			impactScore: 86,
			impactLevel: "high",
		});
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
