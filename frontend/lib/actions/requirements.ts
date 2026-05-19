/**
 * Requirements Server Actions - DocFusion
 *
 * Server actions for managing RFP requirements: CRUD operations,
 * AI extraction, compliance tracking, and gap analysis.
 */

"use server";

import { db } from "@/lib/db";
import { rfpRequirements } from "@/lib/db/schema-rfp";
import { proposalTasks, taskActivity } from "@/lib/db/schema-tasks";
import { opportunities } from "@/lib/db/schema";
import { eq, and, or, ilike, inArray, isNull, isNotNull, lt, sql, desc, asc, type SQL } from "drizzle-orm";
import { getProviderManager } from "@/lib/ai/providers";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import type {
	Requirement,
	RequirementInput,
	RequirementUpdateInput,
	RequirementFilters,
	RequirementSort,
	RequirementStats,
	ExtractedRequirement,
	ExtractionResult,
	RequirementGapAnalysis,
	RequirementCategory,
	RequirementPriority,
	RequirementWorkflowHistoryItem,
	RequirementWorkflowState,
	ComplianceStatus,
	RiskLevel,
	PaginatedResponse,
	PaginationOptions,
} from "@/lib/types/opportunity";
import { logger } from "@/lib/utils/logger";

type RequirementWorkflowAction = "accept" | "reject" | "reopen";

interface RequirementWorkflowTransitionInput {
	requirementId: string;
	action: RequirementWorkflowAction;
	actorId: string;
	actorName?: string;
	reason: string;
	assignedTo?: string;
	assignedToEmail?: string;
	dueDate?: Date | string;
	evidenceLinks?: string[];
}

interface RequirementWorkflowTransitionResult {
	requirement: Requirement;
	workflowState: RequirementWorkflowState;
	projectedTaskId?: string;
}

interface RequirementWorkflowMetadata {
	state: RequirementWorkflowState;
	reason?: string;
	acceptedAt?: string;
	acceptedBy?: string;
	rejectedAt?: string;
	rejectedBy?: string;
	reopenedAt?: string;
	reopenedBy?: string;
	updatedAt?: string;
	projectedTaskId?: string;
	evidenceLinks?: string[];
	history?: RequirementWorkflowHistoryEntry[];
}

interface RequirementWorkflowHistoryEntry {
	action: RequirementWorkflowAction;
	from: RequirementWorkflowState;
	to: RequirementWorkflowState;
	actorId: string;
	actorName?: string;
	reason: string;
	at: string;
	projectedTaskId?: string;
	evidenceLinks?: string[];
}

