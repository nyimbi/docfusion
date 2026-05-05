"use server";

import { requireUserContext } from "@/lib/auth-utils";
import {
	getProviderManager,
	testProviderConnections,
	type AIModelConfig,
	type AIProvider,
	type AIProviderType,
} from "@/lib/ai/providers";
import {
	getEffectiveProvider,
	getFallbackProviders,
	isProviderConfigured,
} from "@/lib/ai/config";

export interface AIProviderGovernanceSnapshot {
	checkedAt: string;
	checkedBy: string;
	overallAvailable: boolean;
	activeProvider: AIProviderType | null;
	effectiveProvider: AIProviderType | null;
	fallbackProviders: AIProviderType[];
	fallbackReady: boolean;
	providers: AIProviderGovernanceStatus[];
	models: AIModelGovernanceStatus[];
	configuration: Record<string, boolean>;
	diagnostics: string[];
}

export interface AIProviderGovernanceStatus {
	provider: AIProviderType;
	configured: boolean;
	available: boolean;
	message: string;
	modelCount: number;
	modelIds: string[];
	role: "active" | "fallback" | "candidate";
}

export interface AIModelGovernanceStatus {
	provider: AIProviderType;
	modelId: string;
	displayName: string;
	supportsStreaming: boolean;
	supportsVision: boolean;
	contextWindow: number;
	maxOutputTokens: number;
	hasCostMetadata: boolean;
}

const GOVERNED_PROVIDERS: AIProviderType[] = ["litellm", "azure-openai", "ollama"];

export async function getAIProviderGovernanceSnapshot(): Promise<AIProviderGovernanceSnapshot> {
	const userContext = await requireUserContext();
	const checkedAt = new Date().toISOString();
	const manager = getProviderManager();
	await manager.initialize();

	const [overallAvailable, activeProvider, models, connectionResults] = await Promise.all([
		manager.isAvailable(),
		manager.getActiveProvider() as Promise<AIProvider | null>,
		manager.listAllModels(),
		testProviderConnections(),
	]);

	const activeProviderName = activeProvider?.name ?? null;
	const fallbackProviders = getFallbackProviders().filter(isGovernedProvider);
	const providerStatuses = buildProviderStatuses({
		activeProvider: activeProviderName,
		fallbackProviders,
		models,
		connectionResults,
	});
	const diagnostics = buildDiagnostics(providerStatuses, overallAvailable);

	return {
		checkedAt,
		checkedBy: userContext.userId,
		overallAvailable,
		activeProvider: activeProviderName,
		effectiveProvider: getEffectiveProvider(),
		fallbackProviders,
		fallbackReady: providerStatuses.some((status) => status.available),
		providers: providerStatuses,
		models: models.map(mapModelStatus),
		configuration: redactedConfigurationStatus(),
		diagnostics,
	};
}

function buildProviderStatuses(input: {
	activeProvider: AIProviderType | null;
	fallbackProviders: AIProviderType[];
	models: AIModelConfig[];
	connectionResults: Partial<Record<AIProviderType, { success: boolean; message: string; models?: string[] }>>;
}): AIProviderGovernanceStatus[] {
	return GOVERNED_PROVIDERS.map((provider) => {
		const result = input.connectionResults[provider];
		const providerModels = input.models.filter((model) => model.provider === provider);
		return {
			provider,
			configured: isProviderConfigured(provider),
			available: Boolean(result?.success),
			message: result?.message ?? "Provider was not checked",
			modelCount: providerModels.length,
			modelIds: providerModels.map((model) => model.modelId),
			role: provider === input.activeProvider
				? "active"
				: input.fallbackProviders.includes(provider)
					? "fallback"
					: "candidate",
		};
	});
}

function mapModelStatus(model: AIModelConfig): AIModelGovernanceStatus {
	return {
		provider: model.provider,
		modelId: model.modelId,
		displayName: model.displayName,
		supportsStreaming: model.supportsStreaming,
		supportsVision: model.supportsVision,
		contextWindow: model.contextWindow,
		maxOutputTokens: model.maxOutputTokens,
		hasCostMetadata: model.costPer1kInputTokens !== undefined
			|| model.costPer1kOutputTokens !== undefined,
	};
}

function buildDiagnostics(
	providers: AIProviderGovernanceStatus[],
	overallAvailable: boolean
): string[] {
	const diagnostics: string[] = [];
	if (!overallAvailable) {
		diagnostics.push("No AI provider is available for completion or adaptation work.");
	}
	for (const provider of providers) {
		if (!provider.configured) {
			diagnostics.push(`${provider.provider} is not configured.`);
		} else if (!provider.available) {
			diagnostics.push(`${provider.provider} is configured but unavailable: ${provider.message}`);
		} else if (provider.modelCount === 0) {
			diagnostics.push(`${provider.provider} is available but did not report model metadata.`);
		}
	}
	return diagnostics;
}

function redactedConfigurationStatus(): Record<string, boolean> {
	return {
		LITELLM_URL: Boolean(process.env.LITELLM_URL || process.env.LITELLM_BASE_URL),
		LITELLM_API_KEY: Boolean(process.env.LITELLM_API_KEY || process.env.LITELLM_KEY),
		LLM_MODEL: Boolean(process.env.LLM_MODEL || process.env.LITELLM_MODEL),
		AZURE_OPENAI_API_KEY: Boolean(process.env.AZURE_OPENAI_API_KEY),
		AZURE_OPENAI_ENDPOINT: Boolean(process.env.AZURE_OPENAI_ENDPOINT),
		AZURE_OPENAI_DEPLOYMENT_NAME: Boolean(process.env.AZURE_OPENAI_DEPLOYMENT_NAME),
		AZURE_OPENAI_API_VERSION: Boolean(process.env.AZURE_OPENAI_API_VERSION),
		OLLAMA_BASE_URL: Boolean(process.env.OLLAMA_BASE_URL),
	};
}

function isGovernedProvider(provider: AIProviderType): provider is "litellm" | "azure-openai" | "ollama" {
	return GOVERNED_PROVIDERS.includes(provider);
}
