"use server";

/**
 * CRM Deal Server Actions
 *
 * CRUD operations for managing deals (sales pipeline).
 * Includes pipeline management, forecasting, and win/loss analysis.
 */

import { db } from "@/lib/db";
import {
	deals,
	dealStageHistory,
	accounts,
	contacts,
	activities,
	crmDocuments,
} from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, ilike, inArray, desc, asc, sql, count, sum, type SQL } from "drizzle-orm";
import type {
	DealFilters,
	Pagination,
	PaginatedResponse,
	CreateDealInput,
	UpdateDealInput,
	DealStage,
	DealStatus,
	DealPipelineValue,
	DealForecast,
	WinLossAnalysis,
	DealWithRelations,
	DEAL_STAGES,
} from "@/lib/types/crm";
import type { DealRow, NewDeal } from "@/lib/db/schema-crm";

// Default stage probabilities
const STAGE_PROBABILITIES: Record<DealStage, number> = {
	qualification: 10,
	discovery: 25,
	proposal: 50,
	negotiation: 75,
	closed_won: 100,
	closed_lost: 0,
};

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new deal.
 */
export async function createDeal(
	input: CreateDealInput,
	userId?: string
): Promise<DealRow> {
	const now = new Date();
	const stage = input.stage ?? "qualification";
	const stageProbability = input.stageProbability ?? STAGE_PROBABILITIES[stage];

	const newDeal: NewDeal = {
		accountId: input.accountId,
		primaryContactId: input.primaryContactId,
		opportunityId: input.opportunityId,
		name: input.name,
		description: input.description,
		value: input.value,
		currency: input.currency ?? "USD",
		recurringValue: input.recurringValue,
		recurringPeriod: input.recurringPeriod,
		pipelineId: input.pipelineId ?? "default",
		stage,
		stageProbability,
		expectedCloseDate: input.expectedCloseDate,
		status: "open",
		ownerId: input.ownerId,
		ownerName: input.ownerName,
		tags: input.tags ?? [],
		customFields: input.customFields,
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(deals).values(newDeal).returning();

	// Record initial stage in history
	await db.insert(dealStageHistory).values({
		dealId: created.id,
		previousStage: null,
		newStage: stage,
		valueAtChange: input.value,
		changedBy: userId,
		reason: "Deal created",
	});

	return created;
}

/**
 * Update an existing deal.
 */
export async function updateDeal(
	id: string,
	input: UpdateDealInput,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const [updated] = await db
		.update(deals)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(deals.id, id))
		.returning();

	return updated;
}

/**
 * Delete a deal.
 */
export async function deleteDeal(id: string): Promise<boolean> {
	const result = await db.delete(deals).where(eq(deals.id, id));
	return (result.rowCount ?? 0) > 0;
}

/**
 * Get a single deal by ID.
 */
export async function getDeal(id: string): Promise<DealRow | null> {
	const deal = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});
	return deal ?? null;
}

/**
 * Get deal with related entities.
 */
export async function getDealWithRelations(
	id: string
): Promise<DealWithRelations | null> {
	const deal = await db.query.deals.findFirst({
		where: eq(deals.id, id),
		with: {
			account: true,
			primaryContact: true,
			documents: {
				limit: 20,
				orderBy: desc(crmDocuments.createdAt),
			},
			stageHistory: {
				limit: 20,
				orderBy: desc(dealStageHistory.createdAt),
			},
		},
	});

	if (!deal) return null;

	// Get activities separately
	const dealActivities = await db.query.activities.findMany({
		where: eq(activities.dealId, id),
		limit: 20,
		orderBy: desc(activities.createdAt),
	});

	return {
		...deal,
		activities: dealActivities,
	};
}

/**
 * Get deals with filters and pagination.
 */
export async function getDeals(
	filters?: DealFilters,
	pagination?: Pagination
): Promise<PaginatedResponse<DealRow>> {
	const conditions = buildDealFilterConditions(filters);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(deals)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(deals)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(deals.expectedCloseDate))
		.limit(pageSize)
		.offset(offset);

	const totalPages = Math.ceil(total / pageSize);

	return {
		data: results,
		total,
		page,
		pageSize,
		totalPages,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	};
}

/**
 * Get all deals for a specific account.
 */
export async function getAccountDeals(accountId: string): Promise<DealRow[]> {
	return db.query.deals.findMany({
		where: eq(deals.accountId, accountId),
		orderBy: [desc(deals.status), desc(deals.expectedCloseDate)],
	});
}

// ============================================================================
// PIPELINE MANAGEMENT
// ============================================================================

/**
 * Update deal stage with history tracking.
 */
