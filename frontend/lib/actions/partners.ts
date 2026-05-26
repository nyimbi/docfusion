/**
 * Partner Server Actions - DocFusion
 *
 * Server actions for managing partner organizations and assignments.
 */

"use server";

import { db } from "@/lib/db";
import { getCurrentUserId, requireUserContext } from "@/lib/auth-utils";
import {
	partners,
	opportunityPartners,
	opportunities,
	submissions,
	type PartnerRow,
	type OpportunityPartnerRow,
} from "@/lib/db/schema";
import { eq, desc, and, ilike, sql, or, inArray, type SQL } from "drizzle-orm";
import type {
	Partner,
	PartnerListItem,
	CreatePartnerInput,
	UpdatePartnerInput,
	OpportunityPartner,
	AssignPartnerInput,
	UpdatePartnerAssignmentInput,
	PartnerPerformance,
	PartnerFilters,
	PartnerType,
	PartnerStatus,
	PartnerCollaborationStatus,
} from "@/lib/types/opportunity";

// ============================================================================
// Row Transformers
// ============================================================================

function transformPartner(row: PartnerRow): Partner {
	return {
		id: row.id,
		name: row.name,
		type: row.type as PartnerType | null,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		capabilities: (row.capabilities || []) as string[],
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
		notes: row.notes,
		status: row.status as PartnerStatus,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function transformOpportunityPartner(
	row: OpportunityPartnerRow,
	partner?: PartnerRow
): OpportunityPartner {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		partnerId: row.partnerId,
		partner: partner ? transformPartner(partner) : undefined,
		role: row.role,
		workShare: row.workShare,
		assignedSections: (row.assignedSections || []) as string[],
		status: row.status as PartnerCollaborationStatus,
		ndaSigned: row.ndaSigned,
		teamingAgreementSigned: row.teamingAgreementSigned,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// ============================================================================
// Partner CRUD
// ============================================================================

type PartnerActionContext = { userId: string; organizationId: string };

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

async function requirePartnerContext(): Promise<PartnerActionContext> {
	const context = await requireUserContext();
	if (!context.organizationId) {
		throw new Error("Organization context required");
	}
	return {
		userId: context.userId,
		organizationId: context.organizationId,
	};
}

function assignedOpportunityCondition(context: PartnerActionContext): SQL {
	return sql`(
		opportunities.organization_id = ${context.organizationId}
		or opportunities.organization_id is null
	)
	and opportunities.assigned_to = ${context.userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, context: PartnerActionContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (
				opportunities.organization_id = ${context.organizationId}
				or opportunities.organization_id is null
			)
			and opportunities.assigned_to = ${context.userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, context: PartnerActionContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(context)
	)!;
}

function visiblePartnerAssignmentsCondition(context: PartnerActionContext): SQL {
	return assignedOpportunityExistsSql(opportunityPartners.opportunityId, context);
}

function visiblePartnerAssignmentCondition(assignmentId: string, context: PartnerActionContext): SQL {
	return and(
		eq(opportunityPartners.id, assignmentId),
		visiblePartnerAssignmentsCondition(context)
	)!;
}

function visibleOpportunityPartnersCondition(opportunityId: string, context: PartnerActionContext): SQL {
	return and(
		eq(opportunityPartners.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, context)
	)!;
}

function normalizePartnerLimit(limit: number | undefined, fallback = 10, maximum = 1000): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return fallback;
	}
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

async function assertVisibleOpportunity(opportunityId: string, context: PartnerActionContext): Promise<void> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, context))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}
}

/**
 * Create a new partner.
 */
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
	await requireCurrentUserId();

	const [row] = await db
		.insert(partners)
		.values({
			name: input.name,
			type: input.type,
			contactName: input.contactName,
			contactEmail: input.contactEmail,
			contactPhone: input.contactPhone,
			capabilities: input.capabilities || [],
			notes: input.notes,
			status: "active",
		})
		.returning();

	return transformPartner(row);
}

/**
 * Get a partner by ID.
 */
export async function getPartner(id: string): Promise<Partner | null> {
	await requireCurrentUserId();

	const [row] = await db.select().from(partners).where(eq(partners.id, id));
	return row ? transformPartner(row) : null;
}

/**
 * Update a partner.
 */
export async function updatePartner(
	id: string,
	input: UpdatePartnerInput
): Promise<Partner> {
	await requireCurrentUserId();

	const [row] = await db
		.update(partners)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(eq(partners.id, id))
		.returning();

	if (!row) {
		throw new Error(`Partner ${id} not found`);
	}

	return transformPartner(row);
}

/**
 * Delete a partner.
 */
export async function deletePartner(id: string): Promise<void> {
	await requireCurrentUserId();

	await db.delete(partners).where(eq(partners.id, id));
}

/**
 * Get partners with optional filtering.
 */
export async function getPartners(filters?: PartnerFilters): Promise<PartnerListItem[]> {
	const context = await requirePartnerContext();

	// Build conditions
	const conditions = [];

	if (filters?.search) {
		conditions.push(
			or(
				ilike(partners.name, `%${filters.search}%`),
				ilike(partners.contactName, `%${filters.search}%`),
				ilike(partners.contactEmail, `%${filters.search}%`)
			)
		);
	}

	if (filters?.type) {
		conditions.push(eq(partners.type, filters.type));
	}

	if (filters?.status) {
		conditions.push(eq(partners.status, filters.status));
	}

	if (filters?.minRating) {
		conditions.push(sql`${partners.performanceRating} >= ${filters.minRating}`);
	}

	// Get partners
	const partnerRows = await db
		.select()
		.from(partners)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(partners.name);

	// Get active opportunity counts for each partner
	const activeOpportunityCounts = await db
		.select({
			partnerId: opportunityPartners.partnerId,
			count: sql<number>`count(*)::int`,
		})
		.from(opportunityPartners)
		.where(
			and(
				inArray(opportunityPartners.status, ["invited", "accepted", "active"]),
				visiblePartnerAssignmentsCondition(context)
			)
		)
		.groupBy(opportunityPartners.partnerId);

	const countMap = new Map(
		activeOpportunityCounts.map((c) => [c.partnerId, c.count])
	);

	return partnerRows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.type as PartnerType | null,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		capabilities: (row.capabilities || []) as string[],
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
		status: row.status as PartnerStatus,
		activeOpportunities: countMap.get(row.id) || 0,
	}));
}

/**
 * Search partners by capability.
 */
export async function searchPartnersByCapability(
	capability: string
): Promise<PartnerListItem[]> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.where(
			and(
				eq(partners.status, "active"),
				sql`${partners.capabilities}::jsonb ? ${capability}`
			)
		)
		.orderBy(desc(partners.performanceRating));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.type as PartnerType | null,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		capabilities: (row.capabilities || []) as string[],
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
		status: row.status as PartnerStatus,
		activeOpportunities: 0,
	}));
}

// ============================================================================
// Partner Assignments
// ============================================================================

/**
 * Assign a partner to an opportunity.
 */
export async function assignPartnerToOpportunity(
	input: AssignPartnerInput
): Promise<OpportunityPartner> {
	const context = await requirePartnerContext();
	await assertVisibleOpportunity(input.opportunityId, context);

	const [row] = await db
		.insert(opportunityPartners)
		.values({
			opportunityId: input.opportunityId,
			partnerId: input.partnerId,
			role: input.role,
			workShare: input.workShare,
			assignedSections: input.assignedSections || [],
			status: "invited",
		})
		.returning();

	// Get partner details
	const [partner] = await db
		.select()
		.from(partners)
		.where(eq(partners.id, input.partnerId));

	return transformOpportunityPartner(row, partner);
}

/**
 * Update a partner assignment.
 */
export async function updatePartnerAssignment(
	input: UpdatePartnerAssignmentInput
): Promise<OpportunityPartner> {
	const context = await requirePartnerContext();

	const updateData: Partial<OpportunityPartnerRow> = {
		updatedAt: new Date(),
	};

	if (input.role !== undefined) updateData.role = input.role;
	if (input.workShare !== undefined) updateData.workShare = input.workShare;
	if (input.assignedSections !== undefined)
		updateData.assignedSections = input.assignedSections;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.ndaSigned !== undefined) updateData.ndaSigned = input.ndaSigned;
	if (input.teamingAgreementSigned !== undefined)
		updateData.teamingAgreementSigned = input.teamingAgreementSigned;

	const [row] = await db
		.update(opportunityPartners)
		.set(updateData)
		.where(visiblePartnerAssignmentCondition(input.assignmentId, context))
		.returning();

	if (!row) {
		throw new Error(`Partner assignment ${input.assignmentId} not found`);
	}

	// Get partner details
	const [partner] = await db
		.select()
		.from(partners)
		.where(eq(partners.id, row.partnerId));

	// Update collaboration count if status changed to completed
	if (input.status === "completed") {
		await db
			.update(partners)
			.set({
				pastCollaborations: sql`${partners.pastCollaborations} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(partners.id, row.partnerId));
	}

	return transformOpportunityPartner(row, partner);
}

/**
 * Remove a partner from an opportunity.
 */
export async function removePartnerFromOpportunity(
	assignmentId: string
): Promise<void> {
	const context = await requirePartnerContext();

	await db
		.delete(opportunityPartners)
		.where(visiblePartnerAssignmentCondition(assignmentId, context));
}

/**
 * Get partners assigned to an opportunity.
 */
export async function getOpportunityPartners(
	opportunityId: string
): Promise<OpportunityPartner[]> {
	const context = await requirePartnerContext();

	const rows = await db
		.select({
			assignment: opportunityPartners,
			partner: partners,
		})
		.from(opportunityPartners)
		.innerJoin(partners, eq(partners.id, opportunityPartners.partnerId))
		.where(visibleOpportunityPartnersCondition(opportunityId, context))
		.orderBy(opportunityPartners.createdAt);

	return rows.map((row) =>
		transformOpportunityPartner(row.assignment, row.partner)
	);
}

/**
 * Get opportunities a partner is assigned to.
 */
export async function getPartnerOpportunities(
	partnerId: string
): Promise<
	Array<{
		assignment: OpportunityPartner;
		opportunityTitle: string;
		deadline: Date | null;
	}>
> {
	const context = await requirePartnerContext();

	const rows = await db
		.select({
			assignment: opportunityPartners,
			opportunityTitle: opportunities.title,
			deadline: opportunities.deadline,
		})
		.from(opportunityPartners)
		.innerJoin(
			opportunities,
			eq(opportunities.id, opportunityPartners.opportunityId)
		)
		.where(and(
			eq(opportunityPartners.partnerId, partnerId),
			assignedOpportunityCondition(context)
		))
		.orderBy(desc(opportunities.deadline));

	return rows.map((row) => ({
		assignment: transformOpportunityPartner(row.assignment),
		opportunityTitle: row.opportunityTitle,
		deadline: row.deadline,
	}));
}

// ============================================================================
// Partner Performance
// ============================================================================

/**
 * Get partner performance statistics.
 */
export async function getPartnerPerformance(
	partnerId: string
): Promise<PartnerPerformance> {
	const context = await requirePartnerContext();

	// Get partner details
	const [partner] = await db
		.select()
		.from(partners)
		.where(eq(partners.id, partnerId));

	if (!partner) {
		throw new Error(`Partner ${partnerId} not found`);
	}

	// Get all assignments for this partner
	const assignments = await db
		.select({
			assignment: opportunityPartners,
			outcome: submissions.outcome,
		})
		.from(opportunityPartners)
		.leftJoin(
			submissions,
			eq(submissions.opportunityId, opportunityPartners.opportunityId)
		)
		.where(and(
			eq(opportunityPartners.partnerId, partnerId),
			visiblePartnerAssignmentsCondition(context)
		));

	// Calculate metrics
	const totalOpportunities = assignments.length;
	const completedAssignments = assignments.filter(
		(a) => a.assignment.status === "completed"
	);
	const winsAsTeam = completedAssignments.filter(
		(a) => a.outcome === "won"
	).length;
	const lossesAsTeam = completedAssignments.filter(
		(a) => a.outcome === "lost"
	).length;
	const decidedOutcomes = winsAsTeam + lossesAsTeam;
	const winRate = decidedOutcomes > 0 ? (winsAsTeam / decidedOutcomes) * 100 : 0;

	// Calculate average work share
	const workShares = assignments
		.map((a) => a.assignment.workShare)
		.filter((ws): ws is number => ws !== null);
	const averageWorkShare =
		workShares.length > 0
			? workShares.reduce((a, b) => a + b, 0) / workShares.length
			: 0;

	// Count roles
	const rolesPlayed: Record<string, number> = {};
	for (const a of assignments) {
		const role = a.assignment.role || "unspecified";
		rolesPlayed[role] = (rolesPlayed[role] || 0) + 1;
	}

	return {
		partnerId,
		partnerName: partner.name,
		totalOpportunities,
		winsAsTeam,
		lossesAsTeam,
		winRate,
		averageWorkShare,
		rolesPlayed,
		averageRating: partner.performanceRating,
		totalCollaborations: partner.pastCollaborations,
	};
}

/**
 * Update partner rating.
 */
export async function updatePartnerRating(
	partnerId: string,
	rating: number
): Promise<Partner> {
	await requireCurrentUserId();

	if (rating < 1 || rating > 5) {
		throw new Error("Rating must be between 1 and 5");
	}

	const [row] = await db
		.update(partners)
		.set({
			performanceRating: rating,
			updatedAt: new Date(),
		})
		.where(eq(partners.id, partnerId))
		.returning();

	if (!row) {
		throw new Error(`Partner ${partnerId} not found`);
	}

	return transformPartner(row);
}

/**
 * Get top performing partners.
 */
export async function getTopPartners(limit: number = 10): Promise<PartnerListItem[]> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.where(
			and(
				eq(partners.status, "active"),
				sql`${partners.performanceRating} IS NOT NULL`
			)
		)
		.orderBy(desc(partners.performanceRating), desc(partners.pastCollaborations))
		.limit(normalizePartnerLimit(limit));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.type as PartnerType | null,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		capabilities: (row.capabilities || []) as string[],
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
		status: row.status as PartnerStatus,
		activeOpportunities: 0,
	}));
}

