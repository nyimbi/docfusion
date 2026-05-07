"use server";

/**
 * Server Actions for Template operations.
 *
 * Templates provide pre-structured documents with placeholders,
 * AI prompts, and compliance requirements.
 */

import { db, templates, templateCategories, documents } from "@/lib/db";
import { eq, desc, asc, ilike, or, and, sql, SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
	Template,
	TemplateSummary,
	TemplateCategory,
	TemplateListParams,
	TemplateListResponse,
	CreateTemplateInput,
	UpdateTemplateInput,
	UseTemplateInput,
} from "@/lib/types/template";
import type { Document, DocumentContent } from "@/lib/types/document";
import { getCurrentUserId } from "@/lib/auth-utils";
import { substitutePlaceholders } from "@/lib/placeholders/substitution";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database row to Template type.
 */
function mapRowToTemplate(row: typeof templates.$inferSelect): Template {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		content: row.content as DocumentContent,
		status: row.status as Template["status"],
		visibility: row.visibility as Template["visibility"],
		createdBy: row.createdBy,
		categoryIds: (row.categoryIds as string[]) || [],
		tags: (row.tags as string[]) || [],
		placeholders: (row.placeholders as Template["placeholders"]) || [],
		aiInstructions: (row.aiInstructions as Template["aiInstructions"]) || [],
		complianceRequirements: (row.complianceRequirements as Template["complianceRequirements"]) || [],
		useCount: row.useCount,
		rating: row.rating ?? undefined,
		ratingCount: row.ratingCount,
		previewImageUrl: row.previewImageUrl ?? undefined,
		estimatedTime: row.estimatedTime ?? undefined,
		difficulty: row.difficulty as Template["difficulty"],
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		defaultMetadata: row.defaultMetadata as Template["defaultMetadata"],
	};
}

/**
 * Map database row to TemplateSummary type.
 */
function mapRowToSummary(row: typeof templates.$inferSelect): TemplateSummary {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		status: row.status as TemplateSummary["status"],
		visibility: row.visibility as TemplateSummary["visibility"],
		categoryIds: (row.categoryIds as string[]) || [],
		tags: (row.tags as string[]) || [],
		useCount: row.useCount,
		rating: row.rating ?? undefined,
		ratingCount: row.ratingCount,
		previewImageUrl: row.previewImageUrl ?? undefined,
		estimatedTime: row.estimatedTime ?? undefined,
		difficulty: row.difficulty as TemplateSummary["difficulty"],
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/**
 * Map database row to TemplateCategory type.
 */
function mapRowToCategory(row: typeof templateCategories.$inferSelect, templateCount = 0): TemplateCategory {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		slug: row.slug,
		parentId: row.parentId ?? undefined,
		templateCount,
		icon: row.icon ?? undefined,
		order: row.order,
	};
}

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * List templates with filtering, sorting, and pagination.
 */
export async function listTemplates(
	params: TemplateListParams = {}
): Promise<TemplateListResponse> {
	const {
		status,
		visibility,
		categoryId,
		tags,
		difficulty,
		search,
		sortBy = "useCount",
		sortOrder = "desc",
		offset = 0,
		limit = 12,
	} = params;

	// Build where conditions
	const conditions: SQL[] = [];

	// Only show published templates by default
	if (status) {
		conditions.push(eq(templates.status, status));
	} else {
		conditions.push(eq(templates.status, "published"));
	}

	if (visibility) {
		conditions.push(eq(templates.visibility, visibility));
	}
	if (difficulty) {
		conditions.push(eq(templates.difficulty, difficulty));
	}
	if (search) {
		conditions.push(
			or(
				ilike(templates.name, `%${search}%`),
				ilike(templates.description, `%${search}%`)
			)!
		);
	}
	// Note: Category and tag filtering with JSONB would need custom SQL

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Build order by
	const sortColumn = {
		createdAt: templates.createdAt,
		updatedAt: templates.updatedAt,
		name: templates.name,
		useCount: templates.useCount,
		rating: templates.rating,
	}[sortBy] || templates.useCount;

	const orderFn = sortOrder === "asc" ? asc : desc;

	// Execute queries
	const [rows, countResult] = await Promise.all([
		db
			.select()
			.from(templates)
			.where(whereClause)
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(templates)
			.where(whereClause),
	]);

	const total = Number(countResult[0]?.count || 0);

	return {
		templates: rows.map(mapRowToSummary),
		total,
		offset,
		limit,
		hasMore: offset + rows.length < total,
	};
}

/**
 * Get a single template by ID.
 */
export async function getTemplate(id: string): Promise<Template | null> {
	const rows = await db
		.select()
		.from(templates)
		.where(eq(templates.id, id))
		.limit(1);

	if (rows.length === 0) return null;
	return mapRowToTemplate(rows[0]);
}

/**
 * Create a new template.
 */
export async function createTemplate(
	input: CreateTemplateInput
): Promise<Template> {
	// Get authenticated user
	const userId = await getCurrentUserId() || "anonymous";

	const [row] = await db
		.insert(templates)
		.values({
			name: input.name,
			description: input.description,
			content: input.content,
			visibility: input.visibility || "private",
			categoryIds: input.categoryIds || [],
			tags: input.tags || [],
			placeholders: input.placeholders || [],
			aiInstructions: input.aiInstructions || [],
			complianceRequirements: input.complianceRequirements || [],
			previewImageUrl: input.previewImageUrl,
			estimatedTime: input.estimatedTime,
			difficulty: input.difficulty,
			defaultMetadata: input.defaultMetadata,
			createdBy: userId,
		})
		.returning();

	revalidatePath("/templates");
	return mapRowToTemplate(row);
}

