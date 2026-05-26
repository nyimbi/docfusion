import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "review-lead-1", organizationId: "org-1" })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "comment-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "runtime-comment-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
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
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
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

function expectOpportunityTenantScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("org-1");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("review-lead-1");
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

import { transitionReviewCommentWorkflow } from "@/lib/actions/review-comment-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseComment: Record<string, any> = {
	id: "11111111-1111-4111-8111-111111111111",
	reviewId: "review-1",
	reviewerId: "reviewer-1",
	sectionId: "22222222-2222-4222-8222-222222222222",
	volumeId: null,
	pageNumber: null,
	lineNumber: null,
	paragraphNumber: null,
	selectedText: "unsupported claim",
	textRange: null,
	commentType: "weakness",
	severity: "major",
	category: "technical",
	subcategory: null,
	title: "Substantiate integration claim",
	comment: "The integration claim needs evidence and a specific acceptance test.",
	suggestedChange: "Add prior project evidence and acceptance test detail.",
	rationale: null,
	evaluationCriteriaId: null,
	evaluationCriteriaRef: "M.2.1",
	impactOnScore: "high",
	relatedWinThemeId: null,
	themeAlignment: null,
	tags: [],
	resolutionStatus: "open",
	resolutionNotes: null,
	resolutionAction: null,
	resolvedBy: null,
	resolvedAt: null,
	verifiedBy: null,
	verifiedAt: null,
	verificationNotes: null,
	parentCommentId: null,
	replyCount: 0,
	duplicateOfId: null,
	isDuplicate: false,
	isAnonymous: false,
	priorityRank: 1,
	attachments: [],
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const existingTask: Record<string, any> = {
	id: "task-1",
	organizationId: "org-1",
	opportunityId: "opp-1",
	taskNumber: "RC-11111111",
	title: "Substantiate integration claim",
	description: "The integration claim needs evidence and a specific acceptance test.",
	taskType: "review",
	taskCategory: "technical",
	sectionId: baseComment.sectionId,
	volumeId: null,
	assignedTo: "writer-1",
	assignedToEmail: "writer@example.com",
	assignedBy: "review-lead-1",
	assignedAt: new Date("2026-05-01T00:00:00.000Z"),
	dueDate: new Date("2026-05-08T00:00:00.000Z"),
	status: "assigned",
	priority: "high",
	progress: 0,
	sourceType: "review_comment",
	sourceId: baseComment.id,
	descriptionJson: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.update.mockReset();
	dbMock.insert.mockReset();
});

describe("review comment workflow", () => {
	it("projects an open review comment into an assigned proposal task", async () => {
		let commentUpdate: Record<string, unknown> | undefined;
		let taskInsert: Record<string, unknown> | undefined;
		let commentWhere: unknown;
		let reviewWhere: unknown;
		let taskWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [baseComment],
				onWhere: (value) => {
					commentWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ opportunityId: "opp-1" }],
				onWhere: (value) => {
					reviewWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					taskWhere = value;
				},
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [baseComment],
			onSet: (value) => {
				commentUpdate = value;
			},
		}));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				result: [{ ...existingTask, id: "task-created-1", assignedTo: "writer-1" }],
				onValues: (value) => {
					taskInsert = value;
				},
			}))
			.mockReturnValueOnce(createChain());

		const result = await transitionReviewCommentWorkflow({
			commentId: baseComment.id,
			action: "project_task",
			reason: "Major weakness needs owner",
			assignedTo: "writer-1",
			assignedToEmail: "writer@example.com",
			dueAt: "2026-05-07T00:00:00.000Z",
		});

		expect(result).toMatchObject({
			commentId: baseComment.id,
			opportunityId: "opp-1",
			fromState: "open",
			toState: "open",
			taskId: "task-created-1",
		});
		expect(commentUpdate).toMatchObject({
			resolutionStatus: "open",
		});
		const commentSql = collectSqlFragments(commentWhere).join(" ");
		expect(commentSql).toContain("organization_id");
		expect(commentSql).toContain("org-1");
		expectOpportunityTenantScope(commentWhere);
		expectOpportunityTenantScope(reviewWhere);
		expectOpportunityTenantScope(taskWhere);
		expect(taskInsert).toMatchObject({
			organizationId: "org-1",
			opportunityId: "opp-1",
			taskNumber: "RC-11111111",
			title: "Substantiate integration claim",
			status: "assigned",
			sourceType: "review_comment",
			sourceId: baseComment.id,
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "review_comment_resolution",
			organizationId: "org-1",
			subjectType: "review_comment",
			toState: "open",
			priority: "high",
			assignedTo: "writer-1",
			assignedRole: "proposal_writer",
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: `review-comment:${baseComment.id}`,
			state: "open",
			priority: "high",
		}));
	});

	it("resolves a comment and completes the projected task", async () => {
		let commentUpdate: Record<string, unknown> | undefined;
		let taskUpdate: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...baseComment, resolutionStatus: "in_progress" }] }))
			.mockReturnValueOnce(createChain({ result: [{ opportunityId: "opp-1" }] }))
			.mockReturnValueOnce(createChain({ result: [existingTask] }));
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [{ ...baseComment, resolutionStatus: "resolved", resolutionAction: "revised" }],
				onSet: (value) => {
					commentUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{ ...existingTask, status: "completed", progress: 100 }],
				onSet: (value) => {
					taskUpdate = value;
				},
			}));
		dbMock.insert.mockReturnValueOnce(createChain());

		const result = await transitionReviewCommentWorkflow({
			commentId: baseComment.id,
			action: "resolve",
			reason: "Revised the section and added evidence",
			resolutionAction: "revised",
		});

		expect(result.toState).toBe("resolved");
		expect(commentUpdate).toMatchObject({
			resolutionStatus: "resolved",
			resolutionAction: "revised",
			resolvedBy: "review-lead-1",
		});
		expect(taskUpdate).toMatchObject({
			status: "completed",
			progress: 100,
			completedBy: "review-lead-1",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "resolved",
			terminal: true,
			assignedRole: null,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "completed",
			assignedRole: null,
		}));
	});

	it("requires a resolution action when resolving", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseComment] }))
			.mockReturnValueOnce(createChain({ result: [{ opportunityId: "opp-1" }] }))
			.mockReturnValueOnce(createChain({ result: [existingTask] }));

		await expect(
			transitionReviewCommentWorkflow({
				commentId: baseComment.id,
				action: "resolve",
				reason: "Done",
			})
		).rejects.toThrow("requires a resolution action");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});
});
