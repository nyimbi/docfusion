"use server";

/**
 * Server Actions for Template Editor operations.
 *
 * Handles template editing, versioning, and edit history tracking.
 */

import { db, templates, templateEdits, templateVersions } from "@/lib/db";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  TemplateEdit,
  EditChanges,
  EditType,
  TemplateVersionHistory,
  FieldChange,
  SnippetPlaceholder,
} from "@/lib/types/snippets";
import type { DocumentContent } from "@/lib/types/document";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user ID from session.
 */
async function getCurrentUserId(): Promise<string> {
  return "system";
}

/**
 * Get next version number for a template.
 */
async function getNextVersionNumber(templateId: string): Promise<number> {
  const result = await db
    .select({ maxVersion: templateVersions.versionNumber })
    .from(templateVersions)
    .where(eq(templateVersions.templateId, templateId))
    .orderBy(desc(templateVersions.versionNumber))
    .limit(1);

  return (result[0]?.maxVersion || 0) + 1;
}

/**
 * Get current template content for comparison.
 */
async function getTemplateContent(templateId: string): Promise<DocumentContent | null> {
  const template = await db
    .select({ content: templates.content })
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1);

  return template.length > 0 ? (template[0].content as DocumentContent) : null;
}

/**
 * Map database row to TemplateEdit type.
 */
function mapRowToEdit(row: typeof templateEdits.$inferSelect): TemplateEdit {
  return {
    id: row.id,
    templateId: row.templateId,
    userId: row.userId,
    type: row.type as EditType,
    changes: row.changes as EditChanges,
    versionNumber: row.versionNumber ?? undefined,
    comment: row.comment ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Map database row to TemplateVersionHistory type.
 */
function mapRowToVersionHistory(row: typeof templateVersions.$inferSelect): TemplateVersionHistory {
  return {
    id: row.id,
    templateId: row.templateId,
    versionNumber: row.versionNumber,
    content: row.content as DocumentContent,
    placeholders: (row.placeholders as SnippetPlaceholder[]) || [],
    aiInstructions: (row.aiInstructions as unknown[]) || [],
    changeDescription: row.changeDescription ?? undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Calculate diff between two content objects.
 */
function calculateContentDiff(before: DocumentContent, after: DocumentContent): FieldChange[] {
  const changes: FieldChange[] = [];

  // Simple comparison - in production, use a proper diff algorithm
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({
      field: "content",
      before: "[Previous content]",
      after: "[New content]",
    });
  }

  return changes;
}

// ============================================================================
// Edit History Operations
// ============================================================================

/**
 * Log an edit operation on a template.
 */
export async function logTemplateEdit(
  templateId: string,
  type: EditType,
  changes: EditChanges,
  options?: {
    comment?: string;
    versionNumber?: number;
  }
): Promise<TemplateEdit> {
  const userId = await getCurrentUserId();

  const [edit] = await db
    .insert(templateEdits)
    .values({
      templateId,
      userId,
      type,
      changes,
      versionNumber: options?.versionNumber,
      comment: options?.comment,
    })
    .returning();

  return mapRowToEdit(edit);
}

/**
 * Record a template content change.
 * This should be called whenever template content is updated.
 */
export async function recordContentChange(
  templateId: string,
  newContent: DocumentContent,
  options?: {
    comment?: string;
    trackDiff?: boolean;
  }
): Promise<TemplateEdit> {
  const userId = await getCurrentUserId();

  // Get previous content for diff if tracking is enabled
  const beforeContent = options?.trackDiff ? await getTemplateContent(templateId) : undefined;
  const fieldChanges = options?.trackDiff && beforeContent
    ? calculateContentDiff(beforeContent, newContent)
    : undefined;

  const changes: EditChanges = {
    after: newContent,
    ...(beforeContent && { before: beforeContent }),
    ...(fieldChanges && { fieldChanges }),
  };

  return logTemplateEdit(templateId, "edit", changes, {
    comment: options?.comment,
  });
}

/**
 * Record template publish action.
 */
export async function recordTemplatePublish(
  templateId: string,
  options?: {
    comment?: string;
    snapshot?: boolean;
  }
): Promise<TemplateEdit> {
  const userId = await getCurrentUserId();
  const currentContent = await getTemplateContent(templateId);

  // Create a version snapshot if requested
  if (options?.snapshot !== false && currentContent) {
    await createTemplateVersion(templateId, currentContent, {
      description: options?.comment || "Published",
    });
  }

  return logTemplateEdit(
    templateId,
    "publish",
    { after: currentContent ?? undefined },
    { comment: options?.comment }
  );
}

/**
 * Get the edit history for a template.
 */
export async function getTemplateEditHistory(
  templateId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ edits: TemplateEdit[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const [edits, countResult] = await Promise.all([
    db
      .select()
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId))
      .orderBy(desc(templateEdits.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId)),
  ]);

  return {
    edits: edits.map(mapRowToEdit),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * Get a specific edit by ID.
 */
export async function getEdit(editId: string): Promise<TemplateEdit | null> {
  const edit = await db
    .select()
    .from(templateEdits)
    .where(eq(templateEdits.id, editId))
    .limit(1);

  return edit.length > 0 ? mapRowToEdit(edit[0]) : null;
}

// ============================================================================
// Template Versioning
// ============================================================================

/**
 * Create a version snapshot of a template.
 */
export async function createTemplateVersion(
  templateId: string,
  content: DocumentContent,
  options?: {
    placeholders?: unknown[];
    aiInstructions?: unknown[];
    description?: string;
  }
): Promise<TemplateVersionHistory> {
  const userId = await getCurrentUserId();
  const versionNumber = await getNextVersionNumber(templateId);

  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId,
      versionNumber,
      content,
      placeholders: options?.placeholders || [],
      aiInstructions: options?.aiInstructions || [],
      changeDescription: options?.description,
      createdBy: userId,
    })
    .returning();

  // Update the template's edit log with the version number
  await logTemplateEdit(templateId, "edit", { after: content }, {
    comment: options?.description,
    versionNumber,
  });

  return mapRowToVersionHistory(version);
}

/**
 * Get all versions of a template.
 */
export async function getTemplateVersions(
  templateId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ versions: TemplateVersionHistory[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const [versions, countResult] = await Promise.all([
    db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(desc(templateVersions.versionNumber))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId)),
  ]);

  return {
    versions: versions.map(mapRowToVersionHistory),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * Get a specific version by ID.
 */
export async function getTemplateVersion(
  templateId: string,
  versionNumber: number
): Promise<TemplateVersionHistory | null> {
  const version = await db
    .select()
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.templateId, templateId),
        eq(templateVersions.versionNumber, versionNumber)
      )
    )
    .limit(1);

  return version.length > 0 ? mapRowToVersionHistory(version[0]) : null;
}

