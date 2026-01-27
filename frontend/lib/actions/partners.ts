/**
 * Partner Server Actions - DocFusion
 *
 * Server actions for managing partner organizations and assignments.
 */

"use server";

import { db } from "@/lib/db";
import {
	partners,
	opportunityPartners,
	opportunities,
	submissions,
	type PartnerRow,
	type OpportunityPartnerRow,
} from "@/lib/db/schema";
import { eq, desc, and, ilike, sql, or, inArray } from "drizzle-orm";
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

/**
 * Create a new partner.
 */
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
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
	await db.delete(partners).where(eq(partners.id, id));
}

/**
 * Get partners with optional filtering.
 */
export async function getPartners(filters?: PartnerFilters): Promise<PartnerListItem[]> {
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
			inArray(opportunityPartners.status, ["invited", "accepted", "active"])
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
		.where(eq(opportunityPartners.id, input.assignmentId))
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
	await db
		.delete(opportunityPartners)
		.where(eq(opportunityPartners.id, assignmentId));
}

/**
 * Get partners assigned to an opportunity.
 */
export async function getOpportunityPartners(
	opportunityId: string
): Promise<OpportunityPartner[]> {
	const rows = await db
		.select({
			assignment: opportunityPartners,
			partner: partners,
		})
		.from(opportunityPartners)
		.innerJoin(partners, eq(partners.id, opportunityPartners.partnerId))
		.where(eq(opportunityPartners.opportunityId, opportunityId))
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
		.where(eq(opportunityPartners.partnerId, partnerId))
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
		.where(eq(opportunityPartners.partnerId, partnerId));

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
		.limit(limit);

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