/**
 * Get all unique capabilities across partners.
 */
export async function getUniqueCapabilities(): Promise<string[]> {
	await requireCurrentUserId();

	const rows = await db.select({ capabilities: partners.capabilities }).from(partners);

	const allCapabilities = new Set<string>();
	for (const row of rows) {
		const caps = (row.capabilities || []) as string[];
		for (const cap of caps) {
			allCapabilities.add(cap);
		}
	}

	return Array.from(allCapabilities).sort();
}

// ============================================================================
// Extended Partner Fields (Country/Region Organization)
// ============================================================================

/**
 * Extended partner info for the partners page with country/region data.
 */
export interface ExtendedPartnerListItem {
	id: string;
	name: string;
	country: string | null;
	region: string | null;
	corporateStatus: string | null;
	foundingDate: string | null;
	description: string | null;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	website: string | null;
	leadership: string | null;
	notableClients: string | null;
	revenueEstimate: string | null;
	employeeCount: string | null;
	fundingStatus: string | null;
	coreCapabilities: string | null;
	capabilities: string[];
	competitorRelationships: string | null;
	riskAssessment: string | null;
	partnershipFitScore: number | null;
	fitJustification: string | null;
	tier: number | null;
	type: string;
	status: string;
	pastCollaborations: number;
	performanceRating: number | null;
}