/**
 * Revert template to a specific version.
 */
export async function revertTemplateToVersion(
  templateId: string,
  versionNumber: number,
  options?: {
    comment?: string;
  }
): Promise<TemplateVersionHistory | null> {
  const version = await getTemplateVersion(templateId, versionNumber);
  if (!version) return null;

  const userId = await getCurrentUserId();

  // Update the template with the old content
  await db
    .update(templates)
    .set({
      content: version.content,
      updatedAt: new Date(),
    })
    .where(eq(templates.id, templateId));

  // Log the revert
  await logTemplateEdit(
    templateId,
    "revert",
    {
      revertToVersion: versionNumber,
      after: version.content,
    },
    {
      comment: options?.comment || `Reverted to version ${versionNumber}`,
      versionNumber: await getNextVersionNumber(templateId),
    }
  );

  // Create a new version for the revert
  const newVersion = await createTemplateVersion(templateId, version.content, {
    placeholders: version.placeholders,
    aiInstructions: version.aiInstructions,
    description: options?.comment || `Reverted to version ${versionNumber}`,
  });

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");

  return newVersion;
}

/**
 * Compare two template versions.
 */
export async function compareTemplateVersions(
  templateId: string,
  versionA: number,
  versionB: number
): Promise<{
  versionA: TemplateVersionHistory;
  versionB: TemplateVersionHistory;
  differences: FieldChange[];
}> {
  const [verA, verB] = await Promise.all([
    getTemplateVersion(templateId, versionA),
    getTemplateVersion(templateId, versionB),
  ]);

  if (!verA || !verB) {
    throw new Error("One or both versions not found");
  }

  const differences = calculateContentDiff(verA.content, verB.content);

  return {
    versionA: verA,
    versionB: verB,
    differences,
  };
}

/**
 * Delete a template version.
 */
export async function deleteTemplateVersion(
  templateId: string,
  versionNumber: number
): Promise<boolean> {
  const result = await db
    .delete(templateVersions)
    .where(
      and(
        eq(templateVersions.templateId, templateId),
        eq(templateVersions.versionNumber, versionNumber)
      )
    )
    .returning({ id: templateVersions.id });

  return result.length > 0;
}

/**
 * Get the most recent edit for a template.
 */
export async function getLastEdit(
  templateId: string
): Promise<TemplateEdit | null> {
  const edit = await db
    .select()
    .from(templateEdits)
    .where(eq(templateEdits.templateId, templateId))
    .orderBy(desc(templateEdits.createdAt))
    .limit(1);

  return edit.length > 0 ? mapRowToEdit(edit[0]) : null;
}

/**
 * Get edit statistics for a template.
 */
export async function getTemplateEditStats(
  templateId: string
): Promise<{
  totalEdits: number;
  lastEditDate: string | null;
  editTypes: Record<string, number>;
  uniqueEditors: number;
}> {
  const [totalResult, lastEdit, typeCounts, editors] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId)),
    db
      .select({ createdAt: templateEdits.createdAt })
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId))
      .orderBy(desc(templateEdits.createdAt))
      .limit(1),
    db
      .select({
        type: templateEdits.type,
        count: sql<number>`count(*)`,
      })
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId))
      .groupBy(templateEdits.type),
    db
      .select({
        count: sql<number>`count(distinct ${templateEdits.userId})`,
      })
      .from(templateEdits)
      .where(eq(templateEdits.templateId, templateId)),
  ]);

  const editTypes: Record<string, number> = {};
  typeCounts.forEach(item => {
    editTypes[item.type] = item.count;
  });

  return {
    totalEdits: Number(totalResult[0]?.count || 0),
    lastEditDate: lastEdit[0]?.createdAt?.toISOString() || null,
    editTypes,
    uniqueEditors: Number(editors[0]?.count || 0),
  };
}