/**
 * Collaboration Server Actions - DocFusion
 *
 * Server actions for real-time collaboration features using Yjs.
 */

"use server";

import { db } from "@/lib/db";
import { documentYjsStates, documents } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type {
	UserPresence,
	DocumentCollaborators,
	YjsDocumentState,
	UpdatePresenceInput,
	DocumentCollaborationSummary,
} from "@/lib/types/opportunity";

// ============================================================================
// In-Memory Presence Store
// ============================================================================

/**
 * In-memory store for user presence.
 * In production, this would use Redis or similar.
 */
const presenceStore = new Map<string, Map<string, UserPresence>>();

// Colors for user cursors
const CURSOR_COLORS = [
	"#FF6B6B", // Red
	"#4ECDC4", // Teal
	"#45B7D1", // Blue
	"#96CEB4", // Green
	"#FFEAA7", // Yellow
	"#DDA0DD", // Plum
	"#98D8C8", // Mint
	"#F7DC6F", // Gold
	"#BB8FCE", // Purple
	"#85C1E9", // Light Blue
];

async function requireCollaborationActor(): Promise<{
	userId: string;
	userName: string;
}> {
	const session = await getServerSession();
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	return {
		userId: session.user.id,
		userName: session.user.name ?? session.user.email ?? session.user.id,
	};
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

async function canReadDocument(documentId: string, userId: string): Promise<boolean> {
	const [document] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(readableDocumentCondition(documentId, userId))
		.limit(1);

	return !!document;
}

async function requireWritableDocument(
	documentId: string,
	userId: string
): Promise<void> {
	const [document] = await db
		.select({ id: documents.id })
		.from(documents)
		.where(writableDocumentCondition(documentId, userId))
		.limit(1);

	if (!document) {
		throw new Error("Unauthorized");
	}
}

function getUserColor(userId: string): string {
	// Generate consistent color based on userId hash
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash << 5) - hash + userId.charCodeAt(i);
		hash |= 0;
	}
	return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ============================================================================
// Yjs State Management
// ============================================================================

/**
 * Get Yjs state for a document.
 */
export async function getYjsState(
	documentId: string
): Promise<YjsDocumentState | null> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(documentId, actor.userId))) {
		return null;
	}

	const [row] = await db
		.select()
		.from(documentYjsStates)
		.where(eq(documentYjsStates.documentId, documentId));

	if (!row) return null;

	return {
		documentId: row.documentId,
		state: row.state,
		stateVector: row.stateVector,
		updatedAt: row.updatedAt,
	};
}

/**
 * Save Yjs state for a document.
 */
export async function saveYjsState(
	documentId: string,
	state: string,
	stateVector: string
): Promise<YjsDocumentState> {
	const actor = await requireCollaborationActor();
	await requireWritableDocument(documentId, actor.userId);

	const [existing] = await db
		.select()
		.from(documentYjsStates)
		.where(eq(documentYjsStates.documentId, documentId));

	if (existing) {
		// Update existing state
		await db
			.update(documentYjsStates)
			.set({
				state,
				stateVector,
				updatedAt: new Date(),
			})
			.where(eq(documentYjsStates.documentId, documentId));
	} else {
		// Insert new state
		await db.insert(documentYjsStates).values({
			documentId,
			state,
			stateVector,
		});
	}

	return {
		documentId,
		state,
		stateVector,
		updatedAt: new Date(),
	};
}

/**
 * Delete Yjs state for a document.
 */
export async function deleteYjsState(documentId: string): Promise<void> {
	const actor = await requireCollaborationActor();
	await requireWritableDocument(documentId, actor.userId);

	await db
		.delete(documentYjsStates)
		.where(eq(documentYjsStates.documentId, documentId));
}

// ============================================================================
// Presence Management
// ============================================================================

/**
 * Update user presence for a document.
 */
