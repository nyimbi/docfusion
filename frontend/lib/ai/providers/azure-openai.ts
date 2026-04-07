/**
 * Azure OpenAI Provider - DocFusion
 *
 * Implements the AI provider interface for Azure OpenAI Service.
 */

import { logger } from "@/lib/utils/logger";
import type {
	AIProvider,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
	AIEmbeddingRequest,
	AIEmbeddingResponse,
} from "./types";

interface AzureOpenAIConfig {
	apiKey: string;
	endpoint: string;
	deploymentName: string;
	apiVersion: string;
	/** Optional embedding deployment name (defaults to text-embedding-3-small deployment) */
	embeddingDeploymentName?: string;
}

/**
 * Azure OpenAI provider implementation.
 */
export class AzureOpenAIProvider implements AIProvider {
	readonly name = "azure-openai" as const;
	private config: AzureOpenAIConfig;

	constructor(config: AzureOpenAIConfig) {
		this.config = config;
	}

	/**
	 * Check if the provider is configured and available.
	 * Note: Health check is optional - returns true if config is present even if API check fails.
	 */
	async isAvailable(skipHealthCheck = true): Promise<boolean> {
		logger.debug("[Azure OpenAI] Checking availability...");
		logger.debug("[Azure OpenAI] Config:", {
			endpoint: this.config.endpoint,
			hasKey: !!this.config.apiKey,
			keyLength: this.config.apiKey?.length || 0,
			deployment: this.config.deploymentName,
			apiVersion: this.config.apiVersion,
		});

		// Check for missing configuration
		if (!this.config.apiKey && !this.config.endpoint && !this.config.deploymentName) {
			logger.error("[Azure OpenAI] Not available: All config values (API key, endpoint, deployment) are missing");
			return false;
		}

		const missing: string[] = [];
		if (!this.config.apiKey) missing.push("API key");
		if (!this.config.endpoint) missing.push("endpoint");
		if (!this.config.deploymentName) missing.push("deployment name");

		if (missing.length > 0) {
			logger.error(`[Azure OpenAI] Not available: Missing ${missing.join(", ")}`);
			return false;
		}

		// Skip health check if configured to do so (faster, avoids permission issues)
		if (skipHealthCheck) {
			logger.debug("[Azure OpenAI] Config present, skipping health check (available)");
			return true;
		}

		// Optional: Perform actual health check
		try {
			logger.debug("[Azure OpenAI] Performing health check...");
			// Note: Listing models requires specific permissions; /deployments is safer
			const url = `${this.config.endpoint}/openai/deployments?api-version=${this.config.apiVersion}`;
			logger.debug("[Azure OpenAI] Health check URL:", url);
			
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"api-key": this.config.apiKey,
				},
			});

			logger.debug("[Azure OpenAI] Health check response:", response.status, response.statusText);
			
			if (response.ok) {
				logger.debug("[Azure OpenAI] Health check passed, provider available");
				return true;
			} else {
				const errorText = await response.text();
				logger.warn(`[Azure OpenAI] Health check failed: ${response.status} - ${errorText}`);
				// Still return true if config is present - the actual API call might work even if health check doesn't
				logger.debug("[Azure OpenAI] Config is valid, assuming available despite health check failure");
				return true;
			}
		} catch (error) {
			logger.error("[Azure OpenAI] Health check error:", error instanceof Error ? error.message : String(error));
			// Return true anyway - the deployment-specific API might still work
			logger.debug("[Azure OpenAI] Config is valid, assuming available despite health check error");
			return true;
		}
	}

	/**
	 * Execute a completion request.
	 */
	async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
		const startTime = Date.now();
		const deployment = request.model || this.config.deploymentName;

		const url = `${this.config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${this.config.apiVersion}`;

		logger.debug("[Azure OpenAI] Complete request:", {
			deployment,
			url: url.replace(this.config.apiKey, "[REDACTED]"),
			messageCount: request.messages.length,
		});

		const body = {
			messages: request.messages.map((m) => ({
				role: m.role,
				content: m.content,
			})),
			temperature: request.temperature ?? 0.7,
			max_tokens: request.maxTokens ?? 2048,
			top_p: request.topP ?? 1,
			frequency_penalty: request.frequencyPenalty ?? 0,
			presence_penalty: request.presencePenalty ?? 0,
			stop: request.stop,
		};

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": this.config.apiKey,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			logger.error("[Azure OpenAI] API Error:", {
				status: response.status,
				statusText: response.statusText,
				error,
				deployment,
				endpoint: this.config.endpoint,
			});
			throw new Error(`Azure OpenAI error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		const latencyMs = Date.now() - startTime;

		const choice = data.choices?.[0];
		if (!choice) {
			throw new Error("No completion choice returned from Azure OpenAI");
		}

		return {
			content: choice.message?.content ?? "",
			finishReason: mapFinishReason(choice.finish_reason),
			usage: data.usage
				? {
						promptTokens: data.usage.prompt_tokens,
						completionTokens: data.usage.completion_tokens,
						totalTokens: data.usage.total_tokens,
					}
				: undefined,
			model: data.model || deployment,
			latencyMs,
		};
	}

	/**
	 * Execute a streaming completion request.
	 */
	async *stream(
		request: AIProviderRequest
	): AsyncGenerator<AIProviderStreamChunk, void, undefined> {
		const deployment = request.model || this.config.deploymentName;

		const url = `${this.config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${this.config.apiVersion}`;

		const body = {
			messages: request.messages.map((m) => ({
				role: m.role,
				content: m.content,
			})),
			temperature: request.temperature ?? 0.7,
			max_tokens: request.maxTokens ?? 2048,
			top_p: request.topP ?? 1,
			frequency_penalty: request.frequencyPenalty ?? 0,
			presence_penalty: request.presencePenalty ?? 0,
			stop: request.stop,
			stream: true,
		};

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": this.config.apiKey,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Azure OpenAI error: ${response.status} - ${error}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("No response body from Azure OpenAI");
		}

		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith("data: ")) continue;

					const data = trimmed.slice(6);
					if (data === "[DONE]") {
						yield { content: "", isComplete: true, finishReason: "stop" };
						return;
					}

					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta?.content || "";
						const finishReason = parsed.choices?.[0]?.finish_reason;

						if (delta || finishReason) {
							yield {
								content: delta,
								isComplete: !!finishReason,
								finishReason: finishReason
									? mapFinishReason(finishReason)
									: undefined,
							};
						}
					} catch {
						// Skip invalid JSON lines
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * List available models.
	 */
	async listModels(): Promise<AIModelConfig[]> {
		// Azure OpenAI uses deployments, not direct model listing
		// Return the configured deployment as the available model
		return [
			{
				provider: "azure-openai",
				modelId: this.config.deploymentName,
				displayName: `Azure: ${this.config.deploymentName}`,
				contextWindow: 128000, // GPT-4 context window
				maxOutputTokens: 4096,
				supportsStreaming: true,
				supportsVision: false,
			},
		];
	}

	/**
	 * Create embeddings for text.
	 * Uses the embedding deployment if configured, otherwise falls back to a default.
	 */
	async createEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
		// Use embedding-specific deployment if available
		const deployment =
			request.model ||
			this.config.embeddingDeploymentName ||
			process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME ||
			"text-embedding-3-small";

		const url = `${this.config.endpoint}/openai/deployments/${deployment}/embeddings?api-version=${this.config.apiVersion}`;

		// Normalize input to array
		const inputs = Array.isArray(request.input) ? request.input : [request.input];

		// Truncate inputs to safe length (8191 tokens is the limit, ~30000 chars is safe)
		const truncatedInputs = inputs.map((text) => text.slice(0, 30000));

		const body: Record<string, unknown> = {
			input: truncatedInputs.length === 1 ? truncatedInputs[0] : truncatedInputs,
		};

		// Add dimensions if specified (for text-embedding-3-* models)
		if (request.dimensions) {
			body.dimensions = request.dimensions;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": this.config.apiKey,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Azure OpenAI embedding error: ${response.status} - ${error}`);
		}

		const data = await response.json();

		// Handle both single and batch responses
		const embeddings: number[][] = data.data.map(
			(item: { embedding: number[]; index: number }) => item.embedding
		);

		return {
			embeddings,
			model: data.model || deployment,
			usage: {
				promptTokens: data.usage?.prompt_tokens ?? 0,
				totalTokens: data.usage?.total_tokens ?? 0,
			},
		};
	}
}

/**
 * Map Azure finish reason to standard format.
 */
function mapFinishReason(
	reason: string
): "stop" | "length" | "content_filter" | "error" {
	switch (reason) {
		case "stop":
			return "stop";
		case "length":
			return "length";
		case "content_filter":
			return "content_filter";
		default:
			return "stop";
	}
}

/**
 * Create Azure OpenAI provider from environment.
 */
export function createAzureOpenAIProvider(): AzureOpenAIProvider | null {
	const apiKey = process.env.AZURE_OPENAI_API_KEY;
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
	const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
	const embeddingDeploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME;
	const apiVersion =
		process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

	if (!apiKey || !endpoint || !deploymentName) {
		return null;
	}

	return new AzureOpenAIProvider({
		apiKey,
		endpoint: endpoint.replace(/\/$/, ""), // Remove trailing slash
		deploymentName,
		embeddingDeploymentName,
		apiVersion,
	});
}
