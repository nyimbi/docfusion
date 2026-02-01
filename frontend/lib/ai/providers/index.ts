/**
 * AI Providers Module - DocFusion
 *
 * Provider management with automatic fallback.
 */

// ============================================================================
// Base Types
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