export async function updatePresence(
	input: UpdatePresenceInput
): Promise<UserPresence> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(input.documentId, actor.userId))) {
		throw new Error("Unauthorized");
	}

	const { documentId, cursorPosition } = input;

	// Get or create document presence map
	let docPresence = presenceStore.get(documentId);
	if (!docPresence) {
		docPresence = new Map();
		presenceStore.set(documentId, docPresence);
	}

	// Update user presence
	const presence: UserPresence = {
		documentId,
		userId: actor.userId,
		userName: actor.userName,
		userColor: getUserColor(actor.userId),
		cursorPosition,
		lastActiveAt: new Date(),
	};

	docPresence.set(actor.userId, presence);

	return presence;
}

/**
 * Remove user presence from a document.
 */
export async function removePresence(
	documentId: string,
	_userId: string
): Promise<void> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(documentId, actor.userId))) {
		throw new Error("Unauthorized");
	}

	const docPresence = presenceStore.get(documentId);
	if (docPresence) {
		docPresence.delete(actor.userId);
		if (docPresence.size === 0) {
			presenceStore.delete(documentId);
		}
	}
}

/**
 * Get active collaborators for a document.
 */
export async function getActiveCollaborators(
	documentId: string
): Promise<DocumentCollaborators> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(documentId, actor.userId))) {
		return {
			documentId,
			collaborators: [],
			lastUpdated: new Date(),
		};
	}

	const docPresence = presenceStore.get(documentId);

	// Filter out stale presence (inactive for more than 5 minutes)
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
	const activeCollaborators: UserPresence[] = [];

	if (docPresence) {
		for (const [userId, presence] of docPresence) {
			if (presence.lastActiveAt > fiveMinutesAgo) {
				activeCollaborators.push(presence);
			} else {
				// Clean up stale presence
				docPresence.delete(userId);
			}
		}
	}

	return {
		documentId,
		collaborators: activeCollaborators,
		lastUpdated: new Date(),
	};
}

/**
 * Get all active collaboration sessions.
 */
export async function getActiveCollaborationSessions(): Promise<
	DocumentCollaborationSummary[]
> {
	const actor = await requireCollaborationActor();
	const sessions: DocumentCollaborationSummary[] = [];
	const documentIds = Array.from(presenceStore.keys());

	if (documentIds.length === 0) return sessions;

	// Get document titles
	const docs = await db
		.select({
			id: documents.id,
			title: documents.title,
		})
		.from(documents)
		.where(
			and(
				inArray(documents.id, documentIds),
				or(
					eq(documents.ownerId, actor.userId),
					eq(documents.visibility, "public"),
					sql`${documents.collaboratorIds} ? ${actor.userId}`
				)!
			)
		);

	const titleMap = new Map(docs.map((d) => [d.id, d.title]));

	for (const [documentId, presence] of presenceStore) {
		if (!titleMap.has(documentId)) continue;

		// Filter active users
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		const activeUsers = Array.from(presence.values()).filter(
			(p) => p.lastActiveAt > fiveMinutesAgo
		);

		if (activeUsers.length === 0) continue;

		// Find earliest and latest activity
		const timestamps = activeUsers.map((p) => p.lastActiveAt.getTime());
		const startedAt = new Date(Math.min(...timestamps));
		const lastActivityAt = new Date(Math.max(...timestamps));

		sessions.push({
			documentId,
			documentTitle: titleMap.get(documentId) || "Unknown Document",
			activeUsers: activeUsers.length,
			startedAt,
			lastActivityAt,
		});
	}

	return sessions.sort((a, b) => b.activeUsers - a.activeUsers);
}

// ============================================================================
// Collaboration Analytics
// ============================================================================

/**
 * Get collaboration statistics for a document.
 */
export async function getDocumentCollaborationStats(documentId: string): Promise<{
	currentCollaborators: number;
	totalEdits: number;
	lastEditedAt: Date | null;
	hasYjsState: boolean;
}> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(documentId, actor.userId))) {
		return {
			currentCollaborators: 0,
			totalEdits: 0,
			lastEditedAt: null,
			hasYjsState: false,
		};
	}

	// Get current collaborators
	const docPresence = presenceStore.get(documentId);
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
	const collaborators = docPresence
		? Array.from(docPresence.values()).filter((p) => p.lastActiveAt > fiveMinutesAgo)
		: [];

	// Check for Yjs state
	const [yjsState] = await db
		.select()
		.from(documentYjsStates)
		.where(eq(documentYjsStates.documentId, documentId))
		.limit(1);

	// Get document details
	const [doc] = await db
		.select({
			currentVersion: documents.currentVersion,
			updatedAt: documents.updatedAt,
		})
		.from(documents)
		.where(readableDocumentCondition(documentId, actor.userId))
		.limit(1);

	return {
		currentCollaborators: collaborators.length,
		totalEdits: doc?.currentVersion || 0,
		lastEditedAt: doc?.updatedAt || null,
		hasYjsState: !!yjsState,
	};
}

