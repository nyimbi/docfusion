/**
 * Submission Server Actions - DocFusion
 *
 * Server actions for tracking proposal submissions and outcomes.
 */

"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
	submissions,
	proposalDocuments,
	documents,
	opportunities,
	type SubmissionRow,
} from "@/lib/db/schema";
import { requireUserContext } from "@/lib/auth-utils";
import { eq, desc, and, gte, lte, sql, inArray, type SQL } from "drizzle-orm";
import {
	evaluateFinalSubmissionChecklistWorkflow,
	type FinalSubmissionChecklistItem,
} from "@/lib/actions/final-submission-checklist-workflow";
import { preSubmissionAudit } from "@/lib/actions/document-render";
import { recordWorkflowRuntimeTransition } from "@/lib/actions/workflow-runtime";
import { logger } from "@/lib/utils/logger";
import type {
	Submission,
	SubmissionAttachment,
	CreateSubmissionInput,
	UpdateSubmissionStatusInput,
	RecordOutcomeInput,
	PreSubmissionChecklistItem,
	WinLossAnalytics,
	SubmissionStatus,
	SubmissionOutcome,
	ProposalDocumentType,
} from "@/lib/types/opportunity";

// ============================================================================
// Row Transformers
// ============================================================================

function transformSubmission(row: SubmissionRow): Submission {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		submittedAt: row.submittedAt,
		submittedBy: row.submittedBy,
		submissionMethod: row.submissionMethod as Submission["submissionMethod"],
		confirmationNumber: row.confirmationNumber,
		attachments: (row.attachments || []) as SubmissionAttachment[],
		notes: row.notes,
		status: row.status as SubmissionStatus,
		outcome: row.outcome as SubmissionOutcome | null,
		outcomeDate: row.outcomeDate,
		outcomeNotes: row.outcomeNotes,
		evaluatorFeedback: row.evaluatorFeedback,
		lessonsLearned: row.lessonsLearned,
		contractValue: row.contractValue,
		contractDuration: row.contractDuration,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// ============================================================================
// CRUD Operations
// ============================================================================

function revalidateSubmissionWorkflowPaths(opportunityId: string): void {
	revalidatePath(`/opportunities/${opportunityId}`);
	revalidatePath(`/opportunities/${opportunityId}/submission`);
}

function assignedOpportunityExistsSql(opportunityId: unknown, actorId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${actorId}
	)`;
}

function assignedOpportunityCondition(actorId: string): SQL {
	return sql`opportunities.assigned_to = ${actorId}`;
}

function visibleOpportunityCondition(opportunityId: string, actorId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(actorId)
	)!;
}

function visibleSubmissionsForOpportunityCondition(opportunityId: string, actorId: string): SQL {
	return and(
		eq(submissions.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actorId)
	)!;
}

function visibleSubmissionCondition(submissionId: string, actorId: string): SQL {
	return and(
		eq(submissions.id, submissionId),
		assignedOpportunityExistsSql(submissions.opportunityId, actorId)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, actorId: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, actorId)
	)!;
}

function buildAttachmentHash(input: {
	documentId: string;
	documentTitle: string;
	documentType: ProposalDocumentType;
	status: string | null;
	content: unknown;
	updatedAt: Date | null;
}): string {
	return createHash("sha256")
		.update(JSON.stringify({
			documentId: input.documentId,
			documentTitle: input.documentTitle,
			documentType: input.documentType,
			status: input.status,
			content: input.content,
			updatedAt: input.updatedAt?.toISOString() ?? null,
		}))
		.digest("hex");
}

function missingRequiredFinalPackageAttachments(
	items: FinalSubmissionChecklistItem[],
	attachmentIds: string[]
): FinalSubmissionChecklistItem[] {
	const selected = new Set(attachmentIds);
	return items.filter((item) =>
		item.category === "documents" &&
		item.required &&
		item.passed &&
		item.subjectId &&
		!selected.has(item.subjectId)
	);
}

/**
 * Create a new submission record.
 */
export async function createSubmission(
	input: CreateSubmissionInput
): Promise<Submission> {
	const userContext = await requireUserContext();
	const submittedBy = userContext.userId;

	if (input.attachmentIds.length === 0) {
		throw new Error("At least one submission attachment is required");
	}
	if (!input.confirmationNumber?.trim()) {
		throw new Error("Submission confirmation number or receipt reference is required");
	}

	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(input.opportunityId, submittedBy))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}

	const audit = await preSubmissionAudit(input.opportunityId);
	if (!audit.isReady) {
		const auditSummary = audit.issues.length > 0
			? audit.issues.join("; ")
			: `readiness score ${audit.readinessScore}%`;
		throw new Error(`Pre-submission audit is not ready: ${auditSummary}`);
	}
	const finalChecklist = await evaluateFinalSubmissionChecklistWorkflow(input.opportunityId);
	if (!finalChecklist.allowed) {
		throw new Error(`Final submission checklist is not ready: ${finalChecklist.blockers.join("; ")}`);
	}
	const missingRequiredAttachments = missingRequiredFinalPackageAttachments(
		finalChecklist.items,
		input.attachmentIds
	);
	if (missingRequiredAttachments.length > 0) {
		throw new Error(
			`Submission attachments must include all required final proposal documents: ${
				missingRequiredAttachments.map((item) => item.label).join("; ")
			}`
		);
	}

	// Get attached document details
	const attachments: SubmissionAttachment[] = [];
	const lockedAt = new Date().toISOString();

	if (input.attachmentIds.length > 0) {
		const proposalDocs = await db
			.select({
				id: proposalDocuments.id,
				documentId: proposalDocuments.documentId,
				documentType: proposalDocuments.documentType,
				status: proposalDocuments.status,
				title: documents.title,
				content: documents.content,
				updatedAt: documents.updatedAt,
			})
			.from(proposalDocuments)
			.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
			.where(
				and(
					visibleProposalDocumentsForOpportunityCondition(input.opportunityId, submittedBy),
					inArray(proposalDocuments.documentId, input.attachmentIds)
				)
			);

		for (const doc of proposalDocs) {
			attachments.push({
				documentId: doc.documentId,
				documentTitle: doc.title,
				documentType: doc.documentType as ProposalDocumentType,
				artifactHash: buildAttachmentHash({
					documentId: doc.documentId,
					documentTitle: doc.title,
					documentType: doc.documentType as ProposalDocumentType,
					status: doc.status,
					content: doc.content,
					updatedAt: doc.updatedAt,
				}),
				lockedAt,
			});
		}
	}

	if (attachments.length !== input.attachmentIds.length) {
		throw new Error("All selected submission attachments must belong to the opportunity");
	}

	const [row] = await db
		.insert(submissions)
		.values({
			opportunityId: input.opportunityId,
			submittedAt: new Date(),
			submittedBy,
			submissionMethod: input.submissionMethod,
			confirmationNumber: input.confirmationNumber.trim(),
			attachments,
			notes: input.notes,
			status: "submitted",
		})
		.returning();

	// Update opportunity decision status to submitted
	await db
		.update(opportunities)
		.set({
			decisionStatus: "submitted",
			updatedAt: new Date(),
		})
		.where(visibleOpportunityCondition(input.opportunityId, submittedBy));

	try {
		await recordWorkflowRuntimeTransition({
			workflowKey: "production_submission",
			subjectType: "submission",
			subjectId: row.id,
			opportunityId: input.opportunityId,
			fromState: "final_review",
			toState: "submitted",
			eventType: "submission_dispatched",
			actorId: submittedBy,
			actorName: submittedBy,
			reason: `Submission receipt ${input.confirmationNumber.trim()} recorded`,
			evidenceLinks: [input.confirmationNumber.trim()],
			priority: "critical",
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: ["proposal_manager", "executive"],
				escalationRole: "executive",
			},
			metadata: {
				attachmentCount: attachments.length,
				attachments,
				auditReadinessScore: audit.readinessScore,
				finalChecklistWorkflowInstanceId: finalChecklist.workflowInstanceId,
				finalChecklistItemCount: finalChecklist.items.length,
				submissionMethod: input.submissionMethod,
			},
			terminal: true,
		});
	} catch (error) {
		logger.warn("Submission workflow runtime persistence failed:", error);
	}

	revalidateSubmissionWorkflowPaths(input.opportunityId);
	return transformSubmission(row);
}

/**
 * Get a submission by ID.
 */
export async function getSubmission(id: string): Promise<Submission | null> {
	const userContext = await requireUserContext();

	const [row] = await db
		.select()
		.from(submissions)
		.where(visibleSubmissionCondition(id, userContext.userId));

	return row ? transformSubmission(row) : null;
}

/**
 * Get submissions for an opportunity.
 */
export async function getSubmissionsByOpportunity(
	opportunityId: string
): Promise<Submission[]> {
	const userContext = await requireUserContext();

	const rows = await db
		.select()
		.from(submissions)
		.where(visibleSubmissionsForOpportunityCondition(opportunityId, userContext.userId))
		.orderBy(desc(submissions.submittedAt));

	return rows.map(transformSubmission);
}

/**
 * Get submission history for an opportunity.
 */
export async function getSubmissionHistory(
	opportunityId: string
): Promise<Submission[]> {
	await requireUserContext();

	return getSubmissionsByOpportunity(opportunityId);
}

/**
 * Update submission status.
 */
export async function updateSubmissionStatus(
	input: UpdateSubmissionStatusInput
): Promise<Submission> {
	const userContext = await requireUserContext();

	const [row] = await db
		.update(submissions)
		.set({
			status: input.status,
			notes: input.notes
				? sql`COALESCE(${submissions.notes}, '') || E'\n\n' || ${input.notes}`
				: undefined,
			updatedAt: new Date(),
		})
		.where(visibleSubmissionCondition(input.submissionId, userContext.userId))
		.returning();

	if (!row) {
		throw new Error(`Submission ${input.submissionId} not found`);
	}

	revalidateSubmissionWorkflowPaths(row.opportunityId);
	return transformSubmission(row);
}

/**
 * Record the outcome of a submission.
 */
export async function recordOutcome(
	input: RecordOutcomeInput
): Promise<Submission> {
	const userContext = await requireUserContext();

	const [row] = await db
		.update(submissions)
		.set({
			outcome: input.outcome,
			outcomeDate: new Date(),
			outcomeNotes: input.outcomeNotes,
			evaluatorFeedback: input.evaluatorFeedback,
			lessonsLearned: input.lessonsLearned,
			contractValue: input.contractValue,
			contractDuration: input.contractDuration,
			status: input.outcome as SubmissionStatus,
			updatedAt: new Date(),
		})
		.where(visibleSubmissionCondition(input.submissionId, userContext.userId))
		.returning();

	if (!row) {
		throw new Error(`Submission ${input.submissionId} not found`);
	}

	// Update opportunity decision status
	const decisionStatus =
		input.outcome === "won"
			? "won"
			: input.outcome === "lost"
				? "lost"
				: input.outcome === "withdrawn"
					? "declined"
					: "submitted";

	await db
		.update(opportunities)
		.set({
			decisionStatus,
			updatedAt: new Date(),
		})
		.where(visibleOpportunityCondition(row.opportunityId, userContext.userId));

	revalidateSubmissionWorkflowPaths(row.opportunityId);
	return transformSubmission(row);
}

// ============================================================================
// Pre-Submission Checklist
// ============================================================================

/**
 * Get pre-submission checklist for an opportunity.
 */
export async function getPreSubmissionChecklist(
	opportunityId: string
): Promise<PreSubmissionChecklistItem[]> {
	await requireUserContext();
	const result = await evaluateFinalSubmissionChecklistWorkflow(opportunityId);
	return result.items.map((item) => ({
		id: item.id,
		label: item.label,
		description: item.message,
		category: mapFinalChecklistCategory(item.category),
		isRequired: item.required,
		isCompleted: item.passed,
		isSystemVerified: true,
		notes: item.assignedRole ? `Owner: ${item.assignedRole}` : undefined,
	}));
}

function mapFinalChecklistCategory(
	category: "documents" | "artifact" | "approval" | "signature" | "compliance" | "privacy" | "administrative"
): PreSubmissionChecklistItem["category"] {
	switch (category) {
		case "documents":
			return "documents";
		case "compliance":
		case "privacy":
			return "compliance";
		case "artifact":
			return "formatting";
		case "approval":
		case "signature":
		case "administrative":
			return "administrative";
		default:
			return "administrative";
	}
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get win/loss analytics.
 */
export async function getWinLossAnalytics(filters?: {
	startDate?: Date;
	endDate?: Date;
	category?: string;
}): Promise<WinLossAnalytics> {
	const userContext = await requireUserContext();

	// Build conditions
	const conditions: SQL[] = [assignedOpportunityCondition(userContext.userId)];
	if (filters?.startDate) {
		conditions.push(gte(submissions.submittedAt, filters.startDate));
	}
	if (filters?.endDate) {
		conditions.push(lte(submissions.submittedAt, filters.endDate));
	}
	if (filters?.category) {
		conditions.push(eq(opportunities.category, filters.category));
	}

	// Get all submissions with opportunity data
	const allSubmissions = await db
		.select({
			id: submissions.id,
			status: submissions.status,
			outcome: submissions.outcome,
			contractValue: submissions.contractValue,
			submittedAt: submissions.submittedAt,
			category: opportunities.category,
			budgetNumeric: opportunities.budgetNumeric,
		})
		.from(submissions)
		.innerJoin(opportunities, eq(opportunities.id, submissions.opportunityId))
		.where(and(...conditions))
		.orderBy(desc(submissions.submittedAt));

	// Calculate totals
	const totalSubmissions = allSubmissions.length;
	const wins = allSubmissions.filter((s) => s.outcome === "won").length;
	const losses = allSubmissions.filter((s) => s.outcome === "lost").length;
	const withdrawn = allSubmissions.filter((s) => s.outcome === "withdrawn").length;
	const noAward = allSubmissions.filter((s) => s.outcome === "no_award").length;
	const pending = allSubmissions.filter((s) => !s.outcome).length;
	const completedSubmissions = wins + losses + withdrawn + noAward;
	const winRate = completedSubmissions > 0 ? (wins / completedSubmissions) * 100 : 0;

	// Win rate by category
	const categoryCounts: Record<string, { wins: number; total: number }> = {};
	for (const sub of allSubmissions) {
		if (!sub.outcome) continue;
		const cat = sub.category || "Uncategorized";
		if (!categoryCounts[cat]) {
			categoryCounts[cat] = { wins: 0, total: 0 };
		}
		categoryCounts[cat].total++;
		if (sub.outcome === "won") {
			categoryCounts[cat].wins++;
		}
	}

	const winRateByCategory: WinLossAnalytics["winRateByCategory"] = {};
	for (const [cat, counts] of Object.entries(categoryCounts)) {
		winRateByCategory[cat] = {
			wins: counts.wins,
			total: counts.total,
			rate: counts.total > 0 ? (counts.wins / counts.total) * 100 : 0,
		};
	}

	// Win rate by value range
	const valueRanges = [
		{ range: "< $50K", min: 0, max: 50000 },
		{ range: "$50K - $100K", min: 50000, max: 100000 },
		{ range: "$100K - $500K", min: 100000, max: 500000 },
		{ range: "$500K - $1M", min: 500000, max: 1000000 },
		{ range: "> $1M", min: 1000000, max: Infinity },
	];

	const winRateByValueRange = valueRanges.map((range) => {
		const inRange = allSubmissions.filter((s) => {
			const value = s.budgetNumeric || 0;
			return value >= range.min && value < range.max && s.outcome;
		});
		const winsInRange = inRange.filter((s) => s.outcome === "won").length;
		return {
			range: range.range,
			wins: winsInRange,
			total: inRange.length,
			rate: inRange.length > 0 ? (winsInRange / inRange.length) * 100 : 0,
		};
	});

	// Win rate trend (by month)
	const monthCounts: Record<string, { wins: number; total: number }> = {};
	for (const sub of allSubmissions) {
		if (!sub.outcome) continue;
		const month = sub.submittedAt.toISOString().slice(0, 7); // YYYY-MM
		if (!monthCounts[month]) {
			monthCounts[month] = { wins: 0, total: 0 };
		}
		monthCounts[month].total++;
		if (sub.outcome === "won") {
			monthCounts[month].wins++;
		}
	}

	const winRateTrend = Object.entries(monthCounts)
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-12) // Last 12 months
		.map(([period, counts]) => ({
			period,
			wins: counts.wins,
			total: counts.total,
			rate: counts.total > 0 ? (counts.wins / counts.total) * 100 : 0,
		}));

	// Total value won
	const totalValueWon = allSubmissions
		.filter((s) => s.outcome === "won")
		.reduce((sum, s) => sum + (s.contractValue || 0), 0);

	const averageValueWon = wins > 0 ? totalValueWon / wins : 0;

	return {
		totalSubmissions,
		wins,
		losses,
		withdrawn,
		noAward,
		pending,
		winRate,
		winRateByCategory,
		winRateByValueRange,
		winRateTrend,
		totalValueWon,
		averageValueWon,
	};
}

/**
 * Get recent submissions.
 */
export async function getRecentSubmissions(limit: number = 10): Promise<
	Array<{
		submission: Submission;
		opportunityTitle: string;
	}>
> {
	const userContext = await requireUserContext();

	const rows = await db
		.select({
			submission: submissions,
			opportunityTitle: opportunities.title,
		})
		.from(submissions)
		.innerJoin(opportunities, eq(opportunities.id, submissions.opportunityId))
		.where(assignedOpportunityCondition(userContext.userId))
		.orderBy(desc(submissions.submittedAt))
		.limit(normalizeSubmissionLimit(limit));

	return rows.map((row) => ({
		submission: transformSubmission(row.submission),
		opportunityTitle: row.opportunityTitle,
	}));
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeSubmissionLimit(limit: number | undefined, fallback = 10, maximum = 1000): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return fallback;
	}
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

function formatDocumentType(type: string): string {
	const labels: Record<string, string> = {
		technical_approach: "Technical Approach",
		management_plan: "Management Plan",
		past_performance: "Past Performance",
		cost_proposal: "Cost Proposal",
		cover_letter: "Cover Letter",
		executive_summary: "Executive Summary",
		staffing_plan: "Staffing Plan",
		quality_assurance: "Quality Assurance",
		risk_mitigation: "Risk Mitigation",
		appendix: "Appendix",
		other: "Other",
	};
	return labels[type] || type;
}
