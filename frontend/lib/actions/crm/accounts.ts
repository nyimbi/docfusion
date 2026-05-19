"use server";

/**
 * CRM Account Server Actions
 *
 * CRUD operations and business logic for managing accounts (partners, prospects,
 * leads, customers, vendors). Includes pipeline management, type conversion,
 * and analytics.
 */

import { db } from "@/lib/db";
import {
	accounts,
	accountStageHistory,
	contacts,
	activities,
	deals,
	crmDocuments,
} from "@/lib/db/schema-crm";
import { eq, and, or, gte, lte, like, ilike, inArray, desc, asc, sql, count, type SQL } from "drizzle-orm";
import type {
	AccountType,
	AccountStatus,
	AccountFilters,
	AccountSortField,
	SortConfig,
	Pagination,
	PaginatedResponse,
	CreateAccountInput,
	UpdateAccountInput,
	AccountStats,
	PipelineMetrics,
	AccountWithRelations,
	ACCOUNT_STAGES,
} from "@/lib/types/crm";
import type { AccountRow, NewAccount } from "@/lib/db/schema-crm";
import { getServerSession } from "@/lib/auth-utils";

async function requireCrmActor(): Promise<{ userId: string; userName: string | null }> {
	const session = await getServerSession();
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return {
		userId: session.user.id,
		userName: session.user.name ?? session.user.email ?? null,
	};
}

