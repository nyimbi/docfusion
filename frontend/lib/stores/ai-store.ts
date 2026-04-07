"use client";

/**
 * AI state management with Zustand.
 *
 * Manages AI command execution, pending operations,
 * streaming responses, and suggestion history.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
	AIOperation,
	AIOperationStatus,
	AICommand,
	AICompletionResponse,
	AIAlternative,
	AIFeedback,
	AICompletionRequest,
	AIContext,
	AIRequestId,
	AIStreamChunk,
} from "@/lib/types/ai";
import {
	AUTO_ACCEPT_THRESHOLD,
	DEFAULT_AI_ENDPOINT,
	OPERATION_HISTORY_LIMIT,
	RECENT_COMMANDS_LIMIT,
	STREAM_DEFAULT_CONFIDENCE,
} from "@/lib/ai/constants";
import { logger } from "@/lib/utils/logger";

/** AI store state */
export interface AIState {
	// Command palette
	isCommandPaletteOpen: boolean;
	commandFilter: string;
	filteredCommands: AICommand[];
	pendingCommand: AICommand | null;

	// Active operations
	activeOperations: Map<string, AIOperation>;
	currentOperationId: string | null;

	// Suggestion UI
	showSuggestion: boolean;
	suggestionPosition: { x: number; y: number } | null;
	currentSuggestion: {
		requestId: string;
		result: string;
		alternatives: AIAlternative[];
		insertPosition: { from: number; to: number };
	} | null;

	// History
	recentCommands: string[];
	operationHistory: AIOperation[];

	// Settings
	streamingEnabled: boolean;
	autoAcceptThreshold: number; // 0-1, auto-accept if confidence > threshold
	// API endpoint
	apiEndpoint: string;
}

/** AI store actions */
export interface AIActions {
	// Command palette actions
	openCommandPalette: (initialCommand?: string) => void;
	closeCommandPalette: () => void;
	setCommandFilter: (filter: string) => void;
	setPendingCommand: (command: AICommand | null) => void;

	// Operation actions
	startOperation: (operation: AIOperation) => void;
	updateOperationStatus: (id: string, status: AIOperationStatus) => void;
	updateOperationProgress: (id: string, progress: number) => void;
	appendOperationResult: (id: string, delta: string) => void;
	completeOperation: (id: string, response: AICompletionResponse) => void;
	failOperation: (id: string, error: string) => void;
	cancelOperation: (id: string) => void;
	clearOperation: (id: string) => void;

	// AI API actions
	generateCompletion: (
		request: Omit<AICompletionRequest, "requestId">,
		options?: { onChunk?: (chunk: AIStreamChunk) => void; onComplete?: (response: AICompletionResponse) => void; onError?: (error: string) => void }
	) => Promise<void>;
	streamCompletion: (
		request: AICompletionRequest,
		onChunk: (chunk: AIStreamChunk) => void
	) => Promise<AICompletionResponse>;

	// Suggestion actions
	showSuggestionUI: (
		requestId: string,
		result: string,
		alternatives: AIAlternative[],
		insertPosition: { from: number; to: number },
		position: { x: number; y: number }
	) => void;
	hideSuggestionUI: () => void;
	acceptSuggestion: () => AIFeedback | null;
	rejectSuggestion: () => AIFeedback | null;
	selectAlternative: (index: number) => void;

	// History actions
	addToRecentCommands: (command: string) => void;
	clearRecentCommands: () => void;
	clearOperationHistory: () => void;

	// Settings actions
	setStreamingEnabled: (enabled: boolean) => void;
	setAutoAcceptThreshold: (threshold: number) => void;
	setApiEndpoint: (endpoint: string) => void;

	// Reset
	reset: () => void;
}

const initialState: AIState = {
	isCommandPaletteOpen: false,
	commandFilter: "",
	filteredCommands: [],
	pendingCommand: null,
	activeOperations: new Map(),
	currentOperationId: null,
	showSuggestion: false,
	suggestionPosition: null,
	currentSuggestion: null,
	recentCommands: [],
	operationHistory: [],
	streamingEnabled: true,
	autoAcceptThreshold: AUTO_ACCEPT_THRESHOLD,
	apiEndpoint: DEFAULT_AI_ENDPOINT,
};

// Import the commands constant at runtime to avoid circular dependency
let AI_COMMANDS_CACHE: AICommand[] | null = null;
async function getAICommands(): Promise<AICommand[]> {
	if (AI_COMMANDS_CACHE) return AI_COMMANDS_CACHE;
	try {
		const aiModule = await import("@/lib/types/ai");
		const commands = aiModule.AI_COMMANDS;
		if (!commands || !Array.isArray(commands)) {
			logger.error("AI_COMMANDS not found or invalid in ai module");
			return [];
		}
		AI_COMMANDS_CACHE = commands;
		return commands;
	} catch (error) {
		logger.error("Failed to load AI commands:", error);
		return [];
	}
}

