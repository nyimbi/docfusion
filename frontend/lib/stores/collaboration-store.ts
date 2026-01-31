"use client";

/**
 * Collaboration Store - Real-time collaboration state management.
 *
 * Manages collaborative editing including:
 * - Active user presence
 * - Cursor positions
 * - Selection states
 * - Awareness information
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type CollaborationStatus = "connected" | "connecting" | "disconnected";
export type UserActivity = "idle" | "viewing" | "typing" | "selecting" | "scrolling" | "away";

export interface Collaborator {
	userId: string;
	name: string;
	email?: string;
	avatarUrl?: string;
	color: string;
	status: "active" | "idle";
	cursorPosition?: {
		blockId: string;
		from: number;
		to: number;
	};
	selection?: {
		from: number;
		to: number;
	};
	lastSeen: Date;
}

export interface UserPresence {
	userId: string;
	name: string;
	color: string;
	status: "active" | "idle";
}

interface SelectionRange {
	from: number;
	to: number;
}

interface CollaborationState {
	// State
	status: CollaborationStatus;
	collaborators: Collaborator[];
	isCollaborationEnabled: boolean;
	userPresence: UserPresence | null;
	syncErrors: string[];
	isSyncing: boolean;
	localSelection: SelectionRange | null;
	localActivity: UserActivity;
	currentUser: { id: string; name: string; email?: string; avatarUrl?: string } | null;
	currentClientId: string | null;
	activeDocumentId: string | null;

	// Actions
	setStatus: (status: CollaborationStatus) => void;
	setCollaborators: (collaborators: Collaborator[]) => void;
	addCollaborator: (collaborator: Collaborator) => void;
	updateCollaborator: (userId: string, updates: Partial<Collaborator>) => void;
	removeCollaborator: (userId: string) => void;
	setCollaborationEnabled: (enabled: boolean) => void;
	setUserPresence: (presence: UserPresence | null) => void;
	addSyncError: (error: string) => void;
	clearSyncErrors: () => void;
	setSyncing: (isSyncing: boolean) => void;
	setLocalSelection: (selection: SelectionRange | null) => void;
	setLocalActivity: (activity: UserActivity) => void;
	setCurrentUser: (user: { id: string; name: string; email?: string; avatarUrl?: string }, clientId: string) => void;
	clearCurrentUser: () => void;
	setActiveDocument: (documentId: string | null) => void;
}

const COLORS = [
	"#EF4444", // red
	"#F97316", // orange
	"#F59E0B", // amber
	"#10B981", // emerald
	"#06B6D4", // cyan
	"#3B82F6", // blue
	"#6366F1", // indigo
	"#8B5CF6", // violet
	"#EC4899", // pink
	"#F43F5E", // rose
];

function getColorForUser(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}
	return COLORS[Math.abs(hash) % COLORS.length];
}

export const useCollaborationStore = create<CollaborationState>()(
	immer((set) => ({
		// Initial state - starts with empty collaborators, populated when joining a document
		status: "disconnected",
		collaborators: [],
		isCollaborationEnabled: true,
		userPresence: {
			userId: "current-user",
			name: "You",
			color: COLORS[5],
			status: "active",
		},
		syncErrors: [],
		isSyncing: false,
		localSelection: null,
		localActivity: "viewing" as UserActivity,
		currentUser: null,
		currentClientId: null,
		activeDocumentId: null,

		// Actions
		setStatus: (status) =>
			set((state) => {
				state.status = status;
			}),

		setCollaborators: (collaborators) =>
			set((state) => {
				state.collaborators = collaborators;
			}),

		addCollaborator: (collaborator) =>
			set((state) => {
				// Check if already exists
				const exists = state.collaborators.some(
					(c) => c.userId === collaborator.userId
				);
				
				if (!exists) {
					state.collaborators.push({
						...collaborator,
						color: collaborator.color || getColorForUser(collaborator.userId),
						lastSeen: new Date(),
					});
				}
			}),

		updateCollaborator: (userId, updates) =>
			set((state) => {
				const collaborator = state.collaborators.find(
					(c) => c.userId === userId
				);
				
				if (collaborator) {
					Object.assign(collaborator, updates, {
						lastSeen: new Date(),
					});
				}
			}),

		removeCollaborator: (userId) =>
			set((state) => {
				state.collaborators = state.collaborators.filter(
					(c) => c.userId !== userId
				);
			}),

		setCollaborationEnabled: (enabled) =>
			set((state) => {
				state.isCollaborationEnabled = enabled;
			}),

		setUserPresence: (presence) =>
			set((state) => {
				state.userPresence = presence;
			}),

		addSyncError: (error) =>
			set((state) => {
				state.syncErrors.push(error);
			}),

		clearSyncErrors: () =>
			set((state) => {
				state.syncErrors = [];
			}),

		setSyncing: (isSyncing) =>
			set((state) => {
				state.isSyncing = isSyncing;
			}),

		setLocalSelection: (selection) =>
			set((state) => {
				state.localSelection = selection;
			}),

		setLocalActivity: (activity) =>
			set((state) => {
				state.localActivity = activity;
			}),

		setCurrentUser: (user, clientId) =>
			set((state) => {
				state.currentUser = user;
				state.currentClientId = clientId;
			}),

		clearCurrentUser: () =>
			set((state) => {
				state.currentUser = null;
				state.currentClientId = null;
			}),

		setActiveDocument: (documentId) =>
			set((state) => {
				state.activeDocumentId = documentId;
			}),
	}))
);

/**
 * Generate a unique client ID for this session.
 */
export function generateClientId(): string {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a collaborator presence object from user data.
 */
export function createCollaboratorPresence(
	user: { id: string; name: string; email?: string; avatarUrl?: string },
	clientId: string
) {
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			avatarUrl: user.avatarUrl,
			color: getColorForUser(user.id),
		},
		clientId,
		cursor: null,
		selection: null,
		activity: "viewing" as const,
		lastActiveAt: new Date().toISOString(),
		isFocused: true,
	};
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook to get the current connection status.
 */
export function useConnectionStatus(): CollaborationStatus {
	return useCollaborationStore((state) => state.status);
}

/**
 * Hook to get the current sync status.
 */
export function useSyncStatus(): boolean {
	return useCollaborationStore((state) => state.isSyncing);
}

/**
 * Hook to get the list of collaborators.
 */
export function useCollaborators(): Collaborator[] {
	return useCollaborationStore((state) => state.collaborators);
}

/**
 * Hook to get the count of active collaborators.
 */
export function useCollaboratorCount(): number {
	return useCollaborationStore((state) => state.collaborators.filter((c) => c.status === "active").length);
}

/**
 * Hook to check if the user is offline (disconnected).
 */
export function useIsOffline(): boolean {
	return useCollaborationStore((state) => state.status === "disconnected");
}

/**
 * Hook to get the current collaborator (current user).
 */
export function useCurrentCollaborator(): { user: { id: string; name: string; email?: string; avatarUrl?: string } | null; clientId: string | null } {
	return useCollaborationStore((state) => ({
		user: state.currentUser,
		clientId: state.currentClientId,
	}));
}
