import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "strategist-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "strategy-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "strategy-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
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
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectAssignedOpportunityScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("strategist-1");
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
	transitionCompetitiveIntelWorkflow,
	transitionThemeConsistencyWorkflow,
	transitionThemeInjectionWorkflow,
	transitionWinThemeLifecycleWorkflow,
} from "@/lib/actions/competitive-win-theme-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const competitiveAnalysis = {
	id: "analysis-1",
	opportunityId: "opp-1",
	strengths: ["Deep local delivery"],
	weaknesses: [],
	opportunityFactors: [],
	threats: ["Incumbent discounting"],
	ourPosition: "challenger",
	primaryDifferentiators: ["Evidence-led implementation"],
	competitiveGaps: ["Incumbent relationship"],
	winStrategy: "Lead with delivery certainty",
	pricingStrategy: "best_value",
	aiInsights: [],
	analyzedAt: new Date("2026-05-01T00:00:00.000Z"),
	analyzedBy: "analyst-1",
	isOutdated: false,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const winTheme = {
	id: "theme-1",
	opportunityId: "opp-1",
	themeStatement: "Datacraft reduces implementation risk through evidence-led delivery.",
	shortVersion: "Evidence-led delivery certainty",
	themeType: "risk_mitigation",
	priority: 1,
	supportingEvidence: ["ISO-aligned controls", "Regional delivery references"],
	relatedProjects: [],
	evaluationCriteriaIds: ["criterion-1"],
	ghostTheme: null,
	targetCompetitor: null,
	keywords: ["evidence", "delivery"],
	variations: [],
	targetSections: ["management approach"],
	minOccurrences: 3,
	isActive: true,
	createdBy: "strategist-1",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const injection = {
	id: "injection-1",
	themeId: "theme-1",
	documentId: "doc-1",
	sectionId: "11111111-1111-1111-1111-111111111111",
	sectionName: "Management Approach",
	pageNumber: 4,
	textContext: "Our delivery model is agile.",
	suggestedText: "Our delivery model is agile and evidence-led.",
	injectionType: "enhance",
	rationale: "Strengthens the primary risk mitigation theme",
	impactScore: 0.88,
	relevanceScore: 0.84,
	priorityScore: 0.86,
	status: "pending",
	acceptedText: null,
	acceptedBy: null,
	acceptedAt: null,
	reviewNotes: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
};

const themeAnalysis = {
	id: "theme-analysis-1",
	opportunityId: "opp-1",
	analyzedAt: new Date("2026-05-01T00:00:00.000Z"),
	analyzedBy: "ai",
	documentVersionId: null,
	analysisRunId: null,
	totalThemes: 2,
	averageCoverage: 72,
	consistencyScore: 68,
	winProbabilityImpact: 6,
	coverageByVolume: [],
	themeDistribution: [],
	gaps: [],
	criticalGapCount: 1,
	majorGapCount: 2,
	minorGapCount: 0,
	recommendations: [{ type: "add_occurrence", priority: "high", description: "Add risk theme" }],
	highPriorityRecommendations: 1,
	previousAnalysisId: null,
	coverageChange: null,
	consistencyChange: null,
	analysisDurationMs: 240,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "strategist-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("competitive and win-theme workflows", () => {
	it("marks competitive intelligence stale and projects a refresh task", async () => {
		let patch: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [competitiveAnalysis],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...competitiveAnalysis, isOutdated: true }],
			onSet: (value) => {
				patch = value;
			},
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await transitionCompetitiveIntelWorkflow({
			analysisId: "analysis-1",
			action: "mark_stale",
			reason: "New incumbent pricing signal",
			assignedTo: "intel-lead-1",
		});

		expect(result).toMatchObject({
			subjectId: "analysis-1",
			opportunityId: "opp-1",
			fromState: "current",
			toState: "stale",
			taskProjected: true,
		});
		expect(patch).toMatchObject({ isOutdated: true });
		expect(wheres).toHaveLength(2);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "competitive_intelligence_governance",
			subjectType: "competitive_analysis",
			toState: "stale",
			assignedRole: "competitive_intel_lead",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "competitive-intel:analysis-1",
			state: "open",
			priority: "high",
		}));
	});

	it("archives a win theme and records a terminal lifecycle transition", async () => {
		let patch: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [winTheme],
			onWhere: (value) => {
				wheres.push(value);
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...winTheme, isActive: false }],
			onSet: (value) => {
				patch = value;
			},
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await transitionWinThemeLifecycleWorkflow({
			themeId: "theme-1",
			action: "archive",
			reason: "Theme conflicts with revised capture strategy",
		});

		expect(result).toMatchObject({
			fromState: "active",
			toState: "archived",
			opportunityId: "opp-1",
		});
		expect(patch).toMatchObject({ isActive: false });
		expect(wheres).toHaveLength(2);
		expectAssignedOpportunityScope(wheres[0]);
		expectAssignedOpportunityScope(wheres[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "win_theme_lifecycle",
			subjectType: "win_theme",
			toState: "archived",
			terminal: true,
			assignedRole: null,
		}));
	});

	it("accepts a theme injection with modifications and preserves reviewer text", async () => {
		let patch: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [injection],
				onWhere: (value) => {
					wheres.push(value);
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [winTheme],
				onWhere: (value) => {
					wheres.push(value);
				},
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...injection,
				status: "modified",
				acceptedText: "Our agile model is evidence-led and governed by measurable decision gates.",
			}],
			onSet: (value) => {
				patch = value;
			},
			onWhere: (value) => {
				wheres.push(value);
			},
		}));

		const result = await transitionThemeInjectionWorkflow({
			injectionId: "injection-1",
			action: "modify",
			reason: "Improve narrative continuity",
			modifiedText: "Our agile model is evidence-led and governed by measurable decision gates.",
		});

		expect(result).toMatchObject({
			fromState: "pending",
			toState: "modified",
			opportunityId: "opp-1",
		});
		expect(patch).toMatchObject({
			status: "modified",
			acceptedText: "Our agile model is evidence-led and governed by measurable decision gates.",
			acceptedBy: "strategist-1",
			reviewNotes: "Improve narrative continuity",
		});
		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expectAssignedOpportunityScope(where);
		}
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "win_theme_injection",
			actionUrl: "/documents/doc-1",
			terminal: true,
		}));
	});

	it("flags theme consistency gaps without mutating analysis rows", async () => {
		let analysisWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [themeAnalysis],
			onWhere: (value) => {
				analysisWhere = value;
			},
		}));

		const result = await transitionThemeConsistencyWorkflow({
			analysisId: "theme-analysis-1",
			action: "flag_gaps",
			reason: "Critical theme missing from management approach",
			assignedTo: "strategist-2",
		});

		expect(result).toMatchObject({
			fromState: "critical_gaps",
			toState: "critical_gaps",
			opportunityId: "opp-1",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
		expectAssignedOpportunityScope(analysisWhere);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "win_theme_consistency",
			subjectType: "theme_analysis_result",
			priority: "critical",
			assignedRole: "proposal_strategist",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "theme-consistency:theme-analysis-1",
			state: "open",
			priority: "critical",
		}));
	});

	it("requires reasons and modified text where applicable", async () => {
		await expect(
			transitionCompetitiveIntelWorkflow({
				analysisId: "analysis-1",
				action: "start_review",
				reason: " ",
			})
		).rejects.toThrow("Competitive intelligence transitions require a reason");

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [injection] }))
			.mockReturnValueOnce(createChain({ result: [winTheme] }));

		await expect(
			transitionThemeInjectionWorkflow({
				injectionId: "injection-1",
				action: "modify",
				reason: "Needs better flow",
			})
		).rejects.toThrow("Modified theme injection requires modified text");
	});
});
