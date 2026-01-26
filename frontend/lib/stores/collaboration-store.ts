/**
 * Collaboration state management with Zustand.
 *
 * Manages real-time collaboration state including connected users,
 * cursor positions, presence, and sync status.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { DocumentId, UserId } from "@/lib/types/document";
import type {
	CollaboratorPresence,
	CollaboratorUser,
	ConnectionStatus,
	SyncStatus,
	CursorPosition,
	SelectionRange,
	UserActivity,
	OfflineChange,
} from "@/lib/types/collaboration";
import { getCollaboratorColor } from "@/lib/types/collaboration";

/** Collaboration state */
export interface CollaborationState {
	// Connection state
	connectionStatus: ConnectionStatus;
	connectionError: string | null;
	reconnectAttempts: number;

	// Document state
	activeDocumentId: DocumentId | null;
	syncStatus: SyncStatus;
	lastSyncedAt: string | null;
	pendingChanges: number;

	// Current user
	currentUser: CollaboratorUser | null;
	currentClientId: string | null;

	// Collaborators
	collaborators: Map<string, CollaboratorPresence>; // keyed by clientId

	// Offline support
	offlineChanges: OfflineChange[];
	isOffline: boolean;

	// Awareness state
	localCursor: CursorPosition | null;
	localSelection: SelectionRange | null;
	localActivity: UserActivity;
}

/** Collaboration actions */
export interface CollaborationActions {
	// Connection actions
	setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
	incrementReconnectAttempts: () => void;
	resetReconnectAttempts: () => void;

	// Document actions
	setActiveDocument: (documentId: DocumentId | null) => void;
	setSyncStatus: (status: SyncStatus) => void;
	setSyncSuccess: () => void;
	incrementPendingChanges: () => void;
	decrementPendingChanges: (count?: number) => void;

	// User actions
	setCurrentUser: (user: CollaboratorUser, clientId: string) => void;
	clearCurrentUser: () => void;

	// Collaborator actions
	addCollaborator: (presence: CollaboratorPresence) => void;
	removeCollaborator: (clientId: string) => void;
	updateCollaboratorCursor: (clientId: string, cursor: CursorPosition | null) => void;
	updateCollaboratorSelection: (clientId: string, selection: SelectionRange | null) => void;
	updateCollaboratorActivity: (clientId: string, activity: UserActivity) => void;
	clearCollaborators: () => void;

	// Local awareness actions
	setLocalCursor: (cursor: CursorPosition | null) => void;
	setLocalSelection: (selection: SelectionRange | null) => void;
	setLocalActivity: (activity: UserActivity) => void;

	// Offline actions
	setOffline: (isOffline: boolean) => void;
	addOfflineChange: (change: OfflineChange) => void;
	removeOfflineChange: (id: string) => void;
	clearOfflineChanges: () => void;
	markOfflineChangeSynced: (id: string) => void;

	// Reset
	reset: () => void;
}

const initialState: CollaborationState = {
	connectionStatus: "disconnected",
	connectionError: null,
	reconnectAttempts: 0,
	activeDocumentId: null,
	syncStatus: "synced",
	lastSyncedAt: null,
	pendingChanges: 0,
	currentUser: null,
	currentClientId: null,
	collaborators: new Map(),
	offlineChanges: [],
	isOffline: false,
	localCursor: null,
	localSelection: null,
	localActivity: "idle",
};

/**
 * Collaboration store for real-time editing state.
 */
export const useCollaborationStore = create<
	CollaborationState & CollaborationActions
