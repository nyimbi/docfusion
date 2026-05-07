/**
 * Templates Server Actions - DocFusion
 *
 * Server actions for managing document templates with database persistence.
 */

"use server";

import { db } from "@/lib/db";
import { templates, templateCategories, documents } from "@/lib/db/schema";
import { eq, and, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import type {
	TemplateSummary,
	TemplateCategory,
	Template,
	TemplateFilters,
	TemplateStatus,
	TemplateVisibility,
} from "@/lib/types/template";
import {
	substitutePlaceholders as substituteContentPlaceholders,
	substitutePlaceholdersInString as substituteStringPlaceholders,
} from "@/lib/placeholders/substitution";

// ============================================================================
// Template Categories
// ============================================================================

/**
 * Get all template categories with template counts.
 */
export async function getTemplateCategories(): Promise<TemplateCategory[]> {
	const rows = await db
		.select({
			id: templateCategories.id,
			name: templateCategories.name,
			description: templateCategories.description,
			slug: templateCategories.slug,
			parentId: templateCategories.parentId,
			icon: templateCategories.icon,
			order: templateCategories.order,
		})
		.from(templateCategories)
		.orderBy(asc(templateCategories.order), asc(templateCategories.name));

	// Get template counts per category
	const categoryCounts = await db
		.select({
			categoryId: sql<string>`jsonb_array_elements_text(${templates.categoryIds})`,
			count: sql<number>`count(*)::int`,
		})
		.from(templates)
		.where(eq(templates.status, "published"))
		.groupBy(sql`jsonb_array_elements_text(${templates.categoryIds})`);

	const countMap = new Map(categoryCounts.map((c) => [c.categoryId, c.count]));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		slug: row.slug,
		parentId: row.parentId ?? undefined,
		icon: row.icon ?? undefined,
		order: row.order,
		templateCount: countMap.get(row.id) ?? 0,
	}));
}

/**
 * Get a single category by ID.
 */
