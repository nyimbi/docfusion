import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const manager = {
		initialize: vi.fn(async () => undefined),
		isAvailable: vi.fn(async () => true),
		getActiveProvider: vi.fn(async () => ({ name: "azure-openai" })),
		listAllModels: vi.fn(async () => [
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
			"azure-openai": { success: true, message: "Azure OpenAI is configured and available" },
			ollama: { success: false, message: "Ollama is not reachable" },
		})),
		getFallbackProviders: vi.fn(() => ["ollama", "openai"]),
		getEffectiveProvider: vi.fn(() => "azure-openai"),
		isProviderConfigured: vi.fn((provider: string) => provider === "azure-openai"),
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
		AZURE_OPENAI_API_KEY: "test-key",
		AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
		AZURE_OPENAI_DEPLOYMENT_NAME: "gpt-4.1",
		AZURE_OPENAI_API_VERSION: "2024-12-01-preview",
		OLLAMA_BASE_URL: "",
	};
	mocks.manager.initialize.mockResolvedValue(undefined);
	mocks.manager.isAvailable.mockResolvedValue(true);
	mocks.manager.getActiveProvider.mockResolvedValue({ name: "azure-openai" });
	mocks.manager.listAllModels.mockResolvedValue([
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
		"azure-openai": { success: true, message: "Azure OpenAI is configured and available" },
		ollama: { success: false, message: "Ollama is not reachable" },
	});
	mocks.getFallbackProviders.mockReturnValue(["ollama", "openai"]);
	mocks.getEffectiveProvider.mockReturnValue("azure-openai");
	mocks.isProviderConfigured.mockImplementation((provider: string) => provider === "azure-openai");
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
			activeProvider: "azure-openai",
			effectiveProvider: "azure-openai",
			fallbackProviders: ["ollama"],
			fallbackReady: true,
			configuration: {
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
				provider: "azure-openai",
				configured: true,
				available: true,
				modelCount: 1,
				modelIds: ["gpt-4.1"],
				role: "active",
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
				provider: "azure-openai",
				modelId: "gpt-4.1",
				hasCostMetadata: true,
			}),
		]);
		expect(JSON.stringify(snapshot)).not.toContain("test-key");
	});

	it("surfaces degraded provider diagnostics without inventing availability", async () => {
		mocks.manager.isAvailable.mockResolvedValue(false);
		mocks.manager.getActiveProvider.mockResolvedValue(null as any);
		mocks.manager.listAllModels.mockResolvedValue([]);
		mocks.testProviderConnections.mockResolvedValue({
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
		expect(snapshot.diagnostics).toContain("azure-openai is configured but unavailable: Azure OpenAI is configured but unavailable");
		expect(snapshot.diagnostics).toContain("ollama is not configured.");
	});
});
