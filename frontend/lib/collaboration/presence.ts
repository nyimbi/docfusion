/**
 * Presence management for DocFusion collaboration.
 *
 * Handles user presence tracking, cursor positions, and activity states
 * with integration to the collaboration store.
 */

import { useEffect, useCallback, useRef } from "react";
import type { DocumentId, UserId } from "@/lib/types/document";
import type {
	CollaboratorUser,
	CollaboratorPresence,
	CursorPosition,
	UserActivity,
	SelectionRange,
} from "@/lib/types/collaboration";
import { getCollaboratorColor } from "@/lib/types/collaboration";
import {
	useCollaborationStore,
	generateClientId,
	createCollaboratorPresence,
} from "@/lib/stores/collaboration-store";
import { PusherYjsProvider } from "./pusher-provider";

/** Inactivity timeout for "away" status (5 minutes) */
const AWAY_TIMEOUT = 5 * 60 * 1000;

/** Idle timeout after last activity (30 seconds) */
const IDLE_TIMEOUT = 30 * 1000;

/**
 * Presence manager class.
 * Manages local user presence and broadcasts to collaborators.
 */
export class PresenceManager {
	private provider: PusherYjsProvider;
	private user: CollaboratorUser;
	private clientId: string;
	private activityTimer: ReturnType<typeof setTimeout> | null = null;
	private awayTimer: ReturnType<typeof setTimeout> | null = null;
	private isDestroyed = false;

	constructor(provider: PusherYjsProvider, user: Omit<CollaboratorUser, "color">) {
		this.provider = provider;
		this.clientId = generateClientId();
		this.user = {
			...user,
			color: getCollaboratorColor(user.id),
		};

		this.setupActivityTracking();
	}

	/**
	 * Update cursor position.
	 */
	updateCursor(cursor: CursorPosition | null): void {
		if (this.isDestroyed) return;

		this.provider.updateCursor(cursor);
		this.recordActivity("selecting");
	}

	/**
	 * Update selection range.
	 */
	updateSelection(selection: SelectionRange | null): void {
		if (this.isDestroyed) return;

		const store = useCollaborationStore.getState();
		store.setLocalSelection(selection);
		this.recordActivity(selection ? "selecting" : "viewing");
	}

	/**
	 * Record typing activity.
	 */
	onTyping(): void {
		if (this.isDestroyed) return;
		this.recordActivity("typing");
	}

	/**
	 * Record scrolling activity.
	 */
	onScrolling(): void {
		if (this.isDestroyed) return;
		this.recordActivity("scrolling");
	}

	/**
	 * Record focus gained.
	 */
	onFocus(): void {
		if (this.isDestroyed) return;

		const store = useCollaborationStore.getState();
		// Update local state - focus is tracked in the presence
		this.resetAwayTimer();
		this.recordActivity("viewing");
	}

	/**
	 * Record focus lost.
	 */
	onBlur(): void {
		if (this.isDestroyed) return;

		// When tab loses focus, mark as idle after timeout
		this.startIdleTimer();
	}

	/**
	 * Get the local user info.
	 */
	getUser(): CollaboratorUser {
		return this.user;
	}

	/**
	 * Get the client ID.
	 */
	getClientId(): string {
		return this.clientId;
	}

	/**
	 * Destroy the presence manager.
	 */
	destroy(): void {
		this.isDestroyed = true;

		if (this.activityTimer) {
			clearTimeout(this.activityTimer);
			this.activityTimer = null;
		}

		if (this.awayTimer) {
			clearTimeout(this.awayTimer);
			this.awayTimer = null;
		}
	}

	// Private methods

