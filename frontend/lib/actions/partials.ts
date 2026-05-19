"use server";

/**
 * Server Actions for Partial Template operations.
 *
 * Partials are reusable template sections that can be combined
 * to build complete templates.
 */

import { db, templatePartials } from "@/lib/db";
import { getUserContext } from "@/lib/auth-utils";
import { eq, desc, asc, ilike, and, or, sql, SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import type {
  TemplatePartial,
  PartialUsage,
  SnippetPlaceholder,
  CreatePartialInput,
  UpdatePartialInput,
  PartialId,
} from "@/lib/types/snippets";
import type { DocumentContent } from "@/lib/types/document";
import { substitutePlaceholders } from "@/lib/placeholders/substitution";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current tenant context from session.
 */
async function getCurrentPartialContext(): Promise<{
  userId: string;
  organizationId: string;
}> {
  const context = await getUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }
  if (!context.organizationId) {
    throw new Error("No organization context");
  }
  return {
    userId: context.userId,
    organizationId: context.organizationId,
  };
}

/**
 * Predicate for partials readable by the current tenant.
 */
function visiblePartialCondition(context: { userId: string; organizationId: string }): SQL {
  return or(
    and(
      eq(templatePartials.createdBy, context.userId),
      eq(templatePartials.organizationId, context.organizationId)
    ),
    eq(templatePartials.organizationId, context.organizationId)
  )!;
}

/**
 * Predicate for partials mutable by the current creator within the current tenant.
 */
function mutablePartialCondition(
  id: PartialId,
  context: { userId: string; organizationId: string }
): SQL {
  return and(
    eq(templatePartials.id, id),
    eq(templatePartials.createdBy, context.userId),
    eq(templatePartials.organizationId, context.organizationId)
  )!;
}

/**
 * Map database row to TemplatePartial type.
 */
