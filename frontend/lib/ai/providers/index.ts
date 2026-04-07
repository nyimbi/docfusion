/**
 * AI Providers Module - DocFusion
 *
 * Provider management with automatic fallback.
 */

// ============================================================================
// Base Types (legacy interface)
// ============================================================================

export type {
	AIProvider,
	AIProviderType,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
	ChatMessage,
	MessageRole,
	AIProviderConfig,
} from "./types";

// ============================================================================
// LLM Provider Abstraction Layer
// ============================================================================

export type {
	LLMProvider,
	CompletionOptions,
	CompletionResult,
	StreamChunk,
	EmbeddingOptions,
	EmbeddingResult,
} from "./llm-provider";

export { buildMessages } from "./llm-provider";

export { ProviderRegistry, providerRegistry } from "./provider-registry";

// ============================================================================
// Provider Implementations
// ============================================================================

export { AzureOpenAIProvider, createAzureOpenAIProvider } from "./azure-openai";
export { OllamaProvider, createOllamaProvider } from "./ollama";

// ============================================================================
// Factory Functions
// ============================================================================

export {
	createProvider,
	getProvider,
	getProviderManager,
	clearProviderCache,
	resetProviderManager,
	reconfigureProvider,
	quickComplete,
	prompt,
	testOllamaConnection,
	testProviderConnections,
	AIProviderManager,
} from "./factory";

export type { AISettingsFormData } from "../types";

