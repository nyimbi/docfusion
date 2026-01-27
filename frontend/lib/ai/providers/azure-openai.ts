/**
 * Azure OpenAI Provider - DocFusion
 *
 * Implements the AI provider interface for Azure OpenAI Service.
 */

import type {
	AIProvider,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
} from "./types";

interface AzureOpenAIConfig {
	apiKey: string;
	endpoint: string;
	deploymentName: string;
	apiVersion: string;
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
	 */
	async isAvailable(): Promise<boolean> {
		if (
			!this.config.apiKey ||
			!this.config.endpoint ||
			!this.config.deploymentName
		) {
			return false;
		}

		try {
			// Simple health check by listing models
			const url = `${this.config.endpoint}/openai/models?api-version=${this.config.apiVersion}`;
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"api-key": this.config.apiKey,
				},
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Execute a completion request.
	 */
	async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
		const startTime = Date.now();
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
	const apiVersion =
		process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

	if (!apiKey || !endpoint || !deploymentName) {
		return null;
	}

	return new AzureOpenAIProvider({
		apiKey,
		endpoint: endpoint.replace(/\/$/, ""), // Remove trailing slash
		deploymentName,
		apiVersion,
	});
}
