/**
 * AI Configuration - DocFusion
 *
 * Loads and manages AI configuration from environment variables and user preferences.
 * Configuration hierarchy: User Preferences > Environment Variables > Defaults
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import {
	AI_CONFIG_DEFAULTS,
	PROVIDER_METADATA,
	type AIGlobalConfig,
	type AISettingsFormData,
	type AzureOpenAIConfig,
	type LiteLLMConfig,
	type OllamaConfig,
	type UserAIConfig,
	type AIProviderPreference,
	type ProviderStatus,
	type ConfigSource,
	type ConfigEntry,
} from "./types";
import type { AIModelConfig, AIProviderType } from "./providers/types";

const debugLog = process.env.NODE_ENV === "production"
	? (..._args: unknown[]) => {}
	: (...args: unknown[]) => console.log(...args);

// ============================================================================
// Environment Configuration Loading
// ============================================================================

/**
 * Load Azure OpenAI configuration from environment.
 */
export function loadAzureConfigFromEnv(): ConfigEntry<AzureOpenAIConfig | undefined> {
	const apiKey = process.env.AZURE_OPENAI_API_KEY;
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
	const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
	const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

	debugLog("[AI Config] Loading Azure OpenAI config from environment...");
	debugLog("[AI Config] Environment variables present:", {
		AZURE_OPENAI_API_KEY: apiKey ? `Yes (${apiKey.length} chars)` : "Missing",
		AZURE_OPENAI_ENDPOINT: endpoint || "Missing",
		AZURE_OPENAI_DEPLOYMENT_NAME: deploymentName || "Missing",
		AZURE_OPENAI_API_VERSION: apiVersion,
	});

	const missingVars: string[] = [];
	if (!apiKey) missingVars.push("AZURE_OPENAI_API_KEY");
	if (!endpoint) missingVars.push("AZURE_OPENAI_ENDPOINT");
	if (!deploymentName) missingVars.push("AZURE_OPENAI_DEPLOYMENT_NAME");

	if (missingVars.length > 0) {
		console.warn(`[AI Config] Azure OpenAI not configured. Missing: ${missingVars.join(", ")}`);
		return {
			value: undefined,
			source: "env",
			userConfigurable: false,
			missingVars,
		} as ConfigEntry<AzureOpenAIConfig | undefined>;
	}

	debugLog("[AI Config] Azure OpenAI configuration loaded successfully");
	return {
		value: {
			apiKey: apiKey!, // Non-null assertion validated above
			endpoint: endpoint!.replace(/\/$/, ""), // Non-null assertion validated above
			deploymentName: deploymentName!, // Non-null assertion validated above
			apiVersion,
		},
		source: "env",
		userConfigurable: false,
	};
}

/**
 * Load Ollama configuration from environment.
 */
export function loadOllamaConfigFromEnv(): ConfigEntry<OllamaConfig> {
	const baseUrl =
		process.env.OLLAMA_BASE_URL || AI_CONFIG_DEFAULTS.OLLAMA_BASE_URL;
	const defaultModel =
		process.env.OLLAMA_DEFAULT_MODEL || AI_CONFIG_DEFAULTS.OLLAMA_DEFAULT_MODEL;

	return {
		value: {
			baseUrl,
			defaultModel,
			corsEnabled: process.env.OLLAMA_CORS === "true",
		},
		source: "env",
		userConfigurable: true,
	};
}

/**
 * Load LiteLLM gateway configuration from environment.
 */
