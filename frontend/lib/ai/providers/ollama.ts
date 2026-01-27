/**
 * Ollama Provider - DocFusion
 *
 * Implements the AI provider interface for local Ollama models.
 * Supports models like llama, mistral, qwen, gpt-oss, etc.
 */

import type {
	AIProvider,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
	AIModelConfig,
} from "./types";

interface OllamaConfig {
	baseUrl: string;
	defaultModel: string;
}

interface OllamaModel {
	name: string;
	size: number;
	digest: string;
	modified_at: string;
	details?: {
		parameter_size?: string;
		quantization_level?: string;
		family?: string;
	};
}

/**
 * Ollama provider implementation.
 */
export class OllamaProvider implements AIProvider {
	readonly name = "ollama" as const;
	private config: OllamaConfig;

	constructor(config: OllamaConfig) {
		this.config = config;
	}

	/**
	 * Check if Ollama is running and available.
	 */
	async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.config.baseUrl}/api/tags`, {
				method: "GET",
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
		const model = request.model || this.config.defaultModel;

		// Convert chat format to Ollama format
		const response = await fetch(`${this.config.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: request.messages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
				stream: false,
				options: {
					temperature: request.temperature ?? 0.7,
					num_predict: request.maxTokens ?? 2048,
					top_p: request.topP ?? 1,
					stop: request.stop,
				},
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Ollama error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		const latencyMs = Date.now() - startTime;

		return {
			content: data.message?.content ?? "",
			finishReason: data.done ? "stop" : "length",
			usage: {
				promptTokens: data.prompt_eval_count ?? 0,
				completionTokens: data.eval_count ?? 0,
				totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
			},
			model: data.model || model,
			latencyMs,
		};
	}

	/**
	 * Execute a streaming completion request.
	 */
	async *stream(
		request: AIProviderRequest
	): AsyncGenerator<AIProviderStreamChunk, void, undefined> {
		const model = request.model || this.config.defaultModel;

		const response = await fetch(`${this.config.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: request.messages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
				stream: true,
				options: {
					temperature: request.temperature ?? 0.7,
					num_predict: request.maxTokens ?? 2048,
					top_p: request.topP ?? 1,
					stop: request.stop,
				},
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Ollama error: ${response.status} - ${error}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("No response body from Ollama");
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
					if (!trimmed) continue;

					try {
						const parsed = JSON.parse(trimmed);
						const content = parsed.message?.content || "";
						const isDone = parsed.done === true;

						yield {
							content,
							isComplete: isDone,
							finishReason: isDone ? "stop" : undefined,
						};
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
	 * List available models from Ollama.
	 */
	async listModels(): Promise<AIModelConfig[]> {
		try {
			const response = await fetch(`${this.config.baseUrl}/api/tags`, {
				method: "GET",
			});

			if (!response.ok) {
				return [];
			}

			const data = await response.json();
			const models: OllamaModel[] = data.models || [];

			return models.map((m) => ({
				provider: "ollama" as const,
				modelId: m.name,
				displayName: `Ollama: ${m.name}`,
				contextWindow: getOllamaContextWindow(m.name),
				maxOutputTokens: 4096,
				supportsStreaming: true,
				supportsVision: m.name.includes("llava") || m.name.includes("vision"),
			}));
		} catch {
			return [];
		}
	}

	/**
	 * Pull a model if not already available.
	 */
	async pullModel(modelName: string): Promise<void> {
		const response = await fetch(`${this.config.baseUrl}/api/pull`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: modelName }),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to pull model: ${error}`);
		}

		// Consume the stream to wait for completion
		const reader = response.body?.getReader();
		if (reader) {
			try {
				while (true) {
					const { done } = await reader.read();
					if (done) break;
				}
			} finally {
				reader.releaseLock();
			}
		}
	}
}

/**
 * Estimate context window size for Ollama models.
 */
function getOllamaContextWindow(modelName: string): number {
	const name = modelName.toLowerCase();

	// Models with known context windows
	if (name.includes("qwen")) return 32768;
	if (name.includes("llama3") || name.includes("llama-3")) return 8192;
	if (name.includes("mistral")) return 32768;
	if (name.includes("mixtral")) return 32768;
	if (name.includes("codellama")) return 16384;
	if (name.includes("phi")) return 2048;
	if (name.includes("gemma")) return 8192;

	// Default
	return 4096;
}

/**
 * Create Ollama provider from environment.
 */
export function createOllamaProvider(): OllamaProvider | null {
	const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
	const defaultModel = process.env.OLLAMA_DEFAULT_MODEL || "gpt-oss";

	return new OllamaProvider({
		baseUrl,
		defaultModel,
	});
}
