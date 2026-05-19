"use server";

/**
 * Enhanced Document Actions - DocFusion
 *
 * Server actions for document management including
 * versioning, templates, collaboration, and imports.
 */

import { db } from "@/lib/db";
import { documents, documentVersions, templates, documentCollaborators } from "@/lib/db/schema";
import { eq, desc, asc, and, or, sql, inArray, type SQL } from "drizzle-orm";
import type {
	DocumentId,
	Document,
	DocumentVersion,
	DocumentContent,
	DocumentNode,
	DocumentSummary,
	CreateDocumentInput,
	UpdateDocumentInput,
} from "@/lib/types/document";
import { generateId } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth-utils";

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

function readableDocumentCondition(id: string, userId: string): SQL {
	return and(
		eq(documents.id, id),
		or(
			eq(documents.ownerId, userId),
			eq(documents.visibility, "public"),
			sql`${documents.collaboratorIds} ? ${userId}`
		)!
	)!;
}

function writableDocumentCondition(id: string, userId: string): SQL {
	return and(
		eq(documents.id, id),
		or(
			eq(documents.ownerId, userId),
			sql`${documents.collaboratorIds} ? ${userId}`
		)!
	)!;
}

function ownedDocumentCondition(id: string, userId: string): SQL {
	return and(eq(documents.id, id), eq(documents.ownerId, userId))!;
}

async function assertReadableDocument(documentId: DocumentId, userId: string): Promise<void> {
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}
}

// ============================================================================
// Version Control
// ============================================================================

/**
 * Save a new version of a document.
 */