/**
 * Get users currently collaborating (across all documents).
 */
export async function getAllActiveUsers(): Promise<
	Array<{
		userId: string;
		userName: string;
		documentId: string;
		documentTitle: string;
		lastActiveAt: Date;
	}>
> {
	const actor = await requireCollaborationActor();
	const users: Array<{
		userId: string;
		userName: string;
		documentId: string;
		documentTitle: string;
		lastActiveAt: Date;
	}> = [];

	const documentIds = Array.from(presenceStore.keys());
	if (documentIds.length === 0) return users;

	// Get document titles
	const docs = await db
		.select({
			id: documents.id,
			title: documents.title,
		})
		.from(documents)
		.where(
			and(
				inArray(documents.id, documentIds),
				or(
					eq(documents.ownerId, actor.userId),
					eq(documents.visibility, "public"),
					sql`${documents.collaboratorIds} ? ${actor.userId}`
				)!
			)
		);

	const titleMap = new Map(docs.map((d) => [d.id, d.title]));
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	for (const [documentId, presence] of presenceStore) {
		for (const userPresence of presence.values()) {
			if (!titleMap.has(documentId)) continue;

			if (userPresence.lastActiveAt > fiveMinutesAgo) {
				users.push({
					userId: userPresence.userId,
					userName: userPresence.userName,
					documentId,
					documentTitle: titleMap.get(documentId) || "Unknown Document",
					lastActiveAt: userPresence.lastActiveAt,
				});
			}
		}
	}

	return users.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

// ============================================================================
// Document Locking (Optional)
// ============================================================================

const documentLocks = new Map<string, { userId: string; lockedAt: Date }>();

/**
 * Acquire a lock on a document for exclusive editing.
 */
export async function acquireDocumentLock(
	documentId: string,
	_userId: string
): Promise<{ success: boolean; lockedBy?: string }> {
	const actor = await requireCollaborationActor();
	await requireWritableDocument(documentId, actor.userId);

	const existingLock = documentLocks.get(documentId);

	// Check if already locked by another user
	if (existingLock && existingLock.userId !== actor.userId) {
		// Check if lock is stale (older than 30 minutes)
		const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
		if (existingLock.lockedAt > thirtyMinutesAgo) {
			return { success: false, lockedBy: existingLock.userId };
		}
	}

	// Acquire or renew lock
	documentLocks.set(documentId, { userId: actor.userId, lockedAt: new Date() });
	return { success: true };
}

/**
 * Release a lock on a document.
 */
export async function releaseDocumentLock(
	documentId: string,
	_userId: string
): Promise<boolean> {
	const actor = await requireCollaborationActor();
	await requireWritableDocument(documentId, actor.userId);

	const existingLock = documentLocks.get(documentId);

	if (!existingLock || existingLock.userId !== actor.userId) {
		return false;
	}

	documentLocks.delete(documentId);
	return true;
}

/**
 * Check if a document is locked.
 */
export async function checkDocumentLock(
	documentId: string
): Promise<{ isLocked: boolean; lockedBy?: string; lockedAt?: Date }> {
	const actor = await requireCollaborationActor();
	if (!(await canReadDocument(documentId, actor.userId))) {
		return { isLocked: false };
	}

	const lock = documentLocks.get(documentId);

	if (!lock) {
		return { isLocked: false };
	}

	// Check if lock is stale
	const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
	if (lock.lockedAt <= thirtyMinutesAgo) {
		documentLocks.delete(documentId);
		return { isLocked: false };
	}

	return {
		isLocked: true,
		lockedBy: lock.userId,
		lockedAt: lock.lockedAt,
	};
}
