/**
 * Comments Server Actions - DocFusion
 *
 * Server actions for managing document comments with support for:
 * - Threaded discussions (reply to comments)
 * - Section-specific comments
 * - Different comment types (comment, suggestion, approval, rejection)
 * - Comment resolution
 * - Reactions
 */

"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth-utils";
import { documentComments, commentReactions, commentReads } from "@/lib/db/schema-comments-workflow";
import { documents } from "@/lib/db/schema";
import { eq, and, or, desc, asc, isNull, sql, ne, inArray, type SQL } from "drizzle-orm";
import type {
	DocumentComment,
	CreateCommentInput,
	UpdateCommentInput,
	ResolveCommentInput,
	CommentFilters,
	CommentStats,
	AvailableReaction,
} from "@/lib/types/comments-workflow";
import { isAdmin } from "@/lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

function readableDocumentCondition(documentId: string, userId: string): SQL {
	return and(
		eq(documents.id, documentId),
		or(
			eq(documents.ownerId, userId),
			eq(documents.visibility, "public"),
			sql`${documents.collaboratorIds} ? ${userId}`
		)!
	)!;
}

function writableDocumentCondition(documentId: string, userId: string): SQL {
	return and(
		eq(documents.id, documentId),
		or(
			eq(documents.ownerId, userId),
			sql`${documents.collaboratorIds} ? ${userId}`
		)!
	)!;
}

function readableDocumentExistsSql(documentId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from documents
		where documents.id = ${documentId}
			and (
				documents.owner_id = ${userId}
				or documents.visibility = 'public'
				or documents.collaborator_ids ? ${userId}
			)
	)`;
}

function writableDocumentExistsSql(documentId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from documents
		where documents.id = ${documentId}
			and (
				documents.owner_id = ${userId}
				or documents.collaborator_ids ? ${userId}
			)
	)`;
}

function readableCommentCondition(commentId: string, userId: string): SQL {
	return and(
		eq(documentComments.id, commentId),
		readableDocumentExistsSql(documentComments.documentId, userId)
	)!;
}

function writableCommentCondition(commentId: string, userId: string): SQL {
	return and(
		eq(documentComments.id, commentId),
		writableDocumentExistsSql(documentComments.documentId, userId)
	)!;
}

async function assertReadableDocument(documentId: string, userId: string): Promise<void> {
	const [document] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	if (!document) {
		throw new Error("Document not found");
	}
}

async function assertWritableDocument(documentId: string, userId: string): Promise<void> {
	const [document] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(writableDocumentCondition(documentId, userId))
		.limit(1);

	if (!document) {
		throw new Error("Document not found");
	}
}

async function getCommentAccess(
	commentId: string,
	userId: string
): Promise<{ documentId: string; userId: string } | null> {
	const [comment] = await db
		.select({
			documentId: documentComments.documentId,
			userId: documentComments.userId,
		})
		.from(documentComments)
		.where(readableCommentCondition(commentId, userId))
		.limit(1);

	return comment ?? null;
}

async function getWritableCommentAccess(
	commentId: string,
	userId: string
): Promise<{ documentId: string; userId: string } | null> {
	const [comment] = await db
		.select({
			documentId: documentComments.documentId,
			userId: documentComments.userId,
		})
		.from(documentComments)
		.where(writableCommentCondition(commentId, userId))
		.limit(1);

	return comment ?? null;
}

/**
 * Maps database row to DocumentComment type.
 */
function mapDocumentComment(
	row: typeof documentComments.$inferSelect,
	replies: DocumentComment[] = []
): DocumentComment {
	return {
		id: row.id,
		documentId: row.documentId,
		sectionId: row.sectionId,
		userId: row.userId,
		content: row.content,
		type: row.type as DocumentComment["type"],
		parentId: row.parentId,
		position: (row.position as DocumentComment["position"]) || null,
		resolvedAt: row.resolvedAt,
		resolvedBy: row.resolvedBy,
		isEdited: row.isEdited === "true",
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		replies,
	};
}

/**
 * Build where clause for comment filters.
 */
