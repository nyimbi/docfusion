/**
 * AI Provider Factory - DocFusion
 *
 * Factory for creating and managing AI provider instances.
 * Uses configuration from the config module.
 */

import { logger } from "@/lib/utils/logger";
import { AzureOpenAIProvider } from "./azure-openai";
import { OllamaProvider } from "./ollama";
import type {
	AIProvider,
	AIProviderType,
	AIProviderRequest,
	AIProviderResponse,
	AIModelConfig,
	AIProviderStreamChunk,
} from "./types";
import {
	getOllamaConfig,
	getAzureConfig,
	getEffectiveProvider,
	getFallbackProviders,
} from "../config";
import type { AISettingsFormData } from "../types";

/**
 * Provider instance cache.
 */
const providerInstances = new Map<AIProviderType, AIProvider>();

/**
 * Create Azure OpenAI provider instance.
 */
export function createAzureOpenAIProvider(): AzureOpenAIProvider | null {
	const config = getAzureConfig();

	if (!config) {
		return null;
	}

	return new AzureOpenAIProvider(config);
}

/**
 * Create Ollama provider instance.
 * Uses current configuration (respects user preferences).
 */
export function createOllamaProvider(): OllamaProvider {
	const config = getOllamaConfig();

	return new OllamaProvider(config);
}

/**
 * Create provider instance by type.
 */
export function createProvider(type: AIProviderType): AIProvider | null {
	switch (type) {
		case "azure-openai":
			return createAzureOpenAIProvider();
		case "ollama":
			return createOllamaProvider();
		default:
			return null;
	}
}

/**
 * Get cached provider instance or create new one.
 */
export function getProvider(type: AIProviderType): AIProvider | null {
	if (providerInstances.has(type)) {
		return providerInstances.get(type) ?? null;
	}

	const provider = createProvider(type);
	if (provider) {
		providerInstances.set(type, provider);
	}

	return provider;
}

/**
 * Clear provider cache (useful after config changes).
 */
export function clearProviderCache(): void {
	providerInstances.clear();
}

/**
 * Re-create provider with updated configuration.
 */
export function reconfigureProvider(type: AIProviderType): AIProvider | null {
	providerInstances.delete(type);
	return getProvider(type);
}

// ============================================================================
// Provider Manager with Fallback
// ============================================================================

/**
 * AI Provider Manager handles provider selection and automatic fallback.
 */
export class AIProviderManager {
	private activeProvider: AIProviderType | null = null;
	private lastError: Map<AIProviderType, string> = new Map();
	private initialized = false;

	/**
	 * Initialize the manager (ensure we have active provider).
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;
		await this.getActiveProvider();
		this.initialized = true;
	}

	/**
	 * Check if any provider is available.
	 */
	async isAvailable(): Promise<boolean> {
		const provider = await this.getActiveProvider();
		return provider !== null;
	}

	/**
	 * List all providers.
	 */
	listProviders(): AIProviderType[] {
		return ["azure-openai", "ollama"];
	}

	/**
	 * Get the active provider based on configuration.
	 */
	async getActiveProvider(): Promise<AIProvider | null> {
		logger.debug("[AI Manager] Getting active provider...");
		
		// Check if we have an active provider that's still available
		if (this.activeProvider) {
			logger.debug(`[AI Manager] Checking existing active provider: ${this.activeProvider}`);
			const provider = getProvider(this.activeProvider);
			if (provider) {
				const available = await provider.isAvailable();
				logger.debug(`[AI Manager] Existing provider ${this.activeProvider} available: ${available}`);
				if (available) {
					return provider;
				}
			} else {
				logger.debug(`[AI Manager] No provider instance found for ${this.activeProvider}`);
			}
		}

		// Determine preferred provider from config
		const preferred = getEffectiveProvider();
		logger.debug(`[AI Manager] Preferred provider from config: ${preferred}`);
		
		if (preferred) {
			const provider = getProvider(preferred);
			logger.debug(`[AI Manager] Created provider instance for ${preferred}: ${provider ? 'Yes' : 'No'}`);
			if (provider) {
				const available = await provider.isAvailable();
				logger.debug(`[AI Manager] Provider ${preferred} available: ${available}`);
				if (available) {
					this.activeProvider = preferred;
					return provider;
				}
			} else {
				logger.error(`[AI Manager] Failed to create provider instance for ${preferred}`);
			}
		} else {
			logger.error("[AI Manager] No preferred provider configured");
		}

		// Try fallback chain
		const fallback = getFallbackProviders();
		logger.debug(`[AI Manager] Trying fallback providers: ${fallback.join(", ")}`);
		for (const type of fallback) {
			if (type === preferred) continue; // Already tried

			const provider = getProvider(type);
			logger.debug(`[AI Manager] Trying fallback provider: ${type}, instance: ${provider ? 'Yes' : 'No'}`);
			if (provider) {
				try {
					const available = await provider.isAvailable();
					logger.debug(`[AI Manager] Fallback provider ${type} available: ${available}`);
					if (available) {
						this.activeProvider = type;
						return provider;
					}
				} catch (error) {
					logger.error(`[AI Manager] Error checking ${type} availability:`, error);
					this.lastError.set(
						type,
						error instanceof Error ? error.message : String(error)
					);
				}
			}
		}

		logger.error("[AI Manager] No AI providers available after checking all options");
		logger.error("[AI Manager] Last errors:", Object.fromEntries(this.lastError));
		return null;
	}

