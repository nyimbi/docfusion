"use server";

/**
 * Server Actions for Snippet operations.
 *
 * Snippets are reusable content blocks with keyboard shortcuts
 * for quick insertion into documents.
 */

import { db, templateSnippets } from "@/lib/db";
import { eq, desc, asc, ilike, and, or, sql, SQL, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
	TemplateSnippet,
	SnippetSummary,
	SnippetListParams,
	SnippetListResponse,
	CreateSnippetInput,
	UpdateSnippetInput,
	ShortcutExpansion,
	SnippetExpansionRequest,
	SnippetPlaceholder,
	SnippetInsertionProvenance,
} from "@/lib/types/snippets";
import type { DocumentContent } from "@/lib/types/document";
import { getServerSession } from "@/lib/auth-utils";
import { normalizePlaceholderDefinitions } from "@/lib/placeholders/substitution";
import { adaptResolvedSnippet, resolveSnippetContent } from "@/lib/snippets/resolve-snippet-content";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user ID from session.
 */
async function getCurrentUserId(): Promise<string> {
	const session = await getServerSession();
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return session.user.id;
}

/**
 * Get current organization ID from session.
 */
async function getCurrentOrganizationId(): Promise<string | undefined> {
	const session = await getServerSession();
	// Organization ID would typically come from session or user's active org
	// For now, return undefined as organizations are optional
	return (session?.user as { organizationId?: string } | undefined)?.organizationId;
}

/**
 * Format shortcut consistently (always starts with /)
 */
function formatShortcut(shortcut: string): string {
	return shortcut.startsWith("/") ? shortcut : `/${shortcut}`;
}

/**
 * Map database row to TemplateSnippet type.
 */
