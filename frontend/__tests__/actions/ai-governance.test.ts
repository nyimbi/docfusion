import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const manager = {
		initialize: vi.fn(async () => undefined),
		isAvailable: vi.fn(async () => true),
		getActiveProvider: vi.fn(async () => ({ name: "litellm" })),
		listAllModels: vi.fn(async () => [
			{
				provider: "litellm",
				modelId: "gpt-4o",
				displayName: "LiteLLM: gpt-4o",
				contextWindow: 128000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				supportsVision: false,
				costPer1kInputTokens: 0.001,
			},
			{
				provider: "azure-openai",
				modelId: "gpt-4.1",
				displayName: "GPT 4.1",
				contextWindow: 128000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				supportsVision: true,
				costPer1kInputTokens: 0.002,
			},
		]),
	};
	return {
		manager,
		requireUserContext: vi.fn(async () => ({ userId: "ai-admin-1" })),
		testProviderConnections: vi.fn(async () => ({
			litellm: { success: true, message: "LiteLLM gateway is configured and reachable", models: ["gpt-4o"] },
			"azure-openai": { success: true, message: "Azure OpenAI is configured and available" },
			ollama: { success: false, message: "Ollama is not reachable" },
		})),
		getFallbackProviders: vi.fn(() => ["litellm", "ollama", "openai"]),
		getEffectiveProvider: vi.fn(() => "litellm"),
		isProviderConfigured: vi.fn((provider: string) => provider === "litellm" || provider === "azure-openai"),
	};
});

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: mocks.requireUserContext,
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => mocks.manager),
	testProviderConnections: mocks.testProviderConnections,
}));

vi.mock("@/lib/ai/config", () => ({
	getFallbackProviders: mocks.getFallbackProviders,
	getEffectiveProvider: mocks.getEffectiveProvider,
	isProviderConfigured: mocks.isProviderConfigured,
}));

import { getAIProviderGovernanceSnapshot } from "@/lib/actions/ai-governance";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	vi.clearAllMocks();
	process.env = {
		...ORIGINAL_ENV,
		LITELLM_URL: "http://84.247.181.100:4000/v1",
		LITELLM_API_KEY: "litellm-test-key",
		LLM_MODEL: "gpt-4o",
		AZURE_OPENAI_API_KEY: "test-key",
		AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
		AZURE_OPENAI_DEPLOYMENT_NAME: "gpt-4.1",
		AZURE_OPENAI_API_VERSION: "2024-12-01-preview",
		OLLAMA_BASE_URL: "",
	};
	mocks.manager.initialize.mockResolvedValue(undefined);
	mocks.manager.isAvailable.mockResolvedValue(true);
	mocks.manager.getActiveProvider.mockResolvedValue({ name: "litellm" });
	mocks.manager.listAllModels.mockResolvedValue([
		{
			provider: "litellm",
			modelId: "gpt-4o",
			displayName: "LiteLLM: gpt-4o",
			contextWindow: 128000,
			maxOutputTokens: 8192,
			supportsStreaming: true,
			supportsVision: false,
			costPer1kInputTokens: 0.001,
		},
		{
			provider: "azure-openai",
			modelId: "gpt-4.1",
			displayName: "GPT 4.1",
			contextWindow: 128000,
			maxOutputTokens: 8192,
			supportsStreaming: true,
			supportsVision: true,
			costPer1kInputTokens: 0.002,
		},
	]);
	mocks.testProviderConnections.mockResolvedValue({
		litellm: { success: true, message: "LiteLLM gateway is configured and reachable", models: ["gpt-4o"] },
		"azure-openai": { success: true, message: "Azure OpenAI is configured and available" },
		ollama: { success: false, message: "Ollama is not reachable" },
	});
	mocks.getFallbackProviders.mockReturnValue(["litellm", "ollama", "openai"]);
	mocks.getEffectiveProvider.mockReturnValue("litellm");
	mocks.isProviderConfigured.mockImplementation((provider: string) => provider === "litellm" || provider === "azure-openai");
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

describe("AI provider governance snapshot", () => {
	it("returns provider health, fallback readiness, models, and redacted configuration posture", async () => {
		const snapshot = await getAIProviderGovernanceSnapshot();

		expect(snapshot).toMatchObject({
			checkedBy: "ai-admin-1",
			overallAvailable: true,
			activeProvider: "litellm",
			effectiveProvider: "litellm",
			fallbackProviders: ["litellm", "ollama"],
			fallbackReady: true,
			configuration: {
				LITELLM_URL: true,
				LITELLM_API_KEY: true,
				LLM_MODEL: true,
				AZURE_OPENAI_API_KEY: true,
				AZURE_OPENAI_ENDPOINT: true,
				AZURE_OPENAI_DEPLOYMENT_NAME: true,
				AZURE_OPENAI_API_VERSION: true,
				OLLAMA_BASE_URL: false,
			},
		});
		expect(snapshot.checkedAt).toEqual(expect.any(String));
		expect(snapshot.providers).toEqual([
			expect.objectContaining({
				provider: "litellm",
				configured: true,
				available: true,
				modelCount: 1,
				modelIds: ["gpt-4o"],
				role: "active",
			}),
			expect.objectContaining({
				provider: "azure-openai",
				configured: true,
				available: true,
				modelCount: 1,
				modelIds: ["gpt-4.1"],
				role: "candidate",
			}),
			expect.objectContaining({
				provider: "ollama",
				configured: false,
				available: false,
				role: "fallback",
			}),
		]);
		expect(snapshot.models).toEqual([
			expect.objectContaining({
				provider: "litellm",
				modelId: "gpt-4o",
				hasCostMetadata: true,
			}),
			expect.objectContaining({
				provider: "azure-openai",
				modelId: "gpt-4.1",
				hasCostMetadata: true,
			}),
		]);
		expect(JSON.stringify(snapshot)).not.toContain("test-key");
		expect(JSON.stringify(snapshot)).not.toContain("litellm-test-key");
	});

	it("surfaces degraded provider diagnostics without inventing availability", async () => {
		mocks.manager.isAvailable.mockResolvedValue(false);
		mocks.manager.getActiveProvider.mockResolvedValue(null as any);
		mocks.manager.listAllModels.mockResolvedValue([]);
		mocks.testProviderConnections.mockResolvedValue({
			litellm: { success: false, message: "LiteLLM connection refused", models: [] },
			"azure-openai": { success: false, message: "Azure OpenAI is configured but unavailable" },
			ollama: { success: false, message: "Ollama is not reachable" },
		});
		mocks.isProviderConfigured.mockImplementation((provider: string) => provider !== "ollama");

		const snapshot = await getAIProviderGovernanceSnapshot();

		expect(snapshot).toMatchObject({
			overallAvailable: false,
			activeProvider: null,
			fallbackReady: false,
			models: [],
		});
		expect(snapshot.diagnostics).toContain("No AI provider is available for completion or adaptation work.");
		expect(snapshot.diagnostics).toContain("litellm is configured but unavailable: LiteLLM connection refused");
		expect(snapshot.diagnostics).toContain("azure-openai is configured but unavailable: Azure OpenAI is configured but unavailable");
		expect(snapshot.diagnostics).toContain("ollama is not configured.");
	});
});