export async function updateDealStage(
	id: string,
	newStage: DealStage,
	reason?: string,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const previousStage = existing.stage;
	const now = new Date();

	// Calculate new status based on stage
	let newStatus: DealStatus = "open";
	if (newStage === "closed_won") {
		newStatus = "won";
	} else if (newStage === "closed_lost") {
		newStatus = "lost";
	}

	// Update the deal
	const [updated] = await db
		.update(deals)
		.set({
			stage: newStage,
			stageProbability: STAGE_PROBABILITIES[newStage],
			status: newStatus,
			actualCloseDate: ["closed_won", "closed_lost"].includes(newStage) ? now : null,
			updatedAt: now,
		})
		.where(eq(deals.id, id))
		.returning();

	// Record stage change in history
	await db.insert(dealStageHistory).values({
		dealId: id,
		previousStage,
		newStage,
		valueAtChange: existing.value,
		changedBy: userId,
		reason,
	});

	return updated;
}

/**
 * Mark deal as won.
 */
export async function markDealWon(
	id: string,
	reason?: string,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();

	const [updated] = await db
		.update(deals)
		.set({
			stage: "closed_won",
			status: "won",
			stageProbability: 100,
			actualCloseDate: now,
			winReason: reason,
			updatedAt: now,
		})
		.where(eq(deals.id, id))
		.returning();

	// Record in history
	await db.insert(dealStageHistory).values({
		dealId: id,
		previousStage: existing.stage,
		newStage: "closed_won",
		valueAtChange: existing.value,
		changedBy: userId,
		reason: reason ?? "Deal won",
	});

	// Update account to customer if not already
	if (existing.accountId) {
		const account = await db.query.accounts.findFirst({
			where: eq(accounts.id, existing.accountId),
			columns: { type: true },
		});

		if (account && account.type !== "customer") {
			await db
				.update(accounts)
				.set({
					type: "customer",
					stage: "onboarding",
					customerSince: now,
					updatedAt: now,
				})
				.where(eq(accounts.id, existing.accountId));
		}
	}

	return updated;
}

/**
 * Mark deal as lost.
 */
export async function markDealLost(
	id: string,
	reason: string,
	competitorId?: string,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();

	const [updated] = await db
		.update(deals)
		.set({
			stage: "closed_lost",
			status: "lost",
			stageProbability: 0,
			actualCloseDate: now,
			lossReason: reason,
			competitorLostTo: competitorId,
			updatedAt: now,
		})
		.where(eq(deals.id, id))
		.returning();

	// Record in history
	await db.insert(dealStageHistory).values({
		dealId: id,
		previousStage: existing.stage,
		newStage: "closed_lost",
		valueAtChange: existing.value,
		changedBy: userId,
		reason: `Lost: ${reason}`,
	});

	return updated;
}

/**
 * Put deal on hold.
 */
export async function putDealOnHold(
	id: string,
	reason?: string,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const [updated] = await db
		.update(deals)
		.set({
			status: "on_hold",
			updatedAt: new Date(),
		})
		.where(eq(deals.id, id))
		.returning();

	return updated;
}

/**
 * Reactivate a deal.
 */
