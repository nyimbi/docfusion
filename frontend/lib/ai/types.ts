/**
 * AI Configuration Types - DocFusion
 *
 * TypeScript types for AI configuration, providers, and user settings.
 */

import type { AIProviderType, AIModelConfig, ChatMessage } from "./providers/types";

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Azure OpenAI configuration settings.
 */
export interface AzureOpenAIConfig {
	/** Azure API key from environment */
	apiKey: string;
	/** Azure OpenAI endpoint URL */
	endpoint: string;
	/** Deployment name (model deployment) */
	deploymentName: string;
	/** API version */
	apiVersion: string;
}

/**
 * Ollama configuration settings.
 */
export interface OllamaConfig {
	/** Ollama base URL (default: http://localhost:11434) */
	baseUrl: string;
	/** Default model to use */
	defaultModel: string;
	/** Whether CORS is configured for browser access */
	corsEnabled?: boolean;
}

/**
 * LiteLLM gateway configuration settings.
 */
export interface LiteLLMConfig {
	/** OpenAI-compatible LiteLLM base URL, normalized to include /v1 */
	baseUrl: string;
	/** Bearer token for the LiteLLM gateway */
	apiKey: string;
	/** Default model alias routed by LiteLLM */
	defaultModel: string;
	/** Fast/low-cost model alias routed by LiteLLM */
	fastModel?: string;
	/** Embedding model alias routed by LiteLLM */
	embeddingModel?: string;
}

/**
 * Provider task mapping - which model to use for different tasks.
 */
export interface ProviderTaskMapping {
	/** Model for text completion/generation */
	completion: string;
	/** Model for document analysis */
	analysis: string;
	/** Model for creative generation */
	generation: string;
	/** Model for embeddings (if supported) */
	embeddings?: string;
}

// ============================================================================
// User AI Preferences (stored in user_preferences table)
// ============================================================================

/**
 * AI provider preference saved by user.
 */
export type AIProviderPreference = "litellm" | "azure-openai" | "ollama" | "auto";

/**
 * User's AI configuration preferences.
 * Stored in the user_preferences table as ai_config JSONB field.
 */
export interface UserAIConfig {
	/** Selected provider preference */
	provider: AIProviderPreference;
	/** Ollama-specific settings */
	ollama?: {
		/** Custom Ollama endpoint URL */
		baseUrl?: string;
		/** Preferred model */
		model?: string;
	};
	/** LiteLLM-specific settings */
	litellm?: {
		/** Custom LiteLLM endpoint URL */
		baseUrl?: string;
		/** Preferred model alias */
		model?: string;
	};
	/** Default modelOverrides by provider */
	modelOverrides?: Partial<Record<AIProviderType, string>>;
	/** Default temperature (0-1) */
	temperature?: number;
	/** Default max tokens */
	maxTokens?: number;
	/** Enable streaming by default */
	streamEnabled?: boolean;
	/** Show AI confidence scores */
	showConfidence?: boolean;
	/** Auto-save AI suggestions */
	autoAccept?: boolean;
}

// ============================================================================
// AI Provider Registry Types
// ============================================================================

/**
 * Provider metadata for UI display.
 */
export interface ProviderMetadata {
	/** Provider type identifier */
	type: AIProviderType;
	/** Display name */
	name: string;
	/** Description */
	description: string;
	/** Icon name (Lucide) */
	icon: string;
	/** Whether provider is configurable */
	isConfigurable: boolean;
	/** Whether provider supports local setup */
	supportsLocal: boolean;
	/** Configuration help URL */
	helpUrl?: string;
}

/**
 * Provider status in the system.
 */