function assignedOpportunityCondition(userId: string): SQL {
	return sql`opportunities.assigned_to = ${userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(userId)
	)!;
}

function visibleRequirementsForOpportunityCondition(
	opportunityId: string,
	organizationId: string,
	userId: string
): SQL {
	return and(
		eq(rfpRequirements.opportunityId, opportunityId),
		eq(rfpRequirements.organizationId, organizationId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

function visibleRequirementCondition(id: string, organizationId: string, userId: string): SQL {
	return and(
		eq(rfpRequirements.id, id),
		eq(rfpRequirements.organizationId, organizationId),
		assignedOpportunityExistsSql(rfpRequirements.opportunityId, userId)
	)!;
}

function visibleRequirementIdsCondition(ids: string[], organizationId: string, userId: string): SQL {
	return and(
		inArray(rfpRequirements.id, ids),
		eq(rfpRequirements.organizationId, organizationId),
		assignedOpportunityExistsSql(rfpRequirements.opportunityId, userId)
	)!;
}

async function assertVisibleOpportunity(opportunityId: string, userId: string): Promise<void> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}
}

async function assertVisibleOpportunities(opportunityIds: string[], userId: string): Promise<void> {
	const uniqueIds = [...new Set(opportunityIds)];
	if (uniqueIds.length === 0) {
		return;
	}

	const visibleRows = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(and(
			inArray(opportunities.id, uniqueIds),
			assignedOpportunityCondition(userId)
		));

	if (visibleRows.length !== uniqueIds.length) {
		throw new Error("Opportunity not found");
	}
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a single requirement by ID.
 */
export async function getRequirement(id: string): Promise<Requirement | null> {
	const { organizationId, userId } = await requireTenantContext();
	const result = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementCondition(id, organizationId, userId))
		.limit(1);

	if (result.length === 0) return null;

	return mapDbToRequirement(result[0]);
}

/**
 * Get all requirements for an opportunity with optional filtering and sorting.
 */
export async function getRequirements(
	opportunityId: string,
	filters?: RequirementFilters,
	sort?: RequirementSort,
	pagination?: PaginationOptions
): Promise<PaginatedResponse<Requirement>> {
	const { organizationId, userId } = await requireTenantContext();
	const conditions = [
		visibleRequirementsForOpportunityCondition(opportunityId, organizationId, userId),
	];

	// Apply filters
	if (filters) {
		if (filters.search) {
			conditions.push(
				or(
					ilike(rfpRequirements.requirementText, `%${filters.search}%`),
					ilike(rfpRequirements.requirementNumber, `%${filters.search}%`),
					ilike(rfpRequirements.notes, `%${filters.search}%`)
				)!
			);
		}

		if (filters.categories && filters.categories.length > 0) {
			conditions.push(inArray(rfpRequirements.category, filters.categories));
		}

		if (filters.priorities && filters.priorities.length > 0) {
			conditions.push(inArray(rfpRequirements.priority, filters.priorities));
		}

		if (filters.complianceStatuses && filters.complianceStatuses.length > 0) {
			conditions.push(inArray(rfpRequirements.complianceStatus, filters.complianceStatuses));
		}

		if (filters.riskLevels && filters.riskLevels.length > 0) {
			conditions.push(inArray(rfpRequirements.riskLevel, filters.riskLevels));
		}

		if (filters.assignedTo) {
			conditions.push(eq(rfpRequirements.assignedTo, filters.assignedTo));
		}

		if (filters.hasDueDate === true) {
			conditions.push(isNotNull(rfpRequirements.dueDate));
		} else if (filters.hasDueDate === false) {
			conditions.push(isNull(rfpRequirements.dueDate));
		}

		if (filters.isOverdue) {
			conditions.push(lt(rfpRequirements.dueDate, new Date()));
			conditions.push(
				inArray(rfpRequirements.complianceStatus, ["not_addressed", "partial"])
			);
		}
	}

	// Build the query
	const whereClause = and(...conditions);

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(rfpRequirements)
		.where(whereClause);
	const total = Number(countResult[0]?.count ?? 0);

	// Build sorted query
	let query = db.select().from(rfpRequirements).where(whereClause);

	// Apply sorting
	const sortField = sort?.field ?? "createdAt";
	const sortDir = sort?.direction ?? "asc";

	const sortColumn = {
		requirementId: rfpRequirements.requirementNumber,
		category: rfpRequirements.category,
		priority: rfpRequirements.priority,
		complianceStatus: rfpRequirements.complianceStatus,
		riskLevel: rfpRequirements.riskLevel,
		dueDate: rfpRequirements.dueDate,
		createdAt: rfpRequirements.createdAt,
		updatedAt: rfpRequirements.updatedAt,
	}[sortField];

	if (sortColumn) {
		query = query.orderBy(sortDir === "desc" ? desc(sortColumn) : asc(sortColumn)) as typeof query;
	}

	// Apply pagination
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 50;
	const offset = (page - 1) * pageSize;

	const results = await query.limit(pageSize).offset(offset);

	return {
		data: results.map(mapDbToRequirement),
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

/**
 * Create a new requirement.
 */
export async function createRequirement(input: RequirementInput): Promise<Requirement> {
	const { organizationId, userId } = await requireTenantContext();
	await assertVisibleOpportunity(input.opportunityId, userId);

	const [result] = await db
		.insert(rfpRequirements)
		.values({
			organizationId,
			opportunityId: input.opportunityId,
			requirementNumber: input.requirementId ?? null,
			category: input.category ?? null,
			subcategory: input.subcategory ?? null,
			requirementText: input.text,
			sourceQuote: input.source ?? null,
			sourcePage: input.sourcePageRef ? parseInt(input.sourcePageRef, 10) : null,
			priority: input.priority ?? null,
			complianceStatus: input.complianceStatus ?? "not_addressed",
			responseStrategy: input.responseStrategy ?? null,
			assignedTo: input.assignedTo ?? null,
			dueDate: input.dueDate ? new Date(input.dueDate) : null,
			notes: input.notes ?? null,
			riskLevel: input.riskLevel ?? null,
		})
		.returning();

	return mapDbToRequirement(result);
}

/**
 * Create multiple requirements at once.
 */
export async function createRequirements(inputs: RequirementInput[]): Promise<Requirement[]> {
	const { organizationId, userId } = await requireTenantContext();
	if (inputs.length === 0) return [];
	await assertVisibleOpportunities(inputs.map((input) => input.opportunityId), userId);

	const results = await db
		.insert(rfpRequirements)
		.values(
			inputs.map((input) => ({
				organizationId,
				opportunityId: input.opportunityId,
				requirementNumber: input.requirementId ?? null,
				category: input.category ?? null,
				subcategory: input.subcategory ?? null,
				requirementText: input.text,
				sourceQuote: input.source ?? null,
				sourcePage: input.sourcePageRef ? parseInt(input.sourcePageRef, 10) : null,
				priority: input.priority ?? null,
				complianceStatus: input.complianceStatus ?? "not_addressed",
				responseStrategy: input.responseStrategy ?? null,
				assignedTo: input.assignedTo ?? null,
				dueDate: input.dueDate ? new Date(input.dueDate) : null,
				notes: input.notes ?? null,
				riskLevel: input.riskLevel ?? null,
			}))
		)
		.returning();

	return results.map(mapDbToRequirement);
}

/**
 * Update a requirement.
 */
export async function updateRequirement(
	id: string,
	input: RequirementUpdateInput
): Promise<Requirement | null> {
	const { organizationId, userId } = await requireTenantContext();
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (input.requirementId !== undefined) updateData.requirementNumber = input.requirementId;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
	if (input.text !== undefined) updateData.requirementText = input.text;
	if (input.source !== undefined) updateData.sourceQuote = input.source;
	if (input.sourcePageRef !== undefined) updateData.sourcePage = input.sourcePageRef ? parseInt(input.sourcePageRef, 10) : null;
	if (input.priority !== undefined) updateData.priority = input.priority;
	if (input.complianceStatus !== undefined) updateData.complianceStatus = input.complianceStatus;
	if (input.responseStrategy !== undefined) updateData.responseStrategy = input.responseStrategy;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.notes !== undefined) updateData.notes = input.notes;
	if (input.riskLevel !== undefined) updateData.riskLevel = input.riskLevel;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}

	const [result] = await db
		.update(rfpRequirements)
		.set(updateData)
		.where(visibleRequirementCondition(id, organizationId, userId))
		.returning();

	if (!result) return null;
	return mapDbToRequirement(result);
}

/**
 * Bulk update requirements.
 */
export async function bulkUpdateRequirements(
	ids: string[],
	input: RequirementUpdateInput
): Promise<{ updated: number }> {
	if (ids.length === 0) return { updated: 0 };

	const { organizationId, userId } = await requireTenantContext();
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (input.category !== undefined) updateData.category = input.category;
	if (input.priority !== undefined) updateData.priority = input.priority;
	if (input.complianceStatus !== undefined) updateData.complianceStatus = input.complianceStatus;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.riskLevel !== undefined) updateData.riskLevel = input.riskLevel;
	if (input.dueDate !== undefined) {
		updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
	}

	const results = await db
		.update(rfpRequirements)
		.set(updateData)
		.where(visibleRequirementIdsCondition(ids, organizationId, userId))
		.returning({ id: rfpRequirements.id });

	return { updated: results.length };
}

/**
 * Assign a requirement to a user with optional due date.
 */
export async function assignRequirement(
	id: string,
	assignedTo: string,
	dueDate?: Date | string
): Promise<Requirement | null> {
	const { organizationId, userId } = await requireTenantContext();
	const [result] = await db
		.update(rfpRequirements)
		.set({
			assignedTo,
			dueDate: dueDate ? new Date(dueDate) : null,
			updatedAt: new Date(),
		})
		.where(visibleRequirementCondition(id, organizationId, userId))
		.returning();

	if (!result) return null;
	return mapDbToRequirement(result);
}

/**
 * Move a requirement through the acceptance workflow.
 *
 * Acceptance is intentionally stricter than a plain status edit: it gates on
 * traceability, categorization, priority, owner, due date, and rationale before
 * projecting a writing task for proposal execution.
 */
export async function transitionRequirementWorkflow(
	input: RequirementWorkflowTransitionInput
): Promise<RequirementWorkflowTransitionResult | null> {
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Requirement workflow transition requires a reason.");
	}

	const { organizationId, userId } = await requireTenantContext();

	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.requirementId}))`);

		const [row] = await tx
			.select()
			.from(rfpRequirements)
			.where(visibleRequirementCondition(input.requirementId, organizationId, userId))
			.limit(1);

		if (!row) return null;

		const metadata = normalizeRequirementMetadata(row.metadata);
		const currentWorkflow = metadata.workflow;
		const fromState = currentWorkflow?.state ?? "review";
		const toState = getNextRequirementWorkflowState(fromState, input.action);
		const now = new Date();
		const assignedTo = input.assignedTo ?? row.assignedTo;
		const dueDate = input.dueDate ? new Date(input.dueDate) : row.dueDate;

		if (input.action === "accept") {
			const missing = getAcceptanceGateFailures(row, assignedTo, dueDate);
			if (missing.length > 0) {
				throw new Error(`Requirement acceptance blocked: missing ${missing.join(", ")}.`);
			}
		}

		let projectedTaskId = currentWorkflow?.projectedTaskId;

		if (input.action === "accept") {
			// TODO(W2): tenant-scope proposalTasks once schema gains organizationId
			const [existingTask] = await tx
				.select()
				.from(proposalTasks)
				.where(
					and(
						eq(proposalTasks.requirementId, row.id),
						eq(proposalTasks.sourceType, "requirement_workflow")
					)
				)
				.limit(1);

			const taskSyncData = {
				assignedTo,
				assignedToEmail: input.assignedToEmail ?? existingTask?.assignedToEmail ?? null,
				assignedBy: input.actorId,
				assignedAt: now,
				dueDate,
				status: assignedTo ? "assigned" : "pending",
				priority: mapRequirementPriorityToTaskPriority(row.priority, row.riskLevel),
				updatedAt: now,
			};

			if (existingTask) {
				projectedTaskId = existingTask.id;
				await tx
					.update(proposalTasks)
					.set(taskSyncData)
					.where(eq(proposalTasks.id, existingTask.id));
			} else {
				const [createdTask] = await tx
					.insert(proposalTasks)
					.values({
						opportunityId: row.opportunityId!,
						taskNumber: makeRequirementTaskNumber(row),
						title: `Draft response for ${row.requirementNumber ?? "requirement"}`,
						description: row.requirementText,
						taskType: "writing",
						taskCategory: row.category ?? "technical",
						requirementId: row.id,
						...taskSyncData,
						complianceRequirements: [row.requirementNumber ?? row.id],
						sourceType: "requirement_workflow",
						sourceId: row.id,
						createdBy: input.actorId,
					})
					.returning();

				projectedTaskId = createdTask?.id;
			}
		}

		const nextWorkflow = buildRequirementWorkflowMetadata({
			currentWorkflow,
			action: input.action,
			fromState,
			toState,
			input,
			now,
			projectedTaskId,
			reason,
		});

		const updateData: Record<string, unknown> = {
			metadata: {
				...metadata,
				workflow: nextWorkflow,
			},
			updatedAt: now,
		};

		if (input.action === "accept") {
			updateData.assignedTo = assignedTo;
			updateData.dueDate = dueDate;
			if (row.complianceStatus === "not_addressed") {
				updateData.complianceStatus = "partial";
			}
		}

		const [updated] = await tx
			.update(rfpRequirements)
			.set(updateData)
			.where(visibleRequirementCondition(input.requirementId, organizationId, userId))
			.returning();

		if (!updated) return null;

		if (projectedTaskId) {
			await tx.insert(taskActivity).values({
				taskId: projectedTaskId,
				activityType: "requirement_workflow_transition",
				description: `Requirement ${input.action}ed: ${reason}`,
				previousValue: fromState,
				newValue: toState,
				changeField: "requirement.workflow.state",
				userId: input.actorId,
				userName: input.actorName ?? input.actorId,
				metadata: {
					requirementId: row.id,
					action: input.action,
					evidenceLinks: input.evidenceLinks ?? [],
				},
			});
		}

		try {
			const runtimeInstance = await recordWorkflowRuntimeTransition({
				workflowKey: "requirement_acceptance",
				subjectType: "requirement",
				subjectId: row.id,
				opportunityId: row.opportunityId,
				fromState,
				toState,
				eventType: `requirement_${input.action}`,
				actorId: input.actorId,
				actorName: input.actorName,
				reason,
				evidenceLinks: input.evidenceLinks ?? [],
				priority: mapRequirementPriorityToTaskPriority(row.priority, row.riskLevel),
				assignedTo,
				assignedRole: "writer",
				assignedBy: input.actorId,
				dueAt: dueDate,
				visibility: "portal",
				portalVisibility: {
					visibleToPortal: toState === "accepted",
					portalRole: "contributor",
					summary: `Requirement ${row.requirementNumber ?? row.id} is ${toState}`,
					actionLabel: toState === "accepted" ? "Draft response" : undefined,
					actionUrl: `/opportunities/${row.opportunityId}/requirements`,
				},
				authorityPolicy: {
					requiredRoles: input.action === "accept" ? ["proposal_manager", "capture_manager"] : undefined,
					escalationRole: "proposal_manager",
				},
				metadata: {
					requirementNumber: row.requirementNumber,
					projectedTaskId,
					complianceStatus: updated.complianceStatus,
				},
				terminal: toState === "accepted" || toState === "rejected",
				notificationRecipients: assignedTo ? [assignedTo] : [],
			}, tx);

			if (projectedTaskId && toState === "accepted") {
				await upsertWorkflowRuntimeTask({
					workflowInstanceId: runtimeInstance.id,
					taskKey: `requirement-writing:${row.id}`,
					title: `Draft response for ${row.requirementNumber ?? "requirement"}`,
					description: row.requirementText,
					state: "open",
					priority: mapRequirementPriorityToTaskPriority(row.priority, row.riskLevel),
					assignedTo,
					assignedRole: "writer",
					dueAt: dueDate,
					metadata: { projectedTaskId, requirementId: row.id },
				}, tx);
			}
		} catch (error) {
			logger.warn("Requirement workflow runtime persistence failed:", error);
		}

		return {
			requirement: mapDbToRequirement(updated),
			workflowState: toState,
			projectedTaskId,
		};
	});
}