/**
 * Get all partners grouped by region and country.
 */
export async function getPartnersGroupedByRegion(): Promise<{
	regions: Array<{
		region: string;
		partnerCount: number;
		countries: Array<{
			country: string;
			partners: ExtendedPartnerListItem[];
		}>;
	}>;
	ungrouped: ExtendedPartnerListItem[];
}> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.orderBy(partners.region, partners.country, partners.name);

	// Transform rows
	const transformedRows: ExtendedPartnerListItem[] = rows.map((row) => ({
		id: row.id,
		name: row.name,
		country: row.country,
		region: row.region,
		corporateStatus: row.corporateStatus,
		foundingDate: row.foundingDate,
		description: row.description,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		website: row.website,
		leadership: row.leadership,
		notableClients: row.notableClients,
		revenueEstimate: row.revenueEstimate,
		employeeCount: row.employeeCount,
		fundingStatus: row.fundingStatus,
		coreCapabilities: row.coreCapabilities,
		capabilities: (row.capabilities || []) as string[],
		competitorRelationships: row.competitorRelationships,
		riskAssessment: row.riskAssessment,
		partnershipFitScore: row.partnershipFitScore,
		fitJustification: row.fitJustification,
		tier: row.tier,
		type: row.type,
		status: row.status,
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
	}));

	// Group by region and country
	const regionMap = new Map<string, Map<string, ExtendedPartnerListItem[]>>();
	const ungrouped: ExtendedPartnerListItem[] = [];

	for (const partner of transformedRows) {
		if (!partner.region) {
			ungrouped.push(partner);
			continue;
		}

		if (!regionMap.has(partner.region)) {
			regionMap.set(partner.region, new Map());
		}

		const countryMap = regionMap.get(partner.region)!;
		const country = partner.country || "Unknown";

		if (!countryMap.has(country)) {
			countryMap.set(country, []);
		}

		countryMap.get(country)!.push(partner);
	}

	// Convert to result structure
	const regions = Array.from(regionMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([region, countryMap]) => {
			const countries = Array.from(countryMap.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([country, partners]) => ({
					country,
					partners: partners.sort((a, b) => (b.partnershipFitScore ?? 0) - (a.partnershipFitScore ?? 0)),
				}));

			return {
				region,
				partnerCount: countries.reduce((sum, c) => sum + c.partners.length, 0),
				countries,
			};
		});

	return { regions, ungrouped };
}