function buildCommentWhereClause(filters: CommentFilters) {
	const conditions = [];

	if (filters.documentId) {
		conditions.push(eq(documentComments.documentId, filters.documentId));
	}

	if (filters.sectionId) {
		conditions.push(eq(documentComments.sectionId, filters.sectionId));
	}

	if (filters.userId) {
		conditions.push(eq(documentComments.userId, filters.userId));
	}

	if (filters.type) {
		conditions.push(eq(documentComments.type, filters.type));
	}

	if (filters.resolved !== undefined) {
		if (filters.resolved) {
			conditions.push(sql`${documentComments.resolvedAt} IS NOT NULL`);
		} else {
			conditions.push(sql`${documentComments.resolvedAt} IS NULL`);
		}
	}

	if (filters.parentId === null) {
		conditions.push(isNull(documentComments.parentId));
	} else if (filters.parentId) {
		conditions.push(eq(documentComments.parentId, filters.parentId));
	}

	// Search in content
	if (filters.search) {
		conditions.push(
			sql`${documentComments.content} ILIKE ${`%${filters.search}%`}`
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ============================================================================
// Comment CRUD Operations
// ============================================================================

/**
 * Get a single comment by ID with its replies.
 */
export async function getComment(id: string): Promise<DocumentComment | null> {
	const userId = await requireCurrentUserId();
	const [comment] = await db
		.select()
		.from(documentComments)
		.where(readableCommentCondition(id, userId))
		.limit(1);

	if (!comment) return null;

	// Fetch replies
	const replyRows = await db
		.select()
		.from(documentComments)
		.where(and(
			eq(documentComments.parentId, id),
			eq(documentComments.documentId, comment.documentId)
		))
		.orderBy(asc(documentComments.createdAt));

	const replies = replyRows.map((row) => mapDocumentComment(row));

	return mapDocumentComment(comment, replies);
}

/**
 * Get comments for a document with optional filtering.
 */
export async function getComments(
	filters: CommentFilters = {},
	options: { limit?: number; offset?: number } = {}
): Promise<{ comments: DocumentComment[]; total: number }> {
	const userId = await requireCurrentUserId();
	if (!filters.documentId) {
		throw new Error("Document filter required");
	}
	await assertReadableDocument(filters.documentId, userId);

	const whereClause = buildCommentWhereClause(filters);

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(documentComments)
		.where(whereClause);

	const total = countResult[0]?.count || 0;

	// Get comments with pagination
	const rows = await db
		.select()
		.from(documentComments)
		.where(whereClause)
		.orderBy(desc(documentComments.createdAt))
		.limit(options.limit ?? 1000)
		.offset(options.offset ?? 0);

	// For top-level comments, fetch their replies
	const comments = await Promise.all(
		rows.map(async (row) => {
			if (!row.parentId) {
				// This is a top-level comment, fetch replies
				const replyRows = await db
					.select()
					.from(documentComments)
					.where(and(
						eq(documentComments.parentId, row.id),
						eq(documentComments.documentId, row.documentId)
					))
					.orderBy(asc(documentComments.createdAt));

				const replies = replyRows.map((r) => mapDocumentComment(r));
				return mapDocumentComment(row, replies);
			}
			return mapDocumentComment(row);
		})
	);

	return { comments, total };
}

/**
 * Get comments for a specific section.
 */
export async function getSectionComments(
	sectionId: string,
	documentId: string,
	includeResolved = false
): Promise<DocumentComment[]> {
	return getComments({
		documentId,
		sectionId,
		parentId: null,
		resolved: includeResolved ? undefined : false,
	}).then((result) => result.comments);
}

/**
 * Create a new comment.
 */
export async function createComment(
	input: CreateCommentInput,
	_userId: string
): Promise<DocumentComment> {
	const userId = await requireCurrentUserId();
	const { documentId, sectionId, content, type = "comment", parentId, position } = input;

	await assertWritableDocument(documentId, userId);

	// If replying to a comment, ensure parent exists
	if (parentId) {
		const [parent] = await db
			.select({ id: documentComments.id, documentId: documentComments.documentId })
			.from(documentComments)
			.where(and(
				eq(documentComments.id, parentId),
				eq(documentComments.documentId, documentId)
			))
			.limit(1);

		if (!parent) {
			throw new Error("Parent comment not found");
		}
	}

	const [comment] = await db
		.insert(documentComments)
		.values({
			documentId,
			sectionId: sectionId || null,
			userId,
			content,
			type,
			parentId: parentId || null,
			position: position || null,
			isEdited: "false",
		})
		.returning();

	return mapDocumentComment(comment);
}

/**
 * Update an existing comment.
 */
export async function updateComment(
	id: string,
	input: UpdateCommentInput,
	_userId: string
): Promise<DocumentComment> {
	const userId = await requireCurrentUserId();

	// Verify ownership and document access
	const existing = await getWritableCommentAccess(id, userId);

	if (!existing) {
		throw new Error("Comment not found");
	}

	if (existing.userId !== userId) {
		throw new Error("Cannot edit another user's comment");
	}

	const updateData: Partial<typeof documentComments.$inferInsert> = {
		updatedAt: new Date(),
		isEdited: "true",
	};

	if (input.content !== undefined) updateData.content = input.content;
	if (input.type !== undefined) updateData.type = input.type;

	const [updated] = await db
		.update(documentComments)
		.set(updateData)
		.where(and(
			eq(documentComments.id, id),
			eq(documentComments.userId, userId),
			eq(documentComments.documentId, existing.documentId)
		))
		.returning();

	if (!updated) {
		throw new Error("Comment not found");
	}

	return getComment(id) as Promise<DocumentComment>;
}

/**
 * Delete a comment (and its replies).
 */
export async function deleteComment(id: string, _userId: string): Promise<void> {
	const userId = await requireCurrentUserId();

	// Verify ownership and document access
	const existing = await getWritableCommentAccess(id, userId);

	if (!existing) {
		throw new Error("Comment not found");
	}

	// Only comment owner or admin can delete
	if (existing.userId !== userId) {
		const userIsAdmin = await isAdmin(userId);
		if (!userIsAdmin) {
			throw new Error("Cannot delete another user's comment");
		}
	}

	// Delete replies first
	await db.delete(documentComments).where(and(
		eq(documentComments.parentId, id),
		eq(documentComments.documentId, existing.documentId)
	));

	// Delete the comment
	await db.delete(documentComments).where(and(
		eq(documentComments.id, id),
		eq(documentComments.documentId, existing.documentId)
	));
}

/**
 * Resolve or unresolve a comment.
 */
export async function resolveComment(
	id: string,
	input: ResolveCommentInput,
	_userId: string
): Promise<DocumentComment> {
	const userId = await requireCurrentUserId();
	const existing = await getWritableCommentAccess(id, userId);
	if (!existing) {
		throw new Error("Comment not found");
	}

	const updateData: Partial<typeof documentComments.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (input.resolved) {
		updateData.resolvedAt = new Date();
		updateData.resolvedBy = userId;
	} else {
		updateData.resolvedAt = null;
		updateData.resolvedBy = null;
	}

	const [updated] = await db
		.update(documentComments)
		.set(updateData)
		.where(and(
			eq(documentComments.id, id),
			eq(documentComments.documentId, existing.documentId)
		))
		.returning();

	if (!updated) {
		throw new Error("Comment not found");
	}

	return getComment(id) as Promise<DocumentComment>;
}

// ============================================================================
// Comment Statistics
// ============================================================================

/**
 * Get comment statistics for a document.
 */
export async function getCommentStats(documentId: string): Promise<CommentStats> {
	const userId = await requireCurrentUserId();
	await assertReadableDocument(documentId, userId);

	const [totalResult, resolvedResult] = await Promise.all([
		db
			.select({ count: sql<number>`COUNT(*)` })
			.from(documentComments)
			.where(eq(documentComments.documentId, documentId)),
		db
			.select({ count: sql<number>`COUNT(*)` })
			.from(documentComments)
			.where(
				and(
					eq(documentComments.documentId, documentId),
					sql`${documentComments.resolvedAt} IS NOT NULL`
				)
			),
	]);

	const total = totalResult[0]?.count || 0;
	const resolved = resolvedResult[0]?.count || 0;

	// Count by type
	const typeCounts = await db
		.select({
			type: documentComments.type,
			count: sql<number>`COUNT(*)`,
		})
		.from(documentComments)
		.where(eq(documentComments.documentId, documentId))
		.groupBy(documentComments.type);

	const byType: Record<string, number> = {};
	for (const row of typeCounts) {
		byType[row.type] = row.count;
	}

	return {
		total,
		resolved,
		unresolved: total - resolved,
		byType: byType as CommentStats["byType"],
	};
}

// ============================================================================
// Reactions
// ============================================================================

/**
 * Add a reaction to a comment.
 */
export async function addCommentReaction(
	commentId: string,
	reaction: AvailableReaction,
	_userId: string
): Promise<void> {
	const userId = await requireCurrentUserId();
	const existing = await getCommentAccess(commentId, userId);
	if (!existing) {
		throw new Error("Comment not found");
	}

	await db
		.insert(commentReactions)
		.values({
			commentId,
			userId,
			reaction,
		})
		.onConflictDoNothing({
			target: [commentReactions.commentId, commentReactions.userId],
		});
}

/**
 * Remove a reaction from a comment.
 */
export async function removeCommentReaction(
	commentId: string,
	_userId: string
): Promise<void> {
	const userId = await requireCurrentUserId();
	const existing = await getCommentAccess(commentId, userId);
	if (!existing) {
		throw new Error("Comment not found");
	}

	await db
		.delete(commentReactions)
		.where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)));
}

