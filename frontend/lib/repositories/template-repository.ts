/**
 * Template Repository - DocFusion
 *
 * Data access layer for the `templates` and `templateCategories` tables.
 *
 * Query patterns mirrored from `actions/templates.ts`:
 * - Category listing with per-category template counts (JSONB array expansion)
 * - Template listing with search, category, difficulty, visibility, tag filters
 * - Sort by popular / newest / rating / name
 * - Aggregate statistics (total, published, draft, archived, uses, avg rating)
 * - Tag extraction from published templates
 * - Template duplication
 * - Use count and rating updates
 */

import {
	SQL,
	and,
	eq,
	desc,
	asc,
	sql,
	count,
} from "drizzle-orm";
import { templates, templateCategories } from "@/lib/db/schema";
import { BaseRepository, type PaginatedResult } from "./base-repository";

// ============================================================================
// Types
// ============================================================================

type TemplateRow = typeof templates.$inferSelect;
type TemplateInsert = typeof templates.$inferInsert;
type TemplateCategoryRow = typeof templateCategories.$inferSelect;

export interface TemplateFilters {
	status?: string;
	search?: string;
	categoryId?: string;
	difficulty?: string;
	visibility?: string;
	tags?: string[];
}

export interface TemplateStats {
	total: number;
	published: number;
	draft: number;
	archived: number;
	totalUses: number;
	avgRating: number;
	categoriesCount: number;
}

// ============================================================================
// Repository
// ============================================================================

export class TemplateRepository extends BaseRepository<
	typeof templates,
	TemplateRow,
	TemplateInsert
