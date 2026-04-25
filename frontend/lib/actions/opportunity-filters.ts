/**
 * Opportunity Filter Builder - DocFusion
 *
 * Shared filter-building logic extracted from opportunity query functions.
 * Centralizes WHERE clause construction to eliminate duplication across
 * getOpportunities, getOpportunityStats, searchOpportunities, and
 * getFilterOptionsWithCounts.
 */

import { sql, and, or, eq, gte, lte, like, inArray, isNull } from "drizzle-orm";
import { opportunities } from "@/lib/db/schema";
import type { OpportunityFilters } from "@/lib/types/opportunity";

// Re-export for consumer convenience
export type { OpportunityFilters };

/**
 * Set of filter keys that can be individually excluded from condition building.
 * Used by faceted search (getFilterOptionsWithCounts) to compute counts for a
 * given facet without that facet's own filter applied.
 */
export type ExcludableFilter =
	| "categories"
	| "sectors"
	| "countries"
	| "organizations"
	| "statuses"
	| "priorityRanks"
	| "sourceFiles";

/**
 * Build an array of SQL conditions from an OpportunityFilters object.
 *
 * Each condition corresponds to one filter field. The caller combines them
 * with `and(...)` for the final WHERE clause.
 *
 * @param filters  - Filter values to apply. If undefined/null, returns [].
 * @param options  - Optional configuration:
 *   - excludeFilter: Skip building the condition for this specific filter key.
 *     Used by faceted count queries so a facet's own selection doesn't restrict
 *     its own option list.
 * @returns Array of SQL conditions (may be empty).
 */
export function buildOpportunityConditions(
	filters?: OpportunityFilters,
	options?: { excludeFilter?: ExcludableFilter }
): ReturnType<typeof eq>[] {
	const conditions: ReturnType<typeof eq>[] = [];

	if (!filters) return conditions;

	const exclude = options?.excludeFilter;

	// ── Full-text search (PostgreSQL tsvector) ────────────────────────────
	if (filters.search) {
		conditions.push(
			sql`${opportunities.searchVector} @@ plainto_tsquery('english', ${filters.search})`
		);
	}

	// ── Enum / multi-select filters ──────────────────────────────────────
	if (filters.categories?.length && exclude !== "categories") {
		conditions.push(inArray(opportunities.category, filters.categories));
	}

	if (filters.sectors?.length && exclude !== "sectors") {
		conditions.push(inArray(opportunities.sector, filters.sectors));
	}

	if (filters.countries?.length && exclude !== "countries") {
		conditions.push(inArray(opportunities.countryRegion, filters.countries));
	}

	if (filters.organizations?.length && exclude !== "organizations") {
		conditions.push(inArray(opportunities.organization, filters.organizations));
	}

	if (filters.statuses?.length && exclude !== "statuses") {
		conditions.push(inArray(opportunities.decisionStatus, filters.statuses));
	}

	if (filters.priorityRanks?.length && exclude !== "priorityRanks") {
		conditions.push(inArray(opportunities.priorityRank, filters.priorityRanks));
	}

	// ── Expiration (dynamic, computed from deadline vs today) ─────────────
	if (filters.isExpired !== undefined) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (filters.isExpired === false) {
			// Non-expired: deadline >= today OR no deadline set
			conditions.push(
				or(
					gte(opportunities.deadline, today),
					isNull(opportunities.deadline)
				)!
			);
		} else {
			// Expired: deadline < today AND deadline exists
			conditions.push(
				and(
					lte(opportunities.deadline, today),
					sql`${opportunities.deadline} IS NOT NULL`
				)!
			);
		}
	}

	// ── Boolean flags ────────────────────────────────────────────────────
	if (filters.isReviewed !== undefined) {
		conditions.push(eq(opportunities.isReviewed, filters.isReviewed));
	}

	// ── Date range ───────────────────────────────────────────────────────
	if (filters.deadlineFrom) {
		conditions.push(gte(opportunities.deadline, filters.deadlineFrom));
	}

	if (filters.deadlineTo) {
		conditions.push(lte(opportunities.deadline, filters.deadlineTo));
	}

	// ── Numeric ranges ───────────────────────────────────────────────────
	if (filters.budgetMin !== undefined) {
		conditions.push(gte(opportunities.budgetNumeric, filters.budgetMin));
	}

	if (filters.budgetMax !== undefined) {
		conditions.push(lte(opportunities.budgetNumeric, filters.budgetMax));
	}

	if (filters.fitScoreMin !== undefined) {
		conditions.push(gte(opportunities.fitScore, filters.fitScoreMin));
	}

	if (filters.fitScoreMax !== undefined) {
		conditions.push(lte(opportunities.fitScore, filters.fitScoreMax));
	}

	// ── Source file filter ───────────────────────────────────────────────
	if (filters.sourceFiles?.length && exclude !== "sourceFiles") {
		conditions.push(inArray(opportunities.sourceFile, filters.sourceFiles));
	}

	// ── Assignment filter ────────────────────────────────────────────────
	if (filters.assignedTo) {
		conditions.push(eq(opportunities.assignedTo, filters.assignedTo));
	}

	// ── Continent filter (geographic grouping) ───────────────────────────
	// Matches countryRegion against known patterns for the continent.
	// Currently supports "africa" with regional bloc and country-name matching.
	if (filters.continent === "africa") {
		const africaPatterns = [
			// Match "Africa" anywhere in the string
			sql`${opportunities.countryRegion} ILIKE '%Africa%'`,
			// Match regional blocs
			sql`${opportunities.countryRegion} ILIKE '%EAC%'`,
			sql`${opportunities.countryRegion} ILIKE '%COMESA%'`,
			sql`${opportunities.countryRegion} ILIKE '%ECOWAS%'`,
			sql`${opportunities.countryRegion} ILIKE '%SADC%'`,
			// Match specific African countries (top 20 most common)
			...([
				"Kenya", "Nigeria", "South Africa", "Ghana", "Tanzania", "Uganda",
				"Rwanda", "Ethiopia", "Egypt", "Morocco", "Botswana", "Zambia",
				"Zimbabwe", "Malawi", "Cameroon", "Senegal", "DRC", "Angola",
				"Mozambique", "Namibia",
			] as const).map((country) =>
				sql`${opportunities.countryRegion} ILIKE ${"%" + country + "%"}`
			),
		];
		conditions.push(or(...africaPatterns)!);
	}

	return conditions;
}