/**
 * Get all unique regions.
 */
export async function getUniqueRegions(): Promise<string[]> {
	await requireCurrentUserId();

	const rows = await db
		.selectDistinct({ region: partners.region })
		.from(partners)
		.where(sql`${partners.region} IS NOT NULL AND ${partners.region} != ''`)
		.orderBy(partners.region);

	return rows.map((r) => r.region).filter((r): r is string => r !== null);
}

/**
 * Get all unique countries.
 */
export async function getUniqueCountries(): Promise<string[]> {
	await requireCurrentUserId();

	const rows = await db
		.selectDistinct({ country: partners.country })
		.from(partners)
		.where(sql`${partners.country} IS NOT NULL AND ${partners.country} != ''`)
		.orderBy(partners.country);

	return rows.map((r) => r.country).filter((r): r is string => r !== null);
}

/**
 * Get partners filtered by region.
 */
export async function getPartnersByRegion(region: string): Promise<ExtendedPartnerListItem[]> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.where(eq(partners.region, region))
		.orderBy(partners.country, partners.name);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		country: row.country,
		region: row.region,
		corporateStatus: row.corporateStatus,
		foundingDate: row.foundingDate,
		description: row.description,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		website: row.website,
		leadership: row.leadership,
		notableClients: row.notableClients,
		revenueEstimate: row.revenueEstimate,
		employeeCount: row.employeeCount,
		fundingStatus: row.fundingStatus,
		coreCapabilities: row.coreCapabilities,
		capabilities: (row.capabilities || []) as string[],
		competitorRelationships: row.competitorRelationships,
		riskAssessment: row.riskAssessment,
		partnershipFitScore: row.partnershipFitScore,
		fitJustification: row.fitJustification,
		tier: row.tier,
		type: row.type,
		status: row.status,
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
	}));
}