export async function reactivateDeal(
	id: string,
	stage?: DealStage,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const newStage = stage ?? "qualification";

	const [updated] = await db
		.update(deals)
		.set({
			status: "open",
			stage: newStage,
			stageProbability: STAGE_PROBABILITIES[newStage],
			actualCloseDate: null,
			updatedAt: new Date(),
		})
		.where(eq(deals.id, id))
		.returning();

	// Record in history
	await db.insert(dealStageHistory).values({
		dealId: id,
		previousStage: existing.stage,
		newStage,
		valueAtChange: existing.value,
		changedBy: userId,
		reason: "Deal reactivated",
	});

	return updated;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get deal pipeline value metrics.
 */
export async function getDealPipelineValue(
	pipelineId = "default"
): Promise<DealPipelineValue> {
	const stages: DealStage[] = [
		"qualification",
		"discovery",
		"proposal",
		"negotiation",
		"closed_won",
		"closed_lost",
	];

	const stageData: DealPipelineValue["stages"] = [];
	let totalValue = 0;
	let totalWeightedValue = 0;
	let totalCount = 0;

	for (const stage of stages) {
		const [result] = await db
			.select({
				count: count(),
				totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
			})
			.from(deals)
			.where(
				and(
					eq(deals.pipelineId, pipelineId),
					eq(deals.stage, stage),
					eq(deals.status, "open")
				)
			);

		const stageCount = result.count;
		const stageTotalValue = Number(result.totalValue) || 0;
		const probability = STAGE_PROBABILITIES[stage];
		const weightedValue = stageTotalValue * (probability / 100);

		stageData.push({
			stage,
			count: stageCount,
			totalValue: stageTotalValue,
			weightedValue,
		});

		if (stage !== "closed_won" && stage !== "closed_lost") {
			totalValue += stageTotalValue;
			totalWeightedValue += weightedValue;
			totalCount += stageCount;
		}
	}

	const avgDealSize = totalCount > 0 ? totalValue / totalCount : 0;

	return {
		pipelineId,
		stages: stageData,
		totalValue,
		totalWeightedValue,
		avgDealSize,
	};
}

/**
 * Get deal forecast for upcoming months.
 */
export async function getDealForecast(months = 6): Promise<DealForecast[]> {
	const forecast: DealForecast[] = [];
	const now = new Date();

	for (let i = 0; i < months; i++) {
		const startDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
		const endDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

		const results = await db
			.select({
				count: count(),
				totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
				weightedValue: sql<number>`COALESCE(SUM(${deals.value} * ${deals.stageProbability} / 100), 0)`,
			})
			.from(deals)
			.where(
				and(
					eq(deals.status, "open"),
					gte(deals.expectedCloseDate, startDate),
					lte(deals.expectedCloseDate, endDate)
				)
			);

		const period = startDate.toLocaleString("default", { month: "short", year: "numeric" });

		forecast.push({
			period,
			expectedValue: Number(results[0].totalValue) || 0,
			weightedValue: Number(results[0].weightedValue) || 0,
			dealCount: results[0].count,
		});
	}

	return forecast;
}

/**
 * Get win/loss analysis.
 */
export async function getWinLossAnalysis(
	startDate?: Date,
	endDate?: Date
): Promise<WinLossAnalysis> {
	const conditions = [];

	if (startDate) {
		conditions.push(gte(deals.actualCloseDate, startDate));
	}
	if (endDate) {
		conditions.push(lte(deals.actualCloseDate, endDate));
	}

	// Get won deals
	const [wonResult] = await db
		.select({
			count: count(),
			totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
		})
		.from(deals)
		.where(and(eq(deals.status, "won"), ...(conditions.length > 0 ? conditions : [])));

	// Get lost deals
	const [lostResult] = await db
		.select({
			count: count(),
			totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
		})
		.from(deals)
		.where(and(eq(deals.status, "lost"), ...(conditions.length > 0 ? conditions : [])));

	const totalWon = wonResult.count;
	const totalLost = lostResult.count;
	const totalValueWon = Number(wonResult.totalValue) || 0;
	const totalValueLost = Number(lostResult.totalValue) || 0;

	const total = totalWon + totalLost;
	const winRate = total > 0 ? (totalWon / total) * 100 : 0;

	const avgDealSizeWon = totalWon > 0 ? totalValueWon / totalWon : 0;
	const avgDealSizeLost = totalLost > 0 ? totalValueLost / totalLost : 0;

	// Get loss reasons breakdown
	const lossReasonResults = await db
		.select({
			reason: deals.lossReason,
			count: count(),
		})
		.from(deals)
		.where(
			and(
				eq(deals.status, "lost"),
				sql`${deals.lossReason} IS NOT NULL`,
				...(conditions.length > 0 ? conditions : [])
			)
		)
		.groupBy(deals.lossReason)
		.orderBy(desc(sql`count`));

	const lossReasons = lossReasonResults.map((r) => ({
		reason: r.reason ?? "Unknown",
		count: r.count,
		percentage: totalLost > 0 ? (r.count / totalLost) * 100 : 0,
	}));

	// Get top competitors
	const competitorResults = await db
		.select({
			name: deals.competitorLostTo,
			lossCount: count(),
		})
		.from(deals)
		.where(
			and(
				eq(deals.status, "lost"),
				sql`${deals.competitorLostTo} IS NOT NULL`,
				...(conditions.length > 0 ? conditions : [])
			)
		)
		.groupBy(deals.competitorLostTo)
		.orderBy(desc(sql`count`))
		.limit(10);

	const topCompetitors = competitorResults.map((r) => ({
		name: r.name ?? "Unknown",
		lossCount: r.lossCount,
	}));

	return {
		totalWon,
		totalLost,
		winRate,
		totalValueWon,
		totalValueLost,
		avgDealSizeWon,
		avgDealSizeLost,
		lossReasons,
		topCompetitors,
	};
}

/**
 * Get deals closing soon.
 */
export async function getDealsClosingSoon(
	days = 30,
	userId?: string
): Promise<DealRow[]> {
	const now = new Date();
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + days);

	const conditions = [
		eq(deals.status, "open"),
		gte(deals.expectedCloseDate, now),
		lte(deals.expectedCloseDate, futureDate),
	];

	if (userId) {
		conditions.push(eq(deals.ownerId, userId));
	}

	return db.query.deals.findMany({
		where: and(...conditions),
		orderBy: asc(deals.expectedCloseDate),
		limit: 50,
	});
}

/**
 * Get overdue deals (past expected close date).
 */