function assertCrmActorUser(actor: { userId: string }, userId?: string): void {
	if (userId && userId !== actor.userId) {
		throw new Error("Unauthorized");
	}
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new account.
 */
export async function createAccount(
	input: CreateAccountInput,
	_userId?: string
): Promise<AccountRow> {
	const actor = await requireCrmActor();
	const now = new Date();

	// Set default stage based on type if not provided
	const defaultStage = getDefaultStageForType(input.type);

	const newAccount: NewAccount = {
		name: input.name,
		type: input.type,
		industry: input.industry,
		sector: input.sector,
		subSector: input.subSector,
		companySize: input.companySize,
		country: input.country,
		region: input.region,
		city: input.city,
		address: input.address,
		timezone: input.timezone,
		primaryLanguage: input.primaryLanguage ?? "en",
		additionalLanguages: input.additionalLanguages ?? [],
		preferredContactMethod: input.preferredContactMethod,
		description: input.description,
		website: input.website,
		linkedinUrl: input.linkedinUrl,
		foundedYear: input.foundedYear,
		employeeCount: input.employeeCount,
		annualRevenue: input.annualRevenue,
		fiscalYearEnd: input.fiscalYearEnd,
		partnerTier: input.partnerTier,
		coreCapabilities: input.coreCapabilities,
		capabilities: input.capabilities ?? [],
		corporateStatus: input.corporateStatus,
		stage: input.stage ?? defaultStage,
		status: input.status ?? "active",
		ownerId: actor.userId,
		ownerName: actor.userName ?? input.ownerName,
		teamId: input.teamId,
		leadScore: input.leadScore,
		leadSource: input.leadSource,
		leadSourceDetail: input.leadSourceDetail,
		qualificationStatus: input.qualificationStatus,
		tags: input.tags ?? [],
		customFields: input.customFields,
		source: input.source ?? "manual",
		sourceFile: input.sourceFile,
		createdBy: actor.userId,
		updatedBy: actor.userId,
		createdAt: now,
		updatedAt: now,
	};

	const [created] = await db.insert(accounts).values(newAccount).returning();

	// Record initial stage in history
	await db.insert(accountStageHistory).values({
		accountId: created.id,
		previousStage: null,
		newStage: created.stage ?? defaultStage,
		newType: created.type,
		changedBy: actor.userId,
		reason: "Account created",
	});

	return created;
}

/**
 * Update an existing account.
 */
export async function updateAccount(
	id: string,
	input: UpdateAccountInput,
	_userId?: string
): Promise<AccountRow | null> {
	const actor = await requireCrmActor();
	const existing = await db.query.accounts.findFirst({
		where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
	});

	if (!existing) {
		return null;
	}

	const { ownerId: _ownerId, ownerName: _ownerName, ...safeInput } = input;
	const [updated] = await db
		.update(accounts)
		.set({
			...safeInput,
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.returning();

	return updated;
}

/**
 * Delete an account (soft delete by setting status to archived).
 */
export async function deleteAccount(
	id: string,
	_userId?: string,
	hard = false
): Promise<boolean> {
	const actor = await requireCrmActor();
	if (hard) {
		const result = await db
			.delete(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)));
		return (result.rowCount ?? 0) > 0;
	}

	const [updated] = await db
		.update(accounts)
		.set({
			status: "archived",
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.returning();

	return !!updated;
}

/**
 * Get a single account by ID.
 */
export async function getAccount(id: string): Promise<AccountRow | null> {
	const actor = await requireCrmActor();
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
	});
	return account ?? null;
}

/**
 * Get account with all related entities.
 * Uses separate queries to avoid PostgreSQL's 100-argument limit.
 */
export async function getAccountWithRelations(
	id: string
): Promise<AccountWithRelations | null> {
	const actor = await requireCrmActor();
	// Fetch account first
	const [account] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.limit(1);

	if (!account) return null;

	// Fetch related entities separately with essential columns only
	const [accountContacts, accountDeals, accountDocuments, stageHistory, recentActivities] =
		await Promise.all([
			db
				.select({
					id: contacts.id,
					firstName: contacts.firstName,
					lastName: contacts.lastName,
					fullName: contacts.fullName,
					email: contacts.email,
					phone: contacts.phone,
					title: contacts.title,
					isPrimaryContact: contacts.isPrimaryContact,
					accountId: contacts.accountId,
				})
				.from(contacts)
				.where(eq(contacts.accountId, id))
				.orderBy(desc(contacts.isPrimaryContact), asc(contacts.lastName))
				.limit(100),

			db
				.select({
					id: deals.id,
					name: deals.name,
					value: deals.value,
					currency: deals.currency,
					stage: deals.stage,
					status: deals.status,
					stageProbability: deals.stageProbability,
					expectedCloseDate: deals.expectedCloseDate,
					createdAt: deals.createdAt,
				})
				.from(deals)
				.where(eq(deals.accountId, id))
				.orderBy(desc(deals.createdAt))
				.limit(50),

			db
				.select({
					id: crmDocuments.id,
					name: crmDocuments.name,
					type: crmDocuments.type,
					createdAt: crmDocuments.createdAt,
				})
				.from(crmDocuments)
				.where(eq(crmDocuments.accountId, id))
				.orderBy(desc(crmDocuments.createdAt))
				.limit(50),

			db
				.select()
				.from(accountStageHistory)
				.where(eq(accountStageHistory.accountId, id))
				.orderBy(desc(accountStageHistory.createdAt))
				.limit(20),

			db
				.select({
					id: activities.id,
					type: activities.type,
					subject: activities.subject,
					description: activities.description,
					status: activities.status,
					scheduledAt: activities.scheduledAt,
					completedAt: activities.completedAt,
					createdAt: activities.createdAt,
					createdBy: activities.createdBy,
				})
				.from(activities)
				.where(eq(activities.accountId, id))
				.orderBy(desc(activities.createdAt))
				.limit(20),
		]);

	return {
		...account,
		contacts: accountContacts,
		deals: accountDeals,
		documents: accountDocuments,
		stageHistory,
		recentActivities,
	} as AccountWithRelations;
}

/**
 * Get accounts with filters, sorting, and pagination.
 */
export async function getAccounts(
	filters?: AccountFilters,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	const actor = await requireCrmActor();
	assertCrmActorUser(actor, filters?.ownerId);
	const conditions = buildAccountFilterConditions(filters);
	conditions.push(eq(accounts.ownerId, actor.userId));

	// Build order by clause
	const sortColumn = sort
		? accounts[sort.field as keyof typeof accounts] as unknown as Parameters<typeof asc>[0]
		: null;
	const orderByClause = sortColumn
		? sort!.direction === "asc"
			? asc(sortColumn)
			: desc(sortColumn)
		: desc(accounts.updatedAt);

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(accounts)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	// Get paginated results
	const page = pagination?.page ?? 1;
	const pageSize = pagination?.pageSize ?? 25;
	const offset = (page - 1) * pageSize;

	const results = await db
		.select()
		.from(accounts)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(orderByClause)
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

// ============================================================================
// TYPE-SPECIFIC QUERIES
// ============================================================================

/**
 * Get all partners.
 */
export async function getPartners(
	filters?: Omit<AccountFilters, "type">,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	return getAccounts({ ...filters, type: "partner" }, sort, pagination);
}

/**
 * Get all prospects.
 */
export async function getProspects(
	filters?: Omit<AccountFilters, "type">,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	return getAccounts({ ...filters, type: "prospect" }, sort, pagination);
}

/**
 * Get all leads.
 */
export async function getLeads(
	filters?: Omit<AccountFilters, "type">,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	return getAccounts({ ...filters, type: "lead" }, sort, pagination);
}

/**
 * Get all customers.
 */
export async function getCustomers(
	filters?: Omit<AccountFilters, "type">,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	return getAccounts({ ...filters, type: "customer" }, sort, pagination);
}

/**
 * Get all vendors.
 */
export async function getVendors(
	filters?: Omit<AccountFilters, "type">,
	sort?: SortConfig<AccountSortField>,
	pagination?: Pagination
): Promise<PaginatedResponse<AccountRow>> {
	return getAccounts({ ...filters, type: "vendor" }, sort, pagination);
}

// ============================================================================
// PIPELINE MANAGEMENT
// ============================================================================

/**
 * Update account stage with history tracking.
 */
export async function updateAccountStage(
	id: string,
	newStage: string,
	reason?: string,
	_userId?: string
): Promise<AccountRow | null> {
	const actor = await requireCrmActor();
	const existing = await db.query.accounts.findFirst({
		where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
	});

	if (!existing) {
		return null;
	}

	const previousStage = existing.stage;

	// Update the account
	const [updated] = await db
		.update(accounts)
		.set({
			stage: newStage,
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.returning();

	// Record stage change in history
	await db.insert(accountStageHistory).values({
		accountId: id,
		previousStage,
		newStage,
		changedBy: actor.userId,
		reason,
	});

	return updated;
}

/**
 * Convert a lead to a customer.
 */
export async function convertLeadToCustomer(
	id: string,
	reason?: string,
	_userId?: string
): Promise<AccountRow | null> {
	const actor = await requireCrmActor();
	const existing = await db.query.accounts.findFirst({
		where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
	});

	if (!existing || !["lead", "prospect"].includes(existing.type)) {
		return null;
	}

	const [updated] = await db
		.update(accounts)
		.set({
			type: "customer",
			stage: "onboarding",
			customerSince: new Date(),
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.returning();

	// Record type and stage change in history
	await db.insert(accountStageHistory).values({
		accountId: id,
		previousStage: existing.stage,
		newStage: "onboarding",
		previousType: existing.type,
		newType: "customer",
		changedBy: actor.userId,
		reason: reason ?? "Converted to customer",
	});

	return updated;
}

/**
 * Convert a prospect to a lead.
 */
export async function convertProspectToLead(
	id: string,
	reason?: string,
	_userId?: string
): Promise<AccountRow | null> {
	const actor = await requireCrmActor();
	const existing = await db.query.accounts.findFirst({
		where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
	});

	if (!existing || existing.type !== "prospect") {
		return null;
	}

	const [updated] = await db
		.update(accounts)
		.set({
			type: "lead",
			stage: "qualified",
			qualificationStatus: "sql",
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)))
		.returning();

	// Record type and stage change in history
	await db.insert(accountStageHistory).values({
		accountId: id,
		previousStage: existing.stage,
		newStage: "qualified",
		previousType: "prospect",
		newType: "lead",
		changedBy: actor.userId,
		reason: reason ?? "Qualified as lead",
	});

	return updated;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get account statistics by type.
 */
export async function getAccountStats(
	type?: AccountType
): Promise<AccountStats[]> {
	const actor = await requireCrmActor();
	const types: AccountType[] = type
		? [type]
		: ["partner", "prospect", "lead", "customer", "vendor", "other"];

	const stats: AccountStats[] = [];

	for (const accountType of types) {
		// Get total count
		const [{ total }] = await db
			.select({ total: count() })
			.from(accounts)
			.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)));

		// Get counts by status
		const statusCounts = await db
			.select({
				status: accounts.status,
				count: count(),
			})
			.from(accounts)
			.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)))
			.groupBy(accounts.status);

		const byStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			if (row.status) byStatus[row.status] = row.count;
		}

		// Get counts by stage
		const stageCounts = await db
			.select({
				stage: accounts.stage,
				count: count(),
			})
			.from(accounts)
			.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)))
			.groupBy(accounts.stage);

		const byStage: Record<string, number> = {};
		for (const row of stageCounts) {
			if (row.stage) byStage[row.stage] = row.count;
		}

		// Get counts by region
		const regionCounts = await db
			.select({
				region: accounts.region,
				count: count(),
			})
			.from(accounts)
			.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId), sql`${accounts.region} IS NOT NULL`))
			.groupBy(accounts.region);

		const byRegion: Record<string, number> = {};
		for (const row of regionCounts) {
			if (row.region) byRegion[row.region] = row.count;
		}

		// Get average scores based on type
		let avgLeadScore: number | undefined;
		let avgHealthScore: number | undefined;
		let avgFitScore: number | undefined;

		if (["prospect", "lead"].includes(accountType)) {
			const [scores] = await db
				.select({
					avgLeadScore: sql<number>`AVG(${accounts.leadScore})`,
				})
				.from(accounts)
				.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)));
			avgLeadScore = scores.avgLeadScore;
		}

		if (accountType === "customer") {
			const [scores] = await db
				.select({
					avgHealthScore: sql<number>`AVG(${accounts.customerHealthScore})`,
				})
				.from(accounts)
				.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)));
			avgHealthScore = scores.avgHealthScore;
		}

		if (accountType === "partner") {
			const [scores] = await db
				.select({
					avgFitScore: sql<number>`AVG(${accounts.partnershipFitScore})`,
				})
				.from(accounts)
				.where(and(eq(accounts.type, accountType), eq(accounts.ownerId, actor.userId)));
			avgFitScore = scores.avgFitScore;
		}

		stats.push({
			type: accountType,
			total,
			byStatus,
			byStage,
			byRegion,
			avgLeadScore,
			avgHealthScore,
			avgFitScore,
		});
	}

	return stats;
}

