/**
 * Saved Searches Server Actions - DocFusion
 *
 * Server-side actions for managing saved opportunity searches,
 * including create, list, update, delete, and set default.
 */

"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth-utils";
import { savedSearches } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { OpportunityFilters, OpportunitySort } from "@/lib/types/opportunity";
import type { DiscoveryImportInput } from "@/lib/services/opportunity-discovery-import";

// ============================================================================
// Types
// ============================================================================

export interface SavedSearch {
	id: string;
	userId: string;
	name: string;
	filters: OpportunityFilters;
	sort?: OpportunitySort;
	description?: string;
	isDefault?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface SavedSearchInput {
	name: string;
	filters: OpportunityFilters;
	sort?: OpportunitySort;
	description?: string;
	isDefault?: boolean;
}

export interface DiscoveryPreset {
	id: string;
	name: string;
	description?: string;
	input: DiscoveryImportInput;
	createdAt: Date;
	updatedAt: Date;
}

export interface DiscoveryPresetInput {
	name: string;
	description?: string;
	input: DiscoveryImportInput;
}

const DISCOVERY_PRESET_KIND = "opportunity_discovery_preset";
const DISCOVERY_PRESET_VERSION = 1;

interface DiscoveryPresetPayload {
	kind: typeof DISCOVERY_PRESET_KIND;
	version: typeof DISCOVERY_PRESET_VERSION;
	input: DiscoveryImportInput;
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

function savedSearchKindCondition(userId: string) {
	return and(
		eq(savedSearches.userId, userId),
		sql`coalesce(${savedSearches.filters}->>'kind', '') != ${DISCOVERY_PRESET_KIND}`
	);
}

function discoveryPresetKindCondition(userId: string) {
	return and(
		eq(savedSearches.userId, userId),
		sql`${savedSearches.filters}->>'kind' = ${DISCOVERY_PRESET_KIND}`
	);
}

/**
 * Create a new saved search.
 */
export async function createSavedSearch(
	_userId: string,
	input: SavedSearchInput
): Promise<SavedSearch> {
	const userId = await requireCurrentUserId();

	// If setting as default, unset any existing default for this user
	if (input.isDefault) {
		await db
			.update(savedSearches)
			.set({ isDefault: false })
			.where(savedSearchKindCondition(userId));
	}

	const [row] = await db
		.insert(savedSearches)
		.values({
			userId,
			name: input.name,
			filters: input.filters as Record<string, unknown>,
			sort: input.sort as Record<string, unknown> | undefined,
			description: input.description,
			isDefault: input.isDefault ?? false,
		})
		.returning();

	return _toSavedSearch(row);
}

/**
 * List all saved searches for a user.
 */
export async function listSavedSearches(_userId: string): Promise<SavedSearch[]> {
	const userId = await requireCurrentUserId();

	const rows = await db
		.select()
		.from(savedSearches)
		.where(savedSearchKindCondition(userId))
		.orderBy(desc(savedSearches.isDefault), desc(savedSearches.updatedAt));

	return rows.map(_toSavedSearch);
}

/**
 * Get the default saved search for a user.
 */
export async function getDefaultSavedSearch(_userId: string): Promise<SavedSearch | null> {
	const userId = await requireCurrentUserId();

	const [row] = await db
		.select()
		.from(savedSearches)
		.where(and(savedSearchKindCondition(userId), eq(savedSearches.isDefault, true)))
		.limit(1);

	return row ? _toSavedSearch(row) : null;
}

/**
 * Update a saved search.
 */
export async function updateSavedSearch(
	id: string,
	_userId: string,
	input: Partial<SavedSearchInput>
): Promise<SavedSearch> {
	const userId = await requireCurrentUserId();

	// If setting as default, unset others
	if (input.isDefault) {
		await db
			.update(savedSearches)
			.set({ isDefault: false })
			.where(savedSearchKindCondition(userId));
	}

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.filters !== undefined) updateData.filters = input.filters as Record<string, unknown>;
	if (input.sort !== undefined) updateData.sort = input.sort as unknown as Record<string, unknown>;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

	const [row] = await db
		.update(savedSearches)
		.set(updateData)
		.where(and(eq(savedSearches.id, id), savedSearchKindCondition(userId)))
		.returning();

	if (!row) {
		throw new Error(`Saved search not found: ${id}`);
	}