/**
 * Delete a requirement.
 */
export async function deleteRequirement(id: string): Promise<boolean> {
	const { organizationId, userId } = await requireTenantContext();
	const result = await db
		.delete(rfpRequirements)
		.where(visibleRequirementCondition(id, organizationId, userId))
		.returning({ id: rfpRequirements.id });

	return result.length > 0;
}

/**
 * Delete multiple requirements.
 */
export async function deleteRequirements(ids: string[]): Promise<{ deleted: number }> {
	if (ids.length === 0) return { deleted: 0 };

	const { organizationId, userId } = await requireTenantContext();
	const result = await db
		.delete(rfpRequirements)
		.where(visibleRequirementIdsCondition(ids, organizationId, userId))
		.returning({ id: rfpRequirements.id });

	return { deleted: result.length };
}

// ============================================================================
// Statistics & Analysis
// ============================================================================

/**
 * Get requirement statistics for an opportunity.
 */
export async function getRequirementStats(opportunityId: string): Promise<RequirementStats> {
	const { organizationId, userId } = await requireTenantContext();
	const allRequirements = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, organizationId, userId));

	const now = new Date();

	const stats: RequirementStats = {
		total: allRequirements.length,
		byCategory: {},
		byPriority: {
			mandatory: 0,
			preferred: 0,
			optional: 0,
		},
		byStatus: {
			not_addressed: 0,
			partial: 0,
			compliant: 0,
			non_compliant: 0,
			not_applicable: 0,
		},
		byRiskLevel: {
			low: 0,
			medium: 0,
			high: 0,
			critical: 0,
		},
		compliancePercentage: 0,
		overdueCount: 0,
		unassignedCount: 0,
	};

	let compliantCount = 0;
	let applicableCount = 0;

	for (const req of allRequirements) {
		// Count by category
		const category = req.category ?? "other";
		stats.byCategory[category] = (stats.byCategory[category] ?? 0) + 1;

		// Count by priority
		if (req.priority && req.priority in stats.byPriority) {
			stats.byPriority[req.priority as RequirementPriority]++;
		}

		// Count by status
		if (req.complianceStatus && req.complianceStatus in stats.byStatus) {
			stats.byStatus[req.complianceStatus as ComplianceStatus]++;
		}

		// Count by risk level
		if (req.riskLevel && req.riskLevel in stats.byRiskLevel) {
			stats.byRiskLevel[req.riskLevel]++;
		}

		// Track compliance
		if (req.complianceStatus !== "not_applicable") {
			applicableCount++;
			if (req.complianceStatus === "compliant") {
				compliantCount++;
			}
		}

		// Count overdue
		if (
			req.dueDate &&
			new Date(req.dueDate) < now &&
			req.complianceStatus !== "compliant" &&
			req.complianceStatus !== "not_applicable"
		) {
			stats.overdueCount++;
		}

		// Count unassigned
		if (!req.assignedTo) {
			stats.unassignedCount++;
		}
	}

	// Calculate compliance percentage
	stats.compliancePercentage = applicableCount > 0
		? Math.round((compliantCount / applicableCount) * 100)
		: 0;

	return stats;
}