/**
 * Update an existing template.
 */
export async function updateTemplate(
	id: string,
	input: UpdateTemplateInput
): Promise<Template | null> {
	const current = await getTemplate(id);
	if (!current) return null;

	const updateData: Partial<typeof templates.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.name !== undefined) updateData.name = input.name;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.content !== undefined) updateData.content = input.content;
	if (input.status !== undefined) updateData.status = input.status;
	if (input.visibility !== undefined) updateData.visibility = input.visibility;
	if (input.categoryIds !== undefined) updateData.categoryIds = input.categoryIds;
	if (input.tags !== undefined) updateData.tags = input.tags;
	if (input.placeholders !== undefined) updateData.placeholders = input.placeholders;
	if (input.aiInstructions !== undefined) updateData.aiInstructions = input.aiInstructions;
	if (input.complianceRequirements !== undefined) updateData.complianceRequirements = input.complianceRequirements;
	if (input.previewImageUrl !== undefined) updateData.previewImageUrl = input.previewImageUrl;
	if (input.estimatedTime !== undefined) updateData.estimatedTime = input.estimatedTime;
	if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;
	if (input.defaultMetadata !== undefined) updateData.defaultMetadata = input.defaultMetadata;

	const [row] = await db
		.update(templates)
		.set(updateData)
		.where(eq(templates.id, id))
		.returning();

	revalidatePath("/templates");
	revalidatePath(`/templates/${id}`);
	return mapRowToTemplate(row);
}

/**
 * Delete a template.
 */
export async function deleteTemplate(id: string): Promise<boolean> {
	const result = await db
		.delete(templates)
		.where(eq(templates.id, id))
		.returning({ id: templates.id });

	revalidatePath("/templates");
	return result.length > 0;
}

// ============================================================================
// Template Categories
// ============================================================================

/**
 * List all template categories.
 */
export async function listTemplateCategories(): Promise<TemplateCategory[]> {
	const rows = await db
		.select()
		.from(templateCategories)
		.orderBy(asc(templateCategories.order), asc(templateCategories.name));

	// Get template counts per category
	// In a real implementation, we'd join or aggregate this
	return rows.map((row) => mapRowToCategory(row, 0));
}

/**
 * Create a template category.
 */
export async function createTemplateCategory(
	name: string,
	slug: string,
	description?: string,
	parentId?: string,
	icon?: string
): Promise<TemplateCategory> {
	const [row] = await db
		.insert(templateCategories)
		.values({
			name,
			slug,
			description,
			parentId,
			icon,
		})
		.returning();

	revalidatePath("/templates");
	return mapRowToCategory(row, 0);
}

// ============================================================================
// Use Template (Create Document from Template)
// ============================================================================

/**
 * Apply placeholder values to template content.
 */
function applyPlaceholders(
	content: DocumentContent,
	placeholderValues: Record<string, string | number | boolean | string[]>
): DocumentContent {
	return substitutePlaceholders(content, placeholderValues).content;
}

/**
 * Create a document from a template.
 */
export async function useTemplate(
	input: UseTemplateInput
): Promise<Document> {
	const template = await getTemplate(input.templateId);
	if (!template) {
		throw new Error(`Template not found: ${input.templateId}`);
	}

	// Apply placeholder values to content
	const content = applyPlaceholders(template.content, input.placeholderValues);

	// Extract plain text for search
	const extractPlainText = (node: DocumentContent): string => {
		if (node.type === "text" && node.text) return node.text;
		if (node.content && Array.isArray(node.content)) {
			return node.content.map(extractPlainText).join(" ");
		}
		return "";
	};
	const plainText = extractPlainText(content).trim();

	// Get authenticated user
	const userId = await getCurrentUserId() || "anonymous";

	// Create the document
	const [row] = await db
		.insert(documents)
		.values({
			title: input.title,
			content,
			plainText,
			wordCount: plainText.split(/\s+/).filter((w) => w.length > 0).length,
			characterCount: plainText.length,
			templateId: template.id,
			metadata: template.defaultMetadata,
			ownerId: userId,
		})
		.returning();

	// Increment template use count
	await db
		.update(templates)
		.set({ useCount: template.useCount + 1 })
		.where(eq(templates.id, template.id));

	revalidatePath("/documents");
	revalidatePath("/templates");

	return {
		id: row.id,
		title: row.title,
		content: row.content as DocumentContent,
		plainText: row.plainText ?? undefined,
		status: row.status as Document["status"],
		visibility: row.visibility as Document["visibility"],
		ownerId: row.ownerId,
		templateId: row.templateId ?? undefined,
		tags: (row.tags as string[]) || [],
		wordCount: row.wordCount,
		characterCount: row.characterCount,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		lastAccessedAt: row.lastAccessedAt?.toISOString(),
		currentVersion: row.currentVersion,
		collaboratorIds: (row.collaboratorIds as string[]) || [],
		metadata: row.metadata as Document["metadata"],
	};
}

// ============================================================================
// Search
// ============================================================================

/**
 * Search templates by query string.
 */
export async function searchTemplates(
	query: string,
	limit = 20
): Promise<TemplateSummary[]> {
	const rows = await db
		.select()
		.from(templates)
		.where(
			and(
				eq(templates.status, "published"),
				or(
					ilike(templates.name, `%${query}%`),
					ilike(templates.description, `%${query}%`)
				)
			)
		)
		.orderBy(desc(templates.useCount))
		.limit(limit);

	return rows.map(mapRowToSummary);
}
