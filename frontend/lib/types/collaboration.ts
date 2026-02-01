/**
 * Collaboration types for DocFusion.
 *
 * Handles real-time presence, cursors, and sync state
 * for collaborative editing via Yjs and Pusher.
 */

import type { DocumentId, UserId } from "./document";

/** Collaboration session identifier */
export type SessionId = string;

/** Connection status for real-time sync */
export type ConnectionStatus =
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "error";

/** Sync status for document state */
export type SyncStatus = "synced" | "syncing" | "pending" | "conflict" | "error";

/**
 * User information for collaboration display.
 */
export interface CollaboratorUser {
	id: UserId;
	name: string;
	email?: string;
	/** Avatar URL or initials fallback */
	avatarUrl?: string;
	/** Assigned color for cursor/selection */
	color: string;
}

/**
 * Collaborator with status for display in sidebars/panels.
 */
export interface Collaborator extends CollaboratorUser {
	status: "active" | "idle" | "offline";
	role?: "owner" | "editor" | "viewer";
	lastSeenAt?: string;
}

/**
 * Cursor position in the document.
 * Uses ProseMirror position format.
 */
export interface CursorPosition {
	/** Absolute position in document */
	pos: number;
	/** Selection anchor (start of selection) */
	anchor?: number;
	/** Selection head (end of selection) */
	head?: number;
}

/**
 * Real-time presence data for a collaborator.
 */
export interface CollaboratorPresence {
	user: CollaboratorUser;
	/** Current cursor position */
	cursor: CursorPosition | null;
	/** Currently selected text range */
	selection: SelectionRange | null;
	/** What the user is currently doing */
	activity: UserActivity;
	/** Last activity timestamp */
	lastActiveAt: string;
	/** Device/client identifier */
	clientId: string;
	/** Whether user is currently focused on the document */
	isFocused: boolean;
}

/** Text selection range */
export interface SelectionRange {
	from: number;
	to: number;
}

/** User activity states */
export type UserActivity =
	| "idle"
	| "viewing"
	| "typing"
	| "selecting"
	| "scrolling"
	| "away";

/**
 * Collaboration session for a document.
 */
export interface CollaborationSession {
	id: SessionId;
	documentId: DocumentId;
	/** Currently connected collaborators */
	collaborators: CollaboratorPresence[];
	/** Session start time */
	startedAt: string;
	/** Connection status */
	connectionStatus: ConnectionStatus;
	/** Document sync status */
	syncStatus: SyncStatus;
	/** Pending local changes count */
	pendingChanges: number;
	/** Last successful sync timestamp */
	lastSyncedAt: string | null;
}

/**
 * Pusher channel subscription info.
 */
export interface ChannelSubscription {
	/** Channel name (e.g., "presence-document-{id}") */
	channelName: string;
	/** Whether currently subscribed */
	isSubscribed: boolean;
	/** Subscription error if any */
	error?: string;
}

/**
 * Real-time event types sent over Pusher.
 */
export type CollaborationEventType =
	| "user-joined"
	| "user-left"
	| "cursor-moved"
	| "selection-changed"
	| "activity-changed"
	| "document-updated"
	| "yjs-update"
	| "yjs-awareness";

/**
 * Base interface for collaboration events.
 */
export interface CollaborationEvent<T = unknown> {
	type: CollaborationEventType;
	documentId: DocumentId;
	userId: UserId;
	timestamp: string;
	payload: T;
}

/** User joined event payload */
export interface UserJoinedPayload {
	user: CollaboratorUser;
	clientId: string;
}

/** User left event payload */
export interface UserLeftPayload {
	userId: UserId;
	clientId: string;
}

/** Cursor moved event payload */
export interface CursorMovedPayload {
	cursor: CursorPosition;
}

/** Selection changed event payload */
export interface SelectionChangedPayload {
	selection: SelectionRange | null;
}

/** Activity changed event payload */
export interface ActivityChangedPayload {
	activity: UserActivity;
}

/** Yjs update event payload */
export interface YjsUpdatePayload {
	/** Base64-encoded Yjs update */
	update: string;
	/** Origin identifier */
	origin: string;
}

/** Yjs awareness event payload */
export interface YjsAwarenessPayload {
	/** Awareness state changes */
	changes: {
		added: number[];
		updated: number[];
		removed: number[];
	};
	/** Serialized awareness states */
	states: string;
}

/**
 * Conflict resolution strategies.
 */
export type ConflictResolution = "auto" | "local" | "remote" | "manual";

/**
 * Document conflict information.
 */
export interface DocumentConflict {
	documentId: DocumentId;
	/** Local version info */
	localVersion: {
		content: string;
		timestamp: string;
	};
	/** Remote version info */
	remoteVersion: {
		content: string;
		timestamp: string;
		userId: UserId;
	};
	/** Suggested resolution */
	suggestedResolution: ConflictResolution;
}

/**
 * Offline changes stored locally.
 */
export interface OfflineChange {
	id: string;
	documentId: DocumentId;
	/** Yjs update data */
	update: Uint8Array;
	timestamp: string;
	/** Whether this change has been synced */
	synced: boolean;
}

/**
 * Collaboration statistics for a document.
 */
export interface CollaborationStats {
	documentId: DocumentId;
	/** Total unique collaborators ever */
	totalCollaborators: number;
	/** Current active collaborators */
	activeCollaborators: number;
	/** Total editing sessions */
	totalSessions: number;
	/** Total editing time in minutes */
	totalEditingTime: number;
	/** Last collaboration timestamp */
	lastCollaboratedAt: string | null;
}

/**
 * Color palette for collaborator cursors.
 * Distinct, accessible colors for up to 12 simultaneous editors.
 */
export const COLLABORATOR_COLORS = [
	"#F44336", // Red
	"#2196F3", // Blue
	"#4CAF50", // Green
	"#FF9800", // Orange
	"#9C27B0", // Purple
	"#00BCD4", // Cyan
	"#E91E63", // Pink
	"#8BC34A", // Light Green
	"#3F51B5", // Indigo
	"#FF5722", // Deep Orange
	"#009688", // Teal
	"#673AB7", // Deep Purple
] as const;

/**
 * Get a consistent color for a user based on their ID.
 */
export function getCollaboratorColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
	}
	return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

/**
 * Generate initials from a user's name.
 */
export function getUserInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase()
		.slice(0, 2);
}
