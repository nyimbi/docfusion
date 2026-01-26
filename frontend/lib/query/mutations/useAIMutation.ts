/**
 * AI mutation hooks using TanStack Query.
 *
 * Provides React hooks for executing AI commands with
 * proper loading states, error handling, and caching.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type {
	AIContext,
	AICompletionResponse,
	AIFeedback,
	AIStreamChunk,
} from "@/lib/types/ai";
import {
	executeCommand,
	submitFeedback,
	checkCompliance,
	getWritingSuggestions,
	aiClient,
	generateRequestId,
} from "@/lib/ai/ai-client";
import { commandRegistry } from "@/lib/ai/command-registry";
import { useAIStore, createAIOperation } from "@/lib/stores/ai-store";

/** Query keys for AI operations */
export const aiQueryKeys = {
	completion: (requestId: string) => ["ai", "completion", requestId] as const,
	compliance: (documentId: string) => ["ai", "compliance", documentId] as const,
	suggestions: (documentId: string) => ["ai", "suggestions", documentId] as const,
};

/**
 * Mutation variables for AI completion.
 */
export interface AICompletionVariables {
	command: string;
	context: AIContext;
	args?: Record<string, string | number>;
	stream?: boolean;
	maxTokens?: number;
	temperature?: number;
}

/**
 * Hook for executing AI completions.
 */
export function useAICompletion() {
	const { startOperation, completeOperation, failOperation } = useAIStore();
	const operationIdRef = useRef<string | null>(null);

	return useMutation({
		mutationFn: async (variables: AICompletionVariables) => {
			return executeCommand(
				variables.command,
				variables.context,
				variables.args,
				{
					stream: variables.stream,
					maxTokens: variables.maxTokens,
					temperature: variables.temperature,
				}
			);
		},
		onMutate: (variables) => {
			// Set pending state in store
			const operationId = generateRequestId();
			operationIdRef.current = operationId;

			const operation = createAIOperation(
				operationId,
				variables.command,
				variables.context.selectedText
					? { from: 0, to: 0 } // Would need actual position
					: undefined
			);
			startOperation(operation);
		},
		onSuccess: (response) => {
			if (operationIdRef.current) {
				completeOperation(operationIdRef.current, response);
			}
		},
		onError: (error: Error) => {
			if (operationIdRef.current) {
				failOperation(operationIdRef.current, error.message);
			}
		},
	});
}

/**
 * Hook for streaming AI completions.
 */
export function useStreamingAICompletion() {
	const { startOperation, appendOperationResult, completeOperation, failOperation } =
		useAIStore();
	const operationIdRef = useRef<string | null>(null);

	return useMutation({
		mutationFn: async ({
			command,
			context,
			args,
			onChunk,
		}: AICompletionVariables & {
			onChunk?: (chunk: AIStreamChunk) => void;
		}) => {
			return aiClient.execute(command, context, args, {
				stream: true,
				onChunk: (chunk) => {
					if (operationIdRef.current) {
						appendOperationResult(operationIdRef.current, chunk.delta);
					}
					onChunk?.(chunk);
				},
			});
		},
		onMutate: (variables) => {
			const operationId = generateRequestId();
			operationIdRef.current = operationId;

			const operation = createAIOperation(operationId, variables.command);
			operation.status = "streaming";
			startOperation(operation);
		},
		onSuccess: (response) => {
			if (operationIdRef.current) {
				completeOperation(operationIdRef.current, response);
			}
		},
		onError: (error: Error) => {
			if (operationIdRef.current) {
				failOperation(operationIdRef.current, error.message);
			}
		},
	});
}

/**
 * Hook for executing slash commands from string input.
 */
