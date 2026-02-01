/**
 * AI Module - DocFusion
 *
 * Comprehensive AI subsystem for DocFusion providing:
 * - Multiple provider support (Azure OpenAI, Ollama)
 * - User-configurable settings
 * - Automatic fallback mechanism
 * - Streaming and non-streaming completions
 * - Health checking and connection testing
 *
 * @example
 * ```typescript
 * // Quick completion
 * import { complete } from "@/lib/ai";
 * const result = await complete("Explain RFP requirements");
 *
 * // Streaming
 * import { stream } from "@/lib/ai";
 * for await (const chunk of stream("Generate proposal")) {
 *   console.log(chunk.delta);
 * }
 *
 * // Settings
 * import { getAISettingsManager } from "@/lib/ai";
 * const settings = getAISettingsManager();
 * await settings.saveSettings({ provider: "ollama", ... });
 * ```
 */

// ============================================================================
// Provider Types (re-exported for convenience)
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
	AIEmbeddingRequest,
	AIEmbeddingResponse,
} from "./providers/types";

// ============================================================================
// Configuration Types
// ============================================================================

export type {
	AzureOpenAIConfig,
	OllamaConfig,
	UserAIConfig,
	AIProviderPreference,
	ProviderMetadata,
	ProviderStatus,
	AICompletionOptions,
	AICompletionResult,
	AIStreamChunk,
	AISettingsFormData,
	SettingsValidationResult,
	AIGlobalConfig,
	ConfigEntry,
} from "./types";

// ============================================================================
// Configuration Functions
// ============================================================================

export {
	// Initialization
	initializeAIConfig,
	initializeAIConfigForUser,

	// Configuration getters
	getOllamaConfig,
	getAzureConfig,
	getEffectiveProvider,
	getUserProviderPreference,
	getFallbackProviders,
	getDefaultSettings,
	getTimeouts,
	getUserSettings,

	// Configuration updates
	updateUserSettings,
	isProviderConfigured,
	getAIConfig,
} from "./config";

// ============================================================================
// Client Functions
// ============================================================================

export {
	// Client classes
	AIClient,
	AISettingsManager,

	// Singleton getters
	getAIClient,
	getAISettingsManager,

	// Quick access functions
	complete,
	chat,
	stream,
	streamChat,

	// Settings helpers
	testOllamaConnection,
	testProviderConnections,

	// Initialization
	initializeAI,
} from "./client";

// ============================================================================
// Provider Factory Functions
// ============================================================================

export {
	// Provider creation
	createAzureOpenAIProvider,
	createOllamaProvider,
	createProvider,
	getProvider,

	// Provider management
	clearProviderCache,
	reconfigureProvider,
	getProviderManager,
	resetProviderManager,

	// Utility functions
	quickComplete,
	prompt,
} from "./providers/factory";

// ============================================================================
// Provider Implementations
// ============================================================================

export { AzureOpenAIProvider, OllamaProvider } from "./providers";

// ============================================================================
// Constants
// ============================================================================

export { AI_CONFIG_DEFAULTS, PROVIDER_METADATA, RECOMMENDED_OLLAMA_MODELS } from "./types";
