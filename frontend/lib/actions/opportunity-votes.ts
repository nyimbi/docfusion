/**
 * Opportunity Votes Server Actions - DocFusion
 *
 * Server-side actions for Go/No-Go voting on opportunities.
 * Supports casting votes, retrieving vote summaries, and auto-updating
 * opportunity decision status based on consensus.
 */

"use server";

import { db } from "@/lib/db";
import { opportunityVotes, opportunities } from "@/lib/db/schema";
import { eq, and, count, avg, sql, inArray, isNull, or, type SQL } from "drizzle-orm";
import type {
	OpportunityVote,
	CastVoteInput,
	VoteSummary,
	VoteDecision,
	ConfidenceLevel,
	DecisionStatus,
} from "@/lib/types/opportunity";
import { getServerSession } from "@/lib/auth-utils";

async function requireVoteActor(): Promise<{ userId: string; userName: string | null; organizationId: string }> {
	const session = await getServerSession();
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	const organizationId = (session.user as { organizationId?: string }).organizationId;
	if (!organizationId) {
		throw new Error("No organization context");
	}
	return {
		userId: session.user.id,
		userName: session.user.name ?? session.user.email ?? null,
		organizationId,
	};
}

function opportunityOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(opportunities.organizationId, organizationId),
		isNull(opportunities.organizationId)
	)!;
}

function opportunityVoteOrganizationCondition(organizationId: string): SQL {
	return or(
		eq(opportunityVotes.organizationId, organizationId),
		isNull(opportunityVotes.organizationId)
	)!;
}

