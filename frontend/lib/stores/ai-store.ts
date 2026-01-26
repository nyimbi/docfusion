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
	AI_COMMANDS,
} from "@/lib/types/ai";

/** AI store state */
export interface AIState {
	// Command palette
	isCommandPaletteOpen: boolean;
	commandFilter: string;
	filteredCommands: AICommand[];

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
}

/** AI store actions */
export interface AIActions {
	// Command palette actions
	openCommandPalette: () => void;
	closeCommandPalette: () => void;
	setCommandFilter: (filter: string) => void;

	// Operation actions
	startOperation: (operation: AIOperation) => void;
	updateOperationStatus: (id: string, status: AIOperationStatus) => void;
	updateOperationProgress: (id: string, progress: number) => void;
	appendOperationResult: (id: string, delta: string) => void;
	completeOperation: (id: string, response: AICompletionResponse) => void;
	failOperation: (id: string, error: string) => void;
	cancelOperation: (id: string) => void;
	clearOperation: (id: string) => void;

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

	// Reset
	reset: () => void;
}

const initialState: AIState = {
	isCommandPaletteOpen: false,
	commandFilter: "",
	filteredCommands: [],
	activeOperations: new Map(),
	currentOperationId: null,
	showSuggestion: false,
	suggestionPosition: null,
	currentSuggestion: null,
	recentCommands: [],
	operationHistory: [],
	streamingEnabled: true,
	autoAcceptThreshold: 0.95,
};

// Import the commands constant at runtime to avoid circular dependency
let AI_COMMANDS_CACHE: AICommand[] | null = null;
async function getAICommands(): Promise<AICommand[]> {
	if (AI_COMMANDS_CACHE) return AI_COMMANDS_CACHE;
	const { AI_COMMANDS } = await import("@/lib/types/ai");
	AI_COMMANDS_CACHE = AI_COMMANDS;
	return AI_COMMANDS;
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
 * AI store for managing AI-related state.
 */
export const useAIStore = create<AIState & AIActions>()(
	immer((set, get) => ({
		...initialState,

		// Command palette actions
		openCommandPalette: () => {
			getAICommands().then((commands) => {
				set((state) => {
					state.isCommandPaletteOpen = true;
					state.commandFilter = "";
					state.filteredCommands = commands;
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