export function loadLiteLLMConfigFromEnv(): ConfigEntry<LiteLLMConfig | undefined> {
	const rawBaseUrl =
		process.env.LITELLM_URL ||
		process.env.LITELLM_BASE_URL ||
		AI_CONFIG_DEFAULTS.LITELLM_BASE_URL;
	const apiKey = process.env.LITELLM_API_KEY || process.env.LITELLM_KEY;
	const defaultModel =
		process.env.LLM_MODEL ||
		process.env.LITELLM_MODEL ||
		AI_CONFIG_DEFAULTS.LITELLM_DEFAULT_MODEL;
	const fastModel =
		process.env.LLM_FAST_MODEL ||
		process.env.LITELLM_FAST_MODEL ||
		AI_CONFIG_DEFAULTS.LITELLM_FAST_MODEL;
	const embeddingModel =
		process.env.LLM_EMBEDDING_MODEL ||
		process.env.LITELLM_EMBEDDING_MODEL ||
		AI_CONFIG_DEFAULTS.LITELLM_EMBEDDING_MODEL;

	debugLog("[AI Config] Loading LiteLLM gateway config from environment...");
	debugLog("[AI Config] LiteLLM environment variables present:", {
		LITELLM_URL: rawBaseUrl,
		LITELLM_API_KEY: apiKey ? `Yes (${apiKey.length} chars)` : "Missing",
		LLM_MODEL: defaultModel,
		LLM_FAST_MODEL: fastModel,
	});

	if (!apiKey) {
		console.warn("[AI Config] LiteLLM not configured. Missing: LITELLM_API_KEY or LITELLM_KEY");
		return {
			value: undefined,
			source: "env",
			userConfigurable: false,
			missingVars: ["LITELLM_API_KEY"],
		} as ConfigEntry<LiteLLMConfig | undefined>;
	}

	return {
		value: {
			baseUrl: normalizeLiteLLMBaseUrl(rawBaseUrl),
			apiKey,
			defaultModel,
			fastModel,
			embeddingModel,
		},
		source: "env",
		userConfigurable: false,
	};
}

// ============================================================================
// User Preference Loading
// ============================================================================

/**
 * Load user AI preferences from database.
 */
export async function loadUserAIPreferences(
	userId: string
): Promise<UserAIConfig | undefined> {
	if (!db) {
		// During build, db might not be available
		return undefined;
	}

	try {
		const prefs = await db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, userId),
			columns: {
				aiConfig: true,
			},
		});

		return prefs?.aiConfig as UserAIConfig | undefined;
	} catch (error) {
		console.error("[AI Config] Failed to load user preferences:", error);
		return undefined;
	}
}

/**
 * Save user AI preferences to database.
 */
export async function saveUserAIPreferences(
	userId: string,
	config: UserAIConfig
): Promise<void> {
	if (!db) {
		throw new Error("Database not available");
	}

	await db
		.insert(userPreferences)
		.values({
			userId,
			aiConfig: config,
		})
		.onConflictDoUpdate({
			target: userPreferences.userId,
			set: {
				aiConfig: config,
				updatedAt: new Date(),
			},
		});
}

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * AI Configuration Manager class.
 * Handles configuration loading with proper hierarchy.
 */
class AIConfigManager {
	private config: AIGlobalConfig | null = null;
	private userConfig: UserAIConfig | null = null;
	private userId: string | null = null;
	private configLoaded = false;

	/**
	 * Ensure config is loaded (lazy initialization).
	 * This is called automatically by getters if config hasn't been loaded.
	 */
	private ensureConfigLoaded(): void {
		if (this.configLoaded) return;

		debugLog("[AI Config] Lazy loading configuration...");
		const azure = loadAzureConfigFromEnv();
		const litellm = loadLiteLLMConfigFromEnv();
		const ollama = loadOllamaConfigFromEnv();

		// Determine default provider
		const defaultProvider = this.getDefaultProvider(litellm.value, azure.value, ollama.value);

		this.config = {
			azure: azure.value,
			litellm: litellm.value,
			ollama: ollama.value,
			defaultProvider,
			fallbackProviders: this.buildFallbackChain(),
			timeouts: {
				completion: AI_CONFIG_DEFAULTS.DEFAULT_TIMEOUT_MS,
				streaming: AI_CONFIG_DEFAULTS.STREAMING_TIMEOUT_MS,
				healthCheck: AI_CONFIG_DEFAULTS.HEALTH_CHECK_TIMEOUT_MS,
			},
			features: {
				enableStreaming: true,
				enableFallback: true,
				enableCache: false,
			},
		};

		this.configLoaded = true;
		debugLog("[AI Config] Configuration loaded:", {
			hasAzure: !!this.config.azure,
			hasLiteLLM: !!this.config.litellm,
			hasOllama: !!this.config.ollama,
			defaultProvider: this.config.defaultProvider,
			fallbackProviders: this.config.fallbackProviders,
		});
	}

	/**
	 * Initialize configuration for a user (optional - config loads lazily).
	 */
	async initialize(userId?: string): Promise<void> {
		if (userId) {
			this.userId = userId;
			this.userConfig = (await loadUserAIPreferences(userId)) ?? null;
		}

		// Force reload config with user context
		this.configLoaded = false;
		this.ensureConfigLoaded();
	}

