/**
 * Submission Server Actions - DocFusion
 *
 * Server actions for tracking proposal submissions and outcomes.
 */

"use server";

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
	submissions,
	proposalDocuments,
	documents,
	opportunities,
	type SubmissionRow,
} from "@/lib/db/schema";
import { eq, desc, and, gte, lte, sql, count, inArray } from "drizzle-orm";
import { evaluateFinalSubmissionChecklistWorkflow } from "@/lib/actions/final-submission-checklist-workflow";
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

/**
 * Create a new submission record.
 */
export async function createSubmission(
	input: CreateSubmissionInput
): Promise<Submission> {
	if (!input.submittedBy.trim()) {
		throw new Error("Submitted-by identity is required");
	}
	if (input.attachmentIds.length === 0) {
		throw new Error("At least one submission attachment is required");
	}
	if (!input.confirmationNumber?.trim()) {
		throw new Error("Submission confirmation number or receipt reference is required");
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
					eq(proposalDocuments.opportunityId, input.opportunityId),
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
			submittedBy: input.submittedBy.trim(),
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
		.where(eq(opportunities.id, input.opportunityId));

	try {
		await recordWorkflowRuntimeTransition({
			workflowKey: "production_submission",
			subjectType: "submission",
			subjectId: row.id,
			opportunityId: input.opportunityId,
			fromState: "final_review",
			toState: "submitted",
			eventType: "submission_dispatched",
			actorId: input.submittedBy.trim(),
			actorName: input.submittedBy.trim(),
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

	return transformSubmission(row);
}

/**
 * Get a submission by ID.
 */
export async function getSubmission(id: string): Promise<Submission | null> {
	const [row] = await db
		.select()
		.from(submissions)
		.where(eq(submissions.id, id));

	return row ? transformSubmission(row) : null;
}

/**
 * Get submissions for an opportunity.
 */
export async function getSubmissionsByOpportunity(
	opportunityId: string
): Promise<Submission[]> {
	const rows = await db
		.select()
		.from(submissions)
		.where(eq(submissions.opportunityId, opportunityId))
		.orderBy(desc(submissions.submittedAt));

	return rows.map(transformSubmission);
}

/**
 * Get submission history for an opportunity.
 */
export async function getSubmissionHistory(
	opportunityId: string
): Promise<Submission[]> {
	return getSubmissionsByOpportunity(opportunityId);
}

/**
 * Update submission status.
 */
export async function updateSubmissionStatus(
	input: UpdateSubmissionStatusInput
): Promise<Submission> {
	const [row] = await db
		.update(submissions)
		.set({
			status: input.status,
			notes: input.notes
				? sql`COALESCE(${submissions.notes}, '') || E'\n\n' || ${input.notes}`
				: undefined,
			updatedAt: new Date(),
		})
		.where(eq(submissions.id, input.submissionId))
		.returning();

	if (!row) {
		throw new Error(`Submission ${input.submissionId} not found`);
	}

	return transformSubmission(row);
}

/**
 * Record the outcome of a submission.
 */
export async function recordOutcome(
	input: RecordOutcomeInput
): Promise<Submission> {
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
		.where(eq(submissions.id, input.submissionId))
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
		.where(eq(opportunities.id, row.opportunityId));

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
	// Get proposal documents for this opportunity
	const docs = await db
		.select({
			id: proposalDocuments.id,
			documentType: proposalDocuments.documentType,
			status: proposalDocuments.status,
			title: documents.title,
		})
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(eq(proposalDocuments.opportunityId, opportunityId));

	// Get opportunity details
	const [opp] = await db
		.select()
		.from(opportunities)
		.where(eq(opportunities.id, opportunityId));

	const checklist: PreSubmissionChecklistItem[] = [];

	// Document checks
	const requiredDocTypes = [
		"technical_approach",
		"management_plan",
		"cost_proposal",
	];

	for (const docType of requiredDocTypes) {
		const doc = docs.find((d) => d.documentType === docType);
		const isCompleted = doc?.status === "final" || doc?.status === "approved";

		checklist.push({
			id: `doc-${docType}`,
			label: formatDocumentType(docType),
			description: `${formatDocumentType(docType)} document is complete and approved`,
			category: "documents",
			isRequired: true,
			isCompleted,
			notes: doc ? `Status: ${doc.status}` : "Document not found",
		});
	}

	// Compliance checks
	checklist.push({
		id: "compliance-page-limit",
		label: "Page Limit Compliance",
		description: "All documents are within specified page limits",
		category: "compliance",
		isRequired: true,
		isCompleted: false, // Would need actual page count check
	});

	checklist.push({
		id: "compliance-format",
		label: "Format Requirements",
		description: "Documents meet format requirements (font, margins, etc.)",
		category: "compliance",
		isRequired: true,
		isCompleted: false,
	});

	// Formatting checks
	checklist.push({
		id: "format-consistent",
		label: "Consistent Formatting",
		description: "All documents use consistent headers and styles",
		category: "formatting",
		isRequired: false,
		isCompleted: false,
	});

	// Administrative checks
	checklist.push({
		id: "admin-signatures",
		label: "Required Signatures",
		description: "All required signatures and certifications obtained",
		category: "administrative",
		isRequired: true,
		isCompleted: false,
	});

	checklist.push({
		id: "admin-deadline",
		label: "Submission Deadline",
		description: opp?.deadline
			? `Due by ${opp.deadline.toLocaleDateString()}`
			: "Verify submission deadline",
		category: "administrative",
		isRequired: true,
		isCompleted: opp?.deadline ? new Date() < opp.deadline : false,
	});

	return checklist;
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
	// Build conditions
	const conditions = [];
	if (filters?.startDate) {
		conditions.push(gte(submissions.submittedAt, filters.startDate));
	}
	if (filters?.endDate) {
		conditions.push(lte(submissions.submittedAt, filters.endDate));
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
		.where(conditions.length > 0 ? and(...conditions) : undefined)
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
	const rows = await db
		.select({
			submission: submissions,
			opportunityTitle: opportunities.title,
		})
		.from(submissions)
		.innerJoin(opportunities, eq(opportunities.id, submissions.opportunityId))
		.orderBy(desc(submissions.submittedAt))
		.limit(limit);

	return rows.map((row) => ({
		submission: transformSubmission(row.submission),
		opportunityTitle: row.opportunityTitle,
	}));
}

// ============================================================================
// Helpers
// ============================================================================

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