/**
 * Analyze gaps in requirement coverage.
 * This is a heuristic-based analysis; in production, this would call an AI service.
 */
export async function analyzeRequirementGaps(
	opportunityId: string
): Promise<RequirementGapAnalysis> {
	const { organizationId, userId } = await requireTenantContext();
	const allRequirements = await db
		.select()
		.from(rfpRequirements)
		.where(visibleRequirementsForOpportunityCondition(opportunityId, organizationId, userId));

	const gaps: RequirementGapAnalysis["gaps"] = [];
	const recommendations: string[] = [];

	// Analyze by category
	const categoryStats: Record<string, { total: number; compliant: number; critical: number }> = {};

	for (const req of allRequirements) {
		const category = (req.category ?? "other") as RequirementCategory;
		if (!categoryStats[category]) {
			categoryStats[category] = { total: 0, compliant: 0, critical: 0 };
		}
		categoryStats[category].total++;

		if (req.complianceStatus === "compliant") {
			categoryStats[category].compliant++;
		}

		if (req.priority === "mandatory" && req.complianceStatus !== "compliant") {
			categoryStats[category].critical++;
		}
	}

	// Identify gaps
	for (const [category, stats] of Object.entries(categoryStats)) {
		const complianceRate = stats.total > 0 ? stats.compliant / stats.total : 0;

		if (complianceRate < 0.5 && stats.total > 0) {
			const severity: RiskLevel = stats.critical > 0 ? "critical" : complianceRate < 0.25 ? "high" : "medium";

			gaps.push({
				category: category as RequirementCategory,
				description: `Only ${Math.round(complianceRate * 100)}% of ${category} requirements are addressed`,
				severity,
				suggestedAction: `Review and address the ${stats.total - stats.compliant} outstanding ${category} requirements`,
			});
		}
	}

	// Check for unaddressed mandatory requirements
	const mandatoryUnaddressed = allRequirements.filter(
		(r) => r.priority === "mandatory" && r.complianceStatus !== "compliant"
	);
	if (mandatoryUnaddressed.length > 0) {
		recommendations.push(
			`Address ${mandatoryUnaddressed.length} mandatory requirement(s) that are not yet compliant`
		);
	}

	// Check for high-risk items
	const highRiskItems = allRequirements.filter(
		(r) => (r.riskLevel === "high" || r.riskLevel === "critical") &&
			r.complianceStatus !== "compliant"
	);
	if (highRiskItems.length > 0) {
		recommendations.push(
			`Prioritize ${highRiskItems.length} high/critical risk requirement(s)`
		);
	}

	// Check for overdue items
	const now = new Date();
	const overdueItems = allRequirements.filter(
		(r) => r.dueDate && new Date(r.dueDate) < now && r.complianceStatus !== "compliant"
	);
	if (overdueItems.length > 0) {
		recommendations.push(
			`Address ${overdueItems.length} overdue requirement(s)`
		);
	}

	// Calculate overall readiness
	const totalApplicable = allRequirements.filter(
		(r) => r.complianceStatus !== "not_applicable"
	).length;
	const totalCompliant = allRequirements.filter(
		(r) => r.complianceStatus === "compliant"
	).length;
	const overallReadiness = totalApplicable > 0
		? Math.round((totalCompliant / totalApplicable) * 100)
		: 0;

	return {
		opportunityId,
		gaps,
		overallReadiness,
		recommendations,
		analyzedAt: new Date(),
	};
}