export async function getTemplateCategory(
	id: string
): Promise<TemplateCategory | null> {
	const [row] = await db
		.select()
		.from(templateCategories)
		.where(eq(templateCategories.id, id));

	if (!row) return null;

	// Get template count
	const [countResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(templates)
		.where(
			and(
				eq(templates.status, "published"),
				sql`${templates.categoryIds} @> ${JSON.stringify([id])}`
			)
		);

	return {
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		slug: row.slug,
		parentId: row.parentId ?? undefined,
		icon: row.icon ?? undefined,
		order: row.order,
		templateCount: countResult?.count ?? 0,
	};
}

// ============================================================================
// Templates List
// ============================================================================

export interface GetTemplatesOptions {
	filters?: TemplateFilters;
	sortBy?: "popular" | "newest" | "rating" | "name";
	page?: number;
	pageSize?: number;
}

export interface GetTemplatesResult {
	templates: TemplateSummary[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

/**
 * Get templates with filtering, sorting, and pagination.
 */
export async function getTemplates(
	options: GetTemplatesOptions = {}
): Promise<GetTemplatesResult> {
	const {
		filters = {},
		sortBy = "popular",
		page = 1,
		pageSize = 50,
	} = options;

	// Build conditions
	const conditions = [];

	// Only show published by default
	if (filters.status) {
		conditions.push(eq(templates.status, filters.status));
	} else {
		conditions.push(eq(templates.status, "published"));
	}

	// Search filter
	if (filters.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			sql`(
				${templates.name} ILIKE ${searchTerm} OR
				${templates.description} ILIKE ${searchTerm} OR
				EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(${templates.tags}) AS tag
					WHERE tag ILIKE ${searchTerm}
				)
			)`
		);
	}

	// Category filter
	if (filters.categoryId) {
		conditions.push(
			sql`${templates.categoryIds} @> ${JSON.stringify([filters.categoryId])}`
		);
	}

	// Difficulty filter
	if (filters.difficulty) {
		conditions.push(eq(templates.difficulty, filters.difficulty));
	}

	// Visibility filter
	if (filters.visibility) {
		conditions.push(eq(templates.visibility, filters.visibility));
	}

	// Tags filter
	if (filters.tags && filters.tags.length > 0) {
		conditions.push(
			sql`${templates.tags} ?| array[${sql.join(
				filters.tags.map((t) => sql`${t}`),
				sql`, `
			)}]`
		);
	}

	// Determine sort order
	let orderBy;
	switch (sortBy) {
		case "popular":
			orderBy = desc(templates.useCount);
			break;
		case "newest":
			orderBy = desc(templates.createdAt);
			break;
		case "rating":
			orderBy = desc(templates.rating);
			break;
		case "name":
			orderBy = asc(templates.name);
			break;
		default:
			orderBy = desc(templates.useCount);
	}

	// Get total count
	const [countResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(templates)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	const total = countResult?.count ?? 0;
	const totalPages = Math.ceil(total / pageSize);

	// Get templates
	const rows = await db
		.select({
			id: templates.id,
			name: templates.name,
			description: templates.description,
			status: templates.status,
			visibility: templates.visibility,
			categoryIds: templates.categoryIds,
			tags: templates.tags,
			useCount: templates.useCount,
			rating: templates.rating,
			ratingCount: templates.ratingCount,
			previewImageUrl: templates.previewImageUrl,
			estimatedTime: templates.estimatedTime,
			difficulty: templates.difficulty,
			createdAt: templates.createdAt,
			updatedAt: templates.updatedAt,
		})
		.from(templates)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(orderBy)
		.limit(pageSize)
		.offset((page - 1) * pageSize);

	const templateSummaries: TemplateSummary[] = rows.map((row) => ({
		id: row.id,
		name: row.name,
		description: row.description,
		status: row.status as TemplateStatus,
		visibility: row.visibility as TemplateVisibility,
		categoryIds: (row.categoryIds as string[]) ?? [],
		tags: (row.tags as string[]) ?? [],
		useCount: row.useCount,
		rating: row.rating ?? undefined,
		ratingCount: row.ratingCount,
		previewImageUrl: row.previewImageUrl ?? undefined,
		estimatedTime: row.estimatedTime ?? undefined,
		difficulty: row.difficulty as "beginner" | "intermediate" | "advanced" | undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return {
		templates: templateSummaries,
		total,
		page,
		pageSize,
		totalPages,
	};
}

// ============================================================================
// Single Template
// ============================================================================

/**
 * Get a single template by ID with full details.
 */
export async function getTemplate(id: string): Promise<Template | null> {
	const [row] = await db
		.select()
		.from(templates)
		.where(eq(templates.id, id));

	if (!row) return null;

	return {
		id: row.id,
		name: row.name,
		description: row.description,
		content: row.content as Template["content"],
		status: row.status as TemplateStatus,
		visibility: row.visibility as TemplateVisibility,
		createdBy: row.createdBy,
		categoryIds: (row.categoryIds as string[]) ?? [],
		tags: (row.tags as string[]) ?? [],
		placeholders: (row.placeholders as Template["placeholders"]) ?? [],
		aiInstructions: (row.aiInstructions as Template["aiInstructions"]) ?? [],
		complianceRequirements: (row.complianceRequirements as Template["complianceRequirements"]) ?? [],
		useCount: row.useCount,
		rating: row.rating ?? undefined,
		ratingCount: row.ratingCount,
		previewImageUrl: row.previewImageUrl ?? undefined,
		estimatedTime: row.estimatedTime ?? undefined,
		difficulty: row.difficulty as "beginner" | "intermediate" | "advanced" | undefined,
		defaultMetadata: row.defaultMetadata as Record<string, unknown> | undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/**
 * Increment the use count for a template.
 */
export async function incrementTemplateUseCount(id: string): Promise<void> {
	await db
		.update(templates)
		.set({
			useCount: sql`${templates.useCount} + 1`,
		})
		.where(eq(templates.id, id));
}

// ============================================================================
// Template Stats
// ============================================================================

export interface TemplateStats {
	total: number;
	published: number;
	draft: number;
	archived: number;
	totalUses: number;
	avgRating: number;
	categoriesCount: number;
}

/**
 * Get aggregate statistics for templates.
 */
export async function getTemplateStats(): Promise<TemplateStats> {
	const [stats] = await db
		.select({
			total: sql<number>`count(*)::int`,
			published: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'published')::int`,
			draft: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'draft')::int`,
			archived: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'archived')::int`,
			totalUses: sql<number>`coalesce(sum(${templates.useCount}), 0)::int`,
			avgRating: sql<number>`coalesce(avg(${templates.rating}) FILTER (WHERE ${templates.rating} IS NOT NULL), 0)::float`,
		})
		.from(templates);

	const [categoryCount] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(templateCategories);

	return {
		total: stats?.total ?? 0,
		published: stats?.published ?? 0,
		draft: stats?.draft ?? 0,
		archived: stats?.archived ?? 0,
		totalUses: stats?.totalUses ?? 0,
		avgRating: Number((stats?.avgRating ?? 0).toFixed(1)),
		categoriesCount: categoryCount?.count ?? 0,
	};
}

// ============================================================================
// All Tags
// ============================================================================

/**
 * Get all unique tags used across templates.
 */
export async function getAllTemplateTags(): Promise<string[]> {
	const result = await db
		.select({
			tag: sql<string>`DISTINCT jsonb_array_elements_text(${templates.tags})`,
		})
		.from(templates)
		.where(eq(templates.status, "published"));

	return result.map((r) => r.tag).sort();
}

// ============================================================================
// Template Rating
// ============================================================================

export interface RateTemplateInput {
	templateId: string;
	rating: number; // 1-5
	userId?: string;
}

export interface RateTemplateResult {
	success: boolean;
	newRating: number;
	newRatingCount: number;
}

/**
 * Rate a template. Updates the weighted average rating.
 * Rating should be between 1 and 5.
 */
export async function rateTemplate(
	input: RateTemplateInput
): Promise<RateTemplateResult> {
	const { templateId, rating } = input;

	// Validate rating range
	if (rating < 1 || rating > 5) {
		throw new Error("Rating must be between 1 and 5");
	}

	// Get current template
	const [template] = await db
		.select({
			rating: templates.rating,
			ratingCount: templates.ratingCount,
		})
		.from(templates)
		.where(eq(templates.id, templateId));

	if (!template) {
		throw new Error("Template not found");
	}

	// Calculate new weighted average
	const currentRating = template.rating ?? 0;
	const currentCount = template.ratingCount ?? 0;
	const newCount = currentCount + 1;
	const newRating = ((currentRating * currentCount) + rating) / newCount;

	// Update template
	await db
		.update(templates)
		.set({
			rating: newRating,
			ratingCount: newCount,
			updatedAt: new Date(),
		})
		.where(eq(templates.id, templateId));

	return {
		success: true,
		newRating: Number(newRating.toFixed(2)),
		newRatingCount: newCount,
	};
}

/**
 * Get user's rating for a template.
 * Returns null as individual user ratings are not currently tracked.
 * To implement: create a template_ratings table with (userId, templateId, rating).
 */
export async function getUserTemplateRating(
	templateId: string,
	userId: string
): Promise<number | null> {
	// Individual user ratings not tracked - aggregate ratings are stored on template
	return null;
}

// ============================================================================
// Create Document from Template
// ============================================================================

import type { UseTemplateInput } from "@/lib/types/template";
import { getAllTemplateVariables } from "@/lib/actions/company-variables";

export interface CreateFromTemplateResult {
	success: boolean;
	documentId: string;
	title: string;
}

/**
 * Create a new document from a template.
 * - Copies template content with placeholder substitution
 * - Resolves company and custom variables from settings
 * - Increments template use count
 * - Returns the new document ID
 */
export async function createDocumentFromTemplate(
	input: UseTemplateInput,
	userId: string = "system"
): Promise<CreateFromTemplateResult> {
	const { templateId, title, placeholderValues, useAIFill } = input;

	// Get the template
	const [template] = await db
		.select()
		.from(templates)
		.where(eq(templates.id, templateId));

	if (!template) {
		throw new Error("Template not found");
	}

	// Get all company/custom variables for substitution
	const companyVariables = await getAllTemplateVariables();

	// Merge company variables with user-provided values
	// User-provided values take precedence over company variables
	const allValues: Record<string, string | number | boolean | string[] | null> = {
		...companyVariables,
		...placeholderValues,
	};

	// Clone and process content with placeholder substitution
	let content = JSON.parse(JSON.stringify(template.content));
	content = substitutePlaceholders(content, allValues);

	// Also substitute in the title
	const processedTitle = substitutePlaceholdersInString(title, allValues);

	// Create the document
	const [newDoc] = await db
		.insert(documents)
		.values({
			title: processedTitle,
			content,
			status: "draft",
			visibility: "private",
			ownerId: userId,
			templateId: templateId,
			tags: template.tags as string[],
			metadata: {
				...(template.defaultMetadata as Record<string, unknown> || {}),
				createdFromTemplate: templateId,
				templateName: template.name,
				placeholderValues,
				useAIFill,
			},
		})
		.returning({ id: documents.id });

	// Increment template use count
	await incrementTemplateUseCount(templateId);

	return {
		success: true,
		documentId: newDoc.id,
		title: processedTitle,
	};
}

/**
 * Substitute placeholders in a single string.
 * Supports both simple {{placeholder}} and dotted {{company.name}} patterns.
 */
function substitutePlaceholdersInString(
	text: string,
	values: Record<string, string | number | boolean | string[] | null>
): string {
	return substituteStringPlaceholders(text, values).text;
}

/**
 * Recursively substitute placeholders in content.
 * Handles both string properties and nested objects/arrays.
 *
 * Supported placeholder formats:
 * - {{simple_placeholder}} - Direct key lookup
 * - {{company.name}} - Company variable (from company settings)
 * - {{company.address.city}} - Nested company variable
 * - {{company.primaryContact.email}} - Contact info
 * - {{company.legal.taxId}} - Legal/tax info
 * - {{product.ProductName.shortDescription}} - Product info
 * - {{custom.variable_name}} - Custom user-defined variable
 */
function substitutePlaceholders(
	content: unknown,
	values: Record<string, string | number | boolean | string[] | null>
): unknown {
	return substituteContentPlaceholders(content, values).content;
}

/**
 * Get available template variables for UI display.
 * Returns all company and custom variables that can be used in templates.
 */
export async function getAvailableTemplateVariables(): Promise<
	{ key: string; label: string; value: string | null; category: string }[]
> {
	const variables = await getAllTemplateVariables();

	return Object.entries(variables)
		.filter(([key]) => key.includes(".")) // Only show dotted paths
		.map(([key, value]) => {
			// Determine category from key prefix
			const category = key.split(".")[0];
			// Create human-readable label
			const label = key
				.split(".")
				.slice(1)
				.join(" > ")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());

			return {
				key: `{{${key}}}`,
				label,
				value,
				category,
			};
		})
		.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

/**
 * Duplicate an existing template.
 * Creates a copy of the template with a new name and draft status.
 */
export async function duplicateTemplate(
	templateId: string,
	options?: { newName?: string; createdBy?: string }
): Promise<Template | null> {
	const original = await getTemplate(templateId);
	if (!original) {
		return null;
	}

	const newName = options?.newName || `${original.name} (Copy)`;
	const createdBy = options?.createdBy || original.createdBy;

	const [duplicated] = await db
		.insert(templates)
		.values({
			name: newName,
			description: original.description,
			content: original.content,
			status: "draft", // Always start as draft
			visibility: "private", // Start as private
			createdBy,
			categoryIds: original.categoryIds,
			tags: original.tags,
			placeholders: original.placeholders,
			aiInstructions: original.aiInstructions,
			complianceRequirements: original.complianceRequirements,
			previewImageUrl: original.previewImageUrl,
			estimatedTime: original.estimatedTime,
			difficulty: original.difficulty,
			defaultMetadata: original.defaultMetadata,
			// Reset usage stats for the copy
			useCount: 0,
			rating: null,
			ratingCount: 0,
		})
		.returning();

	if (!duplicated) {
		return null;
	}

	// Return the full template structure
	return {
		id: duplicated.id,
		name: duplicated.name,
		description: duplicated.description,
		content: duplicated.content as Template["content"],
		status: duplicated.status as TemplateStatus,
		visibility: duplicated.visibility as TemplateVisibility,
		createdBy: duplicated.createdBy,
		categoryIds: (duplicated.categoryIds as string[]) || [],
		tags: (duplicated.tags as string[]) || [],
		placeholders: (duplicated.placeholders as Template["placeholders"]) || [],
		aiInstructions: (duplicated.aiInstructions as Template["aiInstructions"]) || [],
		complianceRequirements: (duplicated.complianceRequirements as Template["complianceRequirements"]) || [],
		useCount: duplicated.useCount,
		rating: duplicated.rating ?? undefined,
		ratingCount: duplicated.ratingCount ?? undefined,
		previewImageUrl: duplicated.previewImageUrl ?? undefined,
		estimatedTime: duplicated.estimatedTime ?? undefined,
		difficulty: duplicated.difficulty as "beginner" | "intermediate" | "advanced" | undefined,
		createdAt: duplicated.createdAt.toISOString(),
		updatedAt: duplicated.updatedAt.toISOString(),
		defaultMetadata: duplicated.defaultMetadata as Record<string, unknown> | undefined,
	};
}