/**
 * Get partners filtered by country.
 */
export async function getPartnersByCountry(country: string): Promise<ExtendedPartnerListItem[]> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.where(eq(partners.country, country))
		.orderBy(desc(partners.partnershipFitScore), partners.name);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		country: row.country,
		region: row.region,
		corporateStatus: row.corporateStatus,
		foundingDate: row.foundingDate,
		description: row.description,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		website: row.website,
		leadership: row.leadership,
		notableClients: row.notableClients,
		revenueEstimate: row.revenueEstimate,
		employeeCount: row.employeeCount,
		fundingStatus: row.fundingStatus,
		coreCapabilities: row.coreCapabilities,
		capabilities: (row.capabilities || []) as string[],
		competitorRelationships: row.competitorRelationships,
		riskAssessment: row.riskAssessment,
		partnershipFitScore: row.partnershipFitScore,
		fitJustification: row.fitJustification,
		tier: row.tier,
		type: row.type,
		status: row.status,
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
	}));
}

/**
 * Get tier 1 partners (fit score 8+).
 */
export async function getTier1Partners(): Promise<ExtendedPartnerListItem[]> {
	await requireCurrentUserId();

	const rows = await db
		.select()
		.from(partners)
		.where(eq(partners.tier, 1))
		.orderBy(desc(partners.partnershipFitScore), partners.region, partners.country);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		country: row.country,
		region: row.region,
		corporateStatus: row.corporateStatus,
		foundingDate: row.foundingDate,
		description: row.description,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		website: row.website,
		leadership: row.leadership,
		notableClients: row.notableClients,
		revenueEstimate: row.revenueEstimate,
		employeeCount: row.employeeCount,
		fundingStatus: row.fundingStatus,
		coreCapabilities: row.coreCapabilities,
		capabilities: (row.capabilities || []) as string[],
		competitorRelationships: row.competitorRelationships,
		riskAssessment: row.riskAssessment,
		partnershipFitScore: row.partnershipFitScore,
		fitJustification: row.fitJustification,
		tier: row.tier,
		type: row.type,
		status: row.status,
		pastCollaborations: row.pastCollaborations,
		performanceRating: row.performanceRating,
	}));
}

