/**
 * LLM Provider Interface - DocFusion
 *
 * Unified provider abstraction that decouples consumer code from specific LLM
 * backends. Any provider (Azure OpenAI, Ollama, OpenAI direct, Anthropic, etc.)
 * implements this interface, enabling provider swapping via configuration
 * without code changes.
 *
 * Design notes:
 *   - `complete()` accepts a plain prompt string plus options rather than forcing
 *     callers to construct a messages array. The provider is responsible for
 *     wrapping the prompt into whatever message format its backend requires.
 *   - `completeChat()` preserves multi-turn conversation support for callers
 *     that need fine-grained message control.
 *   - `stream()` / `streamChat()` mirror the non-streaming variants but yield
 *     incremental chunks via AsyncIterable.
 *   - `embeddings()` is optional because not every backend supports it.
 *   - Types intentionally overlap with the existing `AIProvider` / `AIProviderRequest`
 *     / `AIProviderResponse` types in `types.ts`. Future work will migrate existing
 *     providers to implement `LLMProvider` directly; the overlap makes that migration
 *     straightforward.
 */

import type { AIProviderType, ChatMessage, MessageRole } from "./types";

// ============================================================================
// Request / Response Types
// ============================================================================

/**
 * Options for controlling completion behavior.
 * Every field is optional; providers apply sensible defaults.
 */
export interface CompletionOptions {
	/** Model or deployment name override. */
	model?: string;
	/** Sampling temperature (0 = deterministic, 1 = creative). */
	temperature?: number;
	/** Maximum tokens in the generated response. */
	maxTokens?: number;
	/** Nucleus sampling probability mass. */
	topP?: number;
	/** Stop sequences that halt generation. */
	stop?: string[];
	/** System-level instruction prepended to the conversation. */
	systemPrompt?: string;
	/** Penalize repeated token frequencies. */
	frequencyPenalty?: number;
	/** Penalize tokens already present in the prompt. */
	presencePenalty?: number;
}

/**
 * Result of a non-streaming completion call.
 */
export interface CompletionResult {
	/** The generated text. */
	content: string;
	/** Model identifier used for generation. */
	model: string;
	/** Token usage breakdown (when the provider reports it). */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** Why the model stopped generating. */
	finishReason?: "stop" | "length" | "content_filter" | "error";
	/** Wall-clock latency of the provider call in milliseconds. */
	latencyMs?: number;
}

/**
 * A single incremental chunk emitted during streaming.
 */
export interface StreamChunk {
	/** New text fragment appended since the last chunk. */
	delta: string;
	/** Whether this is the final chunk in the stream. */
	isComplete: boolean;
	/** Set on the final chunk to indicate why generation stopped. */
	finishReason?: "stop" | "length" | "content_filter" | "error" | null;
}

/**
 * Options for embedding generation.
 */
export interface EmbeddingOptions {
	/** Model override for embedding generation. */
	model?: string;
	/** Target dimensionality (for models that support it, e.g. text-embedding-3-*). */
	dimensions?: number;
}

/**
 * Result of an embedding request.
 */
export interface EmbeddingResult {
	/** One embedding vector per input text. */
	embeddings: number[][];
	/** Model used for embedding. */
	model: string;
	/** Token usage. */
	usage?: {
		promptTokens: number;
		totalTokens: number;
	};
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Unified LLM provider contract.
 *
 * Implementations handle provider-specific protocol details (REST endpoints,
 * authentication, streaming wire formats) while consumers interact through
 * this stable interface.
 */
export interface LLMProvider {
	/** Human-readable provider identifier (e.g. "azure-openai", "ollama"). */
	readonly name: string;

	/**
	 * Synchronous best-effort availability indicator.
	 *
	 * Returns `true` when the provider's required configuration (API keys,
	 * endpoints, etc.) is present. This does NOT guarantee the remote service
	 * is reachable -- use `healthCheck()` for that.
	 */
	readonly isConfigured: boolean;

	// ── Completions ──────────────────────────────────────────────────────

	/**
	 * Generate a completion from a single prompt string.
	 *
	 * The provider wraps the prompt into an appropriate message format
	 * (e.g. `[{ role: "user", content: prompt }]`). If `options.systemPrompt`
	 * is provided, it is prepended as a system message.
	 */
	complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;

	/**
	 * Generate a completion from an explicit message array.
	 *
	 * Use this when you need full control over the conversation history
	 * (multi-turn, few-shot examples, etc.).
	 */
	completeChat(
		messages: ChatMessage[],
		options?: CompletionOptions,
	): Promise<CompletionResult>;

	// ── Streaming ────────────────────────────────────────────────────────

	/**
	 * Stream a completion from a single prompt string.
	 */
	stream(prompt: string, options?: CompletionOptions): AsyncIterable<StreamChunk>;

	/**
	 * Stream a completion from an explicit message array.
	 */
	streamChat(
		messages: ChatMessage[],
		options?: CompletionOptions,
	): AsyncIterable<StreamChunk>;

	// ── Embeddings (optional) ────────────────────────────────────────────

	/**
	 * Generate embedding vectors for one or more texts.
	 *
	 * Not every provider supports embeddings. Callers should check for the
	 * method's existence or catch if it throws `UnsupportedOperationError`.
	 */
	embeddings?(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult>;

	// ── Diagnostics ──────────────────────────────────────────────────────

	/**
	 * Asynchronous connectivity test.
	 *
	 * Makes a lightweight call to the provider's API (e.g. list deployments,
	 * fetch tags) to verify the service is reachable and credentials are valid.
	 */
	healthCheck(): Promise<boolean>;
}

// ============================================================================
// Adapter Utility
// ============================================================================

/**
 * Helper to build a `ChatMessage[]` from a prompt string and optional
 * system prompt. Useful inside `LLMProvider.complete()` and
 * `LLMProvider.stream()` implementations.
 */
export function buildMessages(
	prompt: string,
	systemPrompt?: string,
): ChatMessage[] {
	const messages: ChatMessage[] = [];
	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}
	messages.push({ role: "user", content: prompt });
	return messages;
}
