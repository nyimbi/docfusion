import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "content-governor-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "content-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "content-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
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
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
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
		insert: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionContentGovernanceWorkflow } from "@/lib/actions/content-governance-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseSnippet: Record<string, any> = {
	id: "snippet-1",
	name: "Programme Management Narrative",
	shortcut: "/pm",
	content: {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text: "Datacraft provides disciplined programme delivery." }],
			},
		],
	},
	placeholders: [],
	description: "Reusable project-management response language",
	tags: ["delivery"],
	category: "management",
	createdBy: "author-1",
	organizationId: "org-1",
	useCount: 7,
	isPublic: true,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const baseAnalytics: Record<string, any> = {
	id: "analytics-1",
	snippetId: "snippet-1",
	aiTags: [],
	keyTerms: [],
	contentType: "management_approach",
	topicCategory: "delivery",
	sectors: [],
	technologies: [],
	complianceFrameworks: [],
	topicScores: {},
	freshnessStatus: "current",
	reviewDueDate: null,
	lastReviewedAt: new Date("2026-04-01T00:00:00.000Z"),
	qualityScore: 88,
	wordCount: 5,
	winCount: 2,
	lossCount: 1,
	winRate: 66.7,
	lastUsedAt: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "content-governor-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
	dbMock.insert.mockReset();
});

describe("content governance workflow", () => {
	it("marks a snippet for review, updates freshness analytics, and projects a review task", async () => {
		let analyticsPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseSnippet] }))
			.mockReturnValueOnce(createChain({ result: [baseAnalytics] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseAnalytics,
				freshnessStatus: "review_needed",
				reviewDueDate: new Date("2026-05-10T00:00:00.000Z"),
			}],
			onSet: (value) => {
				analyticsPatch = value;
			},
		}));

		const result = await transitionContentGovernanceWorkflow({
			snippetId: "snippet-1",
			action: "mark_review_needed",
			reason: "Needs latest delivery credentials",
			reviewDueDate: "2026-05-10T00:00:00.000Z",
			assignedTo: "reviewer-1",
		});

		expect(result).toMatchObject({
			snippetId: "snippet-1",
			fromState: "current",
			toState: "review_needed",
			workflowInstanceId: "content-workflow-1",
			taskProjected: true,
		});
		expect(analyticsPatch).toMatchObject({
			freshnessStatus: "review_needed",
			reviewDueDate: new Date("2026-05-10T00:00:00.000Z"),
			wordCount: 5,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "content_library_governance",
			subjectType: "template_snippet",
			subjectId: "snippet-1",
			toState: "review_needed",
			assignedTo: "reviewer-1",
			assignedRole: "content_governor",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "content-workflow-1",
			taskKey: "content-governance:snippet-1",
			state: "open",
			assignedTo: "reviewer-1",
			assignedRole: "content_governor",
		}));
	});

	it("approves reviewed content as current and completes the governance task", async () => {
		let analyticsPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseSnippet] }))
			.mockReturnValueOnce(createChain({
				result: [{
					...baseAnalytics,
					freshnessStatus: "review_needed",
					reviewDueDate: new Date("2026-05-10T00:00:00.000Z"),
				}],
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseAnalytics,
				freshnessStatus: "current",
				reviewDueDate: null,
				qualityScore: 94,
			}],
			onSet: (value) => {
				analyticsPatch = value;
			},
		}));

		const result = await transitionContentGovernanceWorkflow({
			snippetId: "snippet-1",
			action: "approve_current",
			reason: "Validated against current Datacraft delivery evidence",
			qualityScore: 94,
		});

		expect(result).toMatchObject({
			fromState: "review_needed",
			toState: "current",
			taskProjected: true,
		});
		expect(analyticsPatch).toMatchObject({
			freshnessStatus: "current",
			reviewDueDate: null,
			qualityScore: 94,
		});
		expect(analyticsPatch?.lastReviewedAt).toBeInstanceOf(Date);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "current",
			terminal: true,
			assignedRole: null,
			dueAt: null,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "completed",
			assignedRole: null,
			dueAt: null,
		}));
	});

	it("creates analytics state for a snippet with no existing governance row", async () => {
		let insertValues: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...baseSnippet, createdBy: "content-governor-1", organizationId: null }] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.insert.mockReturnValueOnce(createChain({
			result: [{
				...baseAnalytics,
				id: "analytics-2",
				freshnessStatus: "stale",
				reviewDueDate: new Date("2026-05-08T00:00:00.000Z"),
			}],
			onValues: (value) => {
				insertValues = value;
			},
		}));

		await transitionContentGovernanceWorkflow({
			snippetId: "snippet-1",
			action: "mark_stale",
			reason: "Case study metrics are expired",
			reviewDueDate: "2026-05-08T00:00:00.000Z",
		});

		expect(insertValues).toMatchObject({
			snippetId: "snippet-1",
			freshnessStatus: "stale",
			reviewDueDate: new Date("2026-05-08T00:00:00.000Z"),
			wordCount: 5,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "stale",
			priority: "high",
			assignedRole: "content_governor",
		}));
	});

	it("requires an authenticated org member or snippet owner to govern content", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseSnippet,
				createdBy: "author-2",
				organizationId: "other-org",
			}],
		}));

		await expect(
			transitionContentGovernanceWorkflow({
				snippetId: "snippet-1",
				action: "mark_review_needed",
				reason: "Needs review",
			})
		).rejects.toThrow("Unauthorized to govern this snippet");
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});

	it("requires reason and a valid quality score", async () => {
		await expect(
			transitionContentGovernanceWorkflow({
				snippetId: "snippet-1",
				action: "mark_review_needed",
				reason: " ",
			})
		).rejects.toThrow("Content governance transitions require a reason");

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseSnippet] }))
			.mockReturnValueOnce(createChain({ result: [baseAnalytics] }));

		await expect(
			transitionContentGovernanceWorkflow({
				snippetId: "snippet-1",
				action: "approve_current",
				reason: "Reviewed",
				qualityScore: 101,
			})
		).rejects.toThrow("Quality score must be between 0 and 100");
	});
});