function mapRowToSnippet(row: typeof templateSnippets.$inferSelect): TemplateSnippet {
	return {
		id: row.id,
		name: row.name,
		shortcut: row.shortcut,
		content: row.content as DocumentContent,
		placeholders: normalizePlaceholderDefinitions((row.placeholders ?? []) as SnippetPlaceholder[]),
		description: row.description ?? undefined,
		tags: (row.tags as string[]) || [],
		category: row.category ?? undefined,
		createdBy: row.createdBy,
		organizationId: row.organizationId ?? undefined,
		useCount: row.useCount,
		isPublic: row.isPublic,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/**
 * Map database row to SnippetSummary type.
 */
function mapRowToSummary(row: typeof templateSnippets.$inferSelect): SnippetSummary {
	return {
		id: row.id,
		name: row.name,
		shortcut: row.shortcut,
		description: row.description ?? undefined,
		tags: (row.tags as string[]) || [],
		placeholders: normalizePlaceholderDefinitions((row.placeholders ?? []) as SnippetPlaceholder[]),
		category: row.category ?? undefined,
		useCount: row.useCount,
		isPublic: row.isPublic,
		createdBy: row.createdBy,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

// ============================================================================
// Snippet CRUD
// ============================================================================

/**
 * List snippets with filtering, sorting, and pagination.
 */
export async function listSnippets(
	params: SnippetListParams = {}
): Promise<SnippetListResponse> {
	const {
		category,
		tags,
		isPublic,
		createdBy,
		search,
		sortBy = "useCount",
		sortOrder = "desc",
		offset = 0,
		limit = 20,
	} = params;

	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	// Build where conditions
	const conditions: SQL[] = [];

	// Filter by ownership or public
	conditions.push(
		or(
			eq(templateSnippets.createdBy, currentUserId),
			eq(templateSnippets.isPublic, true),
			orgId ? eq(templateSnippets.organizationId, orgId) : undefined
		)!
	);

	if (category) {
		conditions.push(eq(templateSnippets.category, category));
	}
	if (isPublic !== undefined) {
		conditions.push(eq(templateSnippets.isPublic, isPublic));
	}
	if (createdBy) {
		conditions.push(eq(templateSnippets.createdBy, createdBy));
	}
	if (search) {
		conditions.push(
			or(
				ilike(templateSnippets.name, `%${search}%`),
				ilike(templateSnippets.description, `%${search}%`),
				ilike(templateSnippets.shortcut, `%${search}%`)
			)!
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Build order by
	const sortColumn = {
		createdAt: templateSnippets.createdAt,
		updatedAt: templateSnippets.updatedAt,
		name: templateSnippets.name,
		useCount: templateSnippets.useCount,
	}[sortBy] || templateSnippets.useCount;

	const orderFn = sortOrder === "asc" ? asc : desc;

	// Execute queries
	const [rows, countResult, categoryRows] = await Promise.all([
		db
			.select()
			.from(templateSnippets)
			.where(whereClause)
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(templateSnippets)
			.where(whereClause),
		// Get all unique categories
		db
			.select({ category: templateSnippets.category })
			.from(templateSnippets)
			.where(whereClause)
			.groupBy(templateSnippets.category)
			.orderBy(asc(templateSnippets.category)),
	]);

	const total = Number(countResult[0]?.count || 0);
	const categories = categoryRows.map(r => r.category).filter(Boolean) as string[];

	return {
		snippets: rows.map(mapRowToSummary),
		total,
		offset,
		limit,
		hasMore: offset + rows.length < total,
		categories,
	};
}

/**
 * Get a single snippet by ID.
 */
export async function getSnippet(id: string): Promise<TemplateSnippet | null> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	const rows = await db
		.select()
		.from(templateSnippets)
		.where(eq(templateSnippets.id, id))
		.limit(1);

	if (rows.length === 0) return null;

	const row = rows[0];
	
	// Check access permissions
	const hasAccess = 
		row.createdBy === currentUserId ||
		row.isPublic ||
		(row.organizationId === orgId);

	if (!hasAccess) return null;

	return mapRowToSnippet(row);
}

/**
 * Get a snippet by shortcut.
 */
export async function getSnippetByShortcut(shortcut: string): Promise<TemplateSnippet | null> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();
	const formattedShortcut = formatShortcut(shortcut);

	const rows = await db
		.select()
		.from(templateSnippets)
		.where(eq(templateSnippets.shortcut, formattedShortcut))
		.limit(1);

	if (rows.length === 0) return null;

	const row = rows[0];
	
	// Check access permissions
	const hasAccess = 
		row.createdBy === currentUserId ||
		row.isPublic ||
		(row.organizationId === orgId);

	if (!hasAccess) return null;

	return mapRowToSnippet(row);
}

/**
 * Create a new snippet.
 */
export async function createSnippet(
	input: CreateSnippetInput
): Promise<TemplateSnippet> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	// Check if shortcut already exists for this org/user
	const existingCheck = await db
		.select({ id: templateSnippets.id })
		.from(templateSnippets)
		.where(
			and(
				eq(templateSnippets.shortcut, formatShortcut(input.shortcut)),
				or(
					eq(templateSnippets.createdBy, currentUserId),
					eq(templateSnippets.organizationId, orgId || "")
				)!
			)
		);

	if (existingCheck.length > 0) {
		throw new Error(`Shortcut "${input.shortcut}" already exists`);
	}

	const [row] = await db
		.insert(templateSnippets)
		.values({
			name: input.name,
			shortcut: formatShortcut(input.shortcut),
			content: input.content,
			placeholders: normalizePlaceholderDefinitions(input.placeholders ?? []),
			description: input.description,
			tags: input.tags || [],
			category: input.category,
			createdBy: currentUserId,
			organizationId: orgId,
			useCount: 0,
			isPublic: input.isPublic ?? false,
		})
		.returning();

	revalidatePath("/snippets");
	return mapRowToSnippet(row);
}

/**
 * Create a snippet from selected text.
 */
export async function createSnippetFromSelection(
	name: string,
	shortcut: string,
	content: DocumentContent,
	options?: {
		description?: string;
		tags?: string[];
		category?: string;
		placeholders?: SnippetPlaceholder[];
		isPublic?: boolean;
	}
): Promise<TemplateSnippet> {
	return createSnippet({
		name,
		shortcut,
		content,
		placeholders: options?.placeholders,
		description: options?.description,
		tags: options?.tags,
		category: options?.category,
		isPublic: options?.isPublic,
	});
}

/**
 * Update an existing snippet.
 */
export async function updateSnippet(
	id: string,
	input: UpdateSnippetInput
): Promise<TemplateSnippet | null> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	// Check existence and ownership
	const existing = await db
		.select()
		.from(templateSnippets)
		.where(eq(templateSnippets.id, id))
		.limit(1);

	if (existing.length === 0) return null;

	const row = existing[0];

	// Check modification permissions (only creator or org admin can edit)
	const canEdit = 
		row.createdBy === currentUserId ||
		(row.organizationId === orgId && row.isPublic);

	if (!canEdit) {
		throw new Error("Not authorized to update this snippet");
	}

	// Check shortcut uniqueness if being updated
	if (input.shortcut) {
		const formattedShortcut = formatShortcut(input.shortcut);
		const existingCheck = await db
			.select({ id: templateSnippets.id })
			.from(templateSnippets)
			.where(
				and(
					eq(templateSnippets.shortcut, formattedShortcut),
					or(
						eq(templateSnippets.createdBy, currentUserId),
						eq(templateSnippets.organizationId, orgId || "")
					)!,
					// Exclude current snippet
					sql`${templateSnippets.id} != ${id}`
				)
			);

		if (existingCheck.length > 0) {
			throw new Error(`Shortcut "${input.shortcut}" already exists`);
		}
	}

	const updateData: Partial<typeof templateSnippets.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.shortcut !== undefined) updateData.shortcut = formatShortcut(input.shortcut);
	if (input.content !== undefined) updateData.content = input.content;
	if (input.placeholders !== undefined) {
		updateData.placeholders = normalizePlaceholderDefinitions(input.placeholders);
	}
	if (input.description !== undefined) updateData.description = input.description;
	if (input.tags !== undefined) updateData.tags = input.tags;
	if (input.category !== undefined) updateData.category = input.category;
	if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

	const [updated] = await db
		.update(templateSnippets)
		.set(updateData)
		.where(eq(templateSnippets.id, id))
		.returning();

	revalidatePath("/snippets");
	revalidatePath(`/snippets/${id}`);
	return mapRowToSnippet(updated);
}

/**
 * Delete a snippet.
 */
export async function deleteSnippet(id: string): Promise<boolean> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	// Check existence and ownership
	const existing = await db
		.select()
		.from(templateSnippets)
		.where(eq(templateSnippets.id, id))
		.limit(1);

	if (existing.length === 0) return false;

	const row = existing[0];

	// Check deletion permissions
	const canDelete = 
		row.createdBy === currentUserId ||
		(row.organizationId === orgId && row.isPublic);

	if (!canDelete) {
		throw new Error("Not authorized to delete this snippet");
	}

	const result = await db
		.delete(templateSnippets)
		.where(eq(templateSnippets.id, id))
		.returning({ id: templateSnippets.id });

	revalidatePath("/snippets");
	return result.length > 0;
}