	/**
	 * Get the effective Ollama configuration.
	 * User preferences override environment defaults.
	 */
	getOllamaConfig(): OllamaConfig {
		this.ensureConfigLoaded();
		const envConfig = loadOllamaConfigFromEnv().value;

		// User overrides take precedence
		return {
			baseUrl: this.userConfig?.ollama?.baseUrl || envConfig.baseUrl,
			defaultModel: this.userConfig?.ollama?.model || envConfig.defaultModel,
			corsEnabled: envConfig.corsEnabled,
		};
	}

	/**
	 * Get the LiteLLM gateway configuration.
	 */
	getLiteLLMConfig(): LiteLLMConfig | undefined {
		this.ensureConfigLoaded();
		const envConfig = this.config?.litellm;
		if (!envConfig) return undefined;

		return {
			...envConfig,
			baseUrl: this.userConfig?.litellm?.baseUrl
				? normalizeLiteLLMBaseUrl(this.userConfig.litellm.baseUrl)
				: envConfig.baseUrl,
			defaultModel: this.userConfig?.litellm?.model || envConfig.defaultModel,
		};
	}

	/**
	 * Get the Azure OpenAI configuration.
	 */
	getAzureConfig(): AzureOpenAIConfig | undefined {
		this.ensureConfigLoaded();
		return this.config?.azure;
	}

	/**
	 * Get the user's preferred provider.
	 */
	getUserProviderPreference(): AIProviderPreference {
		return this.userConfig?.provider || "auto";
	}

	/**
	 * Get the effective provider to use.
	 * Respects user preference with fallback logic.
	 */
	getEffectiveProvider(): AIProviderType | null {
		this.ensureConfigLoaded();
		const preference = this.getUserProviderPreference();
		const config = this.config;

		if (!config) return null;

		// Check preferred provider availability
		switch (preference) {
			case "litellm":
				return config.litellm ? "litellm" : null;
			case "azure-openai":
				return config.azure ? "azure-openai" : null;
			case "ollama":
				return "ollama"; // Ollama can always be attempted
			case "auto":
			default:
				if (config.litellm) return "litellm";
				if (config.azure) return "azure-openai";
				return "ollama";
		}
	}

	/**
	 * Get the fallback chain.
	 */
	getFallbackProviders(): AIProviderType[] {
		this.ensureConfigLoaded();
		return this.config?.fallbackProviders || [];
	}

	/**
	 * Get default settings for API calls.
	 */
	getDefaultSettings(): {
		temperature: number;
		maxTokens: number;
		streamEnabled: boolean;
	} {
		return {
			temperature:
				this.userConfig?.temperature ?? AI_CONFIG_DEFAULTS.DEFAULT_TEMPERATURE,
			maxTokens:
				this.userConfig?.maxTokens ?? AI_CONFIG_DEFAULTS.DEFAULT_MAX_TOKENS,
			streamEnabled: this.userConfig?.streamEnabled ?? true,
		};
	}

	/**
	 * Get timeout settings.
	 */
	getTimeouts(): {
		completion: number;
		streaming: number;
		healthCheck: number;
	} {
		this.ensureConfigLoaded();
		return (
			this.config?.timeouts || {
				completion: AI_CONFIG_DEFAULTS.DEFAULT_TIMEOUT_MS,
				streaming: AI_CONFIG_DEFAULTS.STREAMING_TIMEOUT_MS,
				healthCheck: AI_CONFIG_DEFAULTS.HEALTH_CHECK_TIMEOUT_MS,
			}
		);
	}

	/**
	 * Get user-configurable settings.
	 */
	getUserSettings(): AISettingsFormData {
		const ollamaConfig = this.getOllamaConfig();
		const defaultSettings = this.getDefaultSettings();

		return {
			provider: this.getUserProviderPreference(),
			ollamaUrl: ollamaConfig.baseUrl,
			ollamaModel: ollamaConfig.defaultModel,
			temperature: defaultSettings.temperature,
			maxTokens: defaultSettings.maxTokens,
			streamEnabled: defaultSettings.streamEnabled,
			showConfidence: this.userConfig?.showConfidence ?? true,
		};
	}