function mapRowToPartial(row: typeof templatePartials.$inferSelect): TemplatePartial {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    content: row.content as DocumentContent,
    placeholders: (row.placeholders as SnippetPlaceholder[]) || [],
    usage: (row.usage as PartialUsage) || { templateIds: [], useCount: 0 },
    createdBy: row.createdBy,
    organizationId: row.organizationId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================================================
// Partial CRUD
// ============================================================================

/**
 * List all partials.
 */
export async function listPartials(
  params?: {
    search?: string;
    createdBy?: string;
    sortBy?: "createdAt" | "updatedAt" | "name" | "useCount";
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<{ partials: TemplatePartial[]; total: number }> {
  const context = await getCurrentPartialContext();

  const conditions: SQL[] = [];

  // Show partials from this tenant only.
  conditions.push(visiblePartialCondition(context));

  if (params?.search) {
    conditions.push(
      or(
        ilike(templatePartials.name, `%${params.search}%`),
        ilike(templatePartials.description, `%${params.search}%`)
      )!
    );
  }

  if (params?.createdBy) {
    conditions.push(eq(templatePartials.createdBy, params.createdBy));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order by
  const sortColumn = {
    createdAt: templatePartials.createdAt,
    updatedAt: templatePartials.updatedAt,
    name: templatePartials.name,
    useCount: sql<number>`(${templatePartials.usage}->>'useCount')::int`,
  }[params?.sortBy ?? "updatedAt"];

  const orderFn = params?.sortOrder === "asc" ? asc : desc;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(templatePartials)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(params?.limit ?? 50)
      .offset(params?.offset ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(templatePartials)
      .where(whereClause),
  ]);

  return {
    partials: rows.map(mapRowToPartial),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * Get a single partial by ID.
 */
export async function getPartial(id: PartialId): Promise<TemplatePartial | null> {
  const context = await getCurrentPartialContext();

  const rows = await db
    .select()
    .from(templatePartials)
    .where(and(
      eq(templatePartials.id, id),
      visiblePartialCondition(context)
    ))
    .limit(1);

  if (rows.length === 0) return null;
  return mapRowToPartial(rows[0]);
}

/**
 * Create a new partial.
 */
export async function createPartial(
  input: CreatePartialInput
): Promise<TemplatePartial> {
  const context = await getCurrentPartialContext();

  const [row] = await db
    .insert(templatePartials)
    .values({
      id: nanoid(),
      name: input.name,
      description: input.description,
      content: input.content,
      placeholders: input.placeholders || [],
      usage: { templateIds: [], useCount: 0 },
      createdBy: context.userId,
      organizationId: context.organizationId,
    })
    .returning();

  revalidatePath("/partials");
  return mapRowToPartial(row);
}

/**
 * Update an existing partial.
 */
export async function updatePartial(
  id: PartialId,
  input: UpdatePartialInput
): Promise<TemplatePartial | null> {
  const context = await getCurrentPartialContext();

  // Check existence and ownership
  const existing = await db
    .select()
    .from(templatePartials)
    .where(mutablePartialCondition(id, context))
    .limit(1);

  if (existing.length === 0) return null;

  const updateData: Partial<typeof templatePartials.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.placeholders !== undefined)
    updateData.placeholders = input.placeholders;

  const [updated] = await db
    .update(templatePartials)
    .set(updateData)
    .where(mutablePartialCondition(id, context))
    .returning();

  revalidatePath("/partials");
  return mapRowToPartial(updated);
}

/**
 * Delete a partial.
 */
export async function deletePartial(id: PartialId): Promise<boolean> {
  const context = await getCurrentPartialContext();

  // Check existence and ownership
  const existing = await db
    .select()
    .from(templatePartials)
    .where(mutablePartialCondition(id, context))
    .limit(1);

  if (existing.length === 0) return false;

  const result = await db
    .delete(templatePartials)
    .where(mutablePartialCondition(id, context))
    .returning({ id: templatePartials.id });

  revalidatePath("/partials");
  return result.length > 0;
}

// ============================================================================
// Partial Combinations
// ============================================================================

/**
 * Get partials by their IDs.
 */
export async function getPartialsByIds(ids: PartialId[]): Promise<TemplatePartial[]> {
  if (ids.length === 0) return [];

  const context = await getCurrentPartialContext();

  const rows = await db
    .select()
    .from(templatePartials)
    .where(
      and(
        sql`${templatePartials.id} = ANY(${ids})`,
        visiblePartialCondition(context)
      )
    );

  return rows.map(mapRowToPartial);
}

/**
 * Combine multiple partials into a single content structure.
 * Supports two modes:
 * - "sequential": Partials are concatenated in order
 * - "interleaved": Partials are merged/interleaved (for structured content)
 */
export async function combinePartials(
  partialIds: PartialId[],
  mode: "sequential" | "interleaved" = "sequential",
  options?: {
    placeholderValues?: Record<string, string | number | boolean | string[]>;
    separator?: DocumentContent;
  }
): Promise<DocumentContent> {
  const partials = await getPartialsByIds(partialIds);

  if (partials.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  if (partials.length === 1) {
    return partials[0].content;
  }

  if (mode === "sequential") {
    // Combine content sequentially
    const combined: DocumentContent["content"] = [];

    partials.forEach((partial, index) => {
      // Add separator between partials (except before first)
      if (index > 0 && options?.separator) {
        combined.push(...(options.separator.content || []));
      }

      // Add partial content (handle both doc and direct content)
      const content = partial.content.content || [];
      combined.push(...content);
    });

    return { type: "doc", content: combined };
  } else {
    // Interleaved mode - merge based on content structure
    // This is more complex and depends on your content structure
    const mergedContent: DocumentContent["content"] = [];

    // Group content by type (headings, paragraphs, etc.)
    const contentByType = new Map<string, DocumentContent["content"]>()
;

    partials.forEach((partial) => {
      const content = partial.content.content || [];
      content.forEach((node) => {
        const type = node.type || "default";
        if (!contentByType.has(type)) {
          contentByType.set(type, []);
        }
        contentByType.get(type)?.push(node);
      });
    });

    // Merge in type order
    contentByType.forEach((nodes) => {
      if (nodes) {
        mergedContent.push(...nodes);
      }
    });

    return { type: "doc", content: mergedContent };
  }
}

/**
 * Apply placeholder values to partial content.
 */
export async function applyPartialPlaceholders(
  partialId: PartialId,
  placeholderValues: Record<string, string | number | boolean | string[]>
): Promise<DocumentContent | null> {
  const partial = await getPartial(partialId);
  if (!partial) return null;

  return substitutePlaceholders(partial.content, placeholderValues).content;
}

// ============================================================================
// Partial Usage Tracking
// ============================================================================

/**
 * Track that a partial is being used by a template.
 */
export async function trackPartialUsage(
  partialId: PartialId,
  templateId: string
): Promise<void> {
  const context = await getCurrentPartialContext();
  const rows = await db
    .select()
    .from(templatePartials)
    .where(and(
      eq(templatePartials.id, partialId),
      visiblePartialCondition(context)
    ))
    .limit(1);

  if (rows.length === 0) return;

  const usage = (rows[0].usage as PartialUsage) || { templateIds: [], useCount: 0 };
  if (!usage.templateIds.includes(templateId)) {
    usage.templateIds.push(templateId);
  }
  usage.useCount = (usage.useCount || 0) + 1;

  await db
    .update(templatePartials)
    .set({
      usage,
      updatedAt: new Date(),
    })
    .where(and(
      eq(templatePartials.id, partialId),
      visiblePartialCondition(context)
    ));
}

/**
 * Get partials that aren't used in any templates.
 */
export async function getUnusedPartials(): Promise<TemplatePartial[]> {
  const context = await getCurrentPartialContext();

  const rows = await db
    .select()
    .from(templatePartials)
    .where(
      and(
        sql`(${templatePartials.usage}->>'useCount')::int = 0 OR ${templatePartials.usage}->>'useCount' IS NULL`,
        visiblePartialCondition(context)
      )
    )
    .orderBy(desc(templatePartials.createdAt));

  return rows.map(mapRowToPartial);
}

/**
 * Get the templates that use a specific partial.
 */
export async function getPartialUsages(
  partialId: PartialId
): Promise<{ templateId: string; useCount: number }[]> {
  const partial = await getPartial(partialId);
  if (!partial) return [];

  return partial.usage.templateIds.map((id) => ({
    templateId: id,
    useCount: partial.usage.useCount,
  }));
}

/**
 * Search partials by query string.
 */
export async function searchPartials(
  query: string,
  limit = 20
): Promise<TemplatePartial[]> {
  const context = await getCurrentPartialContext();
  const searchTerm = `%${query}%`;

  const rows = await db
    .select()
    .from(templatePartials)
    .where(
      and(
        or(
          ilike(templatePartials.name, searchTerm),
          ilike(templatePartials.description, searchTerm)
        )!,
        visiblePartialCondition(context)
      )
    )
    .orderBy(templatePartials.name)
    .limit(limit);

  return rows.map(mapRowToPartial);
}
