/**
 * AI Providers Index - DocFusion
 *
 * Central management of AI providers with automatic fallback.
 *
 * Configuration (add to .env.local):
 *
 * # Azure OpenAI
 * AZURE_OPENAI_API_KEY=your-key
 * AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
 * AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1-mini
 * AZURE_OPENAI_API_VERSION=2024-02-15-preview
 *
 * # Ollama (local)
 * OLLAMA_BASE_URL=http://localhost:11434
 * OLLAMA_DEFAULT_MODEL=gpt-oss
 *
 * To use Ollama, install from https://ollama.ai then:
 *   ollama pull gpt-oss
 *   ollama pull qwen3:30b
 */

import {
	AzureOpenAIProvider,
	createAzureOpenAIProvider,
} from "./azure-openai";
import { OllamaProvider, createOllamaProvider } from "./ollama";
import type {
	AIProvider,
	AIProviderType,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
	ChatMessage,
} from "./types";

export type {
	AIProvider,
	AIProviderType,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
	ChatMessage,
};

export { AzureOpenAIProvider, OllamaProvider };

/**
 * Provider preference order for automatic selection.
 */
const PROVIDER_PREFERENCE: AIProviderType[] = [
	"azure-openai",
	"ollama",
	"openai",
];

/**
 * AI Provider Manager - handles provider selection and fallback.
 */
class AIProviderManager {
	private providers: Map<AIProviderType, AIProvider> = new Map();
	private activeProvider: AIProviderType | null = null;
	private initialized = false;

	/**
	 * Initialize all configured providers.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Initialize Azure OpenAI
		const azure = createAzureOpenAIProvider();
		if (azure) {
			this.providers.set("azure-openai", azure);
		}

		// Initialize Ollama
		const ollama = createOllamaProvider();
		if (ollama) {
			this.providers.set("ollama", ollama);
		}

		// Determine active provider
		for (const type of PROVIDER_PREFERENCE) {
			const provider = this.providers.get(type);
			if (provider) {
				const available = await provider.isAvailable();
				if (available) {
					this.activeProvider = type;
					console.log(`[AI] Active provider: ${type}`);
					break;
				}
			}
		}

		if (!this.activeProvider && this.providers.size > 0) {
			// Use first available even if health check failed
			this.activeProvider = this.providers.keys().next().value ?? null;
			console.log(`[AI] Fallback provider: ${this.activeProvider}`);
		}

		this.initialized = true;
	}

	/**
	 * Get a specific provider by type.
	 */
	getProvider(type: AIProviderType): AIProvider | null {
		return this.providers.get(type) ?? null;
	}

	/**
	 * Get the currently active provider.
	 */
	getActiveProvider(): AIProvider | null {
		if (!this.activeProvider) return null;
		return this.providers.get(this.activeProvider) ?? null;
	}

	/**
	 * Set the active provider.
	 */
	setActiveProvider(type: AIProviderType): boolean {
		if (this.providers.has(type)) {
			this.activeProvider = type;
			return true;
		}
		return false;
	}

	/**
	 * List all available providers.
	 */
	listProviders(): AIProviderType[] {
		return Array.from(this.providers.keys());
	}

	/**
	 * List all available models across all providers.
	 */
	async listAllModels(): Promise<AIModelConfig[]> {
		const models: AIModelConfig[] = [];

		for (const provider of this.providers.values()) {
			try {
				const providerModels = await provider.listModels();
				models.push(...providerModels);
			} catch {
				// Skip providers that fail to list models
			}
		}

		return models;
	}

	/**
	 * Check if any AI provider is available.
	 */
	isAvailable(): boolean {
		return this.activeProvider !== null;
	}

	/**
	 * Execute a completion with automatic provider selection.
	 */
	async complete(
		request: AIProviderRequest,
		preferredProvider?: AIProviderType
	): Promise<AIProviderResponse> {
		await this.initialize();

		// Try preferred provider first
		if (preferredProvider) {
			const provider = this.providers.get(preferredProvider);
			if (provider) {
				try {
					return await provider.complete(request);
				} catch (error) {
					console.warn(
						`[AI] Preferred provider ${preferredProvider} failed, trying fallback`
					);
				}
			}
		}

		// Try active provider
		const active = this.getActiveProvider();
		if (active) {
			try {
				return await active.complete(request);
			} catch (error) {
				console.warn(`[AI] Active provider failed, trying fallbacks`);
			}
		}

		// Try all providers in order
		for (const type of PROVIDER_PREFERENCE) {
			const provider = this.providers.get(type);
			if (provider && type !== this.activeProvider) {
				try {
					const response = await provider.complete(request);
					// Update active provider on success
					this.activeProvider = type;
					return response;
				} catch {
					// Continue to next provider
				}
			}
		}

		throw new Error("No AI provider available");
	}

	/**
	 * Execute a streaming completion with automatic provider selection.
	 */
	async *stream(
		request: AIProviderRequest,
		preferredProvider?: AIProviderType
	): AsyncGenerator<AIProviderStreamChunk, void, undefined> {
		await this.initialize();

		let provider: AIProvider | null = null;

		// Try preferred provider first
		if (preferredProvider) {
			provider = this.providers.get(preferredProvider) ?? null;
		}

		// Fall back to active provider
		if (!provider) {
			provider = this.getActiveProvider();
		}

		if (!provider) {
			throw new Error("No AI provider available");
		}

		yield* provider.stream(request);
	}
}

/**
 * Singleton AI provider manager instance.
 */
export const aiProviderManager = new AIProviderManager();

/**
 * Convenience function to get a quick completion.
 */
export async function quickComplete(
	messages: ChatMessage[],
	options?: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
		provider?: AIProviderType;
	}
): Promise<string> {
	const response = await aiProviderManager.complete(
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
 * Convenience function for a simple prompt completion.
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
	const messages: ChatMessage[] = [];

	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}

	messages.push({ role: "user", content: userMessage });

	return quickComplete(messages, options);
}