/**
 * Get reactions for a comment.
 */
export async function getCommentReactions(
	commentId: string
): Promise<Record<string, number>> {
	const userId = await requireCurrentUserId();
	const existing = await getCommentAccess(commentId, userId);
	if (!existing) {
		throw new Error("Comment not found");
	}

	const rows = await db
		.select({
			reaction: commentReactions.reaction,
			count: sql<number>`COUNT(*)`,
		})
		.from(commentReactions)
		.where(eq(commentReactions.commentId, commentId))
		.groupBy(commentReactions.reaction);

	const reactions: Record<string, number> = {};
	for (const row of rows) {
		reactions[row.reaction] = row.count;
	}

	return reactions;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Resolve all comments on a section.
 */
export async function resolveSectionComments(
	sectionId: string,
	_userId: string,
	documentId: string
): Promise<number> {
	const userId = await requireCurrentUserId();
	await assertWritableDocument(documentId, userId);

	const result = await db
		.update(documentComments)
		.set({
			resolvedAt: new Date(),
			resolvedBy: userId,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(documentComments.documentId, documentId),
				eq(documentComments.sectionId, sectionId),
				sql`${documentComments.resolvedAt} IS NULL`
			)
		);

	return result.rowCount || 0;
}

/**
 * Mark all comments as read for a user on a document.
 * (Convenience method - marks all unresolved comments they didn't create)
 */
export async function markCommentsRead(
	documentId: string,
	_userId: string
): Promise<void> {
	const userId = await requireCurrentUserId();
	await assertReadableDocument(documentId, userId);

	// Get all unresolved comments on this document that the user didn't create
	const unresolvedComments = await db.query.documentComments.findMany({
		where: and(
			eq(documentComments.documentId, documentId),
			isNull(documentComments.resolvedAt),
			ne(documentComments.userId, userId)
		),
		columns: { id: true },
	});

	if (unresolvedComments.length === 0) {
		return;
	}

	const commentIds = unresolvedComments.map((c) => c.id);

	// Get existing read records for this user on these comments
	const existingReads = await db.query.commentReads.findMany({
		where: and(
			inArray(commentReads.commentId, commentIds),
			eq(commentReads.userId, userId)
		),
		columns: { commentId: true },
	});

	const alreadyReadIds = new Set(existingReads.map((r) => r.commentId));

	// Filter to only comments not yet marked as read
	const unreadCommentIds = commentIds.filter((id) => !alreadyReadIds.has(id));

	if (unreadCommentIds.length === 0) {
		return;
	}

	// Insert read records for all unread comments
	await db.insert(commentReads).values(
		unreadCommentIds.map((commentId) => ({
			documentId,
			commentId,
			userId,
		}))
	);
}
