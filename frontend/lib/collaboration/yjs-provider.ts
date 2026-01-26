/**
 * Yjs document provider for DocFusion.
 *
 * Manages Yjs document instances, persistence with IndexedDB,
 * and integration with Tiptap's collaboration extension.
 */

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { DocumentId } from "@/lib/types/document";
import { fetcher } from "@/lib/api/client";
import { loggers } from "@/lib/utils/debug-logger";

const log = loggers.yjs;

/** Active Yjs document instances keyed by document ID */
const activeDocuments = new Map<DocumentId, YjsDocumentInstance>();

/**
 * Yjs document instance with associated providers.
 */
export interface YjsDocumentInstance {
	/** The Yjs document */
	doc: Y.Doc;
	/** IndexedDB persistence provider */
	persistence: IndexeddbPersistence | null;
	/** Reference count for cleanup */
	refCount: number;
	/** Document ID */
	documentId: DocumentId;
	/** Whether the document has been synced with server */
	isSynced: boolean;
	/** Cleanup callbacks */
	cleanupCallbacks: (() => void)[];
}

/**
 * Options for creating a Yjs document.
 */
export interface YjsDocumentOptions {
	/** Enable IndexedDB persistence */
	enablePersistence?: boolean;
	/** Callback when initial sync is complete */
	onSync?: () => void;
	/** Callback when sync fails */
	onSyncError?: (error: Error) => void;
}

/**
 * Get or create a Yjs document for a document ID.
 * Uses reference counting to manage cleanup.
 */
export function getYjsDocument(
	documentId: DocumentId,
	options: YjsDocumentOptions = {}
): YjsDocumentInstance {
	const existing = activeDocuments.get(documentId);

	if (existing) {
		existing.refCount++;
		return existing;
	}

	const doc = new Y.Doc();
	const instance: YjsDocumentInstance = {
		doc,
		persistence: null,
		refCount: 1,
		documentId,
		isSynced: false,
		cleanupCallbacks: [],
	};

	// Setup IndexedDB persistence
	if (options.enablePersistence !== false) {
		const persistence = new IndexeddbPersistence(`docfusion-${documentId}`, doc);

		persistence.on("synced", () => {
			log.info(` IndexedDB synced for document ${documentId}`);
			instance.isSynced = true;
			options.onSync?.();
		});

		instance.persistence = persistence;
	}

	activeDocuments.set(documentId, instance);
	return instance;
}

/**
 * Release a Yjs document instance.
 * Cleans up resources when reference count reaches zero.
 */
export function releaseYjsDocument(documentId: DocumentId): void {
	const instance = activeDocuments.get(documentId);

	if (!instance) {
		return;
	}

	instance.refCount--;

	if (instance.refCount <= 0) {
		// Run cleanup callbacks
		instance.cleanupCallbacks.forEach((cb) => cb());
		instance.cleanupCallbacks = [];

		// Destroy persistence
		if (instance.persistence) {
			instance.persistence.destroy();
		}

		// Destroy document
		instance.doc.destroy();

		activeDocuments.delete(documentId);
		log.info(` Document ${documentId} destroyed`);
	}
}

/**
 * Get the XML fragment for Tiptap content.
 * This is the shared type used by y-prosemirror.
 */
export function getDocumentFragment(doc: Y.Doc): Y.XmlFragment {
	return doc.getXmlFragment("prosemirror");
}

/**
 * Get a shared map for document metadata.
 */
export function getMetadataMap(doc: Y.Doc): Y.Map<unknown> {
	return doc.getMap("metadata");
}

/**
 * Encode a Yjs document state to Uint8Array.
 */
export function encodeDocumentState(doc: Y.Doc): Uint8Array {
	return Y.encodeStateAsUpdate(doc);
}

/**
 * Encode a Yjs document state to base64 string.
 */
export function encodeDocumentStateToBase64(doc: Y.Doc): string {
	const update = encodeDocumentState(doc);
	return base64Encode(update);
}

/**
 * Apply an update to a Yjs document.
 */
export function applyUpdate(doc: Y.Doc, update: Uint8Array, origin?: string): void {
	Y.applyUpdate(doc, update, origin);
}

/**
 * Apply a base64-encoded update to a Yjs document.
 */
export function applyBase64Update(doc: Y.Doc, base64Update: string, origin?: string): void {
	const update = base64Decode(base64Update);
	applyUpdate(doc, update, origin);
}

/**
 * Get the state vector of a Yjs document.
 */
export function getStateVector(doc: Y.Doc): Uint8Array {
	return Y.encodeStateVector(doc);
}

/**
 * Compute the diff between local state and a remote state vector.
 */