// ============================================================================
// AI Extraction
// ============================================================================

/**
 * Extract requirements from document content using AI-powered analysis.
 * Uses Azure OpenAI to parse and identify requirements from document text.
 * Returns proper confidence scores based on AI certainty.
 */
export async function extractRequirements(
	opportunityId: string,
	documentContent: string
): Promise<ExtractionResult> {
	const { userId } = await requireTenantContext();
	await assertVisibleOpportunity(opportunityId, userId);

	const startTime = Date.now();

	const manager = getProviderManager();
	await manager.initialize();

	// If AI is available, use intelligent extraction
	if (await manager.isAvailable()) {
		try {
			return await extractRequirementsWithAI(opportunityId, documentContent);
		} catch (error) {
			logger.warn("[AI Extraction Error] Falling back to heuristic:", error);
		}
	}

	// Fallback to heuristic extraction
	return extractRequirementsHeuristic(opportunityId, documentContent, startTime);
}

/**
 * Extract requirements using AI-powered analysis.
 */
async function extractRequirementsWithAI(
	opportunityId: string,
	documentContent: string
): Promise<ExtractionResult> {
	const startTime = Date.now();
	const manager = getProviderManager();

	const systemPrompt = `You are an expert RFP/contract analyst. Extract requirements from a document.

Output your analysis as JSON with this exact structure:
{
  "requirements": [
    {
      "text": "<the requirement text>",
      "category": "technical|legal|compliance|financial|experience|personnel|security|administrative",
      "subcategory": "<optional subcategory>",
      "priority": "mandatory|preferred|optional",
      "riskLevel": "low|medium|high|critical",
      "source": "<optional source reference>"
    }
  ],
  "documentInfo": {
    "title": "<document title or null>",
    "organization": "<issuing organization or null>",
    "deadline": "<deadline if found or null>"
  },
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation of confidence level>"
}

Guidelines:
- Extract ALL requirements - must, shall, should, recommended, etc.
- Categorize each requirement accurately
- Identify priority based on language (mandatory=must/shall, preferred=should, optional=may/could)
- Assess risk based on business impact and complexity
- Provide confidence score based on clarity and completeness of extraction

Only output valid JSON.`;

	const userPrompt = `Extract all requirements from this RFP/contract document:

${documentContent.slice(0, 12000)}

Provide your extraction as JSON.`;

	try {
		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.3,
			maxTokens: 4096,
		});

		// Parse the JSON response
		const jsonMatch = response.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("Invalid JSON response from AI");
		}

		const analysis = JSON.parse(jsonMatch[0]) as {
			requirements?: Array<{
				text: string;
				category?: string;
				subcategory?: string;
				priority?: string;
				riskLevel?: string;
				source?: string;
			}>;
			documentInfo?: {
				title: string | null;
				organization: string | null;
				deadline: string | null;
			};
			confidence?: number;
			reasoning?: string;
		};

		const extractedRequirements: ExtractedRequirement[] = (analysis.requirements || []).map(
			(req) => ({
				text: req.text,
				category: (req.category as RequirementCategory) ?? null,
				subcategory: req.subcategory ?? null,
				source: req.source ?? documentContent.slice(0, 200),
				sourcePageRef: null,
				priority: (req.priority as RequirementPriority) ?? "optional",
				suggestedRiskLevel: (req.riskLevel as RiskLevel) ?? "medium",
			})
		);

		const confidence = Math.max(0.3, Math.min(1.0, analysis.confidence ?? 0.85));

		const processingTime = Date.now() - startTime;

		return {
			requirements: extractedRequirements,
			documentInfo: {
				title: analysis.documentInfo?.title ?? null,
				organization: analysis.documentInfo?.organization ?? null,
				deadline: analysis.documentInfo?.deadline ?? null,
				totalPages: null,
			},
			confidence,
			processingTime,
		};
	} catch (error) {
		logger.warn("[AI Extraction Parse Error]:", error);
		// Fallback to heuristic extraction on parse error
		return extractRequirementsHeuristic(opportunityId, documentContent, startTime);
	}
}