/**
 * Increment the use count for a snippet.
 * Called when a snippet is inserted into a document.
 */
export async function incrementSnippetUseCount(id: string): Promise<void> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();
	const snippet = await db
		.select({
			useCount: templateSnippets.useCount,
			createdBy: templateSnippets.createdBy,
			isPublic: templateSnippets.isPublic,
			organizationId: templateSnippets.organizationId,
		})
		.from(templateSnippets)
		.where(eq(templateSnippets.id, id))
		.limit(1);

	if (snippet.length === 0) return;
	const row = snippet[0];
	const hasAccess =
		row.createdBy === currentUserId ||
		row.isPublic ||
		row.organizationId === orgId;
	if (!hasAccess) return;

	await db
		.update(templateSnippets)
		.set({
			useCount: row.useCount + 1,
			updatedAt: new Date(),
		})
		.where(eq(templateSnippets.id, id));
}

/**
 * Search snippets by query string.
 */
export async function searchSnippets(
	query: string,
	limit = 20
): Promise<SnippetSummary[]> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();
	const searchTerm = `%${query}%`;

	const rows = await db
		.select()
		.from(templateSnippets)
		.where(
			and(
				or(
					ilike(templateSnippets.name, searchTerm),
					ilike(templateSnippets.description, searchTerm),
					ilike(templateSnippets.shortcut, searchTerm)
				)!,
				or(
					eq(templateSnippets.createdBy, currentUserId),
					eq(templateSnippets.isPublic, true),
					orgId ? eq(templateSnippets.organizationId, orgId) : undefined
				)!
			)
		)
		.orderBy(desc(templateSnippets.useCount), asc(templateSnippets.name))
		.limit(limit);

	return rows.map(mapRowToSummary);
}

/**
 * Expand a shortcut to snippet content.
 * This is the main operation for the shortcut expansion feature.
 */