function assignedOpportunityCondition(userId: string, organizationId: string): SQL {
	return sql`(opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)
		and opportunities.assigned_to = ${userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string, organizationId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and (opportunities.organization_id = ${organizationId} or opportunities.organization_id is null)
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, userId: string, organizationId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		opportunityOrganizationCondition(organizationId),
		assignedOpportunityCondition(userId, organizationId)
	)!;
}

function visibleVotesForOpportunityCondition(opportunityId: string, userId: string, organizationId: string): SQL {
	return and(
		eq(opportunityVotes.opportunityId, opportunityId),
		opportunityVoteOrganizationCondition(organizationId),
		assignedOpportunityExistsSql(opportunityId, userId, organizationId)
	)!;
}

function visibleVoteCondition(opportunityId: string, userId: string, targetUserId: string, organizationId: string): SQL {
	return and(
		eq(opportunityVotes.opportunityId, opportunityId),
		eq(opportunityVotes.userId, targetUserId),
		opportunityVoteOrganizationCondition(organizationId),
		assignedOpportunityExistsSql(opportunityId, userId, organizationId)
	)!;
}

function visibleVotesForOpportunitiesCondition(opportunityIds: string[], userId: string, organizationId: string): SQL {
	return and(
		inArray(opportunityVotes.opportunityId, opportunityIds),
		opportunityVoteOrganizationCondition(organizationId),
		assignedOpportunityExistsSql(opportunityVotes.opportunityId, userId, organizationId)
	)!;
}

async function assertVisibleOpportunity(opportunityId: string, userId: string, organizationId: string): Promise<void> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId, organizationId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}
}

async function getVisibleOpportunityIds(opportunityIds: string[], userId: string, organizationId: string): Promise<string[]> {
	const uniqueIds = [...new Set(opportunityIds)];
	if (uniqueIds.length === 0) {
		return [];
	}

	const rows = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(and(
			inArray(opportunities.id, uniqueIds),
			opportunityOrganizationCondition(organizationId),
			assignedOpportunityCondition(userId, organizationId)
		));

	return rows.map((row) => row.id);
}

// ============================================================================
// Vote Operations
// ============================================================================

/**
 * Cast or update a vote on an opportunity.
 * Uses upsert to allow users to change their vote.
 */
export async function castVote(input: CastVoteInput): Promise<OpportunityVote> {
	const actor = await requireVoteActor();
	const now = new Date();
	await assertVisibleOpportunity(input.opportunityId, actor.userId, actor.organizationId);

	// Use upsert pattern - insert or update if user already voted
	const [existing] = await db
		.select()
		.from(opportunityVotes)
		.where(
			and(
				eq(opportunityVotes.opportunityId, input.opportunityId),
				eq(opportunityVotes.userId, actor.userId),
				opportunityVoteOrganizationCondition(actor.organizationId),
				assignedOpportunityExistsSql(input.opportunityId, actor.userId, actor.organizationId)
			)
		)
		.limit(1);

	if (existing) {
		// Update existing vote
		const [updated] = await db
			.update(opportunityVotes)
			.set({
				vote: input.vote,
				confidence: input.confidence ?? null,
				justification: input.justification ?? null,
				userName: actor.userName ?? existing.userName,
				updatedAt: now,
			})
			.where(and(
				eq(opportunityVotes.id, existing.id),
				opportunityVoteOrganizationCondition(actor.organizationId)
			))
			.returning();

		return mapToOpportunityVote(updated);
	} else {
		// Insert new vote
		const [inserted] = await db
			.insert(opportunityVotes)
			.values({
				organizationId: actor.organizationId,
				opportunityId: input.opportunityId,
				userId: actor.userId,
				userName: actor.userName,
				vote: input.vote,
				confidence: input.confidence ?? null,
				justification: input.justification ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return mapToOpportunityVote(inserted);
	}
}

/**
 * Get all votes for an opportunity.
 */
export async function getVotes(opportunityId: string): Promise<OpportunityVote[]> {
	const actor = await requireVoteActor();

	const rows = await db
		.select()
		.from(opportunityVotes)
		.where(visibleVotesForOpportunityCondition(opportunityId, actor.userId, actor.organizationId))
		.orderBy(opportunityVotes.createdAt);

	return rows.map(mapToOpportunityVote);
}

/**
 * Get a single user's vote on an opportunity.
 */
export async function getUserVote(
	opportunityId: string,
	userId: string
): Promise<OpportunityVote | null> {
	const actor = await requireVoteActor();

	const [row] = await db
		.select()
		.from(opportunityVotes)
		.where(visibleVoteCondition(opportunityId, actor.userId, userId, actor.organizationId))
		.limit(1);

	return row ? mapToOpportunityVote(row) : null;
}

/**
 * Delete a vote (allows user to abstain completely).
 */
export async function deleteVote(
	opportunityId: string,
	_userId: string
): Promise<void> {
	const actor = await requireVoteActor();
	await db
		.delete(opportunityVotes)
		.where(visibleVoteCondition(opportunityId, actor.userId, actor.userId, actor.organizationId));
}

// ============================================================================
// Vote Summary
// ============================================================================

/**
 * Get vote summary statistics for an opportunity.
 * Calculates go/no-go counts, percentages, and consensus.
 */
export async function getVoteSummary(opportunityId: string): Promise<VoteSummary> {
	const actor = await requireVoteActor();

	// Get vote counts by type
	const voteCounts = await db
		.select({
			vote: opportunityVotes.vote,
			count: count(),
		})
		.from(opportunityVotes)
		.where(visibleVotesForOpportunityCondition(opportunityId, actor.userId, actor.organizationId))
		.groupBy(opportunityVotes.vote);

	// Get average confidence (excluding null values)
	const [confidenceResult] = await db
		.select({
			avg: avg(opportunityVotes.confidence),
		})
		.from(opportunityVotes)
		.where(
			and(
				eq(opportunityVotes.opportunityId, opportunityId),
				opportunityVoteOrganizationCondition(actor.organizationId),
				sql`${opportunityVotes.confidence} IS NOT NULL`,
				assignedOpportunityExistsSql(opportunityId, actor.userId, actor.organizationId)
			)
		);

	// Build counts map
	const countsMap: Record<VoteDecision, number> = {
		go: 0,
		no_go: 0,
		abstain: 0,
	};

	for (const row of voteCounts) {
		if (row.vote && row.vote in countsMap) {
			countsMap[row.vote as VoteDecision] = row.count;
		}
	}

	const goCount = countsMap.go;
	const noGoCount = countsMap.no_go;
	const abstainCount = countsMap.abstain;
	const totalVotes = goCount + noGoCount + abstainCount;

	// Calculate percentage (only consider go/no_go votes for decision)
	const decisionVotes = goCount + noGoCount;
	const goPercentage = decisionVotes > 0 ? (goCount / decisionVotes) * 100 : 0;

	// Consensus: 60%+ agreement on either direction (excluding abstains)
	const hasConsensus = decisionVotes >= 2 && (goPercentage >= 60 || goPercentage <= 40);

	// Recommended decision
	let recommendedDecision: VoteDecision | null = null;
	if (hasConsensus) {
		recommendedDecision = goPercentage >= 60 ? "go" : "no_go";
	}

	// Parse average confidence
	const avgConfidence = confidenceResult?.avg
		? parseFloat(String(confidenceResult.avg))
		: null;

	return {
		opportunityId,
		totalVotes,
		goCount,
		noGoCount,
		abstainCount,
		averageConfidence: avgConfidence ? Math.round(avgConfidence * 10) / 10 : null,
		goPercentage: Math.round(goPercentage * 10) / 10,
		hasConsensus,
		recommendedDecision,
	};
}

// ============================================================================
// Auto-update Decision Status
// ============================================================================

/**
 * Update opportunity decision status based on vote consensus.
 * Called after votes are cast to automatically update status when consensus is reached.
 *
 * Rules:
 * - If 60%+ vote "go" and opportunity is "pending", set to "interested"
 * - If 60%+ vote "no_go" and opportunity is "pending" or "interested", set to "declined"
 * - Only updates if there are at least 2 decision votes (go or no_go)
 */
export async function updateDecisionFromVotes(
	opportunityId: string
): Promise<{ updated: boolean; newStatus: DecisionStatus | null }> {
	const actor = await requireVoteActor();

	const summary = await getVoteSummary(opportunityId);

	// Need at least 2 decision votes for auto-update
	const decisionVotes = summary.goCount + summary.noGoCount;
	if (decisionVotes < 2) {
		return { updated: false, newStatus: null };
	}

	// Get current opportunity status
	const [opportunity] = await db
		.select({ decisionStatus: opportunities.decisionStatus })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, actor.userId, actor.organizationId))
		.limit(1);

	if (!opportunity) {
		return { updated: false, newStatus: null };
	}

	const currentStatus = opportunity.decisionStatus as DecisionStatus;

	// Determine if we should update
	let newStatus: DecisionStatus | null = null;

	if (summary.goPercentage >= 60 && currentStatus === "pending") {
		// Consensus to pursue - move from pending to interested
		newStatus = "interested";
	} else if (
		summary.goPercentage <= 40 &&
		(currentStatus === "pending" || currentStatus === "interested")
	) {
		// Consensus to decline
		newStatus = "declined";
	}

	if (newStatus) {
		await db
			.update(opportunities)
			.set({
				decisionStatus: newStatus,
				decisionReason: `Auto-updated based on team vote (${summary.goCount} go, ${summary.noGoCount} no-go)`,
				updatedAt: new Date(),
			})
			.where(visibleOpportunityCondition(opportunityId, actor.userId, actor.organizationId));

		return { updated: true, newStatus };
	}

	return { updated: false, newStatus: null };
}

/**
 * Cast vote and automatically update decision status if consensus is reached.
 * Convenience function that combines castVote and updateDecisionFromVotes.
 */
export async function castVoteAndUpdateStatus(
	input: CastVoteInput
): Promise<{
	vote: OpportunityVote;
	summary: VoteSummary;
	statusUpdate: { updated: boolean; newStatus: DecisionStatus | null };
}> {
	const vote = await castVote(input);
	const summary = await getVoteSummary(input.opportunityId);
	const statusUpdate = await updateDecisionFromVotes(input.opportunityId);

	return { vote, summary, statusUpdate };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Get vote summaries for multiple opportunities.
 * Useful for displaying vote status in opportunity lists.
 */
export async function getVoteSummariesBulk(
	opportunityIds: string[]
): Promise<Map<string, VoteSummary>> {
	const actor = await requireVoteActor();

	if (opportunityIds.length === 0) {
		return new Map();
	}
	const visibleOpportunityIds = await getVisibleOpportunityIds(opportunityIds, actor.userId, actor.organizationId);
	if (visibleOpportunityIds.length === 0) {
		return new Map();
	}

	// Get all vote counts grouped by opportunity and vote type
	const allCounts = await db
		.select({
			opportunityId: opportunityVotes.opportunityId,
			vote: opportunityVotes.vote,
			count: count(),
		})
		.from(opportunityVotes)
		.where(visibleVotesForOpportunitiesCondition(visibleOpportunityIds, actor.userId, actor.organizationId))
		.groupBy(opportunityVotes.opportunityId, opportunityVotes.vote);

	// Get average confidences
	const confidences = await db
		.select({
			opportunityId: opportunityVotes.opportunityId,
			avg: avg(opportunityVotes.confidence),
		})
		.from(opportunityVotes)
		.where(
			and(
				inArray(opportunityVotes.opportunityId, visibleOpportunityIds),
				opportunityVoteOrganizationCondition(actor.organizationId),
				sql`${opportunityVotes.confidence} IS NOT NULL`,
				assignedOpportunityExistsSql(opportunityVotes.opportunityId, actor.userId, actor.organizationId)
			)
		)
		.groupBy(opportunityVotes.opportunityId);

	// Build summaries map
	const summaries = new Map<string, VoteSummary>();

	// Initialize all requested opportunities with empty summaries
	for (const id of visibleOpportunityIds) {
		summaries.set(id, {
			opportunityId: id,
			totalVotes: 0,
			goCount: 0,
			noGoCount: 0,
			abstainCount: 0,
			averageConfidence: null,
			goPercentage: 0,
			hasConsensus: false,
			recommendedDecision: null,
		});
	}

	// Populate counts
	for (const row of allCounts) {
		const summary = summaries.get(row.opportunityId);
		if (summary) {
			if (row.vote === "go") summary.goCount = row.count;
			else if (row.vote === "no_go") summary.noGoCount = row.count;
			else if (row.vote === "abstain") summary.abstainCount = row.count;
		}
	}

	// Populate confidences and calculate derived values
	const confidenceMap = new Map(
		confidences.map((c) => [c.opportunityId, c.avg])
	);

	for (const [id, summary] of summaries) {
		summary.totalVotes = summary.goCount + summary.noGoCount + summary.abstainCount;

		const decisionVotes = summary.goCount + summary.noGoCount;
		summary.goPercentage =
			decisionVotes > 0
				? Math.round(((summary.goCount / decisionVotes) * 100) * 10) / 10
				: 0;

		summary.hasConsensus =
			decisionVotes >= 2 &&
			(summary.goPercentage >= 60 || summary.goPercentage <= 40);

		if (summary.hasConsensus) {
			summary.recommendedDecision =
				summary.goPercentage >= 60 ? "go" : "no_go";
		}

		const avgConf = confidenceMap.get(id);
		summary.averageConfidence = avgConf
			? Math.round(parseFloat(String(avgConf)) * 10) / 10
			: null;
	}

	return summaries;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map database row to typed OpportunityVote.
 */
function mapToOpportunityVote(row: typeof opportunityVotes.$inferSelect): OpportunityVote {
	return {
		id: row.id,
		opportunityId: row.opportunityId,
		userId: row.userId,
		userName: row.userName,
		vote: row.vote as VoteDecision,
		confidence: row.confidence as ConfidenceLevel | null,
		justification: row.justification,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
