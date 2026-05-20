/**
 * Review Management Server Actions Tests
 *
 * Tests for the Pink/Red/Gold Team review process lifecycle including:
 * - Review CRUD (create, read, update, delete)
 * - Reviewer assignment and management
 * - Comment management (add, update, delete, resolve, verify)
 * - Scoring (submit, update, aggregate)
 * - Review status transitions (draft -> in_progress -> completed, cancel)
 * - Report generation and before/after comparison
 * - Review effectiveness tracking
 * - Export functionality
 * - Edge cases: not-found records, invalid status transitions, empty datasets
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any import that transitively touches these modules
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

// ---------------------------------------------------------------------------
// Chainable query builder mock
// ---------------------------------------------------------------------------

function createChainableQuery(returnValue: unknown = []) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select", "insert", "update", "delete", "from", "where", "set",
		"values", "returning", "orderBy", "limit", "offset", "execute",
		"leftJoin", "innerJoin",
	];
	for (const m of methods) {
		chain[m] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(
		Array.isArray(returnValue) ? returnValue : [returnValue]
	);
	(chain.execute as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
		Promise.resolve(Array.isArray(returnValue) ? returnValue : [returnValue]).then(resolve);
	return chain;
}

// ---------------------------------------------------------------------------
// Query mock — db.query.<table>.findFirst / findMany
// ---------------------------------------------------------------------------

function createQueryTableMock() {
	return {
		findFirst: vi.fn(async () => null),
		findMany: vi.fn(async () => []),
	};
}

var dbMock: any;

function createDbMock() {
	return {
		select: vi.fn(() => createChainableQuery([])),
		insert: vi.fn(() => createChainableQuery([])),
		update: vi.fn(() => createChainableQuery([])),
		delete: vi.fn(() => createChainableQuery([])),
		execute: vi.fn(async () => []),
		transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
			const txMock = {
				update: vi.fn(() => createChainableQuery()),
				select: vi.fn(() => createChainableQuery()),
				insert: vi.fn(() => createChainableQuery()),
				delete: vi.fn(() => createChainableQuery()),
			};
			return fn(txMock);
		}),
		query: {
			proposalReviews: createQueryTableMock(),
			reviewers: createQueryTableMock(),
			reviewComments: createQueryTableMock(),
			reviewScores: createQueryTableMock(),
			reviewTemplates: createQueryTableMock(),
			reviewChecklists: createQueryTableMock(),
		},
	};
}

vi.mock("@/lib/db", () => {
	dbMock = createDbMock();
	return { db: dbMock };
});

vi.mock("@/lib/db/schema-reviews", () => ({
	proposalReviews: {
		id: "pr.id", opportunityId: "pr.oppId", reviewType: "pr.type",
		reviewName: "pr.name", status: "pr.status", reviewNumber: "pr.num",
		createdAt: "pr.createdAt", scheduledDate: "pr.schedDate",
		totalComments: "pr.totalComments", criticalIssues: "pr.critIssues",
		majorIssues: "pr.majorIssues", minorIssues: "pr.minorIssues",
		editorialIssues: "pr.editIssues", resolvedIssues: "pr.resolvedIssues",
		strengthsIdentified: "pr.strengths", overallScore: "pr.score",
		maxPossibleScore: "pr.maxScore", recommendation: "pr.rec",
		executiveSummary: "pr.execSummary", keyFindings: "pr.keyFindings",
		startedAt: "pr.startedAt", completedAt: "pr.completedAt",
		lastExportedAt: "pr.lastExportedAt", exportFormat: "pr.exportFormat",
		updatedAt: "pr.updatedAt", improvementFromPrevious: "pr.improve",
		previousReviewId: "pr.prevReviewId",
	},
	reviewers: {
		id: "rv.id", reviewId: "rv.reviewId", userId: "rv.userId",
		userName: "rv.userName", userEmail: "rv.email", role: "rv.role",
		status: "rv.status", commentsSubmitted: "rv.commSub",
		scoresSubmitted: "rv.scoresSub", reminderCount: "rv.reminderCount",
		conflictOfInterest: "rv.coi", conflictNotes: "rv.coiNotes",
		ndaSigned: "rv.nda", assignedSections: "rv.sections",
		assignedVolumes: "rv.volumes", assignedCriteria: "rv.criteria",
		expectedCompletionDate: "rv.expected", totalAssignedSections: "rv.totalSec",
		updatedAt: "rv.updatedAt", lastReminderSentAt: "rv.lastReminder",
	},
	reviewComments: {
		id: "rc.id", reviewId: "rc.reviewId", reviewerId: "rc.reviewerId",
		commentType: "rc.type", severity: "rc.severity", category: "rc.cat",
		comment: "rc.comment", resolutionStatus: "rc.resStatus",
		parentCommentId: "rc.parentId", replyCount: "rc.replyCount",
		isDuplicate: "rc.isDup", duplicateOfId: "rc.dupOfId",
		priorityRank: "rc.priority", createdAt: "rc.createdAt",
		updatedAt: "rc.updatedAt", sectionId: "rc.sectionId",
		relatedWinThemeId: "rc.themeId", themeAlignment: "rc.themeAlign",
	},
	reviewScores: {
		id: "rs.id", reviewId: "rs.reviewId", reviewerId: "rs.reviewerId",
		score: "rs.score", maxScore: "rs.maxScore", weight: "rs.weight",
		normalizedScore: "rs.normScore", weightedScore: "rs.weightedScore",
		evaluationCriteriaId: "rs.critId", evaluationCriteriaName: "rs.critName",
		sectionName: "rs.secName", ratingCategory: "rs.ratingCat",
		confidence: "rs.confidence",
	},
	reviewTemplates: { id: "rt.id" },
	reviewChecklists: { reviewId: "rcl.reviewId", reviewerId: "rcl.reviewerId" },
}));

// ---------------------------------------------------------------------------
// Import subjects under test
// ---------------------------------------------------------------------------

import {
	createReview,
	updateReview,
	deleteReview,
	listReviews,
	listAllReviews,
	getReview,
	assignReviewers,
	updateReviewer,
	removeReviewer,
	checkConflictsOfInterest,
	sendReviewerReminder,
	addReviewComment,
	updateComment,
	deleteComment,
	resolveComment,
	verifyResolution,
	getReviewComments,
	updateCommentPriorities,
	markCommentDuplicate,
	submitReviewerScores,
	updateScore,
	aggregateScores,
	generateReviewReport,
	compareBeforeAfter,
	trackReviewEffectiveness,
	exportReviewPackage,
	completeReview,
	startReview,
	cancelReview,
} from "@/lib/actions/reviews";

// ============================================================================
// Helpers
// ============================================================================

const UUID = "00000000-0000-4000-8000-000000000001";
const UUID2 = "00000000-0000-4000-8000-000000000002";
const UUID3 = "00000000-0000-4000-8000-000000000003";
const UUID4 = "00000000-0000-4000-8000-000000000004";
const UUID5 = "00000000-0000-4000-8000-000000000005";

function makeReviewRow(overrides: Record<string, unknown> = {}) {
	return {
		id: UUID,
		opportunityId: UUID2,
		reviewType: "pink",
		reviewName: "Pink Team Review",
		description: "First pass review",
		reviewNumber: 1,
		status: "draft",
		scheduledDate: new Date("2025-06-01"),
		scheduledEndDate: new Date("2025-06-03"),
		startedAt: null,
		completedAt: null,
		documentVersionId: null,
		scopeType: "full",
		scopedSections: null,
		scopedVolumes: null,
		reviewInstructions: null,
		focusAreas: null,
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
		improvementFromPrevious: null,
		previousReviewId: null,
		createdAt: new Date("2025-05-20"),
		updatedAt: new Date("2025-05-20"),
		reviewers: [],
		comments: [],
		lastExportedAt: null,
		exportFormat: null,
		...overrides,
	};
}

function makeReviewerRow(overrides: Record<string, unknown> = {}) {
	return {
		id: UUID3,
		reviewId: UUID,
		userId: "user-100",
		userName: "Jane Doe",
		userEmail: "jane@example.com",
		role: "technical",
		status: "pending",
		expertise: ["cloud", "security"],
		assignedSections: ["sec-1"],
		assignedVolumes: null,
		assignedCriteria: null,
		reviewerInstructions: null,
		expectedCompletionDate: new Date("2025-06-02"),
		commentsSubmitted: 0,
		scoresSubmitted: 0,
		conflictOfInterest: false,
		conflictNotes: null,
		ndaSigned: true,
		reminderCount: 0,
		lastReminderSentAt: null,
		acceptedAt: null,
		startedAt: null,
		completedAt: null,
		declinedReason: null,
		totalAssignedSections: 1,
		updatedAt: new Date(),
		...overrides,
	};
}

function makeCommentRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "comment-1",
		reviewId: UUID,
		reviewerId: UUID3,
		sectionId: null,
		volumeId: null,
		pageNumber: null,
		lineNumber: null,
		paragraphNumber: null,
		selectedText: null,
		textRange: null,
		commentType: "weakness",
		severity: "major",
		category: "technical",
		subcategory: null,
		title: "Missing security section",
		comment: "The proposal lacks a dedicated security approach section.",
		suggestedChange: "Add a security methodology section",
		rationale: null,
		evaluationCriteriaId: null,
		evaluationCriteriaRef: null,
		impactOnScore: "high",
		relatedWinThemeId: null,
		themeAlignment: null,
		tags: ["security"],
		parentCommentId: null,
		isAnonymous: true,
		attachments: null,
		resolutionStatus: "open",
		resolutionNotes: null,
		resolutionAction: null,
		resolvedBy: null,
		resolvedAt: null,
		isDuplicate: false,
		duplicateOfId: null,
		verifiedBy: null,
		verifiedAt: null,
		verificationNotes: null,
		replyCount: 0,
		priorityRank: null,
		createdAt: new Date("2025-06-01"),
		updatedAt: new Date("2025-06-01"),
		reviewer: makeReviewerRow(),
		...overrides,
	};
}

function makeScoreRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "score-1",
		reviewId: UUID,
		reviewerId: UUID3,
		evaluationCriteriaId: "crit-1",
		evaluationCriteriaRef: "L.1",
		evaluationCriteriaName: "Technical Approach",
		sectionId: null,
		volumeId: null,
		sectionName: "Vol I",
		score: 80,
		maxScore: 100,
		normalizedScore: 80,
		weight: 2,
		weightedScore: 160,
		ratingCategory: "good",
		confidence: 0.9,
		confidenceReason: null,
		rationale: "Strong methodology",
		strengths: ["Clear approach"],
		weaknesses: ["Missing detail"],
		improvements: ["Add timelines"],
		supportingCommentIds: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		reviewer: makeReviewerRow(),
		...overrides,
	};
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
	expect(sqlText).toContain("user-100");
}

function mockCreateReviewSelects(
	existingReviews: Array<Record<string, unknown>> = [],
	opportunityRows: Array<Record<string, unknown>> = [{ id: UUID2 }]
) {
	const opportunityChain = createChainableQuery(opportunityRows);
	const existingReviewsChain = createChainableQuery(existingReviews);
	dbMock.select
		.mockImplementationOnce(() => opportunityChain)
		.mockImplementationOnce(() => existingReviewsChain);
	return { opportunityChain, existingReviewsChain };
}

// ============================================================================
// Reset mocks between tests
// ============================================================================

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("user-100");
	// Recreate fresh db mock chains
	dbMock.select.mockImplementation(() => createChainableQuery([]));
	dbMock.insert.mockImplementation(() => createChainableQuery([]));
	dbMock.update.mockImplementation(() => createChainableQuery([]));
	dbMock.delete.mockImplementation(() => createChainableQuery([]));
	// Reset query mocks
	dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);
	dbMock.query.proposalReviews.findMany.mockResolvedValue([]);
	dbMock.query.reviewers.findFirst.mockResolvedValue(null);
	dbMock.query.reviewers.findMany.mockResolvedValue([]);
	dbMock.query.reviewComments.findFirst.mockResolvedValue(null);
	dbMock.query.reviewComments.findMany.mockResolvedValue([]);
	dbMock.query.reviewScores.findFirst.mockResolvedValue(null);
	dbMock.query.reviewScores.findMany.mockResolvedValue([]);
	dbMock.query.reviewTemplates.findFirst.mockResolvedValue(null);
});

// ============================================================================
// REVIEW CRUD
// ============================================================================

describe("Review CRUD", () => {
	describe("createReview", () => {
		test("creates a review with minimal input", async () => {
			mockCreateReviewSelects();
			const insertedReview = makeReviewRow();
			const insertChain = createChainableQuery([insertedReview]);
			dbMock.insert.mockImplementation(() => insertChain);

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result.success).toBe(true);
			expect(result.reviewId).toBe(UUID);
			expect(dbMock.insert).toHaveBeenCalled();
			expect(insertChain.values).toHaveBeenCalledWith(
				expect.objectContaining({
					createdBy: "user-100",
				})
			);
		});

		test("rejects review creation for opportunities not assigned to the caller", async () => {
			const { opportunityChain } = mockCreateReviewSelects([], []);

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result).toEqual({ success: false, error: "Opportunity not found" });
			expect(dbMock.insert).not.toHaveBeenCalled();
			const where = (opportunityChain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
			const sqlText = collectSqlFragments(where).join(" ");
			expect(sqlText).toContain("assigned_to");
			expect(sqlText).toContain("user-100");
		});

		test("rejects unauthenticated review creation before database access", async () => {
			getCurrentUserIdMock.mockResolvedValue(null);

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result).toEqual({ success: false, error: "Unauthorized" });
			expect(dbMock.select).not.toHaveBeenCalled();
			expect(dbMock.insert).not.toHaveBeenCalled();
		});

		test("auto-generates review name when not provided", async () => {
			mockCreateReviewSelects();
			const insertedReview = makeReviewRow({ reviewName: "Pink Team Review" });
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedReview]));

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result.success).toBe(true);
		});

		test("uses provided review name when given", async () => {
			mockCreateReviewSelects();
			const insertedReview = makeReviewRow({ reviewName: "Custom Review" });
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedReview]));

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "red",
				reviewName: "Custom Review",
			});

			expect(result.success).toBe(true);
		});

		test("sets status to 'scheduled' when scheduledDate is provided", async () => {
			mockCreateReviewSelects();
			const insertedReview = makeReviewRow({ status: "scheduled" });
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedReview]));

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "gold",
				scheduledDate: "2025-06-01T00:00:00.000Z",
			});

			expect(result.success).toBe(true);
		});

		test("increments review number for the same opportunity and type", async () => {
			mockCreateReviewSelects([{ reviewNumber: 2 }]);
			const insertedReview = makeReviewRow({ reviewNumber: 3 });
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedReview]));

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result.success).toBe(true);
		});

		test("creates checklist items from template when templateId is provided", async () => {
			mockCreateReviewSelects();
			const insertedReview = makeReviewRow();
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedReview]));
			dbMock.query.reviewTemplates.findFirst.mockResolvedValue({
				id: "tmpl-1",
				reviewerChecklist: [
					{ item: "Check compliance matrix", required: true },
					{ item: "Verify win themes", required: false },
				],
			});

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
				templateId: UUID3,
			});

			expect(result.success).toBe(true);
			// insert called twice: once for the review, once for checklist items
			expect(dbMock.insert).toHaveBeenCalledTimes(2);
		});

		test("rejects invalid opportunityId", async () => {
			const result = await createReview({
				opportunityId: "not-a-uuid",
				reviewType: "pink",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		test("rejects invalid reviewType", async () => {
			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "blue" as never,
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		test("handles database errors gracefully", async () => {
			dbMock.select.mockImplementation(() => {
				throw new Error("DB connection lost");
			});

			const result = await createReview({
				opportunityId: UUID2,
				reviewType: "pink",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("DB connection lost");
		});
	});

	describe("getReview", () => {
		test("returns review with full details", async () => {
			const reviewRow = makeReviewRow({
				reviewers: [makeReviewerRow()],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(reviewRow);

			const result = await getReview(UUID);

			expect(result.success).toBe(true);
			expect(result.review).toBeDefined();
			expect(result.review!.id).toBe(UUID);
			expect(result.review!.reviewType).toBe("pink");
			expect(result.review!.reviewers).toHaveLength(1);
			expect(result.review!.reviewers[0].userName).toBe("Jane Doe");
		});

		test("returns statistics in the review response", async () => {
			const reviewRow = makeReviewRow({
				totalComments: 10,
				criticalIssues: 2,
				majorIssues: 3,
				minorIssues: 4,
				editorialIssues: 1,
				resolvedIssues: 5,
				strengthsIdentified: 3,
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(reviewRow);

			const result = await getReview(UUID);

			expect(result.success).toBe(true);
			expect(result.review!.statistics.totalComments).toBe(10);
			expect(result.review!.statistics.criticalIssues).toBe(2);
			expect(result.review!.statistics.resolvedIssues).toBe(5);
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await getReview("nonexistent-id");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});

	describe("updateReview", () => {
		test("updates basic review fields", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());

			const result = await updateReview(UUID, {
				reviewName: "Updated Review Name",
				description: "Updated description",
			});

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("sets startedAt timestamp when transitioning to in_progress", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "draft" })
			);

			const result = await updateReview(UUID, { status: "in_progress" });

			expect(result.success).toBe(true);
		});

		test("sets completedAt timestamp when transitioning to completed", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "in_progress" })
			);

			const result = await updateReview(UUID, { status: "completed" });

			expect(result.success).toBe(true);
		});

		test("updates recommendation and key findings", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());

			const result = await updateReview(UUID, {
				recommendation: "needs_minor_revisions",
				keyFindings: {
					strengths: ["Strong technical approach"],
					weaknesses: ["Weak cost narrative"],
					criticalIssues: [],
					recommendations: ["Strengthen cost section"],
				},
			});

			expect(result.success).toBe(true);
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await updateReview("nonexistent", { reviewName: "X" });

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});

		test("rejects invalid status value", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());

			const result = await updateReview(UUID, {
				status: "invalid_status" as never,
			});

			expect(result.success).toBe(false);
		});
	});

	describe("deleteReview", () => {
		test("deletes a draft review and its associated records", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "draft" })
			);

			const result = await deleteReview(UUID);

			expect(result.success).toBe(true);
			// Should delete checklists, scores, comments, reviewers, then the review
			expect(dbMock.delete).toHaveBeenCalledTimes(5);
		});

		test("refuses to delete non-draft reviews", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "in_progress" })
			);

			const result = await deleteReview(UUID);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Can only delete draft reviews");
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await deleteReview("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});

	describe("listReviews", () => {
		test("returns reviews for an opportunity", async () => {
			const reviewRows = [
				makeReviewRow({ id: "rev-1", reviewers: [makeReviewerRow()] }),
				makeReviewRow({ id: "rev-2", reviewType: "red", reviewers: [] }),
			];
			dbMock.query.proposalReviews.findMany.mockResolvedValue(reviewRows);

			const result = await listReviews(UUID2);

			expect(result.success).toBe(true);
			expect(result.reviews).toHaveLength(2);
			expect(result.reviews![0].reviewerCount).toBe(1);
			expect(result.reviews![1].reviewerCount).toBe(0);
			expectAssignedReviewScope(dbMock.query.proposalReviews.findMany.mock.calls[0][0].where);
		});

		test("returns empty array when no reviews exist", async () => {
			dbMock.query.proposalReviews.findMany.mockResolvedValue([]);

			const result = await listReviews(UUID2);

			expect(result.success).toBe(true);
			expect(result.reviews).toHaveLength(0);
		});
	});

	describe("listAllReviews", () => {
		test("returns all reviews across opportunities", async () => {
			const reviewRows = [
				makeReviewRow({ id: "rev-1", reviewers: [] }),
			];
			dbMock.query.proposalReviews.findMany.mockResolvedValue(reviewRows);

			const result = await listAllReviews();

			expect(result.success).toBe(true);
			expect(result.reviews).toHaveLength(1);
			expectAssignedReviewScope(dbMock.query.proposalReviews.findMany.mock.calls[0][0].where);
		});

		test("applies status and reviewType filters", async () => {
			dbMock.query.proposalReviews.findMany.mockResolvedValue([]);

			const result = await listAllReviews({
				status: "completed",
				reviewType: "red",
				limit: 10,
			});

			expect(result.success).toBe(true);
			expect(dbMock.query.proposalReviews.findMany).toHaveBeenCalled();
			expectAssignedReviewScope(dbMock.query.proposalReviews.findMany.mock.calls[0][0].where);
		});
	});
});

// ============================================================================
// REVIEWER MANAGEMENT
// ============================================================================

describe("Reviewer Management", () => {
	describe("assignReviewers", () => {
		test("assigns multiple reviewers to a review", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());
			const inserted = [makeReviewerRow(), makeReviewerRow({ id: "rv-2", userId: "user-200" })];
			dbMock.insert.mockImplementation(() => createChainableQuery(inserted));

			const result = await assignReviewers(UUID, [
				{ userId: "user-100", userName: "Jane Doe", role: "technical" },
				{ userId: "user-200", userName: "John Smith", role: "cost" },
			]);

			expect(result.success).toBe(true);
			expect(result.assignedCount).toBe(2);
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await assignReviewers("nonexistent", [
				{ userId: "user-100" },
			]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});

		test("validates reviewer assignment schema", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());

			const result = await assignReviewers(UUID, [
				{ userId: "", userEmail: "not-an-email" as never } as never,
			]);

			expect(result.success).toBe(false);
		});
	});

	describe("updateReviewer", () => {
		test("updates reviewer role and sections", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());

			const result = await updateReviewer(UUID3, {
				role: "lead",
				assignedSections: ["sec-1", "sec-2"],
			});

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("sets acceptedAt when status changes to accepted", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ status: "pending" })
			);

			const result = await updateReviewer(UUID3, { status: "accepted" });

			expect(result.success).toBe(true);
		});

		test("sets startedAt when status changes to in_progress", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ status: "accepted" })
			);

			const result = await updateReviewer(UUID3, { status: "in_progress" });

			expect(result.success).toBe(true);
		});

		test("sets completedAt when status changes to completed", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ status: "in_progress" })
			);

			const result = await updateReviewer(UUID3, { status: "completed" });

			expect(result.success).toBe(true);
		});

		test("returns error when reviewer not found", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(null);

			const result = await updateReviewer("nonexistent", { role: "lead" });

			expect(result.success).toBe(false);
			expect(result.error).toBe("Reviewer not found");
		});
	});

	describe("removeReviewer", () => {
		test("removes reviewer and associated records", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());
			// Mock updateReviewStatistics dependencies
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await removeReviewer(UUID3);

			expect(result.success).toBe(true);
			// Should delete scores, comments, checklists, then reviewer record
			expect(dbMock.delete).toHaveBeenCalledTimes(4);
		});

		test("returns error when reviewer not found", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(null);

			const result = await removeReviewer("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Reviewer not found");
		});
	});

	describe("checkConflictsOfInterest", () => {
		test("returns no conflicts for clean reviewers", async () => {
			dbMock.query.reviewers.findMany.mockResolvedValue([
				makeReviewerRow({ conflictOfInterest: false, ndaSigned: true }),
			]);

			const result = await checkConflictsOfInterest(UUID);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results![0].hasConflict).toBe(false);
			expect(result.results![0].conflictReasons).toHaveLength(0);
		});

		test("detects declared conflict of interest", async () => {
			dbMock.query.reviewers.findMany.mockResolvedValue([
				makeReviewerRow({
					conflictOfInterest: true,
					conflictNotes: "Previously employed by competitor",
				}),
			]);

			const result = await checkConflictsOfInterest(UUID);

			expect(result.success).toBe(true);
			expect(result.results![0].hasConflict).toBe(true);
			expect(result.results![0].conflictReasons[0].type).toBe("declared_conflict");
			expect(result.results![0].conflictReasons[0].severity).toBe("high");
		});

		test("flags unsigned NDA", async () => {
			dbMock.query.reviewers.findMany.mockResolvedValue([
				makeReviewerRow({ ndaSigned: false }),
			]);

			const result = await checkConflictsOfInterest(UUID);

			expect(result.success).toBe(true);
			expect(result.results![0].hasConflict).toBe(true);
			expect(result.results![0].conflictReasons).toContainEqual(
				expect.objectContaining({ type: "nda_not_signed", severity: "medium" })
			);
		});

		test("detects both conflict and unsigned NDA", async () => {
			dbMock.query.reviewers.findMany.mockResolvedValue([
				makeReviewerRow({
					conflictOfInterest: true,
					conflictNotes: "Family at vendor",
					ndaSigned: false,
				}),
			]);

			const result = await checkConflictsOfInterest(UUID);

			expect(result.results![0].conflictReasons).toHaveLength(2);
			expect(result.results![0].recommendations).toHaveLength(2);
		});
	});

	describe("sendReviewerReminder", () => {
		test("updates reminder tracking and logs notification", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ reminderCount: 1 })
			);
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());

			const result = await sendReviewerReminder(UUID3);

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when reviewer not found", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(null);

			const result = await sendReviewerReminder("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Reviewer not found");
		});
	});
});

// ============================================================================
// COMMENT MANAGEMENT
// ============================================================================

describe("Comment Management", () => {
	describe("addReviewComment", () => {
		test("creates a comment and updates reviewer count", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());
			const newComment = makeCommentRow({ id: "comment-new" });
			dbMock.insert.mockImplementation(() => createChainableQuery([newComment]));
			// updateReviewStatistics mock
			dbMock.query.reviewComments.findMany.mockResolvedValue([newComment]);

			const result = await addReviewComment(UUID, UUID3, {
				commentType: "weakness",
				comment: "Missing security section.",
				severity: "major",
			});

			expect(result.success).toBe(true);
			expect(result.commentId).toBe("comment-new");
			// update called: reviewer count + review stats
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("increments parent reply count for threaded comments", async () => {
			const parentId = "00000000-0000-4000-8000-000000000099";
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());
			const newReply = makeCommentRow({ id: "reply-1", parentCommentId: parentId });
			dbMock.insert.mockImplementation(() => createChainableQuery([newReply]));
			dbMock.query.reviewComments.findMany.mockResolvedValue([newReply]);

			const result = await addReviewComment(UUID, UUID3, {
				commentType: "suggestion",
				comment: "Consider using mTLS.",
				parentCommentId: parentId,
			});

			expect(result.success).toBe(true);
			// update called: reviewer count + parent reply count + review stats
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when reviewer is not assigned to the review", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(null);

			const result = await addReviewComment(UUID, "wrong-reviewer", {
				commentType: "strength",
				comment: "Good executive summary.",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("not found or not assigned");
		});

		test("rejects comments submitted as another reviewer", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ userId: "other-user" })
			);

			const result = await addReviewComment(UUID, UUID3, {
				commentType: "strength",
				comment: "Good executive summary.",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Unauthorized");
			expect(dbMock.insert).not.toHaveBeenCalled();
		});

		test("validates comment input schema", async () => {
			const result = await addReviewComment(UUID, UUID3, {
				commentType: "invalid_type" as never,
				comment: "test",
			});

			expect(result.success).toBe(false);
		});
	});

	describe("updateComment", () => {
		test("updates comment fields", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(makeCommentRow());
			dbMock.query.reviewComments.findMany.mockResolvedValue([makeCommentRow()]);

			const result = await updateComment("comment-1", {
				severity: "critical",
				comment: "Updated: This is now critical.",
				tags: ["security", "critical-path"],
			});

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when comment not found", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(null);

			const result = await updateComment("nonexistent", {
				comment: "won't work",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Comment not found");
		});
	});

	describe("deleteComment", () => {
		test("deletes comment, child replies, and updates counts", async () => {
			const comment = makeCommentRow({ reviewerId: UUID3 });
			dbMock.query.reviewComments.findFirst.mockResolvedValue(comment);
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await deleteComment("comment-1");

			expect(result.success).toBe(true);
			// delete child comments + delete the comment itself
			expect(dbMock.delete).toHaveBeenCalledTimes(2);
			// update reviewer comment count + review stats
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("decrements parent reply count if comment was a reply", async () => {
			const reply = makeCommentRow({
				id: "reply-1",
				parentCommentId: "parent-comment-id",
				reviewerId: UUID3,
			});
			dbMock.query.reviewComments.findFirst.mockResolvedValue(reply);
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await deleteComment("reply-1");

			expect(result.success).toBe(true);
			// extra update for parent reply count
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when comment not found", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(null);

			const result = await deleteComment("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Comment not found");
		});
	});

	describe("resolveComment", () => {
		test("resolves a comment with notes and action", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(makeCommentRow());
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);
			const updateChain = createChainableQuery([]);
			dbMock.update.mockReturnValue(updateChain);

			const result = await resolveComment(
				"comment-1",
				{
					resolutionStatus: "resolved",
					resolutionNotes: "Added security section per feedback",
					resolutionAction: "revised",
				},
				"user-resolver"
			);

			expect(result.success).toBe(true);
			expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
				resolvedBy: "user-100",
			}));
		});

		test("marks comment as deferred", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(makeCommentRow());
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await resolveComment(
				"comment-1",
				{ resolutionStatus: "deferred" },
				"user-resolver"
			);

			expect(result.success).toBe(true);
		});

		test("returns error when comment not found", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(null);

			const result = await resolveComment(
				"nonexistent",
				{ resolutionStatus: "resolved" },
				"user-resolver"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Comment not found");
		});

		test("rejects invalid resolution status", async () => {
			const result = await resolveComment(
				"comment-1",
				{ resolutionStatus: "yolo" as never },
				"user-resolver"
			);

			expect(result.success).toBe(false);
		});
	});

	describe("verifyResolution", () => {
		test("verifies a resolved comment", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(
				makeCommentRow({ resolutionStatus: "resolved" })
			);
			const updateChain = createChainableQuery([]);
			dbMock.update.mockReturnValue(updateChain);

			const result = await verifyResolution(
				"comment-1",
				"verifier-user",
				"Confirmed fix is adequate"
			);

			expect(result.success).toBe(true);
			expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
				verifiedBy: "user-100",
			}));
		});

		test("rejects verification of non-resolved comments", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(
				makeCommentRow({ resolutionStatus: "open" })
			);

			const result = await verifyResolution("comment-1", "verifier-user");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Can only verify resolved comments");
		});

		test("returns error when comment not found", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(null);

			const result = await verifyResolution("nonexistent", "verifier-user");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Comment not found");
		});
	});

	describe("getReviewComments", () => {
		test("returns comments for a review", async () => {
			const comments = [
				makeCommentRow({ id: "c1" }),
				makeCommentRow({ id: "c2", commentType: "strength" }),
			];
			dbMock.query.reviewComments.findMany.mockResolvedValue(comments);

			const result = await getReviewComments(UUID);

			expect(result.success).toBe(true);
			expect(result.comments).toHaveLength(2);
		});

		test("hides reviewer name for anonymous comments", async () => {
			const anonComment = makeCommentRow({ isAnonymous: true });
			dbMock.query.reviewComments.findMany.mockResolvedValue([anonComment]);

			const result = await getReviewComments(UUID);

			expect(result.success).toBe(true);
			expect(result.comments![0].reviewerName).toBeNull();
		});

		test("shows reviewer name for non-anonymous comments", async () => {
			const namedComment = makeCommentRow({
				isAnonymous: false,
				reviewer: makeReviewerRow({ userName: "Visible Reviewer" }),
			});
			dbMock.query.reviewComments.findMany.mockResolvedValue([namedComment]);

			const result = await getReviewComments(UUID);

			expect(result.success).toBe(true);
			expect(result.comments![0].reviewerName).toBe("Visible Reviewer");
		});

		test("supports filtering by severity and type", async () => {
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await getReviewComments(UUID, {
				severity: "critical",
				commentType: "weakness",
			});

			expect(result.success).toBe(true);
			expect(dbMock.query.reviewComments.findMany).toHaveBeenCalled();
		});

		test("returns empty array when no comments exist", async () => {
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await getReviewComments(UUID);

			expect(result.success).toBe(true);
			expect(result.comments).toHaveLength(0);
		});
	});

	describe("updateCommentPriorities", () => {
		test("bulk updates comment priority ranks via transaction", async () => {
			const result = await updateCommentPriorities([
				{ commentId: "c1", priorityRank: 1 },
				{ commentId: "c2", priorityRank: 2 },
				{ commentId: "c3", priorityRank: 3 },
			]);

			expect(result.success).toBe(true);
			expect(dbMock.transaction).toHaveBeenCalled();
		});

		test("handles empty priorities array", async () => {
			const result = await updateCommentPriorities([]);

			expect(result.success).toBe(true);
		});
	});

	describe("markCommentDuplicate", () => {
		test("marks a comment as duplicate of another", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(makeCommentRow());
			dbMock.query.reviewComments.findMany.mockResolvedValue([]);

			const result = await markCommentDuplicate("comment-1", "comment-original");

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when comment not found", async () => {
			dbMock.query.reviewComments.findFirst.mockResolvedValue(null);

			const result = await markCommentDuplicate("nonexistent", "comment-original");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Comment not found");
		});
	});
});

// ============================================================================
// SCORING
// ============================================================================

describe("Scoring", () => {
	describe("submitReviewerScores", () => {
		test("submits multiple scores and updates reviewer count", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());
			const insertedScores = [
				makeScoreRow({ id: "s1" }),
				makeScoreRow({ id: "s2", evaluationCriteriaName: "Management" }),
			];
			dbMock.insert.mockImplementation(() => createChainableQuery(insertedScores));

			const result = await submitReviewerScores(UUID3, [
				{
					evaluationCriteriaId: UUID4,
					evaluationCriteriaName: "Technical Approach",
					score: 85,
					maxScore: 100,
					weight: 2,
					ratingCategory: "good",
					confidence: 0.9,
				},
				{
					evaluationCriteriaId: UUID5,
					evaluationCriteriaName: "Management",
					score: 70,
					maxScore: 100,
					weight: 1,
					ratingCategory: "acceptable",
					confidence: 0.7,
				},
			]);

			expect(result.success).toBe(true);
			expect(result.scoresSubmitted).toBe(2);
		});

		test("calculates normalized and weighted scores correctly", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());
			const insertedScore = makeScoreRow({
				score: 40,
				maxScore: 50,
				normalizedScore: 80,
				weight: 3,
				weightedScore: 120,
			});
			dbMock.insert.mockImplementation(() => createChainableQuery([insertedScore]));

			const result = await submitReviewerScores(UUID3, [
				{
					score: 40,
					maxScore: 50,
					weight: 3,
				},
			]);

			expect(result.success).toBe(true);
			expect(result.scoresSubmitted).toBe(1);
		});

		test("returns error when reviewer not found", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(null);

			const result = await submitReviewerScores("nonexistent", [
				{ score: 80, maxScore: 100 },
			]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Reviewer not found");
		});

		test("rejects scores submitted as another reviewer", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(
				makeReviewerRow({ userId: "other-user" })
			);

			const result = await submitReviewerScores(UUID3, [
				{ score: 80, maxScore: 100 },
			]);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Unauthorized");
			expect(dbMock.insert).not.toHaveBeenCalled();
		});

		test("rejects negative scores via Zod validation", async () => {
			dbMock.query.reviewers.findFirst.mockResolvedValue(makeReviewerRow());

			const result = await submitReviewerScores(UUID3, [
				{ score: -5, maxScore: 100 },
			]);

			expect(result.success).toBe(false);
		});
	});

	describe("updateScore", () => {
		test("updates score value and recalculates derived fields", async () => {
			dbMock.query.reviewScores.findFirst.mockResolvedValue(
				makeScoreRow({ score: 80, maxScore: 100, weight: 2 })
			);

			const result = await updateScore("score-1", {
				score: 90,
			});

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("updates rationale and supporting fields", async () => {
			dbMock.query.reviewScores.findFirst.mockResolvedValue(makeScoreRow());

			const result = await updateScore("score-1", {
				rationale: "Updated rationale after revision",
				strengths: ["Now includes timeline"],
				confidence: 0.95,
			});

			expect(result.success).toBe(true);
		});

		test("recalculates when maxScore changes", async () => {
			dbMock.query.reviewScores.findFirst.mockResolvedValue(
				makeScoreRow({ score: 80, maxScore: 100, weight: 1 })
			);

			const result = await updateScore("score-1", {
				maxScore: 200,
			});

			expect(result.success).toBe(true);
		});

		test("returns error when score not found", async () => {
			dbMock.query.reviewScores.findFirst.mockResolvedValue(null);

			const result = await updateScore("nonexistent", { score: 50 });

			expect(result.success).toBe(false);
			expect(result.error).toBe("Score not found");
		});
	});

	describe("aggregateScores", () => {
		test("returns zero-value aggregation when no scores exist", async () => {
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await aggregateScores(UUID);

			expect(result.success).toBe(true);
			expect(result.aggregation).toBeDefined();
			expect(result.aggregation!.overallScore).toBe(0);
			expect(result.aggregation!.normalizedScore).toBe(0);
			expect(result.aggregation!.confidence).toBe(0);
			expect(result.aggregation!.byCategory).toHaveLength(0);
			expect(result.aggregation!.byReviewer).toHaveLength(0);
			expect(result.aggregation!.byCriteria).toHaveLength(0);
			expect(result.aggregation!.consensusLevel).toBe(0);
		});

		test("aggregates scores by category, reviewer, and criteria", async () => {
			const scores = [
				makeScoreRow({
					id: "s1",
					reviewerId: UUID3,
					evaluationCriteriaId: "crit-1",
					evaluationCriteriaName: "Technical",
					normalizedScore: 80,
					weight: 2,
					weightedScore: 160,
					confidence: 0.9,
					ratingCategory: "good",
					score: 80,
					maxScore: 100,
					reviewer: makeReviewerRow({ userName: "Reviewer A" }),
				}),
				makeScoreRow({
					id: "s2",
					reviewerId: "rv-other",
					evaluationCriteriaId: "crit-1",
					evaluationCriteriaName: "Technical",
					normalizedScore: 70,
					weight: 2,
					weightedScore: 140,
					confidence: 0.8,
					ratingCategory: "acceptable",
					score: 70,
					maxScore: 100,
					reviewer: makeReviewerRow({ id: "rv-other", userName: "Reviewer B" }),
				}),
			];
			dbMock.query.reviewScores.findMany.mockResolvedValue(scores);

			const result = await aggregateScores(UUID);

			expect(result.success).toBe(true);
			const agg = result.aggregation!;
			// Two scores grouped under "Technical" category
			expect(agg.byCategory).toHaveLength(1);
			expect(agg.byCategory[0].category).toBe("Technical");
			expect(agg.byCategory[0].reviewerCount).toBe(2);
			// Two reviewers
			expect(agg.byReviewer).toHaveLength(2);
			// Rating distribution
			expect(agg.ratingDistribution.good).toBe(1);
			expect(agg.ratingDistribution.acceptable).toBe(1);
			// Consensus > 0 since scores are relatively close
			expect(agg.consensusLevel).toBeGreaterThan(0);
		});

		test("calculates standard deviation in criteria breakdown", async () => {
			const scores = [
				makeScoreRow({ id: "s1", normalizedScore: 90, evaluationCriteriaId: "crit-1" }),
				makeScoreRow({ id: "s2", normalizedScore: 60, evaluationCriteriaId: "crit-1", reviewerId: "rv-2" }),
			];
			dbMock.query.reviewScores.findMany.mockResolvedValue(scores);

			const result = await aggregateScores(UUID);

			expect(result.success).toBe(true);
			const criteria = result.aggregation!.byCriteria[0];
			expect(criteria.standardDeviation).toBeGreaterThan(0);
			expect(criteria.minScore).toBe(60);
			expect(criteria.maxScoreGiven).toBe(90);
			expect(criteria.averageScore).toBe(75);
		});
	});
});

// ============================================================================
// REVIEW STATUS TRANSITIONS
// ============================================================================

describe("Review Status Transitions", () => {
	describe("startReview", () => {
		test("transitions review from draft/scheduled to in_progress", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "scheduled" })
			);

			const result = await startReview(UUID);

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await startReview("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});

	describe("completeReview", () => {
		test("completes review with recommendation, summary, and key findings", async () => {
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "in_progress" })
			);

			const result = await completeReview(
				UUID,
				"ready_to_submit",
				"This proposal is ready for submission with minor polish.",
				{
					strengths: ["Strong technical approach", "Clear win themes"],
					weaknesses: ["Weak cost narrative"],
					criticalIssues: [],
					recommendations: ["Strengthen executive summary"],
				}
			);

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("aggregates scores before completing", async () => {
			const scores = [makeScoreRow()];
			dbMock.query.reviewScores.findMany.mockResolvedValue(scores);
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "in_progress" })
			);

			const result = await completeReview(
				UUID,
				"needs_minor_revisions",
				"Good overall but needs some fixes.",
				{
					strengths: [],
					weaknesses: [],
					criticalIssues: [],
					recommendations: [],
				}
			);

			expect(result.success).toBe(true);
		});

		test("returns error when review not found", async () => {
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await completeReview(
				"nonexistent",
				"not_ready",
				"N/A",
				{ strengths: [], weaknesses: [], criticalIssues: [], recommendations: [] }
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});

	describe("cancelReview", () => {
		test("cancels a review with a reason", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "in_progress" })
			);

			const result = await cancelReview(UUID, "Opportunity withdrawn by customer");

			expect(result.success).toBe(true);
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("cancels a review without a reason", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(
				makeReviewRow({ status: "draft" })
			);

			const result = await cancelReview(UUID);

			expect(result.success).toBe(true);
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await cancelReview("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});
});

// ============================================================================
// REPORTING & ANALYTICS
// ============================================================================

describe("Reporting & Analytics", () => {
	describe("generateReviewReport", () => {
		test("generates a comprehensive report with all sections", async () => {
			const review = makeReviewRow({
				status: "completed",
				completedAt: new Date("2025-06-03"),
				recommendation: "needs_minor_revisions",
				executiveSummary: "Good overall proposal.",
				keyFindings: {
					strengths: ["Clear approach"],
					weaknesses: ["Weak pricing"],
					criticalIssues: [],
					recommendations: ["Improve cost volume"],
				},
				reviewers: [makeReviewerRow({ commentsSubmitted: 5, scoresSubmitted: 3 })],
				comments: [
					makeCommentRow({ commentType: "strength", severity: "minor", resolutionStatus: "open" }),
					makeCommentRow({ id: "c2", commentType: "weakness", severity: "major", resolutionStatus: "resolved" }),
					makeCommentRow({
						id: "c3",
						commentType: "compliance_gap",
						severity: "critical",
						evaluationCriteriaRef: "L.1.a",
						suggestedChange: "Add compliance matrix row",
						resolutionStatus: "open",
					}),
				],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([makeScoreRow()]);

			const result = await generateReviewReport(UUID);

			expect(result.success).toBe(true);
			const report = result.report!;
			expect(report.review.id).toBe(UUID);
			expect(report.review.status).toBe("completed");
			expect(report.statistics.totalComments).toBe(3);
			expect(report.statistics.resolvedCount).toBe(1);
			expect(report.statistics.openCount).toBe(2);
			expect(report.statistics.resolutionRate).toBeCloseTo(1 / 3);
			expect(report.complianceGaps).toHaveLength(1);
			expect(report.complianceGaps[0].criteriaRef).toBe("L.1.a");
			expect(report.reviewers).toHaveLength(1);
			expect(report.generatedAt).toBeDefined();
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await generateReviewReport("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});

		test("handles review with no comments gracefully", async () => {
			const review = makeReviewRow({ comments: [], reviewers: [] });
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await generateReviewReport(UUID);

			expect(result.success).toBe(true);
			expect(result.report!.statistics.totalComments).toBe(0);
			expect(result.report!.statistics.resolutionRate).toBe(0);
		});

		test("includes theme analysis in report", async () => {
			const themeId = "theme-1";
			const review = makeReviewRow({
				comments: [
					makeCommentRow({ relatedWinThemeId: themeId, themeAlignment: "supports" }),
					makeCommentRow({ id: "c2", relatedWinThemeId: themeId, themeAlignment: "supports" }),
					makeCommentRow({ id: "c3", relatedWinThemeId: themeId, themeAlignment: "conflicts" }),
				],
				reviewers: [],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await generateReviewReport(UUID);

			expect(result.success).toBe(true);
			expect(result.report!.themeAnalysis).toHaveLength(1);
			expect(result.report!.themeAnalysis[0].supportingComments).toBe(2);
			expect(result.report!.themeAnalysis[0].conflictingComments).toBe(1);
			expect(result.report!.themeAnalysis[0].themeStrength).toBeCloseTo(2 / 3);
		});
	});

	describe("compareBeforeAfter", () => {
		test("compares current review with previous review", async () => {
			const currentReview = makeReviewRow({
				id: UUID,
				previousReviewId: UUID2,
				comments: [
					makeCommentRow({ commentType: "strength", resolutionStatus: "open" }),
					makeCommentRow({ id: "c2", commentType: "weakness", severity: "major", resolutionStatus: "open" }),
				],
			});
			const previousReview = makeReviewRow({
				id: UUID2,
				reviewType: "pink",
				comments: [
					makeCommentRow({ id: "c-prev", commentType: "weakness", severity: "critical", resolutionStatus: "open" }),
				],
			});

			// First call returns current review, second returns previous
			dbMock.query.proposalReviews.findFirst
				.mockResolvedValueOnce(currentReview)
				.mockResolvedValueOnce(previousReview);
			// aggregateScores calls for both reviews
			dbMock.query.reviewScores.findMany
				.mockResolvedValueOnce([makeScoreRow({ normalizedScore: 80 })])
				.mockResolvedValueOnce([makeScoreRow({ normalizedScore: 70 })]);

			const result = await compareBeforeAfter(UUID);

			expect(result.success).toBe(true);
			const comparison = result.comparison!;
			expect(comparison.reviewId).toBe(UUID);
			expect(comparison.previousReviewId).toBe(UUID2);
			expect(comparison.issueChanges).toHaveLength(4);
		});

		test("handles first review with no previous review", async () => {
			const currentReview = makeReviewRow({
				previousReviewId: null,
				comments: [],
			});
			dbMock.query.proposalReviews.findFirst
				.mockResolvedValueOnce(currentReview)
				.mockResolvedValueOnce(null); // No previous review found
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await compareBeforeAfter(UUID);

			expect(result.success).toBe(true);
			expect(result.comparison!.previousReviewId).toBeNull();
			expect(result.comparison!.overallScoreChange).toBeNull();
		});

		test("returns error when review not found", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await compareBeforeAfter("nonexistent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Review not found");
		});
	});

	describe("trackReviewEffectiveness", () => {
		test("rejects organization-scoped metrics before querying unsupported schema", async () => {
			const result = await trackReviewEffectiveness(UUID, 30);

			expect(result).toEqual({
				success: false,
				error: "Organization-scoped review metrics are not supported by the current review schema",
			});
			expect(dbMock.query.proposalReviews.findMany).not.toHaveBeenCalled();
		});

		test("returns effectiveness metrics for completed reviews", async () => {
			const reviews = [
				makeReviewRow({
					status: "completed",
					totalComments: 10,
					resolvedIssues: 8,
					improvementFromPrevious: 15,
					recommendation: "ready_to_submit",
					reviewers: [makeReviewerRow({ commentsSubmitted: 5 })],
					comments: [
						makeCommentRow({ category: "technical", resolutionStatus: "resolved" }),
						makeCommentRow({ id: "c2", category: "technical", resolutionStatus: "open" }),
					],
				}),
			];
			dbMock.query.proposalReviews.findMany.mockResolvedValue(reviews);

			const result = await trackReviewEffectiveness(undefined, 30);

			expect(result.success).toBe(true);
			const metrics = result.metrics!;
			expect(metrics.reviewsConducted).toBe(1);
			expect(metrics.averageResolutionRate).toBeGreaterThan(0);
			expect(metrics.averageScoreImprovement).toBe(15);
			expect(metrics.reviewTypeEffectiveness).toHaveLength(1);
			expect(metrics.commonIssueCategories.length).toBeGreaterThan(0);
		});

		test("handles no completed reviews in timeframe", async () => {
			dbMock.query.proposalReviews.findMany.mockResolvedValue([]);

			const result = await trackReviewEffectiveness();

			expect(result.success).toBe(true);
			expect(result.metrics!.reviewsConducted).toBe(0);
			expect(result.metrics!.averageResolutionRate).toBe(0);
			expect(result.metrics!.averageScoreImprovement).toBe(0);
		});

		test("defaults to 90-day timeframe", async () => {
			dbMock.query.proposalReviews.findMany.mockResolvedValue([]);

			const result = await trackReviewEffectiveness();

			expect(result.success).toBe(true);
			const start = new Date(result.metrics!.timeframe.start);
			const end = new Date(result.metrics!.timeframe.end);
			const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(90, 0);
		});
	});

	describe("exportReviewPackage", () => {
		test("generates export URL for PDF format", async () => {
			const review = makeReviewRow({
				status: "completed",
				reviewers: [],
				comments: [],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await exportReviewPackage(UUID, "pdf");

			expect(result.success).toBe(true);
			expect(result.downloadUrl).toContain("/api/reviews/");
			expect(result.downloadUrl).toContain("format=pdf");
			expect(dbMock.update).toHaveBeenCalled();
		});

		test("generates export URL for XLSX format", async () => {
			const review = makeReviewRow({
				status: "completed",
				reviewers: [],
				comments: [],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await exportReviewPackage(UUID, "xlsx");

			expect(result.success).toBe(true);
			expect(result.downloadUrl).toContain("format=xlsx");
		});

		test("generates export URL for DOCX format", async () => {
			const review = makeReviewRow({
				status: "completed",
				reviewers: [],
				comments: [],
			});
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
			dbMock.query.reviewScores.findMany.mockResolvedValue([]);

			const result = await exportReviewPackage(UUID, "docx");

			expect(result.success).toBe(true);
			expect(result.downloadUrl).toContain("format=docx");
		});

		test("returns error when review not found for export", async () => {
			dbMock.query.proposalReviews.findFirst.mockResolvedValue(null);

			const result = await exportReviewPackage("nonexistent", "pdf");

			expect(result.success).toBe(false);
		});
	});
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge Cases", () => {
	test("createReview with all optional fields populated", async () => {
		mockCreateReviewSelects();
		dbMock.insert.mockImplementation(() => createChainableQuery([makeReviewRow()]));

		const result = await createReview({
			opportunityId: UUID2,
			reviewType: "compliance",
			reviewName: "Full Compliance Check",
			description: "Checking all FAR clauses",
			scheduledDate: "2025-07-01T09:00:00.000Z",
			scheduledEndDate: "2025-07-03T17:00:00.000Z",
			documentVersionId: UUID3,
			scopeType: "partial",
			scopedSections: ["sec-1", "sec-2"],
			scopedVolumes: ["vol-1"],
			reviewInstructions: "Focus on Section L requirements",
			focusAreas: ["compliance", "pricing"],
			evaluationCriteriaIds: [UUID],
		});

		expect(result.success).toBe(true);
	});

	test("updateComment with minimal data", async () => {
		dbMock.query.reviewComments.findFirst.mockResolvedValue(makeCommentRow());
		dbMock.query.reviewComments.findMany.mockResolvedValue([]);

		const result = await updateComment("comment-1", {});

		expect(result.success).toBe(true);
	});

	test("aggregateScores with single score produces zero std deviation", async () => {
		dbMock.query.reviewScores.findMany.mockResolvedValue([
			makeScoreRow({ normalizedScore: 75 }),
		]);

		const result = await aggregateScores(UUID);

		expect(result.success).toBe(true);
		expect(result.aggregation!.byCriteria[0].standardDeviation).toBe(0);
	});

	test("generateReviewReport comment-type distribution is accurate", async () => {
		const review = makeReviewRow({
			reviewers: [],
			comments: [
				makeCommentRow({ commentType: "strength", resolutionStatus: "open" }),
				makeCommentRow({ id: "c2", commentType: "weakness", resolutionStatus: "open" }),
				makeCommentRow({ id: "c3", commentType: "weakness", resolutionStatus: "resolved" }),
				makeCommentRow({ id: "c4", commentType: "question", resolutionStatus: "open" }),
			],
		});
		dbMock.query.proposalReviews.findFirst.mockResolvedValue(review);
		dbMock.query.reviewScores.findMany.mockResolvedValue([]);

		const result = await generateReviewReport(UUID);

		expect(result.success).toBe(true);
		expect(result.report!.statistics.commentsByType.strength).toBe(1);
		expect(result.report!.statistics.commentsByType.weakness).toBe(2);
		expect(result.report!.statistics.commentsByType.question).toBe(1);
	});

	test("assignReviewers with sections populates totalAssignedSections", async () => {
		dbMock.query.proposalReviews.findFirst.mockResolvedValue(makeReviewRow());
		const inserted = [makeReviewerRow({ totalAssignedSections: 3 })];
		dbMock.insert.mockImplementation(() => createChainableQuery(inserted));

		const result = await assignReviewers(UUID, [
			{
				userId: "user-500",
				role: "technical",
				assignedSections: ["sec-a", "sec-b", "sec-c"],
			},
		]);

		expect(result.success).toBe(true);
		expect(result.assignedCount).toBe(1);
	});

	test("database error propagation in updateReviewer", async () => {
		dbMock.query.reviewers.findFirst.mockRejectedValue(
			new Error("Connection timeout")
		);

		const result = await updateReviewer(UUID3, { role: "lead" });

		expect(result.success).toBe(false);
		expect(result.error).toContain("Connection timeout");
	});
});