export async function expandShortcut(
	shortcutOrRequest: string | SnippetExpansionRequest
): Promise<ShortcutExpansion | null> {
	const request =
		typeof shortcutOrRequest === "string"
			? { shortcut: shortcutOrRequest }
			: shortcutOrRequest;
	const shortcut = request.shortcut;
	const formattedShortcut = formatShortcut(shortcut);
	const snippet = await getSnippetByShortcut(formattedShortcut);
	
	if (!snippet) return null;

	const resolved = await resolveSnippetContent({
		...request,
		snippetId: snippet.id,
		shortcut: snippet.shortcut,
		content: snippet.content,
		placeholders: snippet.placeholders,
	});
	const adapted = await adaptResolvedSnippet({
		resolved,
		richContext: {
			requirementText: request.requirementText,
			sectionTitle: request.sectionTitle,
			surroundingText: request.surroundingText,
			proposalTone: request.proposalTone,
		},
		useAI: request.useAI,
	});

	// Increment use count
	await incrementSnippetUseCount(snippet.id);

	return {
		snippet: {
			id: snippet.id,
			name: snippet.name,
			shortcut: snippet.shortcut,
			description: snippet.description,
			tags: snippet.tags,
			placeholders: snippet.placeholders,
			category: snippet.category,
			useCount: snippet.useCount,
			isPublic: snippet.isPublic,
			createdBy: snippet.createdBy,
			createdAt: snippet.createdAt,
			updatedAt: snippet.updatedAt,
		},
		content: adapted.adaptedContent,
		plainTextPreview: adapted.plainTextPreview,
		unresolvedPlaceholders: adapted.unresolvedPlaceholders,
		resolvedValues: resolved.resolvedValues,
		valueSources: resolved.valueSources,
		diagnostics: adapted.diagnostics,
		adaptationNotes: adapted.adaptationNotes,
		provenance: buildSnippetInsertionProvenance({
			request,
			resolved,
			adaptationNotes: adapted.adaptationNotes,
			diagnostics: adapted.diagnostics,
			usedAI: request.useAI !== false && adapted.adaptationNotes.some((note) => note.includes("Adapted after")),
		}),
	};
}

function buildSnippetInsertionProvenance(input: {
	request: SnippetExpansionRequest;
	resolved: Awaited<ReturnType<typeof resolveSnippetContent>>;
	adaptationNotes: string[];
	diagnostics: Awaited<ReturnType<typeof adaptResolvedSnippet>>["diagnostics"];
	usedAI: boolean;
}): SnippetInsertionProvenance {
	return {
		snippetId: input.resolved.snippetId,
		shortcut: input.resolved.shortcut,
		resolvedAt: new Date().toISOString(),
		placeholderCount: input.resolved.placeholderMetadata.length,
		resolvedKeys: Object.keys(input.resolved.resolvedValues).sort(),
		unresolvedKeys: input.resolved.unresolvedPlaceholders
			.map((placeholder) => placeholder.key)
			.sort(),
		valueSources: input.resolved.valueSources,
		diagnostics: input.diagnostics,
		adaptation: {
			usedAI: input.usedAI,
			notes: input.adaptationNotes,
		},
		context: {
			documentId: input.request.documentId,
			opportunityId: input.request.opportunityId,
			requirementId: input.request.requirementId,
			hasRequirementText: Boolean(input.request.requirementText),
			hasSurroundingText: Boolean(input.request.surroundingText),
			sectionTitle: input.request.sectionTitle,
		},
	};
}

/**
 * Get all snippets for a category.
 */
export async function getSnippetsByCategory(category: string): Promise<SnippetSummary[]> {
	const currentUserId = await getCurrentUserId();
	const orgId = await getCurrentOrganizationId();

	const rows = await db
		.select()
		.from(templateSnippets)
		.where(
			and(
				eq(templateSnippets.category, category),
				or(
					eq(templateSnippets.createdBy, currentUserId),
					eq(templateSnippets.isPublic, true),
					orgId ? eq(templateSnippets.organizationId, orgId) : undefined
				)!
			)
		)
		.orderBy(desc(templateSnippets.useCount));

	return rows.map(mapRowToSummary);
}

/**
 * Get popular snippets across all organizations.
 */
export async function getPopularSnippets(
	limit = 10
): Promise<SnippetSummary[]> {
	const rows = await db
		.select()
		.from(templateSnippets)
		.where(eq(templateSnippets.isPublic, true))
		.orderBy(desc(templateSnippets.useCount))
		.limit(limit);

	return rows.map(mapRowToSummary);
}
