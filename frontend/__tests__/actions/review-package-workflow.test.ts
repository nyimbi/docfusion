import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserContextMock } = vi.hoisted(() => ({
	requireUserContextMock: vi.fn(async () => ({
		userId: "review-lead-1",
		organizationId: "org-1",
	})),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "review-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "review-task-1" })),
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

function expectAssignedReviewScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("review-lead-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionReviewPackageWorkflow } from "@/lib/actions/review-package-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const review = {
	id: "review-1",
	opportunityId: "opp-1",
	reviewType: "red",
	reviewName: "Red Team Review",
	description: "Formal proposal review",
	reviewNumber: 1,
	scheduledDate: new Date("2026-05-10T00:00:00.000Z"),
	scheduledEndDate: new Date("2026-05-12T00:00:00.000Z"),
	startedAt: null,
	completedAt: null,
	status: "draft",
	documentVersionId: null,
	documentSnapshot: null,
	scopeType: "full",
	scopedSections: [],
	scopedVolumes: [],
	reviewInstructions: null,
	focusAreas: ["responsiveness", "win themes"],
	evaluationCriteriaIds: [],
	overallScore: null,
	maxPossibleScore: null,
	recommendation: null,
	executiveSummary: null,
	keyFindings: null,
	totalComments: 0,
	criticalIssues: 0,
	majorIssues: 0,
	minorIssues: 0,
	editorialIssues: 0,
	resolvedIssues: 0,
	strengthsIdentified: 0,
	scoreBreakdown: [],
	previousReviewId: null,
	improvementFromPrevious: null,
	lastExportedAt: null,
	exportFormat: null,
	createdBy: "review-lead-1",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const reviewerA = {
	id: "reviewer-1",
	reviewId: "review-1",
	userId: "user-a",
	userName: "Amina",
	userEmail: "amina@datacraft.co.ke",
	role: "lead",
	expertise: [],
	yearsExperience: null,
	assignedSections: [],
	assignedVolumes: [],
	assignedCriteria: [],
	reviewerInstructions: null,
	expectedCompletionDate: null,
	status: "completed",
	acceptedAt: null,
	declinedReason: null,
	startedAt: null,
	completedAt: new Date("2026-05-11T00:00:00.000Z"),
	sectionsReviewed: 3,
	totalAssignedSections: 3,
	commentsSubmitted: 5,
	scoresSubmitted: 3,
	conflictOfInterest: false,
	conflictNotes: null,
	conflictAcknowledgedAt: null,
	ndaSigned: true,
	ndaSignedAt: null,
	lastReminderSentAt: null,
	reminderCount: 0,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

const reviewerB = {
	...reviewerA,
	id: "reviewer-2",
	userId: "user-b",
	userName: "Brian",
	status: "completed",
};

const openCriticalComment = {
	id: "comment-1",
	reviewId: "review-1",
	reviewerId: "reviewer-1",
	sectionId: null,
	volumeId: null,
	pageNumber: null,
	lineNumber: null,
	paragraphNumber: null,
	selectedText: null,
	textRange: null,
	commentType: "critical",
	severity: "critical",
	category: "compliance",
	subcategory: null,
	title: "Missing mandatory response",
	comment: "A mandatory requirement is not addressed.",
	suggestedChange: null,
	rationale: null,
	evaluationCriteriaId: null,
	evaluationCriteriaRef: null,
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
	isAnonymous: true,
	priorityRank: 1,
	attachments: [],
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "review-lead-1",
		organizationId: "org-1",
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("review package workflow", () => {
	it("freezes a review package with a document snapshot and projects reviewer work", async () => {
		let reviewPatch: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [review], onWhere: (value) => wheres.push(value) }))
			.mockReturnValueOnce(createChain({ result: [{ ...reviewerA, status: "pending" }, { ...reviewerB, status: "pending" }], onWhere: (value) => wheres.push(value) }))
			.mockReturnValueOnce(createChain({ result: [], onWhere: (value) => wheres.push(value) }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...review, status: "scheduled", documentSnapshot: "sha256:abc123" }],
			onSet: (value) => {
				reviewPatch = value;
			},
			onWhere: (value) => wheres.push(value),
		}));

		const result = await transitionReviewPackageWorkflow({
			reviewId: "review-1",
			action: "freeze_package",
			reason: "Freeze the Red Team package",
			documentSnapshot: "sha256:abc123",
			documentVersionId: "11111111-1111-1111-1111-111111111111",
			assignedTo: "review-lead-1",
		});

		expect(result).toMatchObject({
			reviewId: "review-1",
			opportunityId: "opp-1",
			fromState: "draft",
			toState: "scheduled",
			taskProjected: true,
		});
		expect(reviewPatch).toMatchObject({
			status: "scheduled",
			documentSnapshot: "sha256:abc123",
			documentVersionId: "11111111-1111-1111-1111-111111111111",
		});
		for (const where of wheres) {
			expectAssignedReviewScope(where);
		}
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "review_package_gate",
			subjectType: "proposal_review",
			toState: "scheduled",
			assignedRole: "review_lead",
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "review-package:review-1",
			state: "open",
			assignedRole: "review_lead",
		}));
	});

	it("records reviewer completion without completing the package", async () => {
		let reviewerPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...review, status: "in_progress" }] }))
			.mockReturnValueOnce(createChain({ result: [{ ...reviewerA, status: "in_progress" }, { ...reviewerB, status: "pending" }] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...reviewerA, status: "completed" }],
			onSet: (value) => {
				reviewerPatch = value;
			},
		}));

		const result = await transitionReviewPackageWorkflow({
			reviewId: "review-1",
			action: "complete_reviewer",
			reviewerId: "reviewer-1",
			reason: "Reviewer submitted scores and comments",
		});

		expect(result).toMatchObject({
			fromState: "in_progress",
			toState: "reviewer_completed",
		});
		expect(reviewerPatch).toMatchObject({
			status: "completed",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "reviewer_completed",
			terminal: false,
			metadata: expect.objectContaining({
				completedReviewerCount: 1,
			}),
		}));
	});

	it("blocks approval when critical comments are unresolved", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...review, status: "in_progress" }] }))
			.mockReturnValueOnce(createChain({ result: [reviewerA, reviewerB] }))
			.mockReturnValueOnce(createChain({ result: [openCriticalComment] }));

		await expect(
			transitionReviewPackageWorkflow({
				reviewId: "review-1",
				action: "approve_package",
				reason: "Ready to approve",
			})
		).rejects.toThrow("Review package cannot be approved with unresolved critical comments");
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("approves a package after quorum and critical issue closure", async () => {
		let reviewPatch: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...review, status: "in_progress" }] }))
			.mockReturnValueOnce(createChain({ result: [reviewerA, reviewerB] }))
			.mockReturnValueOnce(createChain({
				result: [{ ...openCriticalComment, resolutionStatus: "resolved" }],
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...review,
				status: "completed",
				recommendation: "ready_to_submit",
				completedAt: new Date("2026-05-12T00:00:00.000Z"),
			}],
			onSet: (value) => {
				reviewPatch = value;
			},
		}));

		const result = await transitionReviewPackageWorkflow({
			reviewId: "review-1",
			action: "approve_package",
			reason: "All critical findings closed",
			executiveSummary: "Red Team approves final response quality.",
			minCompletedReviewers: 2,
		});

		expect(result).toMatchObject({
			fromState: "in_progress",
			toState: "approved",
		});
		expect(reviewPatch).toMatchObject({
			status: "completed",
			recommendation: "ready_to_submit",
			executiveSummary: "Red Team approves final response quality.",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "approved",
			terminal: true,
			assignedRole: null,
		}));
	});

	it("requires an authority role to waive review findings", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...review, status: "in_progress" }] }))
			.mockReturnValueOnce(createChain({ result: [reviewerA, reviewerB] }))
			.mockReturnValueOnce(createChain({ result: [openCriticalComment] }));

		await expect(
			transitionReviewPackageWorkflow({
				reviewId: "review-1",
				action: "waive_findings",
				reason: "Executive risk acceptance",
			})
		).rejects.toThrow("Waiving review findings requires an authority role");
	});
});
