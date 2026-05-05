/**
 * LiteLLM Provider - DocFusion
 *
 * Uses the Lindela LiteLLM gateway as an OpenAI-compatible proxy.
 */

import { logger } from "@/lib/utils/logger";
import type {
	AIEmbeddingRequest,
	AIEmbeddingResponse,
	AIModelConfig,
	AIProvider,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
} from "./types";

export interface LiteLLMProviderConfig {
	baseUrl: string;
	apiKey: string;
	defaultModel: string;
	fastModel?: string;
	embeddingModel?: string;
}

interface OpenAIModelListResponse {
	data?: Array<{
		id: string;
		object?: string;
		owned_by?: string;
	}>;
}

export class LiteLLMProvider implements AIProvider {
	readonly name = "litellm" as const;
	private config: LiteLLMProviderConfig;

	constructor(config: LiteLLMProviderConfig) {
		this.config = {
			...config,
			baseUrl: normalizeBaseUrl(config.baseUrl),
		};
	}

	async isAvailable(skipHealthCheck = true): Promise<boolean> {
		if (!this.config.baseUrl || !this.config.apiKey || !this.config.defaultModel) {
			return false;
		}
		if (skipHealthCheck) {
			return true;
		}

		try {
			const response = await fetch(`${this.config.baseUrl}/models`, {
				method: "GET",
				headers: this.headers(),
			});
			if (response.ok) return true;
			logger.warn("[LiteLLM] Model-list health check failed", {
				status: response.status,
				statusText: response.statusText,
			});
			return false;
		} catch (error) {
			logger.warn("[LiteLLM] Health check error", error);
			return false;
		}
	}

	async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
		const startTime = Date.now();
		const model = request.model || this.config.defaultModel;
		const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				model,
				messages: request.messages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
				temperature: request.temperature ?? 0.7,
				max_tokens: request.maxTokens ?? 2048,
				top_p: request.topP ?? 1,
				frequency_penalty: request.frequencyPenalty ?? 0,
				presence_penalty: request.presencePenalty ?? 0,
				stop: request.stop,
				stream: false,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`LiteLLM error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		if (!choice) {
			throw new Error("No completion choice returned from LiteLLM");
		}

		return {
			content: choice.message?.content ?? "",
			finishReason: mapFinishReason(choice.finish_reason),
			usage: data.usage
				? {
					promptTokens: data.usage.prompt_tokens ?? 0,
					completionTokens: data.usage.completion_tokens ?? 0,
					totalTokens: data.usage.total_tokens ?? 0,
				}
				: undefined,
			model: data.model || model,
			latencyMs: Date.now() - startTime,
		};
	}

	async *stream(request: AIProviderRequest): AsyncGenerator<AIProviderStreamChunk, void, undefined> {
		const model = request.model || this.config.defaultModel;
		const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				model,
				messages: request.messages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
				temperature: request.temperature ?? 0.7,
				max_tokens: request.maxTokens ?? 2048,
				top_p: request.topP ?? 1,
				frequency_penalty: request.frequencyPenalty ?? 0,
				presence_penalty: request.presencePenalty ?? 0,
				stop: request.stop,
				stream: true,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`LiteLLM stream error: ${response.status} - ${error}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("No response body from LiteLLM");
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
								isComplete: Boolean(finishReason),
								finishReason: finishReason ? mapFinishReason(finishReason) : undefined,
							};
						}
					} catch {
						// Ignore malformed SSE lines.
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async listModels(): Promise<AIModelConfig[]> {
		try {
			const response = await fetch(`${this.config.baseUrl}/models`, {
				method: "GET",
				headers: this.headers(),
			});
			if (!response.ok) {
				throw new Error(`LiteLLM model list failed: ${response.status}`);
			}
			const data = (await response.json()) as OpenAIModelListResponse;
			const modelIds = (data.data ?? []).map((model) => model.id);
			return modelIds.length > 0
				? modelIds.map((modelId) => this.modelConfig(modelId))
				: this.defaultModels();
		} catch (error) {
			logger.warn("[LiteLLM] Failed to list models, using configured aliases", error);
			return this.defaultModels();
		}
	}

	async createEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
		const model = request.model || this.config.embeddingModel || "text-embedding-ada-002";
		const inputs = Array.isArray(request.input) ? request.input : [request.input];
		const response = await fetch(`${this.config.baseUrl}/embeddings`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				model,
				input: inputs.length === 1 ? inputs[0] : inputs,
				...(request.dimensions ? { dimensions: request.dimensions } : {}),
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`LiteLLM embedding error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		return {
			embeddings: data.data.map((item: { embedding: number[] }) => item.embedding),
			model: data.model || model,
			usage: {
				promptTokens: data.usage?.prompt_tokens ?? 0,
				totalTokens: data.usage?.total_tokens ?? 0,
			},
		};
	}

	private headers(): Record<string, string> {
		return {
			"Authorization": `Bearer ${this.config.apiKey}`,
			"Content-Type": "application/json",
		};
	}

	private defaultModels(): AIModelConfig[] {
		return [
			this.modelConfig(this.config.defaultModel),
			...(this.config.fastModel && this.config.fastModel !== this.config.defaultModel
				? [this.modelConfig(this.config.fastModel)]
				: []),
			...(this.config.embeddingModel
				? [this.modelConfig(this.config.embeddingModel, { embedding: true })]
				: []),
		];
	}

	private modelConfig(modelId: string, options: { embedding?: boolean } = {}): AIModelConfig {
		return {
			provider: "litellm",
			modelId,
			displayName: `LiteLLM: ${modelId}`,
			contextWindow: modelId.includes("mini") ? 128000 : 128000,
			maxOutputTokens: options.embedding ? 0 : 8192,
			supportsStreaming: !options.embedding,
			supportsVision: false,
		};
	}
}

export function createLiteLLMProvider(config: LiteLLMProviderConfig | undefined): LiteLLMProvider | null {
	if (!config?.baseUrl || !config.apiKey || !config.defaultModel) {
		return null;
	}
	return new LiteLLMProvider(config);
}

function normalizeBaseUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim().replace(/\/$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function mapFinishReason(reason: string | null | undefined): "stop" | "length" | "content_filter" | "error" {
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