> {
	constructor() {
		super(templates);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Categories
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * All categories with per-category published template counts.
	 * Mirrors `getTemplateCategories`.
	 */
	async getCategories(): Promise<(TemplateCategoryRow & { templateCount: number })[]> {
		const rows = await this.db
			.select({
				id: templateCategories.id,
				name: templateCategories.name,
				description: templateCategories.description,
				slug: templateCategories.slug,
				parentId: templateCategories.parentId,
				icon: templateCategories.icon,
				order: templateCategories.order,
				createdAt: templateCategories.createdAt,
			})
			.from(templateCategories)
			.orderBy(asc(templateCategories.order), asc(templateCategories.name));

		const categoryCounts = await this.db
			.select({
				categoryId: sql<string>`jsonb_array_elements_text(${templates.categoryIds})`,
				count: sql<number>`count(*)::int`,
			})
			.from(templates)
			.where(eq(templates.status, "published"))
			.groupBy(sql`jsonb_array_elements_text(${templates.categoryIds})`);

		const countMap = new Map(categoryCounts.map((c: { categoryId: string; count: number }) => [c.categoryId, c.count]));

		return rows.map((row: any) => ({
			...row,
			templateCount: countMap.get(row.id) ?? 0,
		}));
	}

	/**
	 * Single category by ID with template count.
	 * Mirrors `getTemplateCategory`.
	 */
	async getCategoryById(id: string): Promise<(TemplateCategoryRow & { templateCount: number }) | null> {
		const [row] = await this.db
			.select()
			.from(templateCategories)
			.where(eq(templateCategories.id, id));

		if (!row) return null;

		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(templates)
			.where(
				and(
					eq(templates.status, "published"),
					sql`${templates.categoryIds} @> ${JSON.stringify([id])}`,
				),
			);

		return { ...row, templateCount: countResult?.count ?? 0 };
	}

	// ──────────────────────────────────────────────────────────────────────
	// Template listing with filters
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Filtered, sorted, paginated template listing.
	 * Mirrors `getTemplates`.
	 */
	async findByCategory(categoryId: string): Promise<TemplateRow[]> {
		return this.db
			.select()
			.from(templates)
			.where(
				and(
					eq(templates.status, "published"),
					sql`${templates.categoryIds} @> ${JSON.stringify([categoryId])}`,
				),
			)
			.orderBy(desc(templates.useCount));
	}

	/**
	 * Templates filtered by type/status.
	 * Mirrors status-based filtering in `getTemplates`.
	 */
	async findByType(status: string): Promise<TemplateRow[]> {
		return this.db
			.select()
			.from(templates)
			.where(eq(templates.status, status))
			.orderBy(desc(templates.useCount));
	}

	/**
	 * Full filtered listing with pagination.
	 * Mirrors `getTemplates` with all filter/sort/pagination options.
	 */
	async findWithFilters(
		filters?: TemplateFilters,
		sortBy: "popular" | "newest" | "rating" | "name" = "popular",
		page: number = 1,
		pageSize: number = 50,
	): Promise<PaginatedResult<TemplateRow>> {
		const conditions: SQL[] = [];

		// Status filter (default: published)
		if (filters?.status) {
			conditions.push(eq(templates.status, filters.status));
		} else {
			conditions.push(eq(templates.status, "published"));
		}

		// Text search across name, description, tags
		if (filters?.search) {
			const searchTerm = `%${filters.search}%`;
			conditions.push(
				sql`(
					${templates.name} ILIKE ${searchTerm} OR
					${templates.description} ILIKE ${searchTerm} OR
					EXISTS (
						SELECT 1 FROM jsonb_array_elements_text(${templates.tags}) AS tag
						WHERE tag ILIKE ${searchTerm}
					)
				)`,
			);
		}

		// Category filter (JSONB @> containment)
		if (filters?.categoryId) {
			conditions.push(
				sql`${templates.categoryIds} @> ${JSON.stringify([filters.categoryId])}`,
			);
		}

		if (filters?.difficulty) {
			conditions.push(eq(templates.difficulty, filters.difficulty));
		}

		if (filters?.visibility) {
			conditions.push(eq(templates.visibility, filters.visibility));
		}

		// Tags filter (JSONB ?| operator)
		if (filters?.tags?.length) {
			conditions.push(
				sql`${templates.tags} ?| array[${sql.join(
					filters.tags.map((t) => sql`${t}`),
					sql`, `,
				)}]`,
			);
		}

		// Sort
		const orderByMap: Record<string, SQL> = {
			popular: desc(templates.useCount),
			newest: desc(templates.createdAt),
			rating: desc(templates.rating),
			name: asc(templates.name),
		};
		const orderBy = orderByMap[sortBy] ?? desc(templates.useCount);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(templates)
			.where(whereClause);

		const total = countResult?.count ?? 0;

		const rows = await this.db
			.select()
			.from(templates)
			.where(whereClause)
			.orderBy(orderBy)
			.limit(pageSize)
			.offset((page - 1) * pageSize);

		return this.buildPaginatedResult(rows, total, page, pageSize);
	}

	// ──────────────────────────────────────────────────────────────────────
	// Aggregates
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Aggregate statistics across all templates.
	 * Mirrors `getTemplateStats`.
	 */
	async getStats(): Promise<TemplateStats> {
		const [stats] = await this.db
			.select({
				total: sql<number>`count(*)::int`,
				published: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'published')::int`,
				draft: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'draft')::int`,
				archived: sql<number>`count(*) FILTER (WHERE ${templates.status} = 'archived')::int`,
				totalUses: sql<number>`coalesce(sum(${templates.useCount}), 0)::int`,
				avgRating: sql<number>`coalesce(avg(${templates.rating}) FILTER (WHERE ${templates.rating} IS NOT NULL), 0)::float`,
			})
			.from(templates);

		const [categoryCount] = await this.db
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

	/**
	 * All unique tags from published templates.
	 * Mirrors `getAllTemplateTags`.
	 */
	async getAllTags(): Promise<string[]> {
		const result = await this.db
			.select({
				tag: sql<string>`DISTINCT jsonb_array_elements_text(${templates.tags})`,
			})
			.from(templates)
			.where(eq(templates.status, "published"));

		return result.map((r: { tag: string }) => r.tag).sort();
	}

	// ──────────────────────────────────────────────────────────────────────
	// Mutations
	// ──────────────────────────────────────────────────────────────────────

	/**
	 * Increment the use count atomically.
	 * Mirrors `incrementTemplateUseCount`.
	 */
	async incrementUseCount(id: string): Promise<void> {
		await this.db
			.update(templates)
			.set({ useCount: sql`${templates.useCount} + 1` })
			.where(eq(templates.id, id));
	}

	/**
	 * Update template rating using a running weighted average.
	 * Mirrors `rateTemplate`.
	 */
	async updateRating(
		id: string,
		newRatingValue: number,
	): Promise<{ newRating: number; newRatingCount: number }> {
		const [template] = await this.db
			.select({ rating: templates.rating, ratingCount: templates.ratingCount })
			.from(templates)
			.where(eq(templates.id, id));

		if (!template) throw new Error("Template not found");

		const currentRating = template.rating ?? 0;
		const currentCount = template.ratingCount ?? 0;
		const newCount = currentCount + 1;
		const newRating = ((currentRating * currentCount) + newRatingValue) / newCount;

		await this.db
			.update(templates)
			.set({ rating: newRating, ratingCount: newCount, updatedAt: new Date() })
			.where(eq(templates.id, id));

		return {
			newRating: Number(newRating.toFixed(2)),
			newRatingCount: newCount,
		};
	}

	/**
	 * Duplicate a template with reset usage stats.
	 * Mirrors `duplicateTemplate`.
	 */
	async duplicate(
		id: string,
		options?: { newName?: string; createdBy?: string },
	): Promise<TemplateRow | null> {
		const original = await this.findById(id);
		if (!original) return null;

		const [duplicated] = await this.db
			.insert(templates)
			.values({
				name: options?.newName ?? `${original.name} (Copy)`,
				description: original.description,
				content: original.content,
				status: "draft",
				visibility: "private",
				createdBy: options?.createdBy ?? original.createdBy,
				categoryIds: original.categoryIds,
				tags: original.tags,
				placeholders: original.placeholders,
				aiInstructions: original.aiInstructions,
				complianceRequirements: original.complianceRequirements,
				previewImageUrl: original.previewImageUrl,
				estimatedTime: original.estimatedTime,
				difficulty: original.difficulty,
				defaultMetadata: original.defaultMetadata,
				useCount: 0,
				rating: null,
				ratingCount: 0,
			})
			.returning();

		return duplicated ?? null;
	}
}