	/**
	 * Update user settings.
	 */
	async updateUserSettings(settings: AISettingsFormData): Promise<void> {
		if (!this.userId) {
			throw new Error("No user context available");
		}

		const config: UserAIConfig = {
			provider: settings.provider,
			ollama: {
				baseUrl: settings.ollamaUrl,
				model: settings.ollamaModel,
			},
			litellm: this.userConfig?.litellm,
			temperature: settings.temperature,
			maxTokens: settings.maxTokens,
			streamEnabled: settings.streamEnabled,
			showConfidence: settings.showConfidence,
		};

		await saveUserAIPreferences(this.userId, config);
		this.userConfig = config;
	}

	/**
	 * Determine default provider based on what's configured.
	 */
	private getDefaultProvider(
		litellmConfig?: LiteLLMConfig,
		azureConfig?: AzureOpenAIConfig,
		ollamaConfig?: OllamaConfig
	): AIProviderPreference {
		if (litellmConfig) {
			return "auto";
		}
		if (azureConfig) {
			return "auto";
		}
		if (ollamaConfig) {
			return "ollama";
		}
		return "auto";
	}

	/**
	 * Build the fallback provider chain.
	 */
	private buildFallbackChain(): AIProviderType[] {
		const chain: AIProviderType[] = [];
		const litellm = loadLiteLLMConfigFromEnv().value;
		const azure = loadAzureConfigFromEnv().value;

		if (litellm) {
			chain.push("litellm");
		}
		if (azure) {
			chain.push("azure-openai");
		}
		chain.push("ollama");

		return chain;
	}

	/**
	 * Check if a provider is configured.
	 */
	isProviderConfigured(type: AIProviderType): boolean {
		this.ensureConfigLoaded();
		if (type === "litellm") {
			return !!this.config?.litellm;
		}
		if (type === "azure-openai") {
			return !!this.config?.azure;
		}
		return true; // Ollama is always configurable
	}

	/**
	 * Get provider metadata for UI rendering.
	 */
	getProviderMetadata() {
		return PROVIDER_METADATA;
	}

	/**
	 * Check if feature is enabled.
	 */
	isFeatureEnabled(feature: keyof AIGlobalConfig["features"]): boolean {
		this.ensureConfigLoaded();
		return this.config?.features[feature] ?? true;
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configManager: AIConfigManager | null = null;

/**
 * Get the singleton config manager instance.
 */
export function getAIConfig(): AIConfigManager {
	if (!configManager) {
		configManager = new AIConfigManager();
	}
	return configManager;
}

/**
 * Initialize AI configuration (call at app startup).
 */
export async function initializeAIConfig(userId?: string): Promise<void> {
	const manager = getAIConfig();
	await manager.initialize(userId);
}

/**
 * Server-side helper to initialize with user from session.
 */
export async function initializeAIConfigForUser(userId: string): Promise<void> {
	await initializeAIConfig(userId);
}

// ============================================================================
// Quick Access Functions
// ============================================================================

export function getOllamaConfig(): OllamaConfig {
	return getAIConfig().getOllamaConfig();
}

export function getLiteLLMConfig(): LiteLLMConfig | undefined {
	return getAIConfig().getLiteLLMConfig();
}

export function getAzureConfig(): AzureOpenAIConfig | undefined {
	return getAIConfig().getAzureConfig();
}

export function getEffectiveProvider(): AIProviderType | null {
	return getAIConfig().getEffectiveProvider();
}

export function getUserProviderPreference(): AIProviderPreference {
	return getAIConfig().getUserProviderPreference();
}

export function getFallbackProviders(): AIProviderType[] {
	return getAIConfig().getFallbackProviders();
}

export function getDefaultSettings() {
	return getAIConfig().getDefaultSettings();
}

export function getTimeouts() {
	return getAIConfig().getTimeouts();
}

export function isProviderConfigured(type: AIProviderType): boolean {
	return getAIConfig().isProviderConfigured(type);
}

function normalizeLiteLLMBaseUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim().replace(/\/$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function getUserSettings(): AISettingsFormData {
	return getAIConfig().getUserSettings();
}

export async function updateUserSettings(
	settings: AISettingsFormData
): Promise<void> {
	return getAIConfig().updateUserSettings(settings);
}

export { PROVIDER_METADATA, AI_CONFIG_DEFAULTS };
