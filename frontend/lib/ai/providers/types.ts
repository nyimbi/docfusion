/**
 * AI Provider Types - DocFusion
 *
 * Common types for AI provider abstraction layer.
 */

/**
 * Supported AI providers.
 */
export type AIProviderType = "litellm" | "azure-openai" | "ollama" | "openai";

/**
 * Available models by provider.
 */
export interface AIModelConfig {
	provider: AIProviderType;
	modelId: string;
	displayName: string;
	contextWindow: number;
	maxOutputTokens: number;
	supportsStreaming: boolean;
	supportsVision: boolean;
	costPer1kInputTokens?: number;
	costPer1kOutputTokens?: number;
}

/**
 * Message role in conversation.
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * Chat message.
 */
export interface ChatMessage {
	role: MessageRole;
	content: string;
}

/**
 * Request to AI provider.
 */
export interface AIProviderRequest {
	messages: ChatMessage[];
	model?: string;
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stop?: string[];
}

/**
 * Response from AI provider.
 */
export interface AIProviderResponse {
	content: string;
	finishReason: "stop" | "length" | "content_filter" | "error";
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	latencyMs: number;
}

/**
 * Streaming chunk from AI provider.
 */
export interface AIProviderStreamChunk {
	content: string;
	isComplete: boolean;
	finishReason?: "stop" | "length" | "content_filter" | "error";
}

/**
 * Request for embedding generation.
 */
export interface AIEmbeddingRequest {
	/** Text or texts to embed */
	input: string | string[];
	/** Optional model override (uses deployment default if not specified) */
	model?: string;
	/** Embedding dimensions (for models that support it) */
	dimensions?: number;
}

/**
 * Response from embedding generation.
 */
export interface AIEmbeddingResponse {
	/** Embedding vectors */
	embeddings: number[][];
	/** Model used */
	model: string;
	/** Token usage */
	usage: {
		promptTokens: number;
		totalTokens: number;
	};
}

/**
 * AI Provider interface.
 */
export interface AIProvider {
	name: AIProviderType;
	isAvailable(): Promise<boolean>;
	complete(request: AIProviderRequest): Promise<AIProviderResponse>;
	stream(request: AIProviderRequest): AsyncGenerator<AIProviderStreamChunk, void, undefined>;
	listModels(): Promise<AIModelConfig[]>;
	/** Optional embedding support */
	createEmbedding?(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;
}

/**
 * Provider configuration from environment.
 */
export interface AIProviderConfig {
	litellm?: {
		baseUrl: string;
		apiKey: string;
		defaultModel: string;
		fastModel?: string;
		embeddingModel?: string;
	};
	azure?: {
		apiKey: string;
		endpoint: string;
		deploymentName: string;
		apiVersion: string;
	};
	ollama?: {
		baseUrl: string;
		defaultModel: string;
	};
	openai?: {
		apiKey: string;
		organization?: string;
	};
}