export interface ProviderStatus {
	/** Provider type */
	type: AIProviderType;
	/** Whether provider is configured */
	isConfigured: boolean;
	/** Whether provider is currently available */
	isAvailable: boolean;
	/** Last checked timestamp */
	lastChecked?: string;
	/** Error message if unavailable */
	error?: string;
	/** Available models */
	models: AIModelConfig[];
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * AI completion request options.
 */
export interface AICompletionOptions {
	/** Specific provider to use */
	provider?: AIProviderType;
	/** Model ID to use */
	model?: string;
	/** Temperature (0-1) */
	temperature?: number;
	/** Maximum tokens */
	maxTokens?: number;
	/** Stream response */
	stream?: boolean;
	/** Task type for model selection */
	taskType?: "completion" | "analysis" | "generation" | "embeddings";
	/** Request timeout in ms */
	timeoutMs?: number;
	/** Number of retry attempts */
	retries?: number;
}

/**
 * AI completion result.
 */
export interface AICompletionResult {
	/** Generated content */
	content: string;
	/** Provider used */
	provider: AIProviderType;
	/** Model used */
	model: string;
	/** Confidence score (0-1) */
	confidence?: number;
	/** Token usage */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** Processing latency */
	latencyMs: number;
	/** Finish reason */
	finishReason: "stop" | "length" | "content_filter" | "error";
	/** Whether result came from fallback */
	isFallback?: boolean;
}

/**
 * Streaming completion chunk.
 */
export interface AIStreamChunk {
	/** Content delta */
	delta: string;
	/** Accumulated content */
	accumulated: string;
	/** Whether stream is complete */
	isComplete: boolean;
	/** Provider used */
	provider?: AIProviderType;
	/** Model used */
	model?: string;
}

// ============================================================================
// Configuration Store Types
// ============================================================================

/**
 * Global AI configuration state.
 */
export interface AIGlobalConfig {
	/** Environment-based Azure config */
	azure?: AzureOpenAIConfig;
	/** Environment-based LiteLLM gateway config */
	litellm?: LiteLLMConfig;
	/** Environment-based Ollama defaults */
	ollama?: OllamaConfig;
	/** Default provider preference */
	defaultProvider: AIProviderPreference;
	/** Fallback chain */
	fallbackProviders: AIProviderType[];
	/** Timeout settings */
	timeouts: {
		completion: number;
		streaming: number;
		healthCheck: number;
	};
	/** Feature flags */
	features: {
		enableStreaming: boolean;
		enableFallback: boolean;
		enableCache: boolean;
	};
}

/**
 * Configuration source type.
 */
export type ConfigSource = "env" | "user" | "default";

/**
 * Configuration entry with metadata.
 */
export interface ConfigEntry<T> {
	/** Configuration value */
	value: T;
	/** Where this config came from */
	source: ConfigSource;
	/** Whether user can override */
	userConfigurable: boolean;
}

// ============================================================================
// Settings Page Types
// ============================================================================

/**
 * AI settings form data.
 */
export interface AISettingsFormData {
	/** Selected provider */
	provider: AIProviderPreference;
	/** Ollama URL */
	ollamaUrl: string;
	/** Ollama model */
	ollamaModel: string;
	/** Default temperature */
	temperature: number;
	/** Default max tokens */
	maxTokens: number;
	/** Enable streaming */
	streamEnabled: boolean;
	/** Show confidence scores */
	showConfidence: boolean;
}

/**
 * Validation result for settings.
 */
export interface SettingsValidationResult {
	/** Whether settings are valid */
	isValid: boolean;
	/** Field-specific errors */
	errors: Partial<Record<keyof AISettingsFormData, string>>;
	/** Connection test results */
	connectionTests: Partial<Record<AIProviderType, { success: boolean; message: string }>>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values.
 */
export const AI_CONFIG_DEFAULTS = {
	/** Default Ollama URL */
	OLLAMA_BASE_URL: "http://localhost:11434",
	/** Default Ollama model */
	OLLAMA_DEFAULT_MODEL: "gpt-oss",
	/** Default LiteLLM URL from infra docs */
	LITELLM_BASE_URL: "http://62.169.25.77:4000/v1",
	/** Default LiteLLM model alias from infra docs */
	LITELLM_DEFAULT_MODEL: "gpt-4o",
	/** Default LiteLLM fast model alias from infra docs */
	LITELLM_FAST_MODEL: "gpt-4o-mini",
	/** Default LiteLLM embedding model alias from infra docs */
	LITELLM_EMBEDDING_MODEL: "text-embedding-ada-002",
	/** Default temperature */
	DEFAULT_TEMPERATURE: 0.7,
	/** Default max tokens */
	DEFAULT_MAX_TOKENS: 2048,
	/** Default timeout */
	DEFAULT_TIMEOUT_MS: 60000,
	/** Streaming timeout */
	STREAMING_TIMEOUT_MS: 120000,
	/** Health check timeout */
	HEALTH_CHECK_TIMEOUT_MS: 5000,
} as const;

/**
 * Provider metadata for UI.
 */
export const PROVIDER_METADATA: Record<AIProviderType, ProviderMetadata> = {
	litellm: {
		type: "litellm",
		name: "LiteLLM Gateway",
		description: "Central Lindela AI gateway with OpenAI-compatible routing, cache, and fallback",
		icon: "Network",
		isConfigurable: false,
		supportsLocal: false,
	},
	"azure-openai": {
		type: "azure-openai",
		name: "Azure OpenAI",
		description: "Enterprise-grade AI with Azure OpenAI Service",
		icon: "Cloud",
		isConfigurable: false,
		supportsLocal: false,
		helpUrl: "https://azure.microsoft.com/en-us/services/cognitive-services/openai/",
	},
	ollama: {
		type: "ollama",
		name: "Ollama (Local)",
		description: "Run AI models locally on your machine",
		icon: "Laptop",
		isConfigurable: true,
		supportsLocal: true,
		helpUrl: "https://ollama.com",
	},
	openai: {
		type: "openai",
		name: "OpenAI",
		description: "Direct OpenAI API access",
		icon: "Zap",
		isConfigurable: false,
		supportsLocal: false,
		helpUrl: "https://platform.openai.com",
	},
};

/**
 * Recommended Ollama models.
 */
export const RECOMMENDED_OLLAMA_MODELS = [
	{ id: "gpt-oss", name: "GPT-OSS", description: "General purpose open source model" },
	{ id: "qwen3:30b", name: "Qwen 3 (30B)", description: "Strong multilingual model" },
	{ id: "llama3.3", name: "Llama 3.3", description: "Latest Meta Llama model" },
	{ id: "mistral", name: "Mistral", description: "Fast and efficient" },
	{ id: "phi4", name: "Phi-4", description: "Microsoft's lightweight model" },
	{ id: "gemma3", name: "Gemma 3", description: "Google's open model" },
] as const;
