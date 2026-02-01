/**
 * Unified AI Client - DocFusion
 *
 * High-level client interface for AI operations with automatic provider management,
 * user preferences integration, and robust error handling.
 */

import {
	getProviderManager,
	quickComplete,
	prompt,
	testOllamaConnection,
	testProviderConnections,
	createOllamaProvider,
	resetProviderManager,
} from "./providers/factory";
import {
	getUserSettings,
	updateUserSettings,
	getDefaultSettings,
	getTimeouts,
	initializeAIConfigForUser,
} from "./config";
import type {
	AICompletionOptions,
	AICompletionResult,
	AIStreamChunk,
	SettingsValidationResult,
	AISettingsFormData,
} from "./types";
import { AI_CONFIG_DEFAULTS, RECOMMENDED_OLLAMA_MODELS } from "./types";
import type {
	AIProviderType,
	AIProviderRequest,
	AIModelConfig,
	AIEmbeddingRequest,
	AIEmbeddingResponse,
} from "./providers/types";

// ============================================================================
// Unified AI Client Class
// ============================================================================

export class AIClient {
	private manager = getProviderManager();
	private abortControllers = new Map<string, AbortController>();
	private requestId = 0;

	/**
	 * Initialize the client with user context.
	 */
	async initialize(userId: string): Promise<void> {
		await initializeAIConfigForUser(userId);
		resetProviderManager();
		this.manager = getProviderManager();
	}

