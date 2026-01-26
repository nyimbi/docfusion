/**
 * Autosave functionality for the document editor.
 *
 * Provides debounced saving with offline support and conflict detection.
 */

import type { DocumentContent, DocumentId } from "@/lib/types/document";

/** Autosave status states */
export type AutosaveStatus =
	| "idle"
	| "pending"
	| "saving"
	| "saved"
	| "error"
	| "offline"
	| "conflict";

/** Error details for failed saves */
export interface AutosaveError {
	message: string;
	code?: string;
	retryable: boolean;
	timestamp: number;
}

/** Autosave configuration options */
export interface AutosaveOptions {
	/** Debounce delay in milliseconds (default: 2000) */
	debounceMs?: number;
	/** Maximum time between saves in milliseconds (default: 30000) */
	maxDelayMs?: number;
	/** Number of retry attempts (default: 3) */
	maxRetries?: number;
	/** Delay between retries in milliseconds (default: 1000) */
	retryDelayMs?: number;
	/** Enable offline queue (default: true) */
	enableOfflineQueue?: boolean;
	/** Storage key for offline queue (default: "docfusion-autosave-queue") */
	offlineQueueKey?: string;
}

/** Callback for save operations */
export type SaveCallback = (
	documentId: DocumentId,
	content: DocumentContent
) => Promise<void>;

/** Autosave state change listener */
export type AutosaveListener = (
	status: AutosaveStatus,
	error?: AutosaveError
) => void;

/** Offline queue entry */
interface OfflineQueueEntry {
	documentId: DocumentId;
	content: DocumentContent;
	timestamp: number;
	attempts: number;
}

/**
 * Autosave manager for a single document.
 *
 * Features:
 * - Debounced saves to reduce server load
 * - Maximum delay to ensure periodic saves
 * - Retry logic for transient failures
 * - Offline queue with IndexedDB/localStorage fallback
 * - Conflict detection (server version changed)
 *
 * @example
 * const autosave = new Autosave("doc-123", saveToServer, {
 *   debounceMs: 2000,
 *   maxRetries: 3,
 * });
 *
 * autosave.onStatusChange((status) => {
 *   setStatusText(status);
 * });
 *
 * // In editor onChange:
 * autosave.schedulesSave(newContent);
 *
 * // On unmount:
 * autosave.destroy();
 */
export class Autosave {
	private documentId: DocumentId;
	private saveCallback: SaveCallback;
	private options: Required<AutosaveOptions>;

	private status: AutosaveStatus = "idle";
	private error: AutosaveError | null = null;
	private listeners: Set<AutosaveListener> = new Set();

	private pendingContent: DocumentContent | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private maxDelayTimer: ReturnType<typeof setTimeout> | null = null;
	private lastSaveTime: number = 0;
	private retryCount: number = 0;
	private isOnline: boolean = true;

	constructor(
		documentId: DocumentId,
		saveCallback: SaveCallback,
		options: AutosaveOptions = {}
	) {
		this.documentId = documentId;
		this.saveCallback = saveCallback;
		this.options = {
			debounceMs: options.debounceMs ?? 2000,
			maxDelayMs: options.maxDelayMs ?? 30000,
			maxRetries: options.maxRetries ?? 3,
			retryDelayMs: options.retryDelayMs ?? 1000,
			enableOfflineQueue: options.enableOfflineQueue ?? true,
			offlineQueueKey: options.offlineQueueKey ?? "docfusion-autosave-queue",
		};

		// Set up online/offline detection
		if (typeof window !== "undefined") {
			this.isOnline = navigator.onLine;
			window.addEventListener("online", this.handleOnline);
			window.addEventListener("offline", this.handleOffline);
		}
	}

	/**
	 * Schedule a save for the given content.
	 * Will debounce rapid updates.
	 */
	scheduleSave(content: DocumentContent): void {
		this.pendingContent = content;
		this.setStatus("pending");

		// Clear existing debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		// Start max delay timer if not already running
		if (!this.maxDelayTimer) {
			this.maxDelayTimer = setTimeout(() => {
				this.executeSave();
			}, this.options.maxDelayMs);
		}

		// Start debounce timer
		this.debounceTimer = setTimeout(() => {
			this.executeSave();
		}, this.options.debounceMs);
	}