/**
 * Extract requirements using heuristic-based analysis (fallback).
 */
function extractRequirementsHeuristic(
	opportunityId: string,
	documentContent: string,
	startTime: number
): ExtractionResult {
	// Heuristic extraction: look for common requirement patterns
	const extractedRequirements: ExtractedRequirement[] = [];

	// Split by common delimiters
	const lines = documentContent.split(/\n/);
	let currentCategory: RequirementCategory | null = null;

	// Common category keywords
	const categoryKeywords: Record<string, RequirementCategory> = {
		technical: "technical",
		technology: "technical",
		software: "technical",
		hardware: "technical",
		legal: "legal",
		regulatory: "legal",
		compliance: "compliance",
		financial: "financial",
		budget: "financial",
		cost: "financial",
		experience: "experience",
		qualification: "experience",
		personnel: "personnel",
		staffing: "personnel",
		team: "personnel",
		security: "security",
		administrative: "administrative",
	};

	// Common priority indicators
	const mandatoryKeywords = ["must", "shall", "required", "mandatory", "essential"];
	const preferredKeywords = ["should", "preferred", "desirable", "recommended"];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Check for category headers
		const lowerLine = line.toLowerCase();
		for (const [keyword, category] of Object.entries(categoryKeywords)) {
			if (lowerLine.includes(keyword) && line.length < 100) {
				currentCategory = category;
				break;
			}
		}

		// Look for requirement-like lines (numbered items, bullet points, or containing key verbs)
		const isNumbered = /^[\d]+[.)]\s/.test(line) || /^[a-z][.)]\s/i.test(line);
		const isBulleted = /^[-•*]\s/.test(line);
		const hasRequirementVerb = mandatoryKeywords.some((k) => lowerLine.includes(k)) ||
			preferredKeywords.some((k) => lowerLine.includes(k));

		if ((isNumbered || isBulleted || hasRequirementVerb) && line.length > 20) {
			// Determine priority
			let priority: RequirementPriority | null = null;
			if (mandatoryKeywords.some((k) => lowerLine.includes(k))) {
				priority = "mandatory";
			} else if (preferredKeywords.some((k) => lowerLine.includes(k))) {
				priority = "preferred";
			} else {
				priority = "optional";
			}

			// Estimate risk based on keywords
			let riskLevel: RiskLevel | null = null;
			if (lowerLine.includes("critical") || lowerLine.includes("essential")) {
				riskLevel = "critical";
			} else if (lowerLine.includes("important") || priority === "mandatory") {
				riskLevel = "high";
			} else if (priority === "preferred") {
				riskLevel = "medium";
			} else {
				riskLevel = "low";
			}

			extractedRequirements.push({
				text: line.replace(/^[\d]+[.)]\s|^[a-z][.)]\s|^[-•*]\s/i, "").trim(),
				category: currentCategory,
				subcategory: null,
				source: line,
				sourcePageRef: null,
				priority,
				suggestedRiskLevel: riskLevel,
			});
		}
	}

	const processingTime = Date.now() - startTime;

	// Lower confidence for heuristic extraction
	const confidence = extractedRequirements.length > 0 ? 0.6 : 0.1;

	return {
		requirements: extractedRequirements,
		documentInfo: {
			title: null,
			organization: null,
			deadline: null,
			totalPages: null,
		},
		confidence,
		processingTime,
	};
}

