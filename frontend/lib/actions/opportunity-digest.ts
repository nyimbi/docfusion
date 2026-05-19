"use server";

import { recordWorkflowRuntimeTransition } from "@/lib/actions/workflow-runtime";
import {
	getOpportunities,
	getSavedSearches,
	type SavedSearch,
} from "@/lib/actions/opportunities";
import type { OpportunityListItem } from "@/lib/types/opportunity";
import { logger } from "@/lib/utils/logger";
import { getCurrentUserId } from "@/lib/auth-utils";

export interface OpportunityDigestWorkflowInput {
	userId: string;
	digestDate?: Date | string;
	reason?: string;
	maxPerSearch?: number;
}

export interface OpportunityDigestWorkflowResult {
	success: boolean;
	userId: string;
	state: "queued_for_delivery" | "skipped_empty" | "failed";
	digestKey: string;
	opportunityIds: string[];
	savedSearchIds: string[];
	workflowInstanceId?: string;
	error?: string;
}

interface DigestCandidate {
	opportunity: OpportunityListItem;
	search: SavedSearch;
}

export async function sendOpportunityDigestWorkflow(
	input: OpportunityDigestWorkflowInput
): Promise<OpportunityDigestWorkflowResult> {
	const actorId = await requireDigestActor(input.userId);
	const digestDate = normalizeDigestDate(input.digestDate);
	const digestKey = makeDigestKey(input.userId, digestDate);
	const maxPerSearch = Math.max(1, Math.min(25, input.maxPerSearch ?? 5));
	const reason = input.reason?.trim() || "Daily opportunity digest evaluation.";

	try {
		const savedSearches = await getSavedSearches(input.userId);
		const candidates = await collectDigestCandidates(savedSearches, maxPerSearch);
		const opportunityIds = [...new Set(candidates.map((candidate) => candidate.opportunity.id))];
		const savedSearchIds = savedSearches.map((search) => search.id);
		const state = opportunityIds.length > 0 ? "queued_for_delivery" : "skipped_empty";

		const workflow = await recordWorkflowRuntimeTransition({
			workflowKey: "opportunity_digest",
			subjectType: "opportunity_digest",
			subjectId: digestKey,
			fromState: "scheduled",
			toState: state,
			eventType: state === "queued_for_delivery"
				? "opportunity_digest_queued"
				: "opportunity_digest_skipped_empty",
			actorId,
			reason: state === "queued_for_delivery"
				? reason
				: `${reason} No matching opportunities were found for ${savedSearches.length} saved search${savedSearches.length === 1 ? "" : "es"}.`,
			priority: "medium",
			assignedTo: input.userId,
			assignedRole: "proposal_manager",
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: ["proposal_manager", "capture_manager"],
				escalationRole: "operations",
			},
			metadata: {
				digestDate: digestDate.toISOString(),
				digestKey,
				savedSearchIds,
				opportunityIds,
				opportunityCount: opportunityIds.length,
				searchCount: savedSearches.length,
				maxPerSearch,
				emptyDigestPolicy: "audit-only-skip-delivery",
				summary: summarizeDigestCandidates(candidates),
			},
			terminal: state === "skipped_empty",
			actionUrl: "/opportunities",
			notificationRecipients: state === "queued_for_delivery" ? [input.userId] : [],
		});

		return {
			success: true,
			userId: input.userId,
			state,
			digestKey,
			opportunityIds,
			savedSearchIds,
			workflowInstanceId: workflow.id,
		};
	} catch (error) {
		logger.error("Error sending opportunity digest workflow:", error);
		return {
			success: false,
			userId: input.userId,
			state: "failed",
			digestKey,
			opportunityIds: [],
			savedSearchIds: [],
			error: error instanceof Error ? error.message : "Failed to send opportunity digest",
		};
	}
}

async function requireDigestActor(userId: string): Promise<string> {
	const currentUserId = await getCurrentUserId();
	if (!currentUserId || currentUserId !== userId) {
		throw new Error("Unauthorized");
	}
	return currentUserId;
}

async function collectDigestCandidates(
	savedSearches: SavedSearch[],
	maxPerSearch: number
): Promise<DigestCandidate[]> {
	const candidates: DigestCandidate[] = [];
	for (const search of savedSearches) {
		const result = await getOpportunities(search.filters, search.sort, {
			page: 1,
			pageSize: maxPerSearch,
		});
		for (const opportunity of result.data) {
			candidates.push({ opportunity, search });
		}
	}
	return candidates;
}

function summarizeDigestCandidates(candidates: DigestCandidate[]) {
	const bySearch: Record<string, { name: string; count: number; opportunityIds: string[] }> = {};
	for (const candidate of candidates) {
		const item = bySearch[candidate.search.id] ?? {
			name: candidate.search.name,
			count: 0,
			opportunityIds: [],
		};
		item.count += 1;
		item.opportunityIds.push(candidate.opportunity.id);
		bySearch[candidate.search.id] = item;
	}
	return bySearch;
}

function normalizeDigestDate(value?: Date | string): Date {
	if (!value) return new Date();
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error("Digest date is invalid");
	}
	return date;
}

function makeDigestKey(userId: string, digestDate: Date): string {
	return `${userId}:${digestDate.toISOString().slice(0, 10)}`;
}