	/**
	 * Execute completion with automatic fallback.
	 */
	async complete(
		request: AIProviderRequest,
		preferredProvider?: AIProviderType
	): Promise<AIProviderResponse & { provider: AIProviderType; isFallback?: boolean }> {
		// Try preferred provider first
		if (preferredProvider) {
			const provider = getProvider(preferredProvider);
			if (provider) {
				try {
					const response = await provider.complete(request);
					return { ...response, provider: preferredProvider, isFallback: false };
				} catch (error) {
					logger.warn(
						`[AI] Preferred provider ${preferredProvider} failed, trying fallback`
					);
					this.lastError.set(
						preferredProvider,
						error instanceof Error ? error.message : String(error)
					);
				}
			}
		}

		// Try active provider
		const active = await this.getActiveProvider();
		if (active) {
			try {
				const provider = this.activeProvider!;
				const response = await active.complete(request);
				return { ...response, provider, isFallback: false };
			} catch (error) {
				logger.warn(`[AI] Active provider ${this.activeProvider} failed, trying fallbacks`);
				this.lastError.set(
					this.activeProvider!,
					error instanceof Error ? error.message : String(error)
				);
			}
		}

		// Try all fallback providers
		const fallback = getFallbackProviders();
		for (const type of fallback) {
			if (type === preferredProvider || type === this.activeProvider) continue;

			const provider = getProvider(type);
			if (provider) {
				try {
					const response = await provider.complete(request);
					// Update active provider on success
					this.activeProvider = type;
					return { ...response, provider: type, isFallback: true };
				} catch {
					// Continue to next provider
				}
			}
		}

		throw new Error("No AI provider available");
	}

	/**
	 * Execute streaming completion.
	 */
	async *stream(
		request: AIProviderRequest,
		preferredProvider?: AIProviderType
	): AsyncGenerator<AIProviderStreamChunk & { provider?: AIProviderType }, void, undefined> {
		let provider: AIProvider | null = null;
		let providerName: AIProviderType | undefined;

		// Try preferred provider
		if (preferredProvider) {
			provider = getProvider(preferredProvider);
			providerName = preferredProvider;
		}

		// Fall back to active
		if (!provider) {
			provider = await this.getActiveProvider();
			providerName = this.activeProvider ?? undefined;
		}

		if (!provider) {
			throw new Error("No AI provider available");
		}

		for await (const chunk of provider.stream(request)) {
			yield { ...chunk, provider: providerName };
		}
	}

	/**
	 * Check if a provider is available.
	 */
	async isProviderAvailable(type: AIProviderType): Promise<boolean> {
		const provider = getProvider(type);
		if (!provider) return false;

		try {
			return await provider.isAvailable();
		} catch {
			return false;
		}
	}

	/**
	 * Get a specific provider instance.
	 */
	getProvider(type: AIProviderType): AIProvider | null {
		return getProvider(type);
	}

	/**
	 * List all available providers.
	 */
	async listAvailableProviders(): Promise<AIProviderType[]> {
		const available: AIProviderType[] = [];
		const types: AIProviderType[] = ["azure-openai", "ollama"];

		for (const type of types) {
			if (await this.isProviderAvailable(type)) {
				available.push(type);
			}
		}

		return available;
	}