	/**
	 * Force an immediate save, bypassing debounce.
	 */
	async saveNow(): Promise<void> {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		await this.executeSave();
	}

	/**
	 * Cancel any pending save.
	 */
	cancel(): void {
		this.clearTimers();
		this.pendingContent = null;
		this.setStatus("idle");
	}

	/**
	 * Register a status change listener.
	 */
	onStatusChange(listener: AutosaveListener): () => void {
		this.listeners.add(listener);
		// Immediately call with current status
		listener(this.status, this.error ?? undefined);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Get current status.
	 */
	getStatus(): AutosaveStatus {
		return this.status;
	}

	/**
	 * Get current error, if any.
	 */
	getError(): AutosaveError | null {
		return this.error;
	}

	/**
	 * Check if there are unsaved changes.
	 */
	hasUnsavedChanges(): boolean {
		return this.pendingContent !== null || this.status === "pending";
	}

	/**
	 * Cleanup resources.
	 */
	destroy(): void {
		this.clearTimers();

		if (typeof window !== "undefined") {
			window.removeEventListener("online", this.handleOnline);
			window.removeEventListener("offline", this.handleOffline);
		}

		// Save any pending content to offline queue before destroying
		if (this.pendingContent && this.options.enableOfflineQueue) {
			this.queueOffline(this.pendingContent);
		}

		this.listeners.clear();
	}

	// Private methods

	private async executeSave(): Promise<void> {
		this.clearTimers();

		const content = this.pendingContent;
		if (!content) {
			this.setStatus("idle");
			return;
		}

		// Check if offline
		if (!this.isOnline) {
			if (this.options.enableOfflineQueue) {
				this.queueOffline(content);
				this.pendingContent = null;
				this.setStatus("offline");
			}
			return;
		}

		this.setStatus("saving");

		try {
			await this.saveCallback(this.documentId, content);

			// Success
			this.pendingContent = null;
			this.lastSaveTime = Date.now();
			this.retryCount = 0;
			this.error = null;
			this.setStatus("saved");

			// Reset to idle after a brief display of "saved"
			setTimeout(() => {
				if (this.status === "saved") {
					this.setStatus("idle");
				}
			}, 2000);
		} catch (err) {
			await this.handleSaveError(err, content);
		}
	}

	private async handleSaveError(
		err: unknown,
		content: DocumentContent
	): Promise<void> {
		const error = this.parseError(err);
		this.error = error;

		// Check for conflict (409 status)
		if (error.code === "CONFLICT") {
			this.setStatus("conflict");
			return;
		}

		// Retry if retryable and within retry limit
		if (error.retryable && this.retryCount < this.options.maxRetries) {
			this.retryCount++;
			await this.sleep(this.options.retryDelayMs * this.retryCount);

			// Re-attempt save
			await this.executeSave();
			return;
		}

		// Queue offline if enabled
		if (this.options.enableOfflineQueue) {
			this.queueOffline(content);
			this.pendingContent = null;
		}

		this.setStatus("error");
	}

	private parseError(err: unknown): AutosaveError {
		if (err instanceof Error) {
			// Check for specific error types
			const message = err.message.toLowerCase();

			if (message.includes("conflict") || message.includes("409")) {
				return {
					message: "Document was modified elsewhere",
					code: "CONFLICT",
					retryable: false,
					timestamp: Date.now(),
				};
			}

			if (
				message.includes("network") ||
				message.includes("fetch") ||
				message.includes("timeout")
			) {
				return {
					message: "Network error",
					code: "NETWORK",
					retryable: true,
					timestamp: Date.now(),
				};
			}

			return {
				message: err.message,
				retryable: true,
				timestamp: Date.now(),
			};
		}

		return {
			message: "Unknown error",
			retryable: true,
			timestamp: Date.now(),
		};
	}

	private setStatus(status: AutosaveStatus): void {
		this.status = status;
		this.listeners.forEach((listener) =>
			listener(status, this.error ?? undefined)
		);
	}

	private clearTimers(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.maxDelayTimer) {
			clearTimeout(this.maxDelayTimer);
			this.maxDelayTimer = null;
		}
	}

