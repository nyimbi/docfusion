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
import { eq, and, desc } from "drizzle-orm";
import type { OpportunityFilters, OpportunitySort } from "@/lib/types/opportunity";

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
			.where(eq(savedSearches.userId, userId));
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
		.where(eq(savedSearches.userId, userId))
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
		.where(and(eq(savedSearches.userId, userId), eq(savedSearches.isDefault, true)))
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
			.where(eq(savedSearches.userId, userId));
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
		.where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
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
		.where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
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
		.where(eq(savedSearches.userId, userId));

	// Set new default
	const [row] = await db
		.update(savedSearches)
		.set({ isDefault: true, updatedAt: new Date() })
		.where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
		.returning();

	if (!row) {
		throw new Error(`Saved search not found: ${id}`);
	}

	return _toSavedSearch(row);
}

// ============================================================================
// Helpers
// ============================================================================

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
