/**
 * Collaboration Server Actions - DocFusion
 *
 * Server actions for real-time collaboration features using Yjs.
 */

"use server";

import { db } from "@/lib/db";
import { documentYjsStates, documents } from "@/lib/db/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";
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
	const { documentId, userId, userName, cursorPosition } = input;

	// Get or create document presence map
	let docPresence = presenceStore.get(documentId);
	if (!docPresence) {
		docPresence = new Map();
		presenceStore.set(documentId, docPresence);
	}

	// Update user presence
	const presence: UserPresence = {
		documentId,
		userId,
		userName,
		userColor: getUserColor(userId),
		cursorPosition,
		lastActiveAt: new Date(),
	};

	docPresence.set(userId, presence);

	return presence;
}

/**
 * Remove user presence from a document.
 */
export async function removePresence(
	documentId: string,
	userId: string
): Promise<void> {
	const docPresence = presenceStore.get(documentId);
	if (docPresence) {
		docPresence.delete(userId);
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
		.where(sql`${documents.id} = ANY(${documentIds})`);

	const titleMap = new Map(docs.map((d) => [d.id, d.title]));

	for (const [documentId, presence] of presenceStore) {
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
	// Get current collaborators
	const { collaborators } = await getActiveCollaborators(documentId);

	// Check for Yjs state
	const yjsState = await getYjsState(documentId);

	// Get document details
	const [doc] = await db
		.select({
			currentVersion: documents.currentVersion,
			updatedAt: documents.updatedAt,
		})
		.from(documents)
		.where(eq(documents.id, documentId));

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
		.where(sql`${documents.id} = ANY(${documentIds})`);

	const titleMap = new Map(docs.map((d) => [d.id, d.title]));
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	for (const [documentId, presence] of presenceStore) {
		for (const userPresence of presence.values()) {
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
	userId: string
): Promise<{ success: boolean; lockedBy?: string }> {
	const existingLock = documentLocks.get(documentId);

	// Check if already locked by another user
	if (existingLock && existingLock.userId !== userId) {
		// Check if lock is stale (older than 30 minutes)
		const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
		if (existingLock.lockedAt > thirtyMinutesAgo) {
			return { success: false, lockedBy: existingLock.userId };
		}
	}

	// Acquire or renew lock
	documentLocks.set(documentId, { userId, lockedAt: new Date() });
	return { success: true };
}

/**
 * Release a lock on a document.
 */
export async function releaseDocumentLock(
	documentId: string,
	userId: string
): Promise<boolean> {
	const existingLock = documentLocks.get(documentId);

	if (!existingLock || existingLock.userId !== userId) {
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
