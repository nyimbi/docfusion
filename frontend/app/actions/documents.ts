"use server";

/**
 * Server Actions for Document operations.
 *
 * These run on the server and provide type-safe database access
 * without needing a separate API layer.
 */

import { db, documents, documentVersions, documentYjsStates } from "@/lib/db";
import { eq, desc, asc, ilike, or, and, sql, SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
	Document,
	DocumentSummary,
	DocumentListParams,
	DocumentListResponse,
	CreateDocumentInput,
	UpdateDocumentInput,
	DocumentContent,
	DocumentYjsState,
} from "@/lib/types/document";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract plain text from Tiptap JSONContent for search indexing.
 */
function extractPlainText(content: DocumentContent): string {
	if (!content) return "";

	const extractFromNode = (node: DocumentContent): string => {
		if (node.type === "text" && node.text) {
			return node.text;
		}
		if (node.content && Array.isArray(node.content)) {
			return node.content.map(extractFromNode).join(" ");
		}
		return "";
	};

	return extractFromNode(content).trim();
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
	return text
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
}

/**
 * Map database row to Document type.
 */
function mapRowToDocument(row: typeof documents.$inferSelect): Document {
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

/**
 * Map database row to DocumentSummary type.
 */
function mapRowToSummary(row: typeof documents.$inferSelect): DocumentSummary {
	const plainText = row.plainText || "";
	return {
		id: row.id,
		title: row.title,
		status: row.status as DocumentSummary["status"],
		visibility: row.visibility as DocumentSummary["visibility"],
		ownerId: row.ownerId,
		tags: (row.tags as string[]) || [],
		wordCount: row.wordCount,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		lastAccessedAt: row.lastAccessedAt?.toISOString(),
		excerpt: plainText.substring(0, 200) + (plainText.length > 200 ? "..." : ""),
	};
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * List documents with filtering, sorting, and pagination.
 */
export async function listDocuments(
	params: DocumentListParams = {}
): Promise<DocumentListResponse> {
	const {
		status,
		visibility,
		ownerId,
		tags,
		search,
		sortBy = "updatedAt",
		sortOrder = "desc",
		offset = 0,
		limit = 50,
	} = params;

	// Build where conditions
	const conditions: SQL[] = [];

	if (status) {
		conditions.push(eq(documents.status, status));
	}
	if (visibility) {
		conditions.push(eq(documents.visibility, visibility));
	}
	if (ownerId) {
		conditions.push(eq(documents.ownerId, ownerId));
	}
	if (search) {
		conditions.push(
			or(
				ilike(documents.title, `%${search}%`),
				ilike(documents.plainText, `%${search}%`)
			)!
		);
	}
	// Note: Tag filtering with JSONB would need a custom SQL operator

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Build order by
	const sortColumn = {
		createdAt: documents.createdAt,
		updatedAt: documents.updatedAt,
		title: documents.title,
		lastAccessedAt: documents.lastAccessedAt,
	}[sortBy] || documents.updatedAt;

	const orderFn = sortOrder === "asc" ? asc : desc;

	// Execute queries
	const [rows, countResult] = await Promise.all([
		db
			.select()
			.from(documents)
			.where(whereClause)
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(documents)
			.where(whereClause),
	]);

	const total = Number(countResult[0]?.count || 0);

	return {
		documents: rows.map(mapRowToSummary),
		total,
		offset,
		limit,
		hasMore: offset + rows.length < total,
	};
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string): Promise<Document | null> {
	const rows = await db
		.select()
		.from(documents)
		.where(eq(documents.id, id))
		.limit(1);

	if (rows.length === 0) return null;

	// Update last accessed time
	await db
		.update(documents)
		.set({ lastAccessedAt: new Date() })
		.where(eq(documents.id, id));

	return mapRowToDocument(rows[0]);
}

/**
 * Create a new document.
 */
export async function createDocument(
	input: CreateDocumentInput
): Promise<Document> {
	const content = input.content || { type: "doc", content: [{ type: "paragraph" }] };
	const plainText = extractPlainText(content);
	const wordCount = countWords(plainText);
	const characterCount = plainText.length;

	const [row] = await db
		.insert(documents)
		.values({
			title: input.title,
			content,
			plainText,
			wordCount,
			characterCount,
			visibility: input.visibility || "private",
			templateId: input.templateId,
			tags: input.tags || [],
			metadata: input.metadata,
			ownerId: "system", // TODO: Get from auth context
		})
		.returning();

	// Create initial version
	await db.insert(documentVersions).values({
		documentId: row.id,
		versionNumber: 1,
		content,
		changeDescription: "Initial version",
		createdBy: "system",
	});

	revalidatePath("/documents");
	return mapRowToDocument(row);
}

/**
 * Update an existing document.
 */
export async function updateDocument(
	id: string,
	input: UpdateDocumentInput
): Promise<Document | null> {
	// Fetch current document
	const current = await getDocument(id);
	if (!current) return null;

	// Prepare update data
	const updateData: Partial<typeof documents.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.title !== undefined) {
		updateData.title = input.title;
	}
	if (input.status !== undefined) {
		updateData.status = input.status;
	}
	if (input.visibility !== undefined) {
		updateData.visibility = input.visibility;
	}
	if (input.tags !== undefined) {
		updateData.tags = input.tags;
	}
	if (input.metadata !== undefined) {
		updateData.metadata = input.metadata;
	}
	if (input.content !== undefined) {
		updateData.content = input.content;
		updateData.plainText = extractPlainText(input.content);
		updateData.wordCount = countWords(updateData.plainText || "");
		updateData.characterCount = (updateData.plainText || "").length;
		updateData.currentVersion = current.currentVersion + 1;

		// Create new version
		await db.insert(documentVersions).values({
			documentId: id,
			versionNumber: current.currentVersion + 1,
			content: input.content,
			changeDescription: input.changeDescription,
			createdBy: "system",
		});
	}

	const [row] = await db
		.update(documents)
		.set(updateData)
		.where(eq(documents.id, id))
		.returning();

	revalidatePath("/documents");
	revalidatePath(`/documents/${id}`);
	return mapRowToDocument(row);
}

/**
 * Delete a document.
 */
export async function deleteDocument(id: string): Promise<boolean> {
	const result = await db
		.delete(documents)
		.where(eq(documents.id, id))
		.returning({ id: documents.id });

	revalidatePath("/documents");
	return result.length > 0;
}

// ============================================================================
// Yjs Collaboration State
// ============================================================================

/**
 * Get Yjs state for a document.
 */
export async function getDocumentYjsState(
	documentId: string
): Promise<DocumentYjsState | null> {
	const rows = await db
		.select()
		.from(documentYjsStates)
		.where(eq(documentYjsStates.documentId, documentId))
		.limit(1);

	if (rows.length === 0) return null;

	return {
		documentId: rows[0].documentId,
		state: rows[0].state,
		stateVector: rows[0].stateVector,
		updatedAt: rows[0].updatedAt.toISOString(),
	};
}

/**
 * Save Yjs state for a document.
 */
export async function saveDocumentYjsState(
	documentId: string,
	state: string,
	stateVector: string
): Promise<void> {
	await db
		.insert(documentYjsStates)
		.values({
			documentId,
			state,
			stateVector,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: documentYjsStates.documentId,
			set: {
				state,
				stateVector,
				updatedAt: new Date(),
			},
		});
}

// ============================================================================
// Search
// ============================================================================

/**
 * Search documents by query string.
 */
export async function searchDocuments(
	query: string,
	limit = 20
): Promise<DocumentSummary[]> {
	const rows = await db
		.select()
		.from(documents)
		.where(
			or(
				ilike(documents.title, `%${query}%`),
				ilike(documents.plainText, `%${query}%`)
			)
		)
		.orderBy(desc(documents.updatedAt))
		.limit(limit);

	return rows.map(mapRowToSummary);
}
