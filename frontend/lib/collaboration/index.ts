/**
 * Collaboration module exports for DocFusion.
 *
 * Provides real-time collaboration infrastructure using Yjs CRDTs
 * and Pusher WebSocket transport.
 */

// Pusher client
export {
	getPusherClient,
	getPusherConfig,
	disconnectPusher,
	getConnectionState,
	getSocketId,
	channelNames,
	subscribeToChannel,
	subscribeToPresenceChannel,
	unsubscribeFromChannel,
	pusherEvents,
	isConnected,
	waitForConnection,
	type PusherConfig,
	type PresenceMember,
	type PresenceSubscriptionData,
} from "./pusher-client";

// Yjs provider
export {
	getYjsDocument,
	releaseYjsDocument,
	getDocumentFragment,
	getMetadataMap,
	encodeDocumentState,
	encodeDocumentStateToBase64,
	applyUpdate,
	applyBase64Update,
	getStateVector,
	computeDiff,
	loadDocumentState,
	saveDocumentState,
	mergeWithServerState,
	onDocumentUpdate,
	createSnapshot,
	restoreFromSnapshot,
	getDocumentStats,
	hasUnsavedChanges,
	yjsUtils,
	type YjsDocumentInstance,
	type YjsDocumentOptions,
} from "./yjs-provider";

// Pusher-Yjs provider
export {
	PusherYjsProvider,
	createPusherYjsProvider,
	type PusherYjsProviderConfig,
	type AwarenessState,
} from "./pusher-provider";

// Presence
export {
	PresenceManager,
	usePresence,
	useCollaboratorPresence,
	useCollaborator,
	createPresenceData,
	formatLastActive,
	getActivityText,
	isUserActive,
} from "./presence";
