/**
 * Requirements Server Actions - DocFusion
 *
 * Server actions for managing RFP requirements: CRUD operations,
 * AI extraction, compliance tracking, and gap analysis.
 */

"use server";

import { db } from "@/lib/db";
import { requirements } from "@/lib/db/schema";
import { eq, and, or, ilike, inArray, isNull, isNotNull, lt, sql, desc, asc } from "drizzle-orm";
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
	ComplianceStatus,
	RiskLevel,
	PaginatedResponse,
	PaginationOptions,
} from "@/lib/types/opportunity";

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a single requirement by ID.
 */
export async function getRequirement(id: string): Promise<Requirement | null> {
	const result = await db
		.select()
		.from(requirements)
		.where(eq(requirements.id, id))
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
	const conditions = [eq(requirements.opportunityId, opportunityId)];

	// Apply filters
	if (filters) {
		if (filters.search) {
			conditions.push(
				or(
					ilike(requirements.text, `%${filters.search}%`),
					ilike(requirements.requirementId, `%${filters.search}%`),
					ilike(requirements.notes, `%${filters.search}%`)
				)!
			);
		}

		if (filters.categories && filters.categories.length > 0) {
			conditions.push(inArray(requirements.category, filters.categories));
		}

		if (filters.priorities && filters.priorities.length > 0) {
			conditions.push(inArray(requirements.priority, filters.priorities));
		}

		if (filters.complianceStatuses && filters.complianceStatuses.length > 0) {
			conditions.push(inArray(requirements.complianceStatus, filters.complianceStatuses));
		}

		if (filters.riskLevels && filters.riskLevels.length > 0) {
			conditions.push(inArray(requirements.riskLevel, filters.riskLevels));
		}

		if (filters.assignedTo) {
			conditions.push(eq(requirements.assignedTo, filters.assignedTo));
		}

		if (filters.hasDueDate === true) {
			conditions.push(isNotNull(requirements.dueDate));
		} else if (filters.hasDueDate === false) {
			conditions.push(isNull(requirements.dueDate));
		}

		if (filters.isOverdue) {
			conditions.push(lt(requirements.dueDate, new Date()));
			conditions.push(
				inArray(requirements.complianceStatus, ["not_addressed", "partial"])
			);
		}
	}

	// Build the query
	const whereClause = and(...conditions);

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(requirements)
		.where(whereClause);
	const total = Number(countResult[0]?.count ?? 0);

	// Build sorted query
	let query = db.select().from(requirements).where(whereClause);

	// Apply sorting
	const sortField = sort?.field ?? "createdAt";
	const sortDir = sort?.direction ?? "asc";

	const sortColumn = {
		requirementId: requirements.requirementId,
		category: requirements.category,
		priority: requirements.priority,
		complianceStatus: requirements.complianceStatus,
		riskLevel: requirements.riskLevel,
		dueDate: requirements.dueDate,
		createdAt: requirements.createdAt,
		updatedAt: requirements.updatedAt,
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
	const [result] = await db
		.insert(requirements)
		.values({
			opportunityId: input.opportunityId,
			requirementId: input.requirementId ?? null,
			category: input.category ?? null,
			subcategory: input.subcategory ?? null,
			text: input.text,
			source: input.source ?? null,
			sourcePageRef: input.sourcePageRef ?? null,
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
	if (inputs.length === 0) return [];

	const results = await db
		.insert(requirements)
		.values(
			inputs.map((input) => ({
				opportunityId: input.opportunityId,
				requirementId: input.requirementId ?? null,
				category: input.category ?? null,
				subcategory: input.subcategory ?? null,
				text: input.text,
				source: input.source ?? null,
				sourcePageRef: input.sourcePageRef ?? null,
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
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (input.requirementId !== undefined) updateData.requirementId = input.requirementId;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
	if (input.text !== undefined) updateData.text = input.text;
	if (input.source !== undefined) updateData.source = input.source;
	if (input.sourcePageRef !== undefined) updateData.sourcePageRef = input.sourcePageRef;
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
		.update(requirements)
		.set(updateData)
		.where(eq(requirements.id, id))
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
		.update(requirements)
		.set(updateData)
		.where(inArray(requirements.id, ids))
		.returning({ id: requirements.id });

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
	const [result] = await db
		.update(requirements)
		.set({
			assignedTo,
			dueDate: dueDate ? new Date(dueDate) : null,
			updatedAt: new Date(),
		})
		.where(eq(requirements.id, id))
		.returning();

	if (!result) return null;
	return mapDbToRequirement(result);
}

/**
 * Delete a requirement.
 */
export async function deleteRequirement(id: string): Promise<boolean> {
	const result = await db
		.delete(requirements)
		.where(eq(requirements.id, id))
		.returning({ id: requirements.id });

	return result.length > 0;
}

/**
 * Delete multiple requirements.
 */
export async function deleteRequirements(ids: string[]): Promise<{ deleted: number }> {
	if (ids.length === 0) return { deleted: 0 };

	const result = await db
		.delete(requirements)
		.where(inArray(requirements.id, ids))
		.returning({ id: requirements.id });

	return { deleted: result.length };
}

// ============================================================================
// Statistics & Analysis
// ============================================================================

/**
 * Get requirement statistics for an opportunity.
 */
export async function getRequirementStats(opportunityId: string): Promise<RequirementStats> {
	const allRequirements = await db
		.select()
		.from(requirements)
		.where(eq(requirements.opportunityId, opportunityId));

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
	const allRequirements = await db
		.select()
		.from(requirements)
		.where(eq(requirements.opportunityId, opportunityId));

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
// AI Extraction (Heuristic-based placeholder)
// ============================================================================

/**
 * Extract requirements from document content.
 * In production, this would call an AI service to parse the document.
 * This is a placeholder that demonstrates the interface.
 */
export async function extractRequirements(
	_opportunityId: string,
	documentContent: string
): Promise<ExtractionResult> {
	const startTime = Date.now();

	// Heuristic extraction: look for common requirement patterns
	const requirements: ExtractedRequirement[] = [];

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

			requirements.push({
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

	return {
		requirements,
		documentInfo: {
			title: null,
			organization: null,
			deadline: null,
			totalPages: null,
		},
		confidence: requirements.length > 0 ? 0.6 : 0.1, // Low confidence for heuristic extraction
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

/**
 * Map database row to Requirement type.
 */
function mapDbToRequirement(row: typeof requirements.$inferSelect): Requirement {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		requirementId: row.requirementId,
		category: row.category as RequirementCategory | null,
		subcategory: row.subcategory,
		text: row.text,
		source: row.source,
		sourcePageRef: row.sourcePageRef,
		priority: row.priority as RequirementPriority | null,
		complianceStatus: row.complianceStatus as ComplianceStatus,
		responseStrategy: row.responseStrategy,
		assignedTo: row.assignedTo,
		dueDate: row.dueDate,
		notes: row.notes,
		riskLevel: row.riskLevel as RiskLevel | null,
		aiAnalysis: row.aiAnalysis as Requirement["aiAnalysis"],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