/**
 * Save extracted requirements to the database.
 */
export async function saveExtractedRequirements(
	opportunityId: string,
	extracted: ExtractedRequirement[]
): Promise<Requirement[]> {
	const { userId } = await requireTenantContext();
	await assertVisibleOpportunity(opportunityId, userId);

	const inputs: RequirementInput[] = extracted.map((req, index) => ({
		opportunityId,
		requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
		text: req.text,
		category: req.category ?? undefined,
		subcategory: req.subcategory ?? undefined,
		source: req.source ?? undefined,
		sourcePageRef: req.sourcePageRef ?? undefined,
		priority: req.priority ?? undefined,
		riskLevel: req.suggestedRiskLevel ?? undefined,
		complianceStatus: "not_addressed",
	}));

	return createRequirements(inputs);
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeRequirementMetadata(
	metadata: unknown
): Record<string, unknown> & { workflow?: RequirementWorkflowMetadata } {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return {};
	}

	const record = metadata as Record<string, unknown>;
	const workflow = record.workflow;
	if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
		return { ...record };
	}

	const candidate = workflow as Partial<RequirementWorkflowMetadata>;
	const state = isRequirementWorkflowState(candidate.state) ? candidate.state : "review";
	return {
		...record,
		workflow: {
			...candidate,
			state,
			history: Array.isArray(candidate.history) ? candidate.history : [],
		},
	};
}

function isRequirementWorkflowState(value: unknown): value is RequirementWorkflowState {
	return value === "review" || value === "accepted" || value === "rejected";
}

function getNextRequirementWorkflowState(
	currentState: RequirementWorkflowState,
	action: RequirementWorkflowAction
): RequirementWorkflowState {
	const legalTransitions: Record<
		RequirementWorkflowState,
		Partial<Record<RequirementWorkflowAction, RequirementWorkflowState>>
	> = {
		review: {
			accept: "accepted",
			reject: "rejected",
		},
		accepted: {
			reopen: "review",
		},
		rejected: {
			reopen: "review",
		},
	};

	const nextState = legalTransitions[currentState][action];
	if (!nextState) {
		throw new Error(`Cannot ${action} requirement from ${currentState} state.`);
	}

	return nextState;
}