	private handleOnline = (): void => {
		this.isOnline = true;
		// Try to flush offline queue
		this.flushOfflineQueue();
	};

	private handleOffline = (): void => {
		this.isOnline = false;
		if (this.status === "saving" || this.status === "pending") {
			this.setStatus("offline");
		}
	};

	private queueOffline(content: DocumentContent): void {
		if (typeof localStorage === "undefined") return;

		try {
			const queue = this.getOfflineQueue();
			const entry: OfflineQueueEntry = {
				documentId: this.documentId,
				content,
				timestamp: Date.now(),
				attempts: 0,
			};

			// Replace existing entry for same document
			const index = queue.findIndex((e) => e.documentId === this.documentId);
			if (index >= 0) {
				queue[index] = entry;
			} else {
				queue.push(entry);
			}

			localStorage.setItem(this.options.offlineQueueKey, JSON.stringify(queue));
		} catch (err) {
			console.error("Failed to queue offline:", err);
		}
	}

	private getOfflineQueue(): OfflineQueueEntry[] {
		if (typeof localStorage === "undefined") return [];

		try {
			const data = localStorage.getItem(this.options.offlineQueueKey);
			return data ? JSON.parse(data) : [];
		} catch {
			return [];
		}
	}

	private async flushOfflineQueue(): Promise<void> {
		const queue = this.getOfflineQueue();
		if (queue.length === 0) return;

		const remaining: OfflineQueueEntry[] = [];

		for (const entry of queue) {
			try {
				await this.saveCallback(entry.documentId, entry.content);
			} catch {
				entry.attempts++;
				if (entry.attempts < this.options.maxRetries) {
					remaining.push(entry);
				}
			}
		}

		if (remaining.length > 0) {
			localStorage.setItem(
				this.options.offlineQueueKey,
				JSON.stringify(remaining)
			);
		} else {
			localStorage.removeItem(this.options.offlineQueueKey);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Create an autosave instance with default options.
 */
export function createAutosave(
	documentId: DocumentId,
	saveCallback: SaveCallback,
	options?: AutosaveOptions
): Autosave {
	return new Autosave(documentId, saveCallback, options);
}

/**
 * React hook for autosave functionality.
 *
 * @example
 * const { status, error, scheduleSave, saveNow } = useAutosave(
 *   documentId,
 *   async (id, content) => {
 *     await saveDocument(id, content);
 *   }
 * );
 *
 * // In editor onChange:
 * scheduleSave(newContent);
 */
import * as React from "react";

export function useAutosave(
	documentId: DocumentId | null | undefined,
	saveCallback: SaveCallback,
	options?: AutosaveOptions
) {
	const [status, setStatus] = React.useState<AutosaveStatus>("idle");
	const [error, setError] = React.useState<AutosaveError | null>(null);
	const autosaveRef = React.useRef<Autosave | null>(null);

	// Create/recreate autosave when documentId changes
	React.useEffect(() => {
		if (!documentId) {
			autosaveRef.current = null;
			setStatus("idle");
			setError(null);
			return;
		}

		const autosave = new Autosave(documentId, saveCallback, options);
		autosaveRef.current = autosave;

		const unsubscribe = autosave.onStatusChange((newStatus, newError) => {
			setStatus(newStatus);
			setError(newError ?? null);
		});

		return () => {
			unsubscribe();
			autosave.destroy();
		};
	}, [documentId, saveCallback, options]);

	const scheduleSave = React.useCallback((content: DocumentContent) => {
		autosaveRef.current?.scheduleSave(content);
	}, []);

	const saveNow = React.useCallback(async () => {
		await autosaveRef.current?.saveNow();
	}, []);

	const cancel = React.useCallback(() => {
		autosaveRef.current?.cancel();
	}, []);

	const hasUnsavedChanges = React.useCallback(() => {
		return autosaveRef.current?.hasUnsavedChanges() ?? false;
	}, []);

	return {
		status,
		error,
		scheduleSave,
		saveNow,
		cancel,
		hasUnsavedChanges,
	};
}

/**
 * Hook to warn user about unsaved changes on navigation.
 */
export function useUnsavedChangesWarning(hasChanges: boolean) {
	React.useEffect(() => {
		if (!hasChanges) return;

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
			return "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasChanges]);
}