/**
 * Get accounts grouped by region.
 */
export async function getAccountsByRegion(
	type?: AccountType
): Promise<{ region: string; count: number; types: Record<string, number> }[]> {
	const actor = await requireCrmActor();
	const whereClause = type
		? and(eq(accounts.type, type), eq(accounts.ownerId, actor.userId))
		: eq(accounts.ownerId, actor.userId);

	const results = await db
		.select({
			region: accounts.region,
			type: accounts.type,
			count: count(),
		})
		.from(accounts)
		.where(whereClause)
		.groupBy(accounts.region, accounts.type)
		.orderBy(accounts.region);

	// Group by region
	const regionMap = new Map<string, { count: number; types: Record<string, number> }>();

	for (const row of results) {
		const region = row.region ?? "Unknown";
		if (!regionMap.has(region)) {
			regionMap.set(region, { count: 0, types: {} });
		}
		const entry = regionMap.get(region)!;
		entry.count += row.count;
		entry.types[row.type] = (entry.types[row.type] ?? 0) + row.count;
	}

	return Array.from(regionMap.entries()).map(([region, data]) => ({
		region,
		...data,
	}));
}

/**
 * Get pipeline metrics for a specific account type.
 */
export async function getPipelineMetrics(
	type: AccountType
): Promise<PipelineMetrics> {
	const actor = await requireCrmActor();
	// Get counts by stage
	const stageCounts = await db
		.select({
			stage: accounts.stage,
			count: count(),
		})
		.from(accounts)
		.where(and(eq(accounts.type, type), eq(accounts.ownerId, actor.userId)))
		.groupBy(accounts.stage);

	const total = stageCounts.reduce((sum, row) => sum + row.count, 0);

	const stages = stageCounts.map((row) => ({
		stage: row.stage ?? "unknown",
		count: row.count,
		percentage: total > 0 ? (row.count / total) * 100 : 0,
	}));

	// Calculate conversion rates from stage history
	// This is a simplified version - in production you'd want more sophisticated analysis
	const conversionRates: { fromStage: string; toStage: string; rate: number }[] = [];

	// Calculate average time in stage from history
	const avgTimeInStage: Record<string, number> = {};

	return {
		type,
		stages,
		conversionRates,
		avgTimeInStage,
	};
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get default stage for account type.
 */
function getDefaultStageForType(type: AccountType): string {
	switch (type) {
		case "partner":
			return "identified";
		case "prospect":
		case "lead":
			return "new";
		case "customer":
			return "onboarding";
		case "vendor":
			return "new";
		default:
			return "new";
	}
}

/**
 * Build filter conditions for account queries.
 */
function buildAccountFilterConditions(filters?: AccountFilters) {
	const conditions: SQL<unknown>[] = [];

	if (!filters) return conditions;

	// Type filter
	if (filters.type) {
		if (Array.isArray(filters.type)) {
			conditions.push(inArray(accounts.type, filters.type));
		} else {
			conditions.push(eq(accounts.type, filters.type));
		}
	}

	// Status filter
	if (filters.status) {
		if (Array.isArray(filters.status)) {
			conditions.push(inArray(accounts.status, filters.status));
		} else {
			conditions.push(eq(accounts.status, filters.status));
		}
	}

	// Stage filter
	if (filters.stage) {
		if (Array.isArray(filters.stage)) {
			conditions.push(inArray(accounts.stage, filters.stage));
		} else {
			conditions.push(eq(accounts.stage, filters.stage));
		}
	}

	// Location filters
	if (filters.country) {
		if (Array.isArray(filters.country)) {
			conditions.push(inArray(accounts.country, filters.country));
		} else {
			conditions.push(eq(accounts.country, filters.country));
		}
	}

	if (filters.region) {
		if (Array.isArray(filters.region)) {
			conditions.push(inArray(accounts.region, filters.region));
		} else {
			conditions.push(eq(accounts.region, filters.region));
		}
	}

	// Industry filter
	if (filters.industry) {
		if (Array.isArray(filters.industry)) {
			conditions.push(inArray(accounts.industry, filters.industry));
		} else {
			conditions.push(eq(accounts.industry, filters.industry));
		}
	}

	// Owner filter
	if (filters.ownerId) {
		conditions.push(eq(accounts.ownerId, filters.ownerId));
	}

	if (filters.teamId) {
		conditions.push(eq(accounts.teamId, filters.teamId));
	}

	// Partner tier filter
	if (filters.partnerTier) {
		if (Array.isArray(filters.partnerTier)) {
			conditions.push(inArray(accounts.partnerTier, filters.partnerTier));
		} else {
			conditions.push(eq(accounts.partnerTier, filters.partnerTier));
		}
	}

	// Score range filters
	if (filters.leadScoreMin !== undefined) {
		conditions.push(gte(accounts.leadScore, filters.leadScoreMin));
	}
	if (filters.leadScoreMax !== undefined) {
		conditions.push(lte(accounts.leadScore, filters.leadScoreMax));
	}

	if (filters.healthScoreMin !== undefined) {
		conditions.push(gte(accounts.customerHealthScore, filters.healthScoreMin));
	}
	if (filters.healthScoreMax !== undefined) {
		conditions.push(lte(accounts.customerHealthScore, filters.healthScoreMax));
	}

	if (filters.fitScoreMin !== undefined) {
		conditions.push(gte(accounts.partnershipFitScore, filters.fitScoreMin));
	}
	if (filters.fitScoreMax !== undefined) {
		conditions.push(lte(accounts.partnershipFitScore, filters.fitScoreMax));
	}

	// Date filters
	if (filters.lastContactBefore) {
		conditions.push(lte(accounts.lastContactDate, filters.lastContactBefore));
	}
	if (filters.lastContactAfter) {
		conditions.push(gte(accounts.lastContactDate, filters.lastContactAfter));
	}

	if (filters.createdBefore) {
		conditions.push(lte(accounts.createdAt, filters.createdBefore));
	}
	if (filters.createdAfter) {
		conditions.push(gte(accounts.createdAt, filters.createdAfter));
	}

	// Search filter (name, description, website)
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		const searchCondition = or(
			ilike(accounts.name, searchTerm),
			ilike(accounts.description, searchTerm),
			ilike(accounts.website, searchTerm)
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	return conditions;
}

/**
 * Search accounts by name (for autocomplete).
 */
export async function searchAccounts(
	query: string,
	type?: AccountType,
	limit = 10
): Promise<Pick<AccountRow, "id" | "name" | "type" | "country" | "industry">[]> {
	const actor = await requireCrmActor();
	const conditions = [
		ilike(accounts.name, `%${query}%`),
		eq(accounts.ownerId, actor.userId),
	];

	if (type) {
		conditions.push(eq(accounts.type, type));
	}

	return db
		.select({
			id: accounts.id,
			name: accounts.name,
			type: accounts.type,
			country: accounts.country,
			industry: accounts.industry,
		})
		.from(accounts)
		.where(and(...conditions))
		.limit(limit)
		.orderBy(accounts.name);
}

/**
 * Get accounts needing follow-up.
 */
export async function getAccountsNeedingFollowup(
	daysOverdue = 0,
	type?: AccountType,
	userId?: string
): Promise<AccountRow[]> {
	const actor = await requireCrmActor();
	assertCrmActorUser(actor, userId);
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

	const conditions = [
		lte(accounts.nextFollowUpDate, cutoffDate),
		eq(accounts.status, "active"),
		eq(accounts.ownerId, actor.userId),
	];

	if (type) {
		conditions.push(eq(accounts.type, type));
	}

	return db.query.accounts.findMany({
		where: and(...conditions),
		orderBy: asc(accounts.nextFollowUpDate),
		limit: 50,
	});
}

/**
 * Bulk update account owner.
 */
export async function bulkUpdateAccountOwner(
	accountIds: string[],
	ownerId: string,
	ownerName: string,
	_userId?: string
): Promise<number> {
	const actor = await requireCrmActor();
	const result = await db
		.update(accounts)
		.set({
			ownerId,
			ownerName,
			updatedAt: new Date(),
			updatedBy: actor.userId,
		})
		.where(and(inArray(accounts.id, accountIds), eq(accounts.ownerId, actor.userId)));

	return result.rowCount ?? 0;
}

/**
 * Bulk update account tags.
 */
export async function bulkAddAccountTags(
	accountIds: string[],
	tagsToAdd: string[],
	_userId?: string
): Promise<number> {
	const actor = await requireCrmActor();
	let count = 0;

	for (const id of accountIds) {
		const account = await db.query.accounts.findFirst({
			where: and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)),
			columns: { tags: true },
		});

		if (account) {
			const existingTags = (account.tags as string[]) ?? [];
			const newTags = [...new Set([...existingTags, ...tagsToAdd])];

			await db
				.update(accounts)
				.set({
					tags: newTags,
					updatedAt: new Date(),
					updatedBy: actor.userId,
				})
				.where(and(eq(accounts.id, id), eq(accounts.ownerId, actor.userId)));

			count++;
		}
	}

	return count;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * Dashboard statistics for the CRM overview.
 */
export interface CRMDashboardStats {
	totalAccounts: number;
	totalContacts: number;
	openDeals: number;
	pipelineValue: number;
	overdueTasks: number;
	dueToday: number;
	upcoming: number;
	completedTasks: number;
}

/**
 * Get aggregated statistics for the CRM dashboard.
 */
export async function getCRMDashboardStats(): Promise<CRMDashboardStats> {
	// Run all counts in parallel
	const [
		accountCount,
		contactCount,
		dealStats,
		taskStats,
	] = await Promise.all([
		// Total accounts
		db.select({ count: count() }).from(accounts),

		// Total contacts
		db.select({ count: count() }).from(contacts),

		// Open deals and pipeline value
		db
			.select({
				count: count(),
				totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
			})
			.from(deals)
			.where(inArray(deals.status, ["active", "negotiation", "pending"])),

		// Task stats
		db
			.select({
				status: activities.status,
				count: count(),
			})
			.from(activities)
			.where(eq(activities.type, "task"))
			.groupBy(activities.status),
	]);

	// Get today's date for due date comparisons
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const nextWeek = new Date(today);
	nextWeek.setDate(nextWeek.getDate() + 7);

	// Get task counts by due date
	const [overdueTasks, dueTodayTasks, upcomingTasks] = await Promise.all([
		// Overdue
		db
			.select({ count: count() })
			.from(activities)
			.where(
				and(
					eq(activities.type, "task"),
					eq(activities.status, "scheduled"),
					sql`${activities.scheduledAt} < ${today}`
				)
			),

		// Due today
		db
			.select({ count: count() })
			.from(activities)
			.where(
				and(
					eq(activities.type, "task"),
					eq(activities.status, "scheduled"),
					sql`${activities.scheduledAt} >= ${today}`,
					sql`${activities.scheduledAt} < ${tomorrow}`
				)
			),

		// Upcoming (next 7 days)
		db
			.select({ count: count() })
			.from(activities)
			.where(
				and(
					eq(activities.type, "task"),
					eq(activities.status, "scheduled"),
					sql`${activities.scheduledAt} >= ${tomorrow}`,
					sql`${activities.scheduledAt} < ${nextWeek}`
				)
			),
	]);

	// Count completed tasks
	const completedCount = taskStats.find((t) => t.status === "completed")?.count ?? 0;

	return {
		totalAccounts: accountCount[0]?.count ?? 0,
		totalContacts: contactCount[0]?.count ?? 0,
		openDeals: dealStats[0]?.count ?? 0,
		pipelineValue: dealStats[0]?.totalValue ?? 0,
		overdueTasks: overdueTasks[0]?.count ?? 0,
		dueToday: dueTodayTasks[0]?.count ?? 0,
		upcoming: upcomingTasks[0]?.count ?? 0,
		completedTasks: completedCount,
	};
}