/**
 * Filter commands based on search query.
 */
function filterCommands(commands: AICommand[], query: string): AICommand[] {
	if (!query) return commands;
	const lowerQuery = query.toLowerCase();
	return commands.filter(
		(cmd) =>
			cmd.name.toLowerCase().includes(lowerQuery) ||
			cmd.label.toLowerCase().includes(lowerQuery) ||
			cmd.description.toLowerCase().includes(lowerQuery) ||
			cmd.category.toLowerCase().includes(lowerQuery)
	);
}

/**
 * Generate a unique request ID.
 */
function generateRequestId(): AIRequestId {
	return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * AI store for managing AI-related state.
 */
export const useAIStore = create<AIState & AIActions>()(
	immer((set, get) => ({
		...initialState,

		// Command palette actions
		openCommandPalette: (initialCommand?: string) => {
			getAICommands().then((commands) => {
				set((state) => {
					state.isCommandPaletteOpen = true;
					if (initialCommand) {
						state.commandFilter = initialCommand;
						state.filteredCommands = filterCommands(commands, initialCommand);
						// Set pending command if exact match
						const exactMatch = commands.find((cmd) => cmd.name === initialCommand);
						if (exactMatch) {
							state.pendingCommand = exactMatch;
						}
					} else {
						state.commandFilter = "";
						state.filteredCommands = commands;
					}
				});
			});
		},

		closeCommandPalette: () =>
			set((state) => {
				state.isCommandPaletteOpen = false;
				state.commandFilter = "";
				state.filteredCommands = [];
			}),

		setCommandFilter: (filter) => {
			getAICommands().then((commands) => {
				set((state) => {
					state.commandFilter = filter;
					state.filteredCommands = filterCommands(commands, filter);
				});
			});
		},

		setPendingCommand: (command) =>
			set((state) => {
				state.pendingCommand = command;
			}),

		// Operation actions
		startOperation: (operation) =>
			set((state) => {
				state.activeOperations.set(operation.id, operation);
				state.currentOperationId = operation.id;
			}),

		updateOperationStatus: (id, status) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.status = status;
				}
			}),

		updateOperationProgress: (id, progress) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.progress = Math.max(0, Math.min(100, progress));
				}
			}),

		appendOperationResult: (id, delta) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.result += delta;
					op.status = "streaming";
				}
			}),

		completeOperation: (id, response) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.status = "completed";
					op.result = response.result;
					op.completedAt = new Date().toISOString();
					op.progress = 100;

					// Add to history
					state.operationHistory.unshift({ ...op });
					// Keep only last 50 operations
					if (state.operationHistory.length > 50) {
						state.operationHistory.pop();
					}
				}
			}),

		failOperation: (id, error) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.status = "error";
					op.error = error;
					op.completedAt = new Date().toISOString();
				}
			}),

		cancelOperation: (id) =>
			set((state) => {
				const op = state.activeOperations.get(id);
				if (op) {
					op.status = "cancelled";
					op.completedAt = new Date().toISOString();
				}
			}),

		clearOperation: (id) =>
			set((state) => {
				state.activeOperations.delete(id);
				if (state.currentOperationId === id) {
					state.currentOperationId = null;
				}
			}),

		// AI API actions
		generateCompletion: async (request, options = {}) => {
			const { onChunk, onComplete, onError } = options;
			const requestId = generateRequestId();
			
			// Build the complete request
			const fullRequest: AICompletionRequest = {
				...request,
				requestId,
			};

			// Start operation tracking
			const operation: AIOperation = {
				id: requestId,
				command: request.command,
				status: "pending",
				result: "",
				startedAt: new Date().toISOString(),
				insertPosition: undefined,
			};

			get().startOperation(operation);

			try {
				if (get().streamingEnabled && request.stream !== false) {
					// Streaming completion
					await get().streamCompletion(
						fullRequest,
						(chunk) => {
							if (chunk.delta) {
								get().appendOperationResult(requestId, chunk.delta);
							}
							onChunk?.(chunk);
						}
					);
				} else {
					// Non-streaming completion
					const response = await fetch(get().apiEndpoint, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(fullRequest),
					});

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
						throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
					}

					const result: AICompletionResponse = await response.json();
					get().completeOperation(requestId, result);
					onComplete?.(result);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				get().failOperation(requestId, errorMessage);
				onError?.(errorMessage);
				throw error;
			}
		},

		streamCompletion: async (request, onChunk) => {
			const response = await fetch(get().apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
				body: JSON.stringify({ ...request, stream: true }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let accumulatedText = "";
			let buffer = "";

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith("data: ")) continue;

						const data = trimmed.slice(6);
						if (data === "[DONE]") continue;

						try {
							const chunk: AIStreamChunk = JSON.parse(data);
							accumulatedText += chunk.delta || "";
							onChunk({
								...chunk,
								accumulated: accumulatedText,
							});
						} catch {
							// Ignore parsing errors for non-JSON lines
						}
					}
				}

				// Process any remaining buffer
				if (buffer.trim()) {
					const trimmed = buffer.trim();
					if (trimmed.startsWith("data: ")) {
						const data = trimmed.slice(6);
						if (data !== "[DONE]") {
							try {
								const chunk: AIStreamChunk = JSON.parse(data);
								accumulatedText += chunk.delta || "";
							} catch {
								// Ignore
							}
						}
					}
				}
			} finally {
				reader.releaseLock();
			}

			// Return final response
			return {
				requestId: request.requestId,
				result: accumulatedText,
				confidence: 0.9,
				processingTime: Date.now() - new Date(get().activeOperations.get(request.requestId)?.startedAt || Date.now()).getTime(),
			};
		},

		// Suggestion actions
		showSuggestionUI: (requestId, result, alternatives, insertPosition, position) =>
			set((state) => {
				state.showSuggestion = true;
				state.suggestionPosition = position;
				state.currentSuggestion = {
					requestId,
					result,
					alternatives,
					insertPosition,
				};
			}),

		hideSuggestionUI: () =>
			set((state) => {
				state.showSuggestion = false;
				state.suggestionPosition = null;
				state.currentSuggestion = null;
			}),

		acceptSuggestion: () => {
			const state = get();
			if (!state.currentSuggestion) return null;

			const feedback: AIFeedback = {
				requestId: state.currentSuggestion.requestId,
				action: "accept",
			};

			set((s) => {
				s.showSuggestion = false;
				s.suggestionPosition = null;
				s.currentSuggestion = null;
			});

			return feedback;
		},

		rejectSuggestion: () => {
			const state = get();
			if (!state.currentSuggestion) return null;

			const feedback: AIFeedback = {
				requestId: state.currentSuggestion.requestId,
				action: "reject",
			};

			set((s) => {
				s.showSuggestion = false;
				s.suggestionPosition = null;
				s.currentSuggestion = null;
			});

			return feedback;
		},

		selectAlternative: (index) =>
			set((state) => {
				if (state.currentSuggestion && state.currentSuggestion.alternatives[index]) {
					state.currentSuggestion.result =
						state.currentSuggestion.alternatives[index].text;
				}
			}),

		// History actions
		addToRecentCommands: (command) =>
			set((state) => {
				// Remove if exists and add to front
				const index = state.recentCommands.indexOf(command);
				if (index !== -1) {
					state.recentCommands.splice(index, 1);
				}
				state.recentCommands.unshift(command);
				// Keep only last 10
				if (state.recentCommands.length > 10) {
					state.recentCommands.pop();
				}
			}),

		clearRecentCommands: () =>
			set((state) => {
				state.recentCommands = [];
			}),

		clearOperationHistory: () =>
			set((state) => {
				state.operationHistory = [];
			}),

		// Settings actions
		setStreamingEnabled: (enabled) =>
			set((state) => {
				state.streamingEnabled = enabled;
			}),

		setAutoAcceptThreshold: (threshold) =>
			set((state) => {
				state.autoAcceptThreshold = Math.max(0, Math.min(1, threshold));
			}),

		setApiEndpoint: (endpoint) =>
			set((state) => {
				state.apiEndpoint = endpoint;
			}),

		// Reset
		reset: () => set(initialState),
	}))
);

/**
 * Selector hooks for common state slices.
 */
export const useIsCommandPaletteOpen = () =>
	useAIStore((s) => s.isCommandPaletteOpen);

export const useFilteredCommands = () => useAIStore((s) => s.filteredCommands);

export const useCurrentOperation = () => {
	const currentId = useAIStore((s) => s.currentOperationId);
	const operations = useAIStore((s) => s.activeOperations);
	return currentId ? operations.get(currentId) ?? null : null;
};

export const useHasActiveOperation = () =>
	useAIStore((s) => {
		for (const op of s.activeOperations.values()) {
			if (op.status === "pending" || op.status === "streaming") {
				return true;
			}
		}
		return false;
	});

export const useCurrentSuggestion = () =>
	useAIStore((s) => ({
		show: s.showSuggestion,
		position: s.suggestionPosition,
		suggestion: s.currentSuggestion,
	}));

export const useRecentCommands = () => useAIStore((s) => s.recentCommands);

/**
 * Create a new AI operation object.
 */
export function createAIOperation(
	id: string,
	command: string,
	insertPosition?: { from: number; to: number }
): AIOperation {
	return {
		id,
		command,
		status: "pending",
		result: "",
		startedAt: new Date().toISOString(),
		insertPosition,
	};
}