	/**
	 * List all models from all available providers.
	 */
	async listAllModels(): Promise<AIModelConfig[]> {
		const models: AIModelConfig[] = [];

		for (const type of ["azure-openai", "ollama"] as AIProviderType[]) {
			const provider = getProvider(type);
			if (provider) {
				try {
					const providerModels = await provider.listModels();
					models.push(...providerModels);
				} catch (error) {
					logger.warn(`[AI] Failed to list models for ${type}:`, error);
				}
			}
		}

		return models;
	}

	/**
	 * Get the last error for a provider.
	 */
	getLastError(type: AIProviderType): string | undefined {
		return this.lastError.get(type);
	}

	/**
	 * Clear error history.
	 */
	clearErrors(): void {
		this.lastError.clear();
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: AIProviderManager | null = null;

export function getProviderManager(): AIProviderManager {
	if (!managerInstance) {
		managerInstance = new AIProviderManager();
	}
	return managerInstance;
}

export function resetProviderManager(): void {
	managerInstance = null;
	clearProviderCache();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick complete with automatic provider selection.
 */
export async function quickComplete(
	messages: { role: "system" | "user" | "assistant"; content: string }[],
	options?: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
		provider?: AIProviderType;
	}
): Promise<string> {
	const manager = getProviderManager();
	const response = await manager.complete(
		{
			messages,
			model: options?.model,
			temperature: options?.temperature,
			maxTokens: options?.maxTokens,
		},
		options?.provider
	);

	return response.content;
}

/**
 * Simple prompt completion.
 */
export async function prompt(
	userMessage: string,
	systemPrompt?: string,
	options?: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
		provider?: AIProviderType;
	}
): Promise<string> {
	const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}

	messages.push({ role: "user", content: userMessage });

	return quickComplete(messages, options);
}

/**
 * Test connection to Ollama.
 */
export async function testOllamaConnection(
	baseUrl: string,
	model?: string
): Promise<{ success: boolean; message: string; models?: string[] }> {
	try {
		// Check if Ollama is reachable
		const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
			method: "GET",
		});

		if (!tagsResponse.ok) {
			return {
				success: false,
				message: `Ollama is not responding at ${baseUrl}. Make sure Ollama is running.`,
			};
		}

		const data = await tagsResponse.json();
		const models: string[] = (data.models || []).map((m: { name: string }) => m.name);

		// If model specified, check if it's available
		if (model && !models.includes(model)) {
			return {
				success: true,
				message: `Ollama is connected but model '${model}' is not available. Available models: ${models.join(", ")}`,
				models,
			};
		}

		return {
			success: true,
			message: model
				? `Successfully connected to Ollama. Model '${model}' is available.`
				: `Successfully connected to Ollama. Available models: ${models.join(", ")}`,
			models,
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to connect to Ollama at ${baseUrl}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	}
}

/**
 * Test connection to configured providers.
 */
export async function testProviderConnections(): Promise<
	Record<AIProviderType, { success: boolean; message: string; models?: string[] }>
> {
	const results = {} as Record<
		AIProviderType,
		{ success: boolean; message: string; models?: string[] }
	>;

	// Test Azure
	const azureConfig = getAzureConfig();
	if (azureConfig) {
		const azureProvider = createAzureOpenAIProvider();
		if (azureProvider) {
			try {
				const available = await azureProvider.isAvailable();
				results["azure-openai"] = {
					success: available,
					message: available
						? "Azure OpenAI is configured and available"
						: "Azure OpenAI is configured but unavailable",
				};
			} catch {
				results["azure-openai"] = {
					success: false,
					message: "Azure OpenAI configuration failed",
				};
			}
		}
	} else {
		results["azure-openai"] = {
			success: false,
			message: "Azure OpenAI is not configured (missing AZURE_OPENAI_API_KEY)",
		};
	}

	// Test Ollama
	const ollamaConfig = getOllamaConfig();
	results["ollama"] = await testOllamaConnection(
		ollamaConfig.baseUrl,
		ollamaConfig.defaultModel
	);

	return results;
}

// Export types
export type {
	AIProvider,
	AIProviderType,
	AIProviderRequest,
	AIProviderResponse,
	AIModelConfig,
	AIProviderStreamChunk,
};
export { AzureOpenAIProvider, OllamaProvider };