	private setupActivityTracking(): void {
		if (typeof window === "undefined") return;

		// Track visibility changes
		const handleVisibilityChange = () => {
			if (document.hidden) {
				this.startAwayTimer();
			} else {
				this.resetAwayTimer();
				this.recordActivity("viewing");
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Track mouse movement as activity
		const handleMouseMove = () => {
			this.resetAwayTimer();
		};

		document.addEventListener("mousemove", handleMouseMove, { passive: true });

		// Cleanup on destroy
		const originalDestroy = this.destroy.bind(this);
		this.destroy = () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			document.removeEventListener("mousemove", handleMouseMove);
			originalDestroy();
		};
	}

	private recordActivity(activity: UserActivity): void {
		const store = useCollaborationStore.getState();
		store.setLocalActivity(activity);
		this.provider.updateActivity(activity);

		// Reset idle timer
		this.startIdleTimer();
	}

	private startIdleTimer(): void {
		if (this.activityTimer) {
			clearTimeout(this.activityTimer);
		}

		this.activityTimer = setTimeout(() => {
			this.recordActivity("idle");
		}, IDLE_TIMEOUT);
	}

	private startAwayTimer(): void {
		if (this.awayTimer) {
			clearTimeout(this.awayTimer);
		}

		this.awayTimer = setTimeout(() => {
			this.recordActivity("away");
		}, AWAY_TIMEOUT);
	}

	private resetAwayTimer(): void {
		if (this.awayTimer) {
			clearTimeout(this.awayTimer);
			this.awayTimer = null;
		}
	}
}

/**
 * React hook for presence management.
 * Automatically tracks user presence and broadcasts to collaborators.
 */
export function usePresence(
	documentId: DocumentId | null,
	provider: PusherYjsProvider | null,
	user: { id: UserId; name: string; email?: string; avatarUrl?: string } | null
) {
	const managerRef = useRef<PresenceManager | null>(null);
	const store = useCollaborationStore();

	// Initialize presence manager
	useEffect(() => {
		if (!documentId || !provider || !user) {
			return;
		}

		const manager = new PresenceManager(provider, user);
		managerRef.current = manager;

		// Set current user in store
		store.setCurrentUser(manager.getUser(), manager.getClientId());
		store.setActiveDocument(documentId);

		return () => {
			manager.destroy();
			managerRef.current = null;
			store.clearCurrentUser();
		};
	}, [documentId, provider, user]);

	// Cursor update handler
	const updateCursor = useCallback((cursor: CursorPosition | null) => {
		managerRef.current?.updateCursor(cursor);
	}, []);

	// Selection update handler
	const updateSelection = useCallback((selection: SelectionRange | null) => {
		managerRef.current?.updateSelection(selection);
	}, []);

	// Activity handlers
	const onTyping = useCallback(() => {
		managerRef.current?.onTyping();
	}, []);

	const onScrolling = useCallback(() => {
		managerRef.current?.onScrolling();
	}, []);

	const onFocus = useCallback(() => {
		managerRef.current?.onFocus();
	}, []);

	const onBlur = useCallback(() => {
		managerRef.current?.onBlur();
	}, []);

	return {
		updateCursor,
		updateSelection,
		onTyping,
		onScrolling,
		onFocus,
		onBlur,
		currentUser: managerRef.current?.getUser() ?? null,
		clientId: managerRef.current?.getClientId() ?? null,
	};
}

/**
 * React hook for tracking collaborator presence.
 * Returns a list of active collaborators with their cursor positions.
 */
export function useCollaboratorPresence() {
	const collaborators = useCollaborationStore((s) => s.collaborators);
	const connectionStatus = useCollaborationStore((s) => s.connectionStatus);

	// Convert Map to array with active status
	const activeCollaborators: CollaboratorPresence[] = [];
	collaborators.forEach((presence) => {
		// Consider a collaborator active if they were active in the last 5 minutes
		const lastActive = new Date(presence.lastActiveAt).getTime();
		const isActive = Date.now() - lastActive < AWAY_TIMEOUT;

		if (isActive || presence.activity !== "away") {
			activeCollaborators.push(presence);
		}
	});

	return {
		collaborators: activeCollaborators,
		connectionStatus,
		count: activeCollaborators.length,
	};
}

/**
 * React hook for getting a collaborator by client ID.
 */
export function useCollaborator(clientId: string | null): CollaboratorPresence | null {
	const collaborators = useCollaborationStore((s) => s.collaborators);

	if (!clientId) return null;
	return collaborators.get(clientId) ?? null;
}

/**
 * Create a presence object from user data for broadcasting.
 */
export function createPresenceData(
	user: { id: UserId; name: string; email?: string; avatarUrl?: string },
	clientId: string
): CollaboratorPresence {
	return createCollaboratorPresence(user, clientId);
}

/**
 * Format relative time for "last active" display.
 */
export function formatLastActive(timestamp: string): string {
	const now = Date.now();
	const lastActive = new Date(timestamp).getTime();
	const diff = now - lastActive;

	if (diff < 60000) {
		return "just now";
	}

	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}

	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}

	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

/**
 * Get activity display text.
 */
export function getActivityText(activity: UserActivity): string {
	switch (activity) {
		case "typing":
			return "Typing...";
		case "selecting":
			return "Selecting";
		case "scrolling":
			return "Scrolling";
		case "viewing":
			return "Viewing";
		case "idle":
			return "Idle";
		case "away":
			return "Away";
		default:
			return "";
	}
}

/**
 * Check if a user is considered active (not idle or away).
 */
export function isUserActive(activity: UserActivity): boolean {
	return activity !== "idle" && activity !== "away";
}
