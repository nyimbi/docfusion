/**
 * Pusher-Yjs provider for DocFusion.
 *
 * Bridges Pusher WebSocket communication with Yjs CRDT synchronization.
 * Handles real-time document updates, awareness state, and presence.
 */

import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import type { PresenceChannel } from "pusher-js";
import type { DocumentId, UserId } from "@/lib/types/document";
import type { CollaboratorUser, CursorPosition, UserActivity } from "@/lib/types/collaboration";
import {
	getPusherClient,
	subscribeToPresenceChannel,
	unsubscribeFromChannel,
	channelNames,
	pusherEvents,
	type PresenceMember,
	type PresenceSubscriptionData,
	waitForConnection,
} from "./pusher-client";
import {
	getYjsDocument,
	releaseYjsDocument,
	onDocumentUpdate,
	applyBase64Update,
	loadDocumentState,
	saveDocumentState,
	yjsUtils,
	type YjsDocumentInstance,
} from "./yjs-provider";
import { getCollaboratorColor } from "@/lib/types/collaboration";
import { loggers } from "@/lib/utils/debug-logger";

const log = loggers.pusherYjs;

/**
 * Pusher-Yjs provider configuration.
 */
export interface PusherYjsProviderConfig {
	/** Current user information */
	user: CollaboratorUser;
	/** Callback when connection status changes */
	onConnectionChange?: (connected: boolean) => void;
	/** Callback when collaborators change */
	onCollaboratorsChange?: (collaborators: CollaboratorUser[]) => void;
	/** Callback when sync status changes */
	onSyncChange?: (synced: boolean) => void;
	/** Callback when an error occurs */
	onError?: (error: Error) => void;
	/** Auto-save interval in milliseconds (default: 30000) */
	autoSaveInterval?: number;
	/** Enable local persistence (default: true) */
	enablePersistence?: boolean;
}

/**
 * Awareness state for a collaborator.
 */
export interface AwarenessState {
	user: CollaboratorUser;
	cursor: CursorPosition | null;
	activity: UserActivity;
}

/**
 * Pusher-Yjs provider class.
 * Manages real-time collaboration for a single document.
 */
export class PusherYjsProvider {
	readonly documentId: DocumentId;
	readonly doc: Y.Doc;
	readonly awareness: Awareness;

	private yjsInstance: YjsDocumentInstance;
	private channel: PresenceChannel | null = null;
	private config: PusherYjsProviderConfig;
	private cleanupFns: (() => void)[] = [];
	private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
	private isDestroyed = false;
	private isSynced = false;
	private pendingUpdates: Uint8Array[] = [];
	private lastServerSave: number = 0;

	constructor(documentId: DocumentId, config: PusherYjsProviderConfig) {
		this.documentId = documentId;
		this.config = config;

		// Get or create Yjs document
		this.yjsInstance = getYjsDocument(documentId, {
			enablePersistence: config.enablePersistence,
			onSync: () => this.handleLocalSync(),
			onSyncError: (error) => config.onError?.(error),
		});
		this.doc = this.yjsInstance.doc;

		// Create awareness instance
		this.awareness = new Awareness(this.doc);
		this.setupAwareness();
	}

	/**
	 * Connect to the collaboration session.
	 */
	async connect(): Promise<void> {
		if (this.isDestroyed) {
			throw new Error("Provider has been destroyed");
		}

		try {
			// Wait for Pusher connection
			await waitForConnection();
			this.config.onConnectionChange?.(true);

			// Load initial state from server
			await loadDocumentState(this.documentId, this.doc);
			this.isSynced = true;
			this.config.onSyncChange?.(true);

			// Subscribe to presence channel
			const channelName = channelNames.presence(this.documentId);
			this.channel = subscribeToPresenceChannel(channelName);

			// Setup channel event handlers
			this.setupChannelHandlers();

			// Setup document update handler
			this.setupDocumentUpdateHandler();

			// Setup auto-save
			this.setupAutoSave();

			log.info(` Connected to document ${this.documentId}`);
		} catch (error) {
			this.config.onConnectionChange?.(false);
			this.config.onError?.(error as Error);
			throw error;
		}
	}