export async function getOverdueDeals(userId?: string): Promise<DealRow[]> {
	const now = new Date();

	const conditions = [
		eq(deals.status, "open"),
		lte(deals.expectedCloseDate, now),
	];

	if (userId) {
		conditions.push(eq(deals.ownerId, userId));
	}

	return db.query.deals.findMany({
		where: and(...conditions),
		orderBy: asc(deals.expectedCloseDate),
		limit: 50,
	});
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build filter conditions for deal queries.
 */
function buildDealFilterConditions(filters?: DealFilters) {
	const conditions: SQL<unknown>[] = [];

	if (!filters) return conditions;

	// Account filter
	if (filters.accountId) {
		conditions.push(eq(deals.accountId, filters.accountId));
	}

	// Opportunity filter
	if (filters.opportunityId) {
		conditions.push(eq(deals.opportunityId, filters.opportunityId));
	}

	// Pipeline filter
	if (filters.pipelineId) {
		conditions.push(eq(deals.pipelineId, filters.pipelineId));
	}

	// Stage filter
	if (filters.stage) {
		if (Array.isArray(filters.stage)) {
			conditions.push(inArray(deals.stage, filters.stage));
		} else {
			conditions.push(eq(deals.stage, filters.stage));
		}
	}

	// Status filter
	if (filters.status) {
		if (Array.isArray(filters.status)) {
			conditions.push(inArray(deals.status, filters.status));
		} else {
			conditions.push(eq(deals.status, filters.status));
		}
	}

	// Owner filter
	if (filters.ownerId) {
		conditions.push(eq(deals.ownerId, filters.ownerId));
	}

	// Value range filters
	if (filters.valueMin !== undefined) {
		conditions.push(gte(deals.value, filters.valueMin));
	}
	if (filters.valueMax !== undefined) {
		conditions.push(lte(deals.value, filters.valueMax));
	}

	// Date filters
	if (filters.expectedCloseBefore) {
		conditions.push(lte(deals.expectedCloseDate, filters.expectedCloseBefore));
	}
	if (filters.expectedCloseAfter) {
		conditions.push(gte(deals.expectedCloseDate, filters.expectedCloseAfter));
	}

	// Search filter
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		const searchCondition = or(
			ilike(deals.name, searchTerm),
			ilike(deals.description, searchTerm)
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	return conditions;
}

/**
 * Search deals by name (for autocomplete).
 */
export async function searchDeals(
	query: string,
	accountId?: string,
	limit = 10
): Promise<Pick<DealRow, "id" | "name" | "value" | "stage" | "accountId">[]> {
	const conditions = [ilike(deals.name, `%${query}%`)];

	if (accountId) {
		conditions.push(eq(deals.accountId, accountId));
	}

	return db
		.select({
			id: deals.id,
			name: deals.name,
			value: deals.value,
			stage: deals.stage,
			accountId: deals.accountId,
		})
		.from(deals)
		.where(and(...conditions))
		.limit(limit)
		.orderBy(deals.name);
}

/**
 * Bulk update deal owner.
 */
export async function bulkUpdateDealOwner(
	dealIds: string[],
	ownerId: string,
	ownerName: string,
	userId?: string
): Promise<number> {
	const result = await db
		.update(deals)
		.set({
			ownerId,
			ownerName,
			updatedAt: new Date(),
		})
		.where(inArray(deals.id, dealIds));

	return result.rowCount ?? 0;
}

/**
 * Clone a deal.
 */
export async function cloneDeal(
	id: string,
	newName?: string,
	userId?: string
): Promise<DealRow | null> {
	const existing = await db.query.deals.findFirst({
		where: eq(deals.id, id),
	});

	if (!existing) {
		return null;
	}

	const now = new Date();

	const newDeal: NewDeal = {
		accountId: existing.accountId,
		primaryContactId: existing.primaryContactId,
		opportunityId: null, // Don't clone opportunity link
		name: newName ?? `${existing.name} (Copy)`,
		description: existing.description,
		value: existing.value,
		currency: existing.currency,
		recurringValue: existing.recurringValue,
		recurringPeriod: existing.recurringPeriod,
		pipelineId: existing.pipelineId,
		stage: "qualification",
		stageProbability: STAGE_PROBABILITIES.qualification,
		expectedCloseDate: null,
		status: "open",
		ownerId: existing.ownerId,
		ownerName: existing.ownerName,
		tags: existing.tags as string[],
		customFields: existing.customFields as Record<string, unknown>,
		createdBy: userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(deals).values(newDeal).returning();

	// Record initial stage in history
	await db.insert(dealStageHistory).values({
		dealId: created.id,
		previousStage: null,
		newStage: "qualification",
		valueAtChange: existing.value,
		changedBy: userId,
		reason: `Cloned from deal: ${existing.name}`,
	});

	return created;
}
