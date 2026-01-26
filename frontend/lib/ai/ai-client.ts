/**
 * AI client for DocFusion.
 *
 * Provides API communication for AI-powered features including
 * slash commands, completions, and compliance checks.
 */

import { fetcher, fetcherStream } from "@/lib/api/client";
import type {
	AICompletionRequest,
	AICompletionResponse,
	AIStreamChunk,
	AIContext,
	AIFeedback,
	AIComplianceResult,
	AIWritingSuggestion,
	AIRequestId,
} from "@/lib/types/ai";

/** API base path for AI endpoints */
const AI_API_PATH = "/api/v1/ai";

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): AIRequestId {
	return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Execute an AI completion request.
 */
export async function executeCompletion(
	request: AICompletionRequest
): Promise<AICompletionResponse> {
	return fetcher<AICompletionResponse>(`${AI_API_PATH}/completion`, {
		method: "POST",
		body: JSON.stringify(request),
	});
}

/**
 * Execute a streaming AI completion request.
 * Returns an async generator that yields chunks.
 */
export async function* executeStreamingCompletion(
	request: AICompletionRequest
): AsyncGenerator<AIStreamChunk, void, undefined> {
	const stream = fetcherStream(`${AI_API_PATH}/completion/stream`, {
		method: "POST",
		body: JSON.stringify({
			...request,
			stream: true,
		}),
	});

	let accumulated = "";

	for await (const chunk of stream) {
		// Parse SSE data
		const lines = chunk.split("\n");
		for (const line of lines) {
			if (line.startsWith("data: ")) {
				const data = line.slice(6);
				if (data === "[DONE]") {
					yield {
						requestId: request.requestId,
						delta: "",
						isComplete: true,
						accumulated,
					};
					return;
				}

				try {
					const parsed = JSON.parse(data) as { delta: string };
					accumulated += parsed.delta;
					yield {
						requestId: request.requestId,
						delta: parsed.delta,
						isComplete: false,
						accumulated,
					};
				} catch {
					// Skip invalid JSON lines
				}
			}
		}
	}
}

/**
 * Execute an AI command with the given context.
 */
export async function executeCommand(
	command: string,
	context: AIContext,
	args?: Record<string, string | number>,
	options?: {
		stream?: boolean;
		maxTokens?: number;
		temperature?: number;
	}
): Promise<AICompletionResponse> {
	const request: AICompletionRequest = {
		requestId: generateRequestId(),
		command,
		arguments: args,
		context,
		stream: options?.stream,
		maxTokens: options?.maxTokens,
		temperature: options?.temperature,
	};

	return executeCompletion(request);
}

/**
 * Submit feedback for an AI response.
 */
export async function submitFeedback(feedback: AIFeedback): Promise<void> {
	await fetcher(`${AI_API_PATH}/feedback`, {
		method: "POST",
		body: JSON.stringify(feedback),
	});
}

/**
 * Check compliance of text.
 */
export async function checkCompliance(
	text: string,
	framework?: string,
	context?: Partial<AIContext>
): Promise<AIComplianceResult> {
	const request: AICompletionRequest = {
		requestId: generateRequestId(),
		command: "compliance",
		arguments: framework ? { framework } : undefined,
		context: {
			documentId: context?.documentId ?? "",
			textBefore: "",
			textAfter: "",
			selectedText: text,
			...context,
		},
	};

	return fetcher<AIComplianceResult>(`${AI_API_PATH}/compliance`, {
		method: "POST",
		body: JSON.stringify(request),
	});
}

/**
 * Get writing suggestions for text.
 */
export async function getWritingSuggestions(
	text: string,
	context?: Partial<AIContext>
): Promise<AIWritingSuggestion[]> {
	const request: AICompletionRequest = {
		requestId: generateRequestId(),
		command: "writing-suggestions",
		context: {
			documentId: context?.documentId ?? "",
			textBefore: "",
			textAfter: "",
			selectedText: text,
			...context,
		},
	};

	const response = await fetcher<{ suggestions: AIWritingSuggestion[] }>(
		`${AI_API_PATH}/writing-suggestions`,
		{
			method: "POST",
			body: JSON.stringify(request),
		}
	);

	return response.suggestions;
}

/**
 * Cancel an in-progress AI request.
 */
export async function cancelRequest(requestId: AIRequestId): Promise<void> {
	await fetcher(`${AI_API_PATH}/cancel/${requestId}`, {
		method: "POST",
	});
}

/**
 * AI client class for managing request state.
 */
export class AIClient {
	private abortControllers = new Map<AIRequestId, AbortController>();

	/**
	 * Execute a command with cancellation support.
	 */
	async execute(
		command: string,
		context: AIContext,
		args?: Record<string, string | number>,
		options?: {
			stream?: boolean;
			maxTokens?: number;
			temperature?: number;
			onChunk?: (chunk: AIStreamChunk) => void;
		}
	): Promise<AICompletionResponse> {
		const requestId = generateRequestId();
		const controller = new AbortController();
		this.abortControllers.set(requestId, controller);

		try {
			if (options?.stream && options.onChunk) {
				// Streaming mode
				let result = "";
				const request: AICompletionRequest = {
					requestId,
					command,
					arguments: args,
					context,
					stream: true,
					maxTokens: options.maxTokens,
					temperature: options.temperature,
				};

				for await (const chunk of executeStreamingCompletion(request)) {
					if (controller.signal.aborted) {
						throw new Error("Request cancelled");
					}
					options.onChunk(chunk);
					if (chunk.accumulated) {
						result = chunk.accumulated;
					}
				}

				return {
					requestId,
					result,
					confidence: 1,
					processingTime: 0,
				};
			} else {
				// Non-streaming mode
				return await executeCommand(command, context, args, options);
			}
		} finally {
			this.abortControllers.delete(requestId);
		}
	}

	/**
	 * Cancel a request by ID.
	 */
	cancel(requestId: AIRequestId): void {
		const controller = this.abortControllers.get(requestId);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(requestId);
			// Also notify server
			cancelRequest(requestId).catch(() => {});
		}
	}

	/**
	 * Cancel all in-progress requests.
	 */
	cancelAll(): void {
		this.abortControllers.forEach((controller, requestId) => {
			controller.abort();
			cancelRequest(requestId).catch(() => {});
		});
		this.abortControllers.clear();
	}
}

/** Default AI client instance */
export const aiClient = new AIClient();
