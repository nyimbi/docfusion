/**
 * Pusher client configuration for DocFusion.
 *
 * Configures Pusher-js for WebSocket communication with Soketi server.
 * Handles connection lifecycle, authentication, and channel management.
 */

import Pusher, { type Channel, type PresenceChannel } from "pusher-js";
import type { DocumentId } from "@/lib/types/document";
import { loggers } from "@/lib/utils/debug-logger";

const log = loggers.pusher;

/** Pusher client singleton */
let pusherInstance: Pusher | null = null;

/** Configuration options for Pusher client */
export interface PusherConfig {
	key: string;
	cluster: string;
	wsHost?: string;
	wsPort?: number;
	wssPort?: number;
	forceTLS?: boolean;
	enabledTransports?: ("ws" | "wss")[];
	authEndpoint?: string;
}

/**
 * Get environment-based Pusher configuration.
 * Supports both Pusher Cloud and self-hosted Soketi.
 */
export function getPusherConfig(): PusherConfig {
	const useSoketi = Boolean(process.env.NEXT_PUBLIC_SOKETI_HOST);

	if (useSoketi) {
		return {
			key: process.env.NEXT_PUBLIC_PUSHER_KEY || "app-key",
			cluster: "mt1", // Required but ignored for Soketi
			wsHost: process.env.NEXT_PUBLIC_SOKETI_HOST || "localhost",
			wsPort: parseInt(process.env.NEXT_PUBLIC_SOKETI_PORT || "6001", 10),
			wssPort: parseInt(process.env.NEXT_PUBLIC_SOKETI_WSS_PORT || "6001", 10),
			forceTLS: process.env.NEXT_PUBLIC_SOKETI_TLS === "true",
			enabledTransports: ["ws", "wss"],
			authEndpoint: `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/pusher/auth`,
		};
	}

	// Pusher Cloud configuration
	return {
		key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
		cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
		authEndpoint: `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/pusher/auth`,
	};
}

/**
 * Initialize and return the Pusher client singleton.
 * Creates a new instance if one doesn't exist.
 */
export function getPusherClient(): Pusher {
	if (pusherInstance) {
		return pusherInstance;
	}

	const config = getPusherConfig();

	pusherInstance = new Pusher(config.key, {
		cluster: config.cluster,
		wsHost: config.wsHost,
		wsPort: config.wsPort,
		wssPort: config.wssPort,
		forceTLS: config.forceTLS ?? true,
		enabledTransports: config.enabledTransports,
		disableStats: true,
		authEndpoint: config.authEndpoint,
		auth: {
			headers: {
				"Content-Type": "application/json",
			},
		},
	});

	// Setup global connection event handlers
	setupConnectionHandlers(pusherInstance);

	return pusherInstance;
}

/**
 * Setup global connection event handlers.
 */
function setupConnectionHandlers(pusher: Pusher): void {
	pusher.connection.bind("connected", () => {
		log.info(" Connected, socket_id:", pusher.connection.socket_id);
	});

	pusher.connection.bind("disconnected", () => {
		log.info(" Disconnected");
	});

	pusher.connection.bind("error", (error: Error) => {
		log.error(" Connection error:", error);
	});

	pusher.connection.bind("state_change", (states: { current: string; previous: string }) => {
		log.info(" State changed:", states.previous, "->", states.current);
	});
}

/**
 * Disconnect and cleanup the Pusher client.
 */
export function disconnectPusher(): void {
	if (pusherInstance) {
		pusherInstance.disconnect();
		pusherInstance = null;
	}
}

/**
 * Get the current connection state.
 */
export function getConnectionState(): string {
	return pusherInstance?.connection.state ?? "disconnected";
}

/**
 * Get the socket ID for the current connection.
 */
export function getSocketId(): string | undefined {
	return pusherInstance?.connection.socket_id;
}

/**
 * Channel name generators for different channel types.
 */
export const channelNames = {
	/** Private channel for document updates */
	document: (documentId: DocumentId) => `private-document-${documentId}`,
	/** Presence channel for real-time collaboration */
	presence: (documentId: DocumentId) => `presence-document-${documentId}`,
	/** Private channel for user notifications */
	user: (userId: string) => `private-user-${userId}`,
};

/**
 * Subscribe to a private channel.
 */
export function subscribeToChannel(channelName: string): Channel {
	const pusher = getPusherClient();
	return pusher.subscribe(channelName);
}

/**
 * Subscribe to a presence channel for real-time collaboration.
 */
export function subscribeToPresenceChannel(channelName: string): PresenceChannel {
	const pusher = getPusherClient();
	return pusher.subscribe(channelName) as PresenceChannel;
}

/**
 * Unsubscribe from a channel.
 */
export function unsubscribeFromChannel(channelName: string): void {
	const pusher = getPusherClient();
	pusher.unsubscribe(channelName);
}

/**
 * Event names used in Pusher channels.
 */
export const pusherEvents = {
	// Presence events (automatically handled by Pusher)
	SUBSCRIPTION_SUCCEEDED: "pusher:subscription_succeeded",
	MEMBER_ADDED: "pusher:member_added",
	MEMBER_REMOVED: "pusher:member_removed",
	SUBSCRIPTION_ERROR: "pusher:subscription_error",

	// Custom collaboration events
	YJS_UPDATE: "client-yjs-update",
	YJS_AWARENESS: "client-yjs-awareness",
	CURSOR_MOVE: "client-cursor-move",
	SELECTION_CHANGE: "client-selection-change",
	ACTIVITY_CHANGE: "client-activity-change",
	DOCUMENT_SAVED: "document-saved",
	DOCUMENT_LOCKED: "document-locked",
	DOCUMENT_UNLOCKED: "document-unlocked",
};

/**
 * Type definitions for presence channel members.
 */
export interface PresenceMember {
	id: string;
	info: {
		name: string;
		email?: string;
		avatarUrl?: string;
		color: string;
	};
}

/**
 * Type definitions for presence channel subscription data.
 */
export interface PresenceSubscriptionData {
	members: Record<string, PresenceMember["info"]>;
	count: number;
	myID: string;
	me: PresenceMember;
}

/**
 * Check if Pusher is connected.
 */
export function isConnected(): boolean {
	return pusherInstance?.connection.state === "connected";
}

/**
 * Wait for Pusher to connect with timeout.
 */
export function waitForConnection(timeoutMs: number = 10000): Promise<void> {
	return new Promise((resolve, reject) => {
		const pusher = getPusherClient();

		if (pusher.connection.state === "connected") {
			resolve();
			return;
		}

		const timeout = setTimeout(() => {
			pusher.connection.unbind("connected", onConnected);
			pusher.connection.unbind("error", onError);
			reject(new Error("Pusher connection timeout"));
		}, timeoutMs);

		const onConnected = () => {
			clearTimeout(timeout);
			pusher.connection.unbind("error", onError);
			resolve();
		};

		const onError = (error: Error) => {
			clearTimeout(timeout);
			pusher.connection.unbind("connected", onConnected);
			reject(error);
		};

		pusher.connection.bind("connected", onConnected);
		pusher.connection.bind("error", onError);
	});
}