	/**
	 * Disconnect from the collaboration session.
	 */
	disconnect(): void {
		if (this.channel) {
			// Remove awareness
			this.awareness.setLocalState(null);

			// Unsubscribe from channel
			unsubscribeFromChannel(channelNames.presence(this.documentId));
			this.channel = null;
		}

		// Stop auto-save
		if (this.autoSaveTimer) {
			clearInterval(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}

		this.config.onConnectionChange?.(false);
		log.info(` Disconnected from document ${this.documentId}`);
	}

	/**
	 * Destroy the provider and cleanup resources.
	 */
	destroy(): void {
		this.isDestroyed = true;
		this.disconnect();

		// Run cleanup functions
		this.cleanupFns.forEach((fn) => fn());
		this.cleanupFns = [];

		// Destroy awareness
		this.awareness.destroy();

		// Release Yjs document
		releaseYjsDocument(this.documentId);

		log.info(` Provider destroyed for document ${this.documentId}`);
	}

	/**
	 * Force save to server immediately.
	 */
	async save(): Promise<void> {
		if (this.isDestroyed) return;

		try {
			await saveDocumentState(this.documentId, this.doc);
			this.lastServerSave = Date.now();
			log.info(` Saved document ${this.documentId}`);
		} catch (error) {
			this.config.onError?.(error as Error);
			throw error;
		}
	}

	/**
	 * Update local cursor position.
	 */
	updateCursor(cursor: CursorPosition | null): void {
		const state = this.awareness.getLocalState() as AwarenessState | null;
		if (state) {
			this.awareness.setLocalStateField("cursor", cursor);
			this.broadcastAwareness();
		}
	}

	/**
	 * Update local activity state.
	 */
	updateActivity(activity: UserActivity): void {
		const state = this.awareness.getLocalState() as AwarenessState | null;
		if (state) {
			this.awareness.setLocalStateField("activity", activity);
			this.broadcastAwareness();
		}
	}

	/**
	 * Get all current collaborators.
	 */
	getCollaborators(): CollaboratorUser[] {
		const states = this.awareness.getStates();
		const collaborators: CollaboratorUser[] = [];

		states.forEach((state, clientId) => {
			if (clientId !== this.doc.clientID && state?.user) {
				collaborators.push(state.user as CollaboratorUser);
			}
		});

		return collaborators;
	}

	/**
	 * Check if provider is connected.
	 */
	get isConnected(): boolean {
		return this.channel !== null;
	}

	/**
	 * Check if document is synced with server.
	 */
	get synced(): boolean {
		return this.isSynced;
	}

	// Private methods

	private setupAwareness(): void {
		// Set initial local state
		this.awareness.setLocalState({
			user: this.config.user,
			cursor: null,
			activity: "viewing" as UserActivity,
		});

		// Listen for awareness changes
		this.awareness.on("change", () => {
			const collaborators = this.getCollaborators();
			this.config.onCollaboratorsChange?.(collaborators);
		});
	}

	private setupChannelHandlers(): void {
		if (!this.channel) return;

		// Handle subscription succeeded
		this.channel.bind(
			pusherEvents.SUBSCRIPTION_SUCCEEDED,
			(data: PresenceSubscriptionData) => {
				log.info(` Presence subscription succeeded, ${data.count} members`);

				// Process existing members
				const collaborators: CollaboratorUser[] = [];
				Object.entries(data.members).forEach(([id, info]) => {
					if (id !== this.config.user.id) {
						collaborators.push({
							id,
							name: info.name,
							email: info.email,
							avatarUrl: info.avatarUrl,
							color: info.color || getCollaboratorColor(id),
						});
					}
				});
				this.config.onCollaboratorsChange?.(collaborators);
			}
		);

		// Handle member added
		this.channel.bind(pusherEvents.MEMBER_ADDED, (member: PresenceMember) => {
			log.info(` Member joined: ${member.info.name}`);
			this.config.onCollaboratorsChange?.(this.getCollaborators());
		});

		// Handle member removed
		this.channel.bind(pusherEvents.MEMBER_REMOVED, (member: PresenceMember) => {
			log.info(` Member left: ${member.info.name}`);
			this.config.onCollaboratorsChange?.(this.getCollaborators());
		});

		// Handle Yjs updates from other clients
		this.channel.bind(
			pusherEvents.YJS_UPDATE,
			(data: { update: string; origin: string }) => {
				if (data.origin !== this.doc.clientID.toString()) {
					applyBase64Update(this.doc, data.update, "pusher");
				}
			}
		);

		// Handle awareness updates from other clients
		this.channel.bind(
			pusherEvents.YJS_AWARENESS,
			(data: { states: string; clientId: number }) => {
				if (data.clientId !== this.doc.clientID) {
					const update = yjsUtils.base64Decode(data.states);
					applyAwarenessUpdate(this.awareness, update, "pusher");
				}
			}
		);

		// Handle subscription error
		this.channel.bind(pusherEvents.SUBSCRIPTION_ERROR, (error: Error) => {
			log.error(` Subscription error:`, error);
			this.config.onError?.(error);
		});
	}

	private setupDocumentUpdateHandler(): void {
		const cleanup = onDocumentUpdate(this.doc, (update, origin) => {
			// Don't broadcast updates that came from Pusher
			if (origin === "pusher" || origin === "server" || origin === "server-merge") {
				return;
			}

			this.broadcastUpdate(update);
		});

		this.cleanupFns.push(cleanup);
	}

	private broadcastUpdate(update: Uint8Array): void {
		if (!this.channel || this.isDestroyed) {
			// Queue update for later if disconnected
			this.pendingUpdates.push(update);
			return;
		}

		const base64Update = yjsUtils.base64Encode(update);
		this.channel.trigger(pusherEvents.YJS_UPDATE, {
			update: base64Update,
			origin: this.doc.clientID.toString(),
		});
	}

	private broadcastAwareness(): void {
		if (!this.channel || this.isDestroyed) return;

		const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
		const base64States = yjsUtils.base64Encode(update);

		this.channel.trigger(pusherEvents.YJS_AWARENESS, {
			states: base64States,
			clientId: this.doc.clientID,
		});
	}

	private setupAutoSave(): void {
		const interval = this.config.autoSaveInterval ?? 30000;

		this.autoSaveTimer = setInterval(async () => {
			// Only save if there have been changes since last save
			const now = Date.now();
			if (now - this.lastServerSave >= interval) {
				try {
					await this.save();
				} catch (error) {
					log.error(" Auto-save failed:", error);
				}
			}
		}, interval);
	}

	private handleLocalSync(): void {
		log.info(` Local persistence synced for document ${this.documentId}`);

		// Flush pending updates after local sync
		if (this.pendingUpdates.length > 0 && this.channel) {
			this.pendingUpdates.forEach((update) => this.broadcastUpdate(update));
			this.pendingUpdates = [];
		}
	}
}

/**
 * React hook for creating a PusherYjsProvider.
 * Manages the provider lifecycle with automatic cleanup.
 */
export function createPusherYjsProvider(
	documentId: DocumentId,
	config: PusherYjsProviderConfig
): PusherYjsProvider {
	return new PusherYjsProvider(documentId, config);
}