function getAcceptanceGateFailures(
	row: typeof rfpRequirements.$inferSelect,
	assignedTo: string | null,
	dueDate: Date | null
): string[] {
	const missing: string[] = [];

	if (!row.opportunityId) missing.push("opportunity");
	if (!row.sourceQuote && !row.sourceSection && row.sourcePage == null && !row.rfpDocumentId) {
		missing.push("source trace");
	}
	if (!row.category) missing.push("category");
	if (!row.priority) missing.push("priority");
	if (!assignedTo) missing.push("owner");
	if (!dueDate || Number.isNaN(dueDate.getTime())) missing.push("due date");

	return missing;
}

function buildRequirementWorkflowMetadata({
	currentWorkflow,
	action,
	fromState,
	toState,
	input,
	now,
	projectedTaskId,
	reason,
}: {
	currentWorkflow?: RequirementWorkflowMetadata;
	action: RequirementWorkflowAction;
	fromState: RequirementWorkflowState;
	toState: RequirementWorkflowState;
	input: RequirementWorkflowTransitionInput;
	now: Date;
	projectedTaskId?: string;
	reason: string;
}): RequirementWorkflowMetadata {
	const at = now.toISOString();
	const historyEntry: RequirementWorkflowHistoryEntry = {
		action,
		from: fromState,
		to: toState,
		actorId: input.actorId,
		actorName: input.actorName,
		reason,
		at,
		projectedTaskId,
		evidenceLinks: input.evidenceLinks ?? [],
	};

	const next: RequirementWorkflowMetadata = {
		...currentWorkflow,
		state: toState,
		reason,
		updatedAt: at,
		projectedTaskId,
		evidenceLinks: input.evidenceLinks ?? currentWorkflow?.evidenceLinks ?? [],
		history: [...(currentWorkflow?.history ?? []), historyEntry],
	};

	if (action === "accept") {
		next.acceptedAt = at;
		next.acceptedBy = input.actorId;
	}
	if (action === "reject") {
		next.rejectedAt = at;
		next.rejectedBy = input.actorId;
	}
	if (action === "reopen") {
		next.reopenedAt = at;
		next.reopenedBy = input.actorId;
	}

	return next;
}

function makeRequirementTaskNumber(row: typeof rfpRequirements.$inferSelect): string {
	const source = row.requirementNumber ?? row.id.slice(0, 8);
	return `REQ-${source}-WRITING`;
}

function mapRequirementPriorityToTaskPriority(
	priority: string | null,
	riskLevel: string | null
): "critical" | "high" | "medium" | "low" {
	if (riskLevel === "critical") return "critical";
	if (priority === "mandatory" || riskLevel === "high") return "high";
	if (priority === "optional" || riskLevel === "low") return "low";
	return "medium";
}

function mapRequirementWorkflowHistory(
	workflow?: RequirementWorkflowMetadata
): RequirementWorkflowHistoryItem[] {
	return (workflow?.history ?? []).map((entry) => {
		const at = new Date(entry.at);
		return {
			action: entry.action,
			from: entry.from,
			to: entry.to,
			actorId: entry.actorId,
			actorName: entry.actorName,
			reason: entry.reason,
			at: Number.isNaN(at.getTime()) ? new Date(0) : at,
			projectedTaskId: entry.projectedTaskId ?? null,
			evidenceLinks: entry.evidenceLinks ?? [],
		};
	});
}

/**
 * Map database row to Requirement type.
 */
function mapDbToRequirement(row: typeof rfpRequirements.$inferSelect): Requirement {
	const metadata = normalizeRequirementMetadata(row.metadata);
	const workflow = metadata.workflow;
	const workflowUpdatedAt = workflow?.updatedAt ? new Date(workflow.updatedAt) : null;

	return {
		id: row.id,
		opportunityId: row.opportunityId ?? "",
		requirementId: row.requirementNumber,
		category: row.category as RequirementCategory | null,
		subcategory: row.subcategory,
		text: row.requirementText,
		source: row.sourceQuote,
		sourcePageRef: row.sourcePage ? String(row.sourcePage) : null,
		priority: row.priority as RequirementPriority | null,
		complianceStatus: row.complianceStatus as ComplianceStatus,
		responseStrategy: row.responseStrategy,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		notes: row.notes,
		riskLevel: row.riskLevel as RiskLevel | null,
		aiAnalysis: row.aiAnalysis as Requirement["aiAnalysis"],
		workflowState: workflow?.state ?? "review",
		workflowReason: workflow?.reason ?? null,
		workflowUpdatedAt: workflowUpdatedAt && !Number.isNaN(workflowUpdatedAt.getTime())
			? workflowUpdatedAt
			: null,
		projectedTaskId: workflow?.projectedTaskId ?? null,
		workflowHistory: mapRequirementWorkflowHistory(workflow),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
