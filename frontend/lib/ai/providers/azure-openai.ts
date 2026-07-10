/**
 * Azure OpenAI Provider - DocFusion
 *
 * Compatibility adapter for the legacy azure-openai provider name. Requests are
 * routed through the LiteLLM gateway; application code must not call Azure
 * OpenAI directly.
 */

import { logger } from "@/lib/utils/logger";
import { LiteLLMProvider, type LiteLLMProviderConfig } from "./litellm";
import type {
	AIEmbeddingRequest,
	AIEmbeddingResponse,
	AIModelConfig,
	AIProvider,
	AIProviderRequest,
	AIProviderResponse,
	AIProviderStreamChunk,
} from "./types";

interface AzureOpenAIConfig {
	apiKey: string;
	endpoint: string;
	deploymentName: string;
	apiVersion: string;
	embeddingDeploymentName?: string;
}

export class AzureOpenAIProvider implements AIProvider {
	readonly name = "azure-openai" as const;
	private readonly litellm: LiteLLMProvider;
	private readonly config: LiteLLMProviderConfig;

	constructor(config: AzureOpenAIConfig) {
		this.config = toLiteLLMConfig(config);
		this.litellm = new LiteLLMProvider(this.config);
	}

	async isAvailable(skipHealthCheck = true): Promise<boolean> {
		logger.debug("[Azure OpenAI compatibility] Checking LiteLLM gateway availability");
		return this.litellm.isAvailable(skipHealthCheck);
	}

	async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
		return this.litellm.complete({
			...request,
			model: request.model || this.config.defaultModel,
		});
	}

	async *stream(request: AIProviderRequest): AsyncGenerator<AIProviderStreamChunk, void, undefined> {
		yield* this.litellm.stream({
			...request,
			model: request.model || this.config.defaultModel,
		});
	}

	async listModels(): Promise<AIModelConfig[]> {
		const models = await this.litellm.listModels();
		return models.map((model) => ({
			...model,
			provider: "azure-openai",
			displayName: `LiteLLM: ${model.modelId}`,
		}));
	}

	async createEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
		return this.litellm.createEmbedding({
			...request,
			model: request.model || this.config.embeddingModel,
		});
	}
}

export function createAzureOpenAIProvider(): AzureOpenAIProvider | null {
	const apiKey = process.env.LITELLM_API_KEY || process.env.LITELLM_KEY;
	if (!apiKey) {
		return null;
	}
	const embeddingDeploymentName = process.env.LLM_EMBEDDING_MODEL;

	return new AzureOpenAIProvider({
		apiKey,
		endpoint: process.env.LITELLM_URL || "http://62.169.25.77:4000/v1",
		deploymentName: process.env.LLM_MODEL || "gpt-4o",
		apiVersion: "litellm",
		...(embeddingDeploymentName ? { embeddingDeploymentName } : {}),
	});
}

function toLiteLLMConfig(config: AzureOpenAIConfig): LiteLLMProviderConfig {
	const endpointIsLiteLLM = /(^|[/.:])62\.169\.25\.77(?::4000)?(?:\/|$)|litellm/i.test(config.endpoint);
	return {
		baseUrl: process.env.LITELLM_URL || (endpointIsLiteLLM ? config.endpoint : "http://62.169.25.77:4000/v1"),
		apiKey: process.env.LITELLM_API_KEY || process.env.LITELLM_KEY || (endpointIsLiteLLM ? config.apiKey : ""),
		defaultModel: process.env.LLM_MODEL || config.deploymentName || "gpt-4o",
		fastModel: process.env.LLM_FAST_MODEL || "gpt-4o-mini",
		embeddingModel:
			process.env.LLM_EMBEDDING_MODEL ||
			config.embeddingDeploymentName ||
			"text-embedding-ada-002",
	};
}