	/**
	 * Generate a unique request ID.
	 */
	private generateRequestId(): string {
		return `req_${++this.requestId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	}

	/**
	 * Execute a completion request.
	 */
	async complete(
		prompt: string,
		options: AICompletionOptions = {}
	): Promise<AICompletionResult> {
		const requestId = this.generateRequestId();
		const controller = new AbortController();
		this.abortControllers.set(requestId, controller);

		const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
			{ role: "user", content: prompt },
		];

		const defaults = getDefaultSettings();
		const request: AIProviderRequest = {
			messages,
			model: options.model,
			temperature: options.temperature ?? defaults.temperature,
			maxTokens: options.maxTokens ?? defaults.maxTokens,
			topP: 1,
		};

		try {
			const response = await this.manager.complete(request, options.provider);

			return {
				content: response.content,
				provider: response.provider,
				model: response.model,
				confidence: 0.95,
				usage: response.usage,
				latencyMs: response.latencyMs,
				finishReason: response.finishReason,
				isFallback: response.isFallback,
			};
		} finally {
			this.abortControllers.delete(requestId);
		}
	}

	/**
	 * Generate text completion with optional system prompt.
	 */
	async chat(
		messages: { role: "system" | "user" | "assistant"; content: string }[],
		options: AICompletionOptions = {}
	): Promise<AICompletionResult> {
		const defaults = getDefaultSettings();
		const request: AIProviderRequest = {
			messages,
			model: options.model,
			temperature: options.temperature ?? defaults.temperature,
			maxTokens: options.maxTokens ?? defaults.maxTokens,
		};

		const response = await this.manager.complete(request, options.provider);

		return {
			content: response.content,
			provider: response.provider,
			model: response.model,
			confidence: 0.95,
			usage: response.usage,
			latencyMs: response.latencyMs,
			finishReason: response.finishReason,
			isFallback: response.isFallback,
		};
	}

	/**
	 * Stream a completion response.
	 */
	async *stream(
		prompt: string,
		options: AICompletionOptions = {}
	): AsyncGenerator<AIStreamChunk, void, undefined> {
		const defaults = getDefaultSettings();
		const request: AIProviderRequest = {
			messages: [{ role: "user", content: prompt }],
			model: options.model,
			temperature: options.temperature ?? defaults.temperature,
			maxTokens: options.maxTokens ?? defaults.maxTokens,
			topP: 1,
		};

		let accumulated = "";

		for await (const chunk of this.manager.stream(request, options.provider)) {
			accumulated += chunk.content;

			yield {
				delta: chunk.content,
				accumulated,
				isComplete: chunk.isComplete,
				provider: chunk.provider,
				model: chunk.provider, // Will be updated by provider
			};
		}
	}

	/**
	 * Stream a chat conversation.
	 */
	async *streamChat(
		messages: { role: "system" | "user" | "assistant"; content: string }[],
		options: AICompletionOptions = {}
	): AsyncGenerator<AIStreamChunk, void, undefined> {
		const defaults = getDefaultSettings();
		const request: AIProviderRequest = {
			messages,
			model: options.model,
			temperature: options.temperature ?? defaults.temperature,
			maxTokens: options.maxTokens ?? defaults.maxTokens,
		};

		let accumulated = "";

		for await (const chunk of this.manager.stream(request, options.provider)) {
			accumulated += chunk.content;

			yield {
				delta: chunk.content,
				accumulated,
				isComplete: chunk.isComplete,
				provider: chunk.provider,
				model: chunk.provider,
			};
		}
	}

	/**
	 * Cancel an in-progress request.
	 */
	cancel(requestId: string): void {
		const controller = this.abortControllers.get(requestId);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(requestId);
		}
	}

	/**
	 * Generate embeddings for text.
	 * @param input - Single text or array of texts to embed
	 * @param options - Optional configuration
	 * @returns Embedding response with vectors
	 */
	async createEmbedding(
		input: string | string[],
		options: { model?: string; dimensions?: number; provider?: AIProviderType } = {}
	): Promise<AIEmbeddingResponse> {
		const request: AIEmbeddingRequest = {
			input,
			model: options.model,
			dimensions: options.dimensions ?? 1536, // Default for OpenAI compatibility
		};

		// Get the provider - prefer Azure for embeddings
		const providers = await this.getAvailableProviders();
		const preferredProvider = options.provider || (providers.includes("azure-openai") ? "azure-openai" : providers[0]);

		if (!preferredProvider) {
			throw new Error("No AI provider available for embeddings");
		}

		// Get the provider instance from the manager
		const provider = this.manager.getProvider(preferredProvider);

		if (!provider) {
			throw new Error(`Provider ${preferredProvider} is not available`);
		}

		if (!provider.createEmbedding) {
			throw new Error(`Provider ${preferredProvider} does not support embeddings`);
		}

		return provider.createEmbedding(request);
	}

	/**
	 * Generate embedding for a single text (convenience method).
	 */
	async embed(
		text: string,
		options: { model?: string; dimensions?: number } = {}
	): Promise<number[]> {
		const response = await this.createEmbedding(text, options);
		return response.embeddings[0];
	}

	/**
	 * Generate embeddings for multiple texts (convenience method).
	 */
	async embedBatch(
		texts: string[],
		options: { model?: string; dimensions?: number } = {}
	): Promise<number[][]> {
		const response = await this.createEmbedding(texts, options);
		return response.embeddings;
	}

	/**
	 * Get available providers.
	 */
	async getAvailableProviders(): Promise<AIProviderType[]> {
		return this.manager.listAvailableProviders();
	}

	/**
	 * List all available models.
	 */
	async listModels(): Promise<AIModelConfig[]> {
		return this.manager.listAllModels();
	}

	/**
	 * Get connection status for all providers.
	 */
	async checkConnections(): Promise<
		Record<AIProviderType, { success: boolean; message: string; models?: string[] }>
	> {
		return testProviderConnections();
	}

	/**
	 * Test Ollama connection.
	 */
	async testOllama(
		baseUrl: string,
		model?: string
	): Promise<{ success: boolean; message: string; models?: string[] }> {
		return testOllamaConnection(baseUrl, model);
	}
}

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Settings manager for user AI preferences.
 */
export class AISettingsManager {
	/**
	 * Load current user settings.
	 */
	async loadSettings(): Promise<AISettingsFormData> {
		return getUserSettings();
	}

	/**
	 * Save user settings.
	 */
	async saveSettings(settings: AISettingsFormData): Promise<void> {
		// Validate first
		const validation = this.validateSettings(settings);
		if (!validation.isValid) {
			throw new Error(
				`Invalid settings: ${Object.values(validation.errors).join(", ")}`
			);
		}

		await updateUserSettings(settings);

		// Reinitialize after settings change
		resetProviderManager();
	}

	/**
	 * Validate settings form data.
	 */
	validateSettings(settings: AISettingsFormData): SettingsValidationResult {
		const errors: Partial<Record<keyof AISettingsFormData, string>> = {};

		// Validate URL for Ollama
		if (settings.provider === "ollama" || settings.provider === "auto") {
			try {
				new URL(settings.ollamaUrl);
			} catch {
				errors.ollamaUrl = "Please enter a valid URL";
			}
		}

		// Validate temperature
		if (settings.temperature < 0 || settings.temperature > 1) {
			errors.temperature = "Temperature must be between 0 and 1";
		}

		// Validate max tokens
		if (settings.maxTokens < 1 || settings.maxTokens > 16384) {
			errors.maxTokens = "Max tokens must be between 1 and 16384";
		}

		// Validate Ollama model
		if (
			(settings.provider === "ollama" || settings.provider === "auto") &&
			!settings.ollamaModel
		) {
			errors.ollamaModel = "Please select or enter a model name";
		}

		return {
			isValid: Object.keys(errors).length === 0,
			errors,
			connectionTests: {},
		};
	}

	/**
	 * Test settings before saving.
	 */
	async testSettings(
		settings: AISettingsFormData
	): Promise<SettingsValidationResult> {
		const errors: Partial<Record<keyof AISettingsFormData, string>> = {};
		const connectionTests: Partial<
			Record<AIProviderType, { success: boolean; message: string }>
		> = {};

		// Test Ollama if selected
		if (settings.provider === "ollama" || settings.provider === "auto") {
			try {
				const result = await testOllamaConnection(
					settings.ollamaUrl,
					settings.ollamaModel
				);
				connectionTests["ollama"] = result;

				if (!result.success && settings.provider === "ollama") {
					errors.ollamaUrl = result.message;
				}
			} catch {
				connectionTests["ollama"] = {
					success: false,
					message: "Failed to test Ollama connection",
				};
			}
		}

		// Test Azure if selected
		if (settings.provider === "azure-openai" || settings.provider === "auto") {
			const results = await testProviderConnections();
			connectionTests["azure-openai"] = results["azure-openai"];

			if (
				!results["azure-openai"].success &&
				settings.provider === "azure-openai"
			) {
				errors.provider = "Azure OpenAI is not configured";
			}
		}

		return {
			isValid: Object.keys(errors).length === 0,
			errors,
			connectionTests,
		};
	}

	/**
	 * Get default setting values.
	 */
	getDefaults(): typeof AI_CONFIG_DEFAULTS {
		return AI_CONFIG_DEFAULTS;
	}

	/**
	 * Get recommended Ollama models.
	 */
	getRecommendedOllamaModels(): typeof RECOMMENDED_OLLAMA_MODELS {
		return RECOMMENDED_OLLAMA_MODELS;
	}

	/**
	 * Get available providers with metadata.
	 */
	getProviderOptions() {
		return [
			{
				value: "auto",
				label: "Auto (Recommended)",
				description: "Automatically select the best available provider",
			},
			{
				value: "azure-openai",
				label: "Azure OpenAI",
				description: "Enterprise AI through Microsoft Azure",
			},
			{
				value: "ollama",
				label: "Ollama (Local)",
				description: "Run AI locally on your machine",
			},
		];
	}
}

// ============================================================================
// Singleton Exports
// ============================================================================

let clientInstance: AIClient | null = null;
let settingsManagerInstance: AISettingsManager | null = null;

export function getAIClient(): AIClient {
	if (!clientInstance) {
		clientInstance = new AIClient();
	}
	return clientInstance;
}

export function getAISettingsManager(): AISettingsManager {
	if (!settingsManagerInstance) {
		settingsManagerInstance = new AISettingsManager();
	}
	return settingsManagerInstance;
}

/**
 * Initialize AI with user context.
 */
export async function initializeAI(userId: string): Promise<void> {
	await initializeAIConfigForUser(userId);
	const client = getAIClient();
	await client.initialize(userId);
}

// ============================================================================
// Quick Access Functions
// ============================================================================

/**
 * Quick prompt completion.
 */
export async function complete(
	promptText: string,
	options?: AICompletionOptions
): Promise<AICompletionResult> {
	const client = getAIClient();
	return client.complete(promptText, options);
}

/**
 * Quick chat completion.
 */
export async function chat(
	messages: { role: "system" | "user" | "assistant"; content: string }[],
	options?: AICompletionOptions
): Promise<AICompletionResult> {
	const client = getAIClient();
	return client.chat(messages, options);
}

/**
 * Stream text generation.
 */
export async function* stream(
	promptText: string,
	options?: AICompletionOptions
): AsyncGenerator<AIStreamChunk, void, undefined> {
	const client = getAIClient();
	yield* client.stream(promptText, options);
}

/**
 * Stream chat.
 */
export async function* streamChat(
	messages: { role: "system" | "user" | "assistant"; content: string }[],
	options?: AICompletionOptions
): AsyncGenerator<AIStreamChunk, void, undefined> {
	const client = getAIClient();
	yield* client.streamChat(messages, options);
}

// Re-export types
export type {
	AICompletionOptions,
	AICompletionResult,
	AIStreamChunk,
	AISettingsFormData,
	SettingsValidationResult,
};
export {
	AI_CONFIG_DEFAULTS,
	RECOMMENDED_OLLAMA_MODELS,
	testProviderConnections,
	testOllamaConnection,
};