	return _toSavedSearch(row);
}

/**
 * Delete a saved search.
 */
export async function deleteSavedSearch(id: string, _userId: string): Promise<void> {
	const userId = await requireCurrentUserId();

	await db
		.delete(savedSearches)
		.where(and(eq(savedSearches.id, id), savedSearchKindCondition(userId)));
}

/**
 * Set a saved search as the default for a user.
 */
export async function setDefaultSavedSearch(id: string, _userId: string): Promise<SavedSearch> {
	const userId = await requireCurrentUserId();

	// Unset existing default
	await db
		.update(savedSearches)
		.set({ isDefault: false })
		.where(savedSearchKindCondition(userId));

	// Set new default
	const [row] = await db
		.update(savedSearches)
		.set({ isDefault: true, updatedAt: new Date() })
		.where(and(eq(savedSearches.id, id), savedSearchKindCondition(userId)))
		.returning();

	if (!row) {
		throw new Error(`Saved search not found: ${id}`);
	}

	return _toSavedSearch(row);
}

// ============================================================================
// Discovery Presets
// ============================================================================

/**
 * Persist a reusable live discovery run configuration.
 *
 * Discovery presets reuse saved_searches with a tagged JSON payload so repeated
 * SearXNG/Firecrawl runs do not require a migration or a parallel persistence
 * table.
 */
export async function createDiscoveryPreset(
	input: DiscoveryPresetInput
): Promise<DiscoveryPreset> {
	const userId = await requireCurrentUserId();
	const name = input.name.trim();
	if (!name) {
		throw new Error("Discovery preset name is required.");
	}

	const normalizedInput = normalizeDiscoveryPresetInput(input.input);
	if (getDiscoveryQueries(normalizedInput).length === 0) {
		throw new Error("At least one discovery query is required.");
	}

	const [row] = await db
		.insert(savedSearches)
		.values({
			userId,
			name,
			filters: {
				kind: DISCOVERY_PRESET_KIND,
				version: DISCOVERY_PRESET_VERSION,
				input: normalizedInput,
			} satisfies DiscoveryPresetPayload,
			sort: undefined,
			description: input.description?.trim() || describeDiscoveryPreset(normalizedInput),
			isDefault: false,
		})
		.returning();

	return _toDiscoveryPreset(row);
}

/**
 * List reusable discovery run presets for the signed-in user.
 */
export async function listDiscoveryPresets(): Promise<DiscoveryPreset[]> {
	const userId = await requireCurrentUserId();

	const rows = await db
		.select()
		.from(savedSearches)
		.where(discoveryPresetKindCondition(userId))
		.orderBy(desc(savedSearches.updatedAt));

	return rows.map(_toDiscoveryPreset);
}

/**
 * Delete a discovery preset owned by the signed-in user.
 */
export async function deleteDiscoveryPreset(id: string): Promise<void> {
	const userId = await requireCurrentUserId();

	await db
		.delete(savedSearches)
		.where(and(eq(savedSearches.id, id), discoveryPresetKindCondition(userId)));
}

// ============================================================================
// Helpers
// ============================================================================

function getDiscoveryQueries(input: DiscoveryImportInput): string[] {
	const queries = [
		input.query,
		...(input.queries ?? []),
	].filter((query): query is string => Boolean(query?.trim()));
	return [...new Set(queries.map((query) => query.trim()))];
}

function normalizeBoundedNumber(
	value: number | undefined,
	min: number,
	max: number
): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return Math.min(max, Math.max(min, Math.trunc(value)));
}

function normalizeDiscoveryPresetInput(input: DiscoveryImportInput): DiscoveryImportInput {
	const queries = getDiscoveryQueries(input);
	const normalized: DiscoveryImportInput = {
		queries,
		updateExisting: input.updateExisting ?? true,
	};

	if (input.limitPerQuery !== undefined) {
		normalized.limitPerQuery = normalizeBoundedNumber(input.limitPerQuery, 1, 50);
	}
	if (input.scrapeLimit !== undefined) {
		normalized.scrapeLimit = normalizeBoundedNumber(input.scrapeLimit, 0, 10);
	}
	if (input.browserFallbackLimit !== undefined) {
		normalized.browserFallbackLimit = normalizeBoundedNumber(input.browserFallbackLimit, 0, 10);
	}
	if (input.language?.trim()) normalized.language = input.language.trim();
	if (input.timeRange) normalized.timeRange = input.timeRange;
	if (input.categories?.length) normalized.categories = input.categories;
	if (input.countryRegion?.trim()) normalized.countryRegion = input.countryRegion.trim();
	if (input.category?.trim()) normalized.category = input.category.trim();
	if (input.includeUnmatchedResults !== undefined) {
		normalized.includeUnmatchedResults = input.includeUnmatchedResults;
	}
	if (input.scrapeTopResults !== undefined) normalized.scrapeTopResults = input.scrapeTopResults;
	if (input.browserFallback !== undefined) normalized.browserFallback = input.browserFallback;

	return normalized;
}

function describeDiscoveryPreset(input: DiscoveryImportInput): string {
	const queryCount = getDiscoveryQueries(input).length;
	const region = input.countryRegion ? `, ${input.countryRegion}` : "";
	return `${queryCount} ${queryCount === 1 ? "query" : "queries"}${region}`;
}

function _toSavedSearch(row: typeof savedSearches.$inferSelect): SavedSearch {
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		filters: (row.filters as OpportunityFilters) ?? {},
		sort: row.sort ? (row.sort as OpportunitySort) : undefined,
		description: row.description ?? undefined,
		isDefault: row.isDefault ?? false,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function _toDiscoveryPreset(row: typeof savedSearches.$inferSelect): DiscoveryPreset {
	const payload = row.filters as Partial<DiscoveryPresetPayload>;
	if (payload.kind !== DISCOVERY_PRESET_KIND || !payload.input) {
		throw new Error(`Saved search is not a discovery preset: ${row.id}`);
	}

	return {
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		input: normalizeDiscoveryPresetInput(payload.input),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