export async function saveDocumentVersion(
	documentId: DocumentId,
	description: string,
	content?: DocumentContent
): Promise<DocumentVersion> {
	const userId = await requireCurrentUserId();

	// Get current document
	const [doc] = await db
		.select()
		.from(documents)
		.where(writableDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	const versionContent = content ?? (doc.content as DocumentContent);

	// Create version
	const [version] = await db
		.insert(documentVersions)
		.values({
			documentId,
			versionNumber: doc.currentVersion + 1,
			content: versionContent,
			changeDescription: description,
			createdBy: userId,
		})
		.returning();

	// Update document's current version
	await db
		.update(documents)
		.set({
			currentVersion: version.versionNumber,
			updatedAt: new Date(),
		})
		.where(writableDocumentCondition(documentId, userId));

	return {
		id: version.id,
		documentId: version.documentId,
		versionNumber: version.versionNumber,
		content: version.content as DocumentContent,
		changeDescription: version.changeDescription || undefined,
		createdAt: version.createdAt.toISOString(),
		createdBy: version.createdBy,
		yjsStateVector: version.yjsStateVector
			? Buffer.from(version.yjsStateVector, "base64")
			: undefined,
	};
}

/**
 * Get all versions of a document.
 */
export async function getDocumentVersions(
	documentId: DocumentId
): Promise<DocumentVersion[]> {
	const userId = await requireCurrentUserId();
	await assertReadableDocument(documentId, userId);

	const results = await db
		.select()
		.from(documentVersions)
		.where(eq(documentVersions.documentId, documentId))
		.orderBy(desc(documentVersions.versionNumber));

	return results.map((v) => ({
		id: v.id,
		documentId: v.documentId,
		versionNumber: v.versionNumber,
		content: v.content as DocumentContent,
		changeDescription: v.changeDescription || undefined,
		createdAt: v.createdAt.toISOString(),
		createdBy: v.createdBy,
		yjsStateVector: v.yjsStateVector
			? Buffer.from(v.yjsStateVector, "base64")
			: undefined,
	}));
}

/**
 * Get a specific version.
 */
export async function getDocumentVersion(
	versionId: string
): Promise<DocumentVersion | null> {
	const userId = await requireCurrentUserId();

	const [version] = await db
		.select()
		.from(documentVersions)
		.where(eq(documentVersions.id, versionId))
		.limit(1);

	if (!version) return null;
	await assertReadableDocument(version.documentId, userId);

	return {
		id: version.id,
		documentId: version.documentId,
		versionNumber: version.versionNumber,
		content: version.content as DocumentContent,
		changeDescription: version.changeDescription || undefined,
		createdAt: version.createdAt.toISOString(),
		createdBy: version.createdBy,
		yjsStateVector: version.yjsStateVector
			? Buffer.from(version.yjsStateVector, "base64")
			: undefined,
	};
}

/**
 * Restore a document to a specific version.
 */
export async function restoreDocumentVersion(
	documentId: DocumentId,
	versionId: string
): Promise<Document> {
	const userId = await requireCurrentUserId();

	const [version] = await db
		.select()
		.from(documentVersions)
		.where(eq(documentVersions.id, versionId))
		.limit(1);

	if (!version) {
		throw new Error("Version not found");
	}

	// Update document with version content
	const [updated] = await db
		.update(documents)
		.set({
			content: version.content,
			currentVersion: version.versionNumber,
			updatedAt: new Date(),
		})
		.where(writableDocumentCondition(documentId, userId))
		.returning();

	if (!updated) {
		throw new Error("Document not found");
	}

	return mapDocument(updated);
}

/**
 * Delete a version (only if not current).
 */
export async function deleteDocumentVersion(versionId: string): Promise<void> {
	const userId = await requireCurrentUserId();

	// Don't allow deleting the current version
	const [version] = await db
		.select({
			documentId: documentVersions.documentId,
			versionNumber: documentVersions.versionNumber,
		})
		.from(documentVersions)
		.where(eq(documentVersions.id, versionId))
		.limit(1);

	if (!version) {
		throw new Error("Version not found");
	}

	const [doc] = await db
		.select({ currentVersion: documents.currentVersion })
		.from(documents)
		.where(writableDocumentCondition(version.documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	if (doc?.currentVersion === version.versionNumber) {
		throw new Error("Cannot delete current version");
	}

	await db.delete(documentVersions).where(eq(documentVersions.id, versionId));
}

/**
 * Archive a document (soft delete by setting status to "archived").
 */
export async function archiveDocument(documentId: DocumentId): Promise<Document> {
	const userId = await requireCurrentUserId();
	const [updated] = await db
		.update(documents)
		.set({
			status: "archived",
			updatedAt: new Date(),
		})
		.where(ownedDocumentCondition(documentId, userId))
		.returning();

	if (!updated) {
		throw new Error("Document not found");
	}

	return mapDocument(updated);
}

/**
 * Unarchive a document (restore status to "draft").
 */
export async function unarchiveDocument(documentId: DocumentId): Promise<Document> {
	const userId = await requireCurrentUserId();
	const [updated] = await db
		.update(documents)
		.set({
			status: "draft",
			updatedAt: new Date(),
		})
		.where(ownedDocumentCondition(documentId, userId))
		.returning();

	if (!updated) {
		throw new Error("Document not found");
	}

	return mapDocument(updated);
}

// ============================================================================
// Document Duplication
// ============================================================================

/**
 * Duplicate a document.
 */
export async function duplicateDocument(documentId: DocumentId): Promise<Document> {
	const userId = await requireCurrentUserId();
	const [original] = await db
		.select()
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	if (!original) {
		throw new Error("Document not found");
	}

	// Create new document with "Copy of" prefix
	const [newDoc] = await db
		.insert(documents)
		.values({
			title: `Copy of ${original.title}`,
			content: original.content,
			plainText: original.plainText,
			status: "draft",
			visibility: original.visibility,
			ownerId: userId,
			templateId: original.templateId,
			tags: original.tags,
			wordCount: original.wordCount,
			characterCount: original.characterCount,
			metadata: original.metadata,
		})
		.returning();

	return mapDocument(newDoc);
}

// ============================================================================
// Template Application
// ============================================================================

export type TemplateApplyMode = "replace" | "append" | "interleave";

/**
 * Apply a template to a document.
 */
export async function applyTemplateToDocument(
	documentId: DocumentId,
	templateId: string,
	mode: TemplateApplyMode = "append"
): Promise<Document> {
	const userId = await requireCurrentUserId();
	const [doc] = await db
		.select()
		.from(documents)
		.where(writableDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	const [template] = await db
		.select()
		.from(templates)
		.where(eq(templates.id, templateId))
		.limit(1);

	if (!template) {
		throw new Error("Template not found");
	}

	const templateContent = template.content as DocumentContent | null;
	const docContent = doc.content as DocumentContent;

	let finalContent: DocumentContent;

	switch (mode) {
		case "replace":
			finalContent = {
				type: "doc",
				content: templateContent?.content ?? [],
			};
			break;

		case "append":
			finalContent = {
				type: "doc",
				content: [
					...(docContent.content ?? []),
					...(templateContent?.content ?? []),
				],
			};
			break;

		case "interleave":
			// Interleave content - merge headers and sections
			finalContent = interleaveContent(docContent, templateContent);
			break;

		default:
			finalContent = docContent;
	}

	// Update document
	const [updated] = await db
		.update(documents)
		.set({
			content: finalContent,
			templateId,
			updatedAt: new Date(),
		})
		.where(writableDocumentCondition(documentId, userId))
		.returning();

	return mapDocument(updated);
}

/**
 * Interleave document and template content.
 * This is a simplified implementation that merges headings and paragraphs.
 */
function interleaveContent(
	doc: DocumentContent,
	template: DocumentContent | null
): DocumentContent {
	if (!template) return doc;

	// Get headings from both documents
	const docHeadings = (doc.content ?? []).filter(
		(item) => item.type === "heading"
	);
	const templateHeadings = (template.content ?? []).filter(
		(item) => item.type === "heading"
	);

	// Merge content, using template structure but keeping doc content
	const merged: DocumentNode[] = [];

	templateHeadings.forEach((templateHeading) => {
		// Find matching heading in doc
		const title = (templateHeading.content?.[0] as { text?: string })?.text;
		const docHeading = docHeadings.find(
			(h) => ((h.content?.[0] as { text?: string })?.text ?? "").toLowerCase() === (title ?? "").toLowerCase()
		);

		if (docHeading) {
			// Use doc content for this section
			merged.push(docHeading);
			// Add content until next heading
			const startIdx = doc.content?.indexOf(docHeading) ?? -1;
			if (startIdx !== -1) {
				for (let i = startIdx + 1; i < (doc.content?.length ?? 0); i++) {
					const item = doc.content?.[i];
					if (!item) continue;
					if ((item as { type?: string })?.type === "heading") break;
					merged.push(item);
				}
			}
		} else {
			// Use template heading
			merged.push(templateHeading);
		}
	});

	// Add remaining doc content that's not in template
	docHeadings.forEach((heading) => {
		const title = (heading.content?.[0] as { text?: string })?.text;
		const exists = templateHeadings.some(
			(h) => ((h.content?.[0] as { text?: string })?.text ?? "").toLowerCase() === (title ?? "").toLowerCase()
		);

		if (!exists) {
			// Add this section to merged content
			merged.push(heading);
			const startIdx = doc.content?.indexOf(heading) ?? -1;
			if (startIdx !== -1) {
				for (let i = startIdx + 1; i < (doc.content?.length ?? 0); i++) {
					const item = doc.content?.[i];
					if (!item) continue;
					if ((item as { type?: string })?.type === "heading") break;
					merged.push(item);
				}
			}
		}
	});

	return {
		type: "doc",
		content: merged,
	};
}

// ============================================================================
// Template Operations
// ============================================================================

/**
 * Convert a document to a template.
 */
export async function convertDocumentToTemplate(
	documentId: DocumentId,
	name: string,
	options?: {
		description?: string;
		categoryIds?: string[];
		tags?: string[];
	}
): Promise<{ id: string; name: string }> {
	const userId = await requireCurrentUserId();
	const [doc] = await db
		.select()
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	const [template] = await db
		.insert(templates)
		.values({
			name,
			description: options?.description ?? "",
			content: doc.content,
			visibility: "team",
			createdBy: userId,
			categoryIds: options?.categoryIds ?? [],
			tags: options?.tags ?? [],
			status: "draft",
		})
		.returning();

	await db.update(documents)
		.set({ templateId: template.id, updatedAt: new Date() })
		.where(eq(documents.id, documentId));

	return { id: template.id, name: template.name };
}

// ============================================================================
// Collaboration
// ============================================================================

/**
 * Invite a collaborator to a document.
 */
export async function inviteCollaborator(
	documentId: DocumentId,
	userId: string,
	role: "editor" | "viewer" | "commenter" = "viewer"
): Promise<void> {
	const currentUserId = await requireCurrentUserId();
	await assertOwnedDocument(documentId, currentUserId);

	await db.insert(documentCollaborators).values({
		documentId,
		userId,
		role,
		joinedAt: new Date(),
		lastActivityAt: new Date(),
	});

	// Update document's collaborator list
	await db
		.update(documents)
		.set({
			collaboratorIds: sql`array_append(${documents.collaboratorIds}, ${userId})`,
			updatedAt: new Date(),
		})
		.where(eq(documents.id, documentId));
}

/**
 * Remove a collaborator.
 */
export async function removeCollaborator(
	documentId: DocumentId,
	userId: string
): Promise<void> {
	const currentUserId = await requireCurrentUserId();
	await assertOwnedDocument(documentId, currentUserId);

	await db
		.delete(documentCollaborators)
		.where(
			and(
				eq(documentCollaborators.documentId, documentId),
				eq(documentCollaborators.userId, userId)
			)
		);

	// Update document's collaborator list
	await db
		.update(documents)
		.set({
			collaboratorIds: sql`array_remove(${documents.collaboratorIds}, ${userId})`,
			updatedAt: new Date(),
		})
		.where(eq(documents.id, documentId));
}

/**
 * Get collaborators for a document.
 */
export async function getDocumentCollaborators(
	documentId: DocumentId
): Promise<
	{
		userId: string;
		role: "editor" | "viewer" | "commenter";
		joinedAt: string;
		lastActivityAt: string | null;
		name?: string;
		avatarUrl?: string;
	}[]
> {
	const userId = await requireCurrentUserId();
	await assertReadableDocument(documentId, userId);

	const results = await db
		.select()
		.from(documentCollaborators)
		.where(eq(documentCollaborators.documentId, documentId))
		.orderBy(asc(documentCollaborators.joinedAt));

	return results.map((c) => ({
		userId: c.userId,
		role: c.role as "editor" | "viewer" | "commenter",
		joinedAt: c.joinedAt.toISOString(),
		lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
	}));
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Export document to Markdown.
 */
export async function exportToMarkdown(documentId: DocumentId): Promise<string> {
	const userId = await requireCurrentUserId();
	const doc = await getDocument(documentId, userId);
	if (!doc) throw new Error("Document not found");

	// Basic conversion - could be enhanced with proper handling
	return plainTextToMarkdown(doc.plainText ?? "");
}

/**
 * Export document to HTML.
 */
export async function exportToHTML(documentId: DocumentId): Promise<string> {
	const userId = await requireCurrentUserId();
	const doc = await getDocument(documentId, userId);
	if (!doc) throw new Error("Document not found");

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${doc.title}</title>
</head>
<body>
	<h1>${doc.title}</h1>
	${doc.plainText ?? ""}
</body>
</html>`;
}

/**
 * Import HTML as document.
 */
export async function importFromHTML(
	html: string,
	options: { title?: string; ownerId: string }
): Promise<Document> {
	const userId = await requireCurrentUserId();
	if (options.ownerId !== userId) {
		throw new Error("Unauthorized");
	}

	const [doc] = await db
		.insert(documents)
		.values({
			title: options.title || "Imported Document",
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: html.replace(/<[^>]*>/g, " ") }],
					},
				],
			},
			plainText: html.replace(/<[^>]*>/g, " "),
			status: "draft",
			ownerId: userId,
		})
		.returning();

	return mapDocument(doc);
}

function plainTextToMarkdown(plainText: string): string {
	// Basic conversion - could be improved
	return plainText
		.split("\n")
		.map((line) => line.trim())
		.join("\n\n");
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database document to type.
 */
function mapDocument(row: typeof documents.$inferSelect): Document {
	return {
		id: row.id,
		title: row.title,
		content: row.content as DocumentContent,
		plainText: row.plainText ?? undefined,
		status: row.status as "draft" | "in_review" | "approved" | "archived",
		visibility: row.visibility as "private" | "team" | "organization" | "public",
		ownerId: row.ownerId,
		templateId: row.templateId ?? undefined,
		tags: ((row.tags ?? []) as string[]),
		wordCount: row.wordCount,
		characterCount: row.characterCount,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		lastAccessedAt: row.lastAccessedAt?.toISOString(),
		currentVersion: row.currentVersion,
		collaboratorIds: ((row.collaboratorIds ?? []) as string[]),
		metadata: (row.metadata ?? {}) as Record<string, unknown>,
	};
}

async function assertOwnedDocument(documentId: DocumentId, userId: string): Promise<void> {
	const [doc] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(ownedDocumentCondition(documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}
}

async function getDocument(documentId: DocumentId, userId: string) {
	const [doc] = await db
		.select()
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);
	return doc ? mapDocument(doc) : null;
}

// ============================================================================
// Schema additions (requires migration)
// ============================================================================

/**
 * Add to schema.ts for collaboration:
 * 
 * export const documentCollaborators = pgTable(
 *   "document_collaborators",
 *   {
 *     documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
 *     userId: varchar("user_id", { length: 100 }).notNull(),
 *     role: varchar("role", { length: 20 }).notNull().default("viewer"),
 *     joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
 *     lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
 *   },
 *   (table) => [
 *     primaryKey(table.documentId, table.userId),
 *   ]
 * );
 */