export function useSlashCommand() {
	const { startOperation, appendOperationResult, completeOperation, failOperation } =
		useAIStore();
	const operationIdRef = useRef<string | null>(null);

	return useMutation({
		mutationFn: async ({
			input,
			context,
			onChunk,
		}: {
			input: string;
			context: AIContext;
			onChunk?: (text: string, accumulated: string) => void;
		}) => {
			return commandRegistry.executeFromString(input, context, {
				stream: Boolean(onChunk),
				onChunk: (delta, accumulated) => {
					if (operationIdRef.current) {
						appendOperationResult(operationIdRef.current, delta);
					}
					onChunk?.(delta, accumulated);
				},
			});
		},
		onMutate: (variables) => {
			const parsed = variables.input.match(/^\/(\w+)/);
			const command = parsed ? parsed[1] : "unknown";
			const operationId = generateRequestId();
			operationIdRef.current = operationId;

			const operation = createAIOperation(operationId, command);
			startOperation(operation);
		},
		onSuccess: (result) => {
			if (operationIdRef.current) {
				if (result.success) {
					completeOperation(operationIdRef.current, {
						requestId: operationIdRef.current,
						result: result.result ?? "",
						confidence: result.confidence ?? 1,
						processingTime: result.processingTime ?? 0,
					});
				} else {
					failOperation(operationIdRef.current, result.error ?? "Command failed");
				}
			}
		},
		onError: (error: Error) => {
			if (operationIdRef.current) {
				failOperation(operationIdRef.current, error.message);
			}
		},
	});
}

/**
 * Hook for submitting AI feedback.
 */
export function useAIFeedback() {
	return useMutation({
		mutationFn: (feedback: AIFeedback) => submitFeedback(feedback),
	});
}

/**
 * Hook for checking document compliance.
 */
export function useComplianceCheck() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			text,
			framework,
			context,
		}: {
			text: string;
			framework?: string;
			context?: Partial<AIContext>;
		}) => {
			return checkCompliance(text, framework, context);
		},
		onSuccess: (data, variables) => {
			// Cache the result
			if (variables.context?.documentId) {
				queryClient.setQueryData(
					aiQueryKeys.compliance(variables.context.documentId),
					data
				);
			}
		},
	});
}

/**
 * Hook for getting writing suggestions.
 */
export function useWritingSuggestions() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			text,
			context,
		}: {
			text: string;
			context?: Partial<AIContext>;
		}) => {
			return getWritingSuggestions(text, context);
		},
		onSuccess: (data, variables) => {
			// Cache the result
			if (variables.context?.documentId) {
				queryClient.setQueryData(
					aiQueryKeys.suggestions(variables.context.documentId),
					data
				);
			}
		},
	});
}

/**
 * Hook to cancel the current AI operation.
 */
export function useCancelAIOperation() {
	const currentOperationId = useAIStore((s) => s.currentOperationId);
	const cancelOperation = useAIStore((s) => s.cancelOperation);

	return () => {
		aiClient.cancelAll();
		if (currentOperationId) {
			cancelOperation(currentOperationId);
		}
	};
}

/**
 * Hook to apply an AI suggestion to the editor.
 */
export function useApplyAISuggestion() {
	const currentOperationId = useAIStore((s) => s.currentOperationId);
	const clearOperation = useAIStore((s) => s.clearOperation);
	const hideSuggestionUI = useAIStore((s) => s.hideSuggestionUI);

	return useMutation({
		mutationFn: async ({
			requestId,
			text,
			position,
			editor,
		}: {
			requestId: string;
			text: string;
			position: { from: number; to: number };
			editor: {
				commands: {
					insertContentAt: (
						pos: { from: number; to: number },
						content: string
					) => boolean;
				};
			};
		}) => {
			// Apply the text to the editor
			editor.commands.insertContentAt(position, text);

			// Submit positive feedback
			await submitFeedback({
				requestId,
				action: "accept",
			});

			return { applied: true };
		},
		onSuccess: () => {
			hideSuggestionUI();
			if (currentOperationId) {
				clearOperation(currentOperationId);
			}
		},
	});
}

/**
 * Hook to reject an AI suggestion.
 */
export function useRejectAISuggestion() {
	const currentOperationId = useAIStore((s) => s.currentOperationId);
	const clearOperation = useAIStore((s) => s.clearOperation);
	const hideSuggestionUI = useAIStore((s) => s.hideSuggestionUI);

	return useMutation({
		mutationFn: async ({ requestId }: { requestId: string }) => {
			await submitFeedback({
				requestId,
				action: "reject",
			});
			return { rejected: true };
		},
		onSuccess: () => {
			hideSuggestionUI();
			if (currentOperationId) {
				clearOperation(currentOperationId);
			}
		},
	});
}
