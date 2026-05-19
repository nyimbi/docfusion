/**
 * Opportunities CRUD Server Actions - DocFusion
 *
 * Server-side actions for creating, reading, updating, and deleting opportunities.
 * Includes filtering, sorting, and duplication.
 */

"use server";

import { db } from "@/lib/db";
import { opportunities, opportunityVotes } from "@/lib/db/schema";
import {
	eq,
	and,
	or,
	gte,
	lte,
	like,
	inArray,
	desc,
	asc,
	sql,
	count,
	type SQL,
} from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth-utils";
import type {
	DecisionStatus,
	PriorityRank,
	OpportunityType,
	RevenuePotential,
	OpportunityListItem,
	OpportunityFilters,
	PaginatedResponse,
	OpportunitySort,
	VoteDecision,
	VoteSummary,
} from "@/lib/types/opportunity";
import { AFRICAN_COUNTRIES } from "@/lib/constants/continents";

// ============================================================================
// Interface Definitions
// ============================================================================

/**
 * Input for creating a new opportunity.
 */
export interface CreateOpportunityInput {
	/** Original ID from source system (e.g., "RFP-085") */
	sourceId?: string;
	/** Opportunity title */
	title: string;
	/** Category (e.g., "GIS", "Digital Transformation", "Cybersecurity") */
	category?: string;
	/** IT subcategory */
	itCategory?: string;
	/** Sector (e.g., "Government/SOE", "NGO", "Commercial") */
	sector?: string;
	/** Continent (e.g., "africa", "asia", "europe") */
	continent?: string;
	/** Country or region */
	country?: string;
	/** Organization/client name */
	organization?: string;
	/** Funder if different from organization */
	funder?: string;
	/** Source URL where opportunity was found */
	sourceUrl?: string;
	/** RFP/EOI document link */
	rfpLink?: string;
	/** Issue/publication date */
	issueDate?: Date | string;
	/** Submission deadline */
	submissionDeadline?: Date | string;
	/** Expiry date */
	expiryDate?: Date | string;
	/** Decision/award date */
	decisionDate?: Date | string;
	/** Value amount (numeric) */
	valueAmount?: number;
	/** Value currency */
	valueCurrency?: string;
	/** Budget as displayed string */
	budgetValue?: string;
	/** Project duration (e.g., "12 months", "2 years") */
	projectDuration?: string;
	/** Opportunity type */
	opportunityType?: OpportunityType;
	/** Tags for categorization */
	tags?: string[];
	/** Priority rank (1-5, 5 = highest) */
	priorityRank?: PriorityRank;
	/** Score/fit score (0-100) */
	score?: number;
	/** Win probability (0-100) */
	winProbability?: number;
	/** Revenue potential category */
	revenuePotential?: RevenuePotential;
	/** Decision status */
	decisionStatus?: DecisionStatus;
	/** Reason for decision */
	decisionReason?: string;
	/** Whether opportunity is expired */
	isExpired?: boolean;
	/** Whether opportunity has been reviewed */
	isReviewed?: boolean;
	/** Assigned team member */
	assignedTo?: string;
	/** Strategic notes/description */
	notes?: string;
	/** Project summary */
	projectSummary?: string;
	/** Project scope */
	projectScope?: string;
	/** Key requirements */
	keyRequirements?: string;
	/** Technical requirements */
	technicalRequirements?: string;
	/** Submission method */
	submissionMethod?: string;
	/** Submission requirements */
	submissionRequirements?: string;
	/** Source platform */
	sourcePlatform?: string;
	/** Source filename */
	sourceFile?: string;
	/** Custom fields (JSON) */
	customFields?: Record<string, unknown>;
	/** Extended metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing opportunity.
 * All fields are optional except those you want to change.
 */
export interface UpdateOpportunityInput {
	sourceId?: string;
	title?: string;
	category?: string;
	itCategory?: string;
	sector?: string;
	continent?: string;
	country?: string;
	organization?: string;
	funder?: string;
	sourceUrl?: string;
	rfpLink?: string;
	issueDate?: Date | string;
	submissionDeadline?: Date | string;
	expiryDate?: Date | string;
	decisionDate?: Date | string;
	valueAmount?: number;
	valueCurrency?: string;
	budgetValue?: string;
	projectDuration?: string;
	opportunityType?: OpportunityType;
	tags?: string[];
	priorityRank?: PriorityRank;
	score?: number;
	winProbability?: number;
	revenuePotential?: RevenuePotential;
	decisionStatus?: DecisionStatus;
	decisionReason?: string;
	isExpired?: boolean;
	isReviewed?: boolean;
	assignedTo?: string;
	notes?: string;
	projectSummary?: string;
	projectScope?: string;
	keyRequirements?: string;
	technicalRequirements?: string;
	submissionMethod?: string;
	submissionRequirements?: string;
	sourcePlatform?: string;
	sourceFile?: string;
	customFields?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

/**
 * Response type for listOpportunities function.
 * Extends PaginatedResponse with optional vote summaries.
 */
export type OpportunityListResponse = PaginatedResponse<OpportunityListItem> & {
	/** Vote summaries for each opportunity (if votes exist) */
	voteSummaries?: Map<string, VoteSummary>;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate days left until deadline.
 */
function calculateDaysLeft(deadline: Date | null): number | null {
	if (!deadline) return null;
	const now = new Date();
	return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is expired.
 */
function isDateExpired(date: Date | null): boolean {
	if (!date) return false;
	return date < new Date();
}

/**
 * Parse date input to Date object.
 */
function parseDateInput(input: Date | string | undefined): Date | null {
	if (!input) return null;
	return input instanceof Date ? input : new Date(input);
}

function assignedOpportunityByIdCondition(id: string, userId: string): SQL {
	return and(
		eq(opportunities.id, id),
		eq(opportunities.assignedTo, userId)
	)!;
}

function assignedOpportunityExistsSql(id: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${id}
			and opportunities.assigned_to = ${userId}
	)`;
}

function opportunityVotesByAssignedOpportunityCondition(id: string, userId: string): SQL {
	return and(
		eq(opportunityVotes.opportunityId, id),
		assignedOpportunityExistsSql(id, userId)
	)!;
}

/**
 * Map database row to OpportunityListItem.
 */
function mapToOpportunityListItem(row: typeof opportunities.$inferSelect): OpportunityListItem {
	return {
		id: row.id,
		sourceId: row.sourceId ?? null,
		title: row.title,
		category: row.category ?? null,
		countryRegion: row.countryRegion ?? null,
		organization: row.organization ?? null,
		deadline: row.deadline ?? null,
		daysLeft: row.daysLeft ?? null,
		isExpired: row.isExpired,
		budgetValue: row.budgetValue ?? null,
		priorityRank: (row.priorityRank ?? 3) as PriorityRank,
		fitScore: row.fitScore ?? null,
		decisionStatus: (row.decisionStatus ?? "pending") as DecisionStatus,
		assignedTo: row.assignedTo ?? null,
		tags: (row.tags as string[]) ?? [],
		rfpLink: row.rfpLink ?? null,
	};
}

// ============================================================================
// CRUD Operations
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

/**
 * Create a new opportunity.
 *
 * @param input - Opportunity creation data
 * @returns Created opportunity as OpportunityListItem
 */
export async function createOpportunity(
	input: CreateOpportunityInput
): Promise<OpportunityListItem> {
	await requireCurrentUserId();

	const now = new Date();

	// Parse dates
	const deadline = parseDateInput(input.submissionDeadline);
	const daysLeft = calculateDaysLeft(deadline);
	const isExpired = input.isExpired ?? isDateExpired(deadline);

	// Prepare custom metadata by extracting continent, country, sourceUrl, etc.
	const customMetadata: Record<string, unknown> = {};

	if (input.continent) customMetadata.continent = input.continent;
	if (input.country) customMetadata.country = input.country;
	if (input.sourceUrl) customMetadata.sourceUrl = input.sourceUrl;
	if (input.issueDate) {
		const parsed = parseDateInput(input.issueDate);
		if (parsed) customMetadata.issueDate = parsed.toISOString();
	}
	if (input.expiryDate) {
		const parsed = parseDateInput(input.expiryDate);
		if (parsed) customMetadata.expiryDate = parsed.toISOString();
	}
	if (input.decisionDate) {
		const parsed = parseDateInput(input.decisionDate);
		if (parsed) customMetadata.decisionDate = parsed.toISOString();
	}
	if (input.projectDuration) customMetadata.projectDuration = input.projectDuration;

	// Merge custom fields and metadata
	const mergedMetadata: Record<string, unknown> = {
		...input.metadata,
		...input.customFields,
		...customMetadata,
	};

	// Clean undefined values from metadata
	const cleanMetadata = Object.fromEntries(
		Object.entries(mergedMetadata).filter(([_, v]) => v !== undefined && v !== null)
	);

	const [row] = await db
		.insert(opportunities)
		.values({
			sourceId: input.sourceId,
			title: input.title,
			category: input.category,
			itCategory: input.itCategory,
			sector: input.sector,
			countryRegion: input.country ?? input.continent,
			organization: input.organization,
			funder: input.funder,
			deadline,
			daysLeft,
			isExpired,
			budgetValue: input.budgetValue,
			budgetNumeric: input.valueAmount,
			budgetCurrency: input.valueCurrency,
			projectSummary: input.projectSummary,
			projectScope: input.projectScope,
			keyRequirements: input.keyRequirements,
			technicalRequirements: input.technicalRequirements,
			submissionMethod: input.submissionMethod,
			submissionRequirements: input.submissionRequirements,
			rfpLink: input.rfpLink ?? input.sourceUrl,
			sourcePlatform: input.sourcePlatform,
			sourceFile: input.sourceFile,
			opportunityType: input.opportunityType ?? "rfp",
			priorityRank: input.priorityRank ?? 3,
			fitScore: input.score ?? input.winProbability,
			winProbability: input.winProbability,
			revenuePotential: input.revenuePotential,
			strategicNotes: input.notes,
			decisionStatus: input.decisionStatus ?? "pending",
			decisionReason: input.decisionReason,
			assignedTo: input.assignedTo,
			isReviewed: input.isReviewed ?? false,
			tags: input.tags ?? [],
			metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : null,
			createdAt: now,
			updatedAt: now,
			importedAt: now,
		})
		.returning();

	return mapToOpportunityListItem(row);
}

/**
 * Get an opportunity by ID.
 *
 * @param id - Opportunity ID (UUID)
 * @returns Opportunity or null if not found
 */
export async function getOpportunityById(
	id: string
): Promise<OpportunityListItem | null> {
	const userId = await requireCurrentUserId();

	const [row] = await db
		.select()
		.from(opportunities)
		.where(assignedOpportunityByIdCondition(id, userId))
		.limit(1);

	return row ? mapToOpportunityListItem(row) : null;
}

/**
 * Update an existing opportunity.
 *
 * @param id - Opportunity ID (UUID)
 * @param input - Opportunity update data
 * @returns Updated opportunity
 * @throws Error if opportunity not found
 */
export async function updateOpportunity(
	id: string,
	input: UpdateOpportunityInput
): Promise<OpportunityListItem> {
	const userId = await requireCurrentUserId();

	const now = new Date();

	// Build update data
	const updateData: Partial<typeof opportunities.$inferInsert> = {
		updatedAt: now,
	};

	// Basic fields
	if (input.sourceId !== undefined) updateData.sourceId = input.sourceId;
	if (input.title !== undefined) updateData.title = input.title;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.itCategory !== undefined) updateData.itCategory = input.itCategory;
	if (input.sector !== undefined) updateData.sector = input.sector;
	if (input.organization !== undefined) updateData.organization = input.organization;
	if (input.funder !== undefined) updateData.funder = input.funder;
	if (input.budgetValue !== undefined) updateData.budgetValue = input.budgetValue;
	if (input.opportunityType !== undefined) updateData.opportunityType = input.opportunityType;
	if (input.priorityRank !== undefined) updateData.priorityRank = input.priorityRank;
	if (input.decisionStatus !== undefined) updateData.decisionStatus = input.decisionStatus;
	if (input.decisionReason !== undefined) updateData.decisionReason = input.decisionReason;
	if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
	if (input.isExpired !== undefined) updateData.isExpired = input.isExpired;
	if (input.isReviewed !== undefined) updateData.isReviewed = input.isReviewed;
	if (input.sourcePlatform !== undefined) updateData.sourcePlatform = input.sourcePlatform;
	if (input.sourceFile !== undefined) updateData.sourceFile = input.sourceFile;
	if (input.tags !== undefined) updateData.tags = input.tags;
	if (input.projectSummary !== undefined) updateData.projectSummary = input.projectSummary;
	if (input.projectScope !== undefined) updateData.projectScope = input.projectScope;
	if (input.keyRequirements !== undefined) updateData.keyRequirements = input.keyRequirements;
	if (input.technicalRequirements !== undefined)
		updateData.technicalRequirements = input.technicalRequirements;
	if (input.submissionMethod !== undefined) updateData.submissionMethod = input.submissionMethod;
	if (input.submissionRequirements !== undefined)
		updateData.submissionRequirements = input.submissionRequirements;

	// Country/Region mapping
	if (input.country !== undefined || input.continent !== undefined) {
		updateData.countryRegion = input.country ?? input.continent;
	}

	// Notes mapping
	if (input.notes !== undefined) {
		updateData.strategicNotes = input.notes;
	}

	// RFP Link / Source URL mapping
	if (input.rfpLink !== undefined) {
		updateData.rfpLink = input.rfpLink;
	} else if (input.sourceUrl !== undefined) {
		updateData.rfpLink = input.sourceUrl;
	}

	// Score/Value mapping
	if (input.score !== undefined) {
		updateData.fitScore = input.score;
	}
	if (input.valueAmount !== undefined) {
		updateData.budgetNumeric = input.valueAmount;
	}
	if (input.valueCurrency !== undefined) {
		updateData.budgetCurrency = input.valueCurrency;
	}
	if (input.winProbability !== undefined) {
		updateData.winProbability = input.winProbability;
	}
	if (input.revenuePotential !== undefined) {
		updateData.revenuePotential = input.revenuePotential;
	}

	// Handle deadline updates and recalculate days_left/is_expired
	if (input.submissionDeadline !== undefined) {
		const deadline = parseDateInput(input.submissionDeadline);
		updateData.deadline = deadline;
		updateData.daysLeft = calculateDaysLeft(deadline);
		updateData.isExpired = isDateExpired(deadline);
	}

	// Handle metadata merge
	if (
		input.metadata !== undefined ||
		input.customFields !== undefined ||
		input.continent !== undefined ||
		input.sourceUrl !== undefined ||
		input.issueDate !== undefined ||
		input.expiryDate !== undefined ||
		input.decisionDate !== undefined ||
		input.projectDuration !== undefined
	) {
		// Get existing metadata first
		const [existing] = await db
			.select({ metadata: opportunities.metadata })
			.from(opportunities)
			.where(assignedOpportunityByIdCondition(id, userId))
			.limit(1);

		const existingMetadata = (existing?.metadata as Record<string, unknown>) ?? {};

		const newMetadata: Record<string, unknown> = {
			...existingMetadata,
			...(input.metadata ?? {}),
			...(input.customFields ?? {}),
		};

		if (input.continent !== undefined) {
			newMetadata.continent = input.continent;
		}
		if (input.sourceUrl !== undefined) {
			newMetadata.sourceUrl = input.sourceUrl;
		}
		if (input.issueDate !== undefined) {
			newMetadata.issueDate = parseDateInput(input.issueDate)?.toISOString() ?? null;
		}
		if (input.expiryDate !== undefined) {
			newMetadata.expiryDate = parseDateInput(input.expiryDate)?.toISOString() ?? null;
		}
		if (input.decisionDate !== undefined) {
			newMetadata.decisionDate = parseDateInput(input.decisionDate)?.toISOString() ?? null;
		}
		if (input.projectDuration !== undefined) {
			newMetadata.projectDuration = input.projectDuration;
		}

		// Clean undefined values
		const cleanMetadata = Object.fromEntries(
			Object.entries(newMetadata).filter(([_, v]) => v !== undefined && v !== null)
		);

		updateData.metadata =
			Object.keys(cleanMetadata).length > 0 ? cleanMetadata : null;
	}

	// Execute update
	const [row] = await db
		.update(opportunities)
		.set(updateData)
		.where(assignedOpportunityByIdCondition(id, userId))
		.returning();

	if (!row) {
		throw new Error(`Opportunity not found: ${id}`);
	}

	return mapToOpportunityListItem(row);
}

/**
 * Delete an opportunity.
 *
 * @param id - Opportunity ID (UUID)
 * @throws Error if deletion fails
 */
export async function deleteOpportunity(id: string): Promise<void> {
	const userId = await requireCurrentUserId();

	// Delete associated votes first (cascade should handle this, but being explicit)
	await db.delete(opportunityVotes).where(opportunityVotesByAssignedOpportunityCondition(id, userId));

	// Delete opportunity
	const result = await db.delete(opportunities).where(assignedOpportunityByIdCondition(id, userId));

	if (!result) {
		throw new Error(`Failed to delete opportunity: ${id}`);
	}
}

/**
 * List opportunities with optional filtering, sorting, and pagination.
 *
 * @param filters - Optional filter criteria
 * @param sort - Optional sort configuration
 * @param page - Page number (1-based)
 * @param pageSize - Number of items per page
 * @returns Paginated list of opportunities
 */
export async function listOpportunities(
	filters?: OpportunityFilters,
	sort?: OpportunitySort,
	page: number = 1,
	pageSize: number = 25
): Promise<OpportunityListResponse> {
	await requireCurrentUserId();

	const offset = (page - 1) * pageSize;

	// Build WHERE conditions
	const conditions: (ReturnType<typeof eq> | ReturnType<typeof and> | ReturnType<typeof or> | ReturnType<typeof gte> | ReturnType<typeof lte> | ReturnType<typeof like> | ReturnType<typeof inArray>)[] = [];

	if (filters?.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				like(opportunities.title, searchTerm),
				like(opportunities.organization, searchTerm),
				like(opportunities.projectSummary ?? "", searchTerm),
				like(opportunities.keyRequirements ?? "", searchTerm)
			)!
		);
	}

	if (filters?.categories?.length) {
		conditions.push(inArray(opportunities.category, filters.categories));
	}

	if (filters?.sectors?.length) {
		conditions.push(inArray(opportunities.sector, filters.sectors));
	}

	if (filters?.countries?.length) {
		conditions.push(inArray(opportunities.countryRegion, filters.countries));
	}

	if (filters?.organizations?.length) {
		conditions.push(inArray(opportunities.organization, filters.organizations));
	}

	if (filters?.statuses?.length) {
		conditions.push(inArray(opportunities.decisionStatus, filters.statuses));
	}

	if (filters?.priorityRanks?.length) {
		conditions.push(inArray(opportunities.priorityRank, filters.priorityRanks));
	}

	if (filters?.tags?.length) {
		// Tags are stored as JSONB array, need to check if each tag is contained
		// This is a simplified approach - for production, consider using a tags table
		for (const tag of filters.tags) {
			conditions.push(
				sql`EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(${opportunities.tags}) AS t
					WHERE LOWER(t) = LOWER(${tag})
				)`
			);
		}
	}

	if (filters?.isExpired !== undefined) {
		conditions.push(eq(opportunities.isExpired, filters.isExpired));
	}

	if (filters?.isReviewed !== undefined) {
		conditions.push(eq(opportunities.isReviewed, filters.isReviewed));
	}

	if (filters?.deadlineFrom) {
		conditions.push(gte(opportunities.deadline, filters.deadlineFrom));
	}

	if (filters?.deadlineTo) {
		conditions.push(lte(opportunities.deadline, filters.deadlineTo));
	}

	if (filters?.budgetMin !== undefined) {
		conditions.push(gte(opportunities.budgetNumeric, filters.budgetMin));
	}

	if (filters?.budgetMax !== undefined) {
		conditions.push(lte(opportunities.budgetNumeric, filters.budgetMax));
	}

	if (filters?.fitScoreMin !== undefined) {
		conditions.push(gte(opportunities.fitScore, filters.fitScoreMin));
	}

	if (filters?.fitScoreMax !== undefined) {
		conditions.push(lte(opportunities.fitScore, filters.fitScoreMax));
	}

	if (filters?.sourceFiles?.length) {
		conditions.push(inArray(opportunities.sourceFile, filters.sourceFiles));
	}

	if (filters?.assignedTo) {
		conditions.push(eq(opportunities.assignedTo, filters.assignedTo));
	}

	// Continent filter - match countryRegion against continent's country list
	if (filters?.continent === "africa") {
		// Build an OR condition that matches any African country in countryRegion
		// This handles: single country ("Kenya"), multi-country ("Kenya/Uganda"),
		// regional ("Africa Regional", "EAC Region"), and numbered ("11 African Countries")
		const africaPatterns = [
			// Match "Africa" anywhere in the string
			sql`${opportunities.countryRegion} ILIKE '%Africa%'`,
			// Match regional blocs
			sql`${opportunities.countryRegion} ILIKE '%EAC%'`,
			sql`${opportunities.countryRegion} ILIKE '%COMESA%'`,
			sql`${opportunities.countryRegion} ILIKE '%ECOWAS%'`,
			sql`${opportunities.countryRegion} ILIKE '%SADC%'`,
			// Match specific African countries (top 20 most common)
			...["Kenya", "Nigeria", "South Africa", "Ghana", "Tanzania", "Uganda",
				"Rwanda", "Ethiopia", "Egypt", "Morocco", "Botswana", "Zambia",
				"Zimbabwe", "Malawi", "Cameroon", "Senegal", "DRC", "Angola",
				"Mozambique", "Namibia"].map(country =>
				sql`${opportunities.countryRegion} ILIKE ${'%' + country + '%'}`
			),
		];
		conditions.push(or(...africaPatterns)!);
	} else if (filters?.continent) {
		// For other continents, use a similar approach (can be extended)
		conditions.push(
			sql`${opportunities.metadata}->>'continent' = ${filters.continent}`
		);
	}

	// Build ORDER BY
	const sortField = sort?.field ?? "deadline";
	const sortDir = sort?.direction ?? "asc";

	const orderByColumn = {
		deadline: opportunities.deadline,
		priorityRank: opportunities.priorityRank,
		fitScore: opportunities.fitScore,
		budgetNumeric: opportunities.budgetNumeric,
		title: opportunities.title,
		organization: opportunities.organization,
		category: opportunities.category,
		countryRegion: opportunities.countryRegion,
		createdAt: opportunities.createdAt,
		updatedAt: opportunities.updatedAt,
	}[sortField];

	const orderBy = sortDir === "asc" ? asc(orderByColumn) : desc(orderByColumn);

	// Execute queries
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, totalResult] = await Promise.all([
		db
			.select({
				id: opportunities.id,
				sourceId: opportunities.sourceId,
				title: opportunities.title,
				category: opportunities.category,
				countryRegion: opportunities.countryRegion,
				organization: opportunities.organization,
				deadline: opportunities.deadline,
				daysLeft: opportunities.daysLeft,
				isExpired: opportunities.isExpired,
				budgetValue: opportunities.budgetValue,
				priorityRank: opportunities.priorityRank,
				fitScore: opportunities.fitScore,
				decisionStatus: opportunities.decisionStatus,
				assignedTo: opportunities.assignedTo,
				tags: opportunities.tags,
				rfpLink: opportunities.rfpLink,
			})
			.from(opportunities)
			.where(whereClause)
			.orderBy(orderBy)
			.limit(pageSize)
			.offset(offset),
		db
			.select({ count: count() })
			.from(opportunities)
			.where(whereClause),
	]);

	const total = totalResult[0]?.count ?? 0;

	return {
		data: rows.map((row) =>
			mapToOpportunityListItem(row as typeof opportunities.$inferSelect)
		),
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}

/**
 * Duplicate an opportunity.
 * Creates a copy with "(Copy)" appended to the title and resets certain fields.
 *
 * @param id - Opportunity ID to duplicate
 * @returns Newly created opportunity
 * @throws Error if opportunity not found
 */
export async function duplicateOpportunity(
	id: string
): Promise<OpportunityListItem> {
	const userId = await requireCurrentUserId();

	// Get the original opportunity
	const [original] = await db
		.select()
		.from(opportunities)
		.where(assignedOpportunityByIdCondition(id, userId))
		.limit(1);

	if (!original) {
		throw new Error(`Opportunity not found: ${id}`);
	}

	const now = new Date();

	// Reset certain fields for the copy
	const [row] = await db
		.insert(opportunities)
		.values({
			sourceId: original.sourceId ? `${original.sourceId}_copy_${Date.now()}` : null,
			title: `${original.title} (Copy)`,
			category: original.category,
			itCategory: original.itCategory,
			sector: original.sector,
			countryRegion: original.countryRegion,
			organization: original.organization,
			funder: original.funder,
			deadline: original.deadline,
			daysLeft: original.daysLeft,
			isExpired: original.isExpired,
			budgetValue: original.budgetValue,
			budgetNumeric: original.budgetNumeric,
			budgetCurrency: original.budgetCurrency,
			projectSummary: original.projectSummary,
			projectScope: original.projectScope,
			keyRequirements: original.keyRequirements,
			technicalRequirements: original.technicalRequirements,
			submissionMethod: original.submissionMethod,
			submissionRequirements: original.submissionRequirements,
			rfpLink: original.rfpLink,
			sourcePlatform: original.sourcePlatform,
			sourceFile: original.sourceFile,
			opportunityType: original.opportunityType,
			priorityRank: original.priorityRank ?? 3,
			fitScore: original.fitScore,
			winProbability: original.winProbability,
			revenuePotential: original.revenuePotential,
			strategicNotes: original.strategicNotes,
			// Reset status to pending
			decisionStatus: "pending" as DecisionStatus,
			decisionReason: null,
			assignedTo: null,
			isReviewed: false,
			tags: original.tags,
			metadata: original.metadata,
			createdAt: now,
			updatedAt: now,
			importedAt: now,
		})
		.returning();

	// Get votes from original opportunity
	const originalVotes = await db
		.select()
		.from(opportunityVotes)
		.where(opportunityVotesByAssignedOpportunityCondition(id, userId));

	// We don't copy votes - this is a new opportunity

	return mapToOpportunityListItem(row);
}

// ============================================================================
// Additional Utility Functions
// ============================================================================

/**
 * Bulk update opportunity status.
 *
 * @param ids - Array of opportunity IDs
 * @param status - New decision status
 * @param reason - Optional reason for the status change
 * @returns Number of opportunities updated
 */
export async function bulkUpdateStatus(
	ids: string[],
	status: DecisionStatus,
	reason?: string
): Promise<number> {
	await requireCurrentUserId();

	const result = await db
		.update(opportunities)
		.set({
			decisionStatus: status,
			decisionReason: reason,
			updatedAt: new Date(),
		})
		.where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

/**
 * Bulk delete opportunities.
 *
 * @param ids - Array of opportunity IDs
 * @returns Number of opportunities deleted
 */
export async function bulkDeleteOpportunities(ids: string[]): Promise<number> {
	await requireCurrentUserId();

	// Delete votes first
	await db.delete(opportunityVotes).where(inArray(opportunityVotes.opportunityId, ids));

	// Delete opportunities
	const result = await db.delete(opportunities).where(inArray(opportunities.id, ids));

	return result.rowCount ?? 0;
}

/**
 * Update opportunity expiration status based on current date.
 * Useful for running as a periodic job.
 *
 * @returns Number of opportunities updated
 */
export async function refreshExpirationStatus(): Promise<number> {
	await requireCurrentUserId();

	const now = new Date();

	const result = await db.execute(sql`
		UPDATE opportunities
		SET
			days_left = CASE
				WHEN deadline IS NOT NULL THEN
					CEIL(EXTRACT(EPOCH FROM (deadline - NOW())) / 86400)
				ELSE NULL
			END,
			is_expired = CASE
				WHEN deadline IS NOT NULL AND deadline < NOW() THEN TRUE
				ELSE FALSE
			END,
			updated_at = NOW()
		WHERE deadline IS NOT NULL
	`);

	return (result as { rowCount?: number }).rowCount ?? 0;
}

// ============================================================================
// Calendar Deadline Data
// ============================================================================

/**
 * Calendar deadline event type
 */
export interface CalendarDeadline {
	id: string;
	title: string;
	type: "submission" | "review" | "meeting";
	date: string; // ISO date string
	priority: "high" | "medium" | "low";
	opportunityId?: string;
	daysLeft?: number;
}

/**
 * Get upcoming deadlines for the calendar view.
 * Returns opportunities with deadlines in the specified date range,
 * plus task deadlines (reviews) from the tasks table.
 *
 * @param daysAhead - Number of days ahead to look for deadlines (default 30)
 * @returns Array of calendar deadlines
 */
export async function getUpcomingDeadlines(daysAhead: number = 30): Promise<CalendarDeadline[]> {
	await requireCurrentUserId();

	const now = new Date();
	const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

	// Fetch opportunities with deadlines in range
	const rows = await db
		.select({
			id: opportunities.id,
			title: opportunities.title,
			deadline: opportunities.deadline,
			daysLeft: opportunities.daysLeft,
			priority: opportunities.priorityRank,
			status: opportunities.decisionStatus,
		})
		.from(opportunities)
		.where(
			and(
				gte(opportunities.deadline, now),
				lte(opportunities.deadline, futureDate),
				eq(opportunities.isExpired, false)
			)
		)
		.orderBy(asc(opportunities.deadline));

	// Map to calendar deadlines
	const deadlines: CalendarDeadline[] = rows.map((row) => {
		// Determine priority based on days left and rank (priorityRank: 1-5, 5 = highest)
		let priority: "high" | "medium" | "low" = "medium";
		if (row.daysLeft !== null && row.daysLeft <= 3) {
			priority = "high";
		} else if (row.daysLeft !== null && row.daysLeft <= 7) {
			priority = "medium";
		} else if (row.priority !== null && row.priority >= 4) {
			// priorityRank 4-5 = high priority
			priority = "high";
		} else if (row.priority !== null && row.priority === 3) {
			// priorityRank 3 = medium priority
			priority = "medium";
		} else {
			priority = "low";
		}

		// Determine type based on status
		let type: "submission" | "review" | "meeting" = "submission";
		if (row.status === "in_review") {
			type = "review";
		}

		return {
			id: `opp-${row.id}`,
			title: row.title,
			type,
			date: row.deadline?.toISOString() || "",
			priority,
			opportunityId: row.id,
			daysLeft: row.daysLeft ?? undefined,
		};
	});

	return deadlines;
}