export function computeDiff(doc: Y.Doc, remoteStateVector: Uint8Array): Uint8Array {
	return Y.encodeStateAsUpdate(doc, remoteStateVector);
}

/**
 * Load initial document state from the server.
 */
export async function loadDocumentState(
	documentId: DocumentId,
	doc: Y.Doc
): Promise<void> {
	try {
		const response = await fetcher<{ state: string | null; version: number }>(
			`/documents/${documentId}/state`
		);

		if (response.state) {
			const update = base64Decode(response.state);
			Y.applyUpdate(doc, update, "server");
			log.info(` Loaded state for document ${documentId}, version ${response.version}`);
		} else {
			log.info(` No server state for document ${documentId}, starting fresh`);
		}
	} catch (error) {
		log.error(` Failed to load state for document ${documentId}:`, error);
		throw error;
	}
}

/**
 * Save document state to the server.
 */
export async function saveDocumentState(
	documentId: DocumentId,
	doc: Y.Doc
): Promise<{ version: number }> {
	const state = encodeDocumentStateToBase64(doc);

	const response = await fetcher<{ version: number }>(
		`/documents/${documentId}/state`,
		{
			method: "PUT",
			body: JSON.stringify({ state }),
		}
	);

	log.info(` Saved state for document ${documentId}, version ${response.version}`);
	return response;
}

/**
 * Merge remote state with local state.
 * Used for conflict resolution when reconnecting.
 */
export async function mergeWithServerState(
	documentId: DocumentId,
	doc: Y.Doc
): Promise<void> {
	try {
		// Get server state
		const response = await fetcher<{ state: string | null; version: number }>(
			`/documents/${documentId}/state`
		);

		if (response.state) {
			// Apply server state - Yjs CRDTs handle conflict resolution automatically
			const serverUpdate = base64Decode(response.state);
			Y.applyUpdate(doc, serverUpdate, "server-merge");

			// Compute and send our changes
			const ourChanges = computeDiff(doc, Y.encodeStateVector(doc));
			if (ourChanges.length > 0) {
				await saveDocumentState(documentId, doc);
			}
		}

		log.info(` Merged state for document ${documentId}`);
	} catch (error) {
		log.error(` Failed to merge state for document ${documentId}:`, error);
		throw error;
	}
}

/**
 * Subscribe to document updates.
 * Returns a cleanup function.
 */
export function onDocumentUpdate(
	doc: Y.Doc,
	callback: (update: Uint8Array, origin: unknown) => void
): () => void {
	const handler = (update: Uint8Array, origin: unknown) => {
		callback(update, origin);
	};

	doc.on("update", handler);

	return () => {
		doc.off("update", handler);
	};
}

/**
 * Create a document snapshot for version history.
 */
export function createSnapshot(doc: Y.Doc): Y.Snapshot {
	return Y.snapshot(doc);
}

/**
 * Restore document to a snapshot.
 * Creates a new document with the restored state.
 */
export function restoreFromSnapshot(doc: Y.Doc, snapshot: Y.Snapshot): Y.Doc {
	return Y.createDocFromSnapshot(doc, snapshot);
}

/**
 * Get document statistics.
 */
export function getDocumentStats(doc: Y.Doc): {
	stateSize: number;
	clientId: number;
} {
	const state = encodeDocumentState(doc);
	return {
		stateSize: state.byteLength,
		clientId: doc.clientID,
	};
}

/**
 * Check if a document has unsaved changes.
 * Compares current state with last known server state.
 */
export function hasUnsavedChanges(doc: Y.Doc, lastServerState: Uint8Array | null): boolean {
	if (!lastServerState) {
		// If we've never synced, check if document is empty
		const content = getDocumentFragment(doc);
		return content.length > 0;
	}

	// Compare state vectors
	const currentState = encodeDocumentState(doc);
	if (currentState.length !== lastServerState.length) {
		return true;
	}

	for (let i = 0; i < currentState.length; i++) {
		if (currentState[i] !== lastServerState[i]) {
			return true;
		}
	}

	return false;
}

/**
 * Utility: Encode Uint8Array to base64.
 */
function base64Encode(data: Uint8Array): string {
	if (typeof btoa === "function") {
		return btoa(String.fromCharCode(...data));
	}
	// Node.js fallback
	return Buffer.from(data).toString("base64");
}

/**
 * Utility: Decode base64 to Uint8Array.
 */
function base64Decode(base64: string): Uint8Array {
	if (typeof atob === "function") {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}
	// Node.js fallback
	return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * Export utilities for external use.
 */
export const yjsUtils = {
	base64Encode,
	base64Decode,
	encodeDocumentState,
	applyUpdate,
	getStateVector,
	computeDiff,
};