>()(
	immer((set, get) => ({
		...initialState,

		// Connection actions
		setConnectionStatus: (status, error) =>
			set((state) => {
				state.connectionStatus = status;
				state.connectionError = error ?? null;
				if (status === "connected") {
					state.reconnectAttempts = 0;
				}
			}),

		incrementReconnectAttempts: () =>
			set((state) => {
				state.reconnectAttempts += 1;
			}),

		resetReconnectAttempts: () =>
			set((state) => {
				state.reconnectAttempts = 0;
			}),

		// Document actions
		setActiveDocument: (documentId) =>
			set((state) => {
				if (state.activeDocumentId !== documentId) {
					state.activeDocumentId = documentId;
					state.collaborators.clear();
					state.syncStatus = "synced";
					state.pendingChanges = 0;
					state.lastSyncedAt = null;
				}
			}),

		setSyncStatus: (status) =>
			set((state) => {
				state.syncStatus = status;
			}),

		setSyncSuccess: () =>
			set((state) => {
				state.syncStatus = "synced";
				state.lastSyncedAt = new Date().toISOString();
				state.pendingChanges = 0;
			}),

		incrementPendingChanges: () =>
			set((state) => {
				state.pendingChanges += 1;
				if (state.syncStatus === "synced") {
					state.syncStatus = "pending";
				}
			}),

		decrementPendingChanges: (count = 1) =>
			set((state) => {
				state.pendingChanges = Math.max(0, state.pendingChanges - count);
				if (state.pendingChanges === 0 && state.syncStatus === "syncing") {
					state.syncStatus = "synced";
					state.lastSyncedAt = new Date().toISOString();
				}
			}),

		// User actions
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

		// Collaborator actions
		addCollaborator: (presence) =>
			set((state) => {
				// Don't add ourselves
				if (presence.clientId === state.currentClientId) return;
				state.collaborators.set(presence.clientId, presence);
			}),

		removeCollaborator: (clientId) =>
			set((state) => {
				state.collaborators.delete(clientId);
			}),

		updateCollaboratorCursor: (clientId, cursor) =>
			set((state) => {
				const collaborator = state.collaborators.get(clientId);
				if (collaborator) {
					collaborator.cursor = cursor;
					collaborator.lastActiveAt = new Date().toISOString();
				}
			}),

		updateCollaboratorSelection: (clientId, selection) =>
			set((state) => {
				const collaborator = state.collaborators.get(clientId);
				if (collaborator) {
					collaborator.selection = selection;
					collaborator.lastActiveAt = new Date().toISOString();
				}
			}),

		updateCollaboratorActivity: (clientId, activity) =>
			set((state) => {
				const collaborator = state.collaborators.get(clientId);
				if (collaborator) {
					collaborator.activity = activity;
					collaborator.lastActiveAt = new Date().toISOString();
				}
			}),

		clearCollaborators: () =>
			set((state) => {
				state.collaborators.clear();
			}),

		// Local awareness actions
		setLocalCursor: (cursor) =>
			set((state) => {
				state.localCursor = cursor;
			}),

		setLocalSelection: (selection) =>
			set((state) => {
				state.localSelection = selection;
			}),

		setLocalActivity: (activity) =>
			set((state) => {
				state.localActivity = activity;
			}),

		// Offline actions
		setOffline: (isOffline) =>
			set((state) => {
				state.isOffline = isOffline;
				if (isOffline) {
					state.connectionStatus = "disconnected";
				}
			}),

		addOfflineChange: (change) =>
			set((state) => {
				state.offlineChanges.push(change);
			}),

		removeOfflineChange: (id) =>
			set((state) => {
				const index = state.offlineChanges.findIndex((c) => c.id === id);
				if (index !== -1) {
					state.offlineChanges.splice(index, 1);
				}
			}),

		clearOfflineChanges: () =>
			set((state) => {
				state.offlineChanges = [];
			}),

		markOfflineChangeSynced: (id) =>
			set((state) => {
				const change = state.offlineChanges.find((c) => c.id === id);
				if (change) {
					change.synced = true;
				}
			}),

		// Reset
		reset: () => set(initialState),
	}))
);

/**
 * Selector hooks for common state slices.
 */
export const useConnectionStatus = () =>
	useCollaborationStore((s) => s.connectionStatus);

export const useSyncStatus = () =>
	useCollaborationStore((s) => ({
		status: s.syncStatus,
		pendingChanges: s.pendingChanges,
		lastSyncedAt: s.lastSyncedAt,
	}));

export const useCollaborators = () => {
	const collaborators = useCollaborationStore((s) => s.collaborators);
	return Array.from(collaborators.values());
};

export const useCollaboratorCount = () =>
	useCollaborationStore((s) => s.collaborators.size);

export const useIsOffline = () => useCollaborationStore((s) => s.isOffline);

export const useCurrentCollaborator = () =>
	useCollaborationStore((s) => s.currentUser);

/**
 * Create a collaborator presence object from user data.
 */
export function createCollaboratorPresence(
	user: { id: UserId; name: string; email?: string; avatarUrl?: string },
	clientId: string
): CollaboratorPresence {
	return {
		user: {
			...user,
			color: getCollaboratorColor(user.id),
		},
		cursor: null,
		selection: null,
		activity: "viewing",
		lastActiveAt: new Date().toISOString(),
		clientId,
		isFocused: true,
	};
}

/**
 * Generate a unique client ID for this browser session.
 */
export function generateClientId(): string {
	return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