/**
 * Get partner statistics summary.
 */
export async function getPartnerStats(): Promise<{
	totalPartners: number;
	tier1Count: number;
	tier2Count: number;
	tier3Count: number;
	regionCount: number;
	countryCount: number;
	averageFitScore: number;
}> {
	await requireCurrentUserId();

	const [stats] = await db
		.select({
			totalPartners: sql<number>`count(*)::int`,
			tier1Count: sql<number>`count(*) filter (where ${partners.tier} = 1)::int`,
			tier2Count: sql<number>`count(*) filter (where ${partners.tier} = 2)::int`,
			tier3Count: sql<number>`count(*) filter (where ${partners.tier} = 3)::int`,
			regionCount: sql<number>`count(distinct ${partners.region})::int`,
			countryCount: sql<number>`count(distinct ${partners.country})::int`,
			averageFitScore: sql<number>`coalesce(avg(${partners.partnershipFitScore}), 0)::real`,
		})
		.from(partners);

	return {
		totalPartners: stats.totalPartners || 0,
		tier1Count: stats.tier1Count || 0,
		tier2Count: stats.tier2Count || 0,
		tier3Count: stats.tier3Count || 0,
		regionCount: stats.regionCount || 0,
		countryCount: stats.countryCount || 0,
		averageFitScore: Math.round((stats.averageFitScore || 0) * 10) / 10,
	};
}
